---
title: "The syscall I forgot: directory fsync"
date: 2026-02-16
categories: [Programming]
tags: [beachdb, databases, storage, durability, fsync]
toc: true
---

> **TL;DR**: I fsynced the WAL file on every write. Crash tests passed. SIGKILL tests passed. Then someone asked: "What if the directory doesn't know the file exists?" I was one missing syscall away from losing (almost) everything.
{: .prompt-info }

_This is part of an ongoing series — see all posts tagged [#beachdb](/tags/beachdb/)._

---

## Our first bug!

In my [last post]({% post_url 2026-02-12-beachdb-wal-v1-milestone %}), I walked through BeachDB's Write-Ahead Log: the record format, the crash recovery, the SIGKILL tests. I was feeling pretty good about durability. Then a Discord discussion on "Software Internals" pulled on a loose thread:

> We ended up talking about something I completely missed: `fsync`-ing the WAL file isn't enough when the file is *new*. You also need to `fsync` the directory. Then people started sharing production horror stories of data loss from storage engines that forgot this.

I stared at the thread for a while. Then I stared at my code. Then I stared at the `fsync(2)` man page[^1]:

> Calling fsync() does not necessarily ensure that the entry in the directory containing the file has also reached disk. For that an explicit fsync() on a file descriptor for the directory is also needed.

It was right there the whole time.

## Two pieces of metadata, not one

When you create a new file, two things happen at the filesystem level:

1. The file's **inode** is allocated (its metadata, data blocks, etc.)
2. A **directory entry** is added to the parent directory's inode — a mapping from filename to inode number

These are two separate mutations, and they live independently in the kernel's page cache. Calling `fsync` on the WAL file flushes the file's data and metadata (inode) to disk — but the directory entry? That's the *directory's* metadata. It sits in the page cache until the kernel gets around to flushing it, or until someone fsyncs the directory itself.

So my WAL data was on disk. My WAL file's inode was on disk. But the directory might not know the file exists.

A crash at the wrong moment, and the WAL becomes an orphan: data blocks on disk with no name, left orphaned until repair (or cleaned up by `fsck`). The database opens, sees no WAL, starts fresh. All your data, gone — despite every single `fsync` call succeeding.

## The fix

Almost embarrassingly simple:

```go
func syncDir(path string) error {
    dir, err := os.Open(path)
    if err != nil {
        return fmt.Errorf("beachdb: failed to open directory for sync: %w", err)
    }
    defer dir.Close()
    return dir.Sync()
}
```

Open the directory, call `Sync()`, close it. One call in `engine.Open()`, right after the WAL file is created. That's it.

In BeachDB, this happens when we create the WAL the first time (fresh DB dir). If you're curious, here's [the patch commit](https://github.com/aalhour/beachdb/commit/6d077f77e3670fc4ad99f58b8f08d7c5fa67c1ca)[^2].

You only need to sync the directory when its metadata changes: file creation, rename, or delete. Appending to an existing file doesn't touch the directory, so `db.Put()` doesn't need it.

## I'm not the first to miss this

LevelDB has a function called [`SyncDirIfManifest()`](https://github.com/google/leveldb/blob/main/util/env_posix.cc) that does exactly this — opens the parent directory with `O_RDONLY` and fsyncs it whenever a new MANIFEST file is created. RocksDB has an [`FSDirectory`](https://github.com/facebook/rocksdb/pull/10460) abstraction to fsync directories, and they’ve had bugs where directory fsync was accidentally skipped due to lifecycle/close issues. If the RocksDB team can get this wrong, I don't feel too bad.

Jeff Moyer's LWN article [*"Ensuring data reaches disk"*](https://lwn.net/Articles/457667/) spells this out clearly:

> A newly created file may require an fsync() of not just the file itself, but also of the directory in which it was created (since this is where the file system looks to find your file).

## The lesson

I had `fsync` everywhere. I had crash tests. I had SIGKILL tests. And I was still one missing syscall away from losing everything.

Durability is a promise you keep in layers, and I'd missed a layer. The code is patched[^2], the tests are written, and I won't forget this one.

---

## Notes & references

[^1]: The `fsync(2)` man page: [man7.org/linux/man-pages/man2/fsync.2.html](https://man7.org/linux/man-pages/man2/fsync.2.html)
[^2]: The patch: [`engine/fs.go`](https://github.com/aalhour/beachdb/blob/main/engine/fs.go), [`engine/fs_test.go`](https://github.com/aalhour/beachdb/blob/main/engine/fs.go) with simple tests, and its call in [`engine/db.go`](https://github.com/aalhour/beachdb/blob/main/engine/db.go), full patch commit [here](https://github.com/aalhour/beachdb/commit/6d077f77e3670fc4ad99f58b8f08d7c5fa67c1ca)

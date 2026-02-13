---
title: "Durability is a promise you can't hand-wave: BeachDB's Write-Ahead Log (v1)"
date: 2026-02-12
categories: [Programming]
tags: [beachdb, databases, storage, durability, wal]
toc: true
track: https://www.youtube.com/watch?v=lSHVMMfn3Js
---

> **TL;DR**: BeachDB v0.0.1 is out, and it ships the Write-Ahead Log — the thing that makes durability real. This post walks through how `fsync` actually works with an interactive demo (most tutorials skip this), explains the WAL record format, and shows how I tested crash recovery by killing the database repeatedly. [Code is here](https://github.com/aalhour/beachdb).
{: .prompt-info }

_This is part of an ongoing series — see all posts tagged [#beachdb](/tags/beachdb/)._

## It's been a minute!

In my [last post]({% post_url 2026-01-07-building-beachdb %}), I introduced [BeachDB](https://github.com/aalhour/beachdb): a distributed NoSQL database I'm building from scratch in Go to learn storage internals, durability, and eventually distributed consensus. I showed an interactive LSM-Tree visualization and talked about the architecture.

Now it's time to show real code.

[BeachDB v0.0.1](https://github.com/aalhour/beachdb/releases/tag/v0.0.1) is the first tagged release, and it ships the Write-Ahead Log (WAL). The WAL is the durability spine of the database. Every write lands here before it's acknowledged. If the process crashes and restarts, the WAL is how we recover state.

If you want to see runnable examples in Go, head over to: [github.com/aalhour/beachdb/examples/](https://github.com/aalhour/beachdb/tree/main/examples), and play with the code under `engine/`. The [`examples/engine/basic_usage/`](https://github.com/aalhour/beachdb/blob/main/examples/engine/basic_usage/main.go) is a good starting point, as it demonstrates basic API usage of the storage engine, namely: create a new database, and call Put, Get and Delete on it.

This post walks through what I built, why I made certain design decisions, and how I tested it. If you've ever wondered what it takes to make a database that doesn't lie about your data, this is the answer.

## What is this thing you call a WAL?

A WAL is a log that a database promising durability uses in order to track evidence of data mutations (create, update, delete). The concept is old and most serious databases, such as: PostgreSQL and SQLite, use one. In the LSM-tree world, LevelDB[^1] and RocksDB[^2] both have well-documented WAL implementations that BeachDB draws inspiration from.

When a new `db.Put(key, value)` or `db.Delete(key)` comes in, the first thing that the database would do is to append an entry to the WAL documenting the action before actually doing anything with it — which varies from one database to another. Some databases modify the filesystem as a part of the critical path for serving writes, some just cache them in-memory (in addition to appending the WAL entry).

Before writing any code, I needed to define what durability means for BeachDB. Here's the contract:

- **Committed = fsync'd**: A write is committed only after `fsync` returns.
- **Acknowledged = durable**: If `db.Put()` or `db.Write()` returns success, the data survives restart.
- **Crash before fsync**: The write is lost, but the caller never saw success.

This is the rule that matters. If the database says "OK, I saved your data," then that data must survive power loss, SIGKILL, kernel panics — anything short of physical disk destruction.

> The mental model: if you didn't get a success response, assume it didn't happen. If you did get a success response, the data is safe.
{: .prompt-tip }

---

## Prelude: Systems programming and why **fsync** matters

There are many ways to write data to disk, and each programming language comes with its own `os` package. But unlike common wisdom, importing the `os` package DOES make you a systems programmer... _joking!_

Before I show the WAL code, let me explain the thing that makes durability possible, which is also the thing that most tutorials skip.

### What happens when you "write to a file"?

Let's take a look at an example program:

```go
package main

import (
    "fmt"
    "log"
    "os"
)

func main() {
    // Create a new file and check the returned error value
    f, err := os.Create("/tmp/hello-fsync.txt")
    if err != nil {
        log.Fatal(err)
    }
    defer f.Close()

    data := []byte("Hello, world!")

    // Write the data to the file
    if _, err := f.Write(data); err != nil {
        log.Fatal(err)
    }

    // Is the data guaranteed to be on disk now?
    fmt.Println("Data written and maybe synced to disk.")
}
```

When the above program calls `file.Write(data)`, the bytes don't go to disk. They go to the **kernel's page cache**[^3]: a region of RAM that the operating system uses to buffer I/O. The kernel will eventually flush those pages to the physical storage device, but "eventually" might mean seconds, minutes, or never (if the machine loses power first). Unless you call `f.Sync()`.

Here's the stack, simplified:

```
Example program
   │
   ▼
file.Write(data)             ← userspace: copies bytes to kernel
   │
   ▼
Kernel page cache (RAM)      ← data lives here, NOT on disk yet
   │
   ▼  (sometime later, maybe)
Disk controller / NVMe       ← actual stable storage
   │
   ▼
Physical media (platters, NAND cells)
```

A `write()` syscall returns successfully as soon as the kernel has copied your data into the page cache. It makes **no guarantee** about the data reaching the disk. If the power goes out one millisecond after `write()` returns, the data is gone.

This is fine for most programs. Log files, temp files, caches — who cares if you lose the last few seconds. But for a database that just told a client "your data is saved," this is a lie.

### Enter `fsync`

The `fsync(fd)`[^4] syscall tells the kernel: "flush all dirty pages for this file descriptor to stable storage, and don't return until it's done." After `fsync` returns, the data is on the physical device[^5].

```
Your program
   │
   ▼
file.Write(data)             ← copies bytes to kernel page cache
   │
   ▼
file.Sync()                  ← calls fsync(fd): blocks until data hits disk
   │                            (this is the expensive part)
   ▼
Data is durable              ← survives power loss, SIGKILL, kernel panic
```

In Go, `(*os.File).Sync()` calls `fsync` under the hood. That's all there is to it.

Here's how the updated `main()` function from earlier would look like with an `fsync` call:

```go
func main() {
    // Create a new file and check the returned error value
    f, err := os.Create("/tmp/hello-fsync.txt")
    if err != nil {
        log.Fatal(err)
    }
    defer f.Close()

    data := []byte("Hello, world!")

    // Write the data to the file
    if _, err := f.Write(data); err != nil {
        log.Fatal(err)
    }

    // Call `fsync(fd)` to sync changes to disk
    if err := f.Sync(); err != nil {
        log.Fatal(err)
    }

    // If a crash happens after the `f.Sync()` call succeeds, we're safe(-ish)!
    fmt.Println("Data was written and synced to disk.")
}
```

### The cost of `fsync`

`fsync` is slow. How slow depends on the storage device:

| Device | Typical fsync latency |
|--------|----------------------|
| NVMe SSD | 50 μs – 1 ms (varies by drive) |
| SATA SSD | 200-500 μs |
| Spinning HDD | 5-15 ms (one disk rotation!) |

For perspective: a `write()` to the page cache takes microseconds. An `fsync` to a spinning disk takes **milliseconds**, which is three orders of magnitude slower! This is why databases obsess over batching writes and minimizing `fsync` calls.

### fsync vs. fdatasync

There's a lighter-weight cousin to `fsync` and that's the `fdatasync(fd)`[^6] syscall. The difference:

- **`fsync`**: Flushes both the file's **data** and its **metadata** (size, timestamps, directory entry) to disk.
- **`fdatasync`**: Flushes only the file's **data**. It skips metadata unless the metadata change is needed to correctly read the data (e.g., file size increased).

In practice, `fdatasync` can skip the directory entry update, saving one extra I/O on some filesystems. Many databases use `fdatasync` for WAL appends because the directory entry doesn't change (the file already exists; only its size grows). RocksDB [defaults to `fdatasync`](https://github.com/facebook/rocksdb/wiki/WAL-Performance) on Linux for this exact reason, and exposes a `use_fsync` option if you want the stronger guarantee. LevelDB uses `fdatasync` when available and [falls back to `fsync`](https://github.com/google/leveldb/blob/main/util/env_posix.cc) otherwise.

Go's `(*os.File).Sync()` calls `fsync`, not `fdatasync`. If you want `fdatasync`, you need `syscall.Fdatasync(int(file.Fd()))` on Linux. For BeachDB v1, I use `Sync()` (plain `fsync`) because correctness over cleverness[^7] and simplicity.

### What about `O_SYNC` and `O_DSYNC`?

Instead of calling `fsync` after every write, you can open the file with `O_SYNC` or `O_DSYNC` flags:

- **`O_SYNC`**: Every `write()` behaves as if followed by `fsync`. Data + metadata flushed on every write.
- **`O_DSYNC`**: Every `write()` behaves as if followed by `fdatasync`. Data flushed on every write.

These are convenient but inflexible, you can't batch multiple writes before flushing, for example. For a WAL, I want to write the header *and* the payload *and then* fsync once. Using `O_SYNC` would fsync after each `write()` call, which is wasteful.

### The durability cheat sheet

When thinking about the different options to write data to disk one can easily get confused. Below is a summary of the options discussed so far with a comparison on whether they help us survive crashes or not.

| API | Data in page cache | Data on disk | Survives crash |
|-----|-------------------|-------------|----------------|
| `write()` alone | Yes | Maybe, eventually | **No** |
| `write()` + `fsync()` | Yes | Yes | **Yes** |
| `write()` + `fdatasync()` | Yes | Yes (data; metadata maybe) | **Yes** |
| `O_SYNC` flag + `write()` | Yes | Yes (every write) | **Yes** |
| `O_DSYNC` flag + `write()` | Yes | Yes (data; every write) | **Yes** |
| `mmap` + `msync` | Yes | Yes (after msync) | **Yes** (after msync) |
| `mmap` without `msync` | Yes | Maybe | **No** |

### The lie that `write()` returns success

This is the part that trips people up. `write()` returns the number of bytes written, but "written" here means "copied to kernel memory." The return value tells you nothing about durability. A program that does `write()` → check for error → tell the user "saved!" is making a promise it can't keep.

BeachDB's contract is simple: the [`db.Write()`](https://github.com/aalhour/beachdb/blob/9c78234d73631abe102163c12c1c558c1c6b6055/engine/db.go#L91-L102) method doesn't return until `fsync` completes. If `fsync` fails, the write fails. If the process dies before `fsync`, the write was never acknowledged, so there's no broken promise.

This is what I mean by "durability is a promise you can't hand-wave."

### Demo time: Seeing is syncing!

The write → page cache → fsync → disk flow is abstract until you *see* it. Static diagrams help, but watching bytes move through the stack makes the distinction between "written" and "durable" stick. So I built another `Anime.js` animation to animate the flow.

> I'm digging learning Anime.js while working on this project. Visualizing an idea is powerful, as it forces you to understand it well enough to teach it.
{: .prompt-monologue }

{% include animations/fsync.html %}

If you want to go even deeper on SSD internals, I recommend checking out the Code Capsule blog. They have a series on the topic called: _"Coding for SSDs"_, here's a link: [Part 1: Introduction and Table of Contents](https://codecapsule.com/2014/02/12/coding-for-ssds-part-1-introduction-and-table-of-contents/).

---

## Designing WAL Record Format

Now that we have `fsync` and durability primitives under our belts, we can move forward to the WAL record design and format.

A WAL file is a sequence of records. Each record wraps one encoded `Batch` (a group of Put and Delete operations that are applied atomically). There are no Create operations in BeachDB. The `Put` operation means: "update if exists or create".

Here's the layout, please note that offset numbers denote indexes in byte arrays and sizes denote numbers of bytes:

```
WAL Record Layout (v1)
======================

Offset  Size  Field       Description
------  ----  -----       -----------
0       2     magic       0xBE 0xAC ("BEach")
2       1     version     0x01 for v1
3       1     type        Record type (0x01 = Full)
4       4     length      Payload length in bytes (big-endian)
8       4     checksum    CRC32C of payload (big-endian)
12      N     payload     Encoded batch (N = length bytes)

Header size: 12 bytes
Total record size: 12 + N bytes
```

Let me walk you through the fields:

| Field | Purpose |
|-------|---------|
| `magic` | Identifies this as a BeachDB WAL record. If `wal_dump` opens a JPEG by accident, it fails immediately with "bad magic" instead of interpreting pixel data as batches. |
| `version` | Format version. Allows future changes without silent misinterpretation. |
| `type` | Record type. v1 only uses `Full` (complete record). Reserved for future fragmentation. |
| `length` | Payload size. Tells the reader exactly how many bytes to read after the header. |
| `checksum` | CRC32C[^8] of the payload bytes. This catches silent bit flips and torn writes. |
| `payload` | The encoded `Batch` containing the actual Put/Delete operations. |

To read more about the WAL and Batch formats, I've uploaded the docs to `beachdb/docs/formats`, see: [WAL Format (v1)](https://github.com/aalhour/beachdb/blob/5c6d7d5c1085b1dd421b9f4ebfd309902bdc3cad/docs/formats/wal.md) and [Batch Encoding Format (v1)](https://github.com/aalhour/beachdb/blob/5c6d7d5c1085b1dd421b9f4ebfd309902bdc3cad/docs/formats/batch.md).

## Design Decisions

When building the WAL, I had to make several choices. Here's my reasoning.

### Decision #1: Why checksum in the header, not a trailer?

I put the checksum in the header (before the payload) rather than as a trailing field. This means the reader can:

1. Read 12 bytes (fixed header size).
2. Know the payload length and expected checksum before reading anything else.
3. Reject obviously broken headers (bad magic, absurd length) without reading the payload at all.

To be clear: I still have to read the entire payload to compute the checksum and compare it. There's no magic here — CRC32 needs all the bytes. But with everything in the header, I read once (header), know exactly how much to read next (payload), and have the expected checksum ready for comparison. No backtracking, no extra read for a trailer.

The tradeoff is that the writer must compute the checksum before writing the header, which means buffering the payload in memory first. For BeachDB's workload (small batches, fsync per batch), this is fine.

### Decision #2: Why CRC32C specifically?

CRC32C (Castagnoli) over plain CRC32 because:

1. **Hardware acceleration.** Modern CPUs have native CRC32C instructions. Go's `hash/crc32` uses them automatically.
2. **Better error detection.** CRC32C has better hamming distance properties for certain error patterns.
3. **Industry standard.** Used by RocksDB, LevelDB, Spanner, and others.

Also, CRC32C is supported in Go out of the box, see the [`beachdb/internal/util/checksum`](https://github.com/aalhour/beachdb/blob/9c78234d73631abe102163c12c1c558c1c6b6055/internal/util/checksum/checksum.go) package for the short implementation.

### Decision #3: Why big-endian byte order?

I chose big-endian (network byte order) for all multi-byte integers because hex dumps are readable. `0x00 0x00 0x00 0x2A` clearly reads as 42. Little-endian would be `0x2A 0x00 0x00 0x00`, which is harder to scan visually.

Network protocols and many binary file formats use big-endian. It's what people expect when inspecting with `hexdump`.

## Crash Recovery

On startup, BeachDB replays the WAL to reconstruct state:

1. Open the WAL file for reading.
2. Read records sequentially until EOF or error.
3. For each valid record: decode the batch, apply to in-memory state.
4. Open the WAL file for append (new writes go at the end).

### Scenario #1: Handling Truncation

A truncated record at the end of the WAL means the process crashed mid-write:

- **Truncated header** (< 12 bytes): Ignore, treat as EOF.
- **Truncated payload** (header valid, payload incomplete): Ignore, treat as EOF.

The incomplete record was never `fsync`'d, so the batch was never acknowledged to the caller. Discarding it is correct.

### Scenario #2: Handling Corruption

- **Bad magic**: Stop. Either file isn't a WAL, or we've hit garbage.
- **Checksum mismatch**: Stop. Data is corrupted. Fail loudly.
- **Unsupported version**: Stop. We don't understand this format.

v1 does not attempt repair. Corruption is surfaced, not hidden.

> This is a deliberate choice. I'd rather the database fail loudly than silently eat your data. You can always debug a failure. Silent data corruption is a nightmare.
{: .prompt-info }

## Testing: Crash Loops and SIGKILL

A durability promise is worthless if you can't prove it, so I wrote two kinds of tests.

### Type #1: In-process Crash Tests

These tests ([`engine/crash_test.go`](https://github.com/aalhour/beachdb/blob/main/engine/crash_test.go)) simulate crashes by truncating or corrupting the WAL file, then reopening the database:

```go
// Write some data
db, _ := Open(dir)
db.Put(ctx, []byte("key1"), []byte("value1"))
db.Put(ctx, []byte("key2"), []byte("value2"))
db.Close()

// Truncate the WAL (simulate crash mid-write)
walPath := filepath.Join(dir, "beachdb.wal")
info, _ := os.Stat(walPath)
os.Truncate(walPath, info.Size()-10) // Remove last 10 bytes

// Reopen - should handle truncation gracefully
db2, _ := Open(dir)
// Verify recovered data...
```

I also wrote a randomized stress test that runs 50 cycles of:
1. Open database
2. Write 5-15 random key-value pairs
3. Close
4. Randomly truncate or corrupt the WAL (50% chance)

After 50 cycles, the database must still be able to open and recover at least some data.

### Type #2: Out-of-process SIGKILL Tests

The real durability test is SIGKILL. The [`crash`](https://github.com/aalhour/beachdb/tree/main/cmd/crash) utility spawns a writer subprocess that continuously writes data, then kills it with `SIGKILL` at random intervals:

```bash
$ ./crash --dbdir=/tmp/beachdb --cycles=20 --min-delay=50 --max-delay=200
Cycle 0: spawning writer subprocess
Cycle 0: killing subprocess with SIGKILL after 127ms
Cycle 0: writer claimed 3 keys were committed
...
Final verification: reopening DB to check 47 keys
Results: 45 recovered, 2 lost out of 47 total
```

Some data loss is acceptable — the writer might claim a key was committed but crash before the `fsync` completed. The important thing is that the database never loses data it said was durable, and it can always recover to a consistent state.

## The `wal_dump` Tool

One of guiding principles I chose for BeachDB is **inspectability**: I don't trust a file format until I can dump it. The [`wal_dump`](https://github.com/aalhour/beachdb/tree/main/cmd/wal_dump) tool is my way of turning the WAL from an opaque binary blob into something I can read, debug, and reason about.

Basic usage shows each record's size and checksum status:

```bash
$ wal_dump /tmp/beachdb/beachdb.wal
Reading WAL: /tmp/beachdb/beachdb.wal

Record 0: 47 bytes
Record 1: 23 bytes
Record 2: 31 bytes

End of WAL (3 records, 101 bytes total)
```

With the `-decode` flag, it goes deeper and shows how many operations are in each batch:

```bash
$ wal_dump -decode /tmp/beachdb/beachdb.wal
Reading WAL: /tmp/beachdb/beachdb.wal

Record 0: 47 bytes (batch: 3 operations)
Record 1: 23 bytes (batch: 1 operations)
Record 2: 31 bytes (batch: 2 operations)

End of WAL (3 records, 101 bytes total)
```

When something goes wrong, the tool tells you exactly where:

```bash
$ wal_dump /tmp/beachdb/beachdb.wal
Reading WAL: /tmp/beachdb/beachdb.wal

Record 0: 47 bytes
Record 1: CORRUPTED (checksum mismatch)

End of WAL (1 complete records, 1 incomplete)
```

I've lost count of how many times this tool saved me during development. When a test failed, I could immediately see: did the record get written? Was it truncated? Did the checksum pass? No guessing, no printf debugging — just evidence.

## Runnable Examples

As pointed out in the introductory section of this post, this release includes four runnable examples for the engine in the [`examples/engine/`](https://github.com/aalhour/beachdb/tree/5c6d7d5c1085b1dd421b9f4ebfd309902bdc3cad/examples/engine) directory:

```bash
# Basic usage
go run examples/engine/basic_usage/main.go

# Batch operations
go run examples/engine/batch_operations/main.go

# Crash recovery demonstration
go run examples/engine/crash_recovery/main.go

# Configuration options
go run examples/engine/options/main.go
```

These are also part of the test suite (you can run all of them with `make examples`) and serve as documentation.

## What's Next

The WAL is done. The database can now:

- Write batches of Put and Delete operations atomically
- Survive crashes and recover state
- Detect corruption and truncation
- Be inspected with `wal_dump`

Next up: the **Memtable**. Right now, BeachDB uses a plain `map[string][]byte` for in-memory state. That's fine for proving the WAL works, but it's not sorted, doesn't support range scans, doesn't handle tombstones properly for compaction, and it's certainly only there for developmental purposes as it allowed me to build the spine of the database and focus on implementing the WAL without ballooning the scope of this milestone by including a Memtable implementation as well.

The memtable will be a sorted structure (probably a skip list) that maintains insertion order for iteration and tracks tombstones for later deletion during compaction.

After that: SSTables, flush, merge iterators, and the rest of the LSM tree.

That's it for this milestone.

## Btw!

I enabled comments on this blog and would love to hear from you below, let me know what you think!

Until we meet again.

Adios! ✌🏼

---

## Notes & references

[^1]: LevelDB's WAL format: [github.com/google/leveldb/docs/log_format.md](https://github.com/google/leveldb/blob/main/doc/log_format.md)
[^2]: RocksDB's WAL format: [github.com/facebook/rocksdb/wiki/Write Ahead Log (WAL)](https://github.com/facebook/rocksdb/wiki/Write-Ahead-Log-%28WAL%29)
[^3]: For more details on the Kernel Page Cache in Linux, see the [page cache entry](https://kernel-internals.org/mm/page-cache/) on kernel-internals.org.
[^4]: For more details on the `fsync(fd)` syscall in the Linux kernel, see: [fsync(2)](https://www.man7.org/linux/man-pages/man2/fsync.2.html) man page.
[^5]: "On the physical device" comes with a caveat: some disk controllers have their own write caches, and `fsync` returning doesn't always mean the data has reached the actual magnetic platters or NAND cells. Enterprise SSDs and battery-backed RAID controllers handle this correctly. Consumer drives may lie. This is a known issue in the database world; see the SQLite documentation on [write-ahead logging](https://www.sqlite.org/wal.html) for a pragmatic discussion.
[^6]: For more details on the `fdatasync(fd)` syscall in the Linux kernel, see: [fdatasync(2)](https://www.man7.org/linux/man-pages/man2/fdatasync.2.html) man page.
[^7]: Some databases (like PostgreSQL) default to `fdatasync` on Linux and `fsync` on macOS because macOS's `fcntl(F_FULLFSYNC)` is the only truly reliable flush on Apple hardware — even `fsync` on macOS doesn't guarantee data has hit stable storage. BeachDB doesn't worry about this yet. For RocksDB's handling, see the [WriteOptions::sync](https://github.com/facebook/rocksdb/wiki/Basic-Operations#synchronous-writes) documentation. LevelDB's approach is documented in its [write path implementation](https://github.com/google/leveldb/blob/main/doc/index.md). RocksDB also allows choosing between `fsync` and `fdatasync` via the [`use_fsync`](https://github.com/facebook/rocksdb/wiki/WAL-Performance) option, defaulting to `fdatasync` on Linux for better performance.
[^8]: CRC32C (Castagnoli) is a variant of CRC32 that uses a different polynomial (0x1EDC6F41) with better error detection properties. Modern CPUs have hardware instructions for CRC32C (Intel SSE 4.2, ARM CRC). Go's `hash/crc32` package automatically uses these when available. See: [CRC32C in Go](https://pkg.go.dev/hash/crc32).

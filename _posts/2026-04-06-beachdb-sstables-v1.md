---
title: "Making the on-disk state real: SSTables (v1)"
date: 2026-04-06
categories: [Programming]
tags: [beachdb, databases, storage, sstable, durability]
toc: true
mermaid: true
track:
---

> **TL;DR**: BeachDB v0.0.3 is out, and it ships SSTables v1: immutable sorted files on disk, a real memtable flush path, on-disk reads, and an `sst_dump` tool so I can inspect the bytes instead of trusting vibes. This is the milestone where BeachDB stops being an in-memory engine with a WAL and starts having a real disk plane. [Code is here](https://github.com/aalhour/beachdb).
{: .prompt-info }

_This is part of an ongoing series — see all posts tagged [#beachdb](/tags/beachdb/)._

---

## The disk plane finally gets real

It has been a while since the last milestone, and most of that time disappeared into the unglamorous but important question of what kind of file format I wanted to commit to. It felt like the moment I moved from memory to disk, every casual design choice started feeling a lot less casual.

[BeachDB v0.0.3](https://github.com/aalhour/beachdb/releases/tag/v0.0.3) is the milestone where the LSM diagram stops bluffing about data on disk.

BeachDB can now flush a full memtable into immutable sorted files on disk, reopen those files, and read through them. Those files have sparse indexes and fixed-size footers, so reads can binary-search candidate blocks instead of scanning the whole file. It writes real database files now.

This post walks through what changed in the engine, what one of those files looks like on disk, why the format looks the way it does, and how I convinced myself the bytes were not lying.

Before we dig deeper, it's worth reviewing what the project has shipped this far.

## A quick recap

[In the last post]({% post_url 2026-02-22-beachdb-memtable-v1 %}), [v0.0.2](https://github.com/aalhour/beachdb/releases/tag/v0.0.2) shipped the memtable and wired it to the WAL. BeachDB got to a weirdly honest intermediate state that made it look like an in-memory database with a WAL:

- new writes were durable because of the WAL (on disk)
- new writes were readable because of the memtable (in memory)
- but the disk plane itself was still mostly a promise

Crash recovery worked. Tombstones existed. Internal keys existed. The engine could behave like an LSM in memory while still not producing any actual sorted files on disk.

That missing edge looked like this:

```mermaid
flowchart LR
  W["Put/Delete"] --> WAL["WAL"]
  W --> MEM["Active Memtable"]
  MEM -. "when full (v0.0.3)" .-> IMM["Immutable Memtable"]
  IMM -. "background flush" .-> SST["SSTable (.sst)"]

  R["Get"] -. "1) check active memtable" .-> MEM
  R -. "2) check frozen memtable, if exists" .-> IMM
  R -. "3) check sstables on disk" .-> SST
```

Those memtable -> SSTable paths are what this milestone makes real.

The public API did not change. `Put`, `Get`, and `Delete` are the same. What changed is the journey that the data takes after it enters the engine:

```text
WAL -> active memtable -> immutable memtable -> SSTable(s)
```

Before v0.0.3, the memtable was the destination. After v0.0.3, it becomes what it was always supposed to be: a staging area.

If [`v0.0.1`](https://github.com/aalhour/beachdb/releases/tag/v0.0.1) made durability real and [`v0.0.2`](https://github.com/aalhour/beachdb/releases/tag/v0.0.2) made the in-memory shape real, then [`v0.0.3`](https://github.com/aalhour/beachdb/releases/tag/v0.0.3) makes the on-disk state real.

This is point-lookups-through-SSTables, not yet full version-set or compaction machinery. Those parts are still later.

## So, what is an SSTable?

The term "SSTable" is short for Sorted String Table. It comes from the Bigtable paper[^1], but the shape escaped into a lot of other systems after that: LevelDB[^3], RocksDB[^4], Pebble[^5], HBase/HFile[^7], Cassandra[^8], and plenty of smaller LSM engines too.

> SSTables are immutable sorted files that storage engines write to disk once in-memory state graduates out of the memtable. They are how “a bunch of writes in memory” turns into durable, searchable on-disk state.
{: .prompt-tip }

In BeachDB, an SSTable is an **immutable sorted file of key-value entries** written from a full memtable (a skiplist) to disk.

It is not a table in the SQL sense. It is not a schema object. It is just a storage-engine file with one job:

- take sorted internal keys from memory
- write them to disk in sorted order
- carry enough structure that a reader can find things without scanning the whole file

If you want the 10,000-ft version of why storage engines end up looking like this, Chapter 3 of Martin Kleppmann's Designing Data Intensive Applications[^2] is still the cleanest guide I know.

### The plain-text version first

Before bytes and checksums, the idea looks like this. Suppose the database directory already contains two SSTables:

```text
# 000001.sst  (older)
apple@1  Put     = "red"
banana@2 Put     = "yellow"

# 000002.sst  (newer)
apple@3  Put     = "green"
banana@4 Delete  = <tombstone>
```

Now a `Get("apple")` does not mean "open one file." It means:

1. check memory first
2. if memory misses, check the newest SSTable
3. if still missing, keep going backward through older SSTables

So:

- `Get("apple")` returns `"green"` because the newer file (`2.sst`) shadows the older one (`1.sst`)
- `Get("banana")` returns "not found" because the newer tombstone shadows the older put

That is the part I think is easiest to miss when people hear "simple key-value store." Even a tiny LSM-ish engine stops being "one map on disk" pretty quickly. It becomes a few sorted files, ordered newest-to-oldest, plus a couple of rules about shadowing and tombstones.

In BeachDB, a new SSTable appears when the active memtable fills up, gets frozen, and is flushed in the background into the next `.sst` file.

We'll follow that engine path first, then crack the file open in [The SSTable format](#the-sstable-format), move to [Why BeachDB's SSTable v1 looks like this](#why-beachdbs-sstable-v1-looks-like-this), and finally dig into the bytes in [Running it locally and opening a real file](#running-it-locally-and-opening-a-real-file).

## Write path: same API, different destination

`Put()` and `Delete()` are still boring on purpose, they:

- append the batch to the WAL
- `fsync` the WAL by default
- apply the mutation to the active memtable

The new part is what happens when that memtable stops fitting in memory.

Suppose the DB directory already has:

```text
000000.sst
000001.sst
```

Once the active memtable crosses the flush threshold, the next flush creates `000002.sst`. That is the first real answer to "how are SSTables written?" They are not produced by a separate API. They are produced when a full memtable graduates to disk.

Here is the write path now:

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant DB as engine.DB
  participant WAL as WAL
  participant MEM as Active Memtable
  participant IMM as Immutable Memtable
  participant FL as Flush Goroutine

  C->>DB: Put/Delete
  DB->>WAL: Append batch
  DB->>WAL: fsync (default)
  DB->>MEM: Apply batch
  alt below flush threshold
    DB-->>C: OK
  else threshold reached
    DB->>IMM: Freeze current memtable
    DB->>MEM: Install fresh memtable
    DB->>FL: Signal flush worker
    DB-->>C: OK
  end
```

The API stays the same. The destination changes. Memory stops being the destination and becomes a waiting room on the way to disk.

That still does not explain the frozen memtable part, so let's zoom into the flush itself.

## Flush path: how memory becomes a file

The immutable memtable exists for one reason: flushing is slow enough that old visible state needs somewhere to wait while new writes keep moving.

When the active memtable crosses the threshold, BeachDB does this:

1. seal the active memtable
2. move it into the immutable slot
3. install a fresh active memtable (to unblock new writes)
4. wake the background flush goroutine
5. write the frozen memtable into a new SSTable
6. publish that SSTable to the read path once it is durable and openable

That gives BeachDB the classic small-engine shape:

- one active memtable for new writes
- one immutable memtable being flushed
- N immutable SSTables on disk

Suppose the DB directory already contains `000000.sst` and `000001.sst`. The active memtable crosses the threshold and starts flushing into `000002.sst`. While that happens, a new `Put("mango", "...")` lands in the fresh active memtable immediately. Reads can still consult the frozen immutable memtable until `000002.sst` is fully written and published.

That is why `immMem` exists. It is not just a convenience variable. It is how BeachDB keeps old state visible during a flush without blocking the whole write path.

There is one catch: BeachDB only has one immutable slot right now. If another flush threshold is hit before the first flush finishes, writers wait on a `sync.Cond` until the slot clears. That is deliberate. Small story, real behavior.

### Why not flush inline?

Because a flush is real I/O:

- create the file
- iterate the memtable
- write data blocks
- write the index block
- write the footer
- `fsync` the file
- `fsync` the parent directory
- reopen the file as an SSTable reader

Doing all of that inline in `Write()` would turn every threshold crossing into "everybody pause while the filesystem has a moment." The background flush keeps the common write path boring and pushes the expensive part out of the hot lane.

### Why this shape looks familiar

LevelDB[^3] is the clearest reference point here: one active memtable, one immutable slot, one background worker, one clean freeze -> flush -> publish story.

Pebble[^5] keeps the same idea but generalizes it into a queue of flushable memtables. Same shape, larger waiting room.

RocksDB[^4] scales the pattern up with more concurrency and more backpressure machinery. Useful as proof that the pattern grows; not something BeachDB needs to copy wholesale yet.

BadgerDB[^6] is the useful contrast. It leans more into channels, but the underlying problem is the same: writers need to keep moving, readers need old state to stay visible, and the handoff to disk needs clear synchronization.

BeachDB takes the small LevelDB-ish path for now: one immutable slot, one flush goroutine, `sync.Cond` for writer stalling, and read visibility preserved while the flush is in flight.

## Read path: now reads can reach disk

Now that the immutable memtable exists for a reason, the read path makes sense.

Before this milestone, a miss in the memtable was basically the end of the road. Now it is just the point where the search drops a level.

### Example #1:

Assume the database directory has the following two SSTable files with two `Put` operations and the key is not in the memtable:

```text
000001.sst  -> apple@1 Put = "red"
000002.sst  -> apple@3 Put = "green"
```

`Get("apple")` returns `"green"` because the newer file shadows the older one.

### Example #2:

Now assume that the two files are slightly different, the older one has a `Put` operation and the newer one has a `Delete`, the key is still not in the memtable:

```text
000001.sst  -> banana@2 Put    = "yellow"
000002.sst  -> banana@4 Delete = tombstone
```

`Get("banana")` returns not found because the newer tombstone (on-disk) wins.

That is the whole rule: **newest visible fact wins, and reads now know how to reach disk.**

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant DB as engine.DB
  participant MEM as Active Memtable
  participant IMM as Immutable Memtable
  participant S0 as Newest SSTable
  participant S1 as Older SSTable

  C->>DB: Get(key)
  DB->>MEM: Lookup
  alt found
    MEM-->>DB: value/tombstone
    DB-->>C: result
  else miss
    DB->>IMM: Lookup (if flushing)
    alt found
      IMM-->>DB: value/tombstone
      DB-->>C: result
    else miss
      DB->>S0: Get(key, seqno)
      alt found
        S0-->>DB: value/tombstone
        DB-->>C: result
      else miss
        DB->>S1: Get(key, seqno)
        S1-->>DB: value/tombstone/miss
        DB-->>C: result
      end
    end
  end
```

The search order is:

1. active memtable
2. immutable memtable, if a flush is in progress
3. SSTables newest-first

That newest-first rule is load-bearing. Newer state shadows older state. Tombstones shadow older puts. The engine stops as soon as it finds the first visible answer.

If you want the inside of one SSTable, the next stop is [The SSTable format](#the-sstable-format) or [Running it locally and opening a real file](#running-it-locally-and-opening-a-real-file).

## The SSTable format

So that's the engine story. Now let's look at the file the flush is actually producing.

The formal spec lives in [`docs/formats/sstable.md`](https://github.com/aalhour/beachdb/blob/main/docs/formats/sstable.md), but what follows is the shape of a single SSTable file on-disk:

```text
[data block 0][data block 1]...[data block N][index block][footer]
```

That still hides the important detail, though: a **data block is not one key-value pair**.

Each data block holds **multiple sorted entries** packed together until the block reaches its target size. If the entries are small, one block may hold quite a few of them. If the entries are large, the block may hold only a handful. The block is the unit of storage and checksumming; the entries inside it are the actual key-value records.

In a slightly more expanded view, one SSTable looks like this:

```text
[data block 0: entry, entry, entry, ..., crc32c]
[data block 1: entry, entry, entry, ..., crc32c]
...
[index block: last key of block 0 -> off/size, last key of block 1 -> off/size, ..., crc32c]
[footer]
```

Each data entry (inside a data block) is:

```text
[internal_key_len:4][internal_key_bytes][value_len:4][value_bytes]
```

Each index entry (inside the single pre-footer index block) is:

```text
[last_internal_key_len:4][last_internal_key_bytes][block_offset:8][block_size:4]
```

And the fixed-size footer is:

```text
[magic:8][version:4][index_offset:8][index_size:4][data_block_count:4][entry_count:8][checksum:4]
```

The two rules that matter most are:

- entries are sorted by `(user_key ASC, seqno DESC)`
- the index stores **only the last internal key of each data block**

That second rule is the important one for the read path. The index is sparse: one record per block, not one record per entry. Because the last key is an upper bound for everything inside that block, the reader can construct a synthetic "maximum possible version" for the target user key, binary-search those upper bounds, and jump straight to the first block that could still contain the answer. From there, the on-disk scan stays local instead of wandering through the entire file.

So the index is small, the lookup is logarithmic over blocks, and the on-disk scan stays local. That is the efficiency story in one paragraph.

## Why BeachDB's SSTable v1 looks like this

Now that the concrete shape is on the table, the more interesting question is why it looks like this.

Every storage engine reaches this point and has to answer a few boring but important questions:

1. one giant sorted blob, or blocked layout with a sparse per-block index?
2. header bootstrap, or footer bootstrap?
3. sidecar metadata, or self-contained file?
4. compressed keys, or full keys?
5. whole-file checksum, or finer-grained checks?

BeachDB's answers for SSTable v1 are conservative on purpose. They sit comfortably in the LevelDB[^3] / RocksDB[^4] family, but stay small enough to inspect without needing a decoder ring.

### 1. Blocked layout with a sparse per-block index

This is the same broad shape you see in LevelDB[^3] and RocksDB[^4]: multiple entries per data block, a sparse index with one entry per block, and a bootstrap record that tells the reader where that index lives. Each index key is effectively the upper bound for one block.

Why bother?

- the file does not need a giant per-entry index
- point lookups can binary-search blocks instead of scanning the whole file
- checksums happen at a useful granularity
- there is room for future compression or filter blocks later

Once the file stops being toy-sized, nobody wants point reads to do a whole-file pilgrimage, and nobody wants the index to be as large as the data it is trying to navigate.

### 2. Footer at EOF, not a file header

BeachDB's SSTable does **not** have a bootstrap header. It has a fixed-size footer at the end of the file. The reader:

1. seeks to EOF minus 40 bytes
2. validates the footer
3. reads the index offset and size
4. loads the index
5. uses the index to locate data blocks

That is very much the LevelDB[^3] / RocksDB[^4] tradition: the footer is the trust anchor. The WAL needs per-record headers because it is an append-only log. An SSTable is a finished immutable file, so its bootstrap metadata sits more naturally at EOF.

### 3. The index lives inside the file

The SSTable owns its own block index. It is not a sidecar file. It is not reconstructed from directory metadata. It is part of the SSTable itself.

That matters because:

- the file should be self-describing
- `sst_dump` should explain one file in isolation
- a reader opening one SSTable should not need outside context just to navigate inside it

The SSTable index answers "where inside this file could the key live?" The later manifest/version-set metadata will answer "which files belong to the database view at all?" Those are related problems, but they are not the same problem.

### 4. Full internal keys, not compression theater

BeachDB v1 stores full internal keys in every data entry:

- `user_key`
- `seqno`
- `kind`

That is less space-efficient than what RocksDB[^4] eventually does, but much easier to inspect, specify, and debug.

This is a learning-first format, not an optimization contest.

### 5. Per-block CRC32C, plus a footer checksum

Every data block gets its own CRC32C trailer. The index block gets one too. The footer carries its own checksum as well.

That buys a simple invariant:

> if the bytes are corrupt, the reader should complain loudly instead of improvising meaning.

The checksum granularity is the point. If something is broken, I want the failure to be local and obvious.

## Running it locally and opening a real file

This is still my favorite part of the milestone.

It is one thing to draw a format. It is another to run the database locally, create an actual `.sst` file, and open it from outside the engine.

While writing this post, I ran a tiny demo program locally that does exactly four mutations:

```go
db, err := engine.Open("/tmp/beachdb-sst-post-demo", engine.WithMemtableFlushSize(200))
if err != nil {
    log.Fatal(err)
}

ctx := context.Background()

_ = db.Put(ctx, []byte("apple"), []byte("red"))
_ = db.Put(ctx, []byte("banana"), []byte("yellow"))
_ = db.Put(ctx, []byte("apple"), []byte("green"))
_ = db.Delete(ctx, []byte("banana"))

_ = db.Close()
```

That produced these files on my machine:

```text
/tmp/beachdb-sst-post-demo/000000.sst 183 bytes
/tmp/beachdb-sst-post-demo/beachdb.wal 227 bytes
```

The WAL still being there is intentional. WAL retirement and manifest-backed file lifecycle are later milestones. This one is about teaching BeachDB how to write SSTables at all.

### `sst_dump` on a real BeachDB file

Then I pointed `sst_dump` at the generated SSTable:

```text
$ sst_dump -entries /tmp/beachdb-sst-post-demo/000000.sst
SSTable: /tmp/beachdb-sst-post-demo/000000.sst
  Version: 1
  Entries: 4
  Data blocks: 1
  Index block: offset=108 size=35

Blocks:
  Block 0: offset=0 size=108 last_key="banana" seqno=2

Entries:
  [0] Put    key="apple" seqno=3 value=5 bytes
  [1] Put    key="apple" seqno=1 value=3 bytes
  [2] Delete key="banana" seqno=4 value=0 bytes
  [3] Put    key="banana" seqno=2 value=6 bytes
```

This makes me unreasonably happy.

Three quick things to notice:

- entries are sorted by internal key, not mutation order
- newer versions appear before older ones for the same user key
- the index block starts at offset `108`, exactly where the one data block ends

That is the memtable ordering story surviving the trip to disk.

### Looking at the raw bytes

And now the footer and index in a hex dump:

```text
$ xxd -g 1 -s 0x6c -l 80 /tmp/beachdb-sst-post-demo/000000.sst
0000006c: 00 00 00 0f 62 61 6e 61 6e 61 00 00 00 00 00 00  ....banana......
0000007c: 00 02 01 00 00 00 00 00 00 00 00 00 00 00 6c 61  ..............la
0000008c: 24 d0 c0 42 45 41 43 48 53 53 54 00 00 00 01 00  $..BEACHSST.....
0000009c: 00 00 00 00 00 00 6c 00 00 00 23 00 00 00 01 00  ......l...#.....
000000ac: 00 00 00 00 00 00 04 c7 ea 8f 42                 ..........B
```

This slice starts at offset `0x6c`, which is where the index block begins in this file.

Here's how to read it:

- `00 00 00 0f` -> index key length = 15 bytes
- `62 61 6e 61 6e 61 ... 00 02 01` -> last internal key in the only data block: `"banana"` with `seqno=2`, `kind=Put`
- `00 00 00 00 00 00 00 00` -> block offset = `0`
- `00 00 00 6c` -> block size = `108`
- `61 24 d0 c0` -> index block checksum
- `42 45 41 43 48 53 53 54` -> ASCII `BEACHSST`
- `00 00 00 01` -> version 1
- `00 00 00 00 00 00 00 6c` -> index offset = `108`
- `00 00 00 23` -> index size = `35`
- `00 00 00 01` -> data block count = `1`
- `00 00 00 00 00 00 00 04` -> entry count = `4`
- `c7 ea 8f 42` -> footer checksum

This is also why I chose big-endian for the binary formats. It is just nicer in a hex dump.

There is something deeply satisfying about being able to point at `BEACHSST` in raw bytes and say: yes, that is the file magic, yes, that offset is the index block, yes, the numbers line up with the dump tool, and no, I am not relying on optimism as a parsing strategy.

## `sst_dump` is not optional tooling

A storage format does not feel real until you can inspect it from outside the database.

RocksDB[^4] ships `sst_dump` and `ldb`. LevelDB[^3] ships `leveldbutil`. Those tools exist for a reason. For BeachDB, I built a simple `sst_dump` tool that takes an SSTable path and prints what the file actually contains: [beachdb/cmd/sst_dump](https://github.com/aalhour/beachdb/tree/main/cmd/sst_dump).

When something goes wrong in a storage engine, "the API says X" is usually not enough. You want to know:

- did the file get created?
- how many entries are in it?
- where does the index start?
- what is the last key per block?
- did the checksum fail?

The tool is the shortest path from "this test failed in a confusing way" to "here is what the file actually contains."

That is also philosophically on-brand for BeachDB. The point is not just to produce code that passes tests. It is to produce artifacts I can inspect, explain, and reason about from the outside.

## Testing, or how I convinced myself this isn't lying

I ended up convincing myself in three layers.

**First:** package-level tests around the SSTable writer, reader, and iterator. Can one file be written, reopened, iterated, and rejected when blocks, index entries, or the footer are corrupt?

**Second:** engine-level tests around the actual milestone behavior. Does a full memtable flush into a real SSTable? Does reopen find that file again? Do newer tables shadow older ones correctly? Do tombstones survive the trip to disk? Does `Close()` wait for the background flush to finish instead of quietly sawing off the branch it is sitting on?

**Third:** outside-the-engine inspection. `sst_dump` and the hex dump above are not replacements for tests, but they are a very good way to cross-check that the bytes on disk agree with the code and the mental model.

There are benchmarks and allocation guards around the hot paths too, but the bigger point is simpler: this is still a toy project, not a toy testing posture.

---

## If you want to go deeper

I recommend watching John Schulz's _"What is in All of Those SSTable Files"_ tech talk about Apache Cassandra's SSTable internals. It's always good to see how a battle-tested system looks on the inside:

{% include embed/youtube.html id='5z-EMVjf_Qg' %}

---

## Where do we go from here?

The next milestone is **Manifest**.

Right now BeachDB discovers `*.sst` files at startup by scanning the directory. That is honest, simple, and temporary. A manifest is the piece that turns "these files happen to exist" into "these files are the durable database view."

That matters for three reasons:

- it records which SSTables actually belong to the current version of the DB
- it lets WAL lifecycle stop being guesswork around successful flushes
- it becomes the metadata spine that later compaction work can stand on

After that, the next steps get much clearer: merge iteration across memtables and SSTables, then compaction. Bloom filters and caching can wait until there is enough disk state to make them worth the complexity.

BeachDB can now create immutable sorted files, read through them, and open them from the outside. That is enough surface area for one release and, frankly, enough opportunities to embarrass myself with a bug in public.

Until then, I'm happy with this milestone for a very simple reason: BeachDB writes real database files now, and I can open them.

Until we meet again.

Adios! ✌🏼

---

## Notes & references

[^1]: Bigtable is where the term "SSTable" comes from: [Bigtable: A Distributed Storage System for Structured Data](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/).
[^2]: For the wider storage-engine mental model, see Martin Kleppmann's book [_Designing Data-Intensive Applications_](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/), his map of the distributed/data systems landscape: [How to navigate the world of distributed data systems](https://martin.kleppmann.com/2017/03/15/map-distributed-data-systems.html), and his talk [Using logs to build a solid data infrastructure](https://martin.kleppmann.com/2015/06/05/logs-for-data-infrastructure-at-gds.html).
[^3]: LevelDB references that were especially useful here: [table file format](https://github.com/google/leveldb/blob/main/doc/table_format.md), [implementation overview](https://github.com/google/leveldb/blob/main/doc/impl.md), and [`db/db_impl.cc`](https://github.com/google/leveldb/blob/main/db/db_impl.cc).
[^4]: RocksDB references: [A Tutorial of RocksDB SST formats](https://github.com/facebook/rocksdb/wiki/A-Tutorial-of-RocksDB-SST-formats), [BlockBasedTable format](https://github.com/facebook/rocksdb/wiki/rocksdb-blockbasedtable-format), and [`db/db_impl/db_impl_write.cc`](https://github.com/facebook/rocksdb/blob/main/db/db_impl/db_impl_write.cc).
[^5]: Pebble references: [`db.go`](https://github.com/cockroachdb/pebble/blob/master/db.go) and [`compaction.go`](https://github.com/cockroachdb/pebble/blob/master/compaction.go).
[^6]: BadgerDB references: [`db.go`](https://github.com/dgraph-io/badger/blob/main/db.go) and [`memtable.go`](https://github.com/dgraph-io/badger/blob/main/memtable.go).
[^7]: HBase/HFile references: [HFile API docs](https://hbase.apache.org/devapidocs/org/apache/hadoop/hbase/io/hfile/HFile.html), [HFileScanner API docs](https://hbase.apache.org/2.4/devapidocs/org/apache/hadoop/hbase/io/hfile/HFileScanner.html), and [HBase Book: StoreFile / HFile](https://hbase.apache.org/book.html#hfile).
[^8]: Cassandra reference: [Apache Cassandra docs, “Storage Engine”](https://cassandra.apache.org/doc/latest/cassandra/architecture/storage-engine.html).

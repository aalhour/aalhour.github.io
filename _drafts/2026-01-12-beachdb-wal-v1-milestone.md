---
title: "Durability is a promise you can't hand-wave: WAL v1"
date: 2026-02-08
categories: [Programming]
tags: [beachdb, databases, storage, durability, wal]
toc: true
track: https://soundcloud.com/silent-planet/trilogy?in=exixts/sets/3-ovens
---

## Milestone 1: Complete

In my [last post]({% post_url 2026-01-07-building-beachdb %}), I introduced BeachDB: a toy database I'm building from scratch in Go to learn storage internals, durability, and eventually distributed consensus. I showed an interactive LSM-Tree visualization and talked about the architecture.

Now it's time to show real code.

[BeachDB v0.0.1](https://github.com/aalhour/beachdb/releases/tag/v0.0.1) is the first tagged release, and it ships the Write-Ahead Log (WAL). The WAL is the durability spine of the database. Every write lands here before it's acknowledged. If the process crashes and restarts, the WAL is how we recover state.

This post walks through what I built, why I made certain design decisions, and how I tested it. If you've ever wondered what it takes to make a database that doesn't lie about your data, this is the answer.

---

## The Durability Contract

Before writing any code, I needed to define what durability means for BeachDB. Here's the contract:

- **Commit = fsync**: A write is committed only after `fsync` returns.
- **Acknowledged = durable**: If `db.Put()` or `db.Write()` returns success, the data survives restart.
- **Crash before fsync**: The write is lost, but the caller never saw success.

This is the rule that matters. If the database says "OK, I saved your data," then that data must survive power loss, SIGKILL, kernel panics — anything short of physical disk destruction.

> The mental model: if you didn't get a success response, assume it didn't happen. If you did get a success response, the data is safe.
{: .prompt-tip }

---

## WAL Record Format

A WAL file is a sequence of records. Each record wraps one encoded `Batch` (a group of Put and Delete operations that are applied atomically).

Here's the layout:

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

Let me walk through the fields:

| Field | Purpose |
|-------|---------|
| `magic` | Identifies this as a BeachDB WAL record. If `wal_dump` opens a JPEG by accident, it fails immediately with "bad magic" instead of interpreting pixel data as batches. |
| `version` | Format version. Allows future changes without silent misinterpretation. |
| `type` | Record type. v1 only uses `Full` (complete record). Reserved for future fragmentation. |
| `length` | Payload size. Tells the reader exactly how many bytes to read after the header. |
| `checksum` | CRC32C[^1] of the payload bytes. This catches silent bit flips and torn writes. |
| `payload` | The encoded `Batch` containing the actual Put/Delete operations. |

---

## Design Decisions

When building the WAL, I had to make several choices. Here's my reasoning.

### Why checksum in the header, not a trailer?

I put the checksum in the header (before the payload) rather than as a trailing field. This means the reader can:

1. Read 12 bytes (fixed header size).
2. Know the payload length and expected checksum before reading the payload.
3. Validate immediately after reading, without backtracking.

If the checksum were a trailer, I'd have to read the entire payload before I could validate it. With the checksum upfront, I can fail fast on corruption without wasting I/O on garbage bytes.

The tradeoff is that the writer must compute the checksum before writing the header, which means buffering the payload in memory first. For BeachDB's workload (small batches, fsync per batch), this is fine.

### Why CRC32C specifically?

CRC32C (Castagnoli) over plain CRC32 because:

1. **Hardware acceleration.** Modern CPUs have native CRC32C instructions. Go's `hash/crc32` uses them automatically.
2. **Better error detection.** CRC32C has better hamming distance properties for certain error patterns.
3. **Industry standard.** Used by RocksDB, LevelDB, Spanner, and others.

### Why big-endian byte order?

I chose big-endian (network byte order) for all multi-byte integers because hex dumps are readable. `0x00 0x00 0x00 0x2A` clearly reads as 42. Little-endian would be `0x2A 0x00 0x00 0x00`, which is harder to scan visually.

Most binary file formats and network protocols use big-endian. It's what people expect when inspecting with `hexdump`.

---

## Crash Recovery

On startup, BeachDB replays the WAL to reconstruct state:

1. Open the WAL file for reading.
2. Read records sequentially until EOF or error.
3. For each valid record: decode the batch, apply to in-memory state.
4. Open the WAL file for append (new writes go at the end).

### Handling Truncation

A truncated record at the end of the WAL means the process crashed mid-write:

- **Truncated header** (< 12 bytes): Ignore, treat as EOF.
- **Truncated payload** (header valid, payload incomplete): Ignore, treat as EOF.

The incomplete record was never `fsync`'d, so the batch was never acknowledged to the caller. Discarding it is correct.

### Handling Corruption

- **Bad magic**: Stop. Either file isn't a WAL, or we've hit garbage.
- **Checksum mismatch**: Stop. Data is corrupted. Fail loudly.
- **Unsupported version**: Stop. We don't understand this format.

v1 does not attempt repair. Corruption is surfaced, not hidden.

> This is a deliberate choice. I'd rather the database fail loudly than silently eat your data. You can always debug a failure. Silent data corruption is a nightmare.
{: .prompt-info }

---

## Testing: Crash Loops and SIGKILL

A durability promise is worthless if you can't prove it. I wrote two kinds of tests.

### In-process Crash Tests

These tests simulate crashes by truncating or corrupting the WAL file, then reopening the database:

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

### Out-of-process SIGKILL Tests

The real durability test is SIGKILL. The `crash` utility spawns a writer subprocess that continuously writes data, then kills it with `SIGKILL` at random intervals:

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

---

## The `wal_dump` Tool

Every chapter ends with evidence. For the WAL, that evidence is `wal_dump`: a tool that decodes and prints WAL records.

```bash
$ wal_dump /tmp/beachdb/beachdb.wal
Record 0: 47 bytes, checksum OK
Record 1: 23 bytes, checksum OK
Record 2: 31 bytes, checksum OK
End of WAL (3 records)
```

On corruption:

```bash
$ wal_dump /tmp/beachdb/beachdb.wal
Record 0: 47 bytes, checksum OK
Record 1: checksum mismatch (expected 0xABCD1234, got 0xDEADBEEF)
Stopped at record 1
```

This tool has been invaluable for debugging. When something goes wrong, I can see exactly what's in the WAL file.

---

## Runnable Examples

The release includes four runnable examples in the `examples/` directory:

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

These are part of the test suite (`make examples`) and serve as documentation.

---

## What's Next

The WAL is done. The database can now:

- Write batches of Put and Delete operations atomically
- Survive crashes and recover state
- Detect corruption and truncation
- Be inspected with `wal_dump`

Next up: the **Memtable**. Right now, BeachDB uses a plain `map[string][]byte` for in-memory state. That's fine for proving the WAL works, but it's not sorted, doesn't support range scans, and doesn't handle tombstones properly for compaction.

The memtable will be a sorted structure (probably a skip list) that maintains insertion order for iteration and tracks tombstones for later deletion during compaction.

After that: SSTables, flush, merge iterators, and the rest of the LSM tree.

Until we meet again.

Adios! ✌🏼

---

## Notes & References

[^1]: CRC32C (Castagnoli) is a variant of CRC32 that uses a different polynomial (0x1EDC6F41) with better error detection properties. Modern CPUs have hardware instructions for CRC32C (Intel SSE 4.2, ARM CRC). Go's `hash/crc32` package automatically uses these when available. See: [CRC32C in Go](https://pkg.go.dev/hash/crc32).

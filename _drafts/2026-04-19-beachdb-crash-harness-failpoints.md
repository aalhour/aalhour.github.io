---
title: "Crash testing BeachDB, Part 1: from random kills to exact boundaries"
date: 2026-04-19
categories: [Programming]
tags: [beachdb, databases, storage, durability, testing]
toc: true
mermaid: true
track:
---

> **TL;DR**: BeachDB v0.0.4 ships a controller/worker crash harness, an internal failpoint framework, and seven failpoints across the WAL and flush paths. This is the milestone where crash testing stops being random `SIGKILL`s and starts targeting exact engine boundaries with deterministic replay. [Code is here](https://github.com/aalhour/beachdb).
{: .prompt-info }

_This is part of an ongoing series — see all posts tagged [#beachdb](/tags/beachdb/)._

---

## A blunt instrument

BeachDB has had crash testing since [v0.0.1]({% post_url 2026-02-12-beachdb-wal-v1-milestone %}). The original setup was simple: spawn a writer subprocess that writes keys in a loop, wait a random number of milliseconds, `kill -9` the process, reopen the database, check what survived.

If you're curious, the original `v0.0.1` crash harness lives under [`beachdb/tree/v0.0.1/cmd/crash`](https://github.com/aalhour/beachdb/tree/v0.0.1/cmd/crash).

That was good enough for the first question I cared about: does the WAL actually work, or am I just telling myself a nice story about durability? It caught real bugs. It gave me confidence that acknowledged writes survive process death.

But it was still a blunt instrument. It could tell me that something survived. It could not tell me why. And it definitely could not tell me at which internal boundary the process died.

At a high level, the old setup looked like this:

```mermaid
sequenceDiagram
  autonumber
  participant O as Orchestrator
  participant W as Writer subprocess
  participant DB as BeachDB
  participant S as Scratch file

  O->>W: Spawn writer
  loop Until kill lands
    W->>DB: Put/Delete in a loop
    DB-->>W: Success
    W->>S: Append committed key(s)
  end
  O->>O: Sleep random duration
  O->>W: SIGKILL
  O->>DB: Reopen database
  O->>S: Read claimed committed keys
  O->>O: Compare survivors vs scratch file
```

Not useless. Just fuzzy in exactly the places I now cared about.

## One exact boundary I wanted to test

At some point I stopped wanting "more random kills" and started wanting one very specific answer.

Suppose a `Put()` crosses the WAL `fsync` boundary, and then the worker dies before the normal write path finishes.

What should happen on reopen?

For that boundary, the answer should be: the write comes back.

If the WAL append happened, the `fsync` returned, and the process dies before it gets to finish the rest of the path, recovery should replay that WAL record and rebuild the state. That is the whole point of the log in the first place.

> Scope note: this harness models **process death in a surviving kernel**. That distinction matters. This is not a power-loss / kernel-panic / "the machine fell into the sea" test harness. In a process-crash test, bytes that reached the kernel page cache may still hit disk later even if they were not `fsync`'d yet.
{: .prompt-warning }

That may sound obvious written out like this, but the old crash loop could only exercise that boundary accidentally. It could kill the worker _around_ the `fsync`. It could not tell me, with a straight face, that the kill landed _after_ the `fsync` and _before_ the rest of the write path.

That was the itch.

## Why wall-clock kills were not enough

Once I looked at the problem through that one boundary, the limitations of the old harness became painfully obvious.

Random wall-clock `SIGKILL`s are realistic, but they are also sloppy. They tell you that the worker died sometime during the write path. They do not tell you whether it died before the WAL append, after the WAL append, after the WAL `fsync`, or while the flush path was halfway through building an SSTable.

The old setup also had three practical problems I kept tripping over:

- **Non-deterministic timing.** "It failed once at cycle 37" is not a debugging strategy.
- **Coarse verification.** The orchestrator only knew which keys the writer _claimed_ it committed through a scratch file with newline-delimited keys. There was no clean notion of "acked vs. in-flight" at the operation boundary.
- **No internal visibility.** I could kill from the outside, but I could not target "right after WAL sync" or "force SSTable publish to fail."

So the new harness had to buy me four things:

1. A deterministic workload I can replay exactly.
2. A protocol that tells me, for each operation, whether the worker started it, acked it, or failed it.
3. The ability to crash or inject faults at named internal engine boundaries.
4. An artifact from each run that I can inspect, replay, and diff.

## The contract the harness now enforces

The worker emits four lifecycle events:

- `ready` - database is open
- `start` - about to execute the operation
- `ack` - the operation succeeded and the DB call returned `nil`
- `fail` - the operation returned an error

From those events, the controller enforces a conservative harness-wide contract:

- **Acked operations** must be reflected after recovery.
- **The single started-but-not-acked operation** is indeterminate by default. It may be present or absent after reopen.
- **Never-started operations** are irrelevant to that crash cycle.

That "single ambiguous operation" rule is the big upgrade over the old harness. The commit frontier is no longer fuzzy.

There is one important nuance, though: this is the harness's default contract, not the strongest claim we can make at every failpoint.

Some boundaries imply stronger expectations. `wal_after_sync` is one of those: once the WAL `fsync` boundary is crossed, I expect recovery to bring the write back. `wal_after_append` is different. In a process-crash test, the append reached the kernel, but not the durable boundary, so the write must **not** be treated as acknowledged durable, and after reopen it may or may not be present. That is one of those annoying little details that becomes much less annoying once it saves you from lying in a blog post.

In the engine, that write-path boundary looks like this:

```go
// Append the changes to the WAL file via wal.Writer
if err := db.wal.Append(encoded); err != nil {
    return fmt.Errorf("beachdb: appending to WAL: %w", err)
}

// FAILPOINT: wal_after_append
crashhook.CrashIfArmed(crashhook.PointWALAfterAppend)

// Try to sync the WAL to disk if the option is set
if err := db.syncWALLocked(); err != nil {
    return err
}

// Apply the Batch operations to Memtable
db.applyOperations(ops)
```

And inside `syncWALLocked()`:

```go
// FAILPOINT: wal_sync_error
if err := crashhook.MaybeFault(crashhook.FaultWALSyncError); err != nil {
    return fmt.Errorf("beachdb: syncing WAL: %w", err)
}

if err := db.wal.Sync(); err != nil {
    return fmt.Errorf("beachdb: syncing WAL: %w", err)
}

// FAILPOINT: wal_after_sync
crashhook.CrashIfArmed(crashhook.PointWALAfterSync)
```

That is basically the whole story in code form: append, optional crash, sync, optional crash, then move on with the write path.

## Controller/worker design

The new harness splits cleanly into two processes with boring, explicit jobs.

```mermaid
sequenceDiagram
  autonumber
  participant C as Controller
  participant W as Worker (subprocess)
  participant DB as BeachDB

  C->>C: Generate deterministic workload from seed
  C->>W: Spawn subprocess (optional failpoint env)
  W->>DB: Open database
  W-->>C: ready
  loop For each operation
    C->>W: {op: put, key: ..., value: ...}
    W-->>C: start
    W->>DB: db.Put(key, value)
    W-->>C: ack (or fail)
  end
  C->>W: SIGKILL after planned delay
  C->>DB: Reopen database
  C->>C: Verify recovered state against oracle
```

The **controller** owns the workload, the crash/fault schedule, the oracle, and the artifact written at the end of the run. It does not participate in the write path itself. It only touches BeachDB directly when it reopens the database after a kill or an injected failure.

The **worker** is intentionally thin: receive one operation at a time on stdin, call the BeachDB API, emit lifecycle events on stdout. The protocol between them is NDJSON with base64-encoded keys and values, so binary payloads survive the round trip without text-parser nonsense.

And yes, the harness is deliberately slow.

The old writer generated its own keys in a loop, which meant the controller had no precise idea which operation was in flight when the kill landed. The new one does one operation at a time on purpose: one op, one `start`, one `ack`/`fail`, then move on. Throughput goes down. Signal goes up. For a crash harness, that trade is not exactly heartbreaking.

## Replayable artifacts

Every run starts with a seed. That seed determines the workload: which keys, which values, which operations, in what order. The crash schedule is derived from it too.

That means a failing run is not "well... something weird happened once." It is a replayable artifact.

```bash
./bin/crash replay \
  --artifact=/tmp/beachdb-crash-artifacts/crash-20260419T213015.123Z.json \
  --dbdir=/tmp/beachdb-crash-replay-db
```

The artifact captures the things I actually care about:

- the run configuration and seed
- the generated workload
- the ordered stream of worker events
- per-cycle metadata and verification results
- the last acknowledged op ID
- the first failure, if there was one

One cycle's evidence in the artifact looks more like this:

```json
{
  "seed": 42,
  "last_acked_op_id": 16,
  "events": [
    {
      "cycle": 0,
      "time_unix_ms": 1745091015123,
      "event": {"kind": "ready"}
    },
    {
      "cycle": 0,
      "time_unix_ms": 1745091015128,
      "event": {"kind": "start", "op_id": 17}
    }
  ],
  "cycles": [
    {
      "index": 0,
      "worker_pid": 91324,
      "planned_kill_delay_ms": 250,
      "exit_code": 86,
      "last_event": {"kind": "start", "op_id": 17},
      "verification": {"checked_keys": 23, "allowed_optional_ops": [17]},
      "crash_point": "wal_after_sync"
    }
  ]
}
```

That is still trimmed for readability, but those are the real fields: worker events in one stream, cycle-level metadata in another, and enough information to replay the run and reason about the last in-flight operation.

This would have saved me hours during the SSTable milestone. Instead of "it failed once and now I can't make it fail again," I get a file I can hand to someone else and say: here, run this.

## Failpoints and hook sites

The controller/worker split solves the "what was in flight?" problem. It does **not** solve the "crash exactly here" problem.

An external `SIGKILL` is still subject to scheduler timing. Useful, realistic, but imprecise.

That is what the failpoint framework is for.

The general pattern is old and battle-tested:

1. put named hooks in production code paths
2. leave them dormant by default
3. arm them from tests
4. when triggered, either crash the process or return a synthetic error

BeachDB's version lives in `internal/crashhook` and exposes two primitives:

- `CrashIfArmed(point)` - if the named point is armed, call `os.Exit(86)` immediately
- `MaybeFault(point)` - if the named point is armed, return a synthetic error

Both are activated by environment variables passed from the controller to the worker subprocess. In normal operation they are inert.

The implementation is intentionally tiny:

```go
const (
    EnvCrashPoint = "BEACHDB_CRASH_POINT"
    EnvFaultPoint = "BEACHDB_FAULT_POINT"
    CrashExitCode = 86
)

func CrashIfArmed(point string) {
    if point == "" || os.Getenv(EnvCrashPoint) != point {
        return
    }
    if !crashConsumed.CompareAndSwap(false, true) {
        return
    }
    exitFunc(CrashExitCode)
}

func MaybeFault(point string) error {
    if point == "" || os.Getenv(EnvFaultPoint) != point {
        return nil
    }
    if !faultConsumed.CompareAndSwap(false, true) {
        return nil
    }

    switch point {
    case FaultWALSyncError:
        return ErrInjectedWALSync
    case FaultSSTPublishError:
        return ErrInjectedSSTPublish
    case FaultSSTWriteError:
        return ErrInjectedSSTWrite
    default:
        return nil
    }
}
```

I like this shape a lot because it keeps the framework boring on purpose: environment variables arm the point, atomics make it one-shot per process, and the engine code gets tiny, readable hook sites.

There are seven hook sites in the engine right now, and every one is marked with a `// FAILPOINT:` comment so I can find them all with one grep:

```bash
$ grep -rn "// FAILPOINT:" engine/
engine/db.go:191:  // FAILPOINT: wal_after_append
engine/db.go:411:  // FAILPOINT: wal_sync_error
engine/db.go:420:  // FAILPOINT: wal_after_sync
engine/db.go:647:  // FAILPOINT: sst_publish_error
engine/db.go:656:  // FAILPOINT: flush_after_publish
engine/db.go:671:  // FAILPOINT: sst_write_error
engine/db.go:719:  // FAILPOINT: flush_after_file_sync
```

They fall into two buckets.

**Crash points** simulate process death:

- `wal_after_append` - crash after the WAL append succeeds, but before `fsync`
- `wal_after_sync` - crash after the WAL `fsync` boundary
- `flush_after_file_sync` - crash after the SSTable file and parent directory are durable on disk
- `flush_after_publish` - crash after the SSTable is published into the engine's in-memory state

**Fault points** inject errors and let the process keep unwinding normally:

- `wal_sync_error` - force WAL sync to fail
- `sst_write_error` - force SSTable write to fail before touching the filesystem
- `sst_publish_error` - force the publish step to fail after the SSTable file already exists on disk

That distinction matters.

`wal_after_sync` is a crash point. The process dies at a very specific durable boundary, and on reopen I expect WAL replay to recover the write.

`sst_publish_error` is **not** a crash point. It is a synthetic error path. The interesting question there is: if the SSTable file is already durable on disk but publish fails, does reopen still recover correctly by rediscovering that file from the directory? Different failure class, different invariant.

`wal_after_append` is the sneaky one. The process dies after the append reached the kernel but before the durable boundary. In this harness, that operation is not acknowledged as durable, and after reopen it may or may not be present. That is not a contradiction. That is the process-crash model doing what it does.

The flush path has the same shape:

```go
func (db *DB) publishFlushedSSTLocked(sstReader *sstable.Reader) error {
    // FAILPOINT: sst_publish_error
    if err := crashhook.MaybeFault(crashhook.FaultSSTPublishError); err != nil {
        return fmt.Errorf("beachdb: publishing SSTable: %w", err)
    }

    db.ssts = append(db.ssts, sstReader)
    db.immMem = nil
    db.nextSSTID++

    // FAILPOINT: flush_after_publish
    crashhook.CrashIfArmed(crashhook.PointFlushAfterPublish)

    return nil
}
```

And during file creation itself:

```go
// FAILPOINT: sst_write_error
if err := crashhook.MaybeFault(crashhook.FaultSSTWriteError); err != nil {
    return nil, fmt.Errorf("beachdb: writing SSTable: %w", err)
}

// Sync parent directory so the new file's directory entry is durable
if err = syncDir(filepath.Dir(path)); err != nil {
    return nil, fmt.Errorf("beachdb: syncing directory after flush: %w", err)
}

// FAILPOINT: flush_after_file_sync
crashhook.CrashIfArmed(crashhook.PointFlushAfterFileSync)
```

That tiny footprint is one of my favorite parts of the whole thing. One comment, one call, and suddenly the engine has named edges I can attack on purpose.

## Oracle and invariants

The last piece is the oracle that runs after every crash/reopen cycle.

This is **not** just a bag of "acked keys." That would be too naive once the workload starts overwriting keys or deleting them.

Instead, the oracle builds the final expected visible state from the ordered stream of acked operations:

- later `Put`s overwrite earlier visible values for the same key
- `Delete`s turn that key into a tombstone / not-found state
- batch operations expand into their nested `Put` / `Delete` items and are applied in order too
- the expected answer is the final visible state after applying the acked prefix in order

After reopening the database, the controller reads the relevant keys back and checks:

1. the visible state derived from acked operations matches what the database returns
2. the single started-but-not-acked operation is allowed to be present or absent unless the targeted failpoint implies a stronger expectation
3. keys that were never started do not magically appear with values they were never given

That is basically reference-model testing stretched across a process boundary. BeachDB already uses the same idea in `internal/testutil.Model` for unit tests. Here I am just applying it to crash cycles instead of in-process data structures.

## Running it

A short smoke run:

```bash
make crash-check
```

A longer local run:

```bash
./bin/crash run \
  --dbdir=/tmp/beachdb-crash-db \
  --artifact-dir=/tmp/beachdb-crash-artifacts \
  --cycles=500 \
  --seed=42 \
  --ops=1000
```

And replaying a failure:

```bash
./bin/crash replay \
  --artifact=/tmp/beachdb-crash-artifacts/crash-20260419T213015.123Z.json \
  --dbdir=/tmp/beachdb-crash-replay-db
```

## What changed in my confidence

The biggest lesson was not about crash testing specifically. It was about the gap between "tests pass" and "I trust this."

The old harness gave me green tests and a general sense that the durability story was probably fine. The new one lets me make boundary-specific claims and verify them with deterministic evidence.

That is a different kind of confidence.

Once I could say "crash here, at this exact internal edge" or "inject this exact fault after the file is already durable," the whole discussion got sharper. The durability story stopped being "I wrote a lot of tests and they pass" and started being "I can tell you what happens at this boundary, why it happens, and which artifact proves it."

That is the kind of evidence I want from a storage engine, even a toy one.

## What's next

The next milestone is **Manifest**.

Right now BeachDB discovers `*.sst` files at startup by scanning the directory. That is simple, honest, and temporary. A manifest records which SSTables belong to the current durable database view, gives WAL lifecycle a clean reference point, and becomes the metadata spine that compaction needs.

After that: merge iteration, compaction, and eventually the parts of the engine that turn "a bunch of sorted files" into "a coherent version history."

Until we meet again.

Adios! ✌🏼

---

## Notes & references

[^1]: BeachDB crash harness implementation: [`cmd/crash/`](https://github.com/aalhour/beachdb/tree/main/cmd/crash)
[^2]: BeachDB failpoint framework: [`internal/crashhook/crashhook.go`](https://github.com/aalhour/beachdb/blob/main/internal/crashhook/crashhook.go)
[^3]: TiKV's fail-rs crate, the Rust failpoint library: [github.com/tikv/fail-rs](https://github.com/tikv/fail-rs)
[^4]: etcd's gofail, the Go failpoint library that inspired BeachDB's approach: [github.com/etcd-io/gofail](https://github.com/etcd-io/gofail)
[^5]: TiDB's failpoint package for Go: [github.com/pingcap/failpoint](https://github.com/pingcap/failpoint)
[^6]: FreeBSD's failpoint framework, the original: [FreeBSD fail(9) man page](https://man.freebsd.org/cgi/man.cgi?query=fail&sektion=9)

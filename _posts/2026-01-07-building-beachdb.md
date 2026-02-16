---
title: "Building BeachDB: A Database from Scratch (in Go)"
date: 2026-01-07
categories: [Programming]
tags: [beachdb, databases, storage, lsm-tree]
toc: true
track: https://soundcloud.com/silent-planet/antimatter?in=exixts/sets/3-ovens
---

## A new rabbit hole

In my last blog post ["On Watershed Moments: Boredom, Growth, and Curiosity"]({% post_url 2025-12-21-on-watershed-moments %}), I reflected on moments in my career when I hit a repeating pattern: productivity, then stability, then boredom. These moments led me to get out of my comfort zone, change roles, shed responsibilities and dig into new domains.

One of the most rewarding things I've been doing lately is working on technical products: systems and tools that help other engineers do their work.

At HubSpot, that's building and operating the Apache HBase distributed database at massive scale (HubSpot's Data Infrastructure team).

Before all of this, I was on the other side of the table: using databases and observability tools to ship features to end users.

## Stateless vs. Stateful Systems

Working on the internals of database systems is a rewarding experience. Especially for software engineers who constantly work on web products.

In a way, our jobs teach us to design services in stateless terms. Or rather, they nudge us in that direction. We offload state to the database or storage system. A stateless API is in most (all?) cases, easier to scale horizontally than a stateful one. State complicates things.

What makes studying these systems rewarding is that you get to see the turtles, and it's turtles all the way down.

## Project BeachDB

[BeachDB](https://github.com/aalhour/beachdb) is the name of the database I’ll be building in Go to learn more about storage, database architecture, and the parts of distributed systems I’ve mostly only met in books (so far).

BeachDB is a toy, educational project. I’m building a small, inspectable LSM-based[^4] storage engine in Go.

Then I will deliberately grow it into a server and a Raft-replicated distributed NoSQL system with progress proven through concrete artifacts like dump tools, crash tests, benchmarks, and clear semantics rather than feature breadth or optimization theater.

Cassandra and HBase are distributed database systems too, but they’re not Raft[^1]-based. HBase is multi-writer per table (single-writer per region) and relies on HDFS replication within the same cluster[^2]. Cassandra has a host of other replication strategies[^3].

To make sure I keep this project from exploding beyond what's humanely possible to build for the sake of learning new things, I set the following goals and non-goals for the project.

You can follow the project on GitHub: [github.com/aalhour/beachdb](https://github.com/aalhour/beachdb). It’s still pretty empty for now (mostly plans in markdown), but I’ll be filling it in, and writing about it here, one milestone at a time.

### Goals

- Learn and document the fundamentals by building them end to end, in public.
- Make correctness and durability first-class (WAL[^5], recovery, explicit invariants).
- Keep the system small, understandable, and easy to inspect with tooling.
- Define crisp semantics for writes, deletes, snapshots, and iteration before tuning.
- Layer the system intentionally: engine first, then server API, then Raft[^1] replication.
- Use a small set of fixed workloads to guide measurement and explain tradeoffs.

### Non-goals (by design)

- Production readiness, multi-year maintenance guarantees, or compatibility promises.
- Multi-writer concurrency in the engine early on (single-writer initially).
- Background compaction early on (only after invariants are rock-solid).
- SQL, query planning, joins, or secondary indexes.
- Full transactions or serializable isolation.
- Auto sharding, region split/merge, rebalancing, quorum reads, gossip/repair.

## The Architecture: A 10,000 ft. view

The architecture of BeachDB follows three layers intentionally designed to make building for the sake of learning as easy as possible:

1. An LSM-Trees[^4] storage engine inspired by [Facebook's RocksDB](https://rocksdb.org/).
2. A single-node server that embeds the storage engine and exposes an API protocol for clients.
3. A distributed cluster of many nodes that replicate state over the Raft[^1] protocol.

Given that we don't have a storage engine yet, it's appropriate to start there and park the other two layers of the onion until it's time to peel them.

> ### What is BeachDB *for*?
>
> **(Added on Feb 16th, 2026)**
> 
> Today a friend asked me what BeachDB is *for*. Is it tailored for bioinformatics? finance? some specific domain?
> 
> The honest answer is: **no**. BeachDB isn’t a domain database (at least not by design). It’s me trying to build the *core* pieces of a database system end-to-end, in public, and learn the parts we usually outsource to “the database.”
> 
> That said, the *shape* of BeachDB is a pretty standard one, and it points at real use cases:
> 
> - **As a storage engine (embedded library)**: a durable key-value store you can embed in a Go program (the “RocksDB-in-your-app” shape). Think “I need persistence and crash recovery, but I don’t want a separate database process yet.”
> - **As a single-node server**: the same engine behind an API so multiple clients can read/write over the network (Redis-ish ergonomics, but with an LSM engine underneath).
> - **As a cluster**: multiple nodes replicating state via Raft[^1] so the system can survive machine failures without lying about committed writes (closer to an etcd-style replication story, but serving application KV reads/writes).
> 
> So the use cases are mostly “anything that fits a key-value model”:
> 
> - **Metadata / state storage**: sessions, feature flags, rate-limit counters, “last seen” pointers, presence, small blobs, background job state. (Redis gets used for a lot of this in the real world.)
> - **A chat app backend (some parts of it)**: not “store all messages forever” (that wants indexing/range scans), but the *stateful bits* like inbox pointers, room membership, per-user settings, and delivery/read receipts fit the KV shape nicely.
> - **Ingestion pipelines**: checkpoints, offsets, and “what did I process last?” state (the kind of glue code that *really* wants to survive restarts).
> - **Append-heavy workloads**: audit logs, event-ish data, write-heavy streams where sequential writes + durability matter.
> - **Time-ish data**: storing things in time buckets (per user/device/service) becomes much nicer once I add iteration/range scans and lock down compaction semantics.
> - **Domain-wise (bio/finance/etc.)**: not tailored to any vertical, but the same pattern shows up everywhere — pipeline metadata in bioinformatics, order/workflow state in finance, carts/sessions in e-commerce, and so on.
> 
> If you can model your problem as “key → bytes,” you can usually make it fit.
> 
> And the non-use-cases are just as important:
> 
> - It’s not meant to be production-ready (yet), not tuned for any specific vertical, and not competing with PostgreSQL, RocksDB, or the real grown-ups. It’s a learning project with receipts.
{: .prompt-warning }

Well, what is a storage engine? How does it ensure that data is stored? Assuming that it promises durability (BeachDB does!), how can it recover from crashes? If I `kill -9` the database process, how does it guarantee NOT losing data?

I could write a long essay to answer all of this but let me show you a simulation instead.

### A demo is worth 10k pages

The following is an interactive visualization that demonstrates how LSM-Tree[^4] databases handle writes, reads, deletes and compaction. Try adding some key-value pairs with the `PUT` API, run some `GET` and `DELETE` operations on them or click **▶ Play** on the Demo to see it in action! Play the demo a few times to see compactions happen.

{% include animations/lsm-tree.html %}

> This is a simplified visualization for educational purposes. Real LSM-Tree implementations (RocksDB, Cassandra, HBase) include additional optimizations like bloom filters, block-based SST storage, background compaction threads, write stalls, and sophisticated compaction strategies (leveled, size-tiered, FIFO).
{: .prompt-info }

### How It Works

The visualization shows a generic LSM-Tree[^4] storage architecture with two planes:

- **Memory Plane**, which contains:
  - **Memtable**: An in-memory sorted map that receives writes.
- **Disk Plane**, which contains:
  - **WAL**[^5]: Append-only log for durability. Writes go here in parallel with the memtable.
  - **L0, L1, L2**: SST[^6] (Sorted String Table) files organized by level.

#### Operations

Before the bullets, here's the mental model I keep in my head: **writes are cheap and sequential**, reads are **a scavenger hunt across a few places**, and compaction is the janitor that stops the whole thing from becoming a landfill.

1. **Put**: Writes go to both the Memtable (memory) **and** WAL[^5] (disk) for durability.
   - The Memtable gives you a fast sorted view for reads.
   - The WAL is your "I swear I saw this write" receipt when the process crashes at the worst possible time.
2. **Flush**: When the Memtable fills up (4 entries[^7]), it's flushed to disk as an SST[^6] file in L0.
   - Flushing turns volatile memory into an immutable, sorted file.
   - Now the Memtable can be reset and keep taking writes, while the disk holds the history.
3. **Get**: Reads check Memtable first, then SST[^6] files from newest (L0) to oldest (L2).
   - "Newest wins" is the big rule here. If the same key exists in multiple places, the freshest version is the truth.
   - Real systems add bloom filters and indexing to avoid touching every file (the demo keeps it simple on purpose).
4. **Delete**: Deletes don't remove data immediately; they write a **TOMBSTONE** record.
   - Tombstones are basically "this key is gone as of sequence X".
   - The actual space reclaim happens later, during compaction, when older values get merged away.
5. **Compact**: When there are 2+ files in L0, they can be merged into L1 (deduplicating keys and removing deleted ones).
   - Compaction is where the engine pays for those cheap writes: it rewrites data to keep read paths sane and storage bounded.
   - This is also where some of the nastiest engineering tradeoffs live (write amplification, read amplification, space amplification).

If you're playing with the demo, watch for two things:
- **How fast the write path stays** even as you add keys (it mostly just appends and updates one in-memory structure).
- **How the read path grows** as more files accumulate (and why compaction exists in the first place).

---

## If you want to go deeper

I recommend watching the following lecture from the CMU Database course about LSM-Tree[^4] storage:

{% include embed/youtube.html id='IHtVWGhG0Xg' %}

---

## Closing thoughts (and what I'm building next)

BeachDB is my excuse to stop hand-waving storage engines and actually build one: define the semantics, write the invariants down, crash it on purpose, and make the on-disk state inspectable.

Right now the repo ([github.com/aalhour/beachdb](https://github.com/aalhour/beachdb)) is still empty (besides plans in markdown files), and that's fine. The point of this series isn't to drop a polished codebase on day one. It's to show the messy, mechanical steps that turn "I understand LSM trees" into "I can implement one and explain where it breaks."

Next up, I'll start putting real code on the page: the first slices of the storage engine (WAL + memtable + flushing into an SST format), plus some tiny tools/tests to prove it survives restarts and doesn't lie about what it stored.

Until we meet again.

Adios! ✌🏼

<!--

### Goals

- **Learn in public, with evidence.** Every milestone should produce something falsifiable: a dump tool, a crash test, a benchmark, or a diagram.
- **Build a correct, durable core.** I will start with an LSM storage engine where recovery and invariants are first-class, not afterthoughts.
- **Stay small and inspectable.** I will go with simple designs that anyone can explain end to end, with tooling to inspect on-disk state.
- **Make semantics explicit.** I will define and test what reads, writes, deletes, and iteration *mean* before optimizing anything.
- **Grow in layers.** Engine first, then a single-node server API, then distributed replication with the Raft protocol as a clean boundary (log entry equals `WriteBatch`).
- **Prioritize clarity over cleverness.** I will choose readability and understanding over micro-optimizations and feature breadth.
- **Use workloads as a compass.** I will measure behavior using a small, fixed set of workloads so improvements have a clear story.


### Non-goals

To keep BeachDB small and finishable, these are intentionally out of scope, at least for now:

- **Production readiness.** Multi-year maintenance guarantees, or compatibility promises. This one would definitely kill the fun!
- **Multi-writer concurrency in the engine.** I will go single-writer early on to build a meaningful storage core and only add multi-writers later. Concurrency will make every milestone, and probably every blogpost, a ghost story about a heisenbug :/
- **Background compaction early on**. I will add it only after invariants are rock-solid.
- **SQL.** SQL, query planner, joins, secondary indexes are all non-goals. I'd like to build them but not in this project.
- **Full transactions / serializable isolation.** Nope. Maybe after everything planned in the scope is shipped.
- **HBase-y/Cassandra-ish topics.** Auto sharding, region split/merge, rebalancing, quorum reads, gossip/repair. Out of scope until I lock in the core "distributed NoSQL KV database".

-->

---

## Notes & references

[^1]: Raft is a consensus protocol that was built to make distributed consensus easier to understand and implement in fault-tolerant distributed systems. Rumor has it, it was built after the industry collectively had nightmares about Paxos xD, see: [Raft docs & demo](https://raft.github.io/) to learn more about Raft. For context on Paxos, see: [The Part-time Parliament](https://lamport.azurewebsites.net/pubs/lamport-paxos.pdf) (original paper), [Paxos Made Simple](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf), [Paxos Made Really Simple](https://medium.datadriveninvestor.com/2025-paxos-made-really-simple-64174ac8feb5), and [Just Say NO to Paxos overhead](https://www.usenix.org/system/files/conference/osdi16/osdi16-li.pdf).
[^2]: HBase runs on top of the Hadoop Distributed Filesystem (HDFS) which handles sharding and replication of files for HBase, in addition to that different companies and deployments have different cross-cluster replication, see: [The HBase Book](https://hbase.apache.org/book.html#_cluster_replication) and [Cloudera docs](http://188.93.19.26/static/help/topics/cdh_bdr_hbase_replication.html).
[^3]: [Cassandra 3.x Replication Docs](https://docs.datastax.com/en/cassandra-oss/3.x/cassandra/architecture/archDataDistributeAbout.html).
[^4]: "LSM" or "LSMT" is short for Log-structured merge tree, a data structure invented by O'Neil, Cheng and Gawlick in 1996 and has been widely used in famous database systems, such as: Google Bigtable, HBase, Cassandra, Dynamo, RocksDB and others. See: [Wikipedia article](https://en.wikipedia.org/wiki/Log-structured_merge-tree), [original 1996 paper](https://www.cs.umb.edu/~poneil/lsmtree.pdf), and the ["LSM techniques survey" paper by Luo & Carey](https://arxiv.org/pdf/1812.07527).
[^5]: "WAL" is short for Write-Ahead Log or write-ahead logging, a technique utilized by database systems that promise durability and crash-recovery, where mutations to the database state are appended as facts to a log file for speed and performance reasons before they are applied internally (see: [Wikipedia article](https://en.wikipedia.org/wiki/Write-ahead_logging)).
[^6]: SST is short for Sorted-string table, which is a format for files that the storage engine uses when writing the contents of Memtables into disk. SSTables are sorted by key. See: [Bigtable paper](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/), and [ScyllaDB's article on SSTs](https://www.scylladb.com/glossary/sstable/).
[^7]: To keep the demo and explanation simple, the memtable size is measured in terms of # of entries. In practice, the size is measured in standard binary formats (bytes, kilobytes ... etc).

---
title: "LSM-Tree Animation Demo"
date: 2025-12-25
categories: [Programming]
tags: [Databases, Systems]
toc: false
---

This interactive visualization demonstrates how LSM-Tree (Log-Structured Merge-Tree) databases handle writes, reads, and compaction. Try adding some key-value pairs or click **▶ Demo** to see it in action!

{% include animations/lsm-tree.html %}

---

## How It Works

The visualization shows the RocksDB architecture with two planes:

### Memory Plane
- **Memtable**: In-memory sorted map that receives writes

### Disk Plane  
- **WAL** (Write-Ahead Log): Append-only log for durability - writes go here in parallel with the memtable
- **L0, L1, L2**: SST (Sorted String Table) files organized by level

### Operations

1. **Put** - Writes go to both the Memtable (memory) AND WAL (disk) in parallel for durability
2. **Flush** - When the Memtable fills up (4 entries), it's flushed to disk as an SST file in L0
3. **Get** - Reads check Memtable first, then SST files from newest (L0) to oldest (L2)
4. **Compact** - When there are 2+ files in L0, they can be merged into L1 (deduplicating keys)

## Usage

To add this visualization to any post, simply include it:

{% raw %}
```liquid
{% include animations/lsm-tree.html %}
```
{% endraw %}

You can also pass a custom container id:

{% raw %}
```liquid
{% include animations/lsm-tree.html id="my-lsm-viz" %}
```
{% endraw %}

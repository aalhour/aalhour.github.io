---
title: "Durability is a promise you can't hand-wave: WAL v1"
date: 2026-01-10
categories: [Programming]
tags: [beachdb, databases, storage, durability, wal]
toc: true
track: https://www.youtube.com/watch?v=Bxy1hHLtyHo
---


In my last blog post ["Building BeachDB: A Database from Scratch (in Go)"]({% post_url 2025-12-21-on-watershed-moments %}), I introduced my new rabbit hole of all rabbit holes.

## What does `fsync()` actually do?

When your Go program calls `file.Sync()`, a lot happens under the hood before your data is truly durable. The following animation traces the complete journey from user space to physical storage:

{% include animations/fsync.html %}

---
title: Log-structured merge-tree (LSM Tree)
description: "An interactive LSM tree animation explaining puts, gets, deletes, memtable flushes, SSTables, and compaction."
seo:
  type: WebPage
layout: page
permalink: /animations/lsm-tree/
---

{% assign animation = site.data.animations | where: "slug", "lsm-tree" | first %}

<div class="animation-detail">
  <div class="animation-detail-intro">
    <p>{{ animation.detail }}</p>

    <div class="animation-detail-usage">
      {% include animation-used-in.html include_path=animation.include_path %}
    </div>
  </div>

  <div class="animation-detail-stage">
    {% include animations/lsm-tree.html id="lsm-animation-full" %}
  </div>
</div>

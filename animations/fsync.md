---
title: fsync() Durability
layout: page
permalink: /animations/fsync/
---

{% assign animation = site.data.animations | where: "slug", "fsync" | first %}

<div class="animation-detail">
  <div class="animation-detail-intro">
    <p>{{ animation.detail }}</p>

    <div class="animation-detail-usage">
      {% include animation-used-in.html include_path=animation.include_path %}
    </div>
  </div>

  <div class="animation-detail-stage">
    {% include animations/fsync.html id="fsync-animation-full" %}
  </div>
</div>

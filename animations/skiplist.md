---
title: Skip List
layout: page
permalink: /animations/skiplist/
---

{% assign animation = site.data.animations | where: "slug", "skiplist" | first %}

<div class="animation-detail">
  <div class="animation-detail-intro">
    <p>{{ animation.detail }}</p>

    <div class="animation-detail-usage">
      {% include animation-used-in.html include_path=animation.include_path %}
    </div>
  </div>

  <div class="animation-detail-stage">
    {% include animations/skiplist.html id="skiplist-animation-full" %}
  </div>
</div>

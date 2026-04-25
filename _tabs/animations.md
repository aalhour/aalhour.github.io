---
title: Animations
icon: fas fa-film
order: 4
layout: page
permalink: /animations/
---

_Interactive visualizations I use to explain systems concepts across posts and projects._

---

<div class="animation-gallery">
  {% for animation in site.data.animations %}
    <article class="animation-card">
      <a class="animation-card-main" href="{{ animation.url | relative_url }}" aria-label="Open {{ animation.title }} animation">
        <div class="animation-card-preview animation-preview-{{ animation.preview.variant }}" aria-hidden="true">
          {% if animation.preview.variant == "lsm" %}
            <span class="preview-node preview-memory">Memtable</span>
            <span class="preview-arrow"></span>
            <span class="preview-node preview-level">L0</span>
            <span class="preview-node preview-level">L1</span>
            <span class="preview-node preview-level">L2</span>
          {% elsif animation.preview.variant == "skiplist" %}
            <span class="preview-lane lane-top"></span>
            <span class="preview-lane lane-mid"></span>
            <span class="preview-lane lane-base"></span>
            <span class="preview-dot dot-a"></span>
            <span class="preview-dot dot-b"></span>
            <span class="preview-dot dot-c"></span>
            <span class="preview-dot dot-d"></span>
          {% elsif animation.preview.variant == "fsync" %}
            <span class="preview-node preview-app">app</span>
            <span class="preview-node preview-cache">page cache</span>
            <span class="preview-node preview-disk">disk</span>
            <span class="preview-sync-line"></span>
          {% endif %}
        </div>

        <div class="animation-card-copy">
          <div class="animation-card-header">
            <h3 class="animation-card-title">{{ animation.title }}</h3>
            <span class="status-pill kind-educational">{{ animation.kind }}</span>
          </div>
          <p class="animation-card-desc">{{ animation.summary }}</p>
        </div>
      </a>

      <div class="animation-card-usage">
        {% include animation-used-in.html include_path=animation.include_path %}
      </div>
    </article>
  {% endfor %}
</div>

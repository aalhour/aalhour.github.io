---
title: Animations
description: "Interactive animations for systems concepts such as LSM trees, skip lists, and fsync durability."
seo:
  type: CollectionPage
icon: fas fa-film
order: 4
layout: page
permalink: /animations/
---

Interactive visualizations I use to explain systems concepts across posts and projects.

<ul class="row-list animations-list">
  {% for animation in site.data.animations %}
    <li class="row-list-item">
      <div class="row-list-meta">{{ animation.kind }}</div>
      <div class="row-list-body">
        <a class="row-list-title" href="{{ animation.url | relative_url }}">{{ animation.title }}</a>
        <p class="row-list-subtitle">{{ animation.summary }}</p>
        {% capture usage_marker %}<!-- animation: {{ animation.include_path }} -->{% endcapture %}
        {% assign usage_count = 0 %}
        {% for post in site.posts %}
          {% if post.content contains usage_marker %}{% assign usage_count = usage_count | plus: 1 %}{% endif %}
        {% endfor %}
        {% if usage_count > 0 %}
          <div class="row-list-usage">
            <span class="row-list-usage-label">Used in:</span>
            {% assign first = true %}
            {% for post in site.posts reversed %}
              {% if post.content contains usage_marker %}
                {% unless first %}<span class="row-list-usage-sep">·</span>{% endunless %}
                <a class="row-list-usage-link" href="{{ post.url | relative_url }}">{{ post.title }}</a>
                {% assign first = false %}
              {% endif %}
            {% endfor %}
          </div>
        {% endif %}
      </div>
      <a class="row-list-link" href="{{ animation.url | relative_url }}">open →</a>
    </li>
  {% endfor %}
</ul>

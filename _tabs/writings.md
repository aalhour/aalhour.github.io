---
title: Writings
description: "Essays and notes by Ahmad Alhour on software, systems, books, philosophy, career, and curiosity."
seo:
  type: CollectionPage
icon: fas fa-pen-nib
order: 1
layout: page
permalink: /writings/
---

{% include lang.html %}
{% assign visible_posts = site.posts | where_exp: 'post', 'post.hidden != true' %}
{% assign by_year = visible_posts | group_by_exp: 'p', 'p.date | date: "%Y"' %}

<div class="writings-page">
  <p>
    Essays and notes on software, systems, books, philosophy, and the useful trouble in between.
  </p>

  {% capture cat_rows %}{% include trending-list.html collection=site.categories %}{% endcapture %}
  {% assign cats_sorted = cat_rows | split: ';;' | sort %}

  {% capture tag_rows %}{% include trending-list.html collection=site.tags %}{% endcapture %}
  {% assign tags_sorted = tag_rows | split: ';;' | sort %}

  <section class="writings-browse" aria-label="Browse by category and tag">
    <div class="writings-browse-row">
      <span class="writings-browse-label" id="wb-cat-label">Categories</span>
      <div class="writings-browse-keys">
        <ul class="writings-browse-list" id="wb-cat-list" aria-labelledby="wb-cat-label">
        {% for row in cats_sorted %}
          {% assign parts = row | split: '||' %}
          <li><a class="wf-key" href="{{ '/categories/' | append: parts[2] | append: '/' | relative_url }}">{{ parts[1] }}<small><span class="wf-sr">, </span>{{ parts[3] }}<span class="wf-sr">{% if parts[3] == '1' %} post{% else %} posts{% endif %}</span></small></a></li>
        {% endfor %}
        </ul>
      </div>
    </div>
    <div class="writings-browse-row">
      <span class="writings-browse-label" id="wb-tag-label">Tags</span>
      <div class="writings-browse-keys">
        <ul class="writings-browse-list" id="wb-tag-list" aria-labelledby="wb-tag-label">
        {% for row in tags_sorted %}
          {% assign parts = row | split: '||' %}
          <li><a class="wf-key wf-key--tag" href="{{ '/tags/' | append: parts[2] | append: '/' | relative_url }}">#{{ parts[1] }}<small><span class="wf-sr">, </span>{{ parts[3] }}<span class="wf-sr">{% if parts[3] == '1' %} post{% else %} posts{% endif %}</span></small></a></li>
        {% endfor %}
        </ul>
      </div>
    </div>
  </section>

  {% for year_group in by_year %}
    <header class="writings-year">
      <h2>{{ year_group.name }}</h2>
      <span class="writings-year-count">{{ year_group.items.size }} {% if year_group.items.size == 1 %}essay{% else %}essays{% endif %}</span>
    </header>
    <div class="writings-entries">
      {% for post in year_group.items %}
        <article class="writings-entry">
          <div class="writings-entry-date">{{ post.date | date: '%-d %b' }}</div>
          <div class="writings-entry-body">
            <h3 class="writings-entry-title">
              <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
            </h3>
            <p class="writings-entry-note">
              {%- assign entry_note = post.subtitle | default: post.description -%}
              {%- if entry_note -%}
                {{ entry_note | strip_html | normalize_whitespace | truncatewords: 36 }}
              {%- elsif post.tldr -%}
                {{ post.tldr | markdownify | strip_html | normalize_whitespace | truncatewords: 36 }}
              {%- else -%}
                {{ post.excerpt | strip_html | normalize_whitespace | truncatewords: 28 }}
              {%- endif -%}
            </p>
            <div class="writings-entry-meta">
              {%- comment -%} Chirpy's own read-time include, as in the post header, so the two always agree. {%- endcomment -%}
              {% capture read_time %}{% include read-time.html content=post.content prompt=true lang=lang %}{% endcapture %}
              <span class="writings-entry-read">{{ read_time | strip }}</span>
              {% if post.categories.first %}
                <span class="writings-entry-sep" aria-hidden="true">·</span>
                {% assign cat_name = post.categories.first %}
                {% assign cat_slug = cat_name | slugify %}
                <a class="writings-entry-cat" href="{{ '/categories/' | append: cat_slug | append: '/' | relative_url }}">
                  <i class="far fa-folder-open fa-fw" aria-hidden="true"></i><span>{{ cat_name }}</span>
                </a>
              {% endif %}
            </div>
          </div>
        </article>
      {% endfor %}
    </div>
  {% endfor %}
</div>

{% include writings-browse.html %}

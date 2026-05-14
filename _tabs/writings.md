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

{% assign visible_posts = site.posts | where_exp: 'post', 'post.hidden != true' %}
{% assign by_year = visible_posts | group_by_exp: 'p', 'p.date | date: "%Y"' %}

<div class="writings-page">
  <p>
    Essays and notes on software, systems, books, philosophy, and the useful trouble in between.
  </p>

  {% comment %} Build sort keys so highest-count items render first. {% endcomment %}
  {% capture cat_rows -%}
    {%- for c in site.categories -%}
      {%- assign cn = c[0] -%}
      {%- assign cs = cn | slugify -%}
      {%- assign cp = c[1] -%}
      {%- assign cinv = 9999 | minus: cp.size -%}
      {%- assign csort = cinv | prepend: '0000' | slice: -4, 4 -%}
      {{ csort }}||{{ cn }}||{{ cs }}||{{ cp.size }}{% unless forloop.last %};;{% endunless %}
    {%- endfor -%}
  {%- endcapture %}
  {% assign cats_sorted = cat_rows | split: ';;' | sort %}

  {% capture tag_rows -%}
    {%- for t in site.tags -%}
      {%- assign tn = t[0] -%}
      {%- assign ts = tn | slugify -%}
      {%- assign tp = t[1] -%}
      {%- assign tinv = 9999 | minus: tp.size -%}
      {%- assign tsort = tinv | prepend: '0000' | slice: -4, 4 -%}
      {{ tsort }}||{{ tn }}||{{ ts }}||{{ tp.size }}{% unless forloop.last %};;{% endunless %}
    {%- endfor -%}
  {%- endcapture %}
  {% assign tags_sorted = tag_rows | split: ';;' | sort %}

  <section class="writings-browse" aria-label="Browse by category and tag">
    <div class="writings-browse-section">
      <h3 class="writings-browse-label">Categories</h3>
      <div class="writings-browse-items">
        {% for row in cats_sorted %}
          {% assign parts = row | split: '||' %}
          {% assign cname = parts[1] %}
          {% assign cslug = parts[2] %}
          {% assign ccount = parts[3] %}
          <a class="writings-browse-cat" data-c="{{ cslug }}" href="{{ '/categories/' | append: cslug | append: '/' | relative_url }}">
            <i class="far fa-folder-open fa-fw" aria-hidden="true"></i><span class="writings-browse-name">{{ cname | downcase }}</span><span class="writings-browse-count">{{ ccount }}</span>
          </a>
        {% endfor %}
      </div>
      <a class="writings-browse-seeall" href="{{ '/categories/' | relative_url }}">see all →</a>
    </div>

    <hr class="writings-browse-divider" aria-hidden="true">

    <div class="writings-browse-section">
      <h3 class="writings-browse-label">Trending tags</h3>
      <div class="writings-browse-items">
        {% for row in tags_sorted limit: 10 %}
          {% assign parts = row | split: '||' %}
          {% assign tname = parts[1] %}
          {% assign tslug = parts[2] %}
          {% assign tcount = parts[3] %}
          <a class="writings-browse-tag" href="{{ '/tags/' | append: tslug | append: '/' | relative_url }}">
            <span class="writings-browse-name">#{{ tname }}</span><span class="writings-browse-count">{{ tcount }}</span>
          </a>
        {% endfor %}
      </div>
      <a class="writings-browse-seeall" href="{{ '/tags/' | relative_url }}">see all →</a>
    </div>
  </section>

  {% for year_group in by_year %}
    <header class="writings-year">
      <h2>{{ year_group.name }}</h2>
      <span class="writings-year-count">{{ year_group.items.size }} {% if year_group.items.size == 1 %}essay{% else %}essays{% endif %}</span>
    </header>
    <div class="writings-entries">
      {% for post in year_group.items %}
        {% assign day = post.date | date: '%-d' | plus: 0 %}
        {% assign mod10 = day | modulo: 10 %}
        {% assign mod100 = day | modulo: 100 %}
        {% if mod100 >= 11 and mod100 <= 13 %}{% assign suffix = 'th' %}
        {% elsif mod10 == 1 %}{% assign suffix = 'st' %}
        {% elsif mod10 == 2 %}{% assign suffix = 'nd' %}
        {% elsif mod10 == 3 %}{% assign suffix = 'rd' %}
        {% else %}{% assign suffix = 'th' %}{% endif %}
        <article class="writings-entry">
          <div class="writings-entry-date">{{ post.date | date: '%b' }} {{ day }}{{ suffix }}</div>
          <div class="writings-entry-body">
            <h3 class="writings-entry-title">
              <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
            </h3>
            <p class="writings-entry-note">{{ post.excerpt | strip_html | normalize_whitespace | truncatewords: 28 }}</p>
            {% assign word_count = post.content | strip_html | number_of_words %}
            {% assign read_minutes = word_count | divided_by: 200 %}
            {% if read_minutes < 1 %}{% assign read_minutes = 1 %}{% endif %}
            <div class="writings-entry-meta">
              <span class="writings-entry-read">{{ read_minutes }} min read</span>
              {% if post.categories.first %}
                <span class="writings-entry-sep" aria-hidden="true">·</span>
                {% assign cat_name = post.categories.first %}
                {% assign cat_slug = cat_name | slugify %}
                <a class="writings-entry-cat" href="{{ '/categories/' | append: cat_slug | append: '/' | relative_url }}">
                  <i class="far fa-folder-open fa-fw" aria-hidden="true"></i><span>{{ cat_name | downcase }}</span>
                </a>
              {% endif %}
            </div>
          </div>
        </article>
      {% endfor %}
    </div>
  {% endfor %}
</div>

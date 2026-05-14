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
  <p class="writings-lede">
    Essays and notes on software, systems, books, philosophy, and the useful trouble in between.
  </p>

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
            {% if post.tags.size > 0 %}
              <div class="writings-entry-tags-right">
                {% for tag in post.tags limit: 5 %}
                  {% assign tag_slug = tag | slugify %}
                  <a class="writings-entry-tag" href="{{ '/tags/' | append: tag_slug | append: '/' | relative_url }}">#{{ tag }}</a>{% unless forloop.last %} {% endunless %}
                {% endfor %}
              </div>
            {% endif %}
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

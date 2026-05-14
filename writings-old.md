---
title: Writings (old)
description: "Backup of the prior /writings/ layout. Hidden from navigation."
layout: page
permalink: /writings-old/
hidden: true
sitemap: false
---

{% assign visible_posts = site.posts | where_exp: 'post', 'post.hidden != true' %}
{% assign featured_posts = visible_posts | where: 'pin', true %}
{% assign recent_posts = visible_posts | slice: 0, 10 %}

<div class="writings-old-page">
  <p class="writings-old-lede">
    Essays and notes on current projects I'm building, books I'm reading, and whatever rabbit hole I'm currently deep into.
  </p>

  <nav class="writings-old-browse" aria-label="Browse writing">
    <a href="{{ '/archives/' | relative_url }}">full archive <span aria-hidden="true">→</span></a>
    <a href="{{ '/tags/' | relative_url }}">tags <span aria-hidden="true">→</span></a>
    <a href="{{ '/categories/' | relative_url }}">categories <span aria-hidden="true">→</span></a>
  </nav>

  {% if featured_posts.size > 0 %}
    <section class="writings-old-section writings-old-featured" aria-labelledby="selected-essays-old">
      <header class="writings-old-section-header">
        <h2 id="selected-essays-old">Selected Essays</h2>
      </header>

      <ul class="row-list writings-old-selected-list">
        {% for post in featured_posts %}
          <li class="row-list-item">
            <div class="row-list-meta">
              <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: '%Y-%m-%d' }}</time>
              {% if post.categories.first %}
                {% assign category_name = post.categories.first %}
                {% assign category_slug = category_name | slugify %}
                <a class="writings-old-row-category" href="{{ '/categories/' | append: category_slug | append: '/' | relative_url }}">
                  <i class="far fa-folder-open fa-fw" aria-hidden="true"></i>
                  <span>{{ category_name | downcase }}</span>
                </a>
              {% endif %}
            </div>
            <div class="row-list-body">
              <a class="row-list-title" href="{{ post.url | relative_url }}">{{ post.title }}</a>
              <p class="row-list-subtitle">{{ post.excerpt | strip_html | normalize_whitespace | truncatewords: 28 }}</p>
              {% if post.tags.size > 0 %}
                <div class="row-list-chips" aria-label="Tags">
                  {% for tag in post.tags limit: 3 %}
                    {% assign tag_slug = tag | slugify %}
                    <a class="row-list-chip" href="{{ '/tags/' | append: tag_slug | append: '/' | relative_url }}">{{ tag }}</a>
                  {% endfor %}
                </div>
              {% endif %}
            </div>
            <a class="row-list-link" href="{{ post.url | relative_url }}">read <span aria-hidden="true">→</span></a>
          </li>
        {% endfor %}
      </ul>
    </section>
  {% endif %}

  <section class="writings-old-section" aria-labelledby="recent-writing-old">
    <header class="writings-old-section-header">
      <h2 id="recent-writing-old">Recent</h2>
      <a href="{{ '/archives/' | relative_url }}">full archive <span aria-hidden="true">→</span></a>
    </header>

    <ul class="row-list writings-old-recent-list">
      {% for post in recent_posts %}
        <li class="row-list-item">
          <div class="row-list-meta">
            <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: '%Y-%m-%d' }}</time>
            {% if post.categories.first %}
              {% assign category_name = post.categories.first %}
              {% assign category_slug = category_name | slugify %}
              <a class="writings-old-row-category" href="{{ '/categories/' | append: category_slug | append: '/' | relative_url }}">
                <i class="far fa-folder-open fa-fw" aria-hidden="true"></i>
                <span>{{ category_name | downcase }}</span>
              </a>
            {% endif %}
          </div>
          <div class="row-list-body">
            <a class="row-list-title" href="{{ post.url | relative_url }}">{{ post.title }}</a>
            <p class="row-list-subtitle">{{ post.excerpt | strip_html | normalize_whitespace | truncatewords: 28 }}</p>
            {% if post.tags.size > 0 %}
              <div class="row-list-chips" aria-label="Tags">
                {% for tag in post.tags limit: 3 %}
                  {% assign tag_slug = tag | slugify %}
                  <a class="row-list-chip" href="{{ '/tags/' | append: tag_slug | append: '/' | relative_url }}">{{ tag }}</a>
                {% endfor %}
              </div>
            {% endif %}
          </div>
          <a class="row-list-link" href="{{ post.url | relative_url }}">read <span aria-hidden="true">→</span></a>
        </li>
      {% endfor %}
    </ul>
  </section>

  <section class="writings-old-section writings-old-section-spaced" aria-labelledby="browse-category-old">
    <header class="writings-old-section-header">
      <h2 id="browse-category-old">Browse by Category</h2>
      <a href="{{ '/categories/' | relative_url }}">all categories <span aria-hidden="true">→</span></a>
    </header>

    <div class="writings-old-category-list">
      {% assign categories = site.categories | sort %}
      {% for category in categories %}
        {% assign category_name = category[0] %}
        {% assign category_slug = category_name | slugify %}
        {% assign category_posts = category[1] %}
        <article class="writings-old-category-row">
          <div class="writings-old-category-meta">
            <a href="{{ '/categories/' | append: category_slug | append: '/' | relative_url }}">
              {{ category_name }}
            </a>
            <span>{{ category_posts.size }} {% if category_posts.size == 1 %}post{% else %}posts{% endif %}</span>
          </div>
          <ul>
            {% for post in category_posts limit: 3 %}
              <li>
                <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
              </li>
            {% endfor %}
          </ul>
        </article>
      {% endfor %}
    </div>
  </section>

  <section class="writings-old-section writings-old-section-spaced" aria-labelledby="browse-tags-old">
    <header class="writings-old-section-header">
      <h2 id="browse-tags-old">Browse by Tag</h2>
      <a href="{{ '/tags/' | relative_url }}">all tags <span aria-hidden="true">→</span></a>
    </header>

    <div class="writings-old-tag-cloud">
      {% capture tag_rows -%}
        {%- for tag in site.tags -%}
          {%- assign tag_name = tag[0] -%}
          {%- assign tag_slug = tag_name | slugify -%}
          {%- assign tag_posts = tag[1] -%}
          {%- assign inverse_count = 9999 | minus: tag_posts.size -%}
          {%- assign sort_key = inverse_count | prepend: '0000' | slice: -4, 4 -%}
          {{ sort_key }}||{{ tag_name }}||{{ tag_slug }}||{{ tag_posts.size }}{% unless forloop.last %};;{% endunless %}
        {%- endfor -%}
      {%- endcapture %}
      {% assign tags_by_count = tag_rows | split: ';;' | sort %}
      {% for tag_row in tags_by_count limit: 10 %}
        {% assign tag_parts = tag_row | split: '||' %}
        {% assign tag_name = tag_parts[1] %}
        {% assign tag_slug = tag_parts[2] %}
        {% assign tag_count = tag_parts[3] %}
        <a href="{{ '/tags/' | append: tag_slug | append: '/' | relative_url }}">
          <span>{{ tag_name }}</span>
          <em>{{ tag_count }}</em>
        </a>
      {% endfor %}
    </div>
  </section>
</div>

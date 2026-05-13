---
title: Writings
icon: fas fa-pen-nib
order: 1
layout: page
permalink: /writings/
---

{% assign visible_posts = site.posts | where_exp: 'post', 'post.hidden != true' %}
{% assign featured_posts = visible_posts | where: 'pin', true %}
{% assign recent_posts = visible_posts | slice: 0, 10 %}
{% assign posts_by_year = visible_posts | group_by_exp: 'post', "post.date | date: '%Y'" %}

<div class="writings-page">
  <p class="writings-lede">
    Essays and notes on software, systems, books, philosophy, and the useful trouble in between.
  </p>

  <nav class="writings-browse" aria-label="Browse writing">
    <a href="{{ '/archives/' | relative_url }}">full archive <span aria-hidden="true">→</span></a>
    <a href="{{ '/tags/' | relative_url }}">tags <span aria-hidden="true">→</span></a>
    <a href="{{ '/categories/' | relative_url }}">categories <span aria-hidden="true">→</span></a>
  </nav>

  {% if featured_posts.size > 0 %}
    <section class="writings-section writings-featured" aria-labelledby="selected-essays">
      <header class="writings-section-header">
        <h2 id="selected-essays">Selected Essays</h2>
      </header>

      <ul class="row-list writings-selected-list">
        {% for post in featured_posts %}
          <li class="row-list-item">
            <div class="row-list-meta">
              <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: '%Y-%m-%d' }}</time>
              {% if post.categories.first %}
                <span class="status muted">{{ post.categories.first }}</span>
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

  <section class="writings-section" aria-labelledby="recent-writing">
    <header class="writings-section-header">
      <h2 id="recent-writing">Recent</h2>
      <a href="{{ '/archives/' | relative_url }}">full archive <span aria-hidden="true">→</span></a>
    </header>

    <ul class="row-list writings-recent-list">
      {% for post in recent_posts %}
        <li class="row-list-item">
          <div class="row-list-meta">
            <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: '%Y-%m-%d' }}</time>
            {% if post.categories.first %}
              <span class="status muted">{{ post.categories.first }}</span>
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

  <section class="writings-section writings-section-spaced" aria-labelledby="browse-category">
    <header class="writings-section-header">
      <h2 id="browse-category">Browse By Category</h2>
      <a href="{{ '/categories/' | relative_url }}">all categories <span aria-hidden="true">→</span></a>
    </header>

    <div class="writings-category-list">
      {% assign categories = site.categories | sort %}
      {% for category in categories %}
        {% assign category_name = category[0] %}
        {% assign category_slug = category_name | slugify %}
        {% assign category_posts = category[1] %}
        <article class="writings-category-row">
          <div class="writings-category-meta">
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

  <section class="writings-section writings-section-spaced" aria-labelledby="browse-tags">
    <header class="writings-section-header">
      <h2 id="browse-tags">Tags</h2>
      <a href="{{ '/tags/' | relative_url }}">all tags <span aria-hidden="true">→</span></a>
    </header>

    <div class="writings-tag-cloud">
      {% assign tags = site.tags | sort %}
      {% for tag in tags %}
        {% assign tag_name = tag[0] %}
        {% assign tag_slug = tag_name | slugify %}
        {% assign tag_posts = tag[1] %}
        <a href="{{ '/tags/' | append: tag_slug | append: '/' | relative_url }}">
          <span>{{ tag_name }}</span>
          <em>{{ tag_posts.size }}</em>
        </a>
      {% endfor %}
    </div>
  </section>

  <section class="writings-section writings-section-spaced" aria-labelledby="browse-years">
    <header class="writings-section-header">
      <h2 id="browse-years">Years</h2>
      <a href="{{ '/archives/' | relative_url }}">full archive <span aria-hidden="true">→</span></a>
    </header>

    <div class="writings-year-list">
      {% for year in posts_by_year %}
        <span>
          <strong>{{ year.name }}</strong>
          <em>{{ year.items.size }}</em>
        </span>
      {% endfor %}
    </div>
  </section>
</div>

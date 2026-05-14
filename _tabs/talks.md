---
title: Talks
description: "Talks, podcasts, and workshops by Ahmad Alhour on distributed systems, data engineering, leadership, and Python."
seo:
  type: CollectionPage
icon: fas fa-microphone
order: 2
layout: page
permalink: /talks/
---

Talks, podcasts, and workshops I've done over the years.

<ul class="row-list talks-list">
  {% for item in site.data.talks_trainings %}
    {% assign primary_url = '' %}
    {% assign primary_label = '' %}
    {% if item.video_link and item.video_link != '' %}
      {% assign primary_url = item.video_link %}
      {% assign primary_label = 'watch' %}
    {% elsif item.speakerdeck_link and item.speakerdeck_link != '' %}
      {% assign primary_url = item.speakerdeck_link %}
      {% assign primary_label = 'slides' %}
    {% elsif item.slides_link and item.slides_link != '' %}
      {% assign primary_url = item.slides_link %}
      {% assign primary_label = 'slides' %}
    {% endif %}

    <li class="row-list-item">
      <div class="row-list-meta">
        {{ item.date | default: item.type }}
        <span class="status muted">{{ item.type }}</span>
      </div>

      <div class="row-list-body">
        {% if primary_url != '' %}
          <a class="row-list-title" href="{{ primary_url }}">{{ item.title }}</a>
        {% else %}
          <span class="row-list-title">{{ item.title }}</span>
        {% endif %}

        {% if item.subtitle and item.subtitle != '' %}
          <p class="row-list-subtitle">{{ item.subtitle }}</p>
        {% endif %}

        <p class="row-list-subtitle">{{ item.description }}</p>

        <div class="row-list-usage">
          <span class="row-list-usage-label">{{ item.type | capitalize }} at:</span>
          {{ item.location }}
        </div>

        {% if item.video_link != '' or item.speakerdeck_link != '' or item.slides_link != '' %}
          <div class="row-list-usage">
            <span class="row-list-usage-label">Resources:</span>
            {% assign first = true %}
            {% if item.video_link and item.video_link != '' %}
              <a class="row-list-usage-link" href="{{ item.video_link }}">recording</a>
              {% assign first = false %}
            {% endif %}
            {% if item.speakerdeck_link and item.speakerdeck_link != '' %}
              {% unless first %}<span class="row-list-usage-sep">·</span>{% endunless %}
              <a class="row-list-usage-link" href="{{ item.speakerdeck_link }}">slides</a>
              {% assign first = false %}
            {% elsif item.slides_link and item.slides_link != '' %}
              {% unless first %}<span class="row-list-usage-sep">·</span>{% endunless %}
              <a class="row-list-usage-link" href="{{ item.slides_link }}">slides</a>
              {% assign first = false %}
            {% endif %}
          </div>
        {% endif %}
      </div>

      {% if primary_url != '' %}
        <a class="row-list-link" href="{{ primary_url }}">{{ primary_label }} →</a>
      {% endif %}
    </li>
  {% endfor %}
</ul>

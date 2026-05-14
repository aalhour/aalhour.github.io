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
    {% if item.video_link and item.video_link != '' %}
      {% assign primary_url = item.video_link %}
    {% elsif item.speakerdeck_link and item.speakerdeck_link != '' %}
      {% assign primary_url = item.speakerdeck_link %}
    {% elsif item.slides_link and item.slides_link != '' %}
      {% assign primary_url = item.slides_link %}
    {% endif %}

    <li class="row-list-item">
      <div class="row-list-meta">
        {{ item.date }}
        <span class="status">{{ item.type }}</span>
      </div>

      <div class="row-list-body">
        {% if primary_url != '' %}
          <a class="row-list-title" href="{{ primary_url }}">{{ item.title }}</a>
        {% else %}
          <span class="row-list-title">{{ item.title }}</span>
        {% endif %}

        <p class="row-list-subtitle">{{ item.description }}</p>

        <div class="row-list-info">
          {% if item.location %}
            <span class="row-list-info-item">
              <i class="fas fa-map-pin fa-fw" aria-hidden="true"></i><span>{{ item.location }}</span>
            </span>
          {% endif %}
          {% if item.video_link and item.video_link != '' %}
            <span class="row-list-info-sep" aria-hidden="true">·</span>
            <a class="row-list-info-link" href="{{ item.video_link }}">watch →</a>
          {% endif %}
          {% if item.speakerdeck_link and item.speakerdeck_link != '' %}
            <span class="row-list-info-sep" aria-hidden="true">·</span>
            <a class="row-list-info-link" href="{{ item.speakerdeck_link }}">slides →</a>
          {% elsif item.slides_link and item.slides_link != '' %}
            <span class="row-list-info-sep" aria-hidden="true">·</span>
            <a class="row-list-info-link" href="{{ item.slides_link }}">slides →</a>
          {% endif %}
        </div>
      </div>
    </li>
  {% endfor %}
</ul>

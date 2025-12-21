---
title: Talks
icon: fas fa-microphone
order: 1
layout: page
permalink: /talks/
---

Talks, podcasts, and trainings I've given over the years.

<div class="talks-list">
{% for item in site.data.talks_trainings %}
<div class="talk-card">
  <div class="talk-thumbnail">
    <img src="{{ item.thumbnail }}" alt="{{ item.title }}">
  </div>
  <div class="talk-content">
    <h3>{{ item.title }}</h3>
    <p class="talk-meta"><strong>{{ item.type | capitalize }}</strong> — {{ item.location }}</p>
    <p class="talk-description">{{ item.description }}</p>
    <div class="talk-links">
      {% if item.video_link and item.video_link != "" %}
      <a href="{{ item.video_link }}" class="talk-chip talk-chip--watch">
        <i class="fas fa-play"></i> Watch
      </a>
      {% endif %}
      {% if item.speakerdeck_link and item.speakerdeck_link != "" %}
      <a href="{{ item.speakerdeck_link }}" class="talk-chip talk-chip--slides">
        <i class="fas fa-file-alt"></i> Slides
      </a>
      {% endif %}
      <!-- {% if item.slides_link and item.slides_link != "" %}
      <a href="{{ item.slides_link }}" class="talk-chip talk-chip--pdf">
        <i class="fas fa-file-pdf"></i> PDF
      </a>
      {% endif %} -->
    </div>
  </div>
</div>
{% endfor %}
</div>


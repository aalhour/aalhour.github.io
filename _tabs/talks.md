---
title: Talks
icon: fas fa-microphone
order: 1
layout: page
permalink: /talks/
---

Talks, podcasts, and trainings I've given over the years.

{% for item in site.data.talks_trainings %}
### {{ item.title }}

![{{ item.title }}]({{ item.thumbnail }}){: .left w="120" h="60" }

**{{ item.type | capitalize }}** — {{ item.location }}

{{ item.description }}

{% if item.video_link and item.video_link != "" %}<a href="{{ item.video_link }}"><i class="fas fa-play"></i> Watch recording</a>{% endif %}{% if item.video_link and item.video_link != "" and item.speakerdeck_link and item.speakerdeck_link != "" %} · {% endif %}{% if item.speakerdeck_link and item.speakerdeck_link != "" %}<a href="{{ item.speakerdeck_link }}"><i class="fas fa-file-alt"></i> View slides</a>{% endif %}

---

{% endfor %}

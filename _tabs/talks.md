---
title: Talks
icon: fas fa-microphone
order: 1
layout: page
permalink: /talks/
---

_Talks, podcasts, and workshops I've done over the years._


{% for item in site.data.talks_trainings %}
#### {{ item.title }}

**{{ item.type | capitalize }}** — {{ item.location }}

![{{ item.title }}]({{ item.thumbnail }}){: .left w="120" h="60" }

{{ item.description }}

{% if item.video_link and item.video_link != "" %}<a href="{{ item.video_link }}"><i class="fas fa-play"></i> Watch recording</a>{% endif %}{% if item.video_link and item.video_link != "" and item.speakerdeck_link and item.speakerdeck_link != "" %} · {% endif %}{% if item.speakerdeck_link and item.speakerdeck_link != "" %}<a href="{{ item.speakerdeck_link }}"><i class="fas fa-file-alt"></i> View slides</a>{% endif %}

---

{% endfor %}

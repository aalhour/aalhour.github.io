---
title: Talks
icon: fas fa-microphone
order: 1
layout: page
permalink: /talks/
---

Talks, podcasts, and trainings I've given over the years.

{% for item in site.data.talks_trainings %}
{% if item.home_enabled == "true" %}
### {{ item.title }}

**{{ item.type | capitalize }}** — {{ item.location }}

{{ item.description }}

{% if item.video_link and item.video_link != "" %}
[Watch/View →]({{ item.video_link }})
{% endif %}

---

{% endif %}
{% endfor %}


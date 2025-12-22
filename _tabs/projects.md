---
title: Side Projects
icon: fas fa-code
order: 2
layout: page
permalink: /projects/
---

A collection of side-projects I've built over the years, mainly for the fun of learning new things.

{% for project in site.data.projects %}
{% if project.hidden == "false" %}
#### [{{ project.title }}]({{ project.link }})

{{ project.description }}

---

{% endif %}
{% endfor %}


---
title: Side Projects
icon: fas fa-code
order: 2
layout: page
permalink: /projects/
---

A collection of open-source projects and side-projects I've built over the years.

{% for project in site.data.projects %}
{% if project.home_enabled == "true" %}
### [{{ project.title }}]({{ project.link }})

{{ project.short_description }}

{{ project.long_description }}

---

{% endif %}
{% endfor %}


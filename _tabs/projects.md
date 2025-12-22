---
title: Projects
icon: fas fa-code
order: 2
layout: page
permalink: /projects/
---

_A collection of side projects I've built over the years, mostly for the joy of learning new things._

{% for project in site.data.projects %}
{% if project.hidden == "false" %}
#### [{{ project.title }}]({{ project.link }})

{{ project.description }}

---

{% endif %}
{% endfor %}


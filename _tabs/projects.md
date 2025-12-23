---
title: Projects
icon: fas fa-code
order: 2
layout: page
permalink: /projects/
---

_A mix of production tools I’ve shipped and learning projects I built to understand how things work... In addition to the occasional rabbit hole :D_


## Learning / Explorations

{% for project in site.data.projects %}
{% if project.hidden == "false" and project.category == "learning" %}

**{{ project.title }}** {% if project.status %}<span class="status-pill status-{{ project.status }}">{{ project.status }}</span>{% endif %}
: {{ project.description }} [<i class="fas fa-external-link-alt"></i> {{ project.link_title }}]({{ project.link }})

{% endif %}
{% endfor %}

---

## Production / Practical

{% for project in site.data.projects %}
{% if project.hidden == "false" and project.category == "production" %}

**{{ project.title }}** {% if project.status %}<span class="status-pill status-{{ project.status }}">{{ project.status }}</span>{% endif %}
: {{ project.description }} [<i class="fas fa-external-link-alt"></i> {{ project.link_title }}]({{ project.link }})

{% endif %}
{% endfor %}

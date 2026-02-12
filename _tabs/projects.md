---
title: Projects
icon: fas fa-code
order: 1
layout: page
permalink: /projects/
---

_A mix of production tools I've shipped and learning projects I built to understand how things work... In addition to the occasional rabbit hole :D_

## Learning / Explorations

<table class="projects-table">
  <thead>
    <tr>
      <th class="col-project">Project</th>
      <th class="col-description">Description</th>
    </tr>
  </thead>
  <tbody>
    {% for project in site.data.projects %}
    {% if project.hidden == "false" and project.category == "learning" %}
    <tr>
      <td class="col-project">
        <a href="{{ project.link }}" target="_blank"><strong>{{ project.title }}</strong></a>
        <br>
        <span class="status-pill status-{{ project.status }}">{{ project.status }}</span>
      </td>
      <td class="col-description">{{ project.description | markdownify | remove: '<p>' | remove: '</p>' }}</td>
    </tr>
    {% endif %}
    {% endfor %}
  </tbody>
</table>

---

## Production / Practical

<table class="projects-table">
  <thead>
    <tr>
      <th class="col-project">Project</th>
      <th class="col-description">Description</th>
    </tr>
  </thead>
  <tbody>
    {% for project in site.data.projects %}
    {% if project.hidden == "false" and project.category == "production" %}
    <tr>
      <td class="col-project">
        <a href="{{ project.link }}" target="_blank"><strong>{{ project.title }}</strong></a><br>
        <span class="status-pill status-{{ project.status }}">{{ project.status }}</span>
      </td>
      <td class="col-description">{{ project.description | markdownify | remove: '<p>' | remove: '</p>' }}</td>
    </tr>
    {% endif %}
    {% endfor %}
  </tbody>
</table>

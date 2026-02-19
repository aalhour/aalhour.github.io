---
title: Projects
icon: fas fa-code
order: 1
layout: page
permalink: /projects/
---

_A mix of active projects and older work: some educational rabbit holes, some practical tools, and some upstream contributions._

## Active

<table class="projects-table">
  <thead>
    <tr>
      <th class="col-project">Project</th>
      <th class="col-description">Description</th>
    </tr>
  </thead>
  <tbody>
    {% for project in site.data.projects %}
    {% if project.hidden == "false" and project.activity == "active" %}
    <tr>
      <td class="col-project">
        <a href="{{ project.link }}" target="_blank"><strong>{{ project.title }}</strong></a>
        <div class="project-meta">
          <span class="status-pill kind-{{ project.kind }}">{{ project.kind }}</span>

          {% assign engagement = project.engagement %}
          {% if engagement == "contributor" %}
            <span class="status-pill me-contributing">contributing</span>
          {% elsif engagement == "collaborator" %}
            <span class="status-pill me-active">collaborating</span>
          {% endif %}
        </div>
      </td>
      <td class="col-description">{{ project.description | markdownify | remove: '<p>' | remove: '</p>' }}</td>
    </tr>
    {% endif %}
    {% endfor %}
  </tbody>
</table>

---

## Previous work

_Archived, finished, and older collaborations._

<table class="projects-table">
  <thead>
    <tr>
      <th class="col-project">Project</th>
      <th class="col-description">Description</th>
    </tr>
  </thead>
  <tbody>
    {% for project in site.data.projects %}
    {% if project.hidden == "false" and project.activity != "active" %}
    <tr>
      <td class="col-project">
        <a href="{{ project.link }}" target="_blank"><strong>{{ project.title }}</strong></a>
        <div class="project-meta">
          <span class="status-pill kind-{{ project.kind }}">{{ project.kind }}</span>

          {% assign engagement = project.engagement %}
          {% if engagement == "contributor" %}
            <span class="status-pill me-contributed">contributed</span>
          {% elsif engagement == "collaborator" %}
            <span class="status-pill me-past">past</span>
          {% endif %}
        </div>
      </td>
      <td class="col-description">{{ project.description | markdownify | remove: '<p>' | remove: '</p>' }}</td>
    </tr>
    {% endif %}
    {% endfor %}
  </tbody>
</table>

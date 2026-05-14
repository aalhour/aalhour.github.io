---
title: Projects
description: "Projects by Ahmad Alhour, including active systems work, open-source tools, experiments, and previous contributions."
seo:
  type: CollectionPage
icon: fas fa-code
order: 1
layout: page
permalink: /projects/
---

A mix of active projects and older work: some educational rabbit holes, some practical tools, and some upstream contributions.

## Active

<ul class="row-list projects-list">
  {% for project in site.data.projects %}
    {% if project.hidden == "false" and project.activity == "active" %}
      <li class="row-list-item">
        <div class="row-list-meta">
          {{ project.kind }}
          {% if project.engagement == "owner" %}
            <span class="status">owned</span>
          {% elsif project.engagement == "contributor" %}
            <span class="status">contributing</span>
          {% elsif project.engagement == "collaborator" %}
            <span class="status">collaborating</span>
          {% endif %}
        </div>
        <div class="row-list-body">
          <a class="row-list-title" href="{{ project.link }}" target="_blank" rel="noopener">{{ project.title }}</a>
          <p class="row-list-subtitle">{{ project.description | markdownify | remove: '<p>' | remove: '</p>' }}</p>
        </div>
        <a class="row-list-link" href="{{ project.link }}" target="_blank" rel="noopener">{{ project.link_title | default: 'open' }} →</a>
      </li>
    {% endif %}
  {% endfor %}
</ul>

## Previous work

Archived, finished, and older collaborations.

<ul class="row-list projects-list">
  {% for project in site.data.projects %}
    {% if project.hidden == "false" and project.activity != "active" %}
      <li class="row-list-item">
        <div class="row-list-meta">
          {{ project.kind }}
          {% if project.maintenance == "archived" %}
            <span class="status muted">archived</span>
          {% elsif project.maintenance == "abandoned" %}
            <span class="status muted">abandoned</span>
          {% elsif project.engagement == "contributor" %}
            <span class="status muted">contributed</span>
          {% else %}
            <span class="status muted">past</span>
          {% endif %}
        </div>
        <div class="row-list-body">
          <a class="row-list-title" href="{{ project.link }}" target="_blank" rel="noopener">{{ project.title }}</a>
          <p class="row-list-subtitle">{{ project.description | markdownify | remove: '<p>' | remove: '</p>' }}</p>
        </div>
        <a class="row-list-link" href="{{ project.link }}" target="_blank" rel="noopener">{{ project.link_title | default: 'open' }} →</a>
      </li>
    {% endif %}
  {% endfor %}
</ul>

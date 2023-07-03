---
title: "Talks"
layout: single
permalink: /talks/
author_profile: true
---
{% for talk in site.data.talks_trainings limit: 5 %}
    {% if talk.home_enabled == "true" %}
        <div class="media">
            <div class="media-left">
                <a href="{{ talk.video_link }}">
                    <img class="media-object img-rounded" src="{{ talk.thumbnail }}" alt="[Thumbnail]" width="64" height="64">
                </a>
            </div>
            <div class="media-body">
                <h4 class="media-heading"><a href="{{ talk.video_link }}">{{ talk.title }}</a></h4>
                <h4>{{ talk.location }}{% if talk.link_to_slides == "true" %}&nbsp;(<a href="{{ talk.speakerdeck_link }}">Slides</a>){% endif %}</h4>
                <span>{{ talk.description }}</span>
            </div>
        </div><!--/.media -->
    {% endif %}
{% endfor %}
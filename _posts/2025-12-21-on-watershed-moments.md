---
title: "On Watershed Moments: Boredom, Growth, and Curiosity"
date: 2025-12-21
categories: [Career]
tags: [career, layoffs, growth, databases, systems]
image: /assets/images/posts/2025-12-21-on-watershed-moments.webp
# pin: true        # Pin to the top of home
# math: true       # Enable MathJax
# mermaid: true    # Enable diagrams
---

Do you know that feeling when you realize you're not growing anymore in your chosen field, role, or area(s) of expertise?

Or when you notice you've been maintaining your tools instead of learning new ones?

I've been there... a few times.

## Backstory

### Web Dev, 2007 - 2015

I started my career back in 2007/2008, around the time when I joined college (team [PSUT](https://psut.edu.jo/) 🙌🏼).

I used to build small websites to get some pocket cash from small organizations as a freelancer. Then I met two guys on campus who wanted to build a startup, and I joined them as a front-end engineer part-time. I was balancing work and study. It was a cool gig for a college student. I learned PHP with the LAMP stack and used the PRADO and Yii frameworks for "full-stack" web dev.

Using the PRADO framework felt weird at first, but then I learned to like it... or let's just say I got used to it. Heh! It was an interesting web framework for PHP given that it was inspired by ASP.NET. I'm still not sure why the original authors designed it that way.

Around that same time, I got bored with building static websites for internet cafes and small organizations, and jumping into the full-stack movement. Before it was even called full-stack, it felt like a breath of fresh air: new toys to play with, new challenges to overcome, and lessons to learn. It was awesome.

> Moving from building static websites (frontend) to building a product end-to-end (full-stack) forced me to grow early on in my career.
{: .prompt-tip }

I then switched companies and joined a cool startup that was building a monetized (ahem, ads, ahem) Arabic content platform in Amman (see: [web.archive.org](https://web.archive.org/web/20140829024154/https://d1g.com/) entry). It gave me the chance to learn Ruby on Rails and work with some of the most amazing people I've met in my life. People I now consider friends for life.

Fast-forward a year or two and I'm in this too-big but too-shallow software engineering role at an [Oil & Gas corporation](https://www.ccc.net/) doing Linux system administration, computer networking, cable clipping and switching, C#.NET and SQL Server ops. At the same time, I was fiddling with Titanium.js (now [Titanium SDK](https://titaniumsdk.com/)) to build a cross-platform mobile app so corporate leaders could have the contact info of every person in every office on the planet while traveling. I still don't know why connecting LDAP or Active Directory to work phones wasn't good enough...

But anyway, I digress. I was getting a bit bored with full-stack Ruby on Rails web development back in Amman, and moving to Greece to join the Oil & Gas giant was a cool move. It gave me the opportunity to do way more back-office jobs than a normal web dev role would've provided.

Getting out of my comfort zone yet again motivated me to learn new things and learn what I don't want to do more of... Like networking is cool, but I wouldn't want to spend another day worrying about subnets and how to calculate them for a private network (sorry DevOps!).

### Big Data, 2016 - 2023

Fast forward 3 years in Greece and I've moved countries (yup, again) to Germany. This time I'm in Munich, working for a cool startup in the world of hospitality (see: [TrustYou.com](https://www.trustyou.com/)).

TrustYou, much like D1G, was a special place, gave me the chance to be a full-stack web developer (in Python this time), and then allowed me to pursue being a tech lead, design systems that solve problems at big scale.

I worked on many interesting challenges, one being the rollout of Connect, which allowed us to onboard hundreds of thousands of new hoteliers.

Another one was when we integrated our APIs and data flows with hospitality giants like [Booking.com](https://www.booking.com/), [TripAdvisor](https://www.tripadvisor.com/) among many others, to allow hoteliers to get their reservations to TrustYou in near-real-time and send their post-stay surveys to guests.

Once the big challenges were overcome, all the lessons were learned, the tech talks were delivered... Maintenance work sunk in. I then got really bored building yet another API, or yet another full-stack product. Launching them was great. Maintaining them was easy thanks to early investments in automated testing, but the challenge was no longer there.

I moved to the Data Engineering team and contributed to the Daily Pipeline, which ingested ~7 million new hotel reviews per week. That was awesome.

> New toys to play with, challenges to overcome and lessons to learn.
{: .prompt-tip }

I like the Big Data domain. Learning to use and operate Hadoop and its zoo of different data animals (Hive, HBase, Spark and others) was exciting and introduced me to the world of distributed systems and data engineering.

I continued to do more of the same from 2019 until I left Shopify in the summer of 2023.

### A recent shift in interests, 2023 - Present

When I was at Shopify, I worked on the Shop App marketplace. I built APIs, scaled databases and Kafka consumers, worked on data pipelines in Apache Spark (in Python) and Apache Flink (in Scala).

Things started to feel all the same again: big scale, big data, similar repeating problems, somewhat stable infrastructure and "jobs to be done". The challenges were not new nor "nasty". Which is good, but not challenging.

It started to feel like another API, same shape, different nouns. Even the incidents felt familiar: the kind you fix with a checklist, not a new idea.

A subtle shift in my perspective started happening gradually. Whenever I would discover a tool or product in the past, I used to think along the lines of:

> How can I use this tool to build X feature? Or I wonder how I can use this to solve X or Y problems in my product!
{: .prompt-monologue }

And then I started thinking along the lines of:

> I wonder how this product works on the inside? How would someone approach building this from scratch?
{: .prompt-monologue }

## The Shopify Layoff

Layoffs suck and the mass layoff of 2023 sucked a lot, but I'm not here to complain. 2,999 other people also went through it; I wasn't alone. But one thing that didn't suck about it is that it gave me an opportunity to go back to the drawing board.

Once the storm weathered, the severance package was signed, the laptop shipped back, and I took some time off to be with my family. I was ready to think clearly about what I wanted to do next.

I didn't want to just build products anymore. I wanted to build technical products. I wanted to build something that other engineers could use to build their own products that served their end users.

## Enter Apache HBase

I joined HubSpot in 2023, and not on any team, but the really cool Apache HBase team in Data Infrastructure. The team contributed to Apache HBase upstream and operated around 200 database clusters in 5 production data centers around the planet. A true planet-scale architecture.

It was an amazing opportunity for me to learn about the internals of databases, Kubernetes operators, deployments, and how to be an SRE in a general sense. A really cool gig that I'm grateful for. One that put me on the path of digging deeper into the internals of mission-critical systems such as databases in general and distributed systems in particular.

The experience of learning HBase, contributing two humble patches to the community, and operating it in production was invaluable. And it left me hungry to this day to continue learning more about databases, storage, and distributed systems.

## A new inspiration

Reviving a blog in the age of AI sounds silly... maybe. Not really. Not for me, at least.

Writing clears up my head, and putting it out there creates this social pressure and accountability that I need to think about what I am writing in sharper and clearer ways.

Databases and distributed systems have been my latest inspiration. The place I go to have _"new toys to play with, challenges to overcome and lessons to learn"_. Which is why I decided to re-learn database internals, tinker more with it, and write more about it.

Since I started working at Grafana Labs, I’ve also been getting into the world of observability. Not just pretty dashboards, but the lower-level stuff too: measuring performance close to the system, understanding where the time actually goes, and turning “it feels slow” into something you can point at.

Trends like eBPF (and the ecosystem around it) feel like a new kind of microscope. The kind that makes me want to learn how things work under the hood, not just how to scale them from the outside.

Watershed moments, to me, are inflection points for growth. There's nothing wrong with maintaining your tools or keeping the fort running until the next beginning shows up.

But now that I'm here, I want to make the most out of it.

I'm writing again because I want to learn more about databases and distributed systems, and because writing is how I learn. If this sounds like your alley, stay tuned for future posts about my toy database project.


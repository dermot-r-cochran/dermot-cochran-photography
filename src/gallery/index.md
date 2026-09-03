---
layout: base.njk
title: "Gallery"
description: "Photography gallery — nature, wildlife, landscape, macro, and occasional architecture shots by Dermot R. Cochran."
comments: true
---
<h1 class="page-title">Gallery</h1>
<p class="page-intro">
  A selection of recent nature, wildlife, landscape, and macro photography, with the
  occasional architecture shot. Browse by
  <a href="/category/">category</a>, <a href="/country/">country</a>,
  <a href="/location/">location</a>, <a href="/year/">year</a>,
  <a href="/albums/">album</a>, or <a href="/keywords/">keyword</a> — or see
  the nature and macro work split by
  <a href="/wild-or-cultivated/">wild or cultivated</a>.
</p>

<ul class="gallery-grid">
{% for photo in collections.photos %}
  <li class="gallery-grid__item">
    <a href="{{ photo.url }}">
      <img src="/images/photos/{{ photo.data.image }}" alt="{{ photo.data.alt }}" loading="lazy" />
      <span class="gallery-grid__caption">{{ photo.data.title }}</span>
    </a>
  </li>
{% endfor %}
</ul>

---
layout: base.njk
title: "Gallery"
description: "Photography gallery — nature and macro shots by Dermot R. Cochran."
comments: true
---
<h1 class="page-title">Gallery</h1>
<p class="page-intro">
  A selection of recent macro nature photography. Browse by
  <a href="/category/">category</a>, <a href="/location/">location</a>,
  <a href="/year/">year</a>, or <a href="/albums/">album</a>.
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

---
layout: base.njk
title: "Selected"
description: "A short walk through the photographs Dermot R. Cochran stands behind hardest."
comments: true
---
<h1 class="page-title">Selected</h1>
<p class="page-intro">
  The pick of the site, in one short walk.
</p>

<ul class="gallery-grid">
{% for photo in collections.photos %}
{% if photo.data.selected %}
  <li class="gallery-grid__item">
    <a href="{{ photo.url }}">
      <img src="/images/photos/{{ photo.data.image }}" alt="{{ photo.data.alt }}" loading="lazy" />
      <span class="gallery-grid__caption">{{ photo.data.title }}</span>
    </a>
  </li>
{% endif %}
{% endfor %}
</ul>

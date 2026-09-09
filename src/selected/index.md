---
layout: base.njk
title: "Selected"
description: "A short walk through the photographs Dermot R. Cochran stands behind hardest."
comments: true
---
<h1 class="page-title">Selected</h1>
<p class="page-intro">
  The pick of the site, in one short walk. Any photograph that has placed in a
  competition is here as well.
</p>

{# A photo is on this page for either of two reasons: Dermot chose it
   (selected: true, his call alone), or it carries an award: - a competition
   placing is a fact, and an awarded photograph is in the selection by that
   fact whether or not it also carries the flag (9 September 2026). #}

<ul class="gallery-grid">
{% for photo in collections.photos %}
{% if photo.data.selected or photo.data.award %}
  <li class="gallery-grid__item">
    <a href="{{ photo.url }}">
      <img src="/images/photos/{{ photo.data.image }}" alt="{{ photo.data.alt }}" loading="lazy" />
      <span class="gallery-grid__caption">{{ photo.data.title }}</span>
    </a>
  </li>
{% endif %}
{% endfor %}
</ul>

---
layout: base.njk
title: "Home"
description: "Dermot Cochran Photography — nature, macro, and everyday scenes."
templateEngineOverride: njk
---
<section class="home-hero">
  <h1 class="home-hero__title">Dermot Cochran Photography</h1>
  <p class="home-hero__subtitle">
    A collection of nature, macro, and everyday photography.
  </p>
  <a class="home-hero__cta" href="/gallery/">View the Gallery</a>
</section>

<section class="home-slideshow" aria-roledescription="carousel" aria-label="Featured photos">
  <div class="home-slideshow__viewport">
    {% for photo in collections.photos %}
    <figure class="home-slideshow__slide{% if loop.first %} is-active{% endif %}" aria-roledescription="slide" aria-label="{{ loop.index }} of {{ loop.length }}"{% if not loop.first %} aria-hidden="true"{% endif %}>
      <a href="{{ photo.url }}">
        <img src="/images/photos/{{ photo.data.image }}" alt="{{ photo.data.alt }}" loading="{% if loop.first %}eager{% else %}lazy{% endif %}" />
      </a>
      <figcaption class="home-slideshow__caption">{{ photo.data.title }}</figcaption>
    </figure>
    {% endfor %}
  </div>
  <button type="button" class="home-slideshow__prev" aria-label="Previous photo">‹</button>
  <button type="button" class="home-slideshow__next" aria-label="Next photo">›</button>
  <div class="home-slideshow__dots" role="tablist" aria-label="Choose slide">
    {% for photo in collections.photos %}
    <button type="button" class="home-slideshow__dot{% if loop.first %} is-active{% endif %}" role="tab" aria-selected="{% if loop.first %}true{% else %}false{% endif %}" aria-label="Go to slide {{ loop.index }}: {{ photo.data.title }}"></button>
    {% endfor %}
  </div>
</section>

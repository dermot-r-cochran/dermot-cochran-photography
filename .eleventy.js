// The derivation logic (slugify, country, wild-or-cultivated,
// natural-or-built, archive grouping, the homepage slideshow selection) lives
// in lib/derivations.js so it can be unit-tested (test/derivations.test.js)
// without booting Eleventy; each function carries its own rationale there.
// This file is the wiring: passthroughs, filters, and collections.
const {
  countryOf,
  groupPhotosBy,
  naturalOrBuilt,
  selectHomepagePhotos,
  slugify,
  wildOrCultivated,
  SETTINGS
} = require("./lib/derivations.js");

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/js": "js" });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/static/.htaccess": ".htaccess" });
  eleventyConfig.addPassthroughCopy({ "src/static/.well-known": ".well-known" });

  eleventyConfig.addFilter("absoluteUrl", function(path, base) {
    const siteUrl = base || "https://dermotcochran.com/";
    if (!path) return siteUrl;
    if (/^https?:\/\//i.test(path)) return path;
    return new URL(path.replace(/^\/+/, ""), siteUrl).toString();
  });

  eleventyConfig.addFilter("slugify", slugify);

  eleventyConfig.addCollection("photos", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/photos/*.md")
      .sort((a, b) => (a.data.order || 0) - (b.data.order || 0))
  );

  // Homepage slideshow: see selectHomepagePhotos in lib/derivations.js for
  // the featured/recency rules and the one-slide-per-album cap.
  eleventyConfig.addCollection("homepagePhotos", (collectionApi) =>
    selectHomepagePhotos(collectionApi.getFilteredByGlob("src/photos/*.md"))
  );

  for (const field of ["category", "location", "year", "album"]) {
    eleventyConfig.addCollection(`photo${field[0].toUpperCase()}${field.slice(1)}s`, (collectionApi) =>
      groupPhotosBy(collectionApi.getFilteredByGlob("src/photos/*.md"), field)
    );
  }

  // Keywords overlap - a photo carries several - so this is the one axis
  // grouped from a list: groupPhotosBy files the photo under each entry. The
  // vocabulary and the four-photo floor live in scripts/validate-photos.js.
  eleventyConfig.addCollection("photoKeywords", (collectionApi) =>
    groupPhotosBy(collectionApi.getFilteredByGlob("src/photos/*.md"), "keywords")
  );

  eleventyConfig.addCollection("photoCountries", (collectionApi) =>
    groupPhotosBy(collectionApi.getFilteredByGlob("src/photos/*.md"), (data) => countryOf(data.location))
  );

  eleventyConfig.addCollection("photoWildOrCultivated", (collectionApi) =>
    groupPhotosBy(collectionApi.getFilteredByGlob("src/photos/*.md"), wildOrCultivated)
  );

  // Natural / Altered / Built is a spectrum, so it is ordered deliberately
  // rather than alphabetically - "Altered, Built, Natural" would read as three
  // unrelated buckets instead of a progression.
  eleventyConfig.addCollection("photoNaturalOrBuilt", (collectionApi) =>
    groupPhotosBy(collectionApi.getFilteredByGlob("src/photos/*.md"), naturalOrBuilt)
      .sort((a, b) => SETTINGS.indexOf(a.key) - SETTINGS.indexOf(b.key))
  );

  // Let a photo page link to its own country / wild-or-cultivated bucket
  // without repeating the derivation.
  eleventyConfig.addFilter("countryOf", countryOf);
  eleventyConfig.addFilter("wildOrCultivated", wildOrCultivated);
  eleventyConfig.addFilter("naturalOrBuilt", naturalOrBuilt);

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk"
  };
};

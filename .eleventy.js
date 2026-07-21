function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Groups a "photos" collection by one front-matter field (category, location,
// year, album, ...) into { key, slug, items } buckets, sorted by key - drives
// the paginated archive templates (src/category, src/location, src/year,
// src/albums) via `pagination: { data: "collections.photo<Field>" }`.
function groupPhotosBy(photos, field) {
  const groups = new Map();
  for (const photo of photos) {
    const key = photo.data[field];
    if (!key) continue;
    const slug = slugify(key);
    if (!groups.has(slug)) groups.set(slug, { key, slug, items: [] });
    groups.get(slug).items.push(photo);
  }
  return Array.from(groups.values()).sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

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

  // Newest n photos (highest `order` first) without mutating the collection.
  eleventyConfig.addFilter("latest", (arr, n) => arr.slice().reverse().slice(0, n));

  eleventyConfig.addCollection("photos", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/photos/*.md")
      .sort((a, b) => (a.data.order || 0) - (b.data.order || 0))
  );

  for (const field of ["category", "location", "year", "album"]) {
    eleventyConfig.addCollection(`photo${field[0].toUpperCase()}${field.slice(1)}s`, (collectionApi) =>
      groupPhotosBy(collectionApi.getFilteredByGlob("src/photos/*.md"), field)
    );
  }

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

// Standalone letters that aren't base+diacritic compositions, so NFD
// normalization below doesn't decompose them (unlike o-with-diaeresis,
// which splits into "o" + a combining mark that the ASCII strip removes).
// Scandinavian place names are common enough in this site's location/album
// fields (Sonderga, etc.) to need these spelled out explicitly.
const SLUG_LETTER_MAP = { "\u00f8": "o", "\u00d8": "o", "\u00e5": "a", "\u00c5": "a", "\u00e6": "ae", "\u00c6": "ae", "\u00f0": "d", "\u00d0": "d", "\u00fe": "th", "\u00de": "th", "\u00df": "ss" };

function slugify(value) {
  return String(value)
    .replace(/[\u00f8\u00d8\u00e5\u00c5\u00e6\u00c6\u00f0\u00d0\u00fe\u00de\u00df]/g, (ch) => SLUG_LETTER_MAP[ch])
    // Decompose remaining accented letters (e.g. o with diaeresis -> "o" +
    // a combining mark) so the base letter survives the ASCII-only strip
    // below instead of the whole character just vanishing - without this,
    // "Malmo" (plain) and the accented spelling collide on the same slug,
    // and "<accented city>, Sweden" collapses to "-sweden" with the city
    // name gone.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

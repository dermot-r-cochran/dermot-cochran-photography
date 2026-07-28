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

// Country is derived from `location` rather than stored in front matter, so
// there is nothing extra to write per photo and nothing that can drift out of
// sync. The convention is "Place, Country" - sometimes with an intermediate
// region, e.g. "Enkewa, Maasai Mara, Kenya" - so the country is the last
// comma-separated segment. A location with no comma is taken to be a country
// in its own right.
//
// Open water has no country. Those locations are listed here explicitly rather
// than guessed at, because there is no way to tell "Baltic Sea" from a
// single-word country name by inspection.
const AT_SEA_LOCATIONS = new Set(["Baltic Sea"]);

function countryOf(location) {
  if (!location) return null;
  const value = String(location).trim();
  if (AT_SEA_LOCATIONS.has(value)) return "At sea";
  const segments = value.split(",").map((part) => part.trim()).filter(Boolean);
  return segments.length ? segments[segments.length - 1] : null;
}

// Wild vs cultivated is derived from the competitions tagging rather than
// stored, for the same reason country is: the information is already there and
// already load-bearing, so a separate field could only drift out of sync.
//
// IPF-Nature's ruleset bans cultivated plants and ornamental gardens outright,
// so the presence of that tag IS the "wild" marker - a rose from St Anne's
// rose garden can never carry it, and a thistle growing in a field always can.
//
// It is a strict binary: every photo in scope is Wild or Cultivated, never
// both and never an in-between. Getting that right means using a different
// signal for animals than for plants, because IPF-Nature is a COMPOUND test -
// wild AND no human element AND not cultivated AND not feral.
//
//   - For plants, the only realistic way to fail it is cultivation, so the tag
//     is an exact wild/cultivated marker.
//   - For animals it usually fails on a vehicle track or a building in frame,
//     which says nothing about whether the animal is wild. "Young Lion in
//     Morning Light" is a wild lion lying on a bare earth track; it is not
//     IPF-Nature eligible and it is obviously not cultivated.
//
// So animals are decided by CATEGORY, which is the authored judgement about
// what the subject is: the repo's own rule is pure wildlife -> Wildlife, any
// hand of man -> Documentary. A photo categorised Wildlife is therefore a wild
// subject by definition, whatever is in the background.
//
// Categories outside these three are out of scope and appear in neither -
// asking whether the Ha'penny Bridge is cultivated is not a question.
function wildOrCultivated(data) {
  if (data.category === "Wildlife") return "Wild";
  if (data.category !== "Macro" && data.category !== "Nature") return null;
  return (data.competitions || []).includes("IPF-Nature") ? "Wild" : "Cultivated";
}

// Groups a "photos" collection into { key, slug, items } buckets, sorted by
// key - drives the paginated archive templates (src/category, src/location,
// src/year, src/albums, src/country) via
// `pagination: { data: "collections.photo<Field>" }`.
//
// `keyOf` takes either a front-matter field name or a function of the photo's
// data, which is what lets country be a derived grouping.
function groupPhotosBy(photos, keyOf) {
  const extract = typeof keyOf === "function" ? keyOf : (data) => data[keyOf];
  const groups = new Map();
  for (const photo of photos) {
    const key = extract(photo.data);
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

  eleventyConfig.addCollection("photos", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/photos/*.md")
      .sort((a, b) => (a.data.order || 0) - (b.data.order || 0))
  );

  // Homepage slideshow: newest photo from each album, one slide per album,
  // so a run of same-shoot uploads (all sharing one album) can't crowd out
  // the rest of the portfolio.
  eleventyConfig.addCollection("homepagePhotos", (collectionApi) => {
    const newestFirst = collectionApi
      .getFilteredByGlob("src/photos/*.md")
      .sort((a, b) => (b.data.order || 0) - (a.data.order || 0));
    const seenAlbums = new Set();
    const picks = [];
    for (const photo of newestFirst) {
      if (seenAlbums.has(photo.data.album)) continue;
      seenAlbums.add(photo.data.album);
      picks.push(photo);
      if (picks.length >= 10) break;
    }
    return picks;
  });

  for (const field of ["category", "location", "year", "album"]) {
    eleventyConfig.addCollection(`photo${field[0].toUpperCase()}${field.slice(1)}s`, (collectionApi) =>
      groupPhotosBy(collectionApi.getFilteredByGlob("src/photos/*.md"), field)
    );
  }

  eleventyConfig.addCollection("photoCountries", (collectionApi) =>
    groupPhotosBy(collectionApi.getFilteredByGlob("src/photos/*.md"), (data) => countryOf(data.location))
  );

  eleventyConfig.addCollection("photoWildOrCultivated", (collectionApi) =>
    groupPhotosBy(collectionApi.getFilteredByGlob("src/photos/*.md"), wildOrCultivated)
  );

  // Let a photo page link to its own country / wild-or-cultivated bucket
  // without repeating the derivation.
  eleventyConfig.addFilter("countryOf", countryOf);
  eleventyConfig.addFilter("wildOrCultivated", wildOrCultivated);

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

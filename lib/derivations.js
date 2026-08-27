// The site's derived facets, extracted verbatim from .eleventy.js so the
// logic is unit-testable (test/derivations.test.js) without booting Eleventy
// — the same move star-rangers made with lib/classify-content.js on
// 2026-08-24. .eleventy.js remains the only production consumer.

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
// "Urban Wildlife" counts as Wild for the same reason Wildlife does: the
// animals are free-living. The built surroundings are what make it its own
// category, not what make it less wild - a hyrax in a museum coffee machine
// chose that machine.
function wildOrCultivated(data) {
  if (data.category === "Wildlife" || data.category === "Urban Wildlife") return "Wild";
  if (data.category !== "Macro" && data.category !== "Nature") return null;
  return (data.competitions || []).includes("IPF-Nature") ? "Wild" : "Cultivated";
}

// Natural / Altered / Built describes the ENVIRONMENT a photograph was made
// in - never the subject standing in it (Dermot's wording, 15 August 2026, and
// the distinction the whole facet turns on). "Natural" here means natural
// *environment*, not natural *subject*. Documentary already carries whether
// people or their works are present.
//
// The Mara is the Mara whether or not a balloon is crossing it, which is why
// "Balloon over the Mara" and "Watching Lions at Dusk" are Natural. By the same
// reading the Bray air-display frames are Natural too: sky and cloud are a
// natural environment, and a Mustang is emphatically not a natural subject.
// Reading "Natural" as a claim about the subject is the specific mistake this
// comment exists to prevent - those three were first filed Built on exactly
// that error, which could not be reconciled with the balloon.
//
// Three values, not two, because the most interesting third of this portfolio
// sits between them. A reservoir is a manufactured thing that looks like a
// lake; a groyne is timber imposed on a beach; a birch avenue is a wood someone
// planted in rows. Forcing those either way discards what the photograph is
// about. ALTERED is natural ground shaped by human hand.
//
// The line that keeps Altered from eating the world: it means VISIBLE HUMAN
// WORKS IN THE LANDSCAPE, never human causation. "The Drowned Forest" is
// Natural - Lake Naivasha rose and the trees died, and nobody built anything
// there - even though the rise may well be anthropogenic in origin. On a
// causation test the Dublin Mountains would fail too, their heather being
// burned and grazed to keep it heather. This mirrors IPF-Nature, which bans
// human elements in frame rather than human influence.
//
// Unlike wildOrCultivated this is not a strict binary with an out-of-scope
// null: "is the Ha'penny Bridge cultivated" is a category error, whereas "is
// Bohernabreena natural or built" has the real answer "both".
//
// Most of it derives. An explicit `setting:` in front matter always wins and is
// needed only for Landscape, Documentary and Creative, where the category
// cannot tell you. A photo with neither a default nor an override returns null
// and simply does not appear - deliberately, so a missing judgement surfaces as
// absence rather than as a confident wrong answer.
// MIXED (added 24 August 2026, Dermot's direction: "a new category for
// photos where the environment is mixed or unsure") is the explicit judgement
// that the frame's environment cannot be filed cleanly as one of the other
// three - genuinely mixed ground, or a call that resists being made. It is a
// RECORDED judgement, which is what separates it from an absent `setting:`:
// absence still means "not yet judged" and still keeps the photo off
// /natural-or-built/, exactly as before.
const SETTINGS = ["Natural", "Altered", "Built", "Mixed"];
function naturalOrBuilt(data) {
  if (data.setting) return SETTINGS.includes(data.setting) ? data.setting : null;
  if (data.category === "Architecture" || data.category === "Urban Wildlife") return "Built";
  if (["Wildlife", "Nature", "Macro"].includes(data.category)) return "Natural";
  // An IPF-Nature tag asserts no human element anywhere in frame, which settles it.
  return (data.competitions || []).includes("IPF-Nature") ? "Natural" : null;
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

// Homepage slideshow: one slide per album, capped at 10, so a run of
// same-shoot uploads (all sharing one album) can't crowd out the rest of
// the portfolio. `featured` photos are curated slides: they take slots
// first (and lead the rotation), and within an album a featured photo
// represents it instead of the newest one. `featured: <n>` fixes a slide's
// position (1 opens); `featured: true` slides follow the numbered ones,
// newest first. Remaining slots fall back to the newest photo from each
// not-yet-shown album.
function selectHomepagePhotos(photos) {
  const newestFirst = [...photos].sort((a, b) => (b.data.order || 0) - (a.data.order || 0));
  const featuredRank = (photo) =>
    typeof photo.data.featured === "number" ? photo.data.featured : Infinity;
  const seenAlbums = new Set();
  const picks = [];
  const take = (candidates) => {
    for (const photo of candidates) {
      if (picks.length >= 10) return;
      if (seenAlbums.has(photo.data.album)) continue;
      seenAlbums.add(photo.data.album);
      picks.push(photo);
    }
  };
  take(
    newestFirst
      .filter((photo) => photo.data.featured)
      .sort((a, b) => featuredRank(a) - featuredRank(b))
  );
  take(newestFirst);
  return picks;
}

module.exports = {
  AT_SEA_LOCATIONS,
  SETTINGS,
  countryOf,
  groupPhotosBy,
  naturalOrBuilt,
  selectHomepagePhotos,
  slugify,
  wildOrCultivated
};

// Unit tests for lib/derivations.js — the derivation rules that regress
// silently: a branch-order change in naturalOrBuilt or a slideshow-selection
// tweak alters where photos file with no build failure and no visible error.
// Built-in node:test, no new dependencies; run via `node --test test/` (part
// of `npm test`).
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  countryOf,
  groupPhotosBy,
  naturalOrBuilt,
  selectHomepagePhotos,
  slugify,
  wildOrCultivated
} = require("../lib/derivations.js");

// A minimal photo-shaped object: the functions only ever read `data`.
const photo = (data) => ({ data });

test("countryOf takes the last comma-separated segment", () => {
  assert.equal(countryOf("Maasai Mara, Kenya"), "Kenya");
  assert.equal(countryOf("Enkewa, Maasai Mara, Kenya"), "Kenya");
});

test("countryOf treats a comma-free location as a country in its own right", () => {
  assert.equal(countryOf("Ireland"), "Ireland");
});

test("countryOf survives a trailing comma and blank segments", () => {
  assert.equal(countryOf("Dublin, Ireland,"), "Ireland");
  assert.equal(countryOf("  "), null);
  assert.equal(countryOf(null), null);
});

test("countryOf files listed open water under At sea", () => {
  assert.equal(countryOf("Baltic Sea"), "At sea");
});

test("wildOrCultivated: animals are decided by category, whatever the tags", () => {
  // A wild lion on a bare earth track loses IPF-Nature but is still Wild.
  assert.equal(wildOrCultivated({ category: "Wildlife", competitions: ["DCC"] }), "Wild");
  assert.equal(wildOrCultivated({ category: "Urban Wildlife", competitions: [] }), "Wild");
});

test("wildOrCultivated: plants are decided by the IPF-Nature tag", () => {
  assert.equal(wildOrCultivated({ category: "Nature", competitions: ["DCC", "IPF-Nature"] }), "Wild");
  assert.equal(wildOrCultivated({ category: "Nature", competitions: ["DCC"] }), "Cultivated");
  assert.equal(wildOrCultivated({ category: "Macro", competitions: [] }), "Cultivated");
});

test("wildOrCultivated: other categories are out of scope, not Cultivated", () => {
  assert.equal(wildOrCultivated({ category: "Architecture", competitions: ["DCC"] }), null);
  assert.equal(wildOrCultivated({ category: "Landscape", competitions: ["IPF-Nature"] }), null);
});

test("naturalOrBuilt: an explicit setting always wins", () => {
  assert.equal(naturalOrBuilt({ category: "Wildlife", setting: "Altered" }), "Altered");
  assert.equal(naturalOrBuilt({ category: "Architecture", setting: "Mixed" }), "Mixed");
});

test("naturalOrBuilt: an invalid setting reads as absence, never a guess", () => {
  assert.equal(naturalOrBuilt({ category: "Landscape", setting: "Urban" }), null);
});

test("naturalOrBuilt: category defaults", () => {
  assert.equal(naturalOrBuilt({ category: "Architecture" }), "Built");
  assert.equal(naturalOrBuilt({ category: "Urban Wildlife" }), "Built");
  assert.equal(naturalOrBuilt({ category: "Wildlife" }), "Natural");
  assert.equal(naturalOrBuilt({ category: "Nature" }), "Natural");
  assert.equal(naturalOrBuilt({ category: "Macro" }), "Natural");
});

test("naturalOrBuilt: IPF-Nature settles the underivable categories", () => {
  assert.equal(
    naturalOrBuilt({ category: "Landscape", competitions: ["IPF-Nature"] }),
    "Natural"
  );
});

test("naturalOrBuilt: no default and no override means absent, not wrong", () => {
  assert.equal(naturalOrBuilt({ category: "Landscape", competitions: ["DCC"] }), null);
  assert.equal(naturalOrBuilt({ category: "Documentary" }), null);
  assert.equal(naturalOrBuilt({ category: "Creative", competitions: [] }), null);
});

test("slugify maps the standalone Scandinavian letters instead of dropping them", () => {
  assert.equal(slugify("Søndergård"), "sondergard");
  assert.equal(slugify("Ærø, Denmark"), "aero-denmark");
});

test("slugify keeps the base letter of composed accents", () => {
  // Without NFD decomposition "Malmö, Sweden" would collapse to "-sweden".
  assert.equal(slugify("Malmö, Sweden"), "malmo-sweden");
  // ...and therefore lands on the same slug as the plain spelling.
  assert.equal(slugify("Malmo, Sweden"), "malmo-sweden");
});

test("groupPhotosBy buckets by slug and sorts by key", () => {
  const groups = groupPhotosBy(
    [photo({ album: "B Album" }), photo({ album: "A Album" }), photo({ album: "B Album" })],
    "album"
  );
  assert.deepEqual(groups.map((g) => [g.key, g.items.length]), [["A Album", 1], ["B Album", 2]]);
  assert.equal(groups[1].slug, "b-album");
});

test("groupPhotosBy drops photos whose key is empty", () => {
  const groups = groupPhotosBy([photo({ album: "" }), photo({})], "album");
  assert.deepEqual(groups, []);
});

test("groupPhotosBy files a list-valued key under every entry", () => {
  // Keywords overlap: one photo lands in several groups, and a group holds
  // every photo that names it, whichever position it sits at in the list.
  const lion = photo({ keywords: ["Wild Cats", "Big Five", "Silhouettes"] });
  const elephant = photo({ keywords: ["Big Five"] });
  const groups = groupPhotosBy([lion, elephant, photo({})], "keywords");
  assert.deepEqual(
    groups.map((g) => [g.key, g.items.length]),
    [["Big Five", 2], ["Silhouettes", 1], ["Wild Cats", 1]]
  );
  assert.deepEqual(groups[0].items, [lion, elephant]);
});

test("groupPhotosBy skips empty entries inside a list and an empty list", () => {
  const groups = groupPhotosBy([photo({ keywords: ["", "Fungi"] }), photo({ keywords: [] })], "keywords");
  assert.deepEqual(groups.map((g) => [g.key, g.items.length]), [["Fungi", 1]]);
});

// Slideshow fixtures: order doubles as identity so failures name the photo.
const slide = (order, album, featured) => photo({ order, album, featured });

test("slideshow with no featured flags is pure recency, one slide per album", () => {
  const picks = selectHomepagePhotos([
    slide(1, "old"),
    slide(2, "mid"),
    slide(3, "mid"),
    slide(4, "new")
  ]);
  assert.deepEqual(picks.map((p) => p.data.order), [4, 3, 1]);
});

test("numbered featured slides lead in position order, then featured:true, then recency", () => {
  const picks = selectHomepagePhotos([
    slide(1, "a"),
    slide(2, "b", true),
    slide(3, "c", 2),
    slide(4, "d", 1),
    slide(5, "e")
  ]);
  assert.deepEqual(picks.map((p) => p.data.order), [4, 3, 2, 5, 1]);
});

test("a featured photo represents its album instead of the album's newest", () => {
  const picks = selectHomepagePhotos([
    slide(1, "shoot", 1),
    slide(2, "shoot"),
    slide(3, "other")
  ]);
  assert.deepEqual(picks.map((p) => p.data.order), [1, 3]);
});

test("the cap is 10 slides however many albums exist", () => {
  const photos = Array.from({ length: 14 }, (_, i) => slide(i + 1, `album-${i + 1}`));
  const picks = selectHomepagePhotos(photos);
  assert.equal(picks.length, 10);
  assert.deepEqual(picks.map((p) => p.data.order), [14, 13, 12, 11, 10, 9, 8, 7, 6, 5]);
});

test("the input array is not reordered by selection", () => {
  const photos = [slide(2, "b"), slide(1, "a")];
  selectHomepagePhotos(photos);
  assert.deepEqual(photos.map((p) => p.data.order), [2, 1]);
});

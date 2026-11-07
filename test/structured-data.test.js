// Unit tests for lib/structured-data.js — the ImageObject each photo page
// carries for image search. A wrong licence URL or a lost creator would not
// fail the build or show on the page; only a search engine would notice.
const test = require("node:test");
const assert = require("node:assert/strict");

const { photoImageObject, photoKeywords, jsonLd } = require("../lib/structured-data.js");

const SITE = "https://dermotcochran.com/";
const sloe = {
  title: "A Single Sloe",
  category: "Nature",
  location: "Bohernabreena, Dublin, Ireland",
  year: 2026,
  album: "Bohernabreena Reservoir, August 2026",
  image: "a-single-sloe.jpg",
  alt: "A blue-black sloe hanging from a blackthorn twig",
  competitions: ["DCC", "WNPA", "IPF-Nature"],
  copyrightYear: 2026
};

test("an ImageObject names the creator, licence and image", () => {
  const o = photoImageObject(sloe, "/photos/a-single-sloe/", SITE);
  assert.equal(o["@type"], "ImageObject");
  assert.equal(o.contentUrl, "https://dermotcochran.com/images/photos/a-single-sloe.jpg");
  assert.equal(o.url, "https://dermotcochran.com/photos/a-single-sloe/");
  assert.equal(o.creator.name, "Dermot R. Cochran");
  assert.equal(o.creditText, "Dermot R. Cochran");
  assert.equal(o.copyrightNotice, "© 2026 Dermot R. Cochran");
  assert.equal(o.license, "https://creativecommons.org/licenses/by-nc-nd/4.0/");
  assert.equal(o.acquireLicensePage, "https://dermotcochran.com/license/");
  assert.equal(o.contentLocation.name, "Bohernabreena, Dublin, Ireland");
  assert.equal(o.dateCreated, "2026");
});

test("description is the alt text, and keywords a list", () => {
  const o = photoImageObject(sloe, "/p/", SITE);
  assert.equal(o.description, sloe.alt);
  assert.ok(Array.isArray(o.keywords));
});

test("keywords are the page's own facts, once each", () => {
  const words = photoKeywords(sloe);
  for (const w of ["Nature", "Bohernabreena, Dublin, Ireland", "Ireland", "Bohernabreena Reservoir, August 2026", "2026"]) {
    assert.ok(words.includes(w), w);
  }
  assert.equal(new Set(words).size, words.length);
  assert.ok(!words.includes(undefined) && !words.includes(null) && !words.includes(""));
});

test("jsonLd cannot close its script element", () => {
  const out = jsonLd({ name: "</script><b>" });
  assert.ok(!out.includes("</script>"));
  assert.deepEqual(JSON.parse(out), { name: "</script><b>" });
});

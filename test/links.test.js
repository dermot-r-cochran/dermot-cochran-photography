const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractRefs,
  extractIds,
  extractSitemapRefs,
  resolveRef,
  candidateFiles,
  urlOfFile,
  checkLinks,
} = require("../lib/links.js");

const ORIGIN = "https://dermotcochran.com";

// A site of three pages, shaped like the real one: root-absolute links, a
// lazy slide, a share image named in full, a note linking another photo.
function site(overrides = {}) {
  const files = {
    "index.html":
      '<a class="skip-link" href="#main-content">Skip</a>' +
      '<link rel="stylesheet" href="/css/main.css?v=abc123" />' +
      '<meta property="og:image" content="https://dermotcochran.com/images/photos/the-path.jpg" />' +
      '<main id="main-content"><a href="/photos/the-path/"><img data-src="/images/photos/the-path.jpg" alt="" /></a></main>',
    "photos/the-path/index.html":
      '<main id="main-content"><img src="/images/photos/the-path.jpg" alt="" />' +
      '<p>Four frames after <a href="/photos/the-far-shore/">The Far Shore</a>.</p>' +
      '<a href="https://creativecommons.org/licenses/by-nc-nd/4.0/">licence</a></main>',
    "photos/the-far-shore/index.html": '<main id="main-content"><a href="/">Home</a></main>',
    "css/main.css": "",
    "images/photos/the-path.jpg": "",
    ...overrides,
  };
  for (const key of Object.keys(files)) if (files[key] === null) delete files[key];
  const pages = Object.keys(files)
    .filter((f) => f.endsWith(".html"))
    .map((file) => ({ file, html: files[file] }));
  return { pages, has: (f) => f in files, siteOrigin: ORIGIN, sitemap: files["sitemap.xml"] };
}

test("extractRefs reads href, src, data-src, poster, srcset and the share metas", () => {
  const refs = extractRefs(
    '<a href="/a/">x</a><img src=\'/b.jpg\' data-src="/c.jpg" srcset="/d.jpg 1x, /e.jpg 2x">' +
      '<video poster=/f.jpg></video>' +
      '<meta property="og:image" content="https://dermotcochran.com/g.jpg">' +
      '<meta name="description" content="/not-a-link/">'
  );
  assert.deepEqual(
    refs.map((r) => r.value),
    ["/a/", "/b.jpg", "/c.jpg", "/d.jpg", "/e.jpg", "/f.jpg", "https://dermotcochran.com/g.jpg"]
  );
});

test("extractRefs ignores comments and the inside of scripts, and decodes &amp;", () => {
  const refs = extractRefs(
    '<!-- <a href="/gone/">old</a> -->' +
      '<script type="application/ld+json">{"x":"<a href=\\"/also-gone/\\">"}</script>' +
      '<script src="/js/slideshow.js?v=1&amp;w=2" defer></script>'
  );
  assert.deepEqual(refs, [{ attr: "src", value: "/js/slideshow.js?v=1&w=2" }]);
});

test("extractIds collects ids and named anchors", () => {
  assert.deepEqual(
    [...extractIds('<main id="main-content"><h2 id="notes">x</h2><a name="old">y</a></main>')],
    ["main-content", "notes", "old"]
  );
});

test("extractSitemapRefs reads page and image locations", () => {
  const refs = extractSitemapRefs(
    "<url><loc>https://dermotcochran.com/photos/x/</loc>" +
      "<image:image><image:loc>https://dermotcochran.com/images/photos/x.jpg</image:loc></image:image></url>"
  );
  assert.deepEqual(refs, [
    { attr: "loc", value: "https://dermotcochran.com/photos/x/" },
    { attr: "image:loc", value: "https://dermotcochran.com/images/photos/x.jpg" },
  ]);
});

test("resolveRef sorts a reference into internal, external, skipped or invalid", () => {
  assert.deepEqual(resolveRef("/photos/x/?v=1#note", "/", ORIGIN), {
    kind: "internal",
    path: "/photos/x/",
    fragment: "note",
  });
  assert.deepEqual(resolveRef("../the-path/", "/photos/x/", ORIGIN), {
    kind: "internal",
    path: "/photos/the-path/",
    fragment: "",
  });
  assert.equal(resolveRef("https://dermotcochran.com/about/", "/", ORIGIN).kind, "internal");
  assert.equal(resolveRef("/images/photos/caf%C3%A9.jpg", "/", ORIGIN).path, "/images/photos/café.jpg");
  assert.equal(resolveRef("https://fianilchruinne.com", "/", ORIGIN).kind, "external");
  assert.equal(resolveRef("//giscus.app/client.js", "/", ORIGIN).kind, "external");
  assert.equal(resolveRef("http://dermotcochran.com/about/", "/", ORIGIN).kind, "external");
  assert.equal(resolveRef("mailto:someone@example.com", "/", ORIGIN).kind, "skip");
  assert.equal(resolveRef("", "/", ORIGIN).kind, "invalid");
  assert.equal(resolveRef("/photos/%E0%A4%A/", "/", ORIGIN).kind, "invalid");
});

test("candidateFiles and urlOfFile map between addresses and built files", () => {
  assert.deepEqual(candidateFiles("/"), ["index.html"]);
  assert.deepEqual(candidateFiles("/photos/x/"), ["photos/x/index.html"]);
  assert.deepEqual(candidateFiles("/photos/x"), ["photos/x", "photos/x/index.html"]);
  assert.deepEqual(candidateFiles("/sitemap.xml"), ["sitemap.xml", "sitemap.xml/index.html"]);
  assert.equal(urlOfFile("index.html"), "/");
  assert.equal(urlOfFile("photos/x/index.html"), "/photos/x/");
  assert.equal(urlOfFile("404.html"), "/404.html");
});

test("checkLinks passes a site whose every internal reference resolves", () => {
  assert.deepEqual(checkLinks(site()), []);
});

test("checkLinks names a note's link to a page that is no longer built", () => {
  const problems = checkLinks(site({ "photos/the-far-shore/index.html": null }));
  assert.equal(problems.length, 1);
  assert.equal(problems[0].file, "photos/the-path/index.html");
  assert.equal(problems[0].value, "/photos/the-far-shore/");
  assert.match(problems[0].reason, /no built file at \/photos\/the-far-shore\//);
});

test("checkLinks catches a missing image on every page that names it, lazy slide and share image included", () => {
  const problems = checkLinks(site({ "images/photos/the-path.jpg": null }));
  assert.deepEqual(
    problems.map((p) => `${p.file} ${p.attr}`),
    ["index.html og:image", "index.html data-src", "photos/the-path/index.html src"]
  );
});

test("checkLinks checks a fragment against the ids of the page it lands on", () => {
  const broken = site({
    "photos/the-far-shore/index.html": '<main><a href="/photos/the-path/#notes">x</a><a href="#top">y</a></main>',
  });
  assert.deepEqual(
    checkLinks(broken).map((p) => p.reason),
    ['no id "notes" on /photos/the-path/', 'no id "top" on /photos/the-far-shore/']
  );
});

test("checkLinks flags an empty address and leaves other sites alone", () => {
  const problems = checkLinks(
    site({ "photos/the-far-shore/index.html": '<a href="">x</a><a href="https://example.com/missing/">y</a>' })
  );
  assert.equal(problems.length, 1);
  assert.equal(problems[0].reason, "empty or unreadable address");
});

test("checkLinks walks the sitemap as well as the pages", () => {
  const sitemap =
    "<urlset><url><loc>https://dermotcochran.com/photos/the-path/</loc>" +
    "<image:image><image:loc>https://dermotcochran.com/images/photos/the-path.jpg</image:loc></image:image></url>" +
    "<url><loc>https://dermotcochran.com/photos/renamed/</loc></url></urlset>";
  const problems = checkLinks(site({ "sitemap.xml": sitemap }));
  assert.deepEqual(problems, [
    {
      file: "sitemap.xml",
      attr: "loc",
      value: "https://dermotcochran.com/photos/renamed/",
      reason: "no built file at /photos/renamed/",
    },
  ]);
});

// Pins scripts/indexnow.js: which URLs a deploy submits. The network step is
// not tested; everything that decides what goes into it is.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  sitemapLocs,
  fileForUrl,
  pageHash,
  buildManifest,
  pendingUrls,
  findKey,
} = require("../scripts/indexnow.js");

function site(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexnow-"));
  for (const [name, body] of Object.entries(files)) {
    const p = path.join(dir, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  return dir;
}

const sitemap = (...urls) =>
  `<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`;

test("sitemapLocs reads every loc and unescapes &amp;", () => {
  assert.deepStrictEqual(
    sitemapLocs(sitemap("https://a.test/", "https://a.test/x/?p=1&amp;q=2")),
    ["https://a.test/", "https://a.test/x/?p=1&q=2"]
  );
});

test("fileForUrl maps directory URLs to index.html and refuses other hosts", () => {
  assert.strictEqual(
    fileForUrl("/s", "https://a.test/lore/x/", "a.test"),
    path.join("/s", "lore", "x", "index.html")
  );
  assert.strictEqual(
    fileForUrl("/s", "https://a.test/page.html", "a.test"),
    path.join("/s", "page.html")
  );
  assert.strictEqual(fileForUrl("/s", "https://b.test/x/", "a.test"), null);
});

test("pageHash ignores everything outside <main>", () => {
  const a = '<head>v1.0</head><main id="m">Body</main><footer>v1.0</footer>';
  const b = '<head>v1.1</head><main id="m">Body</main><footer>v1.1</footer>';
  const c = '<head>v1.1</head><main id="m">Body changed</main><footer>v1.1</footer>';
  assert.strictEqual(pageHash(a), pageHash(b));
  assert.notStrictEqual(pageHash(b), pageHash(c));
});

test("pendingUrls: first deploy submits all; later deploys submit new, changed and gone", () => {
  const cur = { "https://a.test/a/": "1", "https://a.test/b/": "2", "https://a.test/c/": "3" };
  assert.deepStrictEqual(pendingUrls(null, cur).sort(), Object.keys(cur).sort());
  const prev = { "https://a.test/a/": "1", "https://a.test/b/": "old", "https://a.test/gone/": "9" };
  assert.deepStrictEqual(pendingUrls(prev, cur).sort(), [
    "https://a.test/b/",
    "https://a.test/c/",
    "https://a.test/gone/",
  ]);
  assert.deepStrictEqual(pendingUrls(cur, cur), []);
});

test("buildManifest lists only sitemap pages that exist on this host", () => {
  const dir = site({
    "sitemap.xml": sitemap("https://a.test/", "https://a.test/x/", "https://a.test/missing/", "https://b.test/y/"),
    "index.html": "<main>home</main>",
    "x/index.html": "<main>x</main>",
  });
  assert.deepStrictEqual(Object.keys(buildManifest(dir, "a.test")).sort(), [
    "https://a.test/",
    "https://a.test/x/",
  ]);
});

test("buildManifest of an empty sitemap is empty, so nothing is ever submitted", () => {
  const dir = site({ "sitemap.xml": "<urlset></urlset>" });
  assert.deepStrictEqual(buildManifest(dir, "a.test"), {});
});

test("findKey needs a 32-hex file name whose content is the same key", () => {
  const key = "0123456789abcdef0123456789abcdef";
  assert.strictEqual(findKey(site({ [`${key}.txt`]: key + "\n" })), key);
  assert.strictEqual(findKey(site({ [`${key}.txt`]: "something else" })), null);
  assert.strictEqual(findKey(site({ "robots.txt": "User-agent: *" })), null);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateRegistry, termToSource, readerActivity, ceilingCount, unlistedInRegistry
} = require("../lib/commented-photos.js");

const good = { path: "src/photos/a.md", since: "2026-11-10", ref: "https://github.com/o/r/discussions/1" };
const exists = () => true;

test("an empty registry and a sound entry are valid", () => {
  assert.deepEqual(validateRegistry({ photos: [] }, exists), []);
  assert.deepEqual(validateRegistry({ photos: [good] }, exists), []);
});

test("registry shape, path, date, ref, duplicates and missing files are refused", () => {
  assert.equal(validateRegistry(null, exists).length, 1);
  assert.equal(validateRegistry({}, exists).length, 1);
  assert.equal(validateRegistry({ photos: ["x"] }, exists).length, 1);
  assert.match(validateRegistry({ photos: [{ ...good, path: "photos/a.md" }] }, exists)[0], /src\/photos/);
  assert.match(validateRegistry({ photos: [{ ...good, since: "10/11/2026" }] }, exists)[0], /YYYY-MM-DD/);
  assert.match(validateRegistry({ photos: [{ ...good, since: "2026-13-45" }] }, exists)[0], /YYYY-MM-DD/);
  assert.match(validateRegistry({ photos: [{ ...good, ref: "http://x" }] }, exists)[0], /discussion/);
  assert.match(validateRegistry({ photos: [good, good] }, exists).join("\n"), /twice/);
  assert.match(validateRegistry({ photos: [good] }, () => false)[0], /does not exist/);
});

test("a giscus pathname term maps to its photo source, with or without the trailing slash", () => {
  const index = new Set(["src/photos/a.md"]);
  assert.equal(termToSource("photos/a/", index), "src/photos/a.md");
  assert.equal(termToSource("photos/a", index), "src/photos/a.md");
  assert.equal(termToSource("/photos/a/", index), "src/photos/a.md");
});

test("a title that is not a known photo page maps to nothing", () => {
  const index = new Set(["src/photos/a.md"]);
  assert.equal(termToSource("photos/missing/", index), null);
  assert.equal(termToSource("about/", index), null);
  assert.equal(termToSource("index", index), null);
  assert.equal(termToSource("photos/a/b/", index), null);
  assert.equal(termToSource(undefined, index), null);
});

const at = (login, created_at) => ({ user: { login }, created_at });

test("Dermot's own activity and bots do not count", () => {
  assert.equal(readerActivity([at("dermot-r-cochran", "2026-11-01T00:00:00Z")], [], []), null);
  assert.equal(readerActivity([at("giscus[bot]", "2026-11-01T00:00:00Z")], [], [at("dependabot[bot]", "2026-11-02T00:00:00Z")]), null);
  assert.equal(readerActivity([], [], []), null);
  assert.equal(readerActivity(undefined, undefined, undefined), null);
});

test("a reader's comment, reply or reaction counts, and the earliest wins", () => {
  assert.equal(readerActivity([at("reader", "2026-11-05T10:00:00Z")], [], []), "2026-11-05");
  assert.equal(readerActivity([], [at("reader", "2026-11-06T10:00:00Z")], []), "2026-11-06");
  assert.equal(readerActivity([at("dermot-r-cochran", "2026-11-01T00:00:00Z")], [], [at("reader", "2026-11-07T10:00:00Z")]), "2026-11-07");
  assert.equal(
    readerActivity([at("b", "2026-11-09T00:00:00Z")], [at("a", "2026-11-03T00:00:00Z")], [at("c", "2026-11-04T00:00:00Z")]),
    "2026-11-03"
  );
});

const page = (p, data = {}) => ({ path: `src/photos/${p}.md`, data });

test("the ceiling count leaves out unlisted, awarded and commented pages", () => {
  const pages = [
    page("plain"),
    page("unlisted", { unlisted: true }),
    page("award", { award: "First place" }),
    page("commented")
  ];
  assert.equal(ceilingCount(pages, new Set()), 2);
  assert.equal(ceilingCount(pages, new Set(["src/photos/commented.md"])), 1);
});

test("a registered page carrying unlisted: true is reported, an unregistered one is not", () => {
  const pages = [page("a", { unlisted: true }), page("b", { unlisted: true }), page("c")];
  assert.deepEqual(unlistedInRegistry(pages, new Set(["src/photos/a.md", "src/photos/c.md"])), ["src/photos/a.md"]);
  assert.deepEqual(unlistedInRegistry(pages, new Set()), []);
});

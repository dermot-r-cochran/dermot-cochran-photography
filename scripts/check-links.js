#!/usr/bin/env node
// Walks a built site and fails if any page points at an address on this site
// that the build did not write: a photo page that was renamed while a note
// still links to it, an image a template names and nothing copies, a sitemap
// entry with no page behind it. It reads `_site/` (or the directory given),
// so it runs after `npm run build`; the dry run in `npm test` writes nothing
// to walk. No network: links to other sites are not followed.
//
//   npm run build && npm run check-links
//   node scripts/check-links.js path/to/site

const fs = require("fs");
const path = require("path");
const { checkLinks } = require("../lib/links.js");

const siteDir = path.resolve(process.argv[2] || path.join(__dirname, "..", "_site"));
const siteOrigin = new URL(require("../src/_data/site.js")().url).origin;

if (!fs.existsSync(path.join(siteDir, "index.html"))) {
  console.error(`check-links: no built site at ${siteDir} - run \`npm run build\` first.`);
  process.exit(2);
}

const files = new Set();
(function walk(dir, prefix) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
    else files.add(rel);
  }
})(siteDir, "");

const pages = [...files]
  .filter((f) => f.endsWith(".html"))
  .sort()
  .map((file) => ({ file, html: fs.readFileSync(path.join(siteDir, file), "utf8") }));
const sitemap = files.has("sitemap.xml")
  ? fs.readFileSync(path.join(siteDir, "sitemap.xml"), "utf8")
  : null;

const problems = checkLinks({ pages, has: (f) => files.has(f), siteOrigin, sitemap });

for (const p of problems) {
  console.error(`FAIL  ${p.file}: ${p.attr}="${p.value}" - ${p.reason}`);
}
if (problems.length) {
  console.error(`Link walk failed: ${problems.length} broken internal reference(s) across ${pages.length} pages.`);
  process.exit(1);
}
console.log(`Link walk passed (${pages.length} pages, ${files.size} files, every internal reference resolves).`);

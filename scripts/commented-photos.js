#!/usr/bin/env node
// Finds photo pages whose giscus discussion has drawn a reader (anyone but the
// owner and bots) and adds them to lib/commented-photos.json. Dry run by
// default; `--write` appends. Local/maintenance tool, not part of `npm test`.
// Reads the public REST API; GITHUB_TOKEN is used if set (higher rate limit).
//
// Limit worth knowing: the REST API lists who wrote comments and replies, but
// not who reacted to a discussion or a comment. Reactions are attempted where
// an endpoint answers and reported as unavailable where it does not, so a
// reaction-only reader may be missed; GraphQL with a token would see them.
const fs = require("fs");
const path = require("path");
const { validateRegistry, termToSource, readerActivity } = require("../lib/commented-photos.js");

const ROOT = path.join(__dirname, "..");
const REGISTRY = path.join(ROOT, "lib", "commented-photos.json");
const REPO = "dermot-r-cochran/dermot-cochran-photography";
const API = `https://api.github.com/repos/${REPO}`;

async function get(url) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "commented-photos" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function paged(url) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await get(`${url}${url.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    if (batch === null) return null;
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

async function main() {
  const write = process.argv.includes("--write");
  const registry = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  const known = new Set(registry.photos.map((p) => p.path));
  const index = new Set(
    fs.readdirSync(path.join(ROOT, "src", "photos")).filter((f) => f.endsWith(".md")).map((f) => `src/photos/${f}`)
  );

  const discussions = (await paged(`${API}/discussions`)) || [];
  const toAdd = [];
  const unmapped = [];
  let reactionsUnavailable = false;
  for (const d of discussions) {
    const src = termToSource(d.title, index);
    if (!src) { unmapped.push(d.title); continue; }
    if (known.has(src)) continue;
    const comments = (await paged(`${API}/discussions/${d.number}/comments`)) || [];
    const replies = [];
    const reactions = [];
    for (const c of comments) {
      const r = await paged(`${API}/discussions/${d.number}/comments/${c.id}/replies`);
      if (r) replies.push(...r);
      const rx = await paged(`${API}/discussions/${d.number}/comments/${c.id}/reactions`);
      if (rx === null) reactionsUnavailable = true; else reactions.push(...rx);
    }
    const since = readerActivity(comments, replies, reactions);
    if (since) toAdd.push({ path: src, since, ref: d.html_url });
  }

  console.log(`${discussions.length} discussion(s) read; ${registry.photos.length} already registered.`);
  if (reactionsUnavailable) console.log("NOTE: the REST API exposed no reactions endpoint; reaction-only readers are not seen.");
  for (const t of unmapped) console.log(`UNMAPPED title (not a photo page): ${JSON.stringify(t)}`);
  if (!toAdd.length) { console.log("Nothing to add."); return; }
  for (const e of toAdd) console.log(`${write ? "ADD" : "WOULD ADD"}  ${e.path}  since ${e.since}  ${e.ref}`);
  if (write) {
    registry.photos.push(...toAdd);
    const errors = validateRegistry(registry, (p) => fs.existsSync(path.join(ROOT, p)));
    if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
    fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2) + "\n");
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });

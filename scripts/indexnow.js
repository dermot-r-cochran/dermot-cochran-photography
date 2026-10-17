#!/usr/bin/env node
// IndexNow: tell Bing (and the other engines that share IndexNow) which pages
// changed in a deploy, instead of waiting for them to be recrawled.
//
// SHARED, BYTE-IDENTICAL FILE: the same scripts/indexnow.js lives in
// star-rangers and dermot-cochran-photography. Change it in both.
//
// Two steps, because the list must be worked out before the upload and sent
// after it (an engine told about a page before the page is live fetches the
// old one):
//
//   node scripts/indexnow.js prepare --site _site --host example.com \
//        --previous <file-or-url> --out <pending.json>
//     Reads _site/sitemap.xml, hashes each listed page's <main> (so a footer
//     version stamp does not mark every page changed), writes the new
//     _site/indexnow-manifest.json for the next deploy to compare against,
//     and writes the URLs that are new, changed or gone since the previous
//     manifest to <pending.json>. With no previous manifest (the first deploy)
//     every sitemap URL is pending. An empty sitemap (a SITE_NOINDEX build, or
//     a non-ranking edition) means nothing is ever submitted.
//
//   node scripts/indexnow.js submit <pending.json>
//     POSTs the list to api.indexnow.org in batches of 10,000.
//
// The key is the one file in _site whose name is 32 hex characters plus .txt
// and whose content is that name (src/static/indexnow/<key>.txt), served at the
// site root as the protocol asks; the same key serves every host.
//
// Neither step ever fails a deploy: every problem prints an "indexnow:" line
// and exits 0. Search engines recrawl anyway; IndexNow only makes it sooner.
// No dependencies beyond Node 20 (global fetch).

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MANIFEST = "indexnow-manifest.json";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const BATCH = 10000;
const KEY_NAME = /^([0-9a-f]{32})\.txt$/;

function log(msg) {
  console.log(`indexnow: ${msg}`);
}

function sitemapLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) locs.push(m[1].replace(/&amp;/g, "&"));
  return locs;
}

// A sitemap URL to the file that serves it: /a/b/ -> a/b/index.html,
// /a/b.html -> a/b.html. Returns null for a URL on another host.
function fileForUrl(siteDir, url, host) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.host !== host) return null;
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/")) p += "index.html";
  return path.join(siteDir, ...p.split("/").filter(Boolean));
}

// Hash only what a reader would call the page: the <main> element when there
// is one, so build stamps in <head> and the footer do not count as changes.
function pageHash(html) {
  const start = html.search(/<main[\s>]/i);
  const end = html.toLowerCase().lastIndexOf("</main>");
  const body = start >= 0 && end > start ? html.slice(start, end) : html;
  return crypto.createHash("sha1").update(body).digest("hex");
}

function buildManifest(siteDir, host) {
  const sitemap = path.join(siteDir, "sitemap.xml");
  if (!fs.existsSync(sitemap)) return {};
  const urls = {};
  for (const loc of sitemapLocs(fs.readFileSync(sitemap, "utf8"))) {
    const file = fileForUrl(siteDir, loc, host);
    if (!file || !fs.existsSync(file)) continue;
    urls[loc] = pageHash(fs.readFileSync(file, "utf8"));
  }
  return urls;
}

// URLs to submit: new or changed pages, and pages the previous deploy listed
// that this one does not (the engine recrawls them and finds the 404 or the
// redirect). previous === null means there was no earlier manifest.
function pendingUrls(previous, current) {
  if (previous === null) return Object.keys(current);
  const out = [];
  for (const [url, hash] of Object.entries(current)) {
    if (previous[url] !== hash) out.push(url);
  }
  for (const url of Object.keys(previous)) {
    if (!(url in current)) out.push(url);
  }
  return out;
}

function findKey(siteDir) {
  for (const name of fs.readdirSync(siteDir)) {
    const m = KEY_NAME.exec(name);
    if (!m) continue;
    const content = fs.readFileSync(path.join(siteDir, name), "utf8").trim();
    if (content === m[1]) return m[1];
  }
  return null;
}

async function readPrevious(source) {
  if (!source) return null;
  try {
    let text;
    if (/^https?:\/\//.test(source)) {
      const res = await fetch(source, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return null;
      text = await res.text();
    } else {
      if (!fs.existsSync(source)) return null;
      text = fs.readFileSync(source, "utf8");
    }
    const data = JSON.parse(text);
    return data && typeof data.urls === "object" ? data.urls : null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

async function prepare(args) {
  const siteDir = args.site;
  const host = args.host;
  if (!siteDir || !host || !args.out) {
    log("prepare needs --site, --host and --out; skipped");
    return;
  }
  const key = findKey(siteDir);
  if (!key) {
    log(`no key file in ${siteDir}; skipped`);
    return;
  }
  const current = buildManifest(siteDir, host);
  fs.writeFileSync(
    path.join(siteDir, MANIFEST),
    JSON.stringify({ host, urls: current }) + "\n"
  );
  const previous = await readPrevious(args.previous);
  const urlList = pendingUrls(previous, current);
  fs.writeFileSync(args.out, JSON.stringify({ host, key, urlList }) + "\n");
  log(
    `${host}: ${Object.keys(current).length} sitemap URLs, ${urlList.length} to submit` +
      (previous === null ? " (no previous manifest: first submission)" : "")
  );
}

async function submit(file) {
  if (!file || !fs.existsSync(file)) {
    log("nothing pending; skipped");
    return;
  }
  const { host, key, urlList } = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!urlList || urlList.length === 0) {
    log(`${host}: no changed URLs; nothing submitted`);
    return;
  }
  const keyLocation = `https://${host}/${key}.txt`;
  // The engines fetch the key file to check a submission, and a Pages deploy
  // can report success a little before the CDN serves the new file: the first
  // live run (17 Oct 2026) was refused with HTTP 403 for exactly that reason,
  // and the same list was accepted minutes later. So wait for the key first,
  // and retry a 403 once.
  if (!(await waitForKey(keyLocation, key))) {
    log(`${host}: key file not reachable at ${keyLocation}; nothing submitted`);
    return;
  }
  for (let i = 0; i < urlList.length; i += BATCH) {
    const batch = urlList.slice(i, i + BATCH);
    const body = JSON.stringify({ host, key, keyLocation, urlList: batch });
    try {
      let status = await post(body);
      if (status === 403) {
        await sleep(RETRY_MS);
        status = await post(body);
      }
      log(`${host}: submitted ${batch.length} URLs, HTTP ${status}`);
    } catch (err) {
      log(`${host}: submission failed (${err.message}); the next deploy's diff will not resend these`);
    }
  }
}

const RETRY_MS = 60000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(body) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body,
    signal: AbortSignal.timeout(30000),
  });
  return res.status;
}

// Poll the live key file for up to about three minutes.
async function waitForKey(url, key, tries = 12, gapMs = 15000) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (res.ok && (await res.text()).trim() === key) return true;
    } catch {
      // not reachable yet
    }
    if (i < tries - 1) await sleep(gapMs);
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (cmd === "prepare") await prepare(args);
  else if (cmd === "submit") await submit(args._[1]);
  else log("usage: indexnow.js prepare|submit ... (see the header)");
}

if (require.main === module) {
  main().catch((err) => log(`unexpected error (${err.message}); skipped`));
}

module.exports = { sitemapLocs, fileForUrl, pageHash, buildManifest, pendingUrls, findKey };

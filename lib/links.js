// The internal-link walk: every address a built page points at on this site
// must be a file the build wrote. Pure functions over strings, so they are
// testable without a build; scripts/check-links.js feeds them `_site/`.
//
// What counts as a reference: href, src, data-src (the slideshow's lazy
// slides), poster and srcset attributes, the og:/twitter: image and url
// metas, and the sitemap's <loc> and <image:loc> entries. Anything on another
// host is not followed - this check needs no network and cannot flake.

const REF_ATTRS = ["href", "src", "data-src", "poster"];
const META_URL_KEYS = new Set(["og:image", "og:url", "twitter:image"]);

// Scripts and comments hold text that looks like markup but is not a link.
function stripNonMarkup(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) => tag.slice(0, tag.indexOf(">") + 1) + "</script>")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

function decodeEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attributes(tag) {
  const attrs = {};
  const re = /([^\s"'<>\/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag)) !== null) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

// Every reference a page makes, as written. Returns [{ attr, value }].
function extractRefs(html) {
  const refs = [];
  const tags = stripNonMarkup(html).match(/<[a-zA-Z][^>]*>/g) || [];
  for (const tag of tags) {
    const attrs = attributes(tag);
    for (const attr of REF_ATTRS) {
      if (attrs[attr] !== undefined) refs.push({ attr, value: attrs[attr].trim() });
    }
    if (attrs.srcset !== undefined) {
      for (const candidate of attrs.srcset.split(",")) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url) refs.push({ attr: "srcset", value: url });
      }
    }
    if (/^<meta\b/i.test(tag) && attrs.content !== undefined) {
      const key = (attrs.property || attrs.name || "").toLowerCase();
      if (META_URL_KEYS.has(key)) refs.push({ attr: key, value: attrs.content.trim() });
    }
  }
  return refs;
}

// The anchors a page offers: every id, and the legacy <a name>.
function extractIds(html) {
  const ids = new Set();
  const tags = stripNonMarkup(html).match(/<[a-zA-Z][^>]*>/g) || [];
  for (const tag of tags) {
    const attrs = attributes(tag);
    if (attrs.id) ids.add(attrs.id);
    if (/^<a\b/i.test(tag) && attrs.name) ids.add(attrs.name);
  }
  return ids;
}

// <loc> and <image:loc> entries of a sitemap, as [{ attr, value }].
function extractSitemapRefs(xml) {
  const refs = [];
  const re = /<((?:image:)?loc)>([^<]*)<\/\1>/g;
  let m;
  while ((m = re.exec(String(xml))) !== null) {
    refs.push({ attr: m[1], value: decodeEntities(m[2].trim()) });
  }
  return refs;
}

// Where a reference leads. `pageUrl` is the page's own path ("/photos/x/"),
// `siteOrigin` the origin this build calls home ("https://dermotcochran.com").
// Returns { kind: "skip" | "external" | "invalid" | "internal", path, fragment }.
function resolveRef(value, pageUrl, siteOrigin) {
  if (value === "") return { kind: "invalid" };
  if (/^(mailto|tel|data|javascript|sms):/i.test(value)) return { kind: "skip" };
  let url;
  try {
    url = new URL(value, new URL(pageUrl, siteOrigin));
  } catch (err) {
    return { kind: "invalid" };
  }
  if (url.origin !== new URL(siteOrigin).origin) return { kind: "external" };
  let path;
  try {
    path = decodeURIComponent(url.pathname);
  } catch (err) {
    return { kind: "invalid" };
  }
  let fragment = url.hash.replace(/^#/, "");
  try {
    fragment = decodeURIComponent(fragment);
  } catch (err) {
    // leave it as written
  }
  return { kind: "internal", path, fragment };
}

// The built files that would answer a path, in the order a server tries them.
// "/photos/x/" is its index.html; "/photos/x" is a file of that name or, by
// the server's own redirect, the directory's index.
function candidateFiles(path) {
  const rel = path.replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) return [rel + "index.html"];
  return [rel, rel + "/index.html"];
}

// The page path a built file is served at: "photos/x/index.html" -> "/photos/x/".
function urlOfFile(file) {
  const rel = file.replace(/\\/g, "/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return "/" + rel.slice(0, -"index.html".length);
  return "/" + rel;
}

// Walk a built site. `pages` is [{ file, html }] (file relative to the site
// root, forward slashes), `has(file)` says whether the build wrote a file,
// `sitemap` is the sitemap's text if there is one. Returns the broken
// references as [{ file, attr, value, reason }], in page order.
function checkLinks({ pages, has, siteOrigin, sitemap }) {
  const problems = [];
  const idsByFile = new Map(pages.map((p) => [p.file, null]));
  const htmlByFile = new Map(pages.map((p) => [p.file, p.html]));
  const idsOf = (file) => {
    if (idsByFile.get(file) === null) idsByFile.set(file, extractIds(htmlByFile.get(file)));
    return idsByFile.get(file);
  };

  const check = (file, pageUrl, ref) => {
    const target = resolveRef(ref.value, pageUrl, siteOrigin);
    if (target.kind === "skip" || target.kind === "external") return;
    if (target.kind === "invalid") {
      problems.push({ file, ...ref, reason: "empty or unreadable address" });
      return;
    }
    const found = candidateFiles(target.path).find((f) => has(f));
    if (!found) {
      problems.push({ file, ...ref, reason: `no built file at ${target.path}` });
      return;
    }
    if (target.fragment && idsByFile.has(found) && !idsOf(found).has(target.fragment)) {
      problems.push({ file, ...ref, reason: `no id "${target.fragment}" on ${urlOfFile(found)}` });
    }
  };

  for (const page of pages) {
    const pageUrl = urlOfFile(page.file);
    for (const ref of extractRefs(page.html)) check(page.file, pageUrl, ref);
  }
  if (sitemap !== undefined && sitemap !== null) {
    for (const ref of extractSitemapRefs(sitemap)) check("sitemap.xml", "/sitemap.xml", ref);
  }
  return problems;
}

// Does a built page ask search engines to leave it out? That is how an
// `unlisted: true` photo page is told apart in the built site (base.njk).
function isNoindex(html) {
  const tags = stripNonMarkup(html).match(/<meta\b[^>]*>/gi) || [];
  return tags.some((tag) => {
    const attrs = attributes(tag);
    return (attrs.name || "").toLowerCase() === "robots" && /\bnoindex\b/i.test(attrs.content || "");
  });
}

// A photo's own page: "photos/<slug>/index.html".
function isPhotoPage(file) {
  return /^photos\/[^/]+\/index\.html$/.test(file);
}

// The listing walk: what an unlisted page promises, read off the built site.
// Same inputs as checkLinks, same shape of result. Two things are wrong
// whenever they appear:
//   - the sitemap names a page that carries noindex;
//   - a page that is not a photo's own page links to a noindex page - an
//     unlisted photo is in no gallery, archive, subject page or slideshow.
// A photo's own page is left alone, because a note on another photograph may
// link to an unlisted one; so a link from a photo page's other markup is not
// seen here.
function checkListing({ pages, has, siteOrigin, sitemap }) {
  const problems = [];
  const hidden = new Set(pages.filter((p) => isNoindex(p.html)).map((p) => p.file));
  const pageFiles = new Set(pages.map((p) => p.file));
  const landing = (value, pageUrl) => {
    const target = resolveRef(value, pageUrl, siteOrigin);
    if (target.kind !== "internal") return undefined;
    const found = candidateFiles(target.path).find((f) => has(f));
    return found !== undefined && pageFiles.has(found) ? found : undefined;
  };

  for (const page of pages) {
    if (hidden.has(page.file) || isPhotoPage(page.file)) continue;
    const pageUrl = urlOfFile(page.file);
    for (const ref of extractRefs(page.html)) {
      if (ref.attr !== "href") continue;
      const found = landing(ref.value, pageUrl);
      if (found !== undefined && hidden.has(found)) {
        problems.push({ file: page.file, ...ref, reason: `links to ${urlOfFile(found)}, which is unlisted (noindex)` });
      }
    }
  }

  if (sitemap !== undefined && sitemap !== null) {
    for (const ref of extractSitemapRefs(sitemap)) {
      if (ref.attr !== "loc") continue;
      const found = landing(ref.value, "/sitemap.xml");
      if (found !== undefined && hidden.has(found)) {
        problems.push({ file: "sitemap.xml", ...ref, reason: "the sitemap names an unlisted (noindex) page" });
      }
    }
  }
  return problems;
}

module.exports = {
  isNoindex,
  checkListing,
  extractRefs,
  extractIds,
  extractSitemapRefs,
  resolveRef,
  candidateFiles,
  urlOfFile,
  checkLinks,
};

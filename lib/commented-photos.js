// Photos whose pages have drawn a reader's comment (Dermot's rule,
// 10 November 2026): such a photo is never unlisted and no longer counts
// toward the soft ceiling of about 200 listed photographs, the same treatment
// an award winner gets. The registry in commented-photos.json is append-only:
// an entry is a fact about the past (someone did comment), so it is never
// removed even if the discussion later is.
//
// Pure functions only, so they are tested without the network or the build.

const OWNER_LOGIN = "dermot-r-cochran";
const SOFT_CEILING = 200;
const PHOTO_PATH = /^src\/photos\/[^/]+\.md$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Returns a list of problem strings; empty means the registry is sound.
// `fileExists` is injected so the check needs no filesystem in tests.
function validateRegistry(obj, fileExists) {
  const errors = [];
  if (obj === null || typeof obj !== "object" || !Array.isArray(obj.photos)) {
    return ["registry must be an object with a `photos` array"];
  }
  const seen = new Set();
  obj.photos.forEach((entry, i) => {
    const where = `entry ${i}`;
    if (entry === null || typeof entry !== "object") {
      errors.push(`${where}: must be an object {path, since, ref}`);
      return;
    }
    if (typeof entry.path !== "string" || !PHOTO_PATH.test(entry.path)) {
      errors.push(`${where}: path ${JSON.stringify(entry.path)} must look like src/photos/<slug>.md`);
    } else {
      if (seen.has(entry.path)) errors.push(`${where}: ${entry.path} is listed twice`);
      seen.add(entry.path);
      if (!fileExists(entry.path)) errors.push(`${where}: ${entry.path} does not exist - pages are never removed or renamed, so a missing file is an error`);
    }
    if (typeof entry.since !== "string" || !ISO_DATE.test(entry.since) || Number.isNaN(Date.parse(entry.since))) {
      errors.push(`${where}: since ${JSON.stringify(entry.since)} must be a YYYY-MM-DD date`);
    }
    if (typeof entry.ref !== "string" || !/^https:\/\/github\.com\//.test(entry.ref)) {
      errors.push(`${where}: ref ${JSON.stringify(entry.ref)} must be the discussion's https://github.com/ URL`);
    }
  });
  return errors;
}

// Maps a giscus discussion title to the photo source file it belongs to.
// The title is the page's pathname, which giscus forms in client.ts as
//   location.pathname.substring(1).replace(/\.\w+$/, '')
// (github.com/giscus/giscus, client.ts line 77, data-mapping="pathname").
// Photo pages are written by Eleventy at /photos/<slug>/ (no permalink in
// src/photos), so the term is "photos/<slug>/" with its trailing slash; the
// slash is tolerated either way here. `index` is a Set of known source paths.
// Returns the source path, or null for a title that is not a photo page.
function termToSource(term, index) {
  if (typeof term !== "string") return null;
  const m = /^\/?photos\/([^/]+)\/?$/.exec(term.trim());
  if (!m) return null;
  const candidate = `src/photos/${m[1]}.md`;
  return index.has(candidate) ? candidate : null;
}

function qualifies(login) {
  if (typeof login !== "string" || login === "") return false;
  if (login.toLowerCase() === OWNER_LOGIN) return false;
  if (login.toLowerCase().endsWith("[bot]")) return false;
  return true;
}

// Each argument is an array of GitHub objects: {user: {login}, created_at}.
// Returns the earliest qualifying YYYY-MM-DD, or null if only Dermot and bots
// have been there.
function readerActivity(comments, replies, reactions) {
  let earliest = null;
  for (const item of [...(comments || []), ...(replies || []), ...(reactions || [])]) {
    if (!item || !item.user || !qualifies(item.user.login)) continue;
    const t = Date.parse(item.created_at);
    if (Number.isNaN(t)) continue;
    if (earliest === null || t < earliest) earliest = t;
  }
  return earliest === null ? null : new Date(earliest).toISOString().slice(0, 10);
}

// Listed pages that count toward the soft ceiling: not unlisted, no award, not
// in the registry. `pages` is [{path, data}] with gray-matter front matter.
function ceilingCount(pages, registryPaths) {
  return pages.filter(({ path, data }) =>
    data.unlisted !== true && data.award === undefined && !registryPaths.has(path)
  ).length;
}

// Registry pages that carry `unlisted: true` - always a failure.
function unlistedInRegistry(pages, registryPaths) {
  return pages.filter(({ path, data }) => registryPaths.has(path) && data.unlisted === true).map((p) => p.path);
}

module.exports = {
  OWNER_LOGIN,
  SOFT_CEILING,
  validateRegistry,
  termToSource,
  readerActivity,
  ceilingCount,
  unlistedInRegistry
};

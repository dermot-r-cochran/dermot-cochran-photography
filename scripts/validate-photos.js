#!/usr/bin/env node
// Front-matter validation for src/photos/*.md - the checks `eleventy --dryrun`
// structurally cannot do. The dry run proves the templates render; it does not
// prove a photo carries the fields the archive pages group by, that a
// `competitions:` tag is spelled from the real vocabulary (a typo'd IPF-Nature
// silently misfiles a plant on /wild-or-cultivated/), that `image:` points at
// a file that exists, or that two photos don't claim the same `order` slot
// (the homepage slideshow picks "newest" by order, so a collision makes that
// pick arbitrary).
//
// Failures exit non-zero and are for states that are always wrong. Warnings
// print and pass: a Landscape/Documentary/Creative photo with no `setting:`
// is a judgement not yet made, and CLAUDE.md records that showing as absence
// on /natural-or-built/ is deliberate - so it is surfaced, never enforced.
//
// gray-matter is the same front-matter parser Eleventy itself uses, so what
// validates here is what the build will see (BOM handling included - three
// photo files carry a UTF-8 BOM today and are valid).
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const ROOT = path.join(__dirname, "..");
const PHOTOS_DIR = path.join(ROOT, "src", "photos");
const IMAGES_DIR = path.join(ROOT, "src", "images", "photos");

// The vocabulary the site actually uses - see CLAUDE.md's "Category rules"
// and "Competition eligibility tagging". A new category or competition is a
// deliberate decision; add it here in the same change that introduces it.
const CATEGORIES = new Set([
  "Wildlife",
  "Urban Wildlife",
  "Landscape",
  "Architecture",
  "Nature",
  "Macro",
  "Documentary",
  "Creative"
]);
const COMPETITIONS = new Set(["DCC", "WNPA", "IPF-Nature", "IPF-Wildlife"]);
const SETTINGS = new Set(["Natural", "Altered", "Built", "Mixed"]);
// The categories .eleventy.js's naturalOrBuilt cannot derive a setting for.
const SETTING_NEEDED = new Set(["Landscape", "Documentary", "Creative"]);
const REQUIRED = ["layout", "title", "category", "location", "year", "album", "image", "alt", "order"];

const failures = [];
const warnings = [];

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

const files = fs
  .readdirSync(PHOTOS_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort();

const ordersSeen = new Map(); // order value -> first file claiming it
const imagesSeen = new Map(); // image filename -> first file referencing it

for (const file of files) {
  let data;
  try {
    ({ data } = matter(fs.readFileSync(path.join(PHOTOS_DIR, file), "utf8")));
  } catch (err) {
    fail(file, `front matter does not parse: ${err.message}`);
    continue;
  }

  for (const field of REQUIRED) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      fail(file, `missing required field \`${field}\``);
    }
  }

  if (data.layout !== undefined && data.layout !== "photo.njk") {
    fail(file, `layout is "${data.layout}", expected "photo.njk"`);
  }

  if (data.category !== undefined && !CATEGORIES.has(data.category)) {
    fail(file, `unknown category "${data.category}" - the categories in use are: ${[...CATEGORIES].join(", ")}`);
  }

  if (data.year !== undefined && (!Number.isInteger(data.year) || data.year < 1900 || data.year > 2100)) {
    fail(file, `year "${data.year}" is not a plausible integer year`);
  }

  if (data.order !== undefined) {
    if (!Number.isInteger(data.order) || data.order < 0) {
      fail(file, `order "${data.order}" is not a non-negative integer`);
    } else if (ordersSeen.has(data.order)) {
      fail(file, `order ${data.order} is already claimed by ${ordersSeen.get(data.order)} - the homepage picks "newest" by order, so a collision makes that pick arbitrary`);
    } else {
      ordersSeen.set(data.order, file);
    }
  }

  // `competitions` must always be present, possibly as an empty list -
  // "eligible for nothing" is itself an evaluation (CLAUDE.md), and an absent
  // key is indistinguishable from a photo nobody assessed.
  if (data.competitions === undefined) {
    fail(file, "missing `competitions:` - use an empty list [] for a photo eligible for nothing");
  } else if (!Array.isArray(data.competitions)) {
    fail(file, "`competitions:` must be a list, e.g. [DCC, WNPA]");
  } else {
    for (const tag of data.competitions) {
      if (!COMPETITIONS.has(tag)) {
        fail(file, `unknown competitions tag "${tag}" - known tags: ${[...COMPETITIONS].join(", ")}. A typo here silently misfiles the photo on /wild-or-cultivated/ and /natural-or-built/`);
      }
    }
    if (new Set(data.competitions).size !== data.competitions.length) {
      fail(file, "duplicate entries in `competitions:`");
    }
  }

  // An invalid `setting:` is worse than a missing one - naturalOrBuilt
  // returns null for it, so the typo reads back as a deliberate absence.
  if (data.setting !== undefined && !SETTINGS.has(data.setting)) {
    fail(file, `unknown setting "${data.setting}" - must be one of: ${[...SETTINGS].join(", ")}`);
  }
  if (
    data.setting === undefined &&
    SETTING_NEEDED.has(data.category) &&
    !(Array.isArray(data.competitions) && data.competitions.includes("IPF-Nature"))
  ) {
    warnings.push(`${file}: no \`setting:\` and none derivable - will not appear on /natural-or-built/ (deliberate if the judgement is unmade; add setting: Natural | Altered | Built | Mixed to place it)`);
  }

  if (typeof data.image === "string" && data.image) {
    // .jpg only until the pipeline is verified for anything else - CLAUDE.md's
    // GIF rule: before the first .gif, check the image: field, the Eleventy
    // passthrough and photo.njk actually carry it, then widen this check in
    // the same change.
    if (!/\.jpe?g$/i.test(data.image)) {
      fail(file, `image "${data.image}" is not a .jpg - the pipeline is only verified for JPEG (see CLAUDE.md's GIF note before widening this)`);
    }
    if (!fs.existsSync(path.join(IMAGES_DIR, data.image))) {
      fail(file, `image "${data.image}" not found in src/images/photos/`);
    }
    if (imagesSeen.has(data.image)) {
      fail(file, `image "${data.image}" is already used by ${imagesSeen.get(data.image)} - the no-duplicates rule: publish the combination or the best single frame, not both`);
    } else {
      imagesSeen.set(data.image, file);
    }
  }
}

// The inverse check: a file on disk no photo references is either an upload
// whose .md was forgotten (the photo silently isn't on the site) or a
// leftover from a rename (dead weight every deploy rsyncs forever).
for (const img of fs.readdirSync(IMAGES_DIR).sort()) {
  if (!imagesSeen.has(img)) {
    fail(`src/images/photos/${img}`, "not referenced by any photo page - add the missing src/photos/*.md or remove the file");
  }
}

for (const w of warnings) console.warn(`WARN  ${w}`);
if (failures.length) {
  for (const f of failures) console.error(`FAIL  ${f}`);
  console.error(`\nPhoto validation failed: ${failures.length} problem(s) across ${files.length} photos.`);
  process.exit(1);
}
console.log(`Photo validation passed (${files.length} photos, ${imagesSeen.size} images${warnings.length ? `, ${warnings.length} warning(s)` : ""}).`);

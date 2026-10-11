// Multi-panel pictures stacked on a phone (added 11 October 2026).
//
// A three-panel strip such as *Keeping Pace* (1600×367) is shown at the full
// width of the screen, so on a phone held upright each panel shrinks to about
// 117×80 px and the subject goes with it. A page that declares `panels:` in
// front matter gets a second rendering of the same JPEG beneath the strip,
// cut into one slice per panel and stacked; CSS shows the slices only on a
// narrow screen and the strip everywhere else. No second image file exists,
// so the validator's file checks and the page's URL are untouched.
//
// The panels are assumed equal in size, laid out left to right with an equal
// gutter between them and an optional frame of equal width all round, which
// is how every panel picture on the site is built. Each slice is a box with
// the panel's aspect ratio holding the whole image, enlarged and shifted so
// only that panel shows; every offset is a percentage of the box's width (CSS
// resolves margin percentages, top and left alike, against the containing
// block's width), so the geometry holds at any screen size.
//
// Pure functions only: the build and the validator read the file and pass
// the bytes in, so the arithmetic is testable without either.

// Width and height from a baseline or progressive JPEG's SOF marker, or null
// when the bytes are not a JPEG this can read. Null rather than a guess: a
// wrong size would cut every slice in the wrong place without any error.
function jpegSize(buf) {
  if (!buf || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xff) { i += 1; continue; } // fill byte
    const len = buf.readUInt16BE(i + 2);
    // SOF0-SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

// The front-matter value, normalised: `panels: 3` or
// `panels: { count: 3, gutter: 12, border: 0 }`, gutter and border in source
// pixels and defaulting to 0. Returns { spec } or { error }, so the validator
// can say what is wrong and the build can refuse to guess.
function readPanelSpec(value) {
  const spec = typeof value === "number" ? { count: value } : value;
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return { error: "must be a panel count, or { count, gutter, border }" };
  }
  const unknown = Object.keys(spec).filter((k) => !["count", "gutter", "border"].includes(k));
  if (unknown.length) return { error: `unknown key(s) ${unknown.join(", ")} - only count, gutter and border` };
  const { count, gutter = 0, border = 0 } = spec;
  if (!Number.isInteger(count) || count < 2) return { error: `count ${JSON.stringify(count)} must be an integer of 2 or more` };
  if (!Number.isInteger(gutter) || gutter < 0) return { error: `gutter ${JSON.stringify(gutter)} must be a non-negative integer (source pixels)` };
  if (!Number.isInteger(border) || border < 0) return { error: `border ${JSON.stringify(border)} must be a non-negative integer (source pixels)` };
  return { spec: { count, gutter, border } };
}

// One entry per panel, left to right: the slice box's aspect ratio and the
// image's width and offsets as percentages of the box width. Throws when the
// numbers cannot describe equal whole-pixel panels in this image, because a
// gutter or border mistyped by a few pixels would otherwise cut every panel
// slightly off its edge, which no build step would notice.
const EDGE_TRIM = 1;

function panelSlices(size, spec) {
  const { width: W, height: H } = size;
  const { count: n, gutter: g, border: b } = spec;
  const p = (W - 2 * b - (n - 1) * g) / n;
  const h = H - 2 * b;
  if (!Number.isInteger(p) || p <= 0 || h <= 0) {
    throw new Error(
      `${n} panels with gutter ${g} and border ${b} do not divide a ${W}×${H} image into equal whole-pixel panels (panel width would be ${p})`
    );
  }
  // Each slice stays EDGE_TRIM source pixels inside its panel on every side.
  // JPEG compression leaves a half-tone row where a panel meets a pale frame
  // or gutter, and a browser scaling the image down blends that row into the
  // slice's edge as a faint line; one pixel clears it, with nothing in the
  // picture lost that anyone would see.
  const t = p > 2 * EDGE_TRIM && h > 2 * EDGE_TRIM ? EDGE_TRIM : 0;
  const w = p - 2 * t;
  const pct = (v) => +(v * 100).toFixed(4);
  return Array.from({ length: n }, (_, i) => ({
    aspect: `${w} / ${h - 2 * t}`,
    width: pct(W / w),
    left: pct(-(b + i * (p + g) + t) / w),
    top: pct(-(b + t) / w)
  }));
}

module.exports = { jpegSize, readPanelSpec, panelSlices, EDGE_TRIM };

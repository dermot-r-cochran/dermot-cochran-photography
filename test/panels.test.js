// Unit tests for lib/panels.js - the slice geometry that stacks a panel
// picture on a phone. A wrong offset cuts a panel off its edge with no build
// failure, so the arithmetic is pinned here against the two real pictures.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { jpegSize, readPanelSpec, panelSlices, EDGE_TRIM } = require("../lib/panels.js");

const image = (name) => fs.readFileSync(path.join(__dirname, "..", "src", "images", "photos", name));

// SOI, an APP0 segment to skip, then a baseline SOF0 for a 300×200 frame.
const tinyJpeg = Buffer.from([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0xc8, 0x01, 0x2c, 0x01, 0x01, 0x11, 0x00
]);

test("jpegSize reads the frame size past other segments", () => {
  assert.deepEqual(jpegSize(tinyJpeg), { width: 300, height: 200 });
});

test("jpegSize returns null rather than guessing on non-JPEG bytes", () => {
  assert.equal(jpegSize(Buffer.from("not a jpeg at all")), null);
  assert.equal(jpegSize(Buffer.alloc(0)), null);
  assert.equal(jpegSize(null), null);
});

test("jpegSize matches the real panel pictures", () => {
  assert.deepEqual(jpegSize(image("keeping-pace.jpg")), { width: 1600, height: 367 });
  assert.deepEqual(jpegSize(image("three-ways-to-dry.jpg")), { width: 1599, height: 453 });
});

test("readPanelSpec accepts a bare count and fills the defaults", () => {
  assert.deepEqual(readPanelSpec(3), { spec: { count: 3, gutter: 0, border: 0 } });
  assert.deepEqual(readPanelSpec({ count: 3, gutter: 12 }), { spec: { count: 3, gutter: 12, border: 0 } });
});

test("readPanelSpec refuses shapes an author could not mean", () => {
  for (const bad of [1, 2.5, "3", true, [3], null, { count: 3, gap: 10 }, { count: 3, gutter: -1 }, { gutter: 10 }]) {
    assert.ok(readPanelSpec(bad).error, `expected an error for ${JSON.stringify(bad)}`);
  }
});

test("panelSlices cuts Keeping Pace inside its frame and gutters", () => {
  // 10 px frame, 10 px gutters, three 520×347 panels; each slice stays one
  // pixel inside its panel, so 518×345 starting at x = 11, 541, 1071, y = 11.
  const slices = panelSlices({ width: 1600, height: 367 }, { count: 3, gutter: 10, border: 10 });
  assert.equal(EDGE_TRIM, 1);
  assert.equal(slices.length, 3);
  for (const s of slices) {
    assert.equal(s.aspect, "518 / 345");
    assert.equal(s.width, +(1600 / 518 * 100).toFixed(4));
    assert.equal(s.top, +(-11 / 518 * 100).toFixed(4));
  }
  assert.deepEqual(slices.map((s) => s.left), [11, 541, 1071].map((x) => +(-x / 518 * 100).toFixed(4)));
});

test("panelSlices cuts Three Ways to Dry inside its gutters, no frame", () => {
  const slices = panelSlices({ width: 1599, height: 453 }, { count: 3, gutter: 12, border: 0 });
  assert.deepEqual(slices.map((s) => s.aspect), ["523 / 451", "523 / 451", "523 / 451"]);
  assert.equal(slices[0].top, +(-1 / 523 * 100).toFixed(4));
  assert.deepEqual(slices.map((s) => s.left), [1, 538, 1075].map((x) => +(-x / 523 * 100).toFixed(4)));
});

test("panelSlices refuses a gutter or border that leaves unequal panels", () => {
  assert.throws(() => panelSlices({ width: 1600, height: 367 }, { count: 3, gutter: 11, border: 10 }), /equal whole-pixel/);
  assert.throws(() => panelSlices({ width: 100, height: 20 }, { count: 2, gutter: 0, border: 10 }), /equal whole-pixel/);
});

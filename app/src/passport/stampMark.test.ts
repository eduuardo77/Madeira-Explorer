/**
 * The passport mark's geometry (T-075).
 *
 * Artwork cannot be judged by a test and this file does not try — that is what
 * `tools/preview-stamps.mjs` is for. What it does check is the handful of
 * properties that decide whether the icon *survives being small*, because the
 * defect it replaces was exactly that: a glyph that looked like a control at
 * design size and like a blue rectangle at 36 dp.
 *
 * CLAUDE.md: three real defects in the stamps were found by reading the
 * generated geometry and none by looking at it. Same idea here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CANVAS } from './stampArt.ts';
import {
  DIAMOND_RADIUS,
  RADIUS,
  RING_INSET,
  TILT_DEG,
  stampMarkPath,
  stampMarkRings,
} from './stampMark.ts';

/** Smallest size the mark is drawn at anywhere, in dp. */
const SMALLEST_USE_DP = 24;

/** Below this a stroke stops being reliably visible on a real screen. */
const MIN_VISIBLE_DP = 1.5;

function bounds(points: readonly (readonly [number, number])[]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * The mark as it is actually drawn: both renderers rotate the path inside the
 * viewBox, so an unrotated bounds check would be measuring something nobody
 * ever sees.
 */
function rotated(points: readonly (readonly [number, number])[]) {
  const centre = CANVAS / 2;
  const radians = (TILT_DEG * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return points.map(([x, y]) => {
    const dx = x - centre;
    const dy = y - centre;
    return [centre + dx * cos - dy * sin, centre + dx * sin + dy * cos] as const;
  });
}

test('the mark stays inside its canvas once tilted, so no corner is clipped', () => {
  const { outer } = stampMarkRings();
  const box = bounds(rotated(outer));

  assert.ok(box.minX >= 0, `left edge ${box.minX} is outside the canvas`);
  assert.ok(box.minY >= 0, `top edge ${box.minY} is outside the canvas`);
  assert.ok(box.maxX <= CANVAS, `right edge ${box.maxX} is outside the canvas`);
  assert.ok(box.maxY <= CANVAS, `bottom edge ${box.maxY} is outside the canvas`);
});

test('the tilt is real — a mark drawn square does not read as pressed', () => {
  const { outer } = stampMarkRings();
  const moved = rotated(outer).some(
    ([x, y], i) => Math.abs(x - outer[i][0]) > 1 || Math.abs(y - outer[i][1]) > 1
  );

  // Guards the reason the 20-gon failed: the tilt and the corners are what
  // make this a seal rather than a bullseye, and a TILT_DEG quietly set to 0
  // would take the shape back to something nobody could name.
  assert.notEqual(TILT_DEG, 0, 'an untilted mark reads as a target, not a stamp');
  assert.ok(moved, 'the tilt does not move any point');
});

test('the silhouette has corners, which is what survives being small', () => {
  const { outer } = stampMarkRings();
  // A 20-gon renders as a circle at 34 dp and the scallop vanishes with it.
  // Eight corners, each cut, is the shape that still reads.
  assert.ok(
    outer.length <= 8 * 8,
    `${outer.length} points is approaching a circle; corners are the point`
  );
});

test('the mark is centred, so it does not sit off-axis inside a round button', () => {
  const box = bounds(stampMarkRings().outer);
  const centreX = (box.minX + box.maxX) / 2;
  const centreY = (box.minY + box.maxY) / 2;

  // The scallop is a cut, not a shift: it may not drag the mark off centre.
  assert.ok(Math.abs(centreX - CANVAS / 2) < 0.5, `off centre in x by ${centreX - CANVAS / 2}`);
  assert.ok(Math.abs(centreY - CANVAS / 2) < 0.5, `off centre in y by ${centreY - CANVAS / 2}`);
});

test('the ring survives at the smallest size the mark is used', () => {
  // The ring's thickness on the canvas, converted to dp at the smallest use.
  const thicknessDp = (RING_INSET / CANVAS) * SMALLEST_USE_DP;

  assert.ok(
    thicknessDp >= MIN_VISIBLE_DP,
    `ring is ${thicknessDp.toFixed(2)} dp at ${SMALLEST_USE_DP} dp, under the ${MIN_VISIBLE_DP} dp floor`
  );
});

test('the hole is a hole — the ring never closes over itself', () => {
  const { outer, hole } = stampMarkRings();
  const outerBox = bounds(outer);
  const holeBox = bounds(hole);

  // The scallop pushes points both in and out, so the two cut outlines must
  // still be strictly nested or the ring would pinch shut somewhere.
  assert.ok(holeBox.minX > outerBox.minX, 'hole reaches the outer edge in x');
  assert.ok(holeBox.maxX < outerBox.maxX, 'hole reaches the outer edge in x');
  assert.ok(holeBox.minY > outerBox.minY, 'hole reaches the outer edge in y');
  assert.ok(holeBox.maxY < outerBox.maxY, 'hole reaches the outer edge in y');
});

test('the centre impression sits clear of the ring', () => {
  const { hole, centre } = stampMarkRings();
  const holeBox = bounds(hole);
  const centreBox = bounds(centre);

  // Touching would read as a solid blob at icon size, which is the whole
  // failure being designed out.
  assert.ok(centreBox.minX > holeBox.minX, 'impression touches the ring');
  assert.ok(centreBox.maxX < holeBox.maxX, 'impression touches the ring');
  assert.ok(centreBox.minY > holeBox.minY, 'impression touches the ring');
  assert.ok(centreBox.maxY < holeBox.maxY, 'impression touches the ring');
});

test('the impression is big enough to read as a shape rather than a dot', () => {
  const diameterDp = ((DIAMOND_RADIUS * 2) / CANVAS) * SMALLEST_USE_DP;
  assert.ok(diameterDp >= 3, `impression is ${diameterDp.toFixed(2)} dp, too small to have a shape`);
});

test('the path is three closed subpaths, which is what even-odd needs', () => {
  const d = stampMarkPath();
  const moves = d.match(/M/g) ?? [];
  const closes = d.match(/Z/g) ?? [];

  assert.equal(moves.length, 3, 'expected outer, hole and centre');
  assert.equal(closes.length, 3, 'every subpath must close or even-odd is undefined');
});

test('the geometry is stable — the same mark today and in five years', () => {
  // A stamp that shimmers between renders is the defect `cutEdge` was written
  // to avoid; the mark inherits that guarantee and this is what pins it.
  assert.equal(stampMarkPath(), stampMarkPath());
  assert.deepEqual(stampMarkRings().outer, stampMarkRings().outer);
});

test('the radius leaves air at the edge, so the scallop is not flush', () => {
  assert.ok(RADIUS < CANVAS / 2, 'mark fills the whole canvas, leaving no room to cut');
});

/**
 * Tests for the camera fit (D-057).
 *
 *     cd app && npm test
 *
 * ⚠ **This module replaces a native `fitBounds` that MapLibre gave us for
 * free**, and it is the piece of the Google Maps migration most able to be
 * wrong by a factor of two while still looking plausible on screen. So the
 * assertions are about arithmetic that can be checked by hand, not about
 * whether a screenshot looks right.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { fitBounds, MAX_ZOOM, MIN_ZOOM } from './cameraFit.ts';

/** A phone-ish viewport, in points. */
const SCREEN = { width: 360, height: 780 };

test('the whole world in one screen is roughly zoom 0, clamped to the floor', () => {
  const fit = fitBounds([-180, -85, 180, 85], { width: 256, height: 256 })!;
  assert.equal(fit.zoom, MIN_ZOOM);
});

test('halving the box adds one zoom level', () => {
  // The property that makes this Web Mercator rather than an approximation:
  // zoom is log2, so each halving of the span is exactly +1.
  const wide = fitBounds([-16.96, 32.7, -16.88, 32.76], SCREEN)!;
  const half = fitBounds([-16.92, 32.7, -16.88, 32.76], SCREEN)!;

  // Only the longitude span halved, and this box is longitude-limited on a
  // tall screen, so the zoom should rise by exactly one.
  assert.ok(
    Math.abs(half.zoom - wide.zoom - 1) < 0.001,
    `${wide.zoom} → ${half.zoom}`
  );
});

test('the centre of an unpadded fit is the centre of the box', () => {
  const fit = fitBounds([-17, 32.6, -16.8, 32.8], SCREEN)!;

  assert.ok(Math.abs(fit.coordinates.longitude - -16.9) < 1e-9);
  // Latitude is not the arithmetic mean — it is the mean in Mercator space —
  // but at this latitude the two differ by well under a metre.
  assert.ok(Math.abs(fit.coordinates.latitude - 32.7) < 0.001);
});

test('latitude is projected, not averaged — and it matters away from the equator', () => {
  // A box from the equator to 60°N. The Mercator midpoint is well north of
  // the arithmetic one (about 33°, not 30°), because a degree near the pole
  // takes up more of the image.
  const fit = fitBounds([-1, 0, 1, 60], { width: 500, height: 500 })!;
  assert.ok(
    fit.coordinates.latitude > 32,
    `arithmetic averaging would give 30; got ${fit.coordinates.latitude}`
  );
});

test('bottom padding pushes the camera south, so the box clears the card', () => {
  // The card covers the bottom of the screen (D-052/D-055). Without this the
  // end of a levada sits behind it, which is the failure this padding exists
  // to prevent.
  const plain = fitBounds([-16.92, 32.72, -16.86, 32.76], SCREEN)!;
  const padded = fitBounds([-16.92, 32.72, -16.86, 32.76], {
    ...SCREEN,
    padding: { top: 96, right: 48, bottom: 220, left: 48 },
  })!;

  assert.ok(
    padded.coordinates.latitude < plain.coordinates.latitude,
    'the camera did not move south to make room at the bottom'
  );
  assert.ok(padded.zoom < plain.zoom, 'padding did not zoom out to fit');
});

test('a box with no extent gets a real zoom, never Infinity', () => {
  // ⚠ The crash case. A trace that has not moved, or a one-point course,
  // gives a span of zero — and `log2(x/0)` is Infinity, which is not a zoom
  // any native camera will accept.
  const fit = fitBounds([-16.9, 32.7, -16.9, 32.7], SCREEN)!;

  assert.ok(Number.isFinite(fit.zoom));
  assert.equal(fit.zoom, MAX_ZOOM);
});

test('nonsense in, null out — never a camera sent somewhere arbitrary', () => {
  assert.equal(fitBounds([Number.NaN, 32.7, -16.8, 32.8], SCREEN), null);
  assert.equal(fitBounds([-17, 32.6, -16.8, 32.8], { width: 0, height: 780 }), null);
  // Padding larger than the screen leaves no room to fit anything into.
  assert.equal(
    fitBounds([-17, 32.6, -16.8, 32.8], {
      ...SCREEN,
      padding: { top: 500, bottom: 500 },
    }),
    null
  );
});

test('a levada-sized box lands at a zoom you can walk from', () => {
  // Levada do Furado, roughly: 3.8 km across. The answer should be a
  // neighbourhood zoom — not the island, not a rooftop.
  const fit = fitBounds([-16.8862, 32.7345, -16.8395, 32.7585], {
    ...SCREEN,
    padding: { top: 96, right: 48, bottom: 220, left: 48 },
  })!;

  assert.ok(fit.zoom > 11 && fit.zoom < 15, `zoom ${fit.zoom} is not walkable`);
});

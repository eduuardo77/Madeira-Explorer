/**
 * Tests for the lit roads' width by zoom (D-104).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { TRACE_PAINT } from './traceStyle.ts';
import { TRACE_WIDTH_STEPS, traceWidthDp } from './traceWidth.ts';

test('street zoom keeps the width the map always drew', () => {
  // *Centrar* lands at 16; the line there was judged on the P30 and sits on the street.
  assert.equal(traceWidthDp(16), TRACE_PAINT.light.coreWidth);
  assert.equal(traceWidthDp(19), TRACE_PAINT.light.coreWidth);
});

test('the line never gets wider as the camera zooms out', () => {
  let previous = Infinity;
  for (let zoom = 20; zoom >= 5; zoom -= 0.25) {
    const width = traceWidthDp(zoom);
    assert.ok(width <= previous, `${width} dp at zoom ${zoom} after ${previous} dp`);
    previous = width;
  }
});

test('the island view draws a thin line, but never a hairline', () => {
  // About zoom 11.4 on the P30's island view. The floor exists because a
  // 1 dp line could not be found outdoors in the drawings.
  assert.equal(traceWidthDp(11.4), 2);
  assert.equal(traceWidthDp(3), 2);
  assert.ok(Math.min(...TRACE_WIDTH_STEPS.map((step) => step.widthDp)) >= 2);
});

test('a step boundary belongs to the wider step', () => {
  assert.equal(traceWidthDp(15), 4);
  assert.equal(traceWidthDp(14.99), 3);
  assert.equal(traceWidthDp(13.5), 3);
  assert.equal(traceWidthDp(12), 2.5);
});

test('a missing zoom falls back to the thinnest line, not to an exception', () => {
  // expo-maps types the event fully, but a native NaN must not throw on a pan.
  assert.equal(traceWidthDp(Number.NaN), 2);
});

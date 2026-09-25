/**
 * Tests for the passport strip's sticker size (T-219, review N10).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PEEK,
  MAX_STAMP_SIZE,
  MIN_PEEK,
  MIN_STAMP_SIZE,
  peekAt,
  stripStampSize,
  type StripGeometry,
} from './stripLayout.ts';

/** The passport as drawn: 16 dp page padding each side, 16 leading, 8 between. */
function strip(windowWidth: number): StripGeometry {
  return { stripWidth: windowWidth - 2 * 16, leading: 16, gap: 8 };
}

test('⚠ the review’s case: at 360 dp the fourth sticker used to start exactly at the edge', () => {
  // The P30 is 1080 px at density 480: 360 dp. Measured 2026-09-24.
  assert.equal(peekAt(MAX_STAMP_SIZE, strip(360)), 0, 'the bug this exists for');

  const size = stripStampSize(strip(360));
  assert.ok(size < MAX_STAMP_SIZE);
  const peek = peekAt(size, strip(360));
  assert.ok(peek >= MIN_PEEK && peek <= MAX_PEEK, `peek ${peek.toFixed(2)}`);
});

test('a width where the cut already reads keeps the full size', () => {
  for (const width of [320, 390, 411]) {
    assert.equal(stripStampSize(strip(width)), MAX_STAMP_SIZE, `${width} dp`);
  }
});

test('every common phone width shows part of the next sticker, and not all of it', () => {
  for (let width = 320; width <= 480; width += 1) {
    const size = stripStampSize(strip(width));
    const peek = peekAt(size, strip(width));
    assert.ok(size >= MIN_STAMP_SIZE && size <= MAX_STAMP_SIZE, `${width} dp: size ${size}`);
    assert.ok(peek >= MIN_PEEK && peek <= MAX_PEEK, `${width} dp: peek ${peek.toFixed(2)} at ${size}`);
  }
});

test('a sticker that was nearly whole at the edge becomes a whole one, plus a clear part', () => {
  // 444 dp: at 96 the fourth shows 0.88 of itself, which reads as a sticker
  // touching the border rather than one cut off by it.
  assert.ok(peekAt(MAX_STAMP_SIZE, strip(444)) > MAX_PEEK);
  const size = stripStampSize(strip(444));
  assert.ok(peekAt(size, strip(444)) <= MAX_PEEK);
});

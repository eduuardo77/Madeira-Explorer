import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keepSimplified, simplifyLine } from './simplifyLine.ts';

// About 1 m of latitude, at Madeira.
const M = 1 / 110_540;

test('points on a straight road are dropped, its ends kept', () => {
  const straight: [number, number][] = Array.from({ length: 50 }, (_, i) => [32.65 + i * 10 * M, -16.92]);
  assert.deepEqual(simplifyLine(straight), [straight[0], straight[49]]);
});

test('a bend wider than the tolerance is kept; a wobble inside it is not', () => {
  const lon = (metres: number) => -16.92 + metres / 93_700;
  const bend: [number, number][] = [[32.65, lon(0)], [32.65 + 50 * M, lon(20)], [32.65 + 100 * M, lon(0)]];
  assert.equal(simplifyLine(bend).length, 3);
  const wobble: [number, number][] = [[32.65, lon(0)], [32.65 + 50 * M, lon(1)], [32.65 + 100 * M, lon(0)]];
  assert.equal(simplifyLine(wobble).length, 2);
});

test('lines of two points or fewer come back as they were, as a new array', () => {
  const two: [number, number][] = [[32.65, -16.92], [32.66, -16.92]];
  const out = simplifyLine(two);
  assert.deepEqual(out, two);
  assert.notEqual(out, two);
});

test('timed fixes are thinned the same way and keep their own times', () => {
  const fixes = Array.from({ length: 30 }, (_, i) => ({ lat: 32.65 + i * 10 * M, lon: -16.92, ts: 1000 + i }));
  const kept = keepSimplified(fixes);
  assert.deepEqual(kept.map((fix) => fix.ts), [1000, 1029]);
});

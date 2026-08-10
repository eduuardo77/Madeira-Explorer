/**
 * Tests for the trace builder (T-059).
 *
 *     cd app && npm test
 *
 * What is being pinned down: the two honesty rules. A silence must break the
 * line rather than bridge it, and a wild fix must not draw a spike — while a
 * merely-poor fix under canopy must still draw, because the levada walk has
 * to appear.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTrace,
  MAX_DRAWN_ACCURACY_M,
  type TraceFix,
} from './traceGeoJson.ts';

const GAP_MS = 30 * 60 * 1000;
const T0 = 1_800_000_000_000;

function fix(
  minutes: number,
  lat: number,
  lon: number,
  accuracyM: number | null = 10
): TraceFix {
  return { ts: T0 + minutes * 60_000, lat, lon, accuracy_m: accuracyM };
}

test('a continuous walk is one line, in [lon, lat] order', () => {
  const trace = buildTrace(
    [fix(0, 32.65, -16.9), fix(1, 32.651, -16.901), fix(2, 32.652, -16.902)],
    GAP_MS
  );

  assert.equal(trace.features.length, 1);
  assert.deepEqual(trace.features[0].geometry.coordinates, [
    [-16.9, 32.65],
    [-16.901, 32.651],
    [-16.902, 32.652],
  ]);
});

test('a silence longer than the threshold breaks the line', () => {
  const trace = buildTrace(
    [
      fix(0, 32.65, -16.9),
      fix(1, 32.651, -16.901),
      // 45 minutes of nothing — dinner, a dead service, a ferry. Not drawn.
      fix(46, 32.7, -17.0),
      fix(47, 32.701, -17.001),
    ],
    GAP_MS
  );

  assert.equal(trace.features.length, 2);
  assert.equal(trace.features[0].geometry.coordinates.length, 2);
  assert.equal(trace.features[1].geometry.coordinates.length, 2);
});

test('a silence just under the threshold does NOT break the line', () => {
  const trace = buildTrace(
    [fix(0, 32.65, -16.9), fix(29, 32.66, -16.91), fix(30, 32.661, -16.911)],
    GAP_MS
  );
  assert.equal(trace.features.length, 1);
});

test('fixes arrive in any order and the line is still chronological', () => {
  const trace = buildTrace(
    [fix(2, 32.652, -16.902), fix(0, 32.65, -16.9), fix(1, 32.651, -16.901)],
    GAP_MS
  );
  assert.deepEqual(
    trace.features[0].geometry.coordinates.map(([lon]) => lon),
    [-16.9, -16.901, -16.902]
  );
});

test('a wild fix is not drawn, and does not break the line either', () => {
  const trace = buildTrace(
    [
      fix(0, 32.65, -16.9),
      // 500 m accuracy under a cliff: skipping it should join its
      // neighbours, not split them.
      fix(1, 32.9, -16.5, MAX_DRAWN_ACCURACY_M + 400),
      fix(2, 32.651, -16.901),
    ],
    GAP_MS
  );

  assert.equal(trace.features.length, 1);
  assert.equal(trace.features[0].geometry.coordinates.length, 2);
});

test('poor-but-plausible canopy fixes still draw — the levada must appear', () => {
  const trace = buildTrace(
    [fix(0, 32.65, -16.9, 90), fix(1, 32.651, -16.901, 110)],
    GAP_MS
  );
  assert.equal(trace.features.length, 1);
});

test('fixes with no reported accuracy draw', () => {
  const trace = buildTrace(
    [fix(0, 32.65, -16.9, null), fix(1, 32.651, -16.901, null)],
    GAP_MS
  );
  assert.equal(trace.features.length, 1);
});

test('a lone fix produces no stroke, and no crash', () => {
  assert.equal(buildTrace([fix(0, 32.65, -16.9)], GAP_MS).features.length, 0);
  assert.equal(buildTrace([], GAP_MS).features.length, 0);
});

test('two singletons separated by a gap produce nothing rather than nonsense', () => {
  const trace = buildTrace([fix(0, 32.65, -16.9), fix(120, 32.7, -17.0)], GAP_MS);
  assert.equal(trace.features.length, 0);
});

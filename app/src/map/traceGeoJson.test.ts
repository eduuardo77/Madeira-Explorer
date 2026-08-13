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
  MIN_FRAME_SPAN_DEG,
  traceBounds,
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

// ---------------------------------------------------------------------------
// What the camera should look at (2026-08-13)
// ---------------------------------------------------------------------------

test('the camera frames what was walked, not the whole island', () => {
  const trace = buildTrace(
    [fix(0, 32.64, -16.91), fix(1, 32.65, -16.90), fix(2, 32.66, -16.89)],
    GAP_MS
  );
  const bounds = traceBounds(trace);

  assert.ok(bounds !== null);
  const [west, south, east, north] = bounds!;
  assert.ok(west <= -16.91 && east >= -16.89, 'the trace is not inside the box');
  assert.ok(south <= 32.64 && north >= 32.66, 'the trace is not inside the box');
});

test('a trace that went nowhere still gets a neighbourhood, not a rooftop', () => {
  // Day one: fifty fixes in a 30 m circle while the phone sat on a café table.
  // Framed tightly that is a view of nothing, from which the user cannot tell
  // where they are.
  const trace = buildTrace(
    [fix(0, 32.65, -16.91), fix(1, 32.6501, -16.9101)],
    GAP_MS
  );
  const bounds = traceBounds(trace)!;

  assert.ok(bounds[2] - bounds[0] >= MIN_FRAME_SPAN_DEG - 1e-9, 'too narrow');
  assert.ok(bounds[3] - bounds[1] >= MIN_FRAME_SPAN_DEG - 1e-9, 'too short');
});

test('the floor keeps the trace centred rather than shoving it into a corner', () => {
  const trace = buildTrace([fix(0, 32.65, -16.91), fix(1, 32.6501, -16.91)], GAP_MS);
  const [west, south, east, north] = traceBounds(trace)!;

  assert.ok(Math.abs((west + east) / 2 - -16.91) < 1e-6);
  assert.ok(Math.abs((south + north) / 2 - 32.65005) < 1e-6);
});

test('nothing recorded means no opinion — the caller falls back to the island', () => {
  assert.equal(traceBounds({ type: 'FeatureCollection', features: [] }), null);
});

test('the bounds are in MapLibre order: west, south, east, north', () => {
  const trace = buildTrace(
    [fix(0, 32.60, -17.20), fix(1, 32.80, -16.70)],
    GAP_MS
  );
  const [west, south, east, north] = traceBounds(trace)!;

  assert.ok(west < east, 'west is not west of east');
  assert.ok(south < north, 'south is not south of north');
  assert.ok(west < 0 && east < 0, 'Madeira is west of Greenwich; a sign flipped');
});

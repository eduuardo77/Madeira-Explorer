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
  MAX_DRAWN_SPEED_MPS,
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
  // ⚠ The walk turns. It used to be three points in a straight line, and after
  // D-066 the middle one is simplified away — correctly, since it added nothing
  // to the drawing — which made this test about cleanup rather than about
  // ordering. A corner is what the assertion below actually needs.
  const trace = buildTrace(
    [fix(0, 32.65, -16.9), fix(1, 32.651, -16.901), fix(2, 32.65, -16.902)],
    GAP_MS
  );

  assert.equal(trace.features.length, 1);
  assert.deepEqual(trace.features[0].geometry.coordinates, [
    [-16.9, 32.65],
    [-16.901, 32.651],
    [-16.902, 32.65],
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
  // Cornered, for the same reason as the test above: a straight line loses its
  // middle to simplification, and this test is about time, not geometry.
  const trace = buildTrace(
    [fix(2, 32.65, -16.902), fix(0, 32.65, -16.9), fix(1, 32.651, -16.901)],
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
  // ⚠ Twenty minutes apart, not one. These two points are 55 km apart — the
  // width of the island — and covering that in a minute is the impossible
  // movement `MAX_DRAWN_SPEED_MPS` now breaks the line for. At 20 minutes it
  // is a drive, which is a stroke this app is glad to draw.
  const trace = buildTrace(
    [fix(0, 32.60, -17.20), fix(20, 32.80, -16.70)],
    GAP_MS
  );
  const [west, south, east, north] = traceBounds(trace)!;

  assert.ok(west < east, 'west is not west of east');
  assert.ok(south < north, 'south is not south of north');
  assert.ok(west < 0 && east < 0, 'Madeira is west of Greenwich; a sign flipped');
});

// ---------------------------------------------------------------------------
// Rule 3: a jump nobody could have made (2026-08-14)
// ---------------------------------------------------------------------------

test('⚠ flying home does not draw a line across the Atlantic', () => {
  // The exact shape of the defect the project lead saw: a walk on the Funchal
  // seafront, then one fix in Lisbon, joined into a single confident stroke
  // 900 km long. Two strokes is the honest drawing; the flight is not one.
  const trace = buildTrace(
    [
      fix(0, 32.6445, -16.9075),
      fix(1, 32.6448, -16.9068),
      fix(2, 32.6451, -16.9061),
      fix(20, 38.7742, -9.1342),
    ],
    GAP_MS
  );

  assert.equal(trace.features.length, 1);
  // ⚠ Asserted as "Lisbon is not in the drawing" rather than as a vertex count:
  // the seafront fixes are nearly collinear, so D-066's simplification keeps
  // two of the three, and counting them tested cleanup instead of the flight.
  const drawn = trace.features[0].geometry.coordinates;
  assert.ok(drawn.length >= 2);
  assert.ok(
    drawn.every(([lon]) => lon < -16 && lon > -17.5),
    'no vertex may be on the mainland'
  );
});

test('⚠ a teleport between geofence tests is not a route', () => {
  // What the emulator produces, and what an Android fused-provider glitch
  // produces: a wild fix with a *good* reported accuracy, which is precisely
  // the case the accuracy filter cannot catch.
  const trace = buildTrace(
    [fix(0, 32.65, -16.90), fix(1, 32.75, -17.19), fix(2, 32.65, -16.90)],
    GAP_MS
  );

  // Three points, three impossible hops, so nothing survives as a stroke —
  // and a blank map is the correct answer to "we do not know where you went".
  assert.equal(trace.features.length, 0);
});

test('a drive between two levadas is still one line', () => {
  // The gate must not become a smoother. This is 12 km of VR1 in ten minutes
  // — 20 m/s, entirely ordinary — and deleting it would delete real movement.
  const trace = buildTrace(
    [fix(0, 32.65, -16.91), fix(10, 32.68, -16.78), fix(20, 32.70, -16.65)],
    GAP_MS
  );

  assert.equal(trace.features.length, 1);
  assert.equal(trace.features[0].geometry.coordinates.length, 3);
});

test('GPS jitter at a standstill never breaks the line', () => {
  // Fixes delivered in a burst are milliseconds apart, so a few metres of
  // jitter is arithmetically hundreds of m/s. Below the minimum jump the
  // speed is not consulted at all — this is what that floor is for.
  const jitter: TraceFix[] = [
    { ts: T0, lat: 32.6445, lon: -16.9075, accuracy_m: 8 },
    { ts: T0 + 40, lat: 32.64453, lon: -16.90747, accuracy_m: 8 },
    { ts: T0 + 80, lat: 32.64449, lon: -16.90752, accuracy_m: 8 },
  ];

  const trace = buildTrace(jitter, GAP_MS);
  assert.equal(trace.features.length, 1, 'the line must not break');
  // ⚠ The jitter is now *simplified away* as well as not broken (D-066): three
  // fixes within a few metres of each other are one point to look at, and were
  // drawn as a knot before. The rule under test — the minimum-jump floor that
  // stops a burst delivery breaking the stroke — is the feature count above.
  assert.ok(trace.features[0].geometry.coordinates.length <= 3);
});

test('two fixes at the same instant in different places break the line', () => {
  // Division by zero would say `Infinity > limit` and reach the right answer
  // by accident; this pins that it is decided on purpose.
  const trace = buildTrace(
    [
      fix(0, 32.6445, -16.9075),
      fix(1, 32.6448, -16.9068),
      { ts: T0 + 60_000, lat: 32.75, lon: -17.19, accuracy_m: 10 },
    ],
    GAP_MS
  );

  assert.equal(trace.features.length, 1);
});

test('the speed limit is far above anything the island allows', () => {
  // ⚠ The number is an argument, not a measurement, so what is pinned is the
  // argument: it must stay well clear of a car so it can never smooth a drive.
  assert.ok(MAX_DRAWN_SPEED_MPS > 30, 'a car on the VR1 must survive this');
  assert.ok(MAX_DRAWN_SPEED_MPS < 100, 'an aircraft must not');
});

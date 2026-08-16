/**
 * Tests for the trace-based arrival detector (D-065).
 *
 *     cd app && npm test
 *
 * The point of this detector is that it works when the operating system did
 * not, so the tests are written as the situations it exists for: the crossing
 * that never fired, the fix that admits imprecision, the recorder going quiet
 * mid-visit while the user stands still. And the ones it must still refuse —
 * driving through, and a minute at a viewpoint.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { PlaceGeofence } from '../content/contentPack.ts';
import type { TraceFix } from './levadaCoverage.ts';
import { findArrivals, judgeArrivals, MAX_GAP_SECONDS } from './arrivalFromTrace.ts';
import { MIN_DWELL_SECONDS } from './stampRules.ts';

const NOW = 1_800_000_000_000;
const LAT_PER_M = 1 / 110_540;

const place: PlaceGeofence = {
  id: 'a-place',
  role: 'main',
  lat: 32.7,
  lon: -17,
  radiusM: 200,
};

/** `count` fixes `everySeconds` apart, `offsetM` north of the centre. */
function fixes(
  count: number,
  { everySeconds = 60, offsetM = 0, accuracy = 10, startTs = NOW, driftMPerFix = 0 } = {}
): TraceFix[] {
  return Array.from({ length: count }, (_, i) => ({
    ts: startTs + i * everySeconds * 1000,
    lat: 32.7 + (offsetM + i * driftMPerFix) * LAT_PER_M,
    lon: -17,
    accuracy_m: accuracy,
  }));
}

test('standing at a place for ten minutes is an arrival', () => {
  const arrivals = findArrivals(place, fixes(10));
  assert.equal(arrivals.length, 1);
  assert.equal(arrivals[0].dwellSeconds, 9 * 60);

  const verdict = judgeArrivals(arrivals);
  assert.equal(verdict.awarded, true);
  assert.match(verdict.reason, /9 min inside/);
});

test('a minute at a viewpoint is not', () => {
  const verdict = judgeArrivals(findArrivals(place, fixes(2, { everySeconds: 60 })));
  assert.equal(verdict.awarded, false);
  assert.match(verdict.reason, /are needed/);
});

test('driving through is refused even when the circle is generous', () => {
  // ⚠ The first version of this test used 60 m per minute and expected a
  // refusal. 60 m/min is 3.6 km/h — a walk — and the code was right to award
  // it. A village geofence is 600 m and someone strolling across one has
  // arrived. This is a car: 840 m per minute, 50 km/h, through a circle wide
  // enough that it is inside for five.
  // ⚠ And it has to enter from the edge, not from the middle: a car starting
  // at the centre leaves in two minutes and is refused on *dwell*, which would
  // have made this test pass while proving nothing about the speed gate.
  const verdict = judgeArrivals(
    findArrivals(
      { ...place, radiusM: 4000 },
      fixes(10, { offsetM: -4000, driftMPerFix: 840 })
    )
  );
  assert.equal(verdict.awarded, false);
  assert.match(verdict.reason, /moving at/);
});

test('a fix admitting 40 m of doubt counts on the boundary', () => {
  // 220 m from the centre of a 200 m circle, but the fix says ±40 m. Refusing
  // it would refuse the honest fix and keep the overconfident one.
  const generous = findArrivals(place, fixes(10, { offsetM: 220, accuracy: 40 }));
  assert.equal(generous.length, 1);

  const strict = findArrivals(place, fixes(10, { offsetM: 220, accuracy: 3 }));
  assert.equal(strict.length, 0);
});

test('a fix too vague to place is not evidence of being anywhere', () => {
  const arrivals = findArrivals(place, fixes(10, { offsetM: 0, accuracy: 400 }));
  assert.equal(arrivals.length, 0);
});

test('the recorder going quiet while you stand still does not split the visit', () => {
  // The stationary profile defers for up to 15 minutes, which is precisely what
  // standing at a miradouro looks like to it.
  const arrivals = findArrivals(place, [
    ...fixes(3, { everySeconds: 60 }),
    ...fixes(3, { everySeconds: 60, startTs: NOW + 14 * 60_000 }),
  ]);
  assert.equal(arrivals.length, 1);
  assert.equal(judgeArrivals(arrivals).awarded, true);
});

test('but a longer silence is two visits, not one long one', () => {
  const arrivals = findArrivals(place, [
    ...fixes(2, { everySeconds: 30 }),
    ...fixes(2, { everySeconds: 30, startTs: NOW + (MAX_GAP_SECONDS + 300) * 1000 }),
  ]);
  assert.equal(arrivals.length, 2);
  // Neither half is long enough on its own, and inventing the join would be
  // inventing a dwell nobody measured.
  assert.equal(judgeArrivals(arrivals).awarded, false);
});

test('the strongest stay decides, not the first', () => {
  const arrivals = findArrivals(place, [
    // Drove past in the morning.
    ...fixes(2, { everySeconds: 30 }),
    // Walked up in the afternoon.
    ...fixes(12, { everySeconds: 60, startTs: NOW + 6 * 3600_000 }),
  ]);
  const verdict = judgeArrivals(arrivals);
  assert.equal(verdict.awarded, true);
  assert.ok(verdict.dwellSeconds !== null && verdict.dwellSeconds >= MIN_DWELL_SECONDS);
});

test('no fixes at all refuses, and says so rather than throwing', () => {
  const verdict = judgeArrivals(findArrivals(place, []));
  assert.equal(verdict.awarded, false);
  assert.equal(verdict.awardedTs, null);
  assert.match(verdict.reason, /no fix/);
});

test('an award is timestamped when the user was last measured there', () => {
  const trace = fixes(10);
  const verdict = judgeArrivals(findArrivals(place, trace));
  assert.equal(verdict.awardedTs, trace[trace.length - 1].ts);
});

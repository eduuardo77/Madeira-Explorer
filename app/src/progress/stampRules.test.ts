/**
 * Tests for the stamp award rules (T-071).
 *
 *     cd app && npm test
 *
 * Two of these matter more than the rest, because the docs name them as the
 * failure modes that decide whether the product works at all:
 *
 *   - **T-078**: driving past a levada trailhead must NOT award it. If stamps
 *     fire on drive-bys the whole collection is worthless (D-009).
 *   - **T-079 / D-032**: a genuine visit with bad GPS must STILL award. Walking
 *     a famous levada and getting nothing is the uninstall trigger.
 *
 * Everything is synthetic — no Madeira coordinates, no clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Place } from '../content/contentPack.ts';
import {
  judgePlace,
  MAX_ARRIVAL_SPEED_MPS,
  MIN_DWELL_SECONDS,
  reconstructVisits,
  type GeofenceCrossing,
  type SpeedLookup,
} from './stampRules.ts';

const T0 = 1_800_000_000_000;
const NOW = T0 + 24 * 3600 * 1000;

const minutes = (n: number) => T0 + n * 60_000;

/** Every fix in the window reported this speed. */
const atSpeed =
  (meanSpeedMps: number | null, fixCount = 10): SpeedLookup =>
  () => ({ meanSpeedMps, fixCount });

/** No usable speed anywhere — the canopy case. */
const noSpeed: SpeedLookup = () => ({ meanSpeedMps: null, fixCount: 0 });

function viewpoint(): Place {
  return {
    id: 'a-viewpoint',
    name: 'A Viewpoint',
    category: 'viewpoint',
    regionId: 'a-region',
    geofences: [
      { id: 'a-viewpoint', role: 'main', lat: 32.65, lon: -16.9, radiusM: 200 },
    ],
  };
}

function levada(): Place {
  return {
    id: 'a-levada',
    name: 'A Levada',
    category: 'levada',
    regionId: 'a-region',
    geofences: [
      { id: 'a-levada/start', role: 'start', lat: 32.7, lon: -17.0, radiusM: 400 },
      { id: 'a-levada/end', role: 'end', lat: 32.75, lon: -16.95, radiusM: 400 },
    ],
  };
}

function crossing(
  geofenceId: string,
  minute: number,
  eventType: 'enter' | 'exit'
): GeofenceCrossing {
  return { geofenceId, ts: minutes(minute), eventType };
}

// ---------------------------------------------------------------------------
// reconstructing visits from an untidy event stream
// ---------------------------------------------------------------------------

test('an enter/exit pair becomes one visit of the right length', () => {
  const visits = reconstructVisits(
    [crossing('g', 0, 'enter'), crossing('g', 10, 'exit')],
    NOW
  );
  assert.equal(visits.length, 1);
  assert.equal(visits[0].dwellSeconds, 600);
});

test('a missing exit means "still inside", measured to now', () => {
  const visits = reconstructVisits([crossing('g', 0, 'enter')], minutes(7));
  assert.equal(visits.length, 1);
  assert.equal(visits[0].exitedTs, null);
  assert.equal(visits[0].dwellSeconds, 420);
});

test('a repeated enter does not start a second visit', () => {
  // Loitering on the boundary. The generous reading is one long visit from the
  // first enter, not two short ones.
  const visits = reconstructVisits(
    [crossing('g', 0, 'enter'), crossing('g', 2, 'enter'), crossing('g', 10, 'exit')],
    NOW
  );
  assert.equal(visits.length, 1);
  assert.equal(visits[0].dwellSeconds, 600);
});

test('an exit with no enter is dropped rather than invented', () => {
  assert.equal(reconstructVisits([crossing('g', 5, 'exit')], NOW).length, 0);
});

test('two geofences interleave without confusing each other', () => {
  const visits = reconstructVisits(
    [
      crossing('a', 0, 'enter'),
      crossing('b', 1, 'enter'),
      crossing('a', 5, 'exit'),
      crossing('b', 9, 'exit'),
    ],
    NOW
  );
  assert.deepEqual(
    visits.map((v) => [v.geofenceId, v.dwellSeconds]),
    [
      ['a', 300],
      ['b', 480],
    ]
  );
});

// ---------------------------------------------------------------------------
// arrivals
// ---------------------------------------------------------------------------

test('a real visit at walking pace is awarded', () => {
  const decision = judgePlace(
    viewpoint(),
    [crossing('a-viewpoint', 0, 'enter'), crossing('a-viewpoint', 12, 'exit')],
    atSpeed(0.4),
    NOW
  );

  assert.equal(decision.awarded, true);
  assert.equal(decision.dwellSeconds, 720);
  assert.ok(decision.confidence > 0.7, `confidence was ${decision.confidence}`);
});

test('driving through does not award — too brief', () => {
  // 200 m circle at 60 km/h is about twelve seconds.
  const decision = judgePlace(
    viewpoint(),
    [
      { geofenceId: 'a-viewpoint', ts: T0, eventType: 'enter' },
      { geofenceId: 'a-viewpoint', ts: T0 + 12_000, eventType: 'exit' },
    ],
    atSpeed(16),
    NOW
  );

  assert.equal(decision.awarded, false);
  assert.match(decision.reason, /12s inside/);
});

test('stuck in traffic inside the geofence does not award — too fast', () => {
  // The case dwell alone cannot catch: long enough inside, but never stopped.
  const decision = judgePlace(
    viewpoint(),
    [crossing('a-viewpoint', 0, 'enter'), crossing('a-viewpoint', 15, 'exit')],
    atSpeed(MAX_ARRIVAL_SPEED_MPS + 3),
    NOW
  );

  assert.equal(decision.awarded, false);
  assert.match(decision.reason, /moving at/);
});

test('a visit with NO speed data is still awarded, less confidently', () => {
  // Under Laurissilva canopy this is the normal case. Refusing here would deny
  // stamps exactly where the walking is hardest (D-032).
  const decision = judgePlace(
    viewpoint(),
    [crossing('a-viewpoint', 0, 'enter'), crossing('a-viewpoint', 20, 'exit')],
    noSpeed,
    NOW
  );

  assert.equal(decision.awarded, true);
  assert.ok(decision.confidence > 0, 'should carry some confidence');
  assert.ok(decision.confidence <= 0.7, 'but visibly less than a clean award');
});

test('a longer, slower visit beats a marginal one', () => {
  const decision = judgePlace(
    viewpoint(),
    [
      crossing('a-viewpoint', 0, 'enter'),
      crossing('a-viewpoint', 4, 'exit'),
      crossing('a-viewpoint', 60, 'enter'),
      crossing('a-viewpoint', 120, 'exit'),
    ],
    atSpeed(0.2),
    NOW
  );

  assert.equal(decision.awarded, true);
  assert.equal(decision.dwellSeconds, 3600);
});

test('a stamp can be earned while still standing there', () => {
  const decision = judgePlace(
    viewpoint(),
    [crossing('a-viewpoint', 0, 'enter')],
    atSpeed(0.3),
    minutes(30)
  );

  assert.equal(decision.awarded, true);
  assert.equal(decision.awardedTs, minutes(0) + MIN_DWELL_SECONDS * 1000);
});

test('never entered means never awarded', () => {
  const decision = judgePlace(viewpoint(), [], atSpeed(0), NOW);
  assert.equal(decision.awarded, false);
  assert.equal(decision.reason, 'never entered');
});

// ---------------------------------------------------------------------------
// levadas — the different-shaped reward
// ---------------------------------------------------------------------------

test('walking a levada end to end is awarded', () => {
  const decision = judgePlace(
    levada(),
    [
      crossing('a-levada/start', 0, 'enter'),
      crossing('a-levada/start', 8, 'exit'),
      crossing('a-levada/end', 150, 'enter'),
      crossing('a-levada/end', 160, 'exit'),
    ],
    atSpeed(1.1),
    NOW
  );

  assert.equal(decision.awarded, true);
  assert.match(decision.reason, /walked end to end in 150 min/);
});

test('T-078: DRIVING PAST THE TRAILHEAD DOES NOT AWARD THE LEVADA', () => {
  // The named failure mode. Both ends crossed — but at driving speed and
  // barely inside either. The endpoints fail, so the connection is never
  // considered (D-009: verify the endpoints).
  const decision = judgePlace(
    levada(),
    [
      { geofenceId: 'a-levada/start', ts: T0, eventType: 'enter' },
      { geofenceId: 'a-levada/start', ts: T0 + 25_000, eventType: 'exit' },
      { geofenceId: 'a-levada/end', ts: minutes(40), eventType: 'enter' },
      { geofenceId: 'a-levada/end', ts: minutes(40) + 25_000, eventType: 'exit' },
    ],
    atSpeed(14),
    NOW
  );

  assert.equal(decision.awarded, false);
});

test('driving between the two trailheads does not award, even after stopping', () => {
  // The subtler version: the user genuinely stops at both ends — parks, looks
  // at the view — but drives between them in 40 minutes. Endpoints pass; the
  // elapsed time is plausible for a drive but this is exactly why the walk
  // itself must clear a floor.
  const fast = judgePlace(
    levada(),
    [
      crossing('a-levada/start', 0, 'enter'),
      crossing('a-levada/start', 5, 'exit'),
      crossing('a-levada/end', 12, 'enter'),
      crossing('a-levada/end', 18, 'exit'),
    ],
    atSpeed(0.5),
    NOW
  );

  assert.equal(fast.awarded, false);
  assert.match(fast.reason, /too fast to have walked it/);
});

test('one end only does not award, and says which', () => {
  const decision = judgePlace(
    levada(),
    [crossing('a-levada/start', 0, 'enter'), crossing('a-levada/start', 30, 'exit')],
    atSpeed(0.5),
    NOW
  );

  assert.equal(decision.awarded, false);
  assert.match(decision.reason, /only the trailhead verified/);
});

test('the two ends days apart are not one walk', () => {
  const decision = judgePlace(
    levada(),
    [
      crossing('a-levada/start', 0, 'enter'),
      crossing('a-levada/start', 10, 'exit'),
      crossing('a-levada/end', 60 * 48, 'enter'),
      crossing('a-levada/end', 60 * 48 + 10, 'exit'),
    ],
    atSpeed(0.5),
    NOW + 5 * 24 * 3600 * 1000
  );

  assert.equal(decision.awarded, false);
  assert.match(decision.reason, /not one walk/);
});

test('a levada walked in reverse is still a levada', () => {
  const decision = judgePlace(
    levada(),
    [
      crossing('a-levada/end', 0, 'enter'),
      crossing('a-levada/end', 6, 'exit'),
      crossing('a-levada/start', 130, 'enter'),
      crossing('a-levada/start', 140, 'exit'),
    ],
    atSpeed(1.0),
    NOW
  );

  assert.equal(decision.awarded, true);
});

test('the weaker endpoint governs a levada award', () => {
  // One end verified cleanly, the other only by dwell under canopy. The award
  // stands, but it must not claim more certainty than its weakest half.
  const mixed: SpeedLookup = (fromTs) =>
    fromTs === minutes(0)
      ? { meanSpeedMps: null, fixCount: 0 }
      : { meanSpeedMps: 0.2, fixCount: 20 };

  const decision = judgePlace(
    levada(),
    [
      crossing('a-levada/start', 0, 'enter'),
      crossing('a-levada/start', 10, 'exit'),
      crossing('a-levada/end', 150, 'enter'),
      crossing('a-levada/end', 160, 'exit'),
    ],
    mixed,
    NOW
  );

  assert.equal(decision.awarded, true);
  assert.ok(decision.confidence <= 0.7, `confidence was ${decision.confidence}`);
});

test('a levada missing its pair in the content pack refuses rather than guesses', () => {
  const malformed: Place = {
    ...levada(),
    geofences: [
      { id: 'only-one', role: 'start', lat: 32.7, lon: -17.0, radiusM: 400 },
    ],
  };

  const decision = judgePlace(
    malformed,
    [crossing('only-one', 0, 'enter'), crossing('only-one', 60, 'exit')],
    atSpeed(0.4),
    NOW
  );

  assert.equal(decision.awarded, false);
  assert.match(decision.reason, /no start\/end pair/);
});

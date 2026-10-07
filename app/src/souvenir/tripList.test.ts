/**
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { TripSummary } from '../storage/types.ts';
import { listedTrips, MIN_FIXES_TO_LIST } from './tripList.ts';

const trip = (id: number, fixes: number, stamps = 0): TripSummary => ({
  id,
  started_ts: id * 1000,
  ended_ts: null,
  fix_count: fixes,
  stamp_count: stamps,
});

test('T-261: restarts are left out, real trips listed newest first', () => {
  // The P30's shape: tiny restarts around three real trips.
  const trips = [trip(1, 2), trip(14, 128), trip(20, 1), trip(30, 6509), trip(31, 14475)];
  assert.deepEqual(
    listedTrips(trips).map((t) => t.id),
    [31, 30, 14],
  );
});

test('T-261: a trip with a stamp is listed however little it recorded', () => {
  assert.deepEqual(
    listedTrips([trip(5, 3, 1)]).map((t) => t.id),
    [5],
  );
});

test('T-261: the threshold is inclusive', () => {
  assert.equal(listedTrips([trip(7, MIN_FIXES_TO_LIST)]).length, 1);
  assert.equal(listedTrips([trip(8, MIN_FIXES_TO_LIST - 1)]).length, 0);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendedCountMatches, mergeAppended, planRead, type CachedTrace, type TraceRow } from './traceCache.ts';

const row = (id: number, ts: number): TraceRow => ({ id, ts, lat: 32.7, lon: -16.9, accuracy_m: 10, speed_mps: null });
const cache: CachedTrace = { tripId: 31, maxId: 100, count: 50, rows: [] };

test('T-254: nothing new reads nothing; new rows are appended; anything else reloads', () => {
  assert.deepEqual(planRead(cache, 31, { maxId: 100, count: 50 }), { kind: 'cached' });
  assert.deepEqual(planRead(cache, 31, { maxId: 104, count: 53 }), { kind: 'append', afterId: 100 });
  // Rows gone (erase-all not announced, a restore): reload, never trust.
  assert.deepEqual(planRead(cache, 31, { maxId: 100, count: 49 }), { kind: 'reload' });
  assert.deepEqual(planRead(cache, 31, { maxId: 90, count: 40 }), { kind: 'reload' });
  assert.deepEqual(planRead(cache, 31, { maxId: 104, count: 50 }), { kind: 'reload' });
  // Another trip, no cache, an empty trip.
  assert.deepEqual(planRead(cache, 30, { maxId: 100, count: 50 }), { kind: 'reload' });
  assert.deepEqual(planRead(null, 31, { maxId: 100, count: 50 }), { kind: 'reload' });
  assert.deepEqual(planRead(cache, 31, { maxId: null, count: 0 }), { kind: 'reload' });
});

test('T-254: an append is trusted only if it brings exactly the rows the count says', () => {
  assert.equal(appendedCountMatches(cache, 3, { maxId: 104, count: 53 }), true);
  assert.equal(appendedCountMatches(cache, 2, { maxId: 104, count: 53 }), false);
});

test('T-254: merged rows come out as ORDER BY ts, id would give them, late batches included', () => {
  const existing = [row(1, 10), row(2, 20), row(3, 20), row(4, 40)];
  // A late batch: one fix older than stored ones, one tying a stored second.
  const added = [row(5, 15), row(6, 20), row(7, 50)];
  const merged = mergeAppended(existing, added);
  const fresh = [...existing, ...added].sort((a, b) => a.ts - b.ts || a.id - b.id);
  assert.deepEqual(merged, fresh);
});

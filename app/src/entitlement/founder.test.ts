/**
 * The founder stamp's rule, pinned at its edges (T-233, plan §4.2, OQ-5).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  founderWindowEndMs,
  founderWindowOpen,
  founderStartMissing,
  founderYear,
  isFounder,
  parseWindowStart,
} from './founder.ts';

const LAUNCH = { start: '2026-11-15', months: 3 };
const END = Date.UTC(2027, 1, 15); // 15 Feb 2027, 00:00 UTC

test('T-233: a null start means nobody is a founder, and nothing is offered', () => {
  const unset = { start: null, months: 3 };
  assert.equal(isFounder(Date.UTC(2026, 10, 20), unset), false);
  assert.equal(founderWindowOpen(Date.UTC(2026, 10, 20), unset), false);
  assert.equal(founderWindowEndMs(unset), null);
  assert.equal(isFounder(Date.UTC(2026, 10, 20), null), false, 'a pack with no window at all');
});

test('T-233: the window ends three calendar months after the start, at midnight UTC', () => {
  assert.equal(founderWindowEndMs(LAUNCH), END);
});

test('T-233: the last millisecond inside the window is a founder; the first one after is not', () => {
  assert.equal(isFounder(END - 1, LAUNCH), true);
  assert.equal(isFounder(END, LAUNCH), false);
});

test('T-233 (OQ-5): a purchase before the start counts: testers and early promo codes were there first', () => {
  assert.equal(isFounder(Date.UTC(2026, 9, 5), LAUNCH), true);
});

test('T-233: no purchase time, no founder (Google did not say when)', () => {
  assert.equal(isFounder(null, LAUNCH), false);
  assert.equal(isFounder(Number.NaN, LAUNCH), false);
});

test('T-233: a start late in the month ends on the target month\'s last day, not in the month after', () => {
  assert.equal(founderWindowEndMs({ start: '2026-11-30', months: 3 }), Date.UTC(2027, 1, 28));
  assert.equal(founderWindowEndMs({ start: '2027-11-30', months: 3 }), Date.UTC(2028, 1, 29), 'leap year');
  assert.equal(founderWindowEndMs({ start: '2026-08-31', months: 3 }), Date.UTC(2026, 10, 30));
});

test('T-233: the offer closes with the window, by the phone\'s clock', () => {
  assert.equal(founderWindowOpen(END - 1, LAUNCH), true);
  assert.equal(founderWindowOpen(END, LAUNCH), false);
});

test('T-233: only real dates are read', () => {
  assert.equal(parseWindowStart('2026-11-15'), Date.UTC(2026, 10, 15));
  for (const bad of ['2026-02-30', '2026-13-01', '15/11/2026', '2026-11-15T00:00:00Z', '']) {
    assert.equal(parseWindowStart(bad), null, bad);
  }
});

test('T-233: the stamp\'s year is the window\'s', () => {
  assert.equal(founderYear(LAUNCH), 2026);
  assert.equal(founderYear({ start: null, months: 3 }), null);
});

test('T-233: a public release is refused while the window has no start, and only then', () => {
  assert.equal(founderStartMissing({ start: null, months: 3 }), true);
  assert.equal(founderStartMissing(LAUNCH), false);
  assert.equal(founderStartMissing(null), false, 'a pack with no founder stamp has nothing to forget');
});

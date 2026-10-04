/**
 * Where the camera goes when the map is shown again (2026-10-04).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { nextSeenTs, returnFraming, type LonLat } from './returnFraming.ts';

const walk: LonLat[] = [[-16.951, 32.641], [-16.975, 32.648]];
const home: LonLat = [-16.828, 32.654];

test('new lines since last looked: the camera frames them and the user', () => {
  assert.deepEqual(returnFraming({ seenTs: 100, latestTs: 200, newRoute: walk, user: home }), [...walk, home]);
});

test('no fresh position: the new lines alone', () => {
  assert.deepEqual(returnFraming({ seenTs: 100, latestTs: 200, newRoute: walk, user: null }), walk);
});

test('nothing new: the camera stays where the user left it', () => {
  assert.equal(returnFraming({ seenTs: 200, latestTs: 200, newRoute: [], user: home }), null);
  assert.equal(returnFraming({ seenTs: 200, latestTs: null, newRoute: [], user: home }), null);
});

test('never looked before: the first framing of the map applies, not this', () => {
  assert.equal(returnFraming({ seenTs: null, latestTs: 200, newRoute: walk, user: home }), null);
});

test('what was seen only moves forward', () => {
  assert.equal(nextSeenTs(null, 200), 200);
  assert.equal(nextSeenTs(300, 200), 300);
  assert.equal(nextSeenTs(100, null), 100);
});

/**
 * What the user was doing at a moment, from activity transitions (D-094).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVITY_REFRESH_MS,
  activitiesAt,
  activityAfter,
  parseEvent,
  registrationDue,
  unseenEvents,
  type ActivityEvent,
} from './activityTimeline.ts';

const enter = (ts: number, activity: ActivityEvent['activity']): ActivityEvent => ({ ts, activity, transition: 'enter' });
const exit = (ts: number, activity: ActivityEvent['activity']): ActivityEvent => ({ ts, activity, transition: 'exit' });

test('the activity is the last one entered, however long ago', () => {
  const events = [enter(100, 'driving'), exit(5000, 'driving'), enter(5000, 'walking')];
  assert.deepEqual(activitiesAt(events, [50, 100, 3000, 4999, 5000, 90000]), [
    'unknown',
    'driving',
    'driving',
    'driving',
    'walking',
    'walking',
  ]);
});

test('an exit with nothing entered after leaves it unknown', () => {
  assert.deepEqual(activitiesAt([enter(0, 'still'), exit(10, 'still')], [5, 20]), ['still', 'unknown']);
});

test('an exit of another activity changes nothing', () => {
  assert.deepEqual(activitiesAt([enter(0, 'walking'), exit(10, 'driving')], [20]), ['walking']);
});

test('times and events in any order give each time its own answer', () => {
  const events = [enter(300, 'cycling'), enter(100, 'walking')];
  assert.deepEqual(activitiesAt(events, [400, 50, 200]), ['cycling', 'unknown', 'walking']);
});

test('the state carried in from before is used until an event changes it', () => {
  assert.deepEqual(activitiesAt([enter(100, 'still')], [50, 150], 'driving'), ['driving', 'still']);
  assert.equal(activityAfter([], 'walking'), 'walking');
  assert.equal(activityAfter([enter(1, 'walking'), enter(2, 'driving')]), 'driving');
});

test('a queued event is read only when it is whole', () => {
  assert.deepEqual(parseEvent({ ts: 5, activity: 'walking', transition: 'enter' }), enter(5, 'walking'));
  assert.equal(parseEvent({ ts: 5, activity: 'flying', transition: 'enter' }), null);
  assert.equal(parseEvent({ ts: 'x', activity: 'walking', transition: 'enter' }), null);
  assert.equal(parseEvent({ ts: 5, activity: 'walking', transition: 'sideways' }), null);
  assert.equal(parseEvent(null), null);
});

test('registration is due at first, then every two minutes, not between', () => {
  assert.equal(registrationDue(null, 0), true);
  assert.equal(registrationDue(1_000, 1_000 + ACTIVITY_REFRESH_MS - 1), false);
  assert.equal(registrationDue(1_000, 1_000 + ACTIVITY_REFRESH_MS), true);
});

test('a replayed event is stored once, however often registration repeats it', () => {
  const stored = [enter(100, 'walking')];
  const drained = [enter(100, 'walking'), enter(100, 'walking'), enter(900, 'driving')];
  assert.deepEqual(unseenEvents(drained, stored), [enter(900, 'driving')]);
  assert.deepEqual(unseenEvents([], stored), []);
});

test('a replay a millisecond off is still the same event, as the P30 delivers them', () => {
  // Real ids 6 and 7, 2026-10-04: one drive, stored twice.
  const stored = [enter(1_791_124_332_428, 'driving')];
  assert.deepEqual(unseenEvents([enter(1_791_124_332_429, 'driving')], stored), []);
  assert.deepEqual(
    unseenEvents([enter(1_791_124_332_429, 'driving'), enter(1_791_124_332_430, 'driving')], []),
    [enter(1_791_124_332_429, 'driving')]
  );
  // A real change minutes later is kept.
  assert.equal(unseenEvents([enter(1_791_124_332_428 + 60_000, 'driving')], stored).length, 1);
});

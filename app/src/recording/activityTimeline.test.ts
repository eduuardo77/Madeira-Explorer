/**
 * What the user was doing at a moment, from activity transitions (D-094).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { activitiesAt, activityAfter, parseEvent, type ActivityEvent } from './activityTimeline.ts';

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

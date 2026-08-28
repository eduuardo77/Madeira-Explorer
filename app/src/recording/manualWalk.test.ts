/**
 * The walk button's decision table (2026-08-28).
 *
 *     cd app && npm test
 *
 * ⚠ The assertion that carries the project lead's instruction is
 * **"a fresh launch shows Start walk"** below. Everything else here is
 * arithmetic; that one is the requirement.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  actionForStartWalk,
  actionForStopWalk,
  isWalkInProgress,
  parseWalkStarted,
  type WalkState,
} from './manualWalk.ts';

const state = (over: Partial<WalkState> = {}): WalkState => ({
  startedByUser: false,
  recorderRunning: false,
  backgroundRecording: false,
  ...over,
});

test('a fresh launch shows Start walk, whatever the recorder is doing', () => {
  // ⚠⚠ THE REQUIREMENT. The app starts the recorder by itself on launch for
  // anybody with background recording (D-002, `syncRecordingWithPreferences`).
  // The button must not read that as a walk the user began.
  assert.equal(
    isWalkInProgress(state({ recorderRunning: true, backgroundRecording: true })),
    false
  );
  // And it is still false for someone whose recorder is running for any other
  // reason, which is the same bug wearing different clothes.
  assert.equal(isWalkInProgress(state({ recorderRunning: true })), false);
});

test('the button follows the user, and only the user', () => {
  assert.equal(isWalkInProgress(state({ startedByUser: true })), true);
  assert.equal(
    isWalkInProgress(state({ startedByUser: true, recorderRunning: false })),
    true,
    'a walk the user started stays started even if the recorder died'
  );
});

test('an unreadable stored value means no walk', () => {
  // The opposite default to parseBackgroundTracking, on purpose — see the note
  // on the function. A wrong `true` here offers Stop for a walk nobody started.
  assert.equal(parseWalkStarted(null), false);
  assert.equal(parseWalkStarted(''), false);
  assert.equal(parseWalkStarted('yes'), false);
  assert.equal(parseWalkStarted('TRUE'), true);
  assert.equal(parseWalkStarted('1'), true);
});

test('starting a walk never restarts a recorder that is already running', () => {
  // Restarting would close the open trip and open a new one, cutting one walk
  // into two rows nobody can rejoin (D-010).
  assert.equal(actionForStartWalk(state({ recorderRunning: true })), 'leave-alone');
  assert.equal(
    actionForStartWalk(state({ recorderRunning: true, backgroundRecording: true })),
    'leave-alone'
  );
  assert.equal(actionForStartWalk(state()), 'start');
});

test('stopping a walk stops the recorder only when the button owns it', () => {
  // Without background recording this button IS the recorder.
  assert.equal(
    actionForStopWalk(state({ startedByUser: true, recorderRunning: true })),
    'stop'
  );

  // ⚠ With it, the recorder belongs to D-002. Ending the walk must not turn off
  // the thing that fills the map in — the button never claimed to touch it.
  assert.equal(
    actionForStopWalk(
      state({ startedByUser: true, recorderRunning: true, backgroundRecording: true })
    ),
    'leave-alone'
  );

  // Nothing to stop is not an error.
  assert.equal(actionForStopWalk(state({ startedByUser: true })), 'leave-alone');
});

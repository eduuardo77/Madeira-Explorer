/**
 * The silent-recorder check (T-052b).
 *
 * The case that matters most is the last one: it is 2026-08-11 replayed. If
 * this module had existed then, the debug screen would have said in words what
 * took a day to work out.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_SILENCE_BEFORE_ALARM_MS,
  SILENCE_TOLERANCE,
  assessSilence,
  toleratedSilenceMs,
  type SilenceInput,
} from './recorderSilence.ts';
import { SAMPLING_PROFILES } from './samplingPolicy.ts';

const MINUTE = 60 * 1000;
const NOW = 1_700_000_000_000;

function input(overrides: Partial<SilenceInput> = {}): SilenceInput {
  return {
    isRecording: true,
    permission: 'always',
    profile: 'walking',
    recordingSinceTs: NOW - 60 * MINUTE,
    lastFixTs: NOW - MINUTE,
    now: NOW,
    ...overrides,
  };
}

test('a recorder that is off is never called silent', () => {
  const verdict = assessSilence(input({ isRecording: false }));

  assert.equal(verdict.state, 'not_recording');
  assert.equal(verdict.silentForMs, null);
});

test('recording that never started is not silent either', () => {
  // `isRecording` can be true while the diary holds no `start` — a task
  // restored by the OS across a relaunch. Silence is unmeasurable then.
  const verdict = assessSilence(input({ recordingSinceTs: null }));
  assert.equal(verdict.state, 'not_recording');
});

test('a fix arriving inside the profile window is healthy', () => {
  const verdict = assessSilence(input({ lastFixTs: NOW - MINUTE }));

  assert.equal(verdict.state, 'receiving');
  assert.match(verdict.detail, /last fix/);
});

test('a fresh start with no fix yet is warming up, not broken', () => {
  // Acquiring a first fix takes time and indoors may never happen. Calling
  // that a failure is the false alarm the health-check policy warns about.
  const verdict = assessSilence(
    input({ recordingSinceTs: NOW - MINUTE, lastFixTs: null })
  );

  assert.equal(verdict.state, 'warming_up');
  assert.match(verdict.detail, /waiting for a first fix/);
});

test('no permission points at the permission, not at the silence', () => {
  for (const permission of ['denied', 'undetermined'] as const) {
    const verdict = assessSilence(input({ permission, lastFixTs: null }));

    assert.equal(verdict.state, 'not_recording', permission);
    assert.match(verdict.detail, /not allowed/);
  }
});

test('the tolerated window comes from the profile, not from a constant here', () => {
  // The point of the design: retuning D-028's battery constants retunes this,
  // so the two cannot drift apart. If this fails, someone has hardcoded a
  // number next to the ones that already exist.
  for (const profile of ['stationary', 'walking', 'driving'] as const) {
    const parameters = SAMPLING_PROFILES[profile];
    const expected = Math.max(
      MIN_SILENCE_BEFORE_ALARM_MS,
      (parameters.deferredIntervalMs + parameters.minTimeMs) * SILENCE_TOLERANCE
    );

    assert.equal(toleratedSilenceMs(profile), expected, profile);
  }
});

test('a lazier profile tolerates a longer silence', () => {
  // Stationary defers 15 minutes by design; driving defers 3. Treating them
  // alike would either libel a parked phone or miss a dead recorder in a car.
  assert.ok(
    toleratedSilenceMs('stationary') > toleratedSilenceMs('walking'),
    'stationary should tolerate more than walking'
  );
  assert.ok(
    toleratedSilenceMs('walking') > toleratedSilenceMs('driving'),
    'walking should tolerate more than driving'
  );
});

test('no alarm before the floor, however eager the profile', () => {
  // Driving wants a fix every 15s; without the floor it would cry wolf while
  // the GPS was still acquiring.
  assert.ok(toleratedSilenceMs('driving') >= MIN_SILENCE_BEFORE_ALARM_MS);

  const verdict = assessSilence(
    input({
      profile: 'driving',
      recordingSinceTs: NOW - 30 * 1000,
      lastFixTs: null,
    })
  );
  assert.notEqual(verdict.state, 'silent');
});

test('silence just inside the window stays quiet, and just outside speaks', () => {
  const tolerated = toleratedSilenceMs('walking');

  const quiet = assessSilence(input({ lastFixTs: NOW - tolerated }));
  assert.equal(quiet.state, 'receiving');

  const loud = assessSilence(input({ lastFixTs: NOW - tolerated - 1000 }));
  assert.equal(loud.state, 'silent');
});

test('a clock that goes backwards does not produce a negative silence', () => {
  const verdict = assessSilence(input({ lastFixTs: NOW + 60 * MINUTE }));

  assert.equal(verdict.silentForMs, 0);
  assert.equal(verdict.state, 'receiving');
});

test('2026-08-11 replayed: recording for an hour, walking, no fix ever', () => {
  // The exact state the app was in for a day while reporting `Recording: yes`.
  // Permission was granted, the foreground service was up, and `raw_fix` was
  // empty because a `balanced` request cannot be served on an emulator (D-047).
  const verdict = assessSilence(
    input({
      profile: 'walking',
      recordingSinceTs: NOW - 60 * MINUTE,
      lastFixTs: null,
    })
  );

  assert.equal(verdict.state, 'silent');
  assert.match(verdict.detail, /no fix has EVER arrived/);
  assert.match(verdict.detail, /walking/);
  assert.equal(verdict.silentForMs, 60 * MINUTE);
});

test('the detail line names the profile, because the profile was the cause', () => {
  // D-047: `walking` and `stationary` ask for an accuracy an emulator cannot
  // serve and `driving` does not. Anyone reading this line on the emulator
  // should be pointed straight at the thing that differs.
  const verdict = assessSilence(
    input({ profile: 'stationary', lastFixTs: null, recordingSinceTs: NOW - 5 * 60 * MINUTE })
  );

  assert.equal(verdict.state, 'silent');
  assert.match(verdict.detail, /stationary/);
});

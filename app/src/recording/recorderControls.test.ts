/**
 * The home screen's word on recording, and what a walk changes (D-087, T-198).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveProfile,
  endNeedsConfirm,
  OUTING_AWAKE_MS,
  OUTING_CONFIRM_AFTER_MS,
  outingAwakeOver,
  outingKeepsAwake,
  offerAutomatic,
  primaryControl,
  recorderNotice,
  recordingStatus,
  walkSummary,
  describeWalkSummary,
  formatClock,
  formatDuration,
  type ControlInput,
} from './recorderControls.ts';


const NOW = Date.parse('2026-09-23T10:00:00Z');
const HOUR = 3_600_000;

function input(overrides: Partial<ControlInput> = {}): ControlInput {
  return {
    permission: 'always',
    automaticAllowed: true,
    walkInProgress: false,
    silence: 'receiving',
    ...overrides,
  };
}

test('the button: no location takes it over; otherwise it starts or stops a walk', () => {
  assert.equal(primaryControl(input({ permission: 'denied' })), 'grant-location');
  assert.equal(primaryControl(input({ permission: 'undetermined' })), 'grant-location');
  assert.equal(primaryControl(input()), 'start-walk');
  assert.equal(primaryControl(input({ walkInProgress: true })), 'stop-walk');
});

test('⚠ refusing background location still leaves a walk to start (D-008)', () => {
  // A walk records with the app open; that is the way D-008 keeps for them.
  assert.equal(primaryControl(input({ permission: 'while_using' })), 'start-walk');
});

test('⚠ P1-2 — the button never says "start" about the recorder that is already running', () => {
  // The review saw "Começar a registar" while automatic recording ran. The
  // button now names a walk, which is a separate thing the user starts.
  const running = input({ silence: 'receiving', automaticAllowed: true });
  assert.notEqual(primaryControl(running), 'grant-location');
  assert.equal(recorderNotice(running), null);
});

test('when automatic recording works, no notice is shown about it', () => {
  assert.equal(recorderNotice(input()), null);
  assert.equal(recorderNotice(input({ silence: 'warming_up' })), null);
});

test('D-095 — while automatic recording works, the status line says so', () => {
  // The question it answers: "do I need to click Começar passeio?"
  assert.equal(recordingStatus(input()), 'automatic');
  assert.equal(recordingStatus(input({ silence: 'warming_up' })), 'automatic');
  // A walk does not stop it being true.
  assert.equal(recordingStatus(input({ walkInProgress: true })), 'automatic');
});

test('⚠ D-095 — the status line never claims a recorder there is no evidence for', () => {
  // T-174: the flag outlived a dead service. Only arriving fixes count.
  assert.equal(recordingStatus(input({ silence: 'silent' })), null);
  assert.equal(recordingStatus(input({ silence: 'not_recording' })), null);
  assert.equal(recordingStatus(input({ automaticAllowed: false })), null);
  assert.equal(recordingStatus(input({ permission: 'while_using' })), null);
});

test('⚠ D-095 — the status line and a notice are never both shown', () => {
  const states: ControlInput[] = [];
  for (const permission of ['always', 'while_using', 'denied', 'undetermined'] as const) {
    for (const silence of ['not_recording', 'warming_up', 'receiving', 'silent'] as const) {
      for (const automaticAllowed of [true, false]) {
        states.push(input({ permission, silence, automaticAllowed }));
      }
    }
  }
  for (const state of states) {
    assert.ok(
      recordingStatus(state) === null || recorderNotice(state) === null,
      JSON.stringify(state)
    );
  }
});

test('switched off, the map asks once whether to record in the background (WalkNYC)', () => {
  assert.equal(offerAutomatic(input({ automaticAllowed: false }), false), true);
  assert.equal(offerAutomatic(input({ automaticAllowed: false, permission: 'while_using' }), false), true);
  assert.equal(offerAutomatic(input({ automaticAllowed: false }), true), false, 'answered no');
  assert.equal(offerAutomatic(input(), false), false, 'already on');
});

test('the question waits while an outing records, and never replaces the location request', () => {
  assert.equal(offerAutomatic(input({ automaticAllowed: false, walkInProgress: true }), false), false);
  assert.equal(offerAutomatic(input({ automaticAllowed: false, permission: 'denied' }), false), false);
  assert.equal(offerAutomatic(input({ automaticAllowed: false, permission: 'undetermined' }), false), false);
});

test('switched off on purpose is not a problem, so it is not announced', () => {
  assert.equal(recorderNotice(input({ automaticAllowed: false, permission: 'while_using' })), null);
});

test('missing "all the time" is said once, and can be dismissed', () => {
  const partial = input({ permission: 'while_using' });
  assert.equal(recorderNotice(partial), 'needs-always');
  assert.equal(recorderNotice(partial, new Set(['needs-always'])), null);
});

test('⚠⚠ T-174 — a silent recorder is announced, and cannot be dismissed', () => {
  // Three weeks on the P30 with the switch on and nothing recorded. Hiding
  // this state is how that went unnoticed.
  const dead = input({ silence: 'silent' });
  assert.equal(recorderNotice(dead), 'recorder-stopped');
  assert.equal(
    recorderNotice(dead, new Set(['needs-always'] as const)),
    'recorder-stopped'
  );
});

test('an outing never samples as stationary at its start: the ride was lost that way (T-246)', () => {
  const justStarted = { inProgress: true, startedTs: NOW, nowMs: NOW + 60_000 };
  assert.equal(effectiveProfile('stationary', justStarted), 'walking');
  assert.equal(effectiveProfile('walking', justStarted), 'walking');
  assert.equal(effectiveProfile('driving', justStarted), 'driving');
  // Without a walk, automatic recording keeps its cheap stationary profile.
  const none = { inProgress: false, startedTs: null, nowMs: NOW };
  assert.equal(effectiveProfile('stationary', none), 'stationary');
});

test('after its first minutes an outing sleeps at stops like automatic recording (T-285)', () => {
  const at = (elapsedMs: number) => ({ inProgress: true, startedTs: NOW, nowMs: NOW + elapsedMs });
  assert.equal(effectiveProfile('stationary', at(OUTING_AWAKE_MS - 1)), 'walking');
  assert.equal(effectiveProfile('stationary', at(OUTING_AWAKE_MS)), 'stationary');
  // A forgotten outing, the evening after: asleep, as automatic would be.
  assert.equal(effectiveProfile('stationary', at(6 * HOUR)), 'stationary');
  // Moving is untouched either way.
  assert.equal(effectiveProfile('walking', at(6 * HOUR)), 'walking');
  // The probe moves: the same outing, same profile, flips on the clock alone.
  assert.notEqual(
    effectiveProfile('stationary', at(0)),
    effectiveProfile('stationary', at(OUTING_AWAKE_MS))
  );
});

test('an unreadable outing start is asleep, not awake for ever (T-285)', () => {
  assert.equal(outingKeepsAwake({ inProgress: true, startedTs: null, nowMs: NOW }), false);
  // A clock that went backwards is not a fresh outing either.
  assert.equal(outingKeepsAwake({ inProgress: true, startedTs: NOW, nowMs: NOW - 1 }), false);
});

test('the gate puts an outing started standing still back to sleep when the window closes (T-285)', () => {
  const after = { inProgress: true, startedTs: NOW, nowMs: NOW + OUTING_AWAKE_MS };
  const during = { inProgress: true, startedTs: NOW, nowMs: NOW + 60_000 };
  assert.equal(outingAwakeOver('stationary', after, true), true);
  // Still inside the window, already re-applied, or moving: nothing to do.
  assert.equal(outingAwakeOver('stationary', during, true), false);
  assert.equal(outingAwakeOver('stationary', after, false), false);
  assert.equal(outingAwakeOver('walking', after, true), false);
  // An outing ended while awake: the next batch tidies up too.
  assert.equal(outingAwakeOver('stationary', { inProgress: false, startedTs: null, nowMs: NOW }, true), true);
});

test('the summary counts only the walk, and only what the map would draw', () => {
  const start = NOW;
  const end = NOW + HOUR;
  const summary = walkSummary({
    startTs: start,
    endTs: end,
    fixes: [
      { ts: start - 60_000, lat: 32.6, lon: -16.9, accuracy_m: 5 }, // before the walk
      { ts: start + 60_000, lat: 32.6, lon: -16.9, accuracy_m: 5 },
      { ts: start + 120_000, lat: 32.601, lon: -16.9, accuracy_m: 5 }, // ~111 m north
      { ts: start + 130_000, lat: 32.7, lon: -16.9, accuracy_m: 400 }, // a wild jump
      { ts: start + 180_000, lat: 32.602, lon: -16.9, accuracy_m: 5 }, // ~111 m more
      { ts: end + 60_000, lat: 32.9, lon: -16.9, accuracy_m: 5 }, // after it
    ],
    awards: [
      { placeId: 'later', awardedTs: start + 50 * 60_000 },
      { placeId: 'earlier', awardedTs: start + 10 * 60_000 },
      { placeId: 'yesterday', awardedTs: start - 24 * HOUR },
    ],
    maxAccuracyM: 120,
  });
  assert.equal(summary.durationMs, HOUR);
  assert.ok(summary.distanceM !== null);
  assert.ok(summary.distanceM > 200 && summary.distanceM < 245, String(summary.distanceM));
  assert.deepEqual(summary.placeIds, ['earlier', 'later']);
});

test('a walk with fewer than two usable fixes has no distance, not zero', () => {
  // "0 m" would claim the user stood still; the truth is the app does not know.
  const summary = walkSummary({
    startTs: NOW,
    endTs: NOW + HOUR,
    fixes: [{ ts: NOW + 1, lat: 32.6, lon: -16.9, accuracy_m: 5 }],
    awards: [],
    maxAccuracyM: 120,
  });
  assert.equal(summary.distanceM, null);
});

test('durations read as a person says them, and never as "0 min"', () => {
  assert.equal(formatDuration(20_000), '< 1 min');
  assert.equal(formatDuration(25 * 60_000), '25 min');
  assert.equal(formatDuration(65 * 60_000), '1 h 05 min');
});

test('the clock is local and zero-padded', () => {
  assert.equal(formatClock(new Date(2026, 8, 23, 9, 5).getTime()), '09:05');
});

test('the summary in Portuguese: time, distance, and the stamps by name', () => {
  const described = describeWalkSummary(
    { durationMs: 65 * 60_000, distanceM: 3200, placeIds: ['a', 'b'] },
    new Map([['a', 'Pico do Areeiro'], ['b', 'Pico Ruivo']]),
    'pt'
  );
  assert.equal(described.title, 'Passeio terminado');
  assert.deepEqual(described.lines, [
    '1 h 05 min · 3,2 km',
    'Carimbos obtidos: Pico do Areeiro, Pico Ruivo',
  ]);
});

test('no stamps and no distance are both said, not left blank', () => {
  const described = describeWalkSummary(
    { durationMs: 10 * 60_000, distanceM: null, placeIds: [] },
    new Map(),
    'en'
  );
  assert.deepEqual(described.lines, ['10 min · distance not measured', 'No new stamps on this outing.']);
});


// N21 (the lead, 2026-10-27): confirm ending an outing past a few minutes.
test('a second tap moments after starting still ends the outing at once', () => {
  const clock = (ranMs: number) => ({ inProgress: true, startedTs: NOW - ranMs, nowMs: NOW });
  // The two short outings of 26 Oct: 2 s and 9 s.
  assert.equal(endNeedsConfirm(clock(2_000)), null);
  assert.equal(endNeedsConfirm(clock(9_000)), null);
  assert.equal(endNeedsConfirm(clock(OUTING_CONFIRM_AFTER_MS - 1)), null);
});

test('an outing that has run a few minutes asks before it ends, with how long', () => {
  assert.equal(OUTING_CONFIRM_AFTER_MS, 3 * 60_000);
  const ran = 12 * 60_000;
  assert.equal(endNeedsConfirm({ inProgress: true, startedTs: NOW - ran, nowMs: NOW }), ran);
  assert.equal(formatDuration(ran), '12 min');
});

test('nothing asks when no outing runs, or its start cannot be read', () => {
  assert.equal(endNeedsConfirm({ inProgress: false, startedTs: null, nowMs: NOW }), null);
  assert.equal(endNeedsConfirm({ inProgress: true, startedTs: null, nowMs: NOW }), null);
});

/**
 * The home screen's word on recording, and what a walk changes (D-087, T-198).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  effectiveQuality,
  isPaused,
  primaryControl,
  recorderNotice,
  shouldStore,
  walkSummary,
  describeWalkSummary,
  formatClock,
  formatDuration,
  type ControlInput,
} from './recorderControls.ts';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NOW = Date.parse('2026-09-23T10:00:00Z');
const HOUR = 3_600_000;

function input(overrides: Partial<ControlInput> = {}): ControlInput {
  return {
    permission: 'always',
    automaticAllowed: true,
    walkInProgress: false,
    pausedUntilTs: null,
    silence: 'receiving',
    nowMs: NOW,
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

test('when automatic recording works, the home screen says nothing about it', () => {
  assert.equal(recorderNotice(input()), null);
  assert.equal(recorderNotice(input({ silence: 'warming_up' })), null);
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
    recorderNotice(dead, new Set(['needs-always', 'paused'] as const)),
    'recorder-stopped'
  );
});

test('a pause is shown while it lasts, and ends on its own', () => {
  const paused = input({ pausedUntilTs: NOW + HOUR });
  assert.equal(recorderNotice(paused), 'paused');
  assert.equal(isPaused(NOW + HOUR, NOW + HOUR), false, 'ends exactly at its end');
  assert.equal(recorderNotice(input({ pausedUntilTs: NOW - 1 })), null, 'a past pause is no pause');
});

test('nothing is stored while paused; everything is once it ends', () => {
  assert.equal(shouldStore(NOW + HOUR, NOW), false);
  assert.equal(shouldStore(NOW + HOUR, NOW + HOUR), true);
  assert.equal(shouldStore(null, NOW), true);
});

test('a walk takes the finest setting, and gives the user’s back when it ends', () => {
  assert.equal(effectiveQuality('saver', true), 'precise');
  assert.equal(effectiveQuality('saver', false), 'saver');
  assert.equal(effectiveQuality('balanced', false), 'balanced');
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

test('⚠ D-087 — the sink checks the pause on both of its write paths', () => {
  // A pause the recorder ignores would be a promise broken in silence.
  const source = readFileSync(path.join(srcRoot, 'recording/recordingSink.ts'), 'utf8');
  for (const handler of ['async onLocations(', 'async onGeofenceTransition(']) {
    const body = source.slice(source.indexOf(handler));
    const check = body.indexOf('shouldStore(');
    const store = body.indexOf('queue(');
    assert.ok(check !== -1 && check < store, `${handler} stores before checking the pause`);
  }
});


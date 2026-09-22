/**
 * The admission rules, and the real-hardware failures they were written from.
 *
 *     cd app && npm test
 *
 * ⚠ Every case below is taken from the P30's database (T-171/T-172/T-173,
 * `docs/field-notes.md`), not invented. Where a test says "measured", the
 * number came off the phone.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NOTIFICATION_REARM_AFTER_MS,
  batchMayStartTrip,
  fixMayStartTrip,
  isCredibleExit,
  mayRearmNotifications,
  mayStartForegroundService,
  shouldRecordTransition,
  transitionMayStartTrip,
} from './recordingAdmission.ts';
import type { Bounds } from '../progress/tripEnd.ts';

/** Madeira and Porto Santo together (D-021), near enough for a test. */
const BOUNDS: Bounds = {
  west: -17.3,
  south: 32.4,
  east: -16.2,
  north: 33.2,
};

const FUNCHAL = { lat: 32.65, lon: -16.91, accuracy_m: 8 };
/** Where the P30 actually was when the loop started. */
const LISBON = { lat: 38.72, lon: -9.14, accuracy_m: 12 };

// ---------------------------------------------------------------- T-171

test('a fix in Madeira may start a trip', () => {
  assert.equal(fixMayStartTrip(FUNCHAL, BOUNDS), true);
});

test('a fix on the mainland may NOT start a trip — this is the loop', () => {
  assert.equal(fixMayStartTrip(LISBON, BOUNDS), false);
});

test('Porto Santo is not abroad (D-021)', () => {
  assert.equal(
    fixMayStartTrip({ lat: 33.06, lon: -16.34, accuracy_m: 10 }, BOUNDS),
    true
  );
});

test('a fix too vague to be trusted abstains rather than blocking', () => {
  // The mirror of tripEndDetection's own rule: a fix that cannot end a holiday
  // must not be allowed to prevent one either. Same position, worse accuracy.
  assert.equal(fixMayStartTrip({ ...LISBON, accuracy_m: 4000 }, BOUNDS), true);
});

test('a fix with no reported accuracy is still judged on position', () => {
  // Abstaining here would mean any platform that omits the field could never
  // be refused — and the field is omitted often enough to matter.
  assert.equal(fixMayStartTrip({ lat: 38.72, lon: -9.14 }, BOUNDS), false);
  assert.equal(
    fixMayStartTrip({ lat: 38.72, lon: -9.14, accuracy_m: null }, BOUNDS),
    false
  );
});

test('one credible fix in the batch is enough to open the holiday', () => {
  // Generous on purpose (D-009): a batch delivered as the plane lands starts
  // the trip rather than waiting for the next wake-up.
  assert.equal(batchMayStartTrip([LISBON, LISBON, FUNCHAL], BOUNDS), true);
});

test('a batch entirely on the mainland opens nothing', () => {
  assert.equal(batchMayStartTrip([LISBON, LISBON, LISBON], BOUNDS), false);
});

test('an empty batch opens nothing', () => {
  assert.equal(batchMayStartTrip([], BOUNDS), false);
});

// ------------------------------------------------- T-171, notifications

test('a first install may arm the notification budget', () => {
  assert.equal(mayRearmNotifications(null, 1_000_000), true);
});

test('⚠ the churn case: a trip created seconds later may NOT re-arm', () => {
  // Measured: 25 trips each re-armed the budget and 26 "your trip has ended"
  // notifications went out. Trips 20 and 21 were one second apart.
  const ended = 1_800_000_000_000;
  assert.equal(mayRearmNotifications(ended, ended + 1_000), false);
});

test('a genuine repeat visit re-arms', () => {
  // CONTEXT §4.10: Madeira has an unusual number of repeat visitors, and
  // muting them on their second holiday is the failure the per-trip budget
  // exists to avoid. Months, not seconds.
  const ended = 1_800_000_000_000;
  assert.equal(mayRearmNotifications(ended, ended + 200 * 24 * 3_600_000), true);
});

test('the boundary is inclusive, so exactly the cooldown re-arms', () => {
  const ended = 1_800_000_000_000;
  assert.equal(
    mayRearmNotifications(ended, ended + NOTIFICATION_REARM_AFTER_MS),
    true
  );
  assert.equal(
    mayRearmNotifications(ended, ended + NOTIFICATION_REARM_AFTER_MS - 1),
    false
  );
});

// ---------------------------------------------------------------- T-172

test('an enter may start a trip; an exit may not', () => {
  assert.equal(transitionMayStartTrip('enter'), true);
  assert.equal(transitionMayStartTrip('exit'), false);
});

test('a dwell is evidence of being somewhere, so it may start a trip', () => {
  // Nothing emits it today — which is why it is stated rather than defaulted.
  assert.equal(transitionMayStartTrip('dwell'), true);
});

test('⚠ the registration burst: an exit with no enter behind it is dropped', () => {
  // All 2,699 crossings on the P30 were exits, 83 of them sharing a single
  // timestamp — every monitored region reporting EXIT as the set was
  // registered. You cannot leave somewhere you were never recorded entering.
  assert.equal(isCredibleExit(false), false);
  assert.equal(shouldRecordTransition('exit', false), false);
});

test('a real exit — one that follows an enter — is kept', () => {
  // This is half of a dwell, which is what stampRules and reconstructVisits
  // measure. Dropping it would break the award path to fix the noise.
  assert.equal(isCredibleExit(true), true);
  assert.equal(shouldRecordTransition('exit', true), true);
});

test('enters and dwells are always recorded, whatever came before', () => {
  assert.equal(shouldRecordTransition('enter', false), true);
  assert.equal(shouldRecordTransition('dwell', false), true);
});

// ---------------------------------------------------------------- T-173

test('a foreground service may only be started while the app is on screen', () => {
  // Measured: "Foreground service cannot be started when the application is in
  // the background", and the recorder did not start.
  assert.equal(mayStartForegroundService('active'), true);
  assert.equal(mayStartForegroundService('background'), false);
});

test('⚠ inactive is refused with background, not allowed with active', () => {
  // A phone call, the app switcher, a permission dialog. Android's restriction
  // does not care that it looks transient, and the retry costs a second.
  assert.equal(mayStartForegroundService('inactive'), false);
});

test('unknown is refused — the recorder can be woken with no UI at all', () => {
  // Guessing "active" here is exactly what T-173 was.
  assert.equal(mayStartForegroundService('unknown'), false);
});

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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NOTIFICATION_REARM_AFTER_MS,
  batchMayStartTrip,
  fixMayStartTrip,
  isCredibleExit,
  mayRearmNotifications,
  mayStartForegroundService,
  recordingAction,
  shouldRecordTransition,
  shouldRefreshGeofences,
  transitionMayStartTrip,
  tripHasLapsed,
} from './recordingAdmission.ts';
import type { Bounds } from '../progress/tripEnd.ts';
import { INACTIVITY_END_MS, detectTripEnd } from '../progress/tripEnd.ts';

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

// ---------------------------------------------------------------- T-174

const LAUNCH = {
  backgroundTrackingAllowed: true,
  permission: 'always',
  taskRegistered: false,
  visibility: 'active' as const,
};

test('⚠⚠ a registered task does NOT stop the recorder being re-asserted', () => {
  // The whole of T-174. On the P30 the task was registered, the switch was on,
  // the settings screen said "A registar a sua viagem" — and there was no
  // foreground service, no OS location request and no database write. The old
  // branch returned early on exactly this input and never restarted anything.
  assert.equal(recordingAction({ ...LAUNCH, taskRegistered: true }), 'assert');
  assert.equal(recordingAction({ ...LAUNCH, taskRegistered: false }), 'assert');
});

test('wanted but not startable from here defers rather than failing', () => {
  assert.equal(
    recordingAction({ ...LAUNCH, taskRegistered: true, visibility: 'background' }),
    'defer'
  );
});

test('not allowed, but something is running: refresh and never stop it', () => {
  // A manual walk. Stopping it would lose the one thing that cannot be
  // recreated (D-010).
  assert.equal(
    recordingAction({
      ...LAUNCH,
      backgroundTrackingAllowed: false,
      taskRegistered: true,
    }),
    'refresh'
  );
});

test('without Always permission the switch cannot deliver, so nothing happens', () => {
  assert.equal(
    recordingAction({ ...LAUNCH, permission: 'whenInUse', taskRegistered: false }),
    'none'
  );
});

test('⚠ a deferred launch still re-registers its regions', () => {
  // Geofencing needs no foreground service, and Android drops every geofence on
  // reboot. Skipping this was the first version of the fix.
  assert.equal(shouldRefreshGeofences('defer'), true);
  assert.equal(shouldRefreshGeofences('refresh'), true);
});

test('⚠ asserting does NOT also refresh — startTrip does it', () => {
  // Otherwise every launch registers the whole set twice.
  assert.equal(shouldRefreshGeofences('assert'), false);
  assert.equal(shouldRefreshGeofences('none'), false);
});

// ── T-195: a trip must be able to end after a silence, even once recording resumes ──

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Trip 30 on the P30, from its own database (`p30-2026-09-22d`). */
const TRIP_30 = {
  startedTs: Date.parse('2026-08-28T10:59:56Z'),
  lastFixBeforeGap: Date.parse('2026-08-28T12:21:25Z'),
  firstFixAfterGap: Date.parse('2026-09-22T09:19:50Z'),
};

test('⚠⚠ T-195 — trip 30: a 24.9-day silence has lapsed when the next fix arrives', () => {
  assert.equal(
    tripHasLapsed(
      { startedTs: TRIP_30.startedTs, lastFixTs: TRIP_30.lastFixBeforeGap },
      TRIP_30.firstFixAfterGap
    ),
    true
  );
});

test('T-195 — an ordinary gap in a live holiday has not lapsed', () => {
  const lastFixTs = TRIP_30.lastFixBeforeGap;
  // A night, a day at the pool, two days with the phone off.
  for (const hours of [8, 26, 48, 71]) {
    assert.equal(
      tripHasLapsed({ startedTs: TRIP_30.startedTs, lastFixTs }, lastFixTs + hours * 3_600_000),
      false,
      `${hours} h`
    );
  }
});

test('T-195 — the boundary is the same one detectTripEnd uses, so they cannot disagree', () => {
  const lastFixTs = TRIP_30.lastFixBeforeGap;
  for (const incomingTs of [
    lastFixTs + INACTIVITY_END_MS - 1,
    lastFixTs + INACTIVITY_END_MS,
    lastFixTs + INACTIVITY_END_MS + 1,
  ]) {
    const decision = detectTripEnd({
      tripStartedTs: TRIP_30.startedTs,
      now: incomingTs,
      departureVisits: [],
      hasTravelledElsewhere: true,
      leftBoundsTs: null,
      lastFixTs,
    });
    assert.equal(
      tripHasLapsed({ startedTs: TRIP_30.startedTs, lastFixTs }, incomingTs),
      decision.ended
    );
  }
});

test('T-195 — the lapsed trip ends at its last fix, not when the new evidence arrived', () => {
  // What the sink relies on when it calls checkTripEnd(incomingTs): the souvenir
  // must not claim 25 empty days (ARCHITECTURE §10).
  const decision = detectTripEnd({
    tripStartedTs: TRIP_30.startedTs,
    now: TRIP_30.firstFixAfterGap,
    departureVisits: [],
    hasTravelledElsewhere: true,
    leftBoundsTs: null,
    lastFixTs: TRIP_30.lastFixBeforeGap,
  });
  assert.equal(decision.method, 'inactivity');
  assert.equal(decision.endedTs, TRIP_30.lastFixBeforeGap);
});

test('T-195 — a trip with no fixes at all is measured from its start', () => {
  assert.equal(
    tripHasLapsed({ startedTs: TRIP_30.startedTs, lastFixTs: null }, TRIP_30.startedTs + INACTIVITY_END_MS),
    true
  );
});

test('⚠ T-195 — the sink asks before it stores, on both of its write paths', () => {
  // The pure rule is worthless if nothing calls it — T-145 and T-167 were both
  // that shape. Each handler must close a lapsed trip before choosing a trip.
  const source = readFileSync(path.join(srcRoot, 'recording/recordingSink.ts'), 'utf8');
  for (const handler of ['async onLocations(', 'async onGeofenceTransition(']) {
    const start = source.indexOf(handler);
    assert.notEqual(start, -1, handler);
    const body = source.slice(start);
    const close = body.indexOf('closeLapsedTrip(');
    const choose = body.indexOf('getOrCreateActiveTrip()');
    assert.notEqual(close, -1, `${handler} never closes a lapsed trip`);
    assert.ok(close < choose, `${handler} chooses a trip before closing a lapsed one`);
  }
});

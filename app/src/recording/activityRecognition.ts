/**
 * Android's activity transitions, from JavaScript (D-094).
 *
 * The native half is `app/modules/activity-transitions` (a local Expo module):
 * it registers with Play services, and its receiver queues every transition to
 * a file whether or not this code is running. This file asks for the
 * permission, registers once per process, and drains the queue.
 *
 * ⚠ **Optional everywhere.** No Play services, no permission, iOS, an old
 * build without the module: every function here answers "no" or "nothing" and
 * never throws, and the app works as it did before D-094 (the speed-only motion
 * gate). The permission is a benefit, never a gate (D-008's rule).
 */

import { PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

import * as recordingEventDao from '../storage/dao/recordingEventDao';
import { parseEvent, registrationDue, type ActivityEvent } from './activityTimeline';

type NativeActivityTransitions = {
  isAvailable(): boolean;
  hasPermission(): boolean;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  drain(): unknown[];
  diagnostics?(): Record<string, unknown>;
};

const native: NativeActivityTransitions | null =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<NativeActivityTransitions>('ActivityTransitions')
    : null;

/** Whether this phone can report activities at all. */
export function activityAvailable(): boolean {
  try {
    return native !== null && native.isAvailable();
  } catch {
    return false;
  }
}

export function activityPermitted(): boolean {
  try {
    return native !== null && native.hasPermission();
  } catch {
    return false;
  }
}

/** Show the system dialog. True when granted. */
export async function requestActivityPermission(): Promise<boolean> {
  if (!activityAvailable()) {
    return false;
  }
  if (activityPermitted()) {
    return true;
  }
  try {
    const answer = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
    );
    if (answer === PermissionsAndroid.RESULTS.GRANTED) {
      started = false; // register with the new permission
      await ensureActivityUpdates();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

let started = false;
let registeredMs: number | null = null;

/**
 * Register for transitions, and again every `ACTIVITY_REFRESH_MS`.
 * Registration does not survive a reboot or an update, so every process
 * registers again; Play services replaces the earlier request rather than
 * adding one.
 *
 * ⚠ **Again, and not once, since 2026-10-04:** on the P30 live transitions
 * never arrive, and each registration is what makes Play services say the
 * current activity (`registrationDue`). Removed first, so the request is new
 * rather than an unchanged one Play services might leave alone. The replay
 * lands in the queue a few milliseconds later and the next batch drains it.
 */
export async function ensureActivityUpdates(nowMs: number = Date.now()): Promise<boolean> {
  if (started && !registrationDue(registeredMs, nowMs)) {
    return true;
  }
  if (!activityAvailable() || !activityPermitted() || native === null) {
    return false;
  }
  try {
    if (started) {
      await native.stop();
    }
    started = await native.start();
  } catch {
    started = false;
  }
  registeredMs = started ? nowMs : null;
  // Whether the phone agreed to report transitions, written when the answer
  // changes: a refusal is retried every batch and must not flood the diary.
  // The native side keeps the same fact across processes (`activityDiagnostics`).
  if (lastLogged !== started) {
    lastLogged = started;
    const detail = started ? 'transitions registered' : 'transitions refused'; // i18n-exempt: written to the recording diary, never shown on a screen
    await recordingEventDao.log('activity', detail);
  }
  return started;
}

let lastLogged: boolean | null = null;

/**
 * What the native side has seen since install: deliveries, the events in
 * them, drains, registrations. For the diary and for a field check; null
 * when there is no native side.
 */
export function activityDiagnostics(): Record<string, unknown> | null {
  try {
    return native?.diagnostics?.() ?? null;
  } catch {
    return null;
  }
}

/** Every transition queued since the last drain; the queue is then empty. */
export function drainActivityEvents(): ActivityEvent[] {
  if (native === null) {
    return [];
  }
  try {
    return native
      .drain()
      .map(parseEvent)
      .filter((event): event is ActivityEvent => event !== null);
  } catch {
    return [];
  }
}

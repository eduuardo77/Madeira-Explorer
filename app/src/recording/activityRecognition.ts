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

import { parseEvent, type ActivityEvent } from './activityTimeline';

type NativeActivityTransitions = {
  isAvailable(): boolean;
  hasPermission(): boolean;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  drain(): unknown[];
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

/**
 * Register for transitions, once per process. Registration does not survive a
 * reboot or an update, so every process registers again; Play services
 * replaces the earlier request rather than adding one.
 */
export async function ensureActivityUpdates(): Promise<boolean> {
  if (started) {
    return true;
  }
  if (!activityAvailable() || !activityPermitted() || native === null) {
    return false;
  }
  try {
    started = await native.start();
  } catch {
    started = false;
  }
  return started;
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

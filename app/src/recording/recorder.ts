/**
 * The one recorder of this process: `recorderCore` with the real database,
 * provider, clock and alarms (E3, A3 of the 30 Oct fix plan).
 *
 * Thin on purpose. Each member below is one call `samplingGate.ts` or
 * `backgroundTasks.ts` made directly before the logic moved; what they decide
 * is in `recorderCore.ts`, where `recorderCore.test.ts` replays real batches
 * through it.
 */

import * as Location from 'expo-location';
import { AppState } from 'react-native';
import type { ActivityType, FixSource } from '../storage/types';
import * as appStateDao from '../storage/dao/appStateDao';
import { AppStateKey } from '../storage/dao/appStateDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import { announceNewStamps } from '../progress/stampAnnouncer';
import { scheduleMotionFollowUp } from './activityRecognition';
import { locationProvider } from './ExpoLocationProvider';
import { noteRecordedPosition } from './geofenceManager';
import type { LocationSample } from './LocationProvider';
import { followUpStep, WAKE_FIX_TIMEOUT_MS } from './motionWakePolicy';
import { createRecorder } from './recorderCore';
import { databaseSink } from './recordingSink';
import { getOutingAwakeApplied, readOutingClock } from './trackingSettings';

/**
 * Convert an Expo location into our own shape.
 *
 * Kept where Expo's types stop and ours begin. Everything downstream of this
 * function is backend-agnostic (D-025).
 */
export function toLocationSample(location: Location.LocationObject): LocationSample {
  const coords = location.coords;

  return {
    ts: location.timestamp,
    lat: coords.latitude,
    lon: coords.longitude,
    accuracyM: coords.accuracy ?? null,
    // Expo reports -1 for "unknown" on some platforms rather than null.
    speedMps: coords.speed !== null && coords.speed >= 0 ? coords.speed : null,
    bearingDeg: coords.heading !== null && coords.heading >= 0 ? coords.heading : null,
    altitudeM: coords.altitude ?? null,
    // expo-location does not surface platform activity recognition. Bout
    // segmentation (T-086) infers movement type from speed and cadence during
    // burst matching instead, which is where the whole trace is visible at once
    // and the inference is better anyway.
    activityType: 'unknown' satisfies ActivityType,
    source: 'fused' satisfies FixSource,
  };
}

/**
 * One GPS position for a wake, or null when none comes in time.
 *
 * ⚠ The timeout is a JavaScript timer, so in the background it may never fire
 * (T-295); nothing waits on this but the look that asked.
 */
async function wakePosition(): Promise<LocationSample | null> {
  const fix = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), WAKE_FIX_TIMEOUT_MS)),
  ]);
  return fix === null ? null : toLocationSample(fix);
}

export const recorder = createRecorder({
  now: () => Date.now(),
  state: {
    getProfile: () => appStateDao.get(AppStateKey.SamplingProfile),
    setProfile: (profile) => appStateDao.set(AppStateKey.SamplingProfile, profile),
    getProfileUpdatedTs: () => appStateDao.getUpdatedTs(AppStateKey.SamplingProfile),
    getStillCheck: () => appStateDao.getJson<unknown>(AppStateKey.StillCheckPending),
    setStillCheck: (value) => appStateDao.setJson(AppStateKey.StillCheckPending, value),
    clearStillCheck: () => appStateDao.set(AppStateKey.StillCheckPending, ''),
  },
  trace: {
    getActiveTripId: async () => (await tripDao.getActiveTrip())?.id ?? null,
    getMovementWindow: (tripId, sinceTs, limit) => rawFixDao.getMovementWindow(tripId, sinceTs, limit),
    getLastFixTs: async (tripId) => (await rawFixDao.getLastFix(tripId))?.ts ?? null,
  },
  provider: {
    isRecording: () => locationProvider.isRecording(),
    setSamplingProfile: (profile) => locationProvider.setSamplingProfile(profile),
    currentPosition: wakePosition,
  },
  outing: {
    readClock: readOutingClock,
    getAwakeApplied: getOutingAwakeApplied,
  },
  scheduleAlarm: (delayMs, followUp) => scheduleMotionFollowUp(delayMs, followUpStep(followUp)),
  setTimer: (delayMs, run) => {
    setTimeout(run, delayMs);
  },
  batch: {
    store: (samples) => databaseSink.onLocations(samples),
    noteLatest: (latest) => noteRecordedPosition({ lat: latest.lat, lon: latest.lon }),
    // D-096: a stamp is said when it is earned, not when the app is next
    // opened. After the gate, because it can only add to it: nothing here may
    // cost a fix. On screen, the map's pop-up says it instead.
    afterGate: () => announceNewStamps(Date.now(), AppState.currentState === 'active'),
  },
  diary: {
    log: (kind, detail) => recordingEventDao.log(kind, detail),
    logError: (where, error) => recordingEventDao.logError(where, error),
  },
});

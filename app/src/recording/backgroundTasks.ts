/**
 * Background task definitions.
 *
 * MUST BE IMPORTED AT APP STARTUP, BEFORE ANYTHING RENDERS.
 *
 * `TaskManager.defineTask` has to run in the global scope of the JS bundle. When
 * the OS relaunches the app headless to deliver a batch of locations or a
 * geofence crossing, it loads the bundle and immediately looks for a task with
 * the matching name. If the definition were tucked inside a component, or behind
 * a lazy import, the task would not exist yet and the event would be dropped —
 * silently, on a user's phone, in the middle of their holiday.
 *
 * That is why `index.ts` imports this module for its side effects.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type {
  ActivityType,
  FixSource,
  GeofenceEventType,
} from '../storage/types';
import { AppState } from 'react-native';
import { announceNewStamps } from '../progress/stampAnnouncer';
import { checkTripEnd, isDeparturePoint } from '../progress/tripEndDetection';
import { handleAnchorExit, noteRecordedPosition } from './geofenceManager';
import { ANCHOR_REGION_ID, isMechanismRegionId } from './geofenceSelection';
import type { LocationSample, SamplingProfile } from './LocationProvider';
import { databaseSink } from './recordingSink';
import { applySamplingGate } from './samplingGate';
import { GEOFENCE_TASK_NAME, LOCATION_TASK_NAME, MOTION_TASK_NAME } from './taskNames';
import { getCurrentSamplingProfile, lowerProfile, raiseProfile } from './samplingGate';
import {
  canStartStillCheck,
  confirmsDriving,
  decideStillCheck,
  type MotionLabel,
  type FollowUp,
  followUpStep,
  nextWakeCheck,
  parseFollowUp,
  parsePendingStillCheck,
  type PendingStillCheck,
  STILL_CHECK_WAIT_MS,
  WAKE_FIX_TIMEOUT_MS,
} from './motionWakePolicy';
import type { MovementSample } from './movementPolicy';
import { scheduleMotionFollowUp } from './activityRecognition';
import * as appStateDao from '../storage/dao/appStateDao';
import { AppStateKey } from '../storage/dao/appStateDao';
import { locationProvider } from './ExpoLocationProvider';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import { loadLanguageChoice } from '../i18n/languageChoice';

/**
 * Convert an Expo location into our own shape.
 *
 * Kept here rather than in the provider because this is where Expo's types stop
 * and ours begin. Everything downstream of this function is backend-agnostic
 * (D-025).
 */
function toLocationSample(location: Location.LocationObject): LocationSample {
  const coords = location.coords;

  return {
    ts: location.timestamp,
    lat: coords.latitude,
    lon: coords.longitude,
    accuracyM: coords.accuracy ?? null,
    // Expo reports -1 for "unknown" on some platforms rather than null.
    speedMps: coords.speed !== null && coords.speed >= 0 ? coords.speed : null,
    bearingDeg:
      coords.heading !== null && coords.heading >= 0 ? coords.heading : null,
    altitudeM: coords.altitude ?? null,
    // expo-location does not surface platform activity recognition. Bout
    // segmentation (T-086) infers movement type from speed and cadence during
    // burst matching instead, which is where the whole trace is visible at once
    // and the inference is better anyway.
    activityType: 'unknown' satisfies ActivityType,
    source: 'fused' satisfies FixSource,
  };
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  // T-202: this can run with no App.tsx behind it, and what it posts (the
  // recorder's notification, the reveal) must speak the language the user chose.
  await loadLanguageChoice();
  if (error) {
    await databaseSink.onError(`location task: ${error.message}`);
    return;
  }
  if (!data) {
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!Array.isArray(locations) || locations.length === 0) {
    return;
  }

  await recordSamples(locations.map(toLocationSample));
});

/**
 * What every batch goes through, from the OS or from a motion wake: stored,
 * the anchor backstop, the sampling gate, the stamp announcer.
 */
async function recordSamples(samples: LocationSample[]): Promise<void> {
  // Storage first, always. The trace is the irreplaceable thing (D-010); the
  // geofence window can be rebuilt from nothing at any time.
  await databaseSink.onLocations(samples);

  // Then the backstop for a missed anchor exit (T-039). It normally decides in
  // one distance calculation that there is nothing to do.
  const latest = samples[samples.length - 1];
  await noteRecordedPosition({ lat: latest.lat, lon: latest.lon });

  // And finally the sampling gate (T-034). Last because it is the only one of
  // the three that can change what the OS does next, and because it wants the
  // fixes above already committed — it reads the window back out of the
  // database rather than trusting this batch alone.
  //
  // `latest.ts`, not `Date.now()`: the OS may have been holding this batch for
  // several minutes (that deferral is the point — ARCHITECTURE §7), and judging
  // staleness against wall-clock would read a perfectly healthy batch as an
  // outage.
  await applySamplingGate(latest.ts);

  // D-096: a stamp is said when it is earned, not when the app is next opened.
  // After everything above, because it can only add to it: nothing here may
  // cost a fix. On screen, the map's pop-up says it instead.
  await announceNewStamps(Date.now(), AppState.currentState === 'active');
}

/**
 * The motion wake (D-106): the native side runs this when the phone's motion
 * sensor fires or Google says walking, cycling or driving. While the recorder
 * is stationary it looks for a GPS position up to three times over three
 * minutes (`motionWakePolicy.ts`), each through the same pipeline as any batch,
 * so the sampling gate alone decides whether the phone has left. Anything else
 * (already recording, recording off) and it does nothing.
 *
 * ⚠ T-295: no wait in here is a JavaScript timer. In the background React
 * Native's timers do not run (31 Oct 2026, a five minute wait that never
 * ended), so each wait is an Android alarm that runs this task again with
 * `source: 'follow_up'` and the step to take.
 */
TaskManager.defineTask(MOTION_TASK_NAME, async ({ data, error }) => {
  await loadLanguageChoice();
  if (error) {
    await databaseSink.onError(`motion wake: ${error.message}`);
    return;
  }
  if (!(await locationProvider.isRecording())) {
    return;
  }
  const { source, activity, step } = (data ?? {}) as {
    source?: string;
    activity?: string;
    step?: string;
  };
  if (source === 'follow_up') {
    const followUp = parseFollowUp(step);
    if (followUp?.kind === 'look') await wakeLook(followUp.index);
    if (followUp?.kind === 'still') await finishStillCheck();
    return;
  }
  const profile = await getCurrentSamplingProfile();
  const nowMs = Date.now();
  const previousLabel = lastLabel;
  if (activity !== undefined) {
    lastLabel = { activity, ts: nowMs };
    if (activity !== 'still') lastMovingSignalMs = nowMs;
  }
  if (activity === 'still') {
    if (profile !== 'stationary') await startStillCheck(profile);
    return;
  }
  if (profile !== 'stationary') {
    // Already recording: only a car can make it denser (`raiseProfile`), and
    // only when the sensors say so twice running (T-296, floor -1 on 31 Oct).
    if (profile === 'walking' && activity === 'driving') {
      if (confirmsDriving(previousLabel, activity, nowMs)) {
        await raiseProfile('driving', 'the motion sensors say driving twice'); // i18n-exempt: diary reason, D-106
      } else {
        await recordingEventDao.log('activity', 'motion sensors say driving once, waiting for a second'); // i18n-exempt: diary line, T-296
      }
    }
    return;
  }
  await recordingEventDao.log('activity', `motion wake: ${source ?? 'unknown'}${activity ? ` (${activity})` : ''}`); // i18n-exempt: diary line, D-106
  await wakeLook(0);
});

/** The newest moving label from the motion wake, for the still check (T-286). */
let lastMovingSignalMs: number | null = null;
/**
 * The newest label of any kind, for confirming a drive (T-296). In memory: a
 * restart forgets it, which only means waiting for one more label.
 */
let lastLabel: MotionLabel | null = null;

/**
 * Wait `delayMs`, then run `followUp`: by an Android alarm where there is one
 * (T-295), else by a timer, which keeps time only while the app is open.
 */
function scheduleFollowUp(delayMs: number, followUp: FollowUp): void {
  if (scheduleMotionFollowUp(delayMs, followUpStep(followUp))) return;
  setTimeout(() => {
    void (followUp.kind === 'look' ? wakeLook(followUp.index) : finishStillCheck());
  }, delayMs);
}

/**
 * Look `index` of a motion wake: one position while the recorder is still
 * stationary. The next look is booked first, so a position that never comes
 * cannot end the wake; the next look itself gives up once the gate has left
 * stationary.
 */
async function wakeLook(index: number): Promise<void> {
  const profile = await getCurrentSamplingProfile();
  if (nextWakeCheck(index, profile) === null) return;
  if (index > 0) {
    await recordingEventDao.log('activity', `motion wake: look ${index + 1}`); // i18n-exempt: diary line, T-295
  }
  const wait = nextWakeCheck(index + 1, profile);
  if (wait !== null) scheduleFollowUp(wait, { kind: 'look', index: index + 1 });
  const fix = await wakePosition();
  if (fix !== null) {
    await recordSamples([fix]);
  }
}

/**
 * One GPS position for a wake, or null when none comes in time.
 *
 * ⚠ The timeout is a JavaScript timer, so in the background it may never fire
 * (T-295); nothing waits on this function any more but the look that asked.
 */
async function wakePosition(): Promise<LocationSample | null> {
  const fix = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), WAKE_FIX_TIMEOUT_MS)),
  ]);
  return fix === null ? null : toLocationSample(fix);
}

async function readStillCheck(): Promise<PendingStillCheck | null> {
  try {
    return parsePendingStillCheck(await appStateDao.getJson<unknown>(AppStateKey.StillCheckPending));
  } catch {
    return null;
  }
}

/**
 * T-286: the sensors say still while on a moving profile. A position now and
 * one five minutes later, each recorded like any batch, and the pure check
 * decides (`decideStillCheck`). Any fix that arrives meanwhile goes through
 * the gate as usual, which may already have decided.
 *
 * ⚠ T-295: the second half runs from an alarm (`finishStillCheck`), and the
 * check under way is kept in `app_state`. The in-memory flag this replaced
 * was left set by a wait that never ended (31 Oct), and blocked every later
 * check.
 *
 * ⚠ N15: it waits the five minutes even when the first look finds nothing.
 * It used to give up there, and indoors that is every time.
 */
async function startStillCheck(profile: SamplingProfile): Promise<void> {
  const wakeMs = Date.now();
  if (!canStartStillCheck(await readStillCheck(), wakeMs)) return;
  await appStateDao.setJson(AppStateKey.StillCheckPending, { wakeMs, first: null });
  await recordingEventDao.log('activity', `still check: started on ${profile}`); // i18n-exempt: diary line, T-286
  // Booked before the first look, so a look that never returns cannot cost the check.
  scheduleFollowUp(STILL_CHECK_WAIT_MS, { kind: 'still' });
  const first = await wakePosition();
  if (first === null) return;
  await recordSamples([first]);
  const pending = await readStillCheck();
  if (pending?.wakeMs === wakeMs) {
    const sample: MovementSample = {
      ts: first.ts,
      lat: first.lat,
      lon: first.lon,
      accuracyM: first.accuracyM,
    };
    await appStateDao.setJson(AppStateKey.StillCheckPending, { wakeMs, first: sample });
  }
}

/** The still check's second half, five minutes on, from the alarm (T-295). */
async function finishStillCheck(): Promise<void> {
  const pending = await readStillCheck();
  if (pending === null) return;
  await appStateDao.set(AppStateKey.StillCheckPending, '');
  if ((await getCurrentSamplingProfile()) === 'stationary') return; // the gate got there first
  const second = await wakePosition();
  if (second !== null) await recordSamples([second]);
  const after = await getCurrentSamplingProfile();
  const nowMs = Date.now();
  const check = decideStillCheck(after, pending.first, second, lastMovingSignalMs, pending.wakeMs, nowMs);
  if (check.sleep) {
    await lowerProfile(check.reason);
  } else {
    const waitedMin = Math.round((nowMs - pending.wakeMs) / 60000);
    await recordingEventDao.log('activity', `still check: stay after ${waitedMin} min, ${check.reason}`); // i18n-exempt: diary line, T-286
  }
}

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  await loadLanguageChoice();
  if (error) {
    await databaseSink.onError(`geofence task: ${error.message}`);
    return;
  }
  if (!data) {
    return;
  }

  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };

  // `identifier` is the POI id we registered the region under. Without it we
  // cannot attribute the crossing to anything, so drop rather than guess.
  if (!region?.identifier) {
    await databaseSink.onError('geofence event with no region identifier');
    return;
  }

  // Mechanism regions are not places, and must never reach `geofence_event` —
  // one would show up later as a stamp for somewhere that does not exist. The
  // check is on the reserved prefix rather than on the anchor's own id, so that
  // a second mechanism region cannot be added without this staying correct.
  if (isMechanismRegionId(region.identifier)) {
    // The anchor's exit is the manager's tripwire for "you have travelled far
    // enough that the monitored set is stale" (T-039).
    if (
      region.identifier === ANCHOR_REGION_ID &&
      eventType === Location.GeofencingEventType.Exit
    ) {
      await handleAnchorExit();
    }
    return;
  }

  const transitionType: GeofenceEventType =
    eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit';

  await databaseSink.onGeofenceTransition({
    poiId: region.identifier,
    ts: Date.now(),
    eventType: transitionType,
    accuracyM: null,
  });

  // Written down first, judged second. A crossing at a departure point is how
  // the holiday ends (D-012), and catching it here is what puts the reveal in
  // the departure lounge rather than at the next app launch.
  //
  // ⚠ Only at a departure point (T-254, measured on the P30 2026-10-07).
  // Crossings arrive in bursts, up to about seventy at once in the minute
  // after a launch, nearly all exits from places the phone is nowhere near,
  // and the check reads every crossing and fix of the trip: run for each, they
  // held the JavaScript thread for seconds at a time and grew its heap past
  // 160 MB. No other crossing can end a trip; the launch and the lapse rule
  // still check.
  if (isDeparturePoint(region.identifier)) {
    await checkTripEnd();
  }
});

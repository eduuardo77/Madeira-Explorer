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
import type { GeofenceEventType } from '../storage/types';
import { checkTripEnd, isDeparturePoint } from '../progress/tripEndDetection';
import { handleAnchorExit } from './geofenceManager';
import { ANCHOR_REGION_ID, isMechanismRegionId } from './geofenceSelection';
import { databaseSink } from './recordingSink';
import { GEOFENCE_TASK_NAME, LOCATION_TASK_NAME, MOTION_TASK_NAME } from './taskNames';
import { recorder, toLocationSample } from './recorder';
import type { MotionWakeData } from './recorderCore';
import { loadLanguageChoice } from '../i18n/languageChoice';

// ⚠ E3, 2026-10-31: what the location and motion tasks do with their data is
// in `recorderCore.ts` (`recordSamples`, `onMotionWake`), unchanged, so it can
// be replayed in Node (`recorderCore.test.ts`). The tasks stay here, because
// they must be defined in the bundle's global scope.

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

  // Stored, the anchor backstop, the sampling gate, the stamp announcer.
  await recorder.recordSamples(locations.map(toLocationSample));
});

/**
 * The motion wake (D-106): the native side runs this when the phone's motion
 * sensor fires, Google says walking, cycling, driving or still, or an alarm
 * comes back for a follow-up (T-295). `recorderCore.onMotionWake` decides.
 */
TaskManager.defineTask(MOTION_TASK_NAME, async ({ data, error }) => {
  await loadLanguageChoice();
  if (error) {
    await databaseSink.onError(`motion wake: ${error.message}`);
    return;
  }
  await recorder.onMotionWake((data ?? null) as MotionWakeData | null);
});

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

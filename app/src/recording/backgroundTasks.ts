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
import { handleAnchorExit, noteRecordedPosition } from './geofenceManager';
import { ANCHOR_REGION_ID } from './geofenceSelection';
import type { LocationSample } from './LocationProvider';
import { databaseSink } from './recordingSink';
import { applySamplingGate } from './samplingGate';
import { GEOFENCE_TASK_NAME, LOCATION_TASK_NAME } from './taskNames';

export { GEOFENCE_TASK_NAME, LOCATION_TASK_NAME };

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

  const samples = locations.map(toLocationSample);

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
});

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
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

  // The anchor is not a place — it is the manager's own tripwire for "you have
  // travelled far enough that the monitored set is stale" (T-039). It must
  // never reach `geofence_event`, or it would show up later as a stamp for
  // somewhere that does not exist.
  if (region.identifier === ANCHOR_REGION_ID) {
    if (eventType === Location.GeofencingEventType.Exit) {
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
});

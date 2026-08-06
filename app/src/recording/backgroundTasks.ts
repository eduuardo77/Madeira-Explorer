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
import type { LocationSample } from './LocationProvider';
import { databaseSink } from './recordingSink';

export const LOCATION_TASK_NAME = 'madeira-location-updates';
export const GEOFENCE_TASK_NAME = 'madeira-geofencing';

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

  await databaseSink.onLocations(locations.map(toLocationSample));
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

  const transitionType: GeofenceEventType =
    eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit';

  await databaseSink.onGeofenceTransition({
    poiId: region.identifier,
    ts: Date.now(),
    eventType: transitionType,
    accuracyM: null,
  });
});

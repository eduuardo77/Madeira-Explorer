/**
 * Where recorded data lands: straight into SQLite.
 *
 * This is the implementation of `RecordingSink`. It is imported at module scope
 * by the background task definitions, because when the OS relaunches us headless
 * there is no React tree to hand a callback to — see the long note in
 * LocationProvider.ts.
 *
 * THE ONE RULE IN THIS FILE: never throw.
 *
 * A thrown error here means a dropped batch, and a dropped batch is the only
 * unrecoverable failure this app has (D-010). Everything is caught, recorded in
 * the diary, and swallowed.
 *
 * THE SECOND RULE, ADDED 2026-08-12 (T-052c): one at a time.
 *
 * The OS delivers work here in bursts and does not wait for us in between — a
 * single wake-up commonly brings a batch of locations *and* a geofence
 * crossing, and a cold start with a large monitored set delivered 99 crossings
 * inside 100 ms. Two concrete bugs came out of that overlap, and both are
 * described in `storage/serialQueue.ts`: duplicate trips from the read-then-
 * insert in `getOrCreateActiveTrip`, and `expo-sqlite` rejecting with *"Cannot
 * use shared object that was already released"* under concurrent statements.
 *
 * Every entry point below therefore goes through `queue`. The queue is private
 * to this module: it is the boundary the OS delivers to, and nothing inside it
 * re-enters it.
 */

import * as geofenceEventDao from '../storage/dao/geofenceEventDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as sensorSampleDao from '../storage/dao/sensorSampleDao';
import * as tripDao from '../storage/dao/tripDao';
import { createSerialQueue } from '../storage/serialQueue';
import type { RawFixInput } from '../storage/types';
import type {
  GeofenceTransition,
  LocationSample,
  RecordingSink,
} from './LocationProvider';
import { getStepsBetween, readBarometerOnce } from './sensors';

async function captureSensorsFor(
  tripId: number,
  tripStartedTs: number,
  atTs: number
): Promise<void> {
  // Steps are a delta since the previous sample, so the window starts wherever
  // the last one ended. Falling back to trip start means the very first sample
  // covers everything since install rather than silently reporting zero.
  const previous = await sensorSampleDao.getLastSample(tripId);
  const windowStart = previous?.ts ?? tripStartedTs;

  const [barometer, steps] = await Promise.all([
    readBarometerOnce(),
    getStepsBetween(windowStart, atTs),
  ]);

  // Nothing worth writing — no barometer on this device and no step data.
  if (barometer === null && steps === null) {
    return;
  }

  await sensorSampleDao.insertSamples([
    {
      trip_id: tripId,
      ts: atTs,
      pressure_hpa: barometer?.pressureHpa ?? null,
      relative_altitude_m: barometer?.relativeAltitudeM ?? null,
      step_count_delta: steps,
    },
  ]);
}

/**
 * One queue for the whole sink, not one per method.
 *
 * `onLocations` and `onGeofenceTransition` both call `getOrCreateActiveTrip`,
 * so they race *each other* as readily as they race themselves — and the OS
 * delivering a location batch and a crossing in the same wake-up is the normal
 * case, not the unusual one.
 */
const queue = createSerialQueue();

export const databaseSink: RecordingSink = {
  async onLocations(samples: LocationSample[]): Promise<void> {
    if (samples.length === 0) {
      return;
    }

    await queue(async () => {
      try {
        const trip = await tripDao.getOrCreateActiveTrip();

        const rows: RawFixInput[] = samples.map((sample) => ({
          trip_id: trip.id,
          ts: sample.ts,
          lat: sample.lat,
          lon: sample.lon,
          accuracy_m: sample.accuracyM,
          speed_mps: sample.speedMps,
          bearing_deg: sample.bearingDeg,
          altitude_m: sample.altitudeM,
          activity_type: sample.activityType,
          source: sample.source,
        }));

        // Fixes first, sensors second. If the process is killed between the
        // two, we would rather have the trace without the barometer than the
        // other way round.
        const inserted = await rawFixDao.insertFixes(rows);

        const latestTs = samples[samples.length - 1].ts;
        await captureSensorsFor(trip.id, trip.started_ts, latestTs);

        await recordingEventDao.log('batch', `${inserted} fixes`);
      } catch (error) {
        await recordingEventDao.logError('onLocations', error);
      }
    });
  },

  async onGeofenceTransition(transition: GeofenceTransition): Promise<void> {
    await queue(async () => {
      try {
        const trip = await tripDao.getOrCreateActiveTrip();
        await geofenceEventDao.insertEvent({
          trip_id: trip.id,
          poi_id: transition.poiId,
          ts: transition.ts,
          event_type: transition.eventType,
          accuracy_m: transition.accuracyM,
        });
        await recordingEventDao.log(
          'batch',
          `geofence ${transition.eventType} ${transition.poiId}`
        );
      } catch (error) {
        await recordingEventDao.logError('onGeofenceTransition', error);
      }
    });
  },

  async onError(message: string): Promise<void> {
    // Queued like the rest: this writes to the same database, and an error
    // arriving during a burst is exactly when it must not collide with one.
    await queue(async () => {
      await recordingEventDao.logError('provider', message);
    });
  },
};

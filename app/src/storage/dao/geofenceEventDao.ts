/**
 * Reads and writes for `geofence_event` — the backbone of the reward system
 * (D-005).
 *
 * Note what is *not* here: any award logic. We store the raw enter/exit/dwell
 * log and apply the dwell + speed gate (D-009) later, over this data. That
 * separation is what lets the thresholds be retuned against real trip data
 * without re-collecting anything.
 */

import { getDatabase } from '../database';
import type { GeofenceEvent, GeofenceEventInput } from '../types';

export async function insertEvent(event: GeofenceEventInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO geofence_event (trip_id, poi_id, ts, event_type, accuracy_m)
     VALUES (?, ?, ?, ?, ?);`,
    event.trip_id,
    event.poi_id,
    event.ts,
    event.event_type,
    event.accuracy_m
  );
}

export async function countEvents(tripId: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM geofence_event WHERE trip_id = ?;',
    tripId
  );
  return row?.n ?? 0;
}

/**
 * Every crossing of the trip, oldest first — the input to the award pass
 * (T-071). A week of geofence crossings is a few hundred rows at most.
 */
export async function getAllEvents(tripId: number): Promise<GeofenceEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<GeofenceEvent>(
    'SELECT * FROM geofence_event WHERE trip_id = ? ORDER BY ts;',
    tripId
  );
}

export async function getRecentEvents(
  tripId: number,
  limit: number
): Promise<GeofenceEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<GeofenceEvent>(
    'SELECT * FROM geofence_event WHERE trip_id = ? ORDER BY ts DESC LIMIT ?;',
    tripId,
    limit
  );
}

export async function getEventsForPoi(
  tripId: number,
  poiId: string
): Promise<GeofenceEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<GeofenceEvent>(
    'SELECT * FROM geofence_event WHERE trip_id = ? AND poi_id = ? ORDER BY ts;',
    tripId,
    poiId
  );
}

/**
 * Is the user recorded as inside this place: is the latest enter or exit
 * recorded for it in this trip an enter? Dwells are not counted, as
 * `reconstructVisits` ignores them.
 *
 * ⚠ **T-172, T-274.** The only caller is `recordingSink`, deciding whether an
 * incoming crossing changes anything or is the registration burst repeating
 * itself (`recordingAdmission.shouldRecordTransition`). One row from the
 * `(trip_id, poi_id, ts)` index: this runs on the OS's delivery path, where a
 * cold start can bring 99 crossings inside 100 ms (`storage/serialQueue.ts`),
 * so it has to be an index probe and nothing more.
 */
export async function isInsideInTrip(tripId: number, poiId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ event_type: string }>(
    `SELECT event_type FROM geofence_event
      WHERE trip_id = ? AND poi_id = ? AND event_type IN ('enter', 'exit')
      ORDER BY ts DESC, id DESC
      LIMIT 1;`,
    tripId,
    poiId
  );
  return row?.event_type === 'enter';
}

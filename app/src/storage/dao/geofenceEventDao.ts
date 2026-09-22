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
 * Has this place ever been *entered* during this trip?
 *
 * ⚠ **T-172.** The only caller is `recordingSink`, deciding whether an incoming
 * exit is a real crossing or one of the registration burst — 2,699 of which
 * landed on the P30, 83 sharing a single timestamp. `EXISTS` rather than a
 * count or a fetch: this runs on the OS's delivery path, where a cold start can
 * bring 99 crossings inside 100 ms (`storage/serialQueue.ts`), so it has to be
 * an index probe and nothing more.
 */
export async function hasEnterInTrip(
  tripId: number,
  poiId: string
): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ found: number }>(
    `SELECT EXISTS(
       SELECT 1 FROM geofence_event
        WHERE trip_id = ? AND poi_id = ? AND event_type IN ('enter', 'dwell')
     ) AS found;`,
    tripId,
    poiId
  );
  return row?.found === 1;
}

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

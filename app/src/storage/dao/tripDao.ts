/**
 * Trip lifecycle.
 *
 * A trip is opened lazily on the first recorded fix and closed by trip-end
 * detection (Phase 5, D-012). For Phase 1 we only need "get or create the
 * active trip", which is what the recorder calls on every batch.
 */

import { getDatabase } from '../database';
import type { EndDetectionMethod, Trip } from '../types';

export async function getActiveTrip(): Promise<Trip | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Trip>(
    'SELECT * FROM trip WHERE ended_ts IS NULL ORDER BY started_ts DESC LIMIT 1;'
  );
  return row ?? null;
}

/**
 * Return the active trip, creating one if there is none.
 *
 * Called from the background task on every batch, so it must be cheap and must
 * never throw — a failure here means we drop a batch of fixes, which is the one
 * thing we cannot recover (D-010).
 */
export async function getOrCreateActiveTrip(): Promise<Trip> {
  const existing = await getActiveTrip();
  if (existing !== null) {
    return existing;
  }

  const db = await getDatabase();
  const startedTs = Date.now();
  const result = await db.runAsync(
    'INSERT INTO trip (started_ts) VALUES (?);',
    startedTs
  );

  return {
    id: result.lastInsertRowId,
    started_ts: startedTs,
    ended_ts: null,
    end_detection_method: null,
    home_mask_lat: null,
    home_mask_lon: null,
    home_mask_radius_m: null,
  };
}

/**
 * The latest trip, ended or not.
 *
 * The souvenir is exported *after* trip end (D-012), when there is no active
 * trip by definition — so `getActiveTrip` alone would find nothing at exactly
 * the moment the product matters most.
 */
export async function getMostRecentTrip(): Promise<Trip | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Trip>(
    'SELECT * FROM trip ORDER BY started_ts DESC LIMIT 1;'
  );
  return row ?? null;
}

export async function endTrip(
  tripId: number,
  method: EndDetectionMethod
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE trip SET ended_ts = ?, end_detection_method = ? WHERE id = ? AND ended_ts IS NULL;',
    Date.now(),
    method,
    tripId
  );
}

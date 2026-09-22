/**
 * Trip lifecycle.
 *
 * A trip is opened lazily on the first recorded fix and closed by trip-end
 * detection (Phase 5, D-012). For Phase 1 we only need "get or create the
 * active trip", which is what the recorder calls on every batch.
 */

import { getDatabase } from '../database';
import { mayRearmNotifications } from '../../recording/recordingAdmission';
import * as appStateDao from './appStateDao';
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

  // A new trip gets a full notification budget (T-116, D-011). Per trip and
  // not per install, because Madeira has an unusual number of repeat visitors
  // (CONTEXT §4.10) and counting per install would silently mute the app on
  // their second holiday — the one they are most likely to care about.
  //
  // ⚠⚠ T-171 — BUT ONLY IF A TRIP ROW MEANS A NEW HOLIDAY. On the P30 it did
  // not: trip churn re-armed this twenty-five times in one afternoon and sent
  // **twenty-six** "your trip has ended" notifications. The cap was correct and
  // the thing underneath it was not, which is why the guard lives here rather
  // than in the notifier.
  if (mayRearmNotifications(await lastEndedTs(db), startedTs)) {
    await appStateDao.set(appStateDao.AppStateKey.NotificationsSent, '');
  }

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

/**
 * When the most recently finished trip ended, or null if none has.
 *
 * Private to the re-arm decision above. It asks for the largest `ended_ts`
 * rather than the newest row, because the churn T-171 fixes produced trips
 * whose start and end were the same millisecond.
 */
async function lastEndedTs(
  db: Awaited<ReturnType<typeof getDatabase>>
): Promise<number | null> {
  const row = await db.getFirstAsync<{ ended: number | null }>(
    'SELECT MAX(ended_ts) AS ended FROM trip;'
  );
  return row?.ended ?? null;
}

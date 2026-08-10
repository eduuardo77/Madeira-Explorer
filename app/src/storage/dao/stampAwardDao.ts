/**
 * Reads and writes for `stamp_award` — the collected stamps (T-071).
 *
 * Derived data (CONTEXT §6.2): everything here is reproducible from
 * `geofence_event`, `raw_fix` and the content pack. That is what makes the
 * award pass safe to re-run whenever thresholds change (T-131), and it is why
 * this table may be wiped freely while `raw_fix` may not.
 */

import { getDatabase } from '../database';
import type { StampAward, StampAwardInput } from '../types';

/**
 * Record an award, or leave the existing one alone.
 *
 * `ON CONFLICT DO NOTHING` against the `UNIQUE(trip_id, place_id)` constraint
 * is what makes re-running the pass idempotent — and it deliberately keeps the
 * *first* award rather than overwriting with a later one. The moment a stamp
 * was earned belongs to the user; a re-run months later must not rewrite their
 * holiday.
 */
export async function award(entry: StampAwardInput): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO stamp_award
       (trip_id, place_id, awarded_ts, dwell_seconds, mean_speed_mps,
        confidence, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(trip_id, place_id) DO NOTHING;`,
    entry.trip_id,
    entry.place_id,
    entry.awarded_ts,
    entry.dwell_seconds,
    entry.mean_speed_mps,
    entry.confidence,
    entry.reason
  );
  return result.changes > 0;
}

export async function countAwards(tripId: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM stamp_award WHERE trip_id = ?;',
    tripId
  );
  return row?.n ?? 0;
}

export async function getAwards(tripId: number): Promise<StampAward[]> {
  const db = await getDatabase();
  return db.getAllAsync<StampAward>(
    'SELECT * FROM stamp_award WHERE trip_id = ? ORDER BY awarded_ts;',
    tripId
  );
}

export async function getAwardedPlaceIds(tripId: number): Promise<Set<string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ place_id: string }>(
    'SELECT place_id FROM stamp_award WHERE trip_id = ?;',
    tripId
  );
  return new Set(rows.map((row) => row.place_id));
}

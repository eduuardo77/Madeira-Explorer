/**
 * Reads and writes for `raw_fix` — the irreplaceable table (D-010).
 *
 * Write path rule (CONTEXT §6.2): every batch goes to disk on arrival. We never
 * accumulate a day of fixes in memory. A crash costs seconds, not hours.
 */

import { getDatabase } from '../database';
import type { RawFix, RawFixInput } from '../types';

/**
 * Append a batch of fixes in a single transaction.
 *
 * One transaction per batch, not per fix: the batch is the unit the OS hands us
 * (deferred updates on iOS, setMaxWaitTime on Android), and committing once per
 * batch means one disk sync per wake-up instead of one per fix. That difference
 * is the whole point of batched delivery on the battery budget
 * (ARCHITECTURE §7).
 */
export async function insertFixes(fixes: RawFixInput[]): Promise<number> {
  if (fixes.length === 0) {
    return 0;
  }

  const db = await getDatabase();
  let inserted = 0;

  await db.withTransactionAsync(async () => {
    const statement = await db.prepareAsync(
      `INSERT INTO raw_fix
         (trip_id, ts, lat, lon, accuracy_m, speed_mps, bearing_deg,
          altitude_m, activity_type, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
    );
    try {
      for (const fix of fixes) {
        await statement.executeAsync(
          fix.trip_id,
          fix.ts,
          fix.lat,
          fix.lon,
          fix.accuracy_m,
          fix.speed_mps,
          fix.bearing_deg,
          fix.altitude_m,
          fix.activity_type,
          fix.source
        );
        inserted += 1;
      }
    } finally {
      await statement.finalizeAsync();
    }
  });

  return inserted;
}

export async function countFixes(tripId: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM raw_fix WHERE trip_id = ?;',
    tripId
  );
  return row?.n ?? 0;
}

export async function getLastFix(tripId: number): Promise<RawFix | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RawFix>(
    'SELECT * FROM raw_fix WHERE trip_id = ? ORDER BY ts DESC LIMIT 1;',
    tripId
  );
  return row ?? null;
}

export async function getRecentFixes(
  tripId: number,
  limit: number
): Promise<RawFix[]> {
  const db = await getDatabase();
  return db.getAllAsync<RawFix>(
    'SELECT * FROM raw_fix WHERE trip_id = ? ORDER BY ts DESC LIMIT ?;',
    tripId,
    limit
  );
}

export type Gap = {
  /** Last fix before the gap. */
  fromTs: number;
  /** First fix after the gap. */
  toTs: number;
  durationMs: number;
};

/**
 * Find stretches with no fixes longer than `thresholdMs`.
 *
 * This exists because of the honesty rule in ARCHITECTURE §10: "If an OEM
 * killed the service for three days, the app must not pretend otherwise."
 * We cannot report a gap we never measured, and a gap here is not automatically
 * a bug — a stationary user at dinner produces one too. Distinguishing "nothing
 * happened" from "we were killed" is what `recording_event` is for.
 *
 * Uses a window function to compare each row with its predecessor. SQLite has
 * supported these since 3.25 and both platforms ship far newer.
 */
export async function findGaps(
  tripId: number,
  thresholdMs: number
): Promise<Gap[]> {
  const db = await getDatabase();
  return db.getAllAsync<Gap>(
    `SELECT fromTs, toTs, (toTs - fromTs) AS durationMs
       FROM (
         SELECT LAG(ts) OVER (ORDER BY ts) AS fromTs, ts AS toTs
           FROM raw_fix
          WHERE trip_id = ?
       )
      WHERE fromTs IS NOT NULL
        AND (toTs - fromTs) > ?
      ORDER BY fromTs;`,
    tripId,
    thresholdMs
  );
}

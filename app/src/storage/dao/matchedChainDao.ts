/**
 * Reads and writes for `matched_chain`: the roads a trip travelled (D-093).
 *
 * Derived data (CONTEXT §6.2): reproducible from `raw_fix` and the shipped
 * network, and replaced freely. `matching/chainStore.ts` decides what is kept;
 * this only stores it.
 *
 * ⚠ **Every delete and rewrite runs in `recordingQueue`** (T-173): this is a
 * child of `trip`, and on expo-sqlite's one connection a recorder batch landing
 * mid-transaction would become part of it, so a rollback here would take raw
 * fixes with it (D-010).
 */

import { getDatabase } from '../database';
import { recordingQueue } from '../recordingQueue';
import type { MatchProgress, StoredChain } from '../../matching/chainStore';

type Row = {
  first_ts: number;
  last_ts: number;
  confidence: number;
  pieces: string;
  anchors: string;
};

/** The trip's chains under `version`, in time order. */
export async function getChains(tripId: number, version: string): Promise<StoredChain[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>(
    `SELECT first_ts, last_ts, confidence, pieces, anchors
       FROM matched_chain
      WHERE trip_id = ? AND version = ?
      ORDER BY first_ts, id;`,
    tripId,
    version
  );
  return rows.map((row) => ({
    firstTs: row.first_ts,
    lastTs: row.last_ts,
    confidence: row.confidence,
    pieces: row.pieces,
    anchors: row.anchors,
  }));
}

/** Where the trip's matching may resume, or null before the first match. */
export async function getProgress(tripId: number): Promise<MatchProgress | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ version: string; resume_ts: number }>(
    'SELECT version, resume_ts FROM match_progress WHERE trip_id = ?;',
    tripId
  );
  return row === null ? null : { version: row.version, resumeTs: row.resume_ts };
}

/**
 * Replace the trip's chains from `fromTs` on with `chains`, and record the new
 * resume point, in one transaction. Chains under another version go too.
 */
export async function saveFrom(
  tripId: number,
  version: string,
  fromTs: number,
  chains: readonly StoredChain[],
  resumeTs: number
): Promise<void> {
  const db = await getDatabase();
  await recordingQueue(async () => {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM matched_chain
        WHERE trip_id = ? AND (version <> ? OR first_ts >= ?);`,
      tripId,
      version,
      // SQLite has no -Infinity: the beginning of time will do.
      Number.isFinite(fromTs) ? fromTs : -1
    );
    for (const chain of chains) {
      await db.runAsync(
        `INSERT INTO matched_chain
           (trip_id, version, first_ts, last_ts, confidence, pieces, anchors)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        tripId,
        version,
        chain.firstTs,
        chain.lastTs,
        chain.confidence,
        chain.pieces,
        chain.anchors
      );
    }
    await db.runAsync(
      `INSERT INTO match_progress (trip_id, version, resume_ts) VALUES (?, ?, ?)
       ON CONFLICT(trip_id) DO UPDATE SET version = excluded.version, resume_ts = excluded.resume_ts;`,
      tripId,
      version,
      resumeTs
    );
  });
  });
}

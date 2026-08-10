/**
 * The recorder's own diary.
 *
 * This table is how the app can be honest about gaps (ARCHITECTURE §10). A
 * silence in `raw_fix` is ambiguous on its own — the user may have been sitting
 * still at dinner, or an OEM battery manager may have killed us three days ago.
 * The difference is visible only if the recorder writes down what it was doing.
 *
 * It is also the input to the day-1 health check (T-049), which exists because
 * a ghost app that dies silently on day 2 is worse than no app at all (D-011).
 */

import { getDatabase } from '../database';
import type { RecordingEvent, RecordingEventKind } from '../types';

export async function log(
  kind: RecordingEventKind,
  detail?: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO recording_event (ts, kind, detail) VALUES (?, ?, ?);',
    Date.now(),
    kind,
    detail ?? null
  );
}

/**
 * Record a failure, and never fail while doing it.
 *
 * Every module that runs inside an OS callback needs exactly this, because
 * throwing out of one costs a batch of fixes — the one loss this app cannot
 * recover (D-010). It lives here rather than being written out four times
 * because the rule is one rule, and a fifth module doing background work should
 * find a helper rather than invent a fifth spelling of it.
 *
 * `where` is a short label for the failing operation; it is prefixed onto the
 * message so a diary line reads `geofence rebuild: database is locked`.
 */
export async function logError(where: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await log('error', `${where}: ${message}`);
  } catch {
    // The database itself is the problem, so there is nowhere left to write
    // this. Intentionally silent: propagating would defeat the entire purpose.
  }
}

export async function getRecent(limit: number): Promise<RecordingEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<RecordingEvent>(
    'SELECT * FROM recording_event ORDER BY ts DESC LIMIT ?;',
    limit
  );
}

export async function getLastOfKind(
  kind: RecordingEventKind
): Promise<RecordingEvent | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RecordingEvent>(
    'SELECT * FROM recording_event WHERE kind = ? ORDER BY ts DESC LIMIT 1;',
    kind
  );
  return row ?? null;
}

/**
 * Keep the diary from growing without bound over a long trip. Unlike `raw_fix`,
 * these rows are diagnostic rather than irreplaceable, so trimming them is safe.
 */
export async function trimTo(maxRows: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM recording_event
      WHERE id NOT IN (
        SELECT id FROM recording_event ORDER BY ts DESC LIMIT ?
      );`,
    maxRows
  );
}

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

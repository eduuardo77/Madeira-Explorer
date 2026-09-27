/**
 * Reads and writes for `activity_event`: Android's activity transitions (D-094).
 *
 * ⚠ Called from inside the recorder's batch, which already holds
 * `recordingQueue`: this must not take the queue itself, or the batch would
 * wait for itself forever.
 */

import { getDatabase } from '../database';
import type { ActivityEvent } from '../../recording/activityTimeline';

export async function insertEvents(events: readonly ActivityEvent[]): Promise<void> {
  if (events.length === 0) {
    return;
  }
  const db = await getDatabase();
  for (const event of events) {
    await db.runAsync(
      'INSERT INTO activity_event (ts, activity, transition) VALUES (?, ?, ?);',
      event.ts,
      event.activity,
      event.transition
    );
  }
}

/**
 * The events that decide the activity between `fromTs` and `toTs`: every one
 * in that range, and the last `context` before it, which carry the state in.
 */
export async function getEventsFor(
  fromTs: number,
  toTs: number,
  context = 20
): Promise<ActivityEvent[]> {
  const db = await getDatabase();
  const before = await db.getAllAsync<ActivityEvent>(
    `SELECT ts, activity, transition FROM activity_event
      WHERE ts < ? ORDER BY ts DESC LIMIT ?;`,
    fromTs,
    context
  );
  const within = await db.getAllAsync<ActivityEvent>(
    `SELECT ts, activity, transition FROM activity_event
      WHERE ts >= ? AND ts <= ? ORDER BY ts;`,
    fromTs,
    toTs
  );
  return [...before.reverse(), ...within];
}

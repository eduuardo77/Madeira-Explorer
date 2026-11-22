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
 * The time of the newest *enter* after `sinceTs` when it is a moving one, or
 * null: what a still check asks before it sleeps the phone (T-315,
 * `recorderCore.ts`). Only the newest: the sensors flicker to walking and back
 * at a stop, and on 21 and 22 Nov counting any moving enter would have kept
 * 11 of 22 real stops awake; the newest kept 6, each a real departure.
 */
export async function getLastMovingEnterSince(sinceTs: number): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ ts: number; activity: string }>(
    `SELECT ts, activity FROM activity_event
      WHERE ts > ? AND transition = 'enter' ORDER BY ts DESC LIMIT 1;`,
    sinceTs
  );
  return row !== null && MOVING_ACTIVITIES.includes(row.activity) ? row.ts : null;
}

const MOVING_ACTIVITIES = ['walking', 'running', 'cycling', 'driving'];

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

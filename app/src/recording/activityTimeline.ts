/**
 * What the user was doing at a given moment, from Android's activity
 * transitions (D-094).
 *
 * WHAT IT IS FOR
 * --------------
 * The receiver's GPS speed tells a phone at rest from a moving one, when it
 * has a speed at all (`matching/motionGate.ts`). The motion sensors are a
 * second, independent witness: they know "still" without GPS, and they know
 * *how* the user moves, which GPS speed cannot on this island (D-028: Madeira's
 * gradients and Funchal's traffic put cars at walking pace). Each fix is
 * labelled with the activity current when it was taken, in `raw_fix`'s
 * `activity_type` column, which has waited for this since the first schema.
 *
 * THE RULE
 * --------
 * The activity at a moment is the last one *entered* before it, unless it was
 * *exited* since and nothing entered after. Android reports only changes, so a
 * drive entered two hours ago is still the current activity; that is how the
 * API is meant to be read.
 *
 * ⚠ **A label is evidence, not truth.** The API lags a change by up to a
 * minute or so and can miss one. Everything downstream treats it as a weight
 * (`mapMatch.ts`), never as a filter that could delete a real journey.
 *
 * Pure. Tested in `activityTimeline.test.ts`.
 */

/** The values `raw_fix.activity_type` takes. */
export type Activity = 'still' | 'walking' | 'running' | 'cycling' | 'driving' | 'unknown';

export type ActivityEvent = {
  ts: number;
  activity: Exclude<Activity, 'unknown'>;
  transition: 'enter' | 'exit';
};

const KNOWN = new Set(['still', 'walking', 'running', 'cycling', 'driving']);

/** A queued event from the native side, or null when it is malformed. */
export function parseEvent(raw: unknown): ActivityEvent | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const { ts, activity, transition } = raw as Record<string, unknown>;
  if (
    typeof ts !== 'number' ||
    !Number.isFinite(ts) ||
    typeof activity !== 'string' ||
    !KNOWN.has(activity) ||
    (transition !== 'enter' && transition !== 'exit')
  ) {
    return null;
  }
  return { ts, activity: activity as ActivityEvent['activity'], transition };
}

/**
 * The activity at each of `times`, from `events`. Both in any order.
 *
 * `before` is the activity current just before the earliest event, when the
 * caller knows it (the last one stored before this batch).
 */
export function activitiesAt(
  events: readonly ActivityEvent[],
  times: readonly number[],
  before: Activity = 'unknown'
): Activity[] {
  // One sweep over both, in time order: a week's trip is tens of thousands of
  // fixes and this runs on the phone.
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const order = times.map((_, i) => i).sort((a, b) => times[a] - times[b]);
  const out = new Array<Activity>(times.length);
  let current: Activity = before;
  let next = 0;
  for (const i of order) {
    while (next < sorted.length && sorted[next].ts <= times[i]) {
      const event = sorted[next];
      if (event.transition === 'enter') {
        current = event.activity;
      } else if (event.activity === current) {
        current = 'unknown';
      }
      next += 1;
    }
    out[i] = current;
  }
  return out;
}

/** The activity current after all of `events`, starting from `before`. */
export function activityAfter(
  events: readonly ActivityEvent[],
  before: Activity = 'unknown'
): Activity {
  if (events.length === 0) {
    return before;
  }
  const last = Math.max(...events.map((event) => event.ts));
  return activitiesAt(events, [last], before)[0];
}

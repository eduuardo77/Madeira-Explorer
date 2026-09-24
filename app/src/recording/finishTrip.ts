/**
 * "End trip" (T-204, D-088): the user closes their trip by hand.
 *
 * T-185 decided how a trip ends when nobody flies home: **both** a button and
 * the three-day silence (`tripEnd.ts`, working again since T-195). This is the
 * button.
 *
 * ⚠ ORDER IS THE WHOLE POINT
 * --------------------------
 * The recorder opens a trip on the first in-bounds fix (`recordingSink`). End
 * the trip first and the next batch — seconds later, in the departure lounge —
 * opens a new, empty one, and the passport the user just finished is replaced
 * by 0 / 80. So automatic recording is switched off **first**, through the same
 * path as Settings' switch, and only then is the trip closed. A new trip starts
 * the next time the user records: an outing, or automatic recording turned
 * back on. ⚠ Turning recording off is Provisional (D-088): the project lead
 * chose the button, not this consequence of it.
 */

import { endTripByUser } from '../progress/tripEndDetection';
import { applyBackgroundTrackingChange } from './tripRecording';
import { setBackgroundTrackingAllowed, setWalkInProgress } from './trackingSettings';

export async function finishTrip(nowMs: number = Date.now()): Promise<boolean> {
  await setWalkInProgress(false, nowMs);
  await setBackgroundTrackingAllowed(false);
  await applyBackgroundTrackingChange(false);
  return endTripByUser(nowMs);
}

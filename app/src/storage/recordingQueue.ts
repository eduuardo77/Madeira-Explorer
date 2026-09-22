/**
 * The one queue that serialises everything touching trip data (T-173).
 *
 * ⚠⚠ WHY THIS IS SHARED RATHER THAN PRIVATE TO THE SINK
 * ------------------------------------------------------
 * `recordingSink` owned this queue, and the reasoning in its header is right as
 * far as it goes: the OS delivers locations and crossings in the same wake-up,
 * and two of those racing produced duplicate trips and a released-object crash
 * (`serialQueue.ts`). What that reasoning missed is that **the OS is not the
 * only writer.**
 *
 * The P30 logged this, on real hardware:
 *
 *     onLocations: Call to function 'NativeStatement.finalizeAsync' has been
 *     rejected.
 *     → Caused by: Error code : FOREIGN KEY constraint failed
 *
 * `raw_fix.trip_id` references `trip(id)`, so that error means the trip was
 * **gone by the time the fixes were inserted**. There is exactly one thing in
 * the app that deletes trips — `deleteAllUserData`, behind *"delete all my
 * data"* (T-125) — and it ran outside the sink's queue:
 *
 *   1. A batch arrives. `getOrCreateActiveTrip()` returns trip N.
 *   2. The user taps erase-all. Every trip row goes, inside its transaction.
 *   3. The batch inserts against trip N. Foreign key fails, batch lost.
 *
 * A dropped batch is the only unrecoverable failure this app has (D-010), and
 * erase-all is the control that makes retention acceptable in the first place —
 * so neither side may simply be made to lose. **Serialising them is the fix**:
 * the delete waits for the batch, or the batch waits for the delete and then
 * opens a fresh trip, and both outcomes are correct.
 *
 * ⚠ **Anything that deletes or rewrites `trip` and its children belongs in
 * here.** That is the rule this module exists to make findable.
 */

import { createSerialQueue } from './serialQueue';

/**
 * Shared by `recordingSink` (the OS's delivery path) and `deleteAllUserData`
 * (the user's). One instance, module scope, because a second queue would
 * serialise nothing against the first.
 */
export const recordingQueue = createSerialQueue();

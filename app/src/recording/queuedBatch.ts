/**
 * The order one recorder batch runs in (T-243).
 *
 * ⚠⚠ WHY THIS IS ITS OWN MODULE
 * -----------------------------
 * A batch runs inside `recordingQueue`, and the first thing it does is close
 * the open trip if it went silent (T-195, `recordingSink.closeLapsedTrip`).
 * Closing a trip ends with a WAL fold (T-178), and the fold **also** takes
 * `recordingQueue`, because a `TRUNCATE` needs every other statement finished.
 * Folded from inside the batch, the queue waits for itself: that batch never
 * finishes, and every location and geofence crossing after it waits behind it
 * with no error anywhere. `recordingSink.ts` said this "cannot deadlock"; it
 * could, the first time a trip lapsed inside a batch.
 *
 * So the fold is moved **out**: the lapse is decided inside the queue, where the
 * batch needs it, and the fold runs after the queue has let go. The WAL fold is
 * housekeeping at a quiet moment (T-178); a few milliseconds later changes
 * nothing it is for.
 *
 * Pure: the queue and the three steps are handed in, so `queuedBatch.test.ts`
 * runs this against the real serial queue and a fold that queues the way
 * `truncateWal` does, and fails on a stall instead of hanging.
 */

import type { SerialQueue } from '../storage/serialQueue.ts';

export type QueuedBatchSteps = {
  /** `recordingQueue`: the one queue for everything that touches trip data. */
  queue: SerialQueue;
  /** Ends the open trip if it lapsed, **without** folding the WAL. True if it ended one. */
  closeLapsedTrip: () => Promise<boolean>;
  /** Stores the batch. Runs after the lapse check, in the same queued task. */
  record: () => Promise<void>;
  /** The WAL fold. Takes the queue itself, so it must never run inside it. */
  foldWal: () => Promise<void>;
};

export async function runQueuedBatch(steps: QueuedBatchSteps): Promise<void> {
  const lapsed = await steps.queue(async () => {
    const ended = await steps.closeLapsedTrip();
    await steps.record();
    return ended;
  });

  // ⚠ Outside the queue, and it has to be (above).
  if (lapsed) {
    await steps.foldWal();
  }
}

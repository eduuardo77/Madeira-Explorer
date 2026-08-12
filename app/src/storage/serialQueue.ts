/**
 * Run async work strictly one at a time, in the order it arrived (T-052c).
 *
 * WHY THE RECORDER NEEDS THIS, WITH THE TWO BUGS THAT PROVED IT
 * -------------------------------------------------------------
 * The OS hands the recorder work in bursts and does not wait for us between
 * items. A single wake-up routinely delivers a batch of locations *and* one or
 * more geofence crossings, and on a cold start with a large monitored set it
 * delivered **99 geofence transitions inside 100 ms**. Every one of those calls
 * into `recordingSink`, and they overlap.
 *
 * **1. Two trips instead of one.** `getOrCreateActiveTrip` reads, finds no
 * active trip, and inserts one — with an `await` between the read and the
 * insert. Concurrent callers all read "none" before any of them inserts, so
 * each creates a trip. Every downstream assumption in the app is that a trip is
 * singular: the trace, the progress count, the passport and trip-end detection
 * all key off it. This is the more serious of the two, and it is silent.
 *
 * **2. A statement used after it was released.** With many overlapping calls on
 * one connection, `expo-sqlite` intermittently rejected with *"Cannot use
 * shared object that was already released"*, surfacing as a cast failure on a
 * `NativeStatement`. Our data-access code does nothing exotic — plain
 * `runAsync(sql, ...params)` with no shared or reused statements — so this is
 * the library's own prepare/finalize racing itself. Recorded 2026-08-12 from
 * `onGeofenceTransition` and once earlier from `checkTripEnd`. Serialising
 * removes the overlap that provokes it rather than depending on a fix upstream.
 *
 * A lost geofence crossing is a lost stamp, and stamps are the entire reward
 * (D-002). "It only happens under load" is not a comfort when the load is a
 * tourist arriving somewhere.
 *
 * WHY A QUEUE AND NOT A LOCK AROUND THE DATABASE
 * ----------------------------------------------
 * Serialising *every* database call would also serialise the UI's reads behind
 * the recorder's writes, and would deadlock the moment a queued call ran inside
 * `withTransactionAsync` — which `insertFixes` and the migration runner both
 * do. This queues at the **sink**, the one boundary where the OS delivers
 * concurrent work, and nothing inside it re-enters.
 *
 * Order is preserved, which is a bonus rather than the point: geofence
 * crossings stored in arrival order make the award pass (T-071) easier to read.
 *
 * Pure: no timers, no I/O. Tested in `serialQueue.test.ts`.
 */

/** Accepts work and returns its result, once everything before it is done. */
export type SerialQueue = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * A queue. Each call to the returned function waits for every call made before
 * it, whether those succeeded or failed.
 *
 * There is no size limit and no timeout, deliberately. The work here is a
 * handful of small writes; a bounded queue would mean *dropping* a fix or a
 * crossing, and D-010 makes raw data the one thing that must never be dropped.
 */
export function createSerialQueue(): SerialQueue {
  // Never rejects: see the `catch` below. That is what stops one failure from
  // breaking the chain for everything queued behind it.
  let tail: Promise<unknown> = Promise.resolve();

  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(() => task());

    // The chain follows the *settled* result, not the caller's. A task that
    // throws still lets the next one start, and the caller still sees the
    // rejection on the promise they were handed.
    tail = result.catch(() => undefined);

    return result;
  };
}

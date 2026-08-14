/**
 * Recognising `expo-sqlite`'s released-object rejection (T-142).
 *
 * WHAT THIS ERROR IS
 * ------------------
 * Under overlapping database calls, `expo-sqlite` intermittently rejects with a
 * three-line cause chain that looks like this:
 *
 *     Call to function 'NativeStatement.runAsync' has been rejected.
 *     → Caused by: The 1st argument cannot be cast to type
 *       expo.modules.sqlite.NativeStatement (received class java.lang.Integer)
 *     → Caused by: Cannot use shared object that was already released
 *
 * `serialQueue.ts` diagnosed it in August 2026 and its reading still holds:
 * our data access does nothing exotic — plain `runAsync(sql, ...params)`, no
 * shared or reused statements — so this is **the library's own prepare/finalize
 * racing itself**. Serialising the recording sink removed the overlap that
 * provoked it *there*; T-142 is the same race arriving from the paths the
 * sink's queue does not cover, on a cold launch: the map screen's first reads,
 * `checkTripEnd`, and the health check, all firing at once from `App.tsx`.
 *
 * ⚠ WHY RETRYING IS SAFE, AND WHY ONLY FOR THIS ERROR
 * ---------------------------------------------------
 * **The call is rejected before the statement executes.** The argument could
 * not be cast, so native code was never entered and no write happened — which
 * is what makes retrying the operation safe rather than a way to write twice.
 * A fresh call prepares a fresh statement.
 *
 * That reasoning holds *only* for this signature. Any other failure — a
 * constraint violation, a disk error, a genuinely malformed statement — must
 * propagate untouched, because retrying those either changes data twice or
 * hides a real defect. This predicate is deliberately narrow for that reason,
 * and it is the whole of the safety argument.
 *
 * ⚠ It also must not become the fix for a *closed* database. A handle closed
 * for good would fail this way forever and the retry would simply spin; the
 * cap below is what keeps that a logged failure rather than a hang. Nothing in
 * `app/` ever calls `closeAsync`, so that is not the state we are in — but it
 * is the state a future change could create.
 *
 * Pure: no Expo, no database. Tested in `releasedObject.test.ts`.
 */

/**
 * The sentence that identifies the race, whatever the operation was.
 *
 * Matched on the *cause* rather than the operation name, because it arrives
 * from `runAsync`, `prepareAsync` and `finalizeAsync` alike — the common part
 * is the released object, not the call that tripped over it.
 */
const RELEASED = 'shared object that was already released';

export function isReleasedSharedObject(error: unknown): boolean {
  if (error === null || error === undefined) {
    return false;
  }

  // Expo puts the cause chain in the message; `String(error)` catches both an
  // Error and the bare rejection some native modules produce.
  const text = error instanceof Error ? `${error.message}` : String(error);
  return text.includes(RELEASED);
}

/**
 * How many times an operation is retried before the failure is real.
 *
 * ⚠ Two, not "until it works". The race is momentary — the losing call is the
 * one that arrived while another was finalising — so a retry or two clears it.
 * An unbounded retry would turn a permanently dead handle into a spin instead
 * of an error in the diary, and the diary is how this project finds things.
 */
export const MAX_RELEASED_OBJECT_RETRIES = 2;

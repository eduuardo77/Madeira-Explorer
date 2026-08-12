/**
 * Run an expensive async setup once, share it with everyone waiting — and let a
 * *failure* be tried again (T-052c).
 *
 * WHY THIS IS NOT JUST A CACHED PROMISE
 * ------------------------------------
 * `database.ts` used to cache the open-and-migrate promise in a module
 * variable, for a good reason: the background location task and the UI can both
 * ask for the database at the same moment, and two concurrent opens would run
 * the migrations twice.
 *
 * But a promise caches its *rejection* just as faithfully as its value. If the
 * very first open failed, that rejected promise stayed in the variable and
 * every later caller — for the entire life of the process — received the same
 * old failure without anything being retried. One transient error at the wrong
 * moment and the app silently stops recording until it is killed and relaunched.
 *
 * That is not hypothetical for this app. iOS data protection is set to
 * `CompleteUntilFirstUserAuthentication` (CONTEXT §7), so after a reboot the
 * database file is unreadable until the user first unlocks the phone — and the
 * recorder is expected to be woken by the OS in exactly that window. A phone
 * that reboots in a pocket would come back with a recorder that had given up
 * permanently, and D-010 calls raw traces the only irreplaceable asset.
 *
 * WHAT IT GUARANTEES
 * ------------------
 * - The factory runs **once** while a call is in flight, however many callers.
 * - A resolved value is shared forever, exactly as before.
 * - A rejection reaches everyone who was waiting, and then **clears**, so the
 *   next caller starts a fresh attempt.
 *
 * It deliberately does *not* retry on its own, back off, or limit attempts.
 * Retrying is the caller arriving again, which for the recorder is the next
 * batch of fixes — the OS's own schedule is a better backoff than any we would
 * invent, and it costs nothing when nobody asks.
 *
 * Pure: no timers, no I/O, no knowledge of what it is opening. Tested in
 * `onceOrRetry.test.ts`.
 */

/**
 * Wrap `factory` so it runs at most once per success.
 *
 * The returned function is what callers hold; `factory` is never exposed, so
 * there is no way to start a second attempt while one is in flight.
 */
export function onceOrRetry<T>(factory: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;

  return () => {
    if (inFlight === null) {
      // The `catch` runs before any caller's own handler, so the slot is
      // already clear by the time somebody reacts to the failure and tries
      // again. Rethrowing keeps the rejection intact for those callers.
      inFlight = factory().catch((error: unknown) => {
        inFlight = null;
        throw error;
      });
    }
    return inFlight;
  };
}

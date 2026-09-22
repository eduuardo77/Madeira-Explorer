/**
 * Holding a JS object reachable until the native call on it has finished (T-179).
 *
 * ⚠⚠ THE BUG THIS EXISTS FOR — expo/expo#49799, open, no fix released
 * -------------------------------------------------------------------
 * An Expo `AsyncFunction` converts its arguments **on the modules queue, after
 * the JS call has already returned**. A shared object — `expo-sqlite`'s
 * `NativeStatement` — crosses as an integer id, and nothing keeps its JS object
 * alive in between. If Hermes collects it first, the native registry entry is
 * gone and the call rejects:
 *
 *     Call to function 'NativeStatement.finalizeAsync' has been rejected.
 *     → Caused by: The 1st argument cannot be cast to type NativeStatement
 *       (received class java.lang.Integer)
 *     → Caused by: Cannot use shared object that was already released
 *
 * `expo-sqlite`'s own `getFirstAsync` is the exposed shape: its last act is
 * `finally { await statement.finalizeAsync() }`, after which nothing reads the
 * statement again. Expo's triage confirmed the mechanism and gave this
 * workaround — *keep the object in a variable and read it after the await*. The
 * upstream fix (expo/expo#49807) was closed unmerged.
 *
 * ⚠⚠ WHY IT PINNED THE WAL, NOT MERELY FAILED A CALL — read from the source
 * ------------------------------------------------------------------------
 * Releasing a `NativeStatement` runs `sharedObjectDidRelease()` → `ref.close()`
 * → `resetNative()`, which destroys the C++ binding **without calling
 * `sqlite3_finalize`**. The statement leaks. A leaked `INSERT` has already run
 * to completion and costs only memory; a leaked `SELECT` has stepped **one row**
 * — the library steps once in `runAsync` and again only later — so it is still
 * active, SQLite keeps the connection's read transaction open, and every
 * checkpoint fails until the process dies. That is T-178's August WAL, and the
 * diary from that week holds two *"getFirstAsync: released object"* retries.
 *
 * T-142's retry made the *call* succeed the second time. It could not reach the
 * first attempt's statement, which was already leaked.
 *
 * WHAT THIS DOES
 * --------------
 * `hold(object, operation)` puts the object in a module-level map for exactly
 * as long as `operation` is pending, so the collector cannot take it whatever
 * the calling code does or does not read afterwards. Counted, not a set: the
 * same object may be held by two overlapping operations and must stay held
 * until both finish.
 *
 * Pure — no Expo, no database — so it runs under Node's test runner, which can
 * force a collection and show the held object surviving it.
 */

export type KeepAlive = {
  /** Keep `object` strongly reachable until `operation` settles. */
  hold<T>(object: object, operation: () => Promise<T>): Promise<T>;
  /** How many operations currently hold `object`. For tests and diagnostics. */
  heldCount(object: object): number;
};

export function createKeepAlive(): KeepAlive {
  const held = new Map<object, number>();

  return {
    async hold<T>(object: object, operation: () => Promise<T>): Promise<T> {
      held.set(object, (held.get(object) ?? 0) + 1);
      try {
        return await operation();
      } finally {
        // Only after the await: releasing any earlier is the bug.
        const remaining = (held.get(object) ?? 1) - 1;
        if (remaining === 0) {
          held.delete(object);
        } else {
          held.set(object, remaining);
        }
      }
    },

    heldCount(object: object): number {
      return held.get(object) ?? 0;
    },
  };
}

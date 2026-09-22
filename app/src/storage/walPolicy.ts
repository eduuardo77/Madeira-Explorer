/**
 * Keeping SQLite's write-ahead log small, and saying so when it is not (T-178).
 *
 * ⚠⚠ WHY THIS EXISTS — MEASURED ON THE P30, 2026-09-22
 * -----------------------------------------------------
 * The phone's `madeira.db` was 684 KB and its `madeira.db-wal` was **27 MB**.
 * Auto-backup includes the whole `SQLite/` folder and has historically capped
 * app data around 25 MB, past which the *entire* backup can fail silently
 * (`plugins/withAndroidBackupRules.js`, ARCHITECTURE §4a) — so the file that
 * answers *"my phone died on day 5"* was already too big to be backed up.
 *
 * Parsing the WAL's frame headers and the `-shm` index said two separate things
 * went wrong, and it is worth keeping them apart because they need different
 * fixes:
 *
 *   1. **The file never shrinks.** Only 615 of its 6,560 frames were live; the
 *      rest were dead frames from earlier generations. SQLite resets the WAL
 *      after a complete checkpoint and writes over it from the start, but it
 *      does not truncate the file unless `journal_size_limit` is set or a
 *      `TRUNCATE` checkpoint runs — and a clean close, the other thing that
 *      removes it, never happens on Android, where the process is killed. So
 *      the file is the **high-water mark** of the worst week, forever. Today's
 *      generations were resetting normally at ~1,000 frames and the file stayed
 *      at 27 MB anyway.
 *
 *   2. **Something pinned it in August.** One generation ran from 22 to 28
 *      August — ≥6,560 frames, ≥1,900 small commits — without a single
 *      completed checkpoint. It ends at 28 Aug 12:41, which is when T-174's
 *      dead recorder stopped writing. The mechanism that fits is **a statement
 *      left stepped but never finalised on our own connection**: SQLite then
 *      holds a read transaction open, every autocheckpoint on that connection
 *      fails with *"database table is locked"* (SQLITE_LOCKED), and the WAL
 *      grows until the process dies. Reproduced off-device with SQLite 3.50:
 *      one stepped `SELECT`, 3,000 commits, a 48 MB WAL and a `TRUNCATE` that
 *      raises; finalise the statement and it truncates to zero. The diary from
 *      that week holds two *"getFirstAsync: released object, repeated once"*
 *      lines (T-142) — a race that rejects `finalizeAsync` would leak exactly
 *      such a statement. ⚠ **That link is inferred, not observed.**
 *
 * WHAT THIS MODULE DECIDES
 * ------------------------
 * (1) is fixed outright by `journal_size_limit` plus a `TRUNCATE` checkpoint at
 * every open. (2) cannot be fixed from here — a pinned connection refuses every
 * checkpoint, which is the symptom — so the job is to make it **visible**: this
 * judges what a checkpoint reported and decides whether it is worth a diary
 * line. A routine truncate is not; a stalled or blocked one is, because an
 * unexplained 27 MB file is how this was found, and it should not take a phone
 * plugged in by accident to find it again.
 *
 * Pure: no database, no clock. `database.ts` runs the pragmas and writes the
 * line.
 */

/**
 * What the WAL file is cut back to each time SQLite resets it.
 *
 * Without it the file stays at its largest-ever size (point 1 above). 1 MiB is
 * comfortably above a quiet day's WAL and far below the backup cap; between
 * resets the file still grows to about `SQLITE_AUTOCHECKPOINT_FRAMES` frames
 * (~4 MB), which is SQLite's normal cycle and not ours to shorten.
 */
export const JOURNAL_SIZE_LIMIT_BYTES = 1024 * 1024;

/**
 * SQLite's default `wal_autocheckpoint`, in frames. The app does not set it —
 * `expo-sqlite` leaves the default, checked in its Android build flags — it is
 * named here so the threshold below can be stated against it.
 */
export const SQLITE_AUTOCHECKPOINT_FRAMES = 1000;

/**
 * Bytes per WAL frame: a 24-byte frame header plus one page. The page size is
 * SQLite's default 4,096, **read from the P30's own WAL header**, not assumed.
 */
export const WAL_FRAME_BYTES = 24 + 4096;

/**
 * A WAL at least this long when we checkpoint it means autocheckpoint has been
 * **failing**, not merely lagging: in a healthy cycle it resets shortly after
 * `SQLITE_AUTOCHECKPOINT_FRAMES`. The P30 measured 1,109 frames in a healthy
 * generation and ≥6,560 in the pinned one; twice the default sits between.
 */
export const STALLED_WAL_FRAMES = 2 * SQLITE_AUTOCHECKPOINT_FRAMES;

/** When a checkpoint was asked for. Goes into the diary line verbatim. */
export type WalCheckpointTrigger = 'open' | 'trip_end' | 'erase_all';

/**
 * One row of `PRAGMA wal_checkpoint(...)`. `log` is the WAL's length in frames
 * and `checkpointed` how many of them are now in the database file; both are -1
 * when the database is not in WAL mode.
 *
 * ⚠ A **successful** `TRUNCATE` reports `0, 0` — the log is gone by the time it
 * answers — which is why the caller runs `PASSIVE` first: that is the only one
 * of the two that can say how long the WAL was.
 */
export type CheckpointRow = {
  busy: number;
  log: number;
  checkpointed: number;
};

export type CheckpointOutcome =
  /** Not in WAL mode at all. Should be impossible; loud if it happens. */
  | { kind: 'not_wal' }
  /** Everything checkpointed and the file truncated to zero. */
  | { kind: 'truncated'; frames: number }
  /**
   * `TRUNCATE` could not get the locks it needs. With one connection and no
   * busy timeout this means another statement was running at that instant.
   */
  | { kind: 'busy'; frames: number; checkpointed: number }
  /**
   * SQLite refused with SQLITE_LOCKED: a statement on **our own connection**
   * still holds a read transaction. Once is a read in flight; every time is the
   * August pin.
   */
  | { kind: 'blocked'; message: string }
  /** Anything else. */
  | { kind: 'failed'; message: string };

/** Judge the two rows a `PASSIVE` then `TRUNCATE` checkpoint returned. */
export function judgeCheckpoint(
  passive: CheckpointRow | null,
  truncate: CheckpointRow | null
): CheckpointOutcome {
  if (passive === null || truncate === null) {
    return { kind: 'failed', message: 'checkpoint returned no row' };
  }
  if (passive.log < 0 || truncate.log < 0) {
    return { kind: 'not_wal' };
  }
  if (truncate.busy !== 0) {
    return {
      kind: 'busy',
      frames: passive.log,
      checkpointed: passive.checkpointed,
    };
  }
  return { kind: 'truncated', frames: passive.log };
}

/**
 * Judge a checkpoint that threw.
 *
 * Recognised by message, because that is all `expo-sqlite` hands back: its
 * rejections carry SQLite's text (*"database table is locked"*) and sometimes
 * the code name, but no numeric code. ⚠ `"database is locked"` is SQLITE_BUSY —
 * another connection — and deliberately does not match.
 */
export function judgeCheckpointError(error: unknown): CheckpointOutcome {
  const message = error instanceof Error ? error.message : String(error);
  if (/database table is locked|SQLITE_LOCKED/i.test(message)) {
    return { kind: 'blocked', message };
  }
  return { kind: 'failed', message };
}

/** Frames as megabytes, one decimal — the unit the backup cap is stated in. */
function framesToMb(frames: number): string {
  return ((frames * WAL_FRAME_BYTES) / (1024 * 1024)).toFixed(1);
}

/**
 * The diary line for a checkpoint, or `null` when there is nothing to say.
 *
 * ⚠ **A routine truncate says nothing, on purpose.** Every diary line is itself
 * a write to the WAL, and a line per trip end and per launch would make the
 * diary busiest precisely when it is least informative. What earns a line is
 * what could explain a big file later: a stall, a refusal, or a database that
 * is somehow not in WAL mode.
 */
export function checkpointDiaryLine(
  trigger: WalCheckpointTrigger,
  outcome: CheckpointOutcome
): string | null {
  switch (outcome.kind) {
    case 'truncated':
      if (outcome.frames < STALLED_WAL_FRAMES) {
        return null;
      }
      return (
        `${trigger}: WAL was ${outcome.frames} frames (${framesToMb(outcome.frames)} MB) ` +
        `— autocheckpoint had stalled; checkpointed and truncated`
      );
    case 'busy':
      return (
        `${trigger}: truncate busy — ${outcome.checkpointed} of ${outcome.frames} ` +
        `frames checkpointed, file not truncated`
      );
    case 'blocked':
      return (
        `${trigger}: blocked by an open statement on the connection ` +
        `(${outcome.message}) — repeated, this is a leaked statement pinning the WAL`
      );
    case 'not_wal':
      return `${trigger}: database is not in WAL mode`;
    case 'failed':
      return `${trigger}: ${outcome.message}`;
  }
}

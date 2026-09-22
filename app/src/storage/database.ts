/**
 * Database connection and migration runner.
 *
 * Opens one SQLite file in app-private storage and runs any pending migrations.
 * See ARCHITECTURE.md §4a for where this file physically lives and how it is
 * treated by device backup.
 *
 * WAL mode is not optional here. The recorder writes small batches frequently
 * from a background task while the app is suspended; WAL keeps those writes
 * cheap and stops a reader (the debug screen) from blocking a writer.
 *
 * ⚠ And WAL needs looking after on Android (T-178): the log is only ever cut
 * back by a checkpoint, and it once reached 27 MB — over the auto-backup cap.
 * `walPolicy.ts` has what was measured and what is done about it.
 */

import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './migrations';
import { onceOrRetry } from './onceOrRetry';
import { recordingQueue } from './recordingQueue';
import {
  isReleasedSharedObject,
  MAX_RELEASED_OBJECT_RETRIES,
} from './releasedObject';
import type {
  CheckpointOutcome,
  CheckpointRow,
  WalCheckpointTrigger,
} from './walPolicy';
import {
  checkpointDiaryLine,
  JOURNAL_SIZE_LIMIT_BYTES,
  judgeCheckpoint,
  judgeCheckpointError,
} from './walPolicy';

const DATABASE_NAME = 'madeira.db';

/**
 * One open-and-migrate, shared by everyone — and retried if it fails.
 *
 * The sharing is why this exists at all: the background location task and the
 * UI can both ask for the database at the same moment, and two concurrent opens
 * would run the migrations twice.
 *
 * ⚠ **The retry is the part that was missing** (T-052c). This was a plain
 * cached promise, and a promise caches its rejection exactly as well as its
 * value: one failed open and every caller for the rest of the process got the
 * same stale failure, with nothing ever tried again. On iOS that is a real
 * sequence rather than a hypothetical — data protection is
 * `CompleteUntilFirstUserAuthentication` (CONTEXT §7), so after a reboot the
 * file cannot be read until the first unlock, and the OS wakes the recorder in
 * precisely that window. A phone rebooting in a pocket would have come back
 * with a recorder that had permanently given up.
 *
 * The retry logic is in `onceOrRetry.ts` because it is pure and this file is
 * not testable without a device (CONTEXT §6.6).
 */
export const getDatabase = onceOrRetry<SQLite.SQLiteDatabase>(() =>
  openAndMigrate()
);

/**
 * Retry one database call when `expo-sqlite` rejects it for a released object
 * (T-142).
 *
 * The safety argument is in `releasedObject.ts` and rests on one fact: the call
 * is **rejected before the statement executes**, so nothing was written and a
 * fresh attempt cannot write twice. Every other failure propagates untouched on
 * the first throw.
 *
 * No delay between attempts, deliberately. The race is another call finalising
 * a statement at the same moment; by the time this promise rejects and we call
 * again, that has already happened. A timer here would add latency to the
 * recorder's write path to solve nothing.
 */
async function retryOnRelease<T>(
  operation: () => Promise<T>,
  onRecovered: (attempt: number) => void,
  attempts = MAX_RELEASED_OBJECT_RETRIES
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      const result = await operation();
      if (attempt > 0) {
        onRecovered(attempt);
      }
      return result;
    } catch (error) {
      if (!isReleasedSharedObject(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  // Out of attempts. This reaches the caller and therefore the diary, which is
  // the point: a handle that fails this way repeatedly is a different problem
  // from the momentary race, and it must not be silent.
  throw lastError;
}

/**
 * The database handle every caller gets, with the released-object race handled
 * once instead of at thirty call sites (T-142).
 *
 * ⚠ **A `Proxy`, and the alternative is genuinely wrong.** The obvious version
 * — copy the handle's properties onto a new object and override six of them —
 * breaks on a JSI object: its state lives in native slots, not in enumerable
 * properties, so the copy is a hollow shell and any method reached through it
 * runs with the wrong `this`. The proxy forwards everything to the real handle,
 * binds inherited methods back to it, and substitutes only the six below.
 *
 * The `wrapped` map immediately underneath is therefore the one thing worth
 * reading here: it is exactly the list of calls that retry.
 *
 * ⚠ `withTransactionAsync` is retried as a whole. That is safe for the same
 * reason and one more: a transaction that fails part-way rolls back, so the
 * retry starts from the same state. It is also why the retry must never be
 * moved *inside* a transaction body.
 */
function resilient(db: SQLite.SQLiteDatabase): SQLite.SQLiteDatabase {
  // ⚠ Only the **variadic** overload of each method is stood in for, because
  // that is the only one this app uses — `runAsync(sql, a, b)`, never
  // `runAsync(sql, { $a: 1 })`. Writing it out this way keeps the generics
  // (`getAllAsync<Row>`) and needs no cast; if somebody reaches for the
  // object-parameter form later, TypeScript will say so here rather than
  // silently dropping the retry.
  /**
   * Write down that a call had to be repeated (T-142).
   *
   * ⚠ Through the **raw** handle, never through the wrapper. A retried write of
   * the retry notice would be able to call itself, and a diary that can recurse
   * is worse than no diary. It is also fire-and-forget and swallows its own
   * failure, for the reason `logError` gives: if the database is the problem
   * there is nowhere left to write this, and saying so must not break the
   * caller who has just succeeded.
   */
  const noteRecovery = (operation: string) => (attempt: number) => {
    const times = attempt === 1 ? 'once' : `${attempt} times`;
    void db
      .runAsync(
        'INSERT INTO recording_event (ts, kind, detail) VALUES (?, ?, ?);',
        Date.now(),
        'db_retry',
        `${operation}: released object, repeated ${times} and succeeded`
      )
      .catch(() => {});
  };

  const wrapped = {
    execAsync: (source: string) =>
      retryOnRelease(() => db.execAsync(source), noteRecovery('execAsync')),

    runAsync: (source: string, ...params: SQLite.SQLiteVariadicBindParams) =>
      retryOnRelease(
        () => db.runAsync(source, ...params),
        noteRecovery('runAsync')
      ),

    getAllAsync: <T>(source: string, ...params: SQLite.SQLiteVariadicBindParams) =>
      retryOnRelease(
        () => db.getAllAsync<T>(source, ...params),
        noteRecovery('getAllAsync')
      ),

    getFirstAsync: <T>(source: string, ...params: SQLite.SQLiteVariadicBindParams) =>
      retryOnRelease(
        () => db.getFirstAsync<T>(source, ...params),
        noteRecovery('getFirstAsync')
      ),

    prepareAsync: (source: string) =>
      retryOnRelease(() => db.prepareAsync(source), noteRecovery('prepareAsync')),

    withTransactionAsync: (task: () => Promise<void>) =>
      retryOnRelease(
        () => db.withTransactionAsync(task),
        noteRecovery('withTransactionAsync')
      ),
  };

  return new Proxy(db, {
    get(target, property) {
      if (Object.hasOwn(wrapped, property)) {
        return wrapped[property as keyof typeof wrapped];
      }

      // ⚠ `target` is passed as the receiver, and functions are bound to it,
      // so nothing on the real handle — getter or method — is ever invoked
      // with the proxy as `this`. A native object cannot reach its own
      // internal state through a stand-in.
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // WAL: concurrent reader + writer, and cheaper small writes.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  // ⚠ T-178. Without this the WAL file stays at its largest-ever size, because
  // SQLite resets the log but never shrinks the file — and on Android the clean
  // close that would delete it never happens. The P30's was 27 MB with 615
  // live frames. Per connection, not persistent: it has to be set on every open.
  await db.execAsync(`PRAGMA journal_size_limit = ${JOURNAL_SIZE_LIMIT_BYTES};`);
  // NORMAL is the correct pairing with WAL: durable across app crashes, which
  // is what we actually care about. FULL would fsync on every commit for
  // protection against OS-level power loss, at a battery cost we do not want
  // on a device writing a batch every few minutes all day.
  await db.execAsync('PRAGMA synchronous = NORMAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      id         INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_ts INTEGER NOT NULL
    );
  `);

  const appliedRows = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM schema_migration;'
  );
  const applied = new Set<number>();
  for (const row of appliedRows) {
    applied.add(row.id);
  }

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue;
    }
    // Each migration is one transaction: it either fully applies or not at all.
    // A half-applied schema on a user's phone mid-trip is not recoverable
    // remotely, because there is no remote (D-001).
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.runAsync(
        'INSERT INTO schema_migration (id, name, applied_ts) VALUES (?, ?, ?);',
        migration.id,
        migration.name,
        Date.now()
      );
    });
  }

  // T-178: whatever the last process left in the WAL — including a WAL a leaked
  // statement pinned until the process died — goes now, before anything else
  // can hold the connection. ⚠ Directly, NOT through `truncateWal`: that takes
  // `recordingQueue`, and a queued batch already waiting on `getDatabase()`
  // would be waiting on this — a deadlock on the first launch with a backlog.
  await checkpointAndNote(db, 'open');

  // Wrapped only after the migrations have run. A migration failing for a
  // released object should be loud and should not be retried behind anyone's
  // back — a half-applied schema is not recoverable on a user's phone.
  return resilient(db);
}

/**
 * Delete every row of user data. Backs the "delete all my data" control (T-125),
 * which is the counterweight that makes raw-trace retention acceptable (D-010).
 *
 * This deliberately drops trip data only — the schema itself stays, so the app
 * keeps working and simply starts recording a fresh trip.
 */
export async function deleteAllUserData(): Promise<void> {
  const db = await getDatabase();
  // ⚠⚠ T-173 — SERIALISED AGAINST THE RECORDER, not merely transactional. A
  // transaction stops this half-deleting; it does not stop a location batch
  // that already holds a trip id from inserting against it the moment this
  // commits. That is a FOREIGN KEY failure and a lost batch, and it was
  // observed on real hardware — see `storage/recordingQueue.ts`.
  await recordingQueue(async () => {
  await db.withTransactionAsync(async () => {
    // Order matters: children before parents, because foreign_keys is ON.
    //
    // ⚠ EVERY TABLE THAT REFERENCES `trip` MUST BE LISTED ABOVE IT. A missing
    // one does not silently leave rows behind — it aborts the whole
    // transaction on a foreign-key violation, so nothing is deleted at all.
    // `stamp_award` was added in migration 2 and missed here, which broke
    // erase-all outright for any user who had earned a stamp: precisely the
    // users who have something to erase. Add new child tables here in the
    // same commit that creates them.
    await db.execAsync('DELETE FROM raw_fix;');
    await db.execAsync('DELETE FROM sensor_sample;');
    await db.execAsync('DELETE FROM geofence_event;');
    await db.execAsync('DELETE FROM stamp_award;');
    await db.execAsync('DELETE FROM recording_event;');
    await db.execAsync('DELETE FROM trip;');
    await db.execAsync('DELETE FROM app_state;');
  });
  // Return the freed pages to the filesystem rather than leaving them in the
  // file. If a user asks us to delete their location history, the bytes should
  // actually go.
  //
  // Inside the queue as well: VACUUM rewrites the whole file and cannot run
  // while another statement is open on the connection.
  await db.execAsync('VACUUM;');
  // ⚠ T-178 — and VACUUM alone does not make them go. The WAL keeps the old
  // versions of every page in frames from earlier generations until something
  // writes over them or truncates the file; the P30's held six days of August
  // that way. Truncating is what makes "delete my data" true on disk.
  await checkpointAndNote(db, 'erase_all');
  });
}

/**
 * Fold the WAL into the database file and truncate it to zero (T-178).
 *
 * Called at trip end — a natural quiet moment, and the last write of a trip the
 * user will want restored if the phone dies. Never throws: a checkpoint that
 * cannot run leaves the data exactly where it was, and saying so in the diary
 * is the whole of the useful response.
 *
 * ⚠ **Through `recordingQueue`**, because a `TRUNCATE` needs every other
 * statement on the connection finished, and the recorder's batches are the
 * ones that must not be made to fail. UI reads are not queued and can still
 * make it return busy or blocked; that is harmless and is recorded.
 * ⚠ **Never call this from inside a `recordingQueue` task** — it would wait for
 * itself.
 */
export async function truncateWal(trigger: WalCheckpointTrigger): Promise<void> {
  try {
    await recordingQueue(async () => {
      const db = await getDatabase();
      await checkpointAndNote(db, trigger);
    });
  } catch {
    // `getDatabase` failed, so there is no diary to write to either.
  }
}

/**
 * Run the checkpoint and write down anything worth knowing (see `walPolicy`).
 *
 * `PASSIVE` first, because a successful `TRUNCATE` reports a length of zero and
 * only `PASSIVE` can say how long the WAL had grown — which is the number that
 * would have explained the P30's file without a phone to take apart.
 *
 * The diary line goes through whichever handle it was given, fire-and-forget
 * and swallowing its own failure, for the reason `noteRecovery` gives.
 */
async function checkpointAndNote(
  db: SQLite.SQLiteDatabase,
  trigger: WalCheckpointTrigger
): Promise<void> {
  let outcome: CheckpointOutcome;
  try {
    const passive = await db.getFirstAsync<CheckpointRow>(
      'PRAGMA wal_checkpoint(PASSIVE);'
    );
    const truncate = await db.getFirstAsync<CheckpointRow>(
      'PRAGMA wal_checkpoint(TRUNCATE);'
    );
    outcome = judgeCheckpoint(passive, truncate);
  } catch (error) {
    outcome = judgeCheckpointError(error);
  }

  const line = checkpointDiaryLine(trigger, outcome);
  if (line === null) {
    return;
  }
  await db
    .runAsync(
      'INSERT INTO recording_event (ts, kind, detail) VALUES (?, ?, ?);',
      Date.now(),
      'wal_checkpoint',
      line
    )
    .catch(() => {});
}

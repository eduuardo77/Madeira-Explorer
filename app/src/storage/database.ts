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
 */

import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './migrations';
import { onceOrRetry } from './onceOrRetry';

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

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // WAL: concurrent reader + writer, and cheaper small writes.
  await db.execAsync('PRAGMA journal_mode = WAL;');
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

  return db;
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
  await db.execAsync('VACUUM;');
}

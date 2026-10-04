/**
 * Saving the trip to a file and restoring it from one (2026-10-04).
 *
 * WHY
 * ---
 * The project lead, installing new builds on the P30: *"I won't like losing my
 * data I've collected around Madeira."* An update keeps the data; an uninstall
 * does not, and moving to the upload-key build needs one. WalkNYC answers the
 * same worry with *Backup Data* and *Restore Data* in its settings (teardown,
 * 2026-10-04): a file the user keeps wherever they like.
 *
 * WHAT A BACKUP IS
 * ----------------
 * The whole database, as a snapshot (`VACUUM INTO`), unmasked: every fix,
 * stamp and lit road, because restoring has to give back exactly what was
 * there. It is the user's own file; the privacy policy says what it holds.
 *
 * HOW A RESTORE WORKS
 * -------------------
 * Not by swapping the file under an open connection the recorder is writing
 * through. The backup is migrated to this app's schema in a copy, attached,
 * and copied in, table by table, inside the recorder's queue and one
 * transaction, the way erasing already works. It either all lands or none of
 * it does.
 *
 * Pure. Tested in `backupPolicy.test.ts`.
 */

/**
 * Every table that holds the user's data, **parents first**: the order rows
 * are copied in. Emptying runs it backwards, children first, because foreign
 * keys are on. `schema_migration` is not data and is never copied.
 *
 * ⚠ A table added by a migration must be added here in the same commit; the
 * test compares this list with the migrations and fails otherwise. Missing
 * from here, a restore would silently leave that table behind.
 */
export const USER_TABLES = [
  'trip',
  'raw_fix',
  'sensor_sample',
  'geofence_event',
  'stamp_award',
  'matched_chain',
  'match_progress',
  'activity_event',
  'recording_event',
  'app_state',
] as const;

/**
 * Rows of `app_state` a restore leaves as they are on this phone.
 *
 * - `stamps_unlocked`: Play is the authority on a purchase (T-156); a backup
 *   file must not be a way to unlock the passport, nor to lose an unlock.
 * - `geofence_working_set`: which regions *this* phone has registered with the
 *   system; the recorder rebuilds it after the restore.
 */
export const RESTORE_KEEPS_APP_STATE = ['stamps_unlocked', 'geofence_working_set'] as const;

/** The file's name: the app and the day, so a folder of them sorts by date. */
export function backupFileName(nowMs: number): string {
  const day = new Date(nowMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `bruma-${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}.db`;
}

export type BackupCheck =
  | { ok: true; missingMigrations: number[] }
  | { ok: false; reason: 'not-a-backup' | 'newer-app' };

/**
 * Whether a picked file is a backup this app can restore.
 *
 * `tables` are the file's table names; `applied` the migration ids it records;
 * `known` this app's. A file without the core tables is not ours. A file with
 * a migration this app does not know came from a newer version, and restoring
 * it would drop columns, so it is refused. A file missing migrations is
 * brought forward first.
 */
export function checkBackup(
  tables: readonly string[],
  applied: readonly number[],
  known: readonly number[]
): BackupCheck {
  const present = new Set(tables);
  if (!present.has('schema_migration') || !present.has('trip') || !present.has('raw_fix')) {
    return { ok: false, reason: 'not-a-backup' };
  }
  const knownSet = new Set(known);
  if (applied.some((id) => !knownSet.has(id))) {
    return { ok: false, reason: 'newer-app' };
  }
  const appliedSet = new Set(applied);
  return { ok: true, missingMigrations: known.filter((id) => !appliedSet.has(id)) };
}

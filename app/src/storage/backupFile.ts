/**
 * The Settings rows *Guardar cópia* and *Restaurar cópia* (2026-10-04): the
 * file half of `backupPolicy.ts`, with the database half in `database.ts`.
 *
 * ⚠ **Saved through the share sheet, not a "save as" screen.** WalkNYC opens
 * Android's save dialog; `expo-file-system` 57 has no call for it, and its
 * folder picker can reach neither Google Drive nor, on Android 11 and later,
 * the Downloads folder itself. The share sheet offers Drive, Files, e-mail and
 * whatever else the phone has, which is where a copy is safe from an
 * uninstall. Restoring uses the system's own file picker, as WalkNYC does.
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';

import { t } from '../i18n';
import { syncRecordingWithPreferences } from '../recording/tripRecording';
import { backupFileName } from './backupPolicy';
import { restoreFromBackup, writeBackup } from './database';
import * as recordingEventDao from './dao/recordingEventDao';

export type SaveOutcome = { ok: true } | { ok: false; refusal: 'unavailable' | 'failed' };

export type RestoreFileOutcome =
  | { ok: true; fixes: number }
  | { ok: false; refusal: 'cancelled' | 'not-a-backup' | 'newer-app' | 'failed' };

/** Where a picked file waits, beside the real database, while it is checked. */
const CANDIDATE = 'restore-candidate.db';

function databaseDirectory(): Directory {
  const raw = String(SQLite.defaultDatabaseDirectory);
  return new Directory(raw.startsWith('file://') ? raw : `file://${raw}`);
}

/** Write a snapshot and open the share sheet with it. */
export async function saveBackupFile(nowMs: number = Date.now()): Promise<SaveOutcome> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, refusal: 'unavailable' };
    }
    // Earlier copies go first: the cache is the app's own, but a full,
    // unmasked trace should not pile up anywhere it is not wanted.
    for (const entry of new Directory(Paths.cache).list()) {
      if (entry instanceof File && /^bruma-\d{4}-\d{2}-\d{2}\.db$/.test(entry.name)) {
        entry.delete();
      }
    }
    const file = new File(Paths.cache, backupFileName(nowMs));
    await writeBackup(file.uri);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/octet-stream',
      dialogTitle: t('settings.backup.dialogTitle'),
    });
    await recordingEventDao.log('backup', `saved ${file.name}`);
    return { ok: true };
  } catch (error) {
    await recordingEventDao.logError('backup', error);
    return { ok: false, refusal: 'failed' };
  }
}

/**
 * Pick a file, check it, and replace the trip with it. The caller has already
 * asked the user to confirm; nothing on the phone changes until the file has
 * been read and found to be a backup this app can restore.
 */
export async function restoreBackupFile(): Promise<RestoreFileOutcome> {
  const candidate = new File(databaseDirectory(), CANDIDATE);
  try {
    const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
    if (picked.canceled) {
      return { ok: false, refusal: 'cancelled' };
    }
    if (candidate.exists) {
      candidate.delete();
    }
    await picked.result.copy(candidate);
    const outcome = await restoreFromBackup(CANDIDATE);
    if (!outcome.ok) {
      return outcome;
    }
    await recordingEventDao.log('backup', `restored ${outcome.fixes} fixes`);
    // The recorder and the regions it watches start again from the restored
    // trip, as they do after an update.
    await syncRecordingWithPreferences('active');
    return outcome;
  } catch (error) {
    await recordingEventDao.logError('restore', error);
    return { ok: false, refusal: 'failed' };
  } finally {
    for (const name of [CANDIDATE, `${CANDIDATE}-wal`, `${CANDIDATE}-shm`]) {
      try {
        const leftover = new File(databaseDirectory(), name);
        if (leftover.exists) {
          leftover.delete();
        }
      } catch {
        // A leftover copy is overwritten on the next restore.
      }
    }
  }
}

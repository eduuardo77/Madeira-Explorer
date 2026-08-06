/**
 * Small key/value store for flags that are not trip data.
 *
 * Lives in SQLite rather than AsyncStorage so that everything the app knows is
 * in one file — one thing to back up, one thing to wipe for T-125.
 */

import { getDatabase } from '../database';

/**
 * Known keys, spelled out rather than passed as free strings. A typo in a key
 * name is otherwise a silent "setting did not stick" bug.
 */
export const AppStateKey = {
  /** Set once the user has actually been to Porto Santo. Permanent (D-024). */
  PortoSantoUnlocked: 'porto_santo_unlocked',
  /** Timestamp of the day-1 health check notification, so it fires once (T-049). */
  HealthCheckSentTs: 'health_check_sent_ts',
  /** Last location permission state we observed, for downgrade detection (T-044). */
  LastPermissionState: 'last_permission_state',
} as const;

export type AppStateKeyName =
  (typeof AppStateKey)[keyof typeof AppStateKey];

export async function get(key: AppStateKeyName): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_state WHERE key = ?;',
    key
  );
  return row?.value ?? null;
}

export async function set(
  key: AppStateKeyName,
  value: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_state (key, value, updated_ts) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                      updated_ts = excluded.updated_ts;`,
    key,
    value,
    Date.now()
  );
}

export async function getFlag(key: AppStateKeyName): Promise<boolean> {
  return (await get(key)) === 'true';
}

export async function setFlag(
  key: AppStateKeyName,
  value: boolean
): Promise<void> {
  await set(key, value ? 'true' : 'false');
}

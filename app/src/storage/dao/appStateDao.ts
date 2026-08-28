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
  /**
   * Which notifications have been sent for the current trip, comma-separated
   * (T-116). D-011 caps the app at two per trip and the privacy policy
   * promises it to the user in words (D-044); this is what enforces it rather
   * than everybody remembering. Cleared when a trip starts, because the budget
   * is per trip — a repeat visitor must get their day-1 check again.
   */
  NotificationsSent: 'notifications_sent',
  /**
   * When the app first ran — as close to "installed" as the app can honestly
   * get, and what the day-1 check counts from (T-049, D-011).
   */
  InstalledTs: 'installed_ts',
  /**
   * May the app record while it is not open (T-146)? `true` / `false`.
   *
   * ⚠ Not a substitute for the OS permission, which is the real gate and is
   * asked for in words during onboarding. This is the user's answer to a
   * different question — whether the app should *use* what it was granted —
   * and it is the switch that decides whether the map screen offers a manual
   * "Start walk" instead.
   */
  BackgroundTracking: 'background_tracking',
  /**
   * How closely to follow, when background recording is allowed (T-146):
   * `saver` / `balanced` / `precise`.
   *
   * ⚠ The settings screen names these by what they do, never by a battery
   * percentage. No figure in this project has been measured on real hardware
   * and D-041 keeps the reported one null on purpose.
   */
  TrackingQuality: 'tracking_quality',
  /** Last location permission state we observed, for downgrade detection (T-044). */
  LastPermissionState: 'last_permission_state',
  /**
   * Which map style the user prefers, `light` or `dark` (T-140, D-026).
   *
   * Light is the default because the everyday map is read outdoors in sunlight
   * and the light style is the one tuned for that. The souvenir always renders
   * dark regardless of this setting — the fog-of-war metaphor is the point
   * there, and it is not the user's choice to make.
   */
  MapStyle: 'map_style',
  /** Set once the user has been through onboarding, however it went (T-114). */
  OnboardingCompleted: 'onboarding_completed',
  /**
   * When the Always upgrade was offered. Its presence is what stops it being
   * offered a second time — an upgrade is never a gate, and a second ask is
   * pressure (D-008, T-043).
   */
  AlwaysOfferedTs: 'always_offered_ts',
  /**
   * JSON: which places the geofence manager is currently monitoring, and the
   * anchor it will rebuild on (T-039). Persisted rather than held in memory
   * because the process is routinely killed and relaunched headless between one
   * geofence event and the next.
   */
  GeofenceWorkingSet: 'geofence_working_set',
  /**
   * The sampling profile the gate believes the provider is on (T-034). Held
   * here rather than in memory because the process is killed and relaunched
   * between batches, and a fresh module would otherwise re-assume its default
   * every time.
   */
  SamplingProfile: 'sampling_profile',
  /**
   * JSON: the synthetic places generated for a field test of the geofence
   * manager. Development only — deleted along with everything else by T-125,
   * and made redundant by the real content pack (T-040).
   */
  DevPoiFixture: 'dev_poi_fixture',
  /**
   * JSON: place ids the user has been asked about and said no to (T-149).
   *
   * ⚠ **Asking twice is the whole reason this is stored.** A levada with real
   * but partial evidence stays partial for the rest of the trip, so without
   * this the passport would put the same question up every time it opened —
   * which reads as the app not believing the answer.
   */
  ConfirmationsDeclined: 'confirmations_declined',
  /**
   * Whether the passport has been unlocked — the single non-consumable purchase
   * (T-155, D-072). `true` / `false`, absent meaning free.
   *
   * ⚠ **A cache of the store's answer, not the answer.** T-156 makes Play
   * Billing the authority and writes it here so the passport can render at
   * launch, offline, in a levada valley, without waiting on a network call.
   *
   * ⚠ **It gates a display and nothing else.** Never read it in the recorder or
   * the award pass — `freeTier.ts` explains why, and a test enforces it.
   */
  StampsUnlocked: 'stamps_unlocked',
  /**
   * Whether the user pressed *Start walk* and has not pressed *Stop* (2026-08-28).
   *
   * ⚠ **Not "is the recorder running".** The recorder starts by itself on launch
   * for anybody with background recording (D-002), and the walk button must not
   * light up because of it — `manualWalk.ts` is the whole argument, and the
   * project lead's instruction was explicit.
   *
   * Stored rather than held in memory so a walk survives the app being closed
   * half way through it, which on a levada is the normal case. Absent means no
   * walk, which is what a fresh install and a fresh launch both want.
   */
  WalkStartedByUser: 'walk_started_by_user',
  /**
   * Whether the keep-running screen has been shown once (2026-08-28, Android).
   *
   * ⚠ Shown once and never again, even if the user skips it. It is advice about
   * the phone, not a setting: repeating it would be the app nagging about
   * something it cannot check — `batteryOptimisation.ts` explains why the app
   * can never read whether it is currently exempt.
   */
  KeepRunningSeen: 'keep_running_seen',
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

/**
 * Read a value that was stored as JSON.
 *
 * Returns null both when the key is absent and when the stored text will not
 * parse. Callers that care about the difference should say so at their own call
 * site — the two keys using this today disagree deliberately, and that policy
 * belongs with them rather than buried in here.
 *
 * The cast is unchecked, as it is for any JSON round-trip. The value came from
 * `setJson` one version of the app ago, so the risk is a schema change rather
 * than corruption, and both callers tolerate a null.
 */
export async function getJson<T>(key: AppStateKeyName): Promise<T | null> {
  const raw = await get(key);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson(
  key: AppStateKeyName,
  value: unknown
): Promise<void> {
  await set(key, JSON.stringify(value));
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

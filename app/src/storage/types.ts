/**
 * Row shapes for the local database.
 *
 * These mirror ARCHITECTURE.md §4. The string unions are deliberately narrow —
 * they are the whole reason for using TypeScript here. A typo in an activity
 * type would otherwise sit silently in the database for a week and only show up
 * as a matching bug in Phase 4.
 */

/** What the OS thought the user was doing when the fix was taken. */
export type ActivityType =
  | 'still'
  | 'walking'
  | 'running'
  | 'cycling'
  | 'driving'
  | 'unknown';

/**
 * Where a fix came from. This matters for matching: a `significant_change` fix
 * is coarse (hundreds of metres) and must not be snapped to a road with the
 * same confidence as a `gps` fix.
 */
export type FixSource = 'gps' | 'fused' | 'significant_change' | 'geofence';

export type GeofenceEventType = 'enter' | 'exit' | 'dwell';

export type EndDetectionMethod =
  | 'airport_geofence'
  | 'left_bbox'
  | 'inactivity'
  | 'manual';

export type RecordingEventKind =
  | 'start'
  | 'stop'
  | 'permission_change'
  | 'batch'
  | 'error'
  /**
   * The geofence manager rebuilding its monitored set (T-039). Its own kind
   * rather than a `batch`, because "did the set reshuffle when I drove across
   * the island?" is a question asked on its own in the field (T-076), and
   * because a run of these with no `batch` between them is a distinctive
   * symptom: the OS still trusts us with geofences but has stopped delivering
   * location updates.
   */
  | 'geofence'
  /**
   * A stamp was awarded (T-071). Its own kind because it is the one diary
   * line that corresponds to something the user is about to be shown, and
   * because "why did I get this stamp?" must be answerable months later.
   */
  | 'stamp'
  /** The day-1 check ran and said something (T-049). */
  | 'health_check'
  /** The trip was saved to a file, or restored from one (2026-10-04). */
  | 'backup'
  /** The trip was detected as over, and by which signal (T-099, D-012). */
  | 'trip_end'
  /**
   * An outing started or ended, a pause, or a restart from the silence notice
   * (D-087, T-198). ⚠ Its own kind, **not** `start`/`stop`: `recorderSilence`
   * reads the last `start` as the moment recording began, and an outing
   * logged as one would reset the evidence the silence notice depends on.
   */
  | 'outing'
  /**
   * A trace left the app, and how much of it was masked (T-104, D-016). The
   * one diary line that records a privacy-relevant action.
   */
  | 'export'
  /**
   * A notification was posted, or refused by the budget (T-116, D-011). Its
   * own kind because the cap of two per trip is a promise made to the user in
   * the privacy policy (D-044), and the diary is the only place a claim about
   * *how many were actually sent* can be checked after the fact.
   */
  | 'notification'
  | 'app_launch'
  /**
   * A database call was rejected for a released object and **succeeded when
   * repeated** (T-142).
   *
   * ⚠ Its own kind, and not `error`, for two reasons. It is not a failure —
   * nothing was lost, which is the whole point — so counting it as one would
   * make the day-1 health check (T-049) cry wolf. And it must still be
   * *visible*: a fix that works silently cannot be told apart from a bug that
   * did not happen to fire, and this one is intermittent.
   */
  | 'db_retry'
  /**
   * A WAL checkpoint found something worth knowing: the log had stalled far
   * past SQLite's autocheckpoint, or the checkpoint was refused (T-178).
   * Routine checkpoints write nothing — `storage/walPolicy.ts` decides.
   */
  | 'wal_checkpoint'
  /**
   * The map matched the trip to the road network (D-093): how many fixes,
   * how much was lit, how long it took. Written only when matching actually
   * ran, not on a cached answer, so it is the on-device timing record the
   * matcher's performance is judged by.
   */
  | 'map'
  /**
   * Android's activity transitions (D-094): registration refused or granted
   * once per process, and each batch of transitions drained into
   * `activity_event`. Diary only.
   */
  | 'activity'
  /**
   * What Google Play answered when asked what the account owns (T-156c): a
   * count and the decision, never a token or an order ID. Without it a query
   * on resume leaves no trace anywhere, and "did the app check?" cannot be
   * answered on the phone.
   */
  | 'billing';

export type Trip = {
  id: number;
  started_ts: number;
  ended_ts: number | null;
  end_detection_method: EndDetectionMethod | null;
  home_mask_lat: number | null;
  home_mask_lon: number | null;
  home_mask_radius_m: number | null;
};

/**
 * A trip as the passport's list shows it (T-261): its span, and how much was
 * recorded in it. Counted by the database, so listing every trip reads no fix.
 */
export type TripSummary = {
  id: number;
  started_ts: number;
  ended_ts: number | null;
  fix_count: number;
  stamp_count: number;
};

/** A fix as it goes in. `id` is assigned by the database. */
export type RawFixInput = {
  trip_id: number;
  ts: number;
  lat: number;
  lon: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  bearing_deg: number | null;
  altitude_m: number | null;
  activity_type: ActivityType;
  source: FixSource;
};

export type RawFix = RawFixInput & { id: number };

export type SensorSampleInput = {
  trip_id: number;
  ts: number;
  pressure_hpa: number | null;
  relative_altitude_m: number | null;
  step_count_delta: number | null;
};

export type SensorSample = SensorSampleInput & { id: number };

export type GeofenceEventInput = {
  trip_id: number;
  poi_id: string;
  ts: number;
  event_type: GeofenceEventType;
  accuracy_m: number | null;
};

export type GeofenceEvent = GeofenceEventInput & { id: number };

/**
 * A collected stamp. Derived from `geofence_event` and regenerable (T-071).
 */
export type StampAwardInput = {
  trip_id: number;
  place_id: string;
  awarded_ts: number;
  dwell_seconds: number | null;
  mean_speed_mps: number | null;
  confidence: number;
  reason: string | null;
};

export type StampAward = StampAwardInput & { id: number };

export type RecordingEvent = {
  id: number;
  ts: number;
  kind: RecordingEventKind;
  detail: string | null;
};

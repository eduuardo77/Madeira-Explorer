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
  | 'app_launch';

export type Trip = {
  id: number;
  started_ts: number;
  ended_ts: number | null;
  end_detection_method: EndDetectionMethod | null;
  home_mask_lat: number | null;
  home_mask_lon: number | null;
  home_mask_radius_m: number | null;
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

export type RecordingEvent = {
  id: number;
  ts: number;
  kind: RecordingEventKind;
  detail: string | null;
};

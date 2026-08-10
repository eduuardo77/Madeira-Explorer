/**
 * Database migrations.
 *
 * Each migration runs exactly once, in order, and is recorded in `schema_migration`.
 * Never edit a migration that has already shipped — add a new one instead. A user
 * who upgrades mid-trip must not lose their trace (D-010: raw traces are the only
 * irreplaceable asset).
 *
 * Time is stored as epoch milliseconds in INTEGER columns throughout. Plain,
 * sortable, and no timezone ambiguity.
 */

export type Migration = {
  id: number;
  name: string;
  statements: string[];
};

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'initial_recording_schema',
    statements: [
      // ---------------------------------------------------------------------
      // trip — the unit everything else hangs off.
      // ---------------------------------------------------------------------
      `CREATE TABLE trip (
         id                   INTEGER PRIMARY KEY AUTOINCREMENT,
         started_ts           INTEGER NOT NULL,
         ended_ts             INTEGER,
         -- airport_geofence | left_bbox | inactivity | manual
         end_detection_method TEXT,
         -- Accommodation masking (D-016). Populated at trip end, not during.
         home_mask_lat        REAL,
         home_mask_lon        REAL,
         home_mask_radius_m   REAL
       );`,

      // ---------------------------------------------------------------------
      // raw_fix — immutable, append-only. THE irreplaceable asset (D-010).
      //
      // Everything else in the database can be wiped and regenerated from this
      // table plus the content pack. This one cannot be recovered if lost.
      // ---------------------------------------------------------------------
      `CREATE TABLE raw_fix (
         id            INTEGER PRIMARY KEY AUTOINCREMENT,
         trip_id       INTEGER NOT NULL REFERENCES trip(id),
         ts            INTEGER NOT NULL,
         lat           REAL    NOT NULL,
         lon           REAL    NOT NULL,
         accuracy_m    REAL,
         speed_mps     REAL,
         bearing_deg   REAL,
         altitude_m    REAL,
         -- still | walking | running | cycling | driving | unknown
         activity_type TEXT    NOT NULL DEFAULT 'unknown',
         -- gps | fused | significant_change | geofence
         source        TEXT    NOT NULL
       );`,
      `CREATE INDEX idx_raw_fix_trip_ts ON raw_fix(trip_id, ts);`,

      // ---------------------------------------------------------------------
      // sensor_sample — barometer and pedometer. Also immutable.
      //
      // These are the sensors that keep working where GPS does not: in tunnels
      // and under Laurissilva canopy (ARCHITECTURE §8.4). On this island
      // elevation is enormously discriminating, so this table is not an
      // optional extra — it is how the VR1 gets told apart from the ER101
      // below it, and how a canopy-blackout levada gets credited at all.
      // ---------------------------------------------------------------------
      `CREATE TABLE sensor_sample (
         id                  INTEGER PRIMARY KEY AUTOINCREMENT,
         trip_id             INTEGER NOT NULL REFERENCES trip(id),
         ts                  INTEGER NOT NULL,
         pressure_hpa        REAL,
         relative_altitude_m REAL,
         step_count_delta    INTEGER
       );`,
      `CREATE INDEX idx_sensor_sample_trip_ts ON sensor_sample(trip_id, ts);`,

      // ---------------------------------------------------------------------
      // geofence_event — the backbone (D-005).
      //
      // Stamps are awarded from these, not from the location stream. Note we
      // store the raw enter/exit/dwell events, NOT the award decision. The
      // dwell + speed gate (D-009) is applied later over this log, so award
      // thresholds can be retuned without re-collecting anything.
      // ---------------------------------------------------------------------
      `CREATE TABLE geofence_event (
         id         INTEGER PRIMARY KEY AUTOINCREMENT,
         trip_id    INTEGER NOT NULL REFERENCES trip(id),
         poi_id     TEXT    NOT NULL,
         ts         INTEGER NOT NULL,
         -- enter | exit | dwell
         event_type TEXT    NOT NULL,
         accuracy_m REAL
       );`,
      `CREATE INDEX idx_geofence_event_trip_ts ON geofence_event(trip_id, ts);`,
      `CREATE INDEX idx_geofence_event_poi ON geofence_event(trip_id, poi_id, ts);`,

      // ---------------------------------------------------------------------
      // recording_event — the substrate for honest gap reporting.
      //
      // "If an OEM killed the service for three days, the app must not pretend
      // otherwise" (ARCHITECTURE §10). We cannot report a gap we did not
      // notice, so the recorder logs its own lifecycle here: starts, stops,
      // permission changes, batches, errors. This is what T-048 and the day-1
      // health check (T-049) read.
      // ---------------------------------------------------------------------
      `CREATE TABLE recording_event (
         id     INTEGER PRIMARY KEY AUTOINCREMENT,
         ts     INTEGER NOT NULL,
         -- start | stop | permission_change | batch | error | geofence | stamp |
         -- health_check | app_launch
         kind   TEXT    NOT NULL,
         detail TEXT
       );`,
      `CREATE INDEX idx_recording_event_ts ON recording_event(ts);`,

      // ---------------------------------------------------------------------
      // app_state — small key/value store for flags that are not trip data.
      // e.g. active trip id, Porto Santo unlock flag (D-024), last health check.
      // ---------------------------------------------------------------------
      `CREATE TABLE app_state (
         key        TEXT PRIMARY KEY,
         value      TEXT    NOT NULL,
         updated_ts INTEGER NOT NULL
       );`,

      // ---------------------------------------------------------------------
      // Immutability guards.
      //
      // CONTEXT §6.2 says raw_fix and sensor_sample are immutable and
      // append-only. These triggers make that a property of the database
      // rather than a convention someone can forget. UPDATE is blocked
      // outright; DELETE is left open because the "delete all my data"
      // control (T-125) has to be able to wipe.
      // ---------------------------------------------------------------------
      `CREATE TRIGGER raw_fix_is_immutable
         BEFORE UPDATE ON raw_fix
       BEGIN
         SELECT RAISE(ABORT, 'raw_fix is append-only (CONTEXT 6.2)');
       END;`,
      `CREATE TRIGGER sensor_sample_is_immutable
         BEFORE UPDATE ON sensor_sample
       BEGIN
         SELECT RAISE(ABORT, 'sensor_sample is append-only (CONTEXT 6.2)');
       END;`,
    ],
  },
  {
    id: 2,
    name: 'stamp_award',
    statements: [
      // ---------------------------------------------------------------------
      // stamp_award — the reward, and the only table the user actually sees
      // the effect of (T-071, D-002).
      //
      // DERIVED, not captured. Every row here is reproducible from
      // `geofence_event` plus `raw_fix` plus the content pack, which is why
      // CONTEXT §6.2 allows it to be wiped and regenerated freely — and why
      // the award pass is written to be re-runnable at any time.
      //
      // The judgement inputs are stored alongside the verdict on purpose
      // (D-009, T-072): dwell, mean speed and a confidence value mean the
      // thresholds can be retuned later (T-131) against real holidays,
      // without re-collecting a single fix.
      // ---------------------------------------------------------------------
      `CREATE TABLE stamp_award (
         id             INTEGER PRIMARY KEY AUTOINCREMENT,
         trip_id        INTEGER NOT NULL REFERENCES trip(id),
         -- The content pack's PLACE id, not a geofence id: a levada has two
         -- geofences and earns one stamp (D-034).
         place_id       TEXT    NOT NULL,
         awarded_ts     INTEGER NOT NULL,
         dwell_seconds  INTEGER,
         mean_speed_mps REAL,
         -- 0..1. Stored, never shown to the user.
         confidence     REAL    NOT NULL,
         -- Why it was awarded, in words. Diagnostic; also what makes a
         -- surprising award explicable months later.
         reason         TEXT,
         -- One stamp per place per trip. The award pass re-runs freely, so
         -- this is what makes re-running idempotent rather than duplicating.
         UNIQUE(trip_id, place_id)
       );`,
      `CREATE INDEX idx_stamp_award_trip ON stamp_award(trip_id, awarded_ts);`,
    ],
  },
];

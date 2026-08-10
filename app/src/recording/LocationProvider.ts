/**
 * The seam between "how we get location" and "everything else".
 *
 * WHY THIS EXISTS (D-025)
 * -----------------------
 * We are starting on the free `expo-location`. The paid Transistor Soft SDK is
 * a contingency, bought only if the Phase 1 soak tests (T-051…T-054) fail. That
 * decision is only cheap to reverse if the rest of the app never imports
 * `expo-location` directly. So: matching, storage, progress and presentation
 * talk to this interface, and nothing else knows which backend is underneath.
 *
 * The types below are deliberately OUR types, not Expo's. If a field only makes
 * sense to one backend it does not belong here.
 */

import type { ActivityType, FixSource, GeofenceEventType } from '../storage/types';

/**
 * What the user has granted.
 *
 * `while_using` is a fully supported operating mode, not a degraded one
 * (D-008). Background location is an upgrade we ask for around day 2, never a
 * gate on onboarding — gating install on the hardest permission in mobile is
 * the single most avoidable way to fail.
 */
export type PermissionLevel = 'undetermined' | 'denied' | 'while_using' | 'always';

/** One location reading, normalised across backends. */
export type LocationSample = {
  /** Epoch milliseconds. */
  ts: number;
  lat: number;
  lon: number;
  accuracyM: number | null;
  speedMps: number | null;
  bearingDeg: number | null;
  /**
   * GPS-derived altitude. Noisy, and NOT the altitude the matcher should trust
   * — barometric relative altitude from `sensor_sample` is the reliable one
   * (ARCHITECTURE §8.2). Stored anyway because raw data is never discarded.
   */
  altitudeM: number | null;
  activityType: ActivityType;
  source: FixSource;
};

export type GeofenceRegion = {
  /** Stable id from the content pack. Never a display name (D-017). */
  poiId: string;
  lat: number;
  lon: number;
  radiusM: number;
  /**
   * Both are required rather than defaulted, so that the decision lives in the
   * code that makes it instead of once per backend. A place wants both true.
   * The geofence manager's anchor region (T-039) is the exception: it is
   * exit-only, because we are standing in the middle of it when it is
   * registered and an enter event would carry no information. Each suppressed
   * event is a background wake-up we do not pay for.
   */
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
};

/**
 * A position good enough to decide *which* places to monitor, and not good
 * enough to record as a fix.
 *
 * Deliberately not a `LocationSample`: this comes from the OS's cache rather
 * than from a reading we asked for, so passing it off as a recorded fix would
 * be inventing data (ARCHITECTURE §10). It never reaches `raw_fix`.
 */
export type CoarsePosition = {
  ts: number;
  lat: number;
  lon: number;
  accuracyM: number | null;
};

export type GeofenceTransition = {
  poiId: string;
  ts: number;
  eventType: GeofenceEventType;
  accuracyM: number | null;
};

/**
 * How hard we are sampling. Activity-gated, because a stationary phone should
 * cost approximately nothing (ARCHITECTURE §7).
 */
export type SamplingProfile = 'stationary' | 'walking' | 'driving';

/**
 * Where recorded data goes.
 *
 * PLATFORM SUBTLETY, and it shapes this whole file:
 * background location on both platforms is delivered to a task that is
 * registered at *module scope* and may be invoked when the app has been
 * relaunched headless, with no UI and no React tree alive. That means the sink
 * cannot be a callback handed in at runtime by a component — such a callback
 * would simply not exist at the moment the OS wakes us.
 *
 * So the sink is a statically imported module, and the provider writes to it
 * directly. It looks less flexible than a listener API. It is the only shape
 * that survives the app being killed, which is the normal case for us, not the
 * exception.
 */
export interface RecordingSink {
  onLocations(samples: LocationSample[]): Promise<void>;
  onGeofenceTransition(transition: GeofenceTransition): Promise<void>;
  onError(message: string): Promise<void>;
}

export interface LocationProvider {
  /** For the debug screen and the recording diary. */
  readonly name: string;

  /**
   * The OS cap on simultaneously monitored regions: 20 on iOS, ~100 on Android.
   * Exposed rather than hardcoded because the dynamic geofence manager (T-039)
   * sizes its working set from it. iOS is the binding constraint, and building
   * for it from the start is why this is here in Phase 1 rather than Phase 3 —
   * it is painful to retrofit (D-005).
   */
  readonly maxSimultaneousRegions: number;

  getPermissionLevel(): Promise<PermissionLevel>;
  /** Ask for While-Using. Safe to call during onboarding. */
  requestWhileUsingPermission(): Promise<PermissionLevel>;
  /**
   * Ask for Always. On Android 11+ this cannot be granted inline — the OS sends
   * the user to a settings screen — and a prominent-disclosure screen is
   * required beforehand (T-121). Never call this during onboarding.
   */
  requestAlwaysPermission(): Promise<PermissionLevel>;

  startRecording(profile: SamplingProfile): Promise<void>;
  stopRecording(): Promise<void>;
  isRecording(): Promise<boolean>;
  setSamplingProfile(profile: SamplingProfile): Promise<void>;

  /**
   * The OS's cached position, if it has one no older than `maxAgeMs`.
   *
   * Free: it returns whatever the system already knows and never powers up the
   * GNSS chip. That is the whole reason this is on the interface rather than
   * the geofence manager calling for a fresh fix — rebuilding the monitored set
   * is a housekeeping task and must not cost a GPS acquisition (CONTEXT §6.3).
   * Returns null when the cache is empty or stale, and the caller is expected
   * to cope rather than escalate.
   */
  getLastKnownPosition(maxAgeMs: number): Promise<CoarsePosition | null>;

  startGeofencing(regions: GeofenceRegion[]): Promise<void>;
  stopGeofencing(): Promise<void>;
  isGeofencing(): Promise<boolean>;
}

/**
 * "Is this thing actually recording?" — gathered in one place (T-048).
 *
 * This is the substrate for three separate things: the debug screen (T-050),
 * the day-1 health check notification (T-049), and honest gap reporting in the
 * final map (ARCHITECTURE §10). All three ask the same question, so they share
 * one answer rather than each inventing their own.
 *
 * The reason this exists at all: a ghost app whose recording dies on day 2, and
 * which only reveals that on day 7, has done worse than nothing (D-011).
 */

import * as geofenceEventDao from '../storage/dao/geofenceEventDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as sensorSampleDao from '../storage/dao/sensorSampleDao';
import { getCurrentProgress } from '../progress/currentProgress';
import type { TripProgress } from '../progress/tripProgress';
import * as tripDao from '../storage/dao/tripDao';
import type { RecordingEvent } from '../storage/types';
import { locationProvider } from './ExpoLocationProvider';
import type { GeofenceStatus } from './geofenceManager';
import { getGeofenceStatus } from './geofenceManager';
import type { PermissionLevel, SamplingProfile } from './LocationProvider';
import { assessSilence, type SilenceVerdict } from './recorderSilence';
import { getCurrentSamplingProfile } from './samplingGate';

/**
 * How long a silence has to be before we call it a gap.
 *
 * ⚠ NOT TUNED (T-038/T-048). The stationary profile defers for up to 15
 * minutes by design, so anything below that is normal operation, not a fault.
 * 30 minutes is a guess at "long enough to be suspicious"; the Phase 0 traces
 * and the 72-hour soak (T-051) are what should actually set it.
 */
export const GAP_THRESHOLD_MS = 30 * 60 * 1000;

export type RecorderHealth = {
  providerName: string;
  permission: PermissionLevel;
  isRecording: boolean;
  /** What the stationary-vs-moving gate has selected (T-034). */
  samplingProfile: SamplingProfile;

  tripId: number | null;
  tripStartedTs: number | null;

  fixCount: number;
  lastFixTs: number | null;
  lastFixAccuracyM: number | null;

  sensorSampleCount: number;
  lastPressureHpa: number | null;
  lastRelativeAltitudeM: number | null;
  lastStepDelta: number | null;

  geofenceEventCount: number;
  /** The monitored window, not the events it produced (T-039). */
  geofence: GeofenceStatus;
  /** The hero number and its breakdown (T-072a/T-073) — `23 / 180`. */
  progress: TripProgress;

  gapCount: number;
  longestGapMs: number | null;

  /**
   * Whether the recorder is running and receiving nothing (T-052b).
   *
   * ⚠ **Read this before believing `isRecording`.** They are different claims:
   * `isRecording` says the task is registered, and this says whether anything
   * is coming back. For a day in August 2026 the first was true and the second
   * was not, and the screen showed only the first (D-047).
   */
  silence: SilenceVerdict;

  recentEvents: RecordingEvent[];
};

export async function getRecorderHealth(): Promise<RecorderHealth> {
  const [
    permission,
    isRecording,
    samplingProfile,
    geofence,
    progress,
    trip,
    recentEvents,
    lastStart,
  ] = await Promise.all([
    locationProvider.getPermissionLevel(),
    locationProvider.isRecording(),
    getCurrentSamplingProfile(),
    getGeofenceStatus(),
    getCurrentProgress(),
    tripDao.getActiveTrip(),
    recordingEventDao.getRecent(20),
    // When recording last began. The diary is the only record of it — the
    // provider can say *whether* it is recording but not since when.
    recordingEventDao.getLastOfKind('start'),
  ]);

  const now = Date.now();

  // No trip yet means nothing has ever been recorded. Report that plainly
  // rather than inventing zeroes that look like a healthy empty state.
  if (trip === null) {
    return {
      providerName: locationProvider.name,
      permission,
      isRecording,
      samplingProfile,
      tripId: null,
      tripStartedTs: null,
      fixCount: 0,
      lastFixTs: null,
      lastFixAccuracyM: null,
      sensorSampleCount: 0,
      lastPressureHpa: null,
      lastRelativeAltitudeM: null,
      lastStepDelta: null,
      geofenceEventCount: 0,
      geofence,
      progress,
      gapCount: 0,
      longestGapMs: null,
      // No trip means no fix has ever arrived — which, if recording has been
      // on for a while, is precisely the failure this reports. It is the state
      // the app sat in for a day, so it must not be skipped as "nothing yet".
      silence: assessSilence({
        isRecording,
        permission,
        profile: samplingProfile,
        recordingSinceTs: lastStart?.ts ?? null,
        lastFixTs: null,
        now,
      }),
      recentEvents,
    };
  }

  const [
    fixCount,
    lastFix,
    sensorSampleCount,
    lastSample,
    geofenceEventCount,
    gaps,
  ] = await Promise.all([
    rawFixDao.countFixes(trip.id),
    rawFixDao.getLastFix(trip.id),
    sensorSampleDao.countSamples(trip.id),
    sensorSampleDao.getLastSample(trip.id),
    geofenceEventDao.countEvents(trip.id),
    rawFixDao.findGaps(trip.id, GAP_THRESHOLD_MS),
  ]);

  let longestGapMs: number | null = null;
  for (const gap of gaps) {
    if (longestGapMs === null || gap.durationMs > longestGapMs) {
      longestGapMs = gap.durationMs;
    }
  }

  return {
    providerName: locationProvider.name,
    permission,
    isRecording,
    samplingProfile,
    tripId: trip.id,
    tripStartedTs: trip.started_ts,
    fixCount,
    lastFixTs: lastFix?.ts ?? null,
    lastFixAccuracyM: lastFix?.accuracy_m ?? null,
    sensorSampleCount,
    lastPressureHpa: lastSample?.pressure_hpa ?? null,
    lastRelativeAltitudeM: lastSample?.relative_altitude_m ?? null,
    lastStepDelta: lastSample?.step_count_delta ?? null,
    geofenceEventCount,
    geofence,
    progress,
    gapCount: gaps.length,
    recentEvents,
    longestGapMs,
    silence: assessSilence({
      isRecording,
      permission,
      profile: samplingProfile,
      recordingSinceTs: lastStart?.ts ?? null,
      lastFixTs: lastFix?.ts ?? null,
      now,
    }),
  };
}

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
import * as tripDao from '../storage/dao/tripDao';
import type { RecordingEvent } from '../storage/types';
import { locationProvider } from './ExpoLocationProvider';
import type { GeofenceStatus } from './geofenceManager';
import { getGeofenceStatus } from './geofenceManager';
import type { PermissionLevel, SamplingProfile } from './LocationProvider';
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
  isGeofencing: boolean;
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

  gapCount: number;
  longestGapMs: number | null;

  recentEvents: RecordingEvent[];
};

export async function getRecorderHealth(): Promise<RecorderHealth> {
  const [permission, isRecording, samplingProfile, geofence, trip, recentEvents] =
    await Promise.all([
      locationProvider.getPermissionLevel(),
      locationProvider.isRecording(),
      getCurrentSamplingProfile(),
      getGeofenceStatus(),
      tripDao.getActiveTrip(),
      recordingEventDao.getRecent(20),
    ]);

  const isGeofencing = geofence.active;

  // No trip yet means nothing has ever been recorded. Report that plainly
  // rather than inventing zeroes that look like a healthy empty state.
  if (trip === null) {
    return {
      providerName: locationProvider.name,
      permission,
      isRecording,
      isGeofencing,
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
      gapCount: 0,
      longestGapMs: null,
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
    isGeofencing,
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
    gapCount: gaps.length,
    recentEvents,
    longestGapMs,
  };
}

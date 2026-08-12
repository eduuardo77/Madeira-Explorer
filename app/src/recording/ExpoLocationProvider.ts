/**
 * `LocationProvider` implemented on the free `expo-location` (D-025).
 *
 * This is the ONLY file in the app allowed to import `expo-location` for
 * recording purposes. If the Phase 1 soak tests fail and we buy the Transistor
 * Soft licence, this file is replaced and nothing else moves.
 */

import * as Location from 'expo-location';
import { Platform } from 'react-native';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import type {
  CoarsePosition,
  GeofenceRegion,
  LocationProvider,
  PermissionLevel,
  SamplingProfile,
} from './LocationProvider';
import { getSamplingParameters } from './samplingPolicy';
import { GEOFENCE_TASK_NAME, LOCATION_TASK_NAME } from './taskNames';

function toExpoAccuracy(
  accuracy: 'coarse' | 'balanced' | 'high'
): Location.Accuracy {
  switch (accuracy) {
    case 'coarse':
      return Location.Accuracy.Low;
    case 'balanced':
      return Location.Accuracy.Balanced;
    case 'high':
      return Location.Accuracy.High;
  }
}

/**
 * iOS uses this to tune its own power heuristics — for example it will happily
 * pause updates for a walker who has stopped, but is more conservative for
 * automotive navigation.
 */
function toExpoActivityType(profile: SamplingProfile): Location.ActivityType {
  switch (profile) {
    case 'stationary':
      return Location.ActivityType.Other;
    case 'walking':
      return Location.ActivityType.Fitness;
    case 'driving':
      return Location.ActivityType.AutomotiveNavigation;
  }
}

function buildOptions(
  profile: SamplingProfile
): Location.LocationTaskOptions {
  const parameters = getSamplingParameters(profile);

  return {
    accuracy: toExpoAccuracy(parameters.desiredAccuracy),
    timeInterval: parameters.minTimeMs,
    distanceInterval: parameters.minDistanceM,

    // The batching knob, and the largest single battery win we have
    // (ARCHITECTURE §7). The chip buffers fixes and wakes us every few minutes
    // instead of every second.
    deferredUpdatesInterval: parameters.deferredIntervalMs,
    deferredUpdatesDistance: parameters.deferredDistanceM,

    activityType: toExpoActivityType(profile),

    // ⚠ WATCH THIS ONE IN THE SOAK TEST (T-051).
    //
    // iOS may pause location updates when it decides the user has stopped, and
    // it does not reliably resume on its own — historically it waits for a
    // significant location change. That is a large battery saving and a real
    // risk of silent recording death, which is precisely the failure D-011's
    // day-1 health check exists to catch.
    //
    // We accept it because the architecture already assumes this: geofences and
    // significant-location-change are the termination-survival backbone (D-005,
    // T-047), not the continuous stream. But it must be verified on a real
    // device over 72 hours before we believe it.
    pausesUpdatesAutomatically: parameters.pauseWhenStationary,

    // Keep the blue status bar off. With Always permission iOS does not require
    // it, and the product promise is that the app disappears (ghost operation).
    showsBackgroundLocationIndicator: false,

    // Android will not deliver background location without a foreground service
    // and its persistent notification. It mildly dents the ghost feeling and is
    // the honest trade — OEM battery managers kill everything else
    // (ARCHITECTURE §6.2).
    foregroundService: {
      notificationTitle: 'Recording your trip',
      notificationBody: 'Madeira Explorer is noting where you have been.',
      notificationColor: '#1B2A33',
      killServiceOnDestroy: false,
    },
  };
}

export class ExpoLocationProvider implements LocationProvider {
  readonly name = 'expo-location';

  /**
   * iOS 20, Android ~100. The dynamic geofence manager (T-039) sizes its
   * working set from this; iOS is the binding constraint everywhere.
   */
  readonly maxSimultaneousRegions = Platform.OS === 'ios' ? 20 : 100;

  async getPermissionLevel(): Promise<PermissionLevel> {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status === 'undetermined') {
      return 'undetermined';
    }
    if (foreground.status !== 'granted') {
      return 'denied';
    }

    const background = await Location.getBackgroundPermissionsAsync();
    return background.status === 'granted' ? 'always' : 'while_using';
  }

  async requestWhileUsingPermission(): Promise<PermissionLevel> {
    await Location.requestForegroundPermissionsAsync();
    const level = await this.getPermissionLevel();
    await recordingEventDao.log('permission_change', `while_using -> ${level}`);
    return level;
  }

  async requestAlwaysPermission(): Promise<PermissionLevel> {
    // Android 11+ cannot grant this inline — the OS opens a settings screen —
    // and a prominent-disclosure screen is required before we get here (T-121).
    // On iOS this is the escalation that shows the user a map of everywhere we
    // have tracked them, which is why it is timed for ~day 2 rather than
    // onboarding (D-008).
    await Location.requestBackgroundPermissionsAsync();
    const level = await this.getPermissionLevel();
    await recordingEventDao.log('permission_change', `always -> ${level}`);
    return level;
  }

  async startRecording(profile: SamplingProfile): Promise<void> {
    if (await this.isRecording()) {
      // Already running: treat as a profile change rather than restarting, so
      // we do not open a gap in the trace.
      await this.setSamplingProfile(profile);
      return;
    }

    await Location.startLocationUpdatesAsync(
      LOCATION_TASK_NAME,
      buildOptions(profile)
    );
    await recordingEventDao.log('start', `profile=${profile}`);
  }

  async stopRecording(): Promise<void> {
    if (!(await this.isRecording())) {
      return;
    }
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    await recordingEventDao.log('stop');
  }

  async isRecording(): Promise<boolean> {
    return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  async setSamplingProfile(profile: SamplingProfile): Promise<void> {
    // Calling start again with the same task name replaces the options in
    // place. Deliberately not stop-then-start: that would drop fixes during the
    // switch, and activity transitions are exactly when movement is happening.
    await Location.startLocationUpdatesAsync(
      LOCATION_TASK_NAME,
      buildOptions(profile)
    );
  }

  async getLastKnownPosition(
    maxAgeMs: number
  ): Promise<CoarsePosition | null> {
    const position = await Location.getLastKnownPositionAsync({
      maxAge: maxAgeMs,
    });
    if (position === null) {
      return null;
    }
    return {
      ts: position.timestamp,
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracyM: position.coords.accuracy ?? null,
    };
  }

  async startGeofencing(regions: GeofenceRegion[]): Promise<void> {
    if (regions.length === 0) {
      await this.stopGeofencing();
      return;
    }

    let effective = regions;
    if (regions.length > this.maxSimultaneousRegions) {
      // The caller (T-039) is supposed to have sized this already. Trim rather
      // than throw — dropping the far ones still leaves a working set — but
      // record it, because silently monitoring fewer places than we think we
      // are would show up much later as mysteriously missing stamps.
      effective = regions.slice(0, this.maxSimultaneousRegions);
      await recordingEventDao.log(
        'error',
        `geofence set of ${regions.length} exceeds cap ${this.maxSimultaneousRegions}; trimmed`
      );
    }

    await Location.startGeofencingAsync(
      GEOFENCE_TASK_NAME,
      effective.map((region) => ({
        identifier: region.poiId,
        latitude: region.lat,
        longitude: region.lon,
        radius: region.radiusM,
        notifyOnEnter: region.notifyOnEnter,
        notifyOnExit: region.notifyOnExit,
      }))
    );
  }

  async stopGeofencing(): Promise<void> {
    if (!(await this.isGeofencing())) {
      return;
    }
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }

  async isGeofencing(): Promise<boolean> {
    try {
      return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
    } catch {
      // ⚠ FOUND ON A DEVICE, AND IT WAS A D-008 VIOLATION. With While-Using
      // permission only, Expo rejects this call — *"Not authorized to use
      // background location services"* — rather than returning false. The
      // rejection travelled up through `getGeofenceStatus` and
      // `getRecorderHealth` and killed the entire debug screen, for precisely
      // the permission level D-008 says the app must be fully functional on.
      //
      // `false` is the honest answer: if we are not authorized to geofence,
      // then nothing is being monitored for us. Swallowing it here rather than
      // at each call site is deliberate — this is the platform boundary
      // (D-025), and "not authorized" is a platform detail the recorder, the
      // health check and the debug screen should not each have to know.
      return false;
    }
  }
}

/**
 * The single provider instance the app uses.
 *
 * Swapping backends (D-025) means changing this one line.
 */
export const locationProvider: LocationProvider = new ExpoLocationProvider();

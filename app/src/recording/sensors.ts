/**
 * Barometer and pedometer capture (T-035, T-036).
 *
 * These two sensors are almost free — dedicated low-power chips — and they keep
 * working in tunnels and under Laurissilva canopy where GPS simply stops
 * (ARCHITECTURE §8.4). On Madeira, elevation is enormously discriminating: it
 * is what separates the VR1 from the ER101 below it, and what identifies a
 * levada climb when there is no usable GPS for the middle of the walk.
 *
 * ⚠ TWO HONEST LIMITATIONS, both to be measured in Phase 1:
 *
 * 1. We sample these when a location batch wakes us, not continuously. A
 *    listener only runs while our process is alive, and the design target is a
 *    process that is suspended almost all the time. So the barometric profile
 *    will be as sparse as the location batches are. Whether that is dense
 *    enough to identify a levada climb is an open question — compare against
 *    the high-rate Phase 0 field traces, which were captured with a logger held
 *    permanently awake and are therefore denser than anything we will get here.
 *
 * 2. Pedometer support is asymmetric. `getStepCountAsync` reads historical step
 *    counts from the OS on iOS. Android has no equivalent historical query in
 *    expo-sensors, so there we accumulate from a live watcher while the process
 *    is alive and lose steps taken while suspended. This is a known gap in the
 *    free stack, of a piece with the Android restart gap in D-025.
 */

import { Platform } from 'react-native';
import { Barometer, Pedometer } from 'expo-sensors';

export type BarometerReading = {
  pressureHpa: number | null;
  relativeAltitudeM: number | null;
};

/** How long to wait for a single barometer event before giving up. */
const BAROMETER_READ_TIMEOUT_MS = 2000;

/**
 * Take one barometer reading.
 *
 * The Expo API is listener-shaped, so "read once" means subscribe, take the
 * first event, unsubscribe. The timeout matters: if we are running inside a
 * background wake-up the OS gives us a short budget, and hanging here would
 * cost us the whole batch.
 */
export async function readBarometerOnce(): Promise<BarometerReading | null> {
  const available = await Barometer.isAvailableAsync().catch(() => false);
  if (!available) {
    return null;
  }

  return new Promise<BarometerReading | null>((resolve) => {
    let settled = false;

    const finish = (reading: BarometerReading | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      subscription.remove();
      resolve(reading);
    };

    const timer = setTimeout(() => finish(null), BAROMETER_READ_TIMEOUT_MS);

    const subscription = Barometer.addListener((event) => {
      finish({
        pressureHpa: typeof event.pressure === 'number' ? event.pressure : null,
        // relativeAltitude is iOS-only. On Android we store null and derive
        // altitude from pressure later, against a reference set at trip start.
        relativeAltitudeM:
          typeof event.relativeAltitude === 'number'
            ? event.relativeAltitude
            : null,
      });
    });
  });
}

export async function isPedometerAvailable(): Promise<boolean> {
  return Pedometer.isAvailableAsync().catch(() => false);
}

/**
 * Steps between two instants, or null if we cannot know.
 *
 * Returning null rather than 0 is deliberate. Zero means "we looked and the
 * user did not move"; null means "we have no idea". The sensor-only levada
 * fallback (T-090) treats those completely differently — crediting a walk on
 * the strength of a step count we never actually read would be exactly the kind
 * of fabricated continuity ARCHITECTURE §10 forbids.
 */
export async function getStepsBetween(
  fromTs: number,
  toTs: number
): Promise<number | null> {
  if (Platform.OS !== 'ios') {
    // See limitation 2 in the file header. Android historical step queries are
    // not exposed by expo-sensors; a live watcher is the only route and it does
    // not survive suspension.
    return null;
  }

  const available = await isPedometerAvailable();
  if (!available) {
    return null;
  }

  try {
    const result = await Pedometer.getStepCountAsync(
      new Date(fromTs),
      new Date(toTs)
    );
    return result?.steps ?? null;
  } catch {
    return null;
  }
}

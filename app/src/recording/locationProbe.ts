/**
 * A diagnostic for T-052a. Not part of the product.
 *
 * THE QUESTION THIS EXISTS TO ANSWER
 * ----------------------------------
 * The recorder starts, the foreground service runs, and no fix ever reaches
 * `raw_fix`. `dumpsys location` shows our uid registering no location request
 * at all, so the failure is upstream of everything we wrote: nothing is asking
 * the OS for a position. Two candidates were left after permission, batching,
 * silent errors and the task definition were each ruled out by experiment:
 *
 *   1. `expo-location`'s Android *task* path never registers the request.
 *   2. The emulator injects positions the *fused* provider never sees, in which
 *      case this is an emulator limitation and not an app defect.
 *
 * Both are about plumbing far below our code, so the cheapest way to separate
 * them is to bypass the task path entirely and ask `expo-location` for a
 * position in the plainest way the library offers. If the plain foreground call
 * works, the fused provider is fine on this machine and the fault is in the
 * task path. If it does not, the emulator cannot deliver a position to this
 * library at all and nothing about the recorder is implicated yet.
 *
 * TWO PROBES, BECAUSE THEY USE DIFFERENT GMS CALLS
 * ------------------------------------------------
 * `getCurrentPositionAsync` lands on `FusedLocationProviderClient.getCurrentLocation`,
 * and `watchPositionAsync` lands on `requestLocationUpdates` — the same call the
 * background task path uses. Running both separates "the fused client is dead
 * here" from "streaming updates specifically never register".
 *
 * This file imports `expo-location` directly, which everywhere else is reserved
 * to `ExpoLocationProvider` (D-025). That rule exists so the *recorder* can
 * swap backends by changing one file; a throwaway probe of a specific backend's
 * behaviour is the one thing the seam is not protecting. It is deliberately not
 * reachable from anything but the debug screen.
 */

import * as Location from 'expo-location';

export type ProbeResult = {
  /** What `getCurrentPositionAsync` did — one shot, GMS `getCurrentLocation`. */
  oneShot: string;
  /** What `watchPositionAsync` did — the same call the task path makes. */
  watch: string;
  /** How many positions the watch delivered in its window. */
  watchCount: number;
};

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

function describePosition(position: Location.LocationObject): string {
  const coords = position.coords;
  const accuracy =
    coords.accuracy === null ? 'unknown' : `${Math.round(coords.accuracy)} m`;
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} (±${accuracy})`;
}

/**
 * Ask for a position the plainest way the library allows, twice over, and
 * report exactly what happened.
 *
 * Never throws: a diagnostic that fails by disappearing tells you nothing, and
 * "it threw this" is itself the result we came for.
 */
export async function probeForegroundLocation(
  windowMs = 15000
): Promise<ProbeResult> {
  let oneShot: string;
  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    oneShot = `got ${describePosition(position)}`;
  } catch (error) {
    oneShot = `failed — ${describeError(error)}`;
  }

  const samples: Location.LocationObject[] = [];
  let watch: string;
  let subscription: Location.LocationSubscription | null = null;

  try {
    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        // As eager as the API allows. The tuned constants (D-028) are a battery
        // decision and deliberately untouched here — this is not a recording
        // path, it is a question about whether anything arrives at all.
        timeInterval: 1000,
        distanceInterval: 0,
      },
      (position) => {
        samples.push(position);
      }
    );

    await new Promise((resolve) => setTimeout(resolve, windowMs));

    watch =
      samples.length === 0
        ? `registered, but delivered nothing in ${Math.round(windowMs / 1000)}s`
        : `${samples.length} in ${Math.round(windowMs / 1000)}s, last ${describePosition(samples[samples.length - 1])}`;
  } catch (error) {
    watch = `failed — ${describeError(error)}`;
  } finally {
    subscription?.remove();
  }

  return { oneShot, watch, watchCount: samples.length };
}

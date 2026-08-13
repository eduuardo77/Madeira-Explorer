/**
 * The impure half of the Directions handoff (T-115, D-018).
 *
 * `directionsLink.ts` decides *what* to open and is testable on a laptop; this
 * decides *whether it opened*, and cannot be tested without a phone. The split
 * is CONTEXT §6's rule, and it is the reason the URL shapes have unit tests at
 * all.
 *
 * ⚠ **`openURL` and catch, never `canOpenURL`.** On Android 11+ `canOpenURL`
 * answers a package-visibility question, not an "is there an app for this"
 * question: without a matching `<queries>` entry in the manifest it returns
 * false even on a phone with Google Maps on the home screen. Using it here
 * would produce the worst possible bug — a Directions button that silently
 * refuses on most devices, on a screen nobody can test without hardware.
 * Trying the URL and catching the rejection asks the OS the question we
 * actually have.
 *
 * ⚠ **This is the one place the app deliberately leaves itself.** Nothing here
 * makes a network request (D-001 is intact — a `geo:` URL is an intent, not a
 * fetch), but the other app certainly will, and that is the point of D-018:
 * routing is somebody else's job. What we hand over is one coordinate and one
 * name, both already on the user's device.
 */

import { Linking, Platform } from 'react-native';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import type { DirectionsTarget } from './directionsLink';
import { buildDirectionsLinks } from './directionsLink';

/**
 * Hand off to a maps app. Resolves true when something opened.
 *
 * Never throws: this is called from a press handler, and a rejected promise
 * there is an unhandled rejection in a release build. A false return is the
 * caller's cue to tell the user, which is the honest failure — "no maps app
 * on this phone" is a real state and a silent no-op is not an explanation.
 */
export async function openDirections(target: DirectionsTarget): Promise<boolean> {
  const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';
  const candidates = buildDirectionsLinks(target, platform);

  const failures: string[] = [];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // The scheme, not the whole URL: the diary should not accumulate a list
      // of the places the user thought about going to.
      failures.push(`${url.split(':')[0]} — ${message}`);
    }
  }

  await recordingEventDao.logError(
    'directions',
    candidates.length === 0
      ? 'no usable coordinate for this place'
      : `no app handled ${failures.join('; ')}`
  );

  return false;
}

/**
 * Which Google Maps renderer this device actually gave us (T-147).
 *
 * WHY THE APP HAS TO KNOW
 * -----------------------
 * Google's own dark map — `colorScheme: DARK`, the OEM one the project lead
 * asked for — is a **latest-renderer** feature. On the legacy renderer it is
 * ignored *in silence*: the user picks Dark and gets a white map, with no error
 * anywhere. So "use Google's dark map" cannot be a constant. It is a question
 * about the device, and this is the answer.
 *
 * HOW IT GETS HERE, WHICH IS DELIBERATELY UNGLAMOROUS
 * --------------------------------------------------
 * `plugins/withLatestMapsRenderer.js` asks Play services for the latest
 * renderer during `Application.onCreate` — nothing in `expo-maps` asks, which
 * is why the emulator's log said `preferredRenderer: null` — and the SDK's
 * callback reports which one was really loaded. That callback writes one word
 * to a file in the app's own directory, and this module reads it.
 *
 * A file rather than a native module, because a native module for one word
 * would be a build-time dependency, a bridge registration and a package to keep
 * working across Expo upgrades, to move a string that changes at most once per
 * launch. `expo-file-system` is already a dependency.
 *
 * ⚠ **Absent means legacy, not "unknown".** The file is missing on the first
 * launch after install (the callback is asynchronous and the map may render
 * first), on iOS, and if the write fails. In every one of those cases the safe
 * answer is the same: assume Google's dark map will not work and draw ours,
 * because a dark map that is slightly ours beats a white map for somebody who
 * asked for dark. This is the one place in the app where being wrong is cheap
 * in one direction and embarrassing in the other.
 */

import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/** The word the plugin writes: `LATEST` or `LEGACY`. */
const RENDERER_FILE = 'maps-renderer';

/**
 * Read once per launch and remembered.
 *
 * The value cannot change while the process lives — the renderer is chosen once
 * per process — so re-reading it on every render of the map screen would be a
 * synchronous file read on a hot path to learn something already known.
 */
let cached: boolean | null = null;

/**
 * Can this device draw Google's own dark map?
 *
 * Synchronous on purpose: the map screen needs it while deciding what to pass
 * to `GoogleMaps.View`, and an async answer would render the light map for one
 * frame first — a visible flash of white for a user who chose dark, which is
 * the exact complaint this whole exercise started from.
 */
export function supportsNativeDarkMap(): boolean {
  if (cached !== null) {
    return cached;
  }

  cached = readRenderer() === 'LATEST';
  return cached;
}

function readRenderer(): string | null {
  // The file only exists on Android; on iOS the question is not this one, and
  // Apple Maps (D-057, when an iOS build exists) has its own answer.
  if (Platform.OS !== 'android') {
    return null;
  }

  try {
    const file = new File(Paths.document, RENDERER_FILE);
    return file.exists ? file.textSync().trim().toUpperCase() : null;
  } catch {
    // A missing or unreadable file is a legitimate state, not an error worth
    // the diary: see the header — absent means legacy, and the app carries on.
    return null;
  }
}

/** Test seam. Not used in normal operation. */
export function forgetRendererForTests(): void {
  cached = null;
}

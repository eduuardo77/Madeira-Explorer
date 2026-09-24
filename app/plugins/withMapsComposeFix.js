/**
 * Force maps-compose 6.12.1 for every module (T-177): the blank map at start.
 *
 * THE BUG, FOUND 2026-09-24 ON THE P30 AND UPSTREAM
 * -------------------------------------------------
 * `expo-maps` pins `com.google.maps.android:maps-compose:6.10.0` (57.0.1, and
 * still on Expo's `main`). In 6.10.0 `GoogleMapsInitializer.initialize()` sets
 * `SUCCESS` inside `withContext(Dispatchers.IO)`. If the UI recomposes on that
 * before `withContext` returns, the `LaunchedEffect` that launched it leaves the
 * composition and is cancelled; the cancellation surfaces as an exception, the
 * `catch (_: Exception)` overwrites `SUCCESS` with `FAILURE`, and `FAILURE` is
 * never retried. The map that was just created is torn down and the screen
 * stays grey until the process dies. Reported as
 * googlemaps/android-maps-compose#776 against exactly 6.10.0; fixed by #778 in
 * **6.12.0** (a cancelled init goes back to `UNINITIALIZED` and retries).
 *
 * On the P30 it is lost when the app's process already existed before the user
 * opened it (EMUI prelaunch, or the recorder's background start): Play services
 * answers almost at once, so the race is tight. Measured: 22 of 22 blank
 * launches ran in a pre-existing process, 37 of 37 good ones in a fresh one, and
 * a remount did not bring a blank map back (the state was `FAILURE`).
 *
 * WHY A FORCE, AND WHY IN THE ROOT BUILD FILE
 * -------------------------------------------
 * `expo-maps` is compiled from source in this build. Forcing the version in
 * `allprojects` makes it compile **against** 6.12.1, so an API break is a build
 * error rather than a `NoSuchMethodError` on somebody's phone. The `GoogleMap`
 * signature is identical in 6.10.0 and 6.12.1 (checked).
 *
 * ⚠ Remove this when expo-maps pins 6.12.0 or later: `mapsComposeFix.test.ts`
 * fails the build when it does, so this cannot quietly outlive its reason.
 *
 * A plugin rather than an edit, because `android/` is generated (CNG) and a
 * hand edit is lost on the next prebuild — the same reasoning as
 * `withLatestMapsRenderer.js`.
 */

const { withProjectBuildGradle } = require('expo/config-plugins');

const VERSION = '6.12.1';
const MARKER = '// T-177: maps-compose fix (withMapsComposeFix.js)';

const BLOCK = `
${MARKER}
allprojects {
  configurations.all {
    resolutionStrategy.force 'com.google.maps.android:maps-compose:${VERSION}'
  }
}
`;

module.exports = function withMapsComposeFix(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes(MARKER)) {
      return mod;
    }
    mod.modResults.contents = `${mod.modResults.contents.trimEnd()}\n${BLOCK}`;
    return mod;
  });
};

module.exports.VERSION = VERSION;

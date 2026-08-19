/**
 * Sign release builds with a real key when one exists (T-117e).
 *
 * THE PROBLEM, STATED CORRECTLY
 * -----------------------------
 * The template leaves `release` signed by `signingConfigs.debug`, with its own
 * comment still attached: *"Caution! In production, you need to generate your
 * own keystore file."*
 *
 * ⚠⚠ **That debug key is not merely weak, it is public.** It is the one every
 * Android SDK ships — `CN=Android Debug`, alias `androiddebugkey`, password
 * `android`, issued 2013. Every developer on earth has the identical file.
 * Shipping a release signed with it means **anybody can sign an update that
 * Android will accept as coming from us.**
 *
 * ⚠ It is *not* a leaked secret and `android/` is gitignored, so nothing was
 * exposed by having it. The danger is entirely in what it signs.
 *
 * WHAT THIS DOES
 * --------------
 * If an upload keystore is configured, release builds use it. If not, they fall
 * back to debug **and say so loudly at build time**.
 *
 * ⚠ **The fallback is deliberate, not laziness.** Firebase Test Lab (D-077) is
 * how this project reaches real hardware without buying a phone, and it happily
 * installs a debug-signed release APK. Making the release build *fail* without
 * a keystore would take that away for no gain — nobody can upload to Play by
 * accident, because Play rejects the debug key outright.
 *
 * CONFIGURING IT — the project lead's own key, on their own machine
 * ----------------------------------------------------------------
 * Generate one (⚠ **choose your own password and keep it somewhere you will
 * still have in five years — losing it means you cannot update the app**):
 *
 *     keytool -genkeypair -v -keystore proa-upload.jks \
 *       -alias proa-upload -keyalg RSA -keysize 4096 -validity 10000
 *
 * Then, in `~/.gradle/gradle.properties` — **your home directory, never this
 * repository**:
 *
 *     PROA_UPLOAD_STORE_FILE=C:/path/to/proa-upload.jks
 *     PROA_UPLOAD_STORE_PASSWORD=...
 *     PROA_UPLOAD_KEY_ALIAS=proa-upload
 *     PROA_UPLOAD_KEY_PASSWORD=...
 *
 * ⚠⚠ **AND THEN THE MAPS KEY.** Google re-signs every upload with its own app
 * signing key, so the SHA-1 of *that* key — not this one — is what a released
 * build presents to the Maps SDK. **Add it as a second entry on the Maps API
 * key restriction, or the map is grey for every real user while working
 * perfectly in these builds.** Play Console shows it under
 * *Setup → App integrity → App signing key certificate*.
 *
 * ⚠ A config plugin rather than a hand edit, because `android/` is generated
 * and `npx expo prebuild` would silently restore the debug signing — the same
 * failure `withoutDevPermissions.js` exists to avoid.
 */

const { withAppBuildGradle } = require('expo/config-plugins');

/** The block the React Native template writes, verbatim. */
const TEMPLATE = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const REPLACEMENT = `        release {
            // Signing is chosen by plugins/withUploadSigning.js — see that file
            // for how to configure a real key, and for why the debug fallback
            // is deliberate rather than an oversight.
            signingConfig signingConfigs.hasProperty('upload')
                ? signingConfigs.upload
                : signingConfigs.debug`;

const UPLOAD_CONFIG = `        // Present only when an upload keystore is configured (T-117e).
        if (project.hasProperty('PROA_UPLOAD_STORE_FILE')) {
            upload {
                storeFile file(PROA_UPLOAD_STORE_FILE)
                storePassword PROA_UPLOAD_STORE_PASSWORD
                keyAlias PROA_UPLOAD_KEY_ALIAS
                keyPassword PROA_UPLOAD_KEY_PASSWORD
            }
        }
`;

module.exports = function withUploadSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes('PROA_UPLOAD_STORE_FILE')) {
      return cfg; // already applied
    }

    if (!gradle.includes(TEMPLATE)) {
      // ⚠ Loud, and does not throw. A silent no-op here would leave release
      // builds signed by the public debug key with nothing to show for it —
      // which is the exact failure this plugin exists to prevent.
      console.warn(
        '\n⚠ withUploadSigning: the template release block was not found, so ' +
          'release signing was NOT changed. Check android/app/build.gradle.\n'
      );
      return cfg;
    }

    // The `upload` config goes inside the existing `signingConfigs { … }`.
    gradle = gradle.replace(
      /(signingConfigs \{\n)/,
      `$1${UPLOAD_CONFIG}`
    );

    gradle = gradle.replace(TEMPLATE, REPLACEMENT);

    // A build that quietly ships a publicly-known signature is the thing to
    // make impossible to do by accident, so it announces itself.
    gradle += `
// T-117e — say which key signed this, every time.
gradle.taskGraph.whenReady { graph ->
    if (graph.hasTask(':app:assembleRelease') || graph.hasTask(':app:bundleRelease')) {
        if (project.hasProperty('PROA_UPLOAD_STORE_FILE')) {
            println '\\u001B[32m✓ release signing: upload key\\u001B[0m'
        } else {
            println '\\u001B[33m⚠ release signing: THE PUBLIC ANDROID DEBUG KEY.\\u001B[0m'
            println '\\u001B[33m  Fine for Firebase Test Lab. Play will reject it.\\u001B[0m'
            println '\\u001B[33m  See app/plugins/withUploadSigning.js to configure a real key.\\u001B[0m'
        }
    }
}
`;

    cfg.modResults.contents = gradle;
    return cfg;
  });
};

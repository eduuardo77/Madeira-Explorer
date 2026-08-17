/**
 * Expo config, with the one value that must never be committed (D-057).
 *
 * `app.json` still holds everything static. This wraps it to inject the
 * **Google Maps Android API key** from the environment, because the platform
 * map needs one and a key in git is a key somebody else can bill.
 *
 *     # app/.env  — gitignored, never committed
 *     GOOGLE_MAPS_API_KEY=AIza...
 *
 * ⚠ WITHOUT A KEY THE MAP IS A GREY GRID. That is not a bug in the app: the
 * Google Maps SDK renders nothing without one, and it looks exactly like a
 * broken screen. Everything else — recording, stamps, the passport, the card —
 * works regardless, because none of it touches the map.
 *
 * ⚠ THE KEY IS RESTRICTED, NOT SECRET. Android map keys ship inside the APK by
 * design and can be extracted from any build; Google's own guidance is to
 * restrict them rather than hide them. Restrict by **package name**
 * (`com.proa.madeira`) **and SHA-1 certificate fingerprint**, and to the
 * *Maps SDK for Android* API only. An unrestricted key on a public repository
 * is the one that ends up on somebody else's bill. Keeping it out of git is
 * still worth doing — public-repo scanners will disable a leaked key, and the
 * debug and release builds have different fingerprints anyway.
 *
 * ⚠⚠ **THE PACKAGE NAME CHANGED ON 2026-08-17** — `com.madeiraexplorer.app` →
 * `com.proa.madeira` (D-074). **An existing key restricted to the old package will
 * silently stop working**, and the symptom is the grey grid above, which reads as a
 * broken app rather than a stale console setting. Update the restriction in Google
 * Cloud console before the next build. The SHA-1 does not change.
 *
 * Getting one: Google Cloud console → new project → enable *Maps SDK for
 * Android* → Credentials → create API key → restrict as above. Map display on
 * the mobile SDK is free and unlimited (SKU `6DE1-4D9C-5B67`), but the account
 * still needs billing enabled.
 */

const app = require('./app.json');

module.exports = () => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  return {
    ...app.expo,
    android: {
      ...app.expo.android,
      // Omitted entirely rather than set to an empty string: the plugin writes
      // whatever it is given straight into the manifest, and an empty key
      // fails differently — and less legibly — than a missing one.
      ...(apiKey ? { config: { googleMaps: { apiKey } } } : {}),
    },
  };
};

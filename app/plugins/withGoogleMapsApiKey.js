/**
 * Put the Google Maps API key into the Android manifest (D-057).
 *
 * WHY THIS PLUGIN EXISTS — AND IT IS NOT AN OVERSIGHT BY EXPO
 * -----------------------------------------------------------
 * Setting `android.config.googleMaps.apiKey` in the Expo config looks like it
 * should be enough. It is not. Expo's own `withGoogleMapsApiKey` mod — the
 * thing that writes `com.google.android.geo.API_KEY` into the manifest — is
 * registered as a **fallback for `react-native-maps`** and runs only when that
 * package is installed (`@expo/prebuild-config/build/plugins/unversioned/
 * react-native-maps.js`). This app uses **`expo-maps`**, whose own plugin only
 * handles location permissions.
 *
 * So without this file the key is read, validated, carried all the way through
 * `expo config`, and then quietly dropped. The Google Maps view initialises
 * happily and renders **nothing**, which is indistinguishable from a wrong key,
 * a mis-restricted key, or a billing problem — the three things anybody would
 * check first, none of which would be the cause.
 *
 * ⚠ Found by testing with a deliberately fake key before the real one existed.
 * The check that catches it, any time this is in doubt:
 *
 *     npx expo prebuild --platform android
 *     grep -A2 "com.google.android.geo.API_KEY" \
 *       android/app/src/main/AndroidManifest.xml
 *
 * The implementation is Expo's own, imported rather than reimplemented: it
 * reads the key from the same config path and handles the "no key" case by
 * removing the entry, which is what keeps a keyless checkout building.
 */

const { AndroidConfig } = require('@expo/config-plugins');

module.exports = AndroidConfig.GoogleMapsApiKey.withGoogleMapsApiKey;

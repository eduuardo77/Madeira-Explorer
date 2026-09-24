/**
 * Build the map only once the app has been in the foreground (T-177).
 *
 * THE MECHANISM, READ FROM SOURCE 2026-09-24
 * ------------------------------------------
 * `expo-maps` hosts Google's map in a Compose view (`ExpoComposeView`,
 * expo-modules-core 57.0.10, unchanged on Expo's `main`). When that view is
 * **built**, it pins its composition to `appContext.currentActivity`. If there
 * is no current Activity yet, it takes a fallback: it disposes the composition
 * on the first re-attach after a detach — and Android runs that listener
 * *after* the view's own `onAttachedToWindow` has re-created the composition,
 * so the fresh one is killed and nothing makes another. What is left is exactly
 * the signature measured on the P30: `GoogleMapsView → ComposeView →
 * AndroidViewsHandler` with no `MapView`, a blank grey map, while the Maps SDK
 * logs that it created and loaded a map moments earlier.
 *
 * React's current Activity is set in `onHostResume`, which is also what turns
 * `AppState` to `'active'`. It can still be null while views mount when
 * JavaScript was already running before the Activity came up — the location
 * task starts it in the background (T-196). Two of the four blank launches
 * captured were such warm starts.
 *
 * So the map waits for `'active'` once, and then never unmounts for the app
 * going to the background: a latch, not a mirror of `AppState`. The fallback
 * exists for react-native-screens, which this app does not use.
 *
 * Pure; `NativeMapScreen.tsx` holds the state.
 */

export function mapMayMount(alreadyActive: boolean, appState: string): boolean {
  return alreadyActive || appState === 'active';
}

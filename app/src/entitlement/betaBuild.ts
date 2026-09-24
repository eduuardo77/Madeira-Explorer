/**
 * Is this a closed-beta build? (D-084, T-182.)
 *
 * D-084: public v1 ships with Play Billing; the **closed beta runs unlocked**,
 * so testers see every stamp they earn and nobody is asked to pay for an app
 * that cannot take payment yet (T-156). This is decided at **build time**, not
 * by a setting: `EXPO_PUBLIC_PROA_BETA=1` when the APK is built, which Expo
 * inlines into the JavaScript bundle. A store build without it stays locked.
 *
 * ⚠ **Gradle does not re-bundle when only an environment variable changes**
 * (the same trap as `content/`, docs/dev-build.md). Delete the bundle outputs
 * before building the other flavour, and check the result with the Settings
 * version row, which says "beta".
 *
 * Pure: the flag is read by the caller and passed in, so the rule is testable.
 */

/** Unlocked if the store says so, or if this is a beta build. */
export function effectiveUnlocked(storedUnlocked: boolean, betaBuild: boolean): boolean {
  return storedUnlocked || betaBuild;
}

/**
 * What the user has decided about tracking (T-146).
 *
 * One choice: **may the app record when it is not open?** A yes/no about
 * consent. Stored as text, parsed here, and nothing else in the app is allowed
 * to interpret the raw string, the same rule `mapStylePreference` follows: a
 * text column will eventually contain something nobody expected, and the cost
 * of that must be a lost preference rather than a broken recorder (D-010).
 *
 * ⚠ THERE USED TO BE A SECOND CHOICE, AND IT WAS REMOVED ON PURPOSE (D-108)
 * ------------------------------------------------------------------------
 * Until 25 Oct 2026 the user also picked how closely to follow them: Poupança,
 * Equilibrado or Preciso. Since D-106 every tier used the GPS while moving, so
 * they differed only in how far apart the kept points were, and that bought
 * nothing visible: two Preciso outings thinned to Equilibrado's spacing lit
 * the same route within 0 to 2 points (recording-modes proposal, measurement
 * 3). The project lead could not tell the three apart. The app now records one
 * way, today's Equilibrado, and *Começar passeio* records the same way.
 *
 * A stored `tracking_quality` row from an older version is simply never read.
 *
 * Pure: no storage, no Expo. Tested in `trackingPreference.test.ts`.
 */

/**
 * ⚠ Background recording defaults to **on**, and that deserves justifying.
 *
 * It is not a licence the app grants itself: the OS permission is the real
 * gate, the user has already been asked for it in plain words during onboarding
 * (T-114), and this switch cannot record anything without it. What it does is
 * decide whether the app *uses* what it was given. Defaulting it off would mean
 * a user who granted Always, and said yes on purpose, gets an app that does
 * nothing until they find a setting, which is the failure D-008 describes.
 */
export const DEFAULT_BACKGROUND_TRACKING = true;

/**
 * Parse the background-recording switch.
 *
 * ⚠ Anything unrecognised is **true**, matching the default. A stored value
 * this cannot read is a bug in the app, and the user's answer to it must be the
 * app's normal behaviour rather than a silent opt-out of the thing they came
 * for. An explicit `false` is the only way to be off, which is what makes the
 * off state a decision somebody made rather than a value that got lost.
 */
export function parseBackgroundTracking(raw: string | null): boolean {
  const value = (raw ?? '').trim().toLowerCase();
  return value === 'false' || value === '0' ? false : DEFAULT_BACKGROUND_TRACKING;
}

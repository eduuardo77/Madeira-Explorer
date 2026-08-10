/**
 * The web build has no background tasks — and must not pretend otherwise.
 *
 * Metro resolves `.web.ts` in preference to `.ts` when bundling for web, so
 * this file replaces `backgroundTasks.ts` entirely there. That is the whole
 * mechanism: no `Platform.OS` conditionals leak into the real recorder, which
 * stays exactly as written for the platforms that actually ship.
 *
 * WHY A WEB BUILD EXISTS AT ALL
 * -----------------------------
 * Purely as a design workbench (`App.web.tsx`). D-032 puts the remaining
 * effort into the interface, and an interface nobody can look at cannot be
 * judged. The browser renders the passport and the primary screen against
 * fixture data, in seconds, with no phone involved.
 *
 * **Web is not a target and never will be.** The app needs background
 * location, OS geofences and an offline native renderer; a browser has none of
 * them. Nothing here should ever grow past no-ops, and if it starts to, the
 * workbench has been mistaken for a product.
 */

export const LOCATION_TASK_NAME = 'madeira-location-updates';
export const GEOFENCE_TASK_NAME = 'madeira-geofencing';

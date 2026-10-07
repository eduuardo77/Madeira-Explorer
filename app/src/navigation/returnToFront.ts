/**
 * Whether an app state change is a return to the front (T-273).
 *
 * ⚠ Not every "active". Android reports "active" while the app is starting,
 * after the screens have mounted and done their launch work, and three
 * listeners took it for a return and did that work again at once: the map's
 * load, Play's purchase query, and the recorder's start, which re-registered
 * every geofence and so set off a second burst of crossings (P30, 2026-10-07).
 *
 * Nor only "active" after "background": an app the OS started in the
 * background (an update, a batch) and then opened sees no background event
 * after it mounted, and its deferred recorder start must still run (T-212).
 * So the rule is a change into "active" from any other state, starting from
 * the state at subscription. Pure; `onReturnToFront.ts` subscribes.
 */

export type FrontState = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

export function isReturnToFront(previous: FrontState, next: FrontState): boolean {
  return next === 'active' && previous !== 'active';
}

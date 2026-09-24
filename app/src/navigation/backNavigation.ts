/**
 * Where Android's Back button goes, per screen (T-211).
 *
 * ⚠ FOUND ON THE P30, 2026-09-24: the app had no Back handling at all, so Back
 * from Settings, the passport, the replay or an open place card **left the
 * app** instead of going back one step. Every Android user presses it.
 *
 * Pure, so the map of screens is testable; `ui/useBackHandler.ts` is the
 * impure half. Null means "the app has nothing to go back to": the OS then
 * does its default, which sends the app to the background (the recorder keeps
 * running, D-010).
 */

export type AppScreen = 'map' | 'passport' | 'replay' | 'settings' | 'debug';

export function backTarget(screen: AppScreen): AppScreen | null {
  switch (screen) {
    case 'map':
      return null;
    case 'replay':
      // The replay is opened from the passport, so it goes back there.
      return 'passport';
    case 'passport':
    case 'settings':
    case 'debug':
      return 'map';
  }
}

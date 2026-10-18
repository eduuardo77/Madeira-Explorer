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

/**
 * ⚠ `replay` is the trip viewer since T-253 (the id kept, so nothing else moves);
 * `timelapse` is the animated film, WalkNYC's *Replay*, opened from the viewer.
 */
export type AppScreen = 'map' | 'passport' | 'replay' | 'timelapse' | 'settings' | 'debug';

/**
 * Whether the map stays mounted, hidden, under this screen (2026-10-18).
 *
 * Opening Settings or the passport used to unmount the map, so every return
 * built it again: Google's view, about 600 road lines, the tiles, and today's
 * matching (some 730 ms on the P30). Kept, it is back at once. Not under the
 * trip viewer or the film: each draws a map of its own, and two Google maps
 * alive at once is the memory the project lead's lag reports were about.
 */
export function keepsMapMounted(screen: AppScreen): boolean {
  return screen === 'map' || screen === 'settings' || screen === 'passport' || screen === 'debug';
}

/**
 * Whether the passport stays mounted, hidden, under this screen (2026-10-18):
 * from its first opening on, under every screen.
 *
 * Each opening used to build it again, a spinner for about two seconds on the
 * P30, and so did every return from the trip viewer it opens. It holds no map,
 * so keeping it costs little; it is not built before it is first asked for, so
 * a launch does not pay for a screen the user may not open.
 */
export function keepsPassportMounted(screen: AppScreen, openedBefore: boolean): boolean {
  return openedBefore || screen === 'passport';
}

export function backTarget(screen: AppScreen): AppScreen | null {
  switch (screen) {
    case 'map':
      return null;
    case 'replay':
      // The trip viewer is opened from the passport, so it goes back there.
      return 'passport';
    case 'timelapse':
      // And the timelapse from the trip viewer.
      return 'replay';
    case 'passport':
    case 'settings':
    case 'debug':
      return 'map';
  }
}

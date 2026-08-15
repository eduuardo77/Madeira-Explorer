/**
 * Which dark map the app draws, and why there are two (T-147, D-057).
 *
 * THE PROJECT LEAD'S INSTRUCTION, 2026-08-15: *"keep it OEM as possible"*
 * ----------------------------------------------------------------------
 * Google ships a dark map. It is styled and maintained by the people who make
 * the cartography, it changes when their light map changes, and it is what
 * every other app on the phone shows at night. Using it is the right default
 * for the same reason this project uses the platform's map at all (D-057):
 * ours would be a permanent, unpaid maintenance obligation to look *nearly* as
 * good as theirs.
 *
 * So the native one is the default, and the authored style in
 * `googleNightStyle.ts` is a **fallback that is off**.
 *
 * ⚠ WHY A FALLBACK HAS TO EXIST AT ALL
 * ------------------------------------
 * `colorScheme` is a **latest-renderer** feature of the Maps SDK. Where Play
 * services loads the legacy renderer it is ignored *in silence* — no error, no
 * warning, a white map after the user chose dark. `plugins/withLatestMapsRenderer.js`
 * now asks for the latest renderer at startup, which is the documented way to
 * avoid that and which nothing in `expo-maps` was doing. It is a request, not a
 * guarantee: where the new renderer is genuinely unavailable, Play services
 * falls back and the app cannot tell from JavaScript that it happened.
 *
 * So the app asks the device which renderer it got and decides from that
 * (`mapsRenderer.ts`): Google's dark map where it works, ours where it cannot.
 * Nobody gets a white map after choosing dark, and nobody gets our cartography
 * when Google's own is available.
 *
 * The evidence, on any device, is one line printed at every launch:
 *
 *     adb logcat -s MadeiraExplorer   →   Maps renderer: LATEST | LEGACY
 *
 * ⚠ Measured on the project's emulator, 2026-08-15: it asks for LATEST and is
 * given **LEGACY** — Play services there does not have the new renderer at all.
 * So the fallback is not hypothetical, and the emulator is the one device that
 * can never show what most users will actually see.
 */

import { GOOGLE_NIGHT_STYLE_JSON } from './googleNightStyle.ts';
import type { MapStyleName } from './mapStyle.ts';

/**
 * ⚠ This used to be a constant, and a constant was the wrong shape.
 *
 * Whether Google's dark map works is a **fact about the device**, not a
 * preference: it needs the latest Maps renderer, and where Play services hands
 * back the legacy one the property is ignored in silence. Hard-coding either
 * answer means shipping a white map to somebody. `mapsRenderer.ts` reads what
 * the device actually did, and this asks it.
 */
export type NativeDarkMapCheck = () => boolean;

export type DarkMapProps = {
  /** True asks the SDK for its own night map. The caller maps this to the enum. */
  dark: boolean;
  /** Undefined leaves Google's cartography exactly as shipped. */
  mapStyleJson: string | undefined;
};

/**
 * What the map should be handed for the chosen style.
 *
 * ⚠ The style JSON is undefined for light in every case. Passing a style at all
 * replaces Google's default cartography, and there is no "empty" style that
 * means "yours please" — an empty array is a blank map.
 *
 * Returns a boolean rather than the SDK's enum so that this decision stays
 * testable without Expo. The caller does the one-line mapping.
 */
export function darkMapPropsFor(
  style: MapStyleName,
  nativeDarkMapWorks: NativeDarkMapCheck
): DarkMapProps {
  if (style !== 'dark') {
    return { dark: false, mapStyleJson: undefined };
  }

  return {
    dark: true,
    // ⚠ The authored style is the *fallback*, and only that. Where Google's
    // own dark map works it is drawn untouched — better cartography than this
    // project will ever maintain, and it changes when theirs does.
    mapStyleJson: nativeDarkMapWorks() ? undefined : GOOGLE_NIGHT_STYLE_JSON,
  };
}

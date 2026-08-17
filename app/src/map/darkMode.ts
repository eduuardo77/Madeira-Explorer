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
import { MAP_CLUTTER_STYLE_JSON } from './mapClutter.ts';
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
 * ⚠ **The light map is no longer unstyled, changed 2026-08-17.** It used to be
 * handed `undefined` so Google's cartography arrived exactly as drawn. Looked at
 * on a device, that included Google's POI layer — six saturated pins on one
 * screen of Funchal, one of which was a place the user had *collected*, drawn
 * identically to five they had not. `mapClutter.ts` has the full argument. The
 * rules are **visibility only and change no colour**, so Google's cartography is
 * still Google's; it is only their pins that go.
 *
 * ⚠ The dark path on the *latest* renderer is deliberately still untouched —
 * layering a style over `colorScheme: DARK` cannot be verified on an emulator
 * that only ever loads LEGACY (T-147), and guessing there risks the silent
 * white-map failure that whole trap is about. T-154.
 *
 * Returns a boolean rather than the SDK's enum so that this decision stays
 * testable without Expo. The caller does the one-line mapping.
 */
export function darkMapPropsFor(
  style: MapStyleName,
  nativeDarkMapWorks: NativeDarkMapCheck
): DarkMapProps {
  if (style !== 'dark') {
    return { dark: false, mapStyleJson: MAP_CLUTTER_STYLE_JSON };
  }

  return {
    dark: true,
    // ⚠ The authored style is the *fallback*, and only that. Where Google's own
    // dark map works it keeps its cartography — better than this project will
    // ever maintain, and it changes when theirs does.
    //
    // ⚠⚠ **BUT IT NO LONGER GETS `undefined`, changed 2026-08-17.** It used to,
    // and that is exactly where light and dark came apart: the light map hid
    // Google's POI pins while the native dark map still drew them, so the same
    // trip looked like two different products depending on a setting. The project
    // lead's instruction was unambiguous — *"just make sure light and dark mode
    // are the same, that's really important"* — so this path now carries the same
    // visibility-only rules the light map does.
    //
    // ⚠ **This is the one path nobody here can verify** (T-154). Play services
    // hands this project's emulator the LEGACY renderer, so the combination
    // "native dark map + a style JSON" cannot be reached without a device. The
    // rules change no colour, so in principle `colorScheme: DARK` still decides
    // the palette — but if the native dark map ever comes back *light* on a real
    // phone, this line is the first suspect and `HIDE_GOOGLE_POIS` turns it off.
    mapStyleJson: nativeDarkMapWorks()
      ? MAP_CLUTTER_STYLE_JSON
      : GOOGLE_NIGHT_STYLE_JSON,
  };
}

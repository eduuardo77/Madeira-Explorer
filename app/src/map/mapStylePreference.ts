/**
 * Which map style the user has chosen (T-140, D-026).
 *
 * A two-value preference does not obviously need its own module — it gets one
 * because the value is stored in a **text column** (`app_state`), and the
 * failure mode of reading it inline everywhere is that one caller trusts the
 * string and renders a style that does not exist. So parsing happens once,
 * anything unrecognised falls back, and the fallback is `light`.
 *
 * **Light is the default deliberately.** The everyday map is read outdoors in
 * Madeiran sunlight and the light style is the one tuned for that (D-026); the
 * dark style exists for the souvenir, where the fog-of-war metaphor matters
 * more than legibility at midday. The souvenir renders dark **regardless of
 * this setting** — that is not the user's choice to make.
 *
 * The pure half is here and tested; `appStateDao` does the storage.
 */

import type { MapStyleName } from './mapStyle';

export const DEFAULT_MAP_STYLE: MapStyleName = 'light';

/**
 * Parse a stored preference.
 *
 * Null, empty, or anything unrecognised gives the default rather than throwing:
 * this is read on the path that draws the map, and a hand-edited debug value
 * must cost the user their preference, never the screen (D-010).
 */
export function parseMapStyle(raw: string | null): MapStyleName {
  const value = (raw ?? '').trim().toLowerCase();
  return value === 'dark' || value === 'light' ? value : DEFAULT_MAP_STYLE;
}

/**
 * Is the user allowed to choose the map's style at all? (2026-08-28)
 *
 * **No, for now** — the project lead asked for one theme, always light, and the
 * control hidden until the app has earned a second one. Light is already the
 * documented default above and the one tuned for Madeiran sunlight (D-026), so
 * hiding the choice changes nothing about what a new user sees.
 *
 * ⚠ **A flag rather than a deletion, and the difference matters.** The dark
 * style is not dead code: the souvenir renders dark *regardless of this
 * setting*, so `googleNightStyle` and `darkMode` are still on a live path. What
 * is switched off is only the **user-facing choice**. Flipping this back to
 * `true` restores the settings section and every stored preference with it.
 *
 * ⚠ **The stored value is deliberately left alone.** A user who picked dark
 * before today keeps that row in `app_state`; `effectiveMapStyle` overrides it
 * while this is off rather than rewriting it. Erasing the preference to enforce
 * a default would make the decision irreversible for exactly the people who had
 * expressed one.
 */
export const MAP_STYLE_CHOICE_ENABLED = false;

/**
 * The style to actually draw, given what the user once chose.
 *
 * Every screen that draws the everyday map goes through this rather than
 * through `parseMapStyle` alone — otherwise hiding the control would leave a
 * user stuck in a dark map with no way back, which is worse than either theme.
 */
export function effectiveMapStyle(stored: MapStyleName): MapStyleName {
  return MAP_STYLE_CHOICE_ENABLED ? stored : DEFAULT_MAP_STYLE;
}

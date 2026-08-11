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

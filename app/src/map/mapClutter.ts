/**
 * Taking Google's own points of interest off the light map (T-112, D-032).
 *
 * WHY, AND IT WAS MEASURED BY LOOKING
 * -----------------------------------
 * The light map shipped with **no style at all** — deliberately, so Google's
 * cartography arrived exactly as Google drew it (`darkMode.ts`). Looked at on a
 * device on 2026-08-17, that turned out to include Google's whole POI layer, and
 * on one screen of Funchal it drew **six** saturated pins: Jardim Botânico,
 * Jardim de Santa Luzia, Museu da Quinta das Cruzes, Plaza Madeira, Museu CR7
 * and Forte de São Tiago.
 *
 * Two things were wrong with that, and the second is the serious one:
 *
 *   1. `traceStyle.ts` promises the trace is *"the one saturated, heavy thing on
 *      the map"* (D-032). It was not. Six high-contrast pins with white glyphs
 *      out-shouted the line the entire product is about.
 *   2. ⚠ **Forte de São Tiago was among them — and that is a place the user had
 *      collected.** Google drew it identically to five places they had not. The
 *      app's own achievement was indistinguishable from the basemap's clutter,
 *      on the screen whose job is to show what you have done.
 *
 * ⚠ **THE NIGHT STYLE ALREADY DID THIS** (`googleNightStyle.ts` turns `poi` off
 * and calls it a decision). So this is the light map catching up with a choice
 * the dark map made months earlier — not a new opinion.
 *
 * WHAT IS DELIBERATELY KEPT
 * -------------------------
 * **Only visibility rules, and no colours.** Google's light cartography is the
 * reason D-057 chose the platform's map, and recolouring it here would take on
 * the maintenance obligation that decision exists to avoid. Nothing below
 * changes a single hue.
 *
 * **Park and natural geometry stays.** The green shapes are orientation on an
 * island of terraces and laurel forest — it is the *labels* that were noise, not
 * the parks. Same for road geometry and road name labels: this app is used to
 * find out where you have been, and a map with no road names cannot answer that.
 *
 * ⚠ WHAT THIS DOES NOT COVER, AND WHY IT IS NOT PRETENDED OTHERWISE
 * -----------------------------------------------------------------
 * The **native dark map on the latest renderer** (`darkMode.ts`: Google's own,
 * `mapStyleJson === undefined`) still draws Google's POIs. Layering these rules
 * on top of `colorScheme: DARK` ought to work and **cannot be verified here** —
 * Play services hands this project's emulator the LEGACY renderer (T-147), so
 * the one combination that needs checking is the one combination unreachable
 * without a device. Applying an unverified style to that path risks the exact
 * silent failure T-147 documents: a user asks for dark and quietly gets light.
 * So it is left alone, and left written down. See `TASKS.md` T-154.
 *
 * Pure data, like every other style in this folder. Tested in `mapClutter.test.ts`.
 */

/** One Google Maps style rule. Same shape as `googleNightStyle.ts` uses. */
export type ClutterStyleRule = {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string | number>[];
};

/**
 * The rules, in the order Google applies them — later rules win, so the
 * narrowing exception for parks has to follow the blanket `poi` rule.
 */
export const MAP_CLUTTER_RULES: readonly ClutterStyleRule[] = [
  // Every point of interest Google knows about: no pin, no glyph, no name.
  // `labels` covers the text and the icon together, which is what the pin is.
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  // ⚠ Business POIs go entirely, geometry included. A restaurant's footprint is
  // a coloured blob with no label on it once the rule above lands, which reads
  // as a rendering fault rather than as a restaurant.
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },

  // Parks and natural features keep their shape — the green is orientation —
  // and lose only their names. This rule follows the blanket one on purpose:
  // it puts the geometry back that `poi` would otherwise have taken.
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.attraction', elementType: 'geometry', stylers: [{ visibility: 'on' }] },

  // Bus stops and station pins, which on a city map are dense and which this
  // app has no use for at all — it is not a transit app and never navigates
  // (D-018).
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // ⚠ Road *names* stay; the little shields and icons on them go. Knowing you
  // drove the ER101 is exactly the kind of thing this map is for, so the text
  // is not touched — only the pictograms competing with the trace.
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

/**
 * The same rules as the string the Maps SDK wants.
 *
 * Built once at module load: it never varies, and `JSON.stringify` on every
 * render of the map screen would be work done repeatedly to get the same
 * answer.
 */
export const MAP_CLUTTER_STYLE_JSON: string = JSON.stringify(MAP_CLUTTER_RULES);

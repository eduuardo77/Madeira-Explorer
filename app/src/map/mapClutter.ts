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
 * ⚠ EVERY PATH GETS THE SAME RULES, ON THE PROJECT LEAD'S INSTRUCTION
 * -------------------------------------------------------------------
 * *"Just make sure light and dark mode are the same, that's really important."*
 * (2026-08-17.) It had **not** been true: this module started as a light-map fix
 * while the native dark map on the latest renderer kept drawing Google's POIs, so
 * one setting changed which product you were looking at. All three style paths now
 * compose these rules — light, the authored night style, and Google's own dark —
 * and `darkMode.test.ts` fails the build if what they hide ever diverges again,
 * with a single named exception for a road casing that only matters on a dark
 * ground.
 *
 * ⚠ **The native-dark path is still the one nobody here can verify** (T-154). Play
 * services hands this project's emulator the LEGACY renderer, so "Google's dark map
 * *plus* a style JSON" is unreachable without a device. These rules change no
 * colour, so `colorScheme: DARK` should still decide the palette — but if a real
 * phone ever shows a *light* map after the user chose dark, this is the first
 * suspect and `HIDE_GOOGLE_POIS` turns it off in one line.
 *
 * Pure data, like every other style in this folder. Tested in `darkMode.test.ts`.
 */

/** One Google Maps style rule. Same shape as `googleNightStyle.ts` uses. */
export type ClutterStyleRule = {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string | number>[];
};

/**
 * ⚠⚠ **THE ONE SWITCH. Flip this line to put Google's POI pins back.**
 *
 * The project lead has not settled this (2026-08-17): *"Hiding google POI's might
 * not be definitive. I'm still considering it. I feel hiding it lowers the google
 * OEM feel."* That is a real cost and the same argument that won D-057 and the
 * native dark map — the value of the platform's map is partly that it looks like
 * the platform's map, and a stripped one looks like ours.
 *
 * So it is **one boolean**, not a decision spread across three style paths. And
 * because the same rules feed every path (see `POI_RULES` below), flipping it
 * cannot leave the light map and the dark map disagreeing — which was the state
 * this replaced, and which is the thing the project lead asked to be certain of:
 * *"Just make sure light and dark mode are the same, that's really important."*
 */
export const HIDE_GOOGLE_POIS = true;

/**
 * Hiding Google's points of interest — the part that is **under the switch**.
 *
 * Empty when the switch is off, so every style path shows Google's POIs together
 * or hides them together. `mapClutter.test.ts` asserts exactly that.
 */
export const POI_RULES: readonly ClutterStyleRule[] = HIDE_GOOGLE_POIS
  ? [
      // Every point of interest Google knows about: no pin, no glyph, no name.
      // `labels` covers the text and the icon together, which is what the pin is.
      { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },

      // ⚠ Business POIs go entirely, geometry included. A restaurant's footprint
      // is a coloured blob with no label on it once the rule above lands, which
      // reads as a rendering fault rather than as a restaurant.
      { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },

      // Parks and natural features keep their shape — the green is orientation —
      // and lose only their names. These follow the blanket rule on purpose: they
      // put back the geometry `poi` would otherwise have taken.
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }] },
      { featureType: 'poi.attraction', elementType: 'geometry', stylers: [{ visibility: 'on' }] },
    ]
  : [];

/**
 * Hidden in both styles regardless of the switch, because these are **not**
 * about the OEM feel.
 *
 * ⚠ Deliberately outside `HIDE_GOOGLE_POIS`. Turning Google's POIs back on
 * should not also bring back the yellow ER/VR road shields: on the night map
 * those measured as the brightest thing on screen after the trace, which
 * `googleNightStyle.ts` found by looking at it. That is a palette finding, not a
 * preference, and it must survive the switch being flipped either way.
 */
export const ALWAYS_HIDDEN_RULES: readonly ClutterStyleRule[] = [
  // Bus stops and station pins, dense on a city map, and useless to an app that
  // never navigates (D-018).
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // ⚠ Road *names* stay; the shields and pictograms on them go. Knowing you drove
  // the ER101 is exactly what this map is for, so the text is untouched.
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  // ⚠ Administrative boundaries. **Moved here from `googleNightStyle.ts`**, where
  // it had been the dark map's private opinion: they mean nothing to a visitor and
  // they cross the island in straight lines that read as routes. That is a
  // judgement about content, so it belongs to both styles — and it is one of the
  // two things the parity test caught when it was first written.
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
];

/**
 * Everything this module hides, in the order Google applies it — later rules
 * win, so the narrowing exceptions for parks follow the blanket `poi` rule.
 */
export const MAP_CLUTTER_RULES: readonly ClutterStyleRule[] = [
  ...POI_RULES,
  ...ALWAYS_HIDDEN_RULES,
];

/**
 * The same rules as the string the Maps SDK wants.
 *
 * Built once at module load: it never varies, and `JSON.stringify` on every
 * render of the map screen would be work done repeatedly to get the same
 * answer.
 */
export const MAP_CLUTTER_STYLE_JSON: string = JSON.stringify(MAP_CLUTTER_RULES);

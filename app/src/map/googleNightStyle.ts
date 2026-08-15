/**
 * The dark map, authored rather than requested (T-146).
 *
 * ⚠ WHY THIS EXISTS WHEN `colorScheme` ALREADY DOES
 * -------------------------------------------------
 * `expo-maps` exposes `colorScheme: DARK`, the Maps SDK's own night mode, and
 * the app passes it. On the emulator it does nothing, and logcat says why:
 *
 *     MapsInitializer: loadedRenderer: LEGACY
 *
 * `mapColorScheme` is a **latest-renderer** feature. Where Google Play services
 * falls back to the legacy renderer — old devices, old Play services, and this
 * emulator — the property is silently ignored and the user gets a bright white
 * map after asking for a dark one. Silently is the operative word: nothing
 * throws, so this would have shipped as "dark mode is broken on some phones"
 * and been very hard to attribute.
 *
 * `mapStyleOptions` is the *classic* styling API and works on both renderers.
 * Passing both means the newest phones get Google's native night handling and
 * everyone else still gets a dark map.
 *
 * ⚠ AUTHORED FOR THIS APP, NOT COPIED FROM A SAMPLE
 * -------------------------------------------------
 * The palette is this project's (`ui/theme.ts`) so the map does not sit on the
 * screen looking like a different application's map, and it is built around one
 * requirement that a generic night style does not share: **the trace has to be
 * the brightest thing on screen.** D-026 says the dark map exists for the
 * fog-of-war reading, and `traceStyle.ts` puts a glowing core on it — a night
 * style with bright roads would drown that. So the roads here are barely above
 * the land, and the labels are dim.
 *
 * Water stays distinctly bluer than the land. On an island, the coastline *is*
 * the orientation, and a night map where sea and hillside are the same charcoal
 * is unreadable in exactly the place this app is used.
 *
 * The style is data, so it is data here — one array, checked by a test — rather
 * than a JSON blob pasted into a component where nobody would ever read it.
 */

type StyleRule = {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string | number>[];
};

/**
 * Land, and the base everything else is drawn over.
 *
 * ⚠ **Not `theme.background`, and that was the first version's mistake.** The
 * app's chrome palette is near-black (`#0E0E10`) because chrome sits *on* a
 * map; a map has to hold roads, water, parks and labels apart from each other
 * *inside itself*, and there is no room below near-black to do that. The
 * result was a map the project lead described as too dark and not like Google's
 * dark mode, which is exactly what it was: land and roads within 1.35:1 of each
 * other, so the road network read as texture rather than as roads.
 *
 * A dark blue-grey instead, in the same family Google's night mode uses, with
 * the road network stepped clearly above it. Exported because the chrome
 * floating on top has to stay legible against it, and that is a measured claim
 * rather than a matter of taste — see the tests.
 */
export const NIGHT_LAND = '#243040';
const LAND = NIGHT_LAND;
/**
 * Sea. Darker than the land *and* bluer than it.
 *
 * Both, deliberately: hue alone separates them for most people and luminance
 * alone survives being looked at in sunlight through polarised glasses. On an
 * island the coastline is the orientation, so this is the one boundary on the
 * map that has to work twice over.
 */
const WATER = '#16263B';
/**
 * Roads. Legibly above the land — 1.48:1, and 1.99:1 for the major ones —
 * because a night map whose roads you cannot follow is a dark rectangle with
 * labels on it.
 *
 * ⚠ There is still a ceiling: nothing here may outshine the trace (D-026), and
 * a test measures that against the trace's own colour rather than a guess.
 */
const ROAD = '#3C4A5C';
const ROAD_MAJOR = '#4E5D70';
/** Label ink and its halo. The halo is what makes small text survive. */
const LABEL = '#9AA7B5';
const LABEL_HALO = '#0B1420';
/** Terrain and parks — hue-separated from the land rather than brightness. */
const TERRAIN = '#23342F';

const NIGHT_STYLE: StyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: LAND }] },
  { elementType: 'labels.text.fill', stylers: [{ color: LABEL }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: LABEL_HALO }] },

  // ⚠ Google's own points of interest are turned off, and that is a decision
  // rather than tidiness: D-052 deleted our place markers so the map would
  // belong to the trace, and leaving forty restaurant pins on top of it would
  // undo that with somebody else's data.
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: TERRAIN }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: TERRAIN }] },

  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: TERRAIN }] },

  { featureType: 'road', elementType: 'geometry', stylers: [{ color: ROAD }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: ROAD_MAJOR }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: LABEL }] },
  // ⚠ Every road label icon, not just the motorway's. Scoping this to
  // `road.highway` left the yellow ER/VR shields on screen, and on a night map
  // they were the brightest thing after the trace — measured by looking at it.
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  { featureType: 'water', elementType: 'geometry', stylers: [{ color: WATER }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5D7A96' }] },

  // Administrative boundaries: off. They are the one thing on a Madeira map
  // that means nothing to a visitor, and they cross the island in straight
  // lines that read as routes.
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
];

/**
 * The style as the Maps SDK wants it.
 *
 * Serialised once at module load: it never changes, and re-stringifying it on
 * every render would hand the native view a new string each time and reapply
 * the style mid-pan.
 */
export const GOOGLE_NIGHT_STYLE_JSON = JSON.stringify(NIGHT_STYLE);

/** Exported for the test, which is the only other thing allowed to read it. */
export const NIGHT_STYLE_RULES: readonly StyleRule[] = NIGHT_STYLE;

/**
 * The Directions handoff, as a list of URLs (T-115, D-018).
 *
 * D-018 is one of the shortest decisions in the log and one of the most
 * load-bearing: **never build navigation.** Turn-by-turn is an enormous
 * surface, needs live routing data — which would break the offline
 * architecture (D-001) — and is a battery catastrophe. The incumbent apps are
 * already on the phone and are already better at it. Handing off costs one
 * button, and this module is that button's entire logic.
 *
 * WHY A LIST AND NOT A URL
 * ------------------------
 * The first choice on each platform is the one that opens *directions*. The
 * second opens the place. They are not the same promise, and the fallback is
 * there because the first can fail for a reason we cannot detect in advance:
 * a phone with no Google Maps installed, which on Madeira is a real
 * configuration — a European tourist with an OsmAnd or Organic Maps habit,
 * exactly the person who downloads offline maps before a holiday.
 *
 * A pin in whichever maps app the user actually has beats a dead button. The
 * caller tries them in order (`openDirections.ts`).
 *
 * WHY OFFLINE-CAPABLE SCHEMES, NOT A `https://…/maps/dir` LINK
 * ------------------------------------------------------------
 * The https form is the one Google documents, and it is the wrong choice here.
 * If the maps app is not installed it opens a **browser**, which needs a
 * network — and the user of this app is a tourist in a levada valley with no
 * signal, which is the entire premise of shipping the tiles in the binary
 * (D-036). `google.navigation:` and `geo:` are handled by an installed app or
 * by nothing at all, and "nothing at all" is a case we can detect and report.
 *
 * ⚠ **Do not add a `canOpenURL` check on the back of this.** On Android 11+ it
 * answers about *package visibility*, not about whether an app exists, and
 * returns false for these schemes unless the manifest declares a matching
 * `<queries>` entry. It would report every phone as having no maps app. The
 * wrapper tries `openURL` and catches instead — see `openDirections.ts`.
 *
 * Pure: no React Native, no `Platform`, no `Linking`. The platform is an
 * argument, which is what makes both branches testable on a laptop.
 */

import { isUsableCoordinate } from '../recording/distance.ts';

export type DirectionsTarget = {
  /** Shown as the destination's label where the scheme carries one. */
  name: string;
  lat: number;
  lon: number;
};

/** The two platforms this app ships on. Not `Platform.OS`, deliberately. */
export type DirectionsPlatform = 'android' | 'ios';

/**
 * Six decimals is ~0.1 m, far finer than any geofence in the pack, and
 * `toFixed` is locale-independent — a comma decimal separator would silently
 * corrupt the URL on a phone set to Portuguese.
 */
function coordinate(value: number): string {
  return value.toFixed(6);
}

/**
 * The destination label.
 *
 * ⚠ `encodeURIComponent` deliberately leaves `( ) ! ' * ~` alone — they are
 * legal in a URI component — and the `geo:` scheme uses parentheses as the
 * label's own delimiters. A place named `Miradouro (novo)` would therefore
 * close the label early and leave `novo)` loose in the URI. Escaping them
 * explicitly is the difference between a label and a parse error on a phone
 * this project cannot test on.
 */
function label(name: string): string {
  return encodeURIComponent(name).replace(/\(/g, '%28').replace(/\)/g, '%29');
}

/**
 * Candidate URLs, best first. Empty when the target cannot be pointed at,
 * which the caller must treat as "no Directions button" rather than as an
 * error to show.
 */
export function buildDirectionsLinks(
  target: DirectionsTarget,
  platform: DirectionsPlatform
): string[] {
  if (!isUsableCoordinate(target)) {
    return [];
  }

  const lat = coordinate(target.lat);
  const lon = coordinate(target.lon);
  const name = label(target.name);

  if (platform === 'ios') {
    return [
      // Apple Maps, directions from the current location. No `dirflg`: the
      // travel mode is the other app's business and its last choice is a
      // better guess than ours (D-018 — we are not a navigation app).
      `maps://?daddr=${lat},${lon}&q=${name}`,
      // The universal form. iOS routes it to Maps without a network round
      // trip; it only reaches a browser on a platform that has no Maps at all.
      `http://maps.apple.com/?daddr=${lat},${lon}&q=${name}`,
    ];
  }

  return [
    // Google Maps, straight into directions. Works against downloaded offline
    // maps, which is the case that matters here.
    `google.navigation:q=${lat},${lon}`,
    // Any maps app on the phone, offline: the place with a label, one tap
    // short of directions. This is the fallback that keeps the button alive
    // on a phone without Google Maps.
    `geo:${lat},${lon}?q=${lat},${lon}(${name})`,
  ];
}

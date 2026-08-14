/**
 * What the card says about a place (T-115, D-055).
 *
 * It turns a place, the user's last known position, and the clock into the
 * strings the card renders.
 *
 * ⚠ D-018 specified this card as *name, photo, distance, and a single
 * Directions button*. The button was built and then deleted by the project
 * lead on 2026-08-13 — *"we arent a navigator"* — and there is no photo (see
 * below). What is left is a name, a category, a distance the app can vouch
 * for, and a way onto the map.
 *
 * ⚠ **There is no photo, and it is not an oversight.** The content pack has no
 * photo field (`contentPack.ts`), so there is nothing to show and nothing to
 * validate; adding one is a curation and bundle-size question (T-066, and the
 * 19.1 MB budget in D-035/D-036), not a rendering one. The card is built so a
 * photo can be dropped in above the name without moving anything else.
 *
 * THE TWO HONESTY RULES
 * ---------------------
 * **1. A distance we cannot vouch for is not shown.** The position comes from
 * the recorder's own last fix — free, already stored, and never a fresh GPS
 * request just because a card opened. That fix can be old (the app was shut,
 * the user is on While-Using and not recording) or too imprecise to measure
 * from. In either case the card shows the place without a distance, which is
 * the same reflex as the `null` battery figure in D-041: no number beats a
 * number the app has not earned.
 *
 * **2. The distance is a straight line, and the card says so.** On this island
 * that is not pedantry. A miradouro 2 km away across a ravine is a 25-minute
 * drive, and a user who reads "2 km" as walking distance and sets off is
 * exactly the failure this app must not invite — the more so now that there is
 * no Directions button to hand the problem to somebody better at it. The
 * wording lives here, next to the arithmetic, so it cannot be dropped by a
 * later tidy-up of the view.
 *
 * Pure: no database, no Expo, no clock of its own — `nowMs` is an argument.
 * Tested in `placeCard.test.ts`.
 */

import type { Category } from '../content/contentPack.ts';
import { hasCourse } from '../map/levadaHighlight.ts';
import { distanceM, isUsableCoordinate } from '../recording/distance.ts';
import { MAX_DRAWN_ACCURACY_M } from '../map/traceGeoJson.ts';

/**
 * How old the last fix may be before the card stops claiming to know where the
 * user is.
 *
 * ⚠ NOT TUNED. The same 30 minutes as the recorder's own gap rule
 * (`recorderHealth.GAP_THRESHOLD_MS`), and deliberately the same number: where
 * the recorder admits silence, the card should stop asserting a distance. The
 * stationary profile can legitimately defer for 15 minutes, so anything
 * shorter would blank the distance during normal operation.
 */
export const MAX_POSITION_AGE_MS = 30 * 60 * 1000;

/** The recorder's last fix, as much of it as this module needs. */
export type LastKnownPosition = {
  ts: number;
  lat: number;
  lon: number;
  accuracy_m: number | null;
};

export type PlaceCardInput = {
  placeId: string;
  name: string;
  category: Category;
  collected: boolean;
  /** The representative geofence's coordinate — see `placeMarkers.ts`. */
  lat: number;
  lon: number;
  /** Null when no trip is recording, or nothing has been recorded yet. */
  position: LastKnownPosition | null;
  nowMs: number;
};

export type PlaceCard = {
  placeId: string;
  name: string;
  /** The category as a word, not a slug. */
  categoryLabel: string;
  collected: boolean;
  /**
   * True when *Show on map* will draw a course rather than only a marker —
   * a levada (D-055). The accessible label says which, because "show on map"
   * means two different things.
   */
  hasCourse: boolean;
  lat: number;
  lon: number;
  /** Metres, straight line. Null when rule 1 above withholds it. */
  distanceM: number | null;
  /** `"3.2 km"`. Null exactly when `distanceM` is. */
  distanceLabel: string | null;
};

/**
 * The word the card shows. Not the slug: `levada` is a category id, "Levada
 * walk" is what it is.
 */
const CATEGORY_LABELS: Record<Category, string> = {
  viewpoint: 'Viewpoint',
  levada: 'Levada walk',
  village: 'Village',
  beach: 'Beach',
  landmark: 'Landmark',
};

/**
 * The sentence the distance appears in. Rule 2 above — kept as a constant so
 * the qualification travels with the number wherever it is rendered.
 */
export const STRAIGHT_LINE_NOTE = 'in a straight line';

/**
 * Metres as something a person reads at arm's length.
 *
 * Precision is deliberately thrown away as the number grows: nobody standing
 * on a hillside needs `1,243 m`, and a false precision invites the reading
 * that this is a measured walking distance. Below a kilometre it rounds to the
 * nearest 10 m, and never below 10 — `0 m` would read as an error.
 */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) {
    throw new Error(`not a distance: ${metres}`);
  }

  if (metres < 1000) {
    return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  }

  const km = metres / 1000;
  // One decimal up to 10 km, whole kilometres beyond — an island 57 km across
  // never needs `23.4 km`.
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/**
 * True when the last fix is recent enough and precise enough to measure from.
 *
 * The accuracy cut is the drawing's (`MAX_DRAWN_ACCURACY_M`) on purpose: a fix
 * too wild to draw as part of the trace is too wild to base a distance on, and
 * two different answers to "do we believe this fix" is one more than this
 * project should have.
 */
export function isPositionUsable(
  position: LastKnownPosition,
  nowMs: number,
  maxAgeMs: number = MAX_POSITION_AGE_MS
): boolean {
  if (!isUsableCoordinate(position)) {
    return false;
  }
  if (position.accuracy_m !== null && position.accuracy_m > MAX_DRAWN_ACCURACY_M) {
    return false;
  }
  // A fix from the future is a clock that moved, not a position: refuse it
  // rather than reporting a negative age as fresh.
  const age = nowMs - position.ts;
  return age >= 0 && age <= maxAgeMs;
}

export function buildPlaceCard(input: PlaceCardInput): PlaceCard {
  const {
    placeId,
    name,
    category,
    collected,
    lat,
    lon,
    position,
    nowMs,
  } = input;

  const measurable =
    position !== null &&
    isUsableCoordinate({ lat, lon }) &&
    isPositionUsable(position, nowMs);

  const metres = measurable
    ? distanceM({ lat: position.lat, lon: position.lon }, { lat, lon })
    : null;

  return {
    placeId,
    name,
    categoryLabel: CATEGORY_LABELS[category],
    collected,
    hasCourse: hasCourse(category),
    lat,
    lon,
    distanceM: metres,
    distanceLabel: metres === null ? null : formatDistance(metres),
  };
}

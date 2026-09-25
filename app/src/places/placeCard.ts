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
 * **3. Only when it is near enough to mean something** (2026-09-25). The
 * project lead, on the P30: *"A 39 km em linha reta" is a bit useless, Madeira
 * is full of turns.* A straight line across the island says nothing about the
 * hour of hairpins between, and the honest qualifier of rule 2 did not make it
 * useful, only true. Within walking range it is both. Beyond it the card says
 * nothing, which is what rule 1 already does when it cannot vouch for a number.
 *
 * Pure: no database, no Expo, no clock of its own — `nowMs` is an argument.
 * Tested in `placeCard.test.ts`.
 */

import type { Category, PlaceWhy } from '../content/contentPack.ts';
import { hasCourse } from '../map/levadaHighlight.ts';
import { distanceM, isUsableCoordinate } from '../recording/distance.ts';
import { MAX_DRAWN_ACCURACY_M } from '../map/traceGeoJson.ts';
import type { Language } from '../i18n/languages.ts';
import { STRINGS } from '../i18n/strings.ts';
import { translate } from '../i18n/translate.ts';

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

/**
 * Rule 3: the farthest a straight-line distance is shown. ⚠ Not measured: about
 * half an hour on foot on the flat, which is where "how far is it" still means
 * "shall I walk over", and a ravine can still make it a lie, which is why rule
 * 2's qualifier stays.
 */
export const MAX_SHOWN_DISTANCE_M = 2000;

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
  /**
   * The region's display name, or null when the pack does not name it (T-067).
   * Resolved by the caller from `regionCatalogue`, because this module stays
   * pure and a region id is not a word (D-017 keeps both in `content/`).
   */
  regionName: string | null;
  /** The representative geofence's coordinate — see `placeMarkers.ts`. */
  lat: number;
  lon: number;
  /** Null when no trip is recording, or nothing has been recorded yet. */
  position: LastKnownPosition | null;
  nowMs: number;
  /** Passed in, because this module is pure and may not import `i18n/index.ts`. */
  language: Language;
  /** The pack's "why go" lines (T-201), if it has any. */
  why?: PlaceWhy;
  /**
   * The day the stamp was earned, already written in the card's language
   * ("20 de setembro"), or null when it is not known. Formatted by the caller,
   * which owns the clock and the locale.
   */
  visitedOn?: string | null;
};

export type PlaceCard = {
  placeId: string;
  name: string;
  /** The category as a word, not a slug. */
  categoryLabel: string;
  /**
   * The municipality, as a word — `"Machico"` (T-067, D-027).
   *
   * Null when the pack cannot name it, and the card then simply says one thing
   * less. A slug would read as a bug to the user and as a placeholder to a
   * store reviewer.
   */
  regionLabel: string | null;
  collected: boolean;
  /**
   * True when *Show on map* will draw a course rather than only a marker —
   * a levada (D-055). The accessible label says which, because "show on map"
   * means two different things.
   */
  hasCourse: boolean;
  lat: number;
  lon: number;
  /** Metres, straight line. Null when rule 1 or rule 3 above withholds it. */
  distanceM: number | null;
  /** `"3.2 km"`, `"3,2 km"` in Portuguese. Null exactly when `distanceM` is. */
  distanceLabel: string | null;
  /** The line above the name: the category, and whether it is collected. */
  metaLabel: string;
  /**
   * The distance *with* its qualification, as one translated sentence (rule
   * 2). Null exactly when `distanceM` is. Render this, never `distanceLabel`
   * alone.
   */
  distanceSentence: string | null;
  /**
   * Why go, in the card's language (T-201, review P1-4). Null when the pack has
   * no line for this place in this language — never another language's line.
   */
  whyLine: string | null;
  /**
   * Where the user stands with this place, under the name on the passport's
   * card (2026-09-25, the project lead's option B): *Ainda por visitar*, or
   * *Visitou a 20 de setembro*. A collected stamp is never told it is not
   * collected, locked or not (D-075).
   */
  statusLine: string;
};

/**
 * The word the card shows. Not the slug: `levada` is a category id, "Levada
 * walk" is what it is.
 *
 * ⚠ T-190: these were English constants here until 2026-09-23, and a
 * Portuguese phone showed *VIEWPOINT* and *"13 km away, in a straight line"*
 * (review P1-4). `i18nCoverage.test.ts` could not see them, because it only
 * read `.tsx` files; it now reads this one too.
 */
const CATEGORY_KEYS = {
  viewpoint: 'placeCard.category.viewpoint',
  levada: 'placeCard.category.levada',
  village: 'placeCard.category.village',
  beach: 'placeCard.category.beach',
  landmark: 'placeCard.category.landmark',
} as const satisfies Record<Category, keyof typeof STRINGS>;

/**
 * Metres as something a person reads at arm's length.
 *
 * Precision is deliberately thrown away as the number grows: nobody standing
 * on a hillside needs `1,243 m`, and a false precision invites the reading
 * that this is a measured walking distance. Below a kilometre it rounds to the
 * nearest 10 m, and never below 10 — `0 m` would read as an error.
 */
export function formatDistance(metres: number, language: Language): string {
  if (!Number.isFinite(metres) || metres < 0) {
    throw new Error(`not a distance: ${metres}`);
  }

  if (metres < 1000) {
    return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  }

  const km = metres / 1000;
  // One decimal up to 10 km, whole kilometres beyond — an island 57 km across
  // never needs `23.4 km`.
  // ⚠ Portuguese and German write the decimal with a comma. By hand rather
  // than `toLocaleString`, because Hermes's Intl is not complete (HANDOFF).
  const decimal = language === 'en' ? '.' : ',';
  return km < 10
    ? `${km.toFixed(1).replace('.', decimal)} km`
    : `${Math.round(km)} km`;
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
    regionName,
    lat,
    lon,
    position,
    nowMs,
    language,
    why,
    visitedOn,
  } = input;

  const measurable =
    position !== null &&
    isUsableCoordinate({ lat, lon }) &&
    isPositionUsable(position, nowMs);

  const straightLine = measurable
    ? distanceM({ lat: position.lat, lon: position.lon }, { lat, lon })
    : null;
  const metres =
    straightLine !== null && straightLine <= MAX_SHOWN_DISTANCE_M ? straightLine : null;

  const categoryLabel = translate(STRINGS[CATEGORY_KEYS[category]], language);
  const distanceLabel = metres === null ? null : formatDistance(metres, language);

  return {
    placeId,
    name,
    categoryLabel,
    metaLabel: collected
      ? translate(STRINGS['placeCard.collected'], language, { category: categoryLabel })
      : categoryLabel,
    // Trimmed, and whitespace becomes null: a card with an empty line where
    // the municipality should be is worse than one that never claimed to know.
    regionLabel: regionName?.trim() || null,
    collected,
    hasCourse: hasCourse(category),
    lat,
    lon,
    distanceM: metres,
    distanceLabel,
    distanceSentence:
      distanceLabel === null
        ? null
        : translate(STRINGS['placeCard.distance'], language, { distance: distanceLabel }),
    whyLine: why?.[language]?.trim() || null,
    statusLine: !collected
      ? translate(STRINGS['placeCard.status.notYet'], language)
      : visitedOn
        ? translate(STRINGS['placeCard.status.visitedOn'], language, { date: visitedOn })
        : translate(STRINGS['placeCard.status.visited'], language),
  };
}

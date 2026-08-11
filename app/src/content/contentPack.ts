/**
 * The content pack: reading it, and refusing to believe it (T-040).
 *
 * WHAT THIS IS FOR
 * ----------------
 * `content/pois.json` is the curated list of places (T-066) — the one part of
 * this project that cannot be bought, copied or generated, and the only place
 * Madeira knowledge is allowed to live (D-017, CONTEXT §6.1 calls the rule
 * absolute). This module turns that file into typed values the app can use, and
 * is the boundary where hand-edited JSON stops being trusted.
 *
 * WHY IT VALIDATES AT RUNTIME WHEN THE FILE IS COMPILED IN
 * -------------------------------------------------------
 * TypeScript will happily infer a type for an imported JSON file, and that type
 * is a lie: it describes what the file contained on the machine that ran `tsc`,
 * not what it contains after somebody hand-edits 200 rows at midnight. A
 * mistyped category or a duplicated id must degrade to "that one place is
 * missing", never to a recorder that crashes on launch — the recorder is the
 * irreplaceable part (D-010) and the content pack is not.
 *
 * So: structural nonsense throws (the caller cannot proceed and must not treat
 * it as "there are no places"), while individual bad rows are dropped and
 * counted. `tools/validate-content.mjs` is the other half of this — it applies
 * the same rules, plus the ones only a human curating the list would care
 * about, and it runs on a laptop before anything is built.
 *
 * Pure: no Expo, no SQLite, no clock, no import of the JSON itself. That is
 * what makes it unit-testable (`contentPack.test.ts`).
 */

import { isUsableCoordinate } from '../recording/distance.ts';
import type { GeofencePlace } from '../recording/geofenceSelection.ts';
import { isMechanismRegionId } from '../recording/geofenceSelection.ts';

/**
 * The five categories, and there is deliberately no "Other" (D-027). A place
 * that fits nowhere is a signal about the place, not a missing row.
 */
export const CATEGORIES = [
  'viewpoint',
  'levada',
  'village',
  'beach',
  'landmark',
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Which end of a place a geofence represents.
 *
 * Almost everything is a `main` — you arrive, you get the stamp. Levadas are
 * the exception and the reason this field exists: a levada stamp means "you
 * walked the whole thing", which is a trailhead crossing and an exit crossing
 * (D-009). Encoding that in the content pack rather than in code keeps the
 * award rules (T-071) retunable without re-curating anything.
 */
export const GEOFENCE_ROLES = ['main', 'start', 'end'] as const;

export type GeofenceRole = (typeof GEOFENCE_ROLES)[number];

export type PlaceGeofence = {
  /**
   * Globally unique across the whole pack, because this is the string that
   * lands in `geofence_event.poi_id` and is all the OS hands back to us.
   */
  id: string;
  role: GeofenceRole;
  lat: number;
  lon: number;
  radiusM: number;
};

export type Place = {
  id: string;
  /** Display name. The only field here a user ever reads. */
  name: string;
  category: Category;
  /** Drives per-region progress on the map screen, not the passport (D-027). */
  regionId: string;
  /** One for most places; a start and an end for a levada. */
  geofences: PlaceGeofence[];
};

/**
 * A place whose geofence ends the trip, not a place that earns a stamp
 * (D-012): the airports and the Funchal cruise terminal.
 *
 * Kept apart from `places` on purpose. They are monitored like anything else
 * — the geofence manager needs them in its window — but they must never be
 * judged by the stamp rules. "Congratulations, you collected Madeira Airport"
 * is not a reward.
 */
export type DeparturePoint = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusM: number;
};

export type ContentPack = {
  formatVersion: number;
  /**
   * What to call the place this pack covers, as the user would say it —
   * "Madeira". Null when the pack does not name itself.
   *
   * ⚠ **This field is why D-017 can stay absolute.** The reveal notification
   * wants to say "Your Madeira map is ready", which is warmer than "Your map
   * is ready" and is the copy on the moment D-012 calls the best in the
   * product. Hardcoding it in `app/` would have meant shipping for anywhere
   * else required editing code rather than swapping a `content/` directory —
   * so the name lives here instead, and the app reads it (T-116a).
   *
   * D-042 reserved exactly this for the souvenir's title card and declined to
   * add a literal for it; the same field now serves both.
   */
  destination: string | null;
  places: Place[];
  /** Optional: a pack with none simply never ends a trip by airport. */
  departurePoints: DeparturePoint[];
};

/** A row that was dropped, and why. Surfaced in the diary and the validator. */
export type ContentProblem = {
  where: string;
  problem: string;
};

export type ParsedContentPack = {
  pack: ContentPack;
  /** Rows dropped during parsing. Empty is the only acceptable state at release. */
  problems: ContentProblem[];
};

export const SUPPORTED_FORMAT_VERSION = 1;

/**
 * Radius bounds. Outside these a row is dropped rather than trusted.
 *
 * The floor exists because both platforms treat very small regions as
 * approximate, so a 10 m geofence is a stamp that never fires. The ceiling
 * exists because a 5 km "place" would award a stamp to somebody driving past on
 * the VR1, and a collection where that happens is worthless (CONTEXT §4.4).
 * Generosity within these bounds is encouraged — D-032 is explicit that missing
 * a levada is the worse failure.
 */
export const MIN_GEOFENCE_RADIUS_M = 40;
export const MAX_GEOFENCE_RADIUS_M = 2000;

class ContentPackError extends Error {}

/**
 * Parse and validate a content pack.
 *
 * Throws only when the file is structurally unusable. Individual bad places are
 * dropped and reported in `problems`.
 */
export function parseContentPack(raw: unknown): ParsedContentPack {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ContentPackError('content pack is not a JSON object');
  }

  const root = raw as Record<string, unknown>;

  if (root.formatVersion !== SUPPORTED_FORMAT_VERSION) {
    throw new ContentPackError(
      `content pack formatVersion is ${String(root.formatVersion)}, expected ${SUPPORTED_FORMAT_VERSION}`
    );
  }

  if (!Array.isArray(root.places)) {
    throw new ContentPackError('content pack has no `places` array');
  }

  const problems: ContentProblem[] = [];
  const places: Place[] = [];
  const seenPlaceIds = new Set<string>();
  const seenGeofenceIds = new Set<string>();

  for (let index = 0; index < root.places.length; index += 1) {
    const place = parsePlace(
      root.places[index],
      index,
      seenPlaceIds,
      seenGeofenceIds,
      problems
    );
    if (place !== null) {
      places.push(place);
    }
  }

  const departurePoints: DeparturePoint[] = [];
  if (root.departurePoints !== undefined) {
    if (!Array.isArray(root.departurePoints)) {
      throw new ContentPackError('`departurePoints` is not an array');
    }
    for (let index = 0; index < root.departurePoints.length; index += 1) {
      const point = parseDeparturePoint(
        root.departurePoints[index],
        `departurePoints[${index}]`,
        seenGeofenceIds,
        problems
      );
      if (point !== null) {
        departurePoints.push(point);
        seenGeofenceIds.add(point.id);
      }
    }
  }

  return {
    pack: {
      formatVersion: SUPPORTED_FORMAT_VERSION,
      destination: parseDestination(root.destination, problems),
      places,
      departurePoints,
    },
    problems,
  };
}

/**
 * The pack's own name for the place it covers.
 *
 * Absent is fine and is not a problem worth reporting — a pack that does not
 * name itself simply gets the generic copy. A *present but wrong* value is
 * reported, because it means somebody tried and the app is about to silently
 * ignore them.
 */
function parseDestination(
  raw: unknown,
  problems: ContentProblem[]
): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    problems.push({
      where: 'destination',
      problem: 'must be a non-empty string if present',
    });
    return null;
  }
  return raw.trim();
}

/**
 * Departure points share the geofence id namespace with places — the OS hands
 * back one string and the app has to know which kind of thing it was.
 */
function parseDeparturePoint(
  raw: unknown,
  where: string,
  seenGeofenceIds: Set<string>,
  problems: ContentProblem[]
): DeparturePoint | null {
  const geofence = parseGeofence(raw, where, problems);
  if (geofence === null) {
    return null;
  }
  if (seenGeofenceIds.has(geofence.id)) {
    problems.push({ where, problem: `duplicate geofence id ${geofence.id}` });
    return null;
  }

  const row = raw as Record<string, unknown>;
  const name = row.name;
  if (typeof name !== 'string' || name.length === 0) {
    problems.push({ where, problem: 'missing or empty `name`' });
    return null;
  }

  return {
    id: geofence.id,
    name,
    lat: geofence.lat,
    lon: geofence.lon,
    radiusM: geofence.radiusM,
  };
}

/**
 * Parse one place, and register its ids on success.
 *
 * Registration happens here rather than in the caller's loop because the rule
 * being enforced — "an accepted place owns its ids from now on" — belongs to
 * the function that decides whether to accept it. Splitting the two would leave
 * duplicate detection depending on the caller remembering to do its half.
 */
function parsePlace(
  raw: unknown,
  index: number,
  seenPlaceIds: Set<string>,
  seenGeofenceIds: Set<string>,
  problems: ContentProblem[]
): Place | null {
  const where = `places[${index}]`;

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    problems.push({ where, problem: 'not an object' });
    return null;
  }

  const row = raw as Record<string, unknown>;
  const id = row.id;

  if (typeof id !== 'string' || id.length === 0) {
    problems.push({ where, problem: 'missing or empty `id`' });
    return null;
  }
  // `__` is reserved for regions that are mechanism rather than content —
  // currently just the geofence manager's anchor (D-033).
  if (isMechanismRegionId(id)) {
    problems.push({ where: `${where} (${id})`, problem: 'id starts with the reserved `__`' });
    return null;
  }
  if (seenPlaceIds.has(id)) {
    problems.push({ where: `${where} (${id})`, problem: 'duplicate place id' });
    return null;
  }

  const named = `${where} (${id})`;

  const name = row.name;
  if (typeof name !== 'string' || name.length === 0) {
    problems.push({ where: named, problem: 'missing or empty `name`' });
    return null;
  }

  const category = row.category;
  if (!isCategory(category)) {
    problems.push({
      where: named,
      problem: `category ${JSON.stringify(category)} is not one of ${CATEGORIES.join(', ')}`,
    });
    return null;
  }

  const regionId = row.regionId;
  if (typeof regionId !== 'string' || regionId.length === 0) {
    problems.push({ where: named, problem: 'missing or empty `regionId`' });
    return null;
  }

  if (!Array.isArray(row.geofences) || row.geofences.length === 0) {
    problems.push({ where: named, problem: 'has no geofences' });
    return null;
  }

  // A place is all-or-nothing: half a levada would credit a walk the user did
  // not finish, which is exactly the generosity boundary in CONTEXT §4.4.
  //
  // Ids are collected into a local set first, so that a place colliding with
  // *itself* is caught by the same check as a place colliding with an earlier
  // one — and so that a rejected place leaves nothing registered behind it.
  const geofences: PlaceGeofence[] = [];
  const claimedIds = new Set<string>();
  for (let i = 0; i < row.geofences.length; i += 1) {
    const geofence = parseGeofence(row.geofences[i], `${named}.geofences[${i}]`, problems);
    if (geofence === null) {
      return null;
    }
    if (seenGeofenceIds.has(geofence.id) || claimedIds.has(geofence.id)) {
      problems.push({
        where: `${named}.geofences[${i}]`,
        problem: `duplicate geofence id ${geofence.id}`,
      });
      return null;
    }
    claimedIds.add(geofence.id);
    geofences.push(geofence);
  }

  seenPlaceIds.add(id);
  for (const geofenceId of claimedIds) {
    seenGeofenceIds.add(geofenceId);
  }

  return { id, name, category, regionId, geofences };
}

function parseGeofence(
  raw: unknown,
  where: string,
  problems: ContentProblem[]
): PlaceGeofence | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    problems.push({ where, problem: 'not an object' });
    return null;
  }

  const row = raw as Record<string, unknown>;

  const id = row.id;
  if (typeof id !== 'string' || id.length === 0) {
    problems.push({ where, problem: 'missing or empty `id`' });
    return null;
  }
  if (isMechanismRegionId(id)) {
    problems.push({ where, problem: 'id starts with the reserved `__`' });
    return null;
  }

  // `role` is optional and almost always absent; only levadas need it.
  const role = row.role === undefined ? 'main' : row.role;
  if (!isRole(role)) {
    problems.push({
      where,
      problem: `role ${JSON.stringify(role)} is not one of ${GEOFENCE_ROLES.join(', ')}`,
    });
    return null;
  }

  // The `typeof` narrowing is this module's job — the input is `unknown`. What
  // counts as a usable coordinate afterwards is `distance.ts`'s job, and it must
  // be the same answer the geofence selector will give, or a row could pass here
  // and be silently dropped there.
  const lat = row.lat;
  const lon = row.lon;
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    !isUsableCoordinate({ lat, lon })
  ) {
    problems.push({ where, problem: 'lat/lon missing or not a usable coordinate' });
    return null;
  }

  const radiusM = row.radiusM;
  if (
    typeof radiusM !== 'number' ||
    !Number.isFinite(radiusM) ||
    radiusM < MIN_GEOFENCE_RADIUS_M ||
    radiusM > MAX_GEOFENCE_RADIUS_M
  ) {
    problems.push({
      where,
      problem: `radiusM must be a number between ${MIN_GEOFENCE_RADIUS_M} and ${MAX_GEOFENCE_RADIUS_M}`,
    });
    return null;
  }

  return { id, role, lat, lon, radiusM };
}

function isCategory(value: unknown): value is Category {
  return (
    typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
  );
}

function isRole(value: unknown): value is GeofenceRole {
  return (
    typeof value === 'string' &&
    (GEOFENCE_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Flatten a pack into what the geofence manager monitors (T-039).
 *
 * One entry per *geofence*, not per place: a levada contributes two, and both
 * have to be monitored independently because the user reaches them hours apart.
 * Which place a crossing belongs to is looked up later, by the stamp rules.
 */
export function toGeofencePlaces(pack: ContentPack): GeofencePlace[] {
  const places: GeofencePlace[] = [];
  for (const place of pack.places) {
    for (const geofence of place.geofences) {
      places.push({
        poiId: geofence.id,
        lat: geofence.lat,
        lon: geofence.lon,
        radiusM: geofence.radiusM,
      });
    }
  }
  // Departure points are monitored alongside the places. They earn nothing —
  // the stamp rules only ever iterate `pack.places` — but the trip cannot end
  // at an airport the OS was never watching (D-012).
  for (const point of pack.departurePoints) {
    places.push({
      poiId: point.id,
      lat: point.lat,
      lon: point.lon,
      radiusM: point.radiusM,
    });
  }
  return places;
}

/** Places per category, for the passport's five rows and for the validator. */
export function countByCategory(pack: ContentPack): Record<Category, number> {
  const counts: Record<Category, number> = {
    viewpoint: 0,
    levada: 0,
    village: 0,
    beach: 0,
    landmark: 0,
  };
  for (const place of pack.places) {
    counts[place.category] += 1;
  }
  return counts;
}

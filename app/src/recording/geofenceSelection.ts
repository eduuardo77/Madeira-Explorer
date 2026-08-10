/**
 * Which places to monitor right now — the arithmetic half of T-039.
 *
 * THE PROBLEM
 * -----------
 * iOS monitors at most 20 regions simultaneously (Android ~100). The content
 * pack will hold 150–250 places (T-066). So the monitored set has to be a
 * moving window over the catalogue, swapped as the user travels. CONTEXT §7
 * flags this as painful to retrofit, which is why it is built in Phase 1
 * rather than Phase 3.
 *
 * THE SHAPE OF THE SOLUTION
 * -------------------------
 * Monitor the nearest N places, and spend one of the precious region slots on
 * an **anchor**: a large circle centred on the user, whose only job is to fire
 * an exit event when they have travelled far enough that the nearest N may have
 * changed. Exiting it rebuilds the set. The anchor costs one slot and removes
 * the need for any polling — which is the entire point, because polling is the
 * thing the battery budget cannot afford (CONTEXT §6.3).
 *
 * THE PROPERTY WE ACTUALLY WANT
 * -----------------------------
 * Not "the monitored set is always exactly the nearest N" — that is a means,
 * not an end. What matters is:
 *
 *     while the user is inside the anchor, they cannot have reached any place
 *     we are not monitoring.
 *
 * That holds if the anchor's radius is no larger than the distance from its
 * centre to the *edge* of the nearest unmonitored place. Hence the arithmetic
 * below works in edge distances (centre distance minus that place's own
 * radius), not centre distances. A generous 500 m trailhead radius (D-032:
 * generous radii at trailheads are what stop a walked levada going uncredited)
 * therefore correctly outranks a tight 100 m viewpoint at the same range.
 *
 * This file is pure: no database, no Expo, no clock. That is what makes it
 * testable on a laptop with no phone attached (`geofenceSelection.test.ts`),
 * which matters when the app has no development build yet.
 */

// ⚠ The `.ts` on the next line is deliberate and must stay.
//
// This is JavaScript-ecosystem weirdness, not a concept: Node's own module
// resolver — which is what runs the unit tests, with no bundler involved —
// refuses to guess at a missing file extension. Metro (the bundler the app
// itself is built with) is happy either way, so the explicit extension is the
// one spelling that works in both. Everywhere else in this codebase imports are
// extensionless, because everywhere else is bundler-only.
import { distanceM, isUsableCoordinate, type Coordinate } from './distance.ts';
import type { GeofenceRegion } from './LocationProvider';

/**
 * One candidate from the content pack.
 *
 * Structurally identical to `GeofenceRegion` today, and kept separate anyway:
 * this is *content* (D-017), that is an instruction to the OS. They will drift
 * — a place will grow a category and a dwell rule (T-066, T-071) that the OS
 * has no business knowing about.
 */
export type GeofencePlace = {
  /** Stable id from the content pack. Never a display name (D-017). */
  poiId: string;
  lat: number;
  lon: number;
  radiusM: number;
};

/**
 * The reserved identifier for the anchor region.
 *
 * The double underscores are a namespace, not decoration: geofence events come
 * back from the OS identified only by this string, and an anchor crossing must
 * never be mistaken for arriving at a place and written to `geofence_event`.
 *
 * ⚠ Content-pack ids must never begin with `__` (checked in T-040).
 */
export const ANCHOR_REGION_ID = '__anchor__';

/**
 * Is this region one of ours rather than a place?
 *
 * The rule is the prefix, not the specific id. Written as a predicate because
 * three places need it — the content parser rejecting such ids, and the geofence
 * task refusing to write such a crossing to `geofence_event` — and because the
 * anchor will not be the last one. A significant-location-change tripwire is the
 * obvious second. Checking for `__anchor__` specifically would quietly turn that
 * one into a phantom stamp on somebody's holiday.
 */
export function isMechanismRegionId(id: string): boolean {
  return id.startsWith('__');
}

/**
 * Distance the anchor is shrunk by, below the largest radius that would be
 * provably safe.
 *
 * ⚠ NOT TUNED. Geofence exits are not instantaneous — both platforms apply
 * their own hysteresis and can sit on an event for tens of seconds, and a
 * driver on the VR1 covers ~1.4 km in a minute. This margin is the budget for
 * that lateness. 500 m is a guess; T-076 (drive across the island and watch the
 * set reshuffle) is what should actually set it.
 */
export const ANCHOR_MARGIN_M = 500;

/**
 * Floor on the anchor radius. Small regions are unreliable on both platforms —
 * iOS in particular is documented as treating anything under ~100 m as
 * approximate — and an anchor that fires constantly would defeat its purpose.
 */
export const MIN_ANCHOR_RADIUS_M = 300;

/**
 * Ceiling on the anchor radius. Madeira is roughly 57 km end to end, so beyond
 * this the anchor covers the whole island and would never fire. Capping it
 * keeps the working set honest when the user is somewhere with nothing curated
 * anywhere near them.
 */
export const MAX_ANCHOR_RADIUS_M = 30000;

export type SelectionOptions = {
  /** The OS cap, from `LocationProvider.maxSimultaneousRegions`. */
  maxRegions: number;
  anchorMarginM: number;
  minAnchorRadiusM: number;
  maxAnchorRadiusM: number;
};

export function selectionOptionsFor(maxRegions: number): SelectionOptions {
  return {
    maxRegions,
    anchorMarginM: ANCHOR_MARGIN_M,
    minAnchorRadiusM: MIN_ANCHOR_RADIUS_M,
    maxAnchorRadiusM: MAX_ANCHOR_RADIUS_M,
  };
}

export type Anchor = {
  lat: number;
  lon: number;
  radiusM: number;
};

export type WorkingSet = {
  /** Exactly what to hand the provider: the monitored places, plus the anchor. */
  regions: GeofenceRegion[];
  /** The places being monitored, nearest first. Excludes the anchor. */
  monitored: GeofencePlace[];
  /** How many catalogue entries did not fit. */
  unmonitoredCount: number;
  /** null when the whole catalogue fits, in which case no anchor is needed. */
  anchor: Anchor | null;
  /**
   * False when the anchor had to be clamped to `minAnchorRadiusM` and is
   * therefore larger than the safety property allows — see `selectWorkingSet`.
   * The caller records this rather than treating it as an error.
   */
  anchorCoversUnmonitored: boolean;
  /** Catalogue rows dropped for unusable coordinates. Should be zero. */
  invalidCount: number;
};

/**
 * How far the user is from the *boundary* of a place, in metres.
 *
 * Negative means they are already inside it.
 */
export function edgeDistanceM(from: Coordinate, place: GeofencePlace): number {
  return distanceM(from, place) - place.radiusM;
}

/**
 * Build the set of regions to monitor from `from`.
 *
 * Pure, deterministic, and total: it never throws, and it never returns more
 * regions than the cap. Bad catalogue rows are dropped and counted rather than
 * allowed to take the recorder down — a malformed content pack must not be able
 * to stop the app recording (D-010).
 */
export function selectWorkingSet(
  catalogue: GeofencePlace[],
  from: Coordinate,
  options: SelectionOptions
): WorkingSet {
  if (options.maxRegions < 1 || !isUsableCoordinate(from)) {
    return {
      regions: [],
      monitored: [],
      unmonitoredCount: catalogue.length,
      anchor: null,
      anchorCoversUnmonitored: true,
      invalidCount: 0,
    };
  }

  // Measure each place's edge distance once, here, rather than inside the sort
  // comparator. A comparator that computes it would call `distanceM` twice per
  // comparison — for 250 places that is roughly 4,000 haversines where 250 will
  // do, in a function that runs inside a background callback the OS is timing.
  const ranked: { place: GeofencePlace; edgeM: number }[] = [];
  let invalidCount = 0;
  for (const place of catalogue) {
    if (isUsableCoordinate(place) && Number.isFinite(place.radiusM) && place.radiusM > 0) {
      ranked.push({ place, edgeM: edgeDistanceM(from, place) });
    } else {
      invalidCount += 1;
    }
  }

  if (ranked.length === 0) {
    return {
      regions: [],
      monitored: [],
      unmonitoredCount: 0,
      anchor: null,
      anchorCoversUnmonitored: true,
      invalidCount,
    };
  }

  // Nearest first. The poiId tie-break makes the result independent of
  // catalogue order, which keeps the tests honest and stops the monitored set
  // churning for no reason when two places are equidistant.
  ranked.sort((a, b) => {
    if (a.edgeM !== b.edgeM) {
      return a.edgeM - b.edgeM;
    }
    return a.place.poiId < b.place.poiId
      ? -1
      : a.place.poiId > b.place.poiId
        ? 1
        : 0;
  });

  // Everything fits: no anchor, because there is nothing it could usefully
  // trigger a rebuild for.
  if (ranked.length <= options.maxRegions) {
    const all = ranked.map((entry) => entry.place);
    return {
      regions: all.map(toRegion),
      monitored: all,
      unmonitoredCount: 0,
      anchor: null,
      anchorCoversUnmonitored: true,
      invalidCount,
    };
  }

  // One slot goes to the anchor.
  const monitored = ranked
    .slice(0, options.maxRegions - 1)
    .map((entry) => entry.place);
  const unmonitored = ranked.slice(options.maxRegions - 1);

  // The nearest place we are NOT watching sets the safe radius. `unmonitored`
  // is already sorted, so its first entry is the binding one.
  const safeRadiusM = unmonitored[0].edgeM - options.anchorMarginM;

  const radiusM = Math.min(
    options.maxAnchorRadiusM,
    Math.max(options.minAnchorRadiusM, safeRadiusM)
  );

  // The clamp can only be unsafe at the bottom: the user is standing in a
  // cluster denser than the region cap — Funchal, most likely — so there is an
  // uncredited place within `minAnchorRadiusM`. It is genuinely unreachable
  // without passing closer to something we ARE watching, so the practical cost
  // is small, but it is recorded rather than hidden (ARCHITECTURE §10).
  const anchorCoversUnmonitored = safeRadiusM >= radiusM;

  const anchor: Anchor = { lat: from.lat, lon: from.lon, radiusM };

  return {
    regions: [...monitored.map(toRegion), toAnchorRegion(anchor)],
    monitored,
    unmonitoredCount: unmonitored.length,
    anchor,
    anchorCoversUnmonitored,
    invalidCount,
  };
}

function toRegion(place: GeofencePlace): GeofenceRegion {
  return {
    poiId: place.poiId,
    lat: place.lat,
    lon: place.lon,
    radiusM: place.radiusM,
    notifyOnEnter: true,
    notifyOnExit: true,
  };
}

/**
 * The anchor is exit-only.
 *
 * We are standing at its centre when it is registered, so an enter event would
 * be either immediate and meaningless or never — and either way it carries no
 * information. Asking the OS not to send it saves a wake-up.
 */
function toAnchorRegion(anchor: Anchor): GeofenceRegion {
  return {
    poiId: ANCHOR_REGION_ID,
    lat: anchor.lat,
    lon: anchor.lon,
    radiusM: anchor.radiusM,
    notifyOnEnter: false,
    notifyOnExit: true,
  };
}

/**
 * Should the set be rebuilt, given a fresh position?
 *
 * The anchor's exit event is the primary trigger. This is the backstop, checked
 * against location batches we are being handed anyway: geofence events do get
 * missed — an OEM kills the process, iOS is slow, the user was in a tunnel — and
 * a missed anchor exit would silently freeze the monitored set for the rest of
 * the trip. That failure is invisible and would look exactly like "the app never
 * gave me a stamp for the north of the island".
 *
 * Rebuilding at a fraction of the radius rather than at the boundary means the
 * common case is repaired before the anchor is even breached.
 */
export const REBUILD_AT_FRACTION_OF_RADIUS = 0.75;

export function shouldRebuild(anchor: Anchor | null, at: Coordinate): boolean {
  if (anchor === null) {
    return false;
  }
  if (!isUsableCoordinate(at)) {
    return false;
  }
  return (
    distanceM(anchor, at) >= anchor.radiusM * REBUILD_AT_FRACTION_OF_RADIUS
  );
}

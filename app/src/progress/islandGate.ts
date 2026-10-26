/**
 * The hidden island's gate (T-067a, D-024, D-107).
 *
 * WHAT IT DECIDES
 * ---------------
 * An island the content pack lists in `hiddenIslands` is kept out of the map,
 * the region list and the passport until the user has been there. Arrival is
 * permanent: once set, the island stays open on every later trip.
 *
 * Since D-107 (answered 26 Oct 2026) the gate keys on **been there alone**. A
 * free user who lands there sees the island too, its stamps padlocked, so the
 * arrival sells the unlock; payment decides only whether those stamps are drawn.
 * The island's stamps are paid only: never one of the free five
 * (`paidOnlyPlaceIds`, read by `freeTier.ts`). Roads light up for everyone
 * (D-089 rule 1), so nothing here touches the trace.
 *
 * ⚠ It gates a display, never an award. Places on a hidden island are still
 * monitored and still awarded, the same rule as `freeTier.ts`.
 *
 * THE ISLAND-LEVEL GEOFENCE
 * -------------------------
 * A recorded fix inside the island's outline, with an accuracy of
 * `ARRIVAL_ACCURACY_M` or better. A polygon test on the recorder's own fixes
 * rather than an OS geofence: a circle around the island is mostly sea, would
 * take a slot from the places' monitored set, and fires only while monitoring
 * is armed. The recorder is already running on any trip there (D-021).
 *
 * Which island, and its shape, come from `content/` (D-017): `hiddenIslands` in
 * `pois.json`, the outlines and `islandId` in `regions.json`.
 *
 * Pure: no database, no clock, no i18n. `islandGateStore.ts` is the impure half.
 */

/** What the gate needs of a region; `Region` from `regionPack.ts` fits. */
export type GateRegion = {
  id: string;
  islandId: string | null;
  islandName: string | null;
  /** `[lon, lat]` around the region's largest polygon, or null. */
  outline: ReadonlyArray<readonly [number, number]> | null;
};

/** A recorded fix, as far as arrival is concerned. */
export type GateFix = {
  lat: number;
  lon: number;
  accuracyM: number | null;
};

/**
 * The worst accuracy a fix may have and still prove arrival. 100 m is far
 * tighter than the sea between the islands, and loose enough for a fix taken
 * under a roof at the airport. A fix with no accuracy proves nothing.
 */
export const ARRIVAL_ACCURACY_M = 100;

/** A bounding box in degrees, for a cheap first test and the stored-fix query. */
export type GateBox = { west: number; south: number; east: number; north: number };

/** The hidden islands the user has not been to yet. */
export function pendingIslands(
  hiddenIslands: readonly string[],
  visited: ReadonlySet<string>
): string[] {
  return hiddenIslands.filter((islandId) => !visited.has(islandId));
}

/**
 * The regions hidden right now: those on a hidden island not yet visited.
 *
 * ⚠ A region whose island is unknown (`islandId` null) is never locked: an
 * unknown island means "not lockable", never "locked" (`regionPack.ts`).
 */
export function lockedRegionIds(
  regions: readonly GateRegion[],
  hiddenIslands: readonly string[],
  visited: ReadonlySet<string>
): Set<string> {
  const pending = new Set(pendingIslands(hiddenIslands, visited));
  return new Set(
    regions
      .filter((region) => region.islandId !== null && pending.has(region.islandId))
      .map((region) => region.id)
  );
}

/** The outlines of every region on an island that has one. */
export function islandOutlines(
  regions: readonly GateRegion[],
  islandId: string
): Array<ReadonlyArray<readonly [number, number]>> {
  return regions.flatMap((region) =>
    region.islandId === islandId && region.outline !== null && region.outline.length >= 3
      ? [region.outline]
      : []
  );
}

/** The box around some outlines, or null when there are none. */
export function outlinesBox(
  outlines: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
): GateBox | null {
  let box: GateBox | null = null;
  for (const ring of outlines) {
    for (const [lon, lat] of ring) {
      box =
        box === null
          ? { west: lon, south: lat, east: lon, north: lat }
          : {
              west: Math.min(box.west, lon),
              south: Math.min(box.south, lat),
              east: Math.max(box.east, lon),
              north: Math.max(box.north, lat),
            };
    }
  }
  return box;
}

/** Even-odd ray casting. A point exactly on an edge may go either way, which is fine here. */
export function insideRing(
  lon: number,
  lat: number,
  ring: ReadonlyArray<readonly [number, number]>
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Whether one fix proves the user is on this island. */
export function fixProvesArrival(
  fix: GateFix,
  outlines: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  box: GateBox | null
): boolean {
  if (fix.accuracyM === null || !(fix.accuracyM <= ARRIVAL_ACCURACY_M)) return false;
  if (box === null) return false;
  if (fix.lat < box.south || fix.lat > box.north || fix.lon < box.west || fix.lon > box.east) {
    return false;
  }
  return outlines.some((ring) => insideRing(fix.lon, fix.lat, ring));
}

/** Which of the pending islands these fixes reach, in `pending` order. */
export function islandsReached(
  fixes: readonly GateFix[],
  regions: readonly GateRegion[],
  pending: readonly string[]
): string[] {
  return pending.filter((islandId) => {
    const outlines = islandOutlines(regions, islandId);
    const box = outlinesBox(outlines);
    return fixes.some((fix) => fixProvesArrival(fix, outlines, box));
  });
}

/**
 * The stored flag: a JSON array of island ids. Anything else reads as "none
 * visited", which hides an island the user may have seen; the opposite mistake
 * would show one they have not, and that one cannot be taken back.
 */
export function parseVisited(raw: string | null): Set<string> {
  if (raw === null) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))
      : new Set();
  } catch {
    return new Set();
  }
}

export function serialiseVisited(visited: ReadonlySet<string>): string {
  return JSON.stringify([...visited].sort());
}

/** Only the places outside locked regions: what the map and the passport may show. */
export function visiblePlaces<T extends { regionId: string }>(
  places: readonly T[],
  locked: ReadonlySet<string>
): T[] {
  return locked.size === 0 ? [...places] : places.filter((place) => !locked.has(place.regionId));
}

/**
 * The places whose stamps are paid only (D-107 point 3): every place on a
 * hidden island, visited or not. They never fill or use up a free slot.
 */
export function paidOnlyPlaceIds(
  places: ReadonlyArray<{ id: string; regionId: string }>,
  regions: readonly GateRegion[],
  hiddenIslands: readonly string[]
): Set<string> {
  const hidden = new Set(hiddenIslands);
  const regionsOnHidden = new Set(
    regions
      .filter((region) => region.islandId !== null && hidden.has(region.islandId))
      .map((region) => region.id)
  );
  return new Set(places.filter((place) => regionsOnHidden.has(place.regionId)).map((place) => place.id));
}

/**
 * The names of the hidden islands the user has been to, for the paywall's line
 * (D-107 point 4: named only after arrival). An island with no name in the
 * file is left out rather than shown as its id.
 */
export function visitedIslandNames(
  regions: readonly GateRegion[],
  hiddenIslands: readonly string[],
  visited: ReadonlySet<string>
): string[] {
  return hiddenIslands
    .filter((islandId) => visited.has(islandId))
    .flatMap((islandId) => {
      const name = regions.find((region) => region.islandId === islandId && region.islandName !== null)?.islandName;
      return name === undefined || name === null ? [] : [name];
    });
}

/**
 * Islands with a passport of their own (D-109).
 *
 * The content pack lists them in `islandPassports`. Their places are kept out
 * of the main passport's count, rows and medals, and shown on a page of their
 * own, reached from a card in the main passport. They have their own free
 * allowance (`freeTier.ts`) and one medal: the medal whose region is on the
 * island. The purchase is one and covers every passport (D-089, D-109).
 *
 * Whether the island is also hidden until the user goes there is a separate
 * switch, `hiddenIslands` (`islandGate.ts`): D-109 chose to show it from day
 * one for now, and going back to hiding it is a content change.
 *
 * Pure: no database, no i18n. `islandGateStore.ts` reads the content for it.
 */

/** What this needs of a region; `Region` from `regionPack.ts` fits. */
export type PassportRegion = { id: string; islandId: string | null };

/** The island each region with a passport of its own belongs to. */
export function islandByRegion(
  regions: readonly PassportRegion[],
  islandPassports: readonly string[]
): Map<string, string> {
  const own = new Set(islandPassports);
  return new Map(
    regions.flatMap((region) =>
      region.islandId !== null && own.has(region.islandId) ? [[region.id, region.islandId] as const] : []
    )
  );
}

/** The island passport each place belongs to; a place on the main island is absent. */
export function islandByPlace(
  places: ReadonlyArray<{ id: string; regionId: string }>,
  byRegion: ReadonlyMap<string, string>
): Map<string, string> {
  return new Map(
    places.flatMap((place) => {
      const island = byRegion.get(place.regionId);
      return island === undefined ? [] : [[place.id, island] as const];
    })
  );
}

/**
 * The places in one passport: `null` is the main island's, an island id is
 * that island's own.
 */
export function placesIn<T extends { regionId: string }>(
  places: readonly T[],
  byRegion: ReadonlyMap<string, string>,
  passport: string | null
): T[] {
  return places.filter((place) => (byRegion.get(place.regionId) ?? null) === passport);
}

/** The same, for anything keyed by place id (stamps, medal tiles' places). */
export function inPassport(
  placeId: string,
  byPlace: ReadonlyMap<string, string>,
  passport: string | null
): boolean {
  return (byPlace.get(placeId) ?? null) === passport;
}

/** The islands' names, from `regions.json` (D-017); an island with none is left out. */
export function islandNames(
  regions: ReadonlyArray<{ islandId: string | null; islandName: string | null }>,
  islandIds: readonly string[]
): string[] {
  return islandIds.flatMap((islandId) => {
    const name = regions.find((region) => region.islandId === islandId && region.islandName !== null)?.islandName;
    return name === undefined || name === null ? [] : [name];
  });
}

/**
 * Medal definitions an island passport shows: only those whose region is on
 * the island (D-109: one medal for the whole island, no category sets there).
 */
export function islandMedalIds(
  medals: ReadonlyArray<{ id: string; rule: { region: string } | { category: string } }>,
  byRegion: ReadonlyMap<string, string>,
  islandId: string
): Set<string> {
  return new Set(
    medals.filter((medal) => 'region' in medal.rule && byRegion.get(medal.rule.region) === islandId).map((m) => m.id)
  );
}

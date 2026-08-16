/**
 * The regions, read out of `content/regions.json` (T-067).
 *
 * WHAT A REGION IS FOR
 * --------------------
 * D-027 gives it one job: the "where should I go next" half of the product.
 * The passport collects by category; the region says where the uncollected
 * places are. Until this file existed, `regionId` was a slug nothing could turn
 * into a word, so the answer to "where is this place" was `estreito-de-camara-
 * de-lobos` or nothing at all.
 *
 * WHAT THIS PARSES, AND WHAT IT DELIBERATELY IGNORES
 * --------------------------------------------------
 * `content/regions.json` is GeoJSON: eleven municipality boundaries, built from
 * OSM by `tools/build-regions.mjs`. **The geometry is not parsed here.** The
 * app has no question that needs a polygon — every place already carries the
 * region id the boundaries put it in, computed on a laptop where a mismatch is
 * visible — so the only thing read out of the file is the label.
 *
 * ⚠ The boundaries still ship, ~108 kB of the 19.1 MB budget (D-035), because
 * splitting them into a second file would give the app a second list of region
 * ids to disagree with. When the Porto Santo gate (T-067a, D-024) needs to ask
 * *which island am I on*, the shape is already here.
 *
 * Same contract as `contentPack.ts`, and for the same reason: structural
 * nonsense is survivable, so a broken file degrades to "no region names",
 * never to a screen that will not open. The recorder is the irreplaceable part
 * (D-010); a label is not.
 *
 * Pure: no Expo, no import of the JSON itself. Tested in `regionPack.test.ts`.
 */

/** One region, as the app uses it: an id and the word for it. */
export type Region = {
  id: string;
  /** Display name — `"Câmara de Lobos"`, not `"camara-de-lobos"`. */
  name: string;
  /**
   * Which island it belongs to, for D-024's lock gate (T-067a). Null when the
   * file does not say, which the app must survive: an unknown island means
   * "not lockable", never "locked".
   */
  islandId: string | null;
};

export type RegionProblem = {
  where: string;
  problem: string;
};

export type ParsedRegionPack = {
  regions: Region[];
  problems: RegionProblem[];
};

/**
 * Parse the region file.
 *
 * ⚠ **Never throws.** `parseContentPack` does, because a broken place list
 * leaves the recorder with nothing to monitor and the caller must not read that
 * as "there are no places". Nothing here is load-bearing in that way — the
 * worst case is a card that names a place and not its municipality — so a file
 * that is missing, empty or malformed produces an empty list and a problem to
 * log.
 */
export function parseRegionPack(raw: unknown): ParsedRegionPack {
  const problems: RegionProblem[] = [];
  const regions: Region[] = [];

  const features = (raw as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) {
    problems.push({
      where: 'regions.json',
      problem: 'no `features` array — run: node tools/build-regions.mjs',
    });
    return { regions, problems };
  }

  const seen = new Set<string>();

  features.forEach((feature, index) => {
    const where = `features[${index}]`;
    const properties = (feature as { properties?: unknown } | null)?.properties;
    if (typeof properties !== 'object' || properties === null) {
      problems.push({ where, problem: 'no `properties`' });
      return;
    }

    const { id, name, islandId } = properties as Record<string, unknown>;

    if (typeof id !== 'string' || id.length === 0) {
      problems.push({ where, problem: 'missing or empty `id`' });
      return;
    }
    if (seen.has(id)) {
      // Two regions with one id would make the name shown depend on parse
      // order, which is the kind of bug that only appears on somebody else's
      // holiday.
      problems.push({ where: `${where} (${id})`, problem: 'duplicate region id' });
      return;
    }
    if (typeof name !== 'string' || name.length === 0) {
      problems.push({ where: `${where} (${id})`, problem: 'missing or empty `name`' });
      return;
    }

    seen.add(id);
    regions.push({
      id,
      name,
      islandId: typeof islandId === 'string' && islandId.length > 0 ? islandId : null,
    });
  });

  return { regions, problems };
}

/** The regions, by id, for the lookups the app actually does. */
export function indexRegions(regions: readonly Region[]): Map<string, Region> {
  return new Map(regions.map((region) => [region.id, region]));
}

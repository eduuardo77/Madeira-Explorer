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
  /**
   * The municipality's shape, `[lon, lat]` around its largest polygon, for its
   * medal (T-235): the main body, not an islet. Null when the file has no
   * usable geometry, which costs the medal its picture and nothing else.
   */
  outline: Array<[number, number]> | null;
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
    const geometry = (feature as { geometry?: unknown } | null)?.geometry;

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
      outline: largestRing(geometry),
    });
  });

  return { regions, problems };
}

/** The outer ring of a Polygon, or of a MultiPolygon's largest part, or null. */
function largestRing(geometry: unknown): Array<[number, number]> | null {
  const { type, coordinates } = (geometry ?? {}) as { type?: unknown; coordinates?: unknown };
  const polygons =
    type === 'Polygon' ? [coordinates] : type === 'MultiPolygon' && Array.isArray(coordinates) ? coordinates : [];
  let best: Array<[number, number]> | null = null;
  let bestArea = 0;
  for (const polygon of polygons) {
    const ring = Array.isArray(polygon) ? polygon[0] : null;
    if (!Array.isArray(ring) || ring.length < 4) continue;
    const points = ring.filter(
      (point): point is [number, number] =>
        Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
    );
    const area = Math.abs(shoelace(points));
    if (area > bestArea) {
      best = points.map(([lon, lat]) => [lon, lat]);
      bestArea = area;
    }
  }
  return best;
}

/** Twice a ring's signed area, in degrees squared: enough to compare sizes. */
function shoelace(points: ReadonlyArray<[number, number]>): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum;
}

/** The regions, by id, for the lookups the app actually does. */
export function indexRegions(regions: readonly Region[]): Map<string, Region> {
  return new Map(regions.map((region) => [region.id, region]));
}

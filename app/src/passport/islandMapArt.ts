/**
 * The island drawn for the unlock sheet's second page (T-319): the main
 * island's municipalities, lit where the user has been, and a dot per place,
 * gold where they have been.
 *
 * Pure: outlines and places come in (from content, D-017), paths and points
 * go out, in a box `width` wide. `ui/IslandMap.tsx` draws them.
 *
 * Framed on the outlines given, each a municipality's largest polygon
 * (`regionPack.ts`), so an islet far off (the Desertas, in Santa Cruz) never
 * shrinks the island into a corner, as it did in the first sketch.
 */

export type IslandMapRegion = { id: string; outline: ReadonlyArray<readonly [number, number]> };
export type IslandMapPlace = { id: string; regionId: string; lat: number; lon: number };

export type IslandMap = {
  width: number;
  height: number;
  regions: Array<{ id: string; d: string; lit: boolean }>;
  dots: Array<{ id: string; x: number; y: number; visited: boolean }>;
};

/** A margin round the island, so a dot on the coast keeps its glow. */
const PAD = 8;

export function islandMap(
  regions: readonly IslandMapRegion[],
  places: readonly IslandMapPlace[],
  visited: ReadonlySet<string>,
  width: number
): IslandMap | null {
  const points = regions.flatMap((region) => region.outline);
  if (points.length === 0 || width <= 2 * PAD) return null;
  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  // Equirectangular, squeezed by the middle latitude: right at island scale.
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;
  if (spanX <= 0 || spanY <= 0) return null;
  const scale = (width - 2 * PAD) / spanX;
  const height = Math.round(spanY * scale + 2 * PAD);
  const x = (lon: number) => PAD + (lon - minLon) * kx * scale;
  const y = (lat: number) => PAD + (maxLat - lat) * scale;
  const round = (value: number) => Math.round(value * 10) / 10;

  const onIsland = new Set(regions.map((region) => region.id));
  const shown = places.filter((place) => onIsland.has(place.regionId));
  const litRegions = new Set(shown.filter((place) => visited.has(place.id)).map((place) => place.regionId));

  return {
    width,
    height,
    regions: regions.map((region) => ({
      id: region.id,
      d: region.outline.map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${round(x(lon))} ${round(y(lat))}`).join('') + 'Z',
      lit: litRegions.has(region.id),
    })),
    dots: shown.map((place) => ({
      id: place.id,
      x: round(x(place.lon)),
      y: round(y(place.lat)),
      visited: visited.has(place.id),
    })),
  };
}

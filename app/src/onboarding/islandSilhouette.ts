/**
 * The destination's main island as one flat shape, for the welcome card
 * (2026-10-08, the lead's ask: "a Madeira silhouette below the stamps").
 *
 * Built from the regions' outlines (`content/regions.json`), never from a shape
 * in `app/` (D-017). The municipalities tile the island, so drawn together in
 * one colour they are its silhouette. The main island is the one with the most
 * regions, so an islet with a municipality of its own (Porto Santo, here) is
 * left out without being named.
 *
 * Pure. Tested in `islandSilhouette.test.ts`.
 */

import type { Region } from '../content/regionPack.ts';

/** Points closer than this, in the drawing's units, are dropped: the shape is small. */
const MIN_STEP = 1.5;

/**
 * One SVG path per municipality, fitted together into `width` by `height`
 * with the island's proportions kept and centred. Empty when no region has an
 * outline, which costs the welcome its picture and nothing else.
 */
export function silhouettePaths(regions: readonly Region[], width: number, height: number): string[] {
  const counts = new Map<string, number>();
  for (const region of regions) {
    if (region.islandId !== null && region.outline !== null) {
      counts.set(region.islandId, (counts.get(region.islandId) ?? 0) + 1);
    }
  }
  const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const rings = regions
    .filter((region) => region.islandId === main && region.outline !== null && region.outline.length >= 3)
    .map((region) => region.outline as Array<[number, number]>);
  if (rings.length === 0) return [];

  // One projection for every ring, so they meet where the municipalities do:
  // longitude scaled by the cosine of the latitude, north up.
  const all = rings.flat();
  const meanLat = all.reduce((sum, [, lat]) => sum + lat, 0) / all.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const xs = all.map(([lon]) => lon * k);
  const ys = all.map(([, lat]) => -lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const scale = Math.min(width / spanX, height / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  return rings.map((ring) => {
    const points = ring.map(([lon, lat]): [number, number] => [
      offsetX + (lon * k - minX) * scale,
      offsetY + (-lat - minY) * scale,
    ]);
    const kept = [points[0]];
    for (const point of points.slice(1)) {
      const last = kept[kept.length - 1];
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) >= MIN_STEP) kept.push(point);
    }
    return `M${kept.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
  });
}

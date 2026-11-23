/**
 * The lit roads on the passport's island (T-325): `[lon, lat]` lines as one
 * SVG path, in the same box `islandMap` (`islandMapArt.ts`) draws for the same
 * regions and width, so the roads land under the right dots.
 *
 * A point closer than `minStep` px to the last one kept is dropped, so a month
 * of driving stays a path the phone draws at once. A line wholly off the
 * island (Porto Santo's on Madeira's page) is left out.
 *
 * ⚠ The framing repeats `islandMap`'s (PAD 8, the middle latitude's squeeze,
 * width-fitted). `islandView.test.ts` checks the two agree.
 */

import type { IslandMapRegion } from './islandMapArt.ts';

const PAD = 8;

export function islandRoads(
  regions: readonly IslandMapRegion[],
  lines: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  width: number,
  minStep = 1
): string {
  const points = regions.flatMap((region) => region.outline);
  if (points.length === 0 || width <= 2 * PAD) return '';
  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLon - minLon) * kx;
  if (spanX <= 0 || maxLat <= minLat) return '';
  const scale = (width - 2 * PAD) / spanX;
  const height = (maxLat - minLat) * scale + 2 * PAD;
  const round = (value: number) => Math.round(value * 10) / 10;

  const parts: string[] = [];
  for (const line of lines) {
    const kept: Array<[number, number]> = [];
    for (const [lon, lat] of line) {
      const px: [number, number] = [PAD + (lon - minLon) * kx * scale, PAD + (maxLat - lat) * scale];
      const last = kept[kept.length - 1];
      if (last === undefined || Math.hypot(px[0] - last[0], px[1] - last[1]) >= minStep) kept.push(px);
    }
    if (kept.length < 2) continue;
    if (!kept.some(([x, y]) => x >= 0 && x <= width && y >= 0 && y <= height)) continue;
    parts.push(kept.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`).join(''));
  }
  return parts.join('');
}

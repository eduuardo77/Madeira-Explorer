/**
 * Cut the map files the video ships down to the zooms it uses (T-329).
 *
 *     node tools/cut-video-tiles.mjs [--map-max 11] [--terrain-max 11] [--source tiles/out] [--out app/assets/map]
 *
 * Reads the full archives from `tiles/out/` (the tile pipeline's output:
 * `tiles/pipeline/build.sh`, `build-terrain.py`) and writes `madeira.pmtiles`
 * and `madeira-terrain.pmtiles` to `--out` with every zoom above the ceilings
 * removed. MapLibre overzooms past a source's
 * last level, so a camera closer than the ceiling still draws, from coarser data.
 *
 * The video's camera never comes closer than about zoom 10.3 (MapLibre's; the
 * close camera, `videoCamera.CLOSE_CAMERA`). MapLibre fetches 512-pixel vector
 * tiles at the camera's whole zoom, so the map's tiles past 10 are never asked
 * for; 11 is kept as a spare. The relief's 256-pixel tiles are fetched one level
 * deeper, so it keeps 11 too: nothing the video draws changes. Checked on the
 * P30 against a video made with the full set (T-329, 25 Nov 2026).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTiles, writeArchive, zoomOf } from './lib/pmtiles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const source = path.resolve(root, arg('source', 'tiles/out'));
const out = path.resolve(root, arg('out', 'app/assets/map'));
const ceilings = { 'madeira.pmtiles': Number(arg('map-max', 11)), 'madeira-terrain.pmtiles': Number(arg('terrain-max', 11)) };

mkdirSync(out, { recursive: true });
for (const [name, maxZoom] of Object.entries(ceilings)) {
  const before = readFileSync(path.join(source, name));
  const { header, tiles, metadata } = readTiles(before);
  const kept = tiles.filter((tile) => zoomOf(tile.tileId) <= maxZoom);
  const after = writeArchive({ header, tiles: kept, metadata, maxZoom });
  // Read it back: every kept tile must come out byte for byte.
  const check = readTiles(after);
  if (check.tiles.length !== kept.length) throw new Error(`${name}: wrote ${kept.length} tiles, read back ${check.tiles.length}`);
  const byId = new Map(check.tiles.map((t) => [t.tileId, t.bytes]));
  for (const t of kept) if (!byId.get(t.tileId)?.equals(t.bytes)) throw new Error(`${name}: tile ${t.tileId} differs after writing`);
  writeFileSync(path.join(out, name), after);
  console.log(`${name}: zooms ${header.minZoom} to ${maxZoom}, ${kept.length} of ${tiles.length} tiles, ${(before.length / 1e6).toFixed(2)} MB to ${(after.length / 1e6).toFixed(2)} MB (read back, identical)`);
}

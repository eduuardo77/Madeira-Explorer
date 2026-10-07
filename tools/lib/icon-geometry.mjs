/**
 * The island and the road the icon draws (T-257), read from the content.
 *
 * Shared by the options page (`preview-icon-options.mjs`) and the asset
 * builder (`build-icon.mjs`), so what the project lead picked is exactly what
 * ships. Lives in `tools/`, never `app/`: no Madeira knowledge in the app
 * (D-017).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The main island lies north of this; the Desertas lie south of it.
 *
 * ⚠ Not "the largest ring of each municipality": Santa Cruz's largest ring is
 * the Desertas, and that rule drew the islets and dropped Santa Cruz's part of
 * the island.
 */
const MAIN_ISLAND_SOUTH = 32.6;

const centroidLat = (ring) => ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;

/** The main island's outline: every municipality's rings, drawn alike so they read as one shape. */
export function mainIslandRings() {
  const regions = JSON.parse(
    readFileSync(path.join(here, '..', '..', 'content', 'regions.json'), 'utf8')
  );
  return regions.features
    .filter((feature) => feature.properties.islandId === 'ilha-da-madeira')
    .flatMap((feature) =>
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates[0]]
        : feature.geometry.coordinates.map((polygon) => polygon[0])
    )
    .filter((ring) => centroidLat(ring) > MAIN_ISLAND_SOUTH);
}

/**
 * The lit road: the south coast, a little inland, west to east, Calheta to
 * Machico. Approximate on purpose; at icon size it is a gesture, not a route.
 */
export const ROUTE = [
  [-17.17, 32.73],
  [-17.06, 32.69],
  [-16.98, 32.67],
  [-16.91, 32.66],
  [-16.84, 32.66],
  [-16.78, 32.72],
];

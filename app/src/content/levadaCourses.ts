/**
 * The course of each curated levada (D-055).
 *
 * The second file in this app that reaches into `content/`, and for the same
 * reason as `poiCatalogue.ts`: Madeira knowledge lives there, never in `app/`
 * (D-017). `tools/build-levadas.mjs` produces it from OSM at build time; this
 * reads it at runtime and nothing here ever touches a network (D-001).
 *
 * ⚠ THE RELATIVE PATH BELOW IS LOAD-BEARING, AND SO IS `metro.config.js`.
 * `content/` sits outside `app/`, and a bundler will not look outside its own
 * project root unless told to.
 *
 * KEYED BY PLACE ID, NEVER BY NAME
 * --------------------------------
 * The build tool matches OSM names once, on a laptop, where a mismatch prints
 * a loud warning. At runtime the link is an id, so renaming a place in
 * `pois.json` cannot silently unlink its geometry — it breaks the build tool's
 * next run instead, which is where it can be seen.
 */

// `.json`, not `.geojson`: Metro and TypeScript both resolve JSON out of the
// box, and a custom extension buys a bundler config and a declaration file for
// nothing. The contents are GeoJSON either way.
import rawCourses from '../../../content/levadas.json';

/** A course, ready to hand to MapLibre. */
export type LevadaCourse = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: { placeId: string };
    geometry: { type: 'MultiLineString'; coordinates: [number, number][][] };
  }[];
};

type RawFeature = {
  properties?: { placeId?: unknown };
  geometry?: { type?: unknown; coordinates?: unknown };
};

/**
 * Parsed once and kept. The file is a compiled-in constant, and this is read
 * on a screen the user is already looking at.
 */
let index: Map<string, LevadaCourse['features'][number]> | null = null;

function load(): Map<string, LevadaCourse['features'][number]> {
  if (index !== null) {
    return index;
  }

  index = new Map();

  const features = (rawCourses as { features?: unknown }).features;
  if (!Array.isArray(features)) {
    // An empty or malformed file means no courses, never a crash: a levada
    // without its course still has a card, a marker and a stamp (D-010's rule
    // applied to content — the irreplaceable thing is the trace, not this).
    return index;
  }

  for (const feature of features as RawFeature[]) {
    const placeId = feature.properties?.placeId;
    const geometry = feature.geometry;
    if (
      typeof placeId !== 'string' ||
      placeId.length === 0 ||
      geometry?.type !== 'MultiLineString' ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length === 0
    ) {
      continue;
    }

    index.set(placeId, {
      type: 'Feature',
      properties: { placeId },
      geometry: {
        type: 'MultiLineString',
        coordinates: geometry.coordinates as [number, number][][],
      },
    });
  }

  return index;
}

/**
 * The course for a place, as a collection MapLibre can draw — or null when
 * that place has none, which is the normal state for everything that is not a
 * levada and for a levada whose name did not match OSM.
 */
export function getLevadaCourse(placeId: string): LevadaCourse | null {
  const feature = load().get(placeId);
  if (feature === undefined) {
    return null;
  }
  return { type: 'FeatureCollection', features: [feature] };
}

/** How many courses shipped. For the debug screen and the validator. */
export function getCourseCount(): number {
  return load().size;
}

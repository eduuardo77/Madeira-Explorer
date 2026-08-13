/**
 * The one place the map is currently pointing at (T-115).
 *
 * ⚠ **THIS USED TO DRAW EVERY PLACE, AND THE PROJECT LEAD DELETED THAT**
 * (2026-08-13, D-052 revised). The first version of T-115 put a dot on all ~80
 * curated places so there was something to tap. The instruction was plain:
 * *"I would like to delete them. I prefer if the user wants to know the levada
 * on the map to click on the badge/stamp and have an option Show on map."*
 *
 * That is a better answer than the one the code had, and the reason is D-032:
 * the trace is the entire visual product of v1, and eighty dots scattered over
 * it are eighty things competing with the one line the app is about. The route
 * in is now the **passport** — you tap a stamp you have earned, and ask for it
 * on the map.
 *
 * So the map draws **at most one marker**: the place you asked to see. It is
 * transient, it is at the centre of the screen because the camera just flew
 * there, and the card naming it is open underneath. Nothing else is marked.
 *
 * ONE MARKER PER PLACE, NOT PER GEOFENCE
 * --------------------------------------
 * `toGeofencePlaces` in `contentPack.ts` flattens the other way — one entry per
 * geofence, because the OS monitors regions and a levada has two of them. Here
 * the unit is the **place**: a levada is one thing you walked, and the marker
 * sits on its `start`, because the trailhead is what a Directions button should
 * point at. Nobody drives to the exit.
 *
 * Pure: no database, no Expo, no React. Tested in `placeMarkers.test.ts`.
 */

import type { Category, Place } from '../content/contentPack.ts';
import { isUsableCoordinate } from '../recording/distance.ts';

/**
 * What the marker carries into the renderer.
 *
 * ⚠ Flat primitives only. These cross into native MapLibre as feature
 * properties — a nested object survives neither the filter expressions nor the
 * JSON round trip.
 */
export type PlaceMarkerProperties = {
  placeId: string;
  name: string;
  category: Category;
  /** Drives the two-layer paint split (`placeStyle.ts`). */
  collected: boolean;
};

export type PlaceMarkerFeature = {
  type: 'Feature';
  id: string;
  properties: PlaceMarkerProperties;
  geometry: {
    type: 'Point';
    /** [lon, lat] — GeoJSON's order, the reverse of ours. */
    coordinates: [number, number];
  };
};

export type PlaceMarkerCollection = {
  type: 'FeatureCollection';
  features: PlaceMarkerFeature[];
};

/** The normal state of the map: nothing marked. */
export const EMPTY_PLACE_MARKERS: PlaceMarkerCollection = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * The geofence that stands for the whole place.
 *
 * `main` if there is one; otherwise the `start`, which is the levada case and
 * the reason this function exists. Falling through to the first geofence is
 * deliberate rather than defensive — a pack that somehow contains only an `end`
 * should still be findable, because a place the UI cannot point at is a place
 * the user cannot reach through the app at all.
 */
export function representativeGeofence(place: Place): Place['geofences'][number] {
  return (
    place.geofences.find((geofence) => geofence.role === 'main') ??
    place.geofences.find((geofence) => geofence.role === 'start') ??
    place.geofences[0]
  );
}

/**
 * The marker layer for one focused place — or an empty one, which is what the
 * map shows the rest of the time.
 */
export function buildFocusMarker(
  place: Place,
  collected: boolean
): PlaceMarkerCollection {
  const geofence = representativeGeofence(place);

  // `parseContentPack` already refuses unusable coordinates, so this can only
  // fire if a pack is built some other way. An empty layer beats a marker in
  // the Gulf of Guinea.
  if (geofence === undefined || !isUsableCoordinate(geofence)) {
    return EMPTY_PLACE_MARKERS;
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: place.id,
        properties: {
          placeId: place.id,
          name: place.name,
          category: place.category,
          collected,
        },
        geometry: {
          type: 'Point',
          coordinates: [geofence.lon, geofence.lat],
        },
      },
    ],
  };
}

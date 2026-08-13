/**
 * The curated places, as something a map can draw and a finger can hit (T-115).
 *
 * WHY THE MAP HAS TO DRAW THESE AT ALL
 * ------------------------------------
 * D-018 says tapping a place shows a card with one Directions button. Nothing
 * can be tapped that is not drawn, and the basemap does not know which ~80
 * places this app cares about — its labels are OSM's idea of what matters, not
 * ours (T-058 strips most of them anyway). So the content pack becomes a
 * point layer of its own, and that layer is both the thing you see and the
 * thing you press.
 *
 * ONE MARKER PER PLACE, NOT PER GEOFENCE
 * --------------------------------------
 * `toGeofencePlaces` in `contentPack.ts` flattens the other way — one entry per
 * geofence, because the OS monitors regions and a levada has two of them. Here
 * the unit is the **place**, because the unit of the card is the place: a
 * levada is one thing you walk, not two dots 6 km apart, and drawing both ends
 * would put a second unexplained marker in the middle of the mountains.
 *
 * Which end represents it matters: for a levada the marker sits on the
 * `start`, because the trailhead is what a Directions button should point at.
 * Nobody drives to the exit.
 *
 * DEPARTURE POINTS ARE NOT DRAWN
 * ------------------------------
 * The airports and the cruise terminal are monitored (D-012) and earn nothing.
 * They are not places to visit, they are how a trip ends, and a marker on
 * Funchal airport would read as one more thing to collect.
 *
 * Pure: no database, no Expo, no React. Tested in `placeMarkers.test.ts`.
 */

import type { Category, ContentPack, Place } from '../content/contentPack.ts';
import { isUsableCoordinate } from '../recording/distance.ts';

/**
 * What a marker carries into the renderer.
 *
 * ⚠ Flat primitives only. These cross into native MapLibre as feature
 * properties and come back through the press event as JSON — a nested object
 * survives neither the filter expressions nor the round trip.
 */
export type PlaceMarkerProperties = {
  placeId: string;
  name: string;
  category: Category;
  /** Drives the two-layer paint split, and the card's own wording. */
  collected: boolean;
};

export type PlaceMarkerFeature = {
  type: 'Feature';
  /** The place id, so the press handler does not have to dig into properties. */
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

export const EMPTY_PLACE_MARKERS: PlaceMarkerCollection = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * The geofence that stands for the whole place.
 *
 * `main` if there is one; otherwise the `start`, which is the levada case and
 * the reason this function exists. Falling through to the first geofence is
 * deliberate rather than defensive — a pack that somehow contains only an
 * `end` should draw *something*, because a missing marker is a place the user
 * can never reach through the UI, and that is worse than a marker at the wrong
 * end of a walk.
 */
export function representativeGeofence(place: Place): Place['geofences'][number] {
  return (
    place.geofences.find((geofence) => geofence.role === 'main') ??
    place.geofences.find((geofence) => geofence.role === 'start') ??
    place.geofences[0]
  );
}

/**
 * Build the marker layer.
 *
 * `awardedPlaceIds` is the set from `stampAwardDao.getAwardedPlaceIds` — place
 * ids, not geofence ids.
 */
export function buildPlaceMarkers(
  pack: ContentPack,
  awardedPlaceIds: ReadonlySet<string>
): PlaceMarkerCollection {
  const features: PlaceMarkerFeature[] = [];

  for (const place of pack.places) {
    const geofence = representativeGeofence(place);
    // `parseContentPack` already refuses unusable coordinates, so this can only
    // fire if a pack is built some other way. Skipping beats drawing a marker
    // at 0,0 in the Gulf of Guinea.
    if (geofence === undefined || !isUsableCoordinate(geofence)) {
      continue;
    }

    features.push({
      type: 'Feature',
      id: place.id,
      properties: {
        placeId: place.id,
        name: place.name,
        category: place.category,
        collected: awardedPlaceIds.has(place.id),
      },
      geometry: {
        type: 'Point',
        coordinates: [geofence.lon, geofence.lat],
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

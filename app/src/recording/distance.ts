/**
 * Distance between two points on the earth.
 *
 * Deliberately the only geometry in Phase 1. v1 does not match anything to a
 * road (D-032), so "how far apart are these two points" is the entire geometric
 * requirement of the geofence backbone.
 */

export type Coordinate = {
  lat: number;
  lon: number;
};

/**
 * Mean earth radius in metres (IUGG). Any of the usual values is fine here —
 * over Madeira the difference between earth models is centimetres, and every
 * threshold this feeds is measured in hundreds of metres.
 */
const EARTH_RADIUS_M = 6371008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in metres (haversine).
 *
 * Haversine rather than a flat-earth approximation because the cost is a
 * handful of trig calls on a list of at most a few hundred places, run only
 * when the monitored set is rebuilt — not per fix, and never in a loop that
 * matters to the battery.
 */
export function distanceM(a: Coordinate, b: Coordinate): number {
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLon = toRadians(b.lon - a.lon);

  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True for a coordinate we can actually measure against. */
export function isUsableCoordinate(value: Coordinate): boolean {
  return (
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lon) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    value.lon >= -180 &&
    value.lon <= 180
  );
}

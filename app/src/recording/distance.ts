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

/**
 * Metres per degree of latitude, near enough.
 *
 * A spherical-earth constant. Used only to *place* points a known distance
 * apart — never to measure them, which is what `distanceM` is for — so the ~0.3%
 * error against the real ellipsoid does not matter anywhere it is used.
 */
const METRES_PER_DEGREE_LAT = 111195;

/**
 * The coordinate `northM` metres north and `eastM` metres east of `origin`.
 *
 * The longitude correction is `cos(latitude)`, because meridians converge: at
 * Madeira's latitude a degree of longitude is about 84% of a degree of
 * latitude, and ignoring that would put every generated point noticeably east
 * of where it was asked for.
 */
export function offsetByMetres(
  origin: Coordinate,
  northM: number,
  eastM: number
): Coordinate {
  const latitudeRadians = (origin.lat * Math.PI) / 180;
  return {
    lat: origin.lat + northM / METRES_PER_DEGREE_LAT,
    lon:
      origin.lon + eastM / (METRES_PER_DEGREE_LAT * Math.cos(latitudeRadians)),
  };
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

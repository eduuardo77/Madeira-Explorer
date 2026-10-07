/**
 * What the map last showed, kept so a cold start can show it at once (T-272).
 *
 * Measured on the P30 (2026-10-07): from the tap, the map's roads took about
 * 16 seconds, most of it the stamp pass, reading the trip's fixes and decoding
 * the road network, all queued on one JavaScript thread. The roads rarely
 * change between two openings, so the last ones are drawn straight away and
 * the work runs behind them, replacing them only with what it finds.
 *
 * Pure, so it is tested on Node; `NativeMapScreen` reads and writes it through
 * `app_state`. Private like the database it is drawn from: never exported.
 */

import type { VisitedLine } from '../matching/visitedRoads';
import type { CameraFit } from './cameraFit';

export type MapSnapshot = {
  /** The trip the roads belong to: another trip's are never shown. */
  tripId: number;
  camera: CameraFit;
  lines: VisitedLine[];
};

/** Six decimals is about 10 cm, finer than any road is drawn; it halves the text. */
const round = (value: number) => Math.round(value * 1e6) / 1e6;

export function encodeMapSnapshot(snapshot: MapSnapshot): string {
  return JSON.stringify({
    tripId: snapshot.tripId,
    camera: snapshot.camera,
    lines: snapshot.lines.map((line) => ({
      points: line.points.map(([lat, lon]) => [round(lat), round(lon)]),
      faded: line.faded,
    })),
  });
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function isCamera(value: unknown): value is CameraFit {
  if (typeof value !== 'object' || value === null) return false;
  const { coordinates, zoom } = value as { coordinates?: unknown; zoom?: unknown };
  if (typeof coordinates !== 'object' || coordinates === null || !isNumber(zoom)) return false;
  const { latitude, longitude } = coordinates as { latitude?: unknown; longitude?: unknown };
  return isNumber(latitude) && isNumber(longitude);
}

function isLine(value: unknown): value is VisitedLine {
  if (typeof value !== 'object' || value === null) return false;
  const { points, faded } = value as { points?: unknown; faded?: unknown };
  return (
    typeof faded === 'boolean' &&
    Array.isArray(points) &&
    points.every(
      (point) => Array.isArray(point) && point.length === 2 && isNumber(point[0]) && isNumber(point[1])
    )
  );
}

/**
 * The snapshot for `tripId`, or null when there is none, it is another
 * trip's, or it does not parse. A bad snapshot costs only the wait it was
 * meant to save, so anything doubtful is dropped rather than drawn.
 */
export function decodeMapSnapshot(raw: string | null, tripId: number): MapSnapshot | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { tripId: storedTrip, camera, lines } = parsed as {
    tripId?: unknown;
    camera?: unknown;
    lines?: unknown;
  };
  if (storedTrip !== tripId || !isCamera(camera) || !Array.isArray(lines) || !lines.every(isLine)) {
    return null;
  }
  return { tripId, camera, lines };
}

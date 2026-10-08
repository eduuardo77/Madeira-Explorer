/**
 * Lit road through a tunnel or on a cable car, drawn as dashes in the road's
 * own colour (2026-10-08, the lead's choice).
 *
 * It was the same line at a third of its strength, so a block of houses with no
 * street drawn would not carry a heavy line through it. On the P30 the VR1's
 * tunnels above Funchal showed what that cost where Google does draw the
 * tunnel: OpenStreetMap's tunnel sits a few metres off Google's, and the wide
 * pale band showed every metre of it, a smear beside the road between solid
 * stretches. A dash keeps the road continuous, says "tunnel" the way maps do,
 * and shows the offset far less.
 *
 * `expo-maps` has no dash pattern for a polyline, so the dashes are short
 * polylines of their own, measured in metres along the line. Pure; tested in
 * `tunnelDashes.test.ts`.
 */

import { distanceM } from '../recording/distance.ts';

export type LatLng = { latitude: number; longitude: number };

/** Long enough to read as a stroke at street zoom; short enough to read as a dash. */
export const DASH_M = 14;
export const GAP_M = 10;

/** The line cut into dashes of `dashM` with gaps of `gapM`, starting with a dash. */
export function dashes(line: readonly LatLng[], dashM = DASH_M, gapM = GAP_M): LatLng[][] {
  const out: LatLng[][] = [];
  let current: LatLng[] | null = [line[0]];
  // Metres left in the dash or gap being drawn.
  let left = dashM;
  for (let i = 1; i < line.length; i += 1) {
    let from = line[i - 1];
    const to = line[i];
    let length = distanceM({ lat: from.latitude, lon: from.longitude }, { lat: to.latitude, lon: to.longitude });
    while (length > left) {
      const t = left / length;
      const cut = {
        latitude: from.latitude + (to.latitude - from.latitude) * t,
        longitude: from.longitude + (to.longitude - from.longitude) * t,
      };
      if (current !== null) {
        current.push(cut);
        out.push(current);
        current = null;
        left = gapM;
      } else {
        current = [cut];
        left = dashM;
      }
      length -= distanceM({ lat: from.latitude, lon: from.longitude }, { lat: cut.latitude, lon: cut.longitude });
      from = cut;
    }
    left -= length;
    if (current !== null) current.push(to);
  }
  if (current !== null && current.length >= 2) out.push(current);
  return out;
}

export type TracePolyline = { id: string; coordinates: LatLng[]; color: string; width: number };

/** One lit run as the map's polylines: whole, or dashed when it is underground or in the air. */
export function runPolylines(
  id: string,
  coordinates: LatLng[],
  faded: boolean,
  color: string,
  width: number
): TracePolyline[] {
  if (!faded || coordinates.length < 2) return [{ id, coordinates, color, width }];
  return dashes(coordinates).map((dash, index) => ({ id: `${id}-${index}`, coordinates: dash, color, width }));
}

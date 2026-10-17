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
 * ⚠ **One dashed polyline per run, drawn by the map** (17 Oct 2026). Until then
 * `expo-maps` had no dash pattern, so each dash was a polyline of its own: on
 * the lead's map, 89 tunnels made about 1,900 of the 2,358 polylines, memory
 * after the pan workload was 501 MB against 274 on 7 Oct, and the map lagged.
 * Our `expo-maps` patch now takes `dashed` and asks Google's map for a dash
 * pattern. Pure; tested in `tunnelDashes.test.ts`.
 */

export type LatLng = { latitude: number; longitude: number };

export type TracePolyline = { id: string; coordinates: LatLng[]; color: string; width: number; dashed?: boolean };

/** One lit run as the map's polyline: whole, or dashed when it is underground or in the air. */
export function runPolylines(
  id: string,
  coordinates: LatLng[],
  faded: boolean,
  color: string,
  width: number
): TracePolyline[] {
  return [faded && coordinates.length >= 2 ? { id, coordinates, color, width, dashed: true } : { id, coordinates, color, width }];
}

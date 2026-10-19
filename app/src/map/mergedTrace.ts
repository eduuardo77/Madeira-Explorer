/**
 * Every lit road as **one** polyline, with invisible jumps between the pieces
 * (T-278).
 *
 * WHY
 * ---
 * Google's map pays for each polyline on every frame it draws, whatever its
 * length. Measured on the P30 (release build, the lead's 636 lines, 4,603
 * points): 160 polylines or fewer kept the map at 60 fps in a pan, 320 gave
 * 53, 450 gave 38, all 636 gave 30. Drawing them thin changed nothing, so the
 * cost is the number of objects, not the pixels. One polyline keeps the count
 * at one however far the user travels.
 *
 * HOW
 * ---
 * The pieces are joined end to end. Where the next piece starts (or ends) at
 * the point the last one stopped, it simply continues, the way a road does at a
 * junction. Otherwise the segment between the two is a **gap**: the native side
 * (`expo-maps` patch, `gaps`) draws it in a transparent style span, so nothing
 * shows between pieces.
 *
 * Joining pieces at a shared point turns a junction into a round joint, as
 * the pieces' round caps drew it before.
 *
 * ⚠ ROUND ENDS: A FREE END KEEPS ITS OWN POLYLINE. Google draws round caps only
 * at a polyline's two ends, so beside a gap a merged piece stops square, with a
 * small notch (seen on the P30, a dead end above Funchal). Doubling back along
 * the end segment to force a round joint changed no pixel, at 2 m or at half
 * the segment: Google drops collinear points when it draws. A square end shows
 * only where the road stops in the open; where it meets another lit road, that
 * road's line covers it. So a piece with a **free end** (an end no other piece
 * touches) is drawn on its own, with its round caps, and only the rest are
 * merged: on the lead's map 87 of 636 pieces, so 88 polylines, inside the 160
 * that still held 60 fps. Pure; tested in `mergedTrace.test.ts`.
 */

export type LatLng = { latitude: number; longitude: number };

export type MergedTrace = {
  coordinates: LatLng[];
  /** Index i means the segment from point i to point i + 1 is not drawn. Ascending. */
  gaps: number[];
};

const same = (a: LatLng, b: LatLng): boolean =>
  a.latitude === b.latitude && a.longitude === b.longitude;

export function mergeTrace(lines: readonly (readonly LatLng[])[]): MergedTrace {
  const coordinates: LatLng[] = [];
  const gaps: number[] = [];
  for (const line of lines) {
    // A single point draws nothing as a line, and would only add a gap.
    if (line.length < 2) continue;
    const last = coordinates[coordinates.length - 1];
    if (last === undefined) {
      coordinates.push(...line);
    } else if (same(line[0], last)) {
      for (let i = 1; i < line.length; i += 1) coordinates.push(line[i]);
    } else if (same(line[line.length - 1], last)) {
      for (let i = line.length - 2; i >= 0; i -= 1) coordinates.push(line[i]);
    } else {
      gaps.push(coordinates.length - 1);
      coordinates.push(...line);
    }
  }
  return { coordinates, gaps };
}

export type SplitTrace = {
  /** Every piece whose ends all touch another piece, as one line. */
  merged: MergedTrace;
  /** Pieces with a free end, each to be drawn on its own with round caps. */
  capped: LatLng[][];
};

const key = (point: LatLng): string => `${point.latitude},${point.longitude}`;

/** Splits the lit roads into the one merged line and the pieces with a free end. */
export function splitTrace(lines: readonly (readonly LatLng[])[]): SplitTrace {
  const drawn = lines.filter((line) => line.length >= 2);
  // How many pieces pass through or end at each point.
  const pieces = new Map<string, number>();
  for (const line of drawn) {
    for (const point of new Set(line.map(key))) pieces.set(point, (pieces.get(point) ?? 0) + 1);
  }
  const free = (point: LatLng) => pieces.get(key(point)) === 1;
  const capped: LatLng[][] = [];
  const rest: (readonly LatLng[])[] = [];
  for (const line of drawn) {
    if (free(line[0]) || free(line[line.length - 1])) capped.push([...line]);
    else rest.push(line);
  }
  return { merged: mergeTrace(rest), capped };
}

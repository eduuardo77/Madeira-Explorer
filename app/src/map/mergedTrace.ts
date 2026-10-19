/**
 * The lit roads in as few polylines as their round ends allow (T-278).
 *
 * WHY
 * ---
 * Google's map pays for each polyline on every frame it draws, whatever its
 * length. Measured on the P30 (release build, the lead's 636 pieces, 4,603
 * points): 160 polylines or fewer kept a pan at 60 fps, 320 gave 53, 450 gave
 * 38, all 636 gave 30. Drawing them thin changed nothing in a pan, so the cost
 * is the number of objects. In a zoom, about 300 polylines held it near 40 fps.
 *
 * HOW
 * ---
 * Pieces are joined end to end into one polyline. Where the next piece starts
 * (or ends) where the last one stopped, it simply continues, the way a road
 * does at a junction. Otherwise the segment between them is a **gap**: the
 * native side (`expo-maps` patch, `gaps`) draws it in a transparent style
 * span, so nothing shows between pieces.
 *
 * ⚠ ROUND ENDS LIMIT THE PACKING. Google draws round caps only at a polyline's
 * two ends; beside a gap a piece stops square, with a small notch (seen on the
 * P30, a dead end above Funchal). Doubling back along the end segment to force
 * a round joint changed no pixel, at 2 m or at half the segment: Google drops
 * collinear points when it draws. A square end shows only where the road stops
 * in the open, since another lit road covers any end that meets it. So each
 * **free end** (one no other piece touches) must be an end of a polyline: a
 * polyline carries two, and the covered pieces ride in between (`packTrace`).
 * On the lead's map, 10 pieces free at both ends and 77 at one: 49 polylines.
 * Pure; tested in `mergedTrace.test.ts`.
 */

export type LatLng = { latitude: number; longitude: number };

export type MergedTrace = {
  coordinates: LatLng[];
  /** Index i means the segment from point i to point i + 1 is not drawn. Ascending. */
  gaps: number[];
};

const same = (a: LatLng, b: LatLng): boolean =>
  a.latitude === b.latitude && a.longitude === b.longitude;

/** The pieces, in order, as one line: continued where they meet, a gap where they do not. */
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

const key = (point: LatLng): string => `${point.latitude},${point.longitude}`;

/**
 * The pieces packed into polylines with every free end at a polyline's end: a
 * piece free at both ends alone; pieces free at one end two to a polyline, the
 * first turned so its free end leads and the second so its free end trails;
 * the covered pieces between the first pair, or on their own if there is none.
 */
export function packTrace(lines: readonly (readonly LatLng[])[]): MergedTrace[] {
  const drawn = lines.filter((line) => line.length >= 2);
  // How many pieces pass through or end at each point.
  const pieces = new Map<string, number>();
  for (const line of drawn) {
    for (const point of new Set(line.map(key))) pieces.set(point, (pieces.get(point) ?? 0) + 1);
  }
  const free = (point: LatLng) => pieces.get(key(point)) === 1;

  const bothFree: (readonly LatLng[])[] = [];
  /** Turned so the free end is the first point. */
  const oneFree: LatLng[][] = [];
  const covered: (readonly LatLng[])[] = [];
  for (const line of drawn) {
    const head = free(line[0]);
    const tail = free(line[line.length - 1]);
    if (head && tail) bothFree.push(line);
    else if (head) oneFree.push([...line]);
    else if (tail) oneFree.push([...line].reverse());
    else covered.push(line);
  }

  const packed = bothFree.map((line) => mergeTrace([line]));
  let middle: readonly (readonly LatLng[])[] = covered;
  for (let i = 0; i < oneFree.length; i += 2) {
    const trailing = oneFree[i + 1] === undefined ? [] : [[...oneFree[i + 1]].reverse()];
    packed.push(mergeTrace([oneFree[i], ...middle, ...trailing]));
    middle = [];
  }
  if (middle.length > 0) packed.push(mergeTrace(middle));
  return packed;
}

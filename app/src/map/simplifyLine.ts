/**
 * A drawn line with the points the eye cannot see taken out (17 Oct 2026).
 *
 * The lead's map had 7,242 points across its lit roads, the road network's own
 * detail, often a point every few metres. Within `DRAW_TOLERANCE_M` a point is
 * dropped (Douglas-Peucker), which at 3 m keeps every bend wider than the line
 * itself at street zoom and took the same map to 4,143 points. Only what is
 * drawn: the matching, the lengths and the stamps never see it.
 *
 * Points are `[lat, lon]`, as `visitedLines` gives them. Pure;
 * `simplifyLine.test.ts`.
 */

export const DRAW_TOLERANCE_M = 3;

export function simplifyLine(
  points: readonly [number, number][],
  toleranceM: number = DRAW_TOLERANCE_M
): [number, number][] {
  const keep = keptIndices(points, toleranceM);
  return points.filter((_, index) => keep[index] === 1);
}

/** The same for anything with a position: the film's timed fixes keep their times. */
export function keepSimplified<T extends { lat: number; lon: number }>(
  items: readonly T[],
  toleranceM: number = DRAW_TOLERANCE_M
): T[] {
  const keep = keptIndices(items.map((item) => [item.lat, item.lon] as [number, number]), toleranceM);
  return items.filter((_, index) => keep[index] === 1);
}

function keptIndices(points: readonly [number, number][], toleranceM: number): Uint8Array {
  if (points.length < 3) return new Uint8Array(points.length).fill(1);
  const kx = 111_320 * Math.cos((points[0][0] * Math.PI) / 180);
  const ky = 110_540;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    const ax = points[a][1] * kx;
    const ay = points[a][0] * ky;
    const dx = points[b][1] * kx - ax;
    const dy = points[b][0] * ky - ay;
    const lengthSquared = dx * dx + dy * dy;
    let farthest = -1;
    let at = -1;
    for (let i = a + 1; i < b; i += 1) {
      const px = points[i][1] * kx - ax;
      const py = points[i][0] * ky - ay;
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));
      const distance = Math.hypot(px - t * dx, py - t * dy);
      if (distance > farthest) {
        farthest = distance;
        at = i;
      }
    }
    if (farthest > toleranceM) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return keep;
}

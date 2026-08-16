/**
 * The geometry the build tools share.
 *
 * WHY IT EXISTS
 * -------------
 * `build-levadas.mjs` and `build-regions.mjs` both simplify OSM geometry, and
 * both had — or were about to have — their own Douglas-Peucker. Two copies of a
 * numerical routine drift silently: the second copy is where the off-by-one
 * lives, because nobody re-reads the one that already works.
 *
 * ⚠ **Degrees, not metres.** Everything here except `metresBetween` works in
 * raw lon/lat degrees, which is wrong for distance and fine for what it is used
 * for — simplification tolerances and inside/outside tests over an island 60 km
 * across. `metresBetween` is the one place the curvature is paid for.
 *
 * Points are `[lon, lat]` pairs, GeoJSON's order, so the output of these
 * functions can be written straight into a file.
 */

/** Perpendicular distance from `p` to the segment `a`–`b`, in degrees. */
export function perpendicular(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  );
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Douglas-Peucker. Iterative, because a levada can be thousands of points. */
export function simplify(points, tolerance) {
  if (points.length < 3) {
    return points;
  }

  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let worst = 0;
    let index = -1;

    for (let i = first + 1; i < last; i += 1) {
      const distance = perpendicular(points[i], points[first], points[last]);
      if (distance > worst) {
        worst = distance;
        index = i;
      }
    }

    if (index !== -1 && worst > tolerance) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

/**
 * Is the point inside this ring? Ray casting, and closed rings only.
 *
 * A point exactly on the boundary can go either way, and no caller here cares:
 * the boundary between two Madeira municipalities runs along a ridge nobody
 * has curated a place on top of.
 */
export function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > y !== yj > y;
    if (straddles && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Is the point inside this polygon? `polygon[0]` is the outer ring and the
 * rest are holes, as GeoJSON has it.
 */
export function pointInPolygon(point, polygon) {
  if (polygon.length === 0 || !pointInRing(point, polygon[0])) {
    return false;
  }
  return polygon.slice(1).every((hole) => !pointInRing(point, hole));
}

/** Distance from the point to the nearest edge of a ring, in degrees. */
export function degreesToRing(point, ring) {
  let best = Infinity;
  for (let i = 1; i < ring.length; i += 1) {
    best = Math.min(best, perpendicular(point, ring[i - 1], ring[i]));
  }
  return best;
}

/**
 * Great-circle-ish distance in metres. Equirectangular, which is accurate to
 * well under a metre over an island and needs no trigonometry per point.
 */
export function metresBetween(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const x = dLon * Math.cos(meanLat);
  return Math.sqrt(dLat * dLat + x * x) * R;
}

/** The id form of a name: ASCII, lowercase, hyphenated. */
export function slug(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

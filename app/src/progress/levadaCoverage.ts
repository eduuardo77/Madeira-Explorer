/**
 * Did you walk this levada? Measured from the trace, not from two crossings.
 * (T-068, D-065, implementing D-009's generosity rule.)
 *
 * WHY THE TWO-ENDPOINT RULE IS NOT ENOUGH
 * ---------------------------------------
 * `stampRules.ts` credits a levada when both endpoint geofences pass a
 * dwell-and-speed gate. That rule is *correct* and it is *brittle*, and every
 * way it breaks costs somebody a stamp they earned on a four-hour walk:
 *
 *   - **The endpoints are guesses.** They are where OpenStreetMap stopped
 *     drawing (`build-levadas.mjs` says so itself), not where a walker parks.
 *     `tools/levada-ends.mjs` improves them and cannot make them right from a
 *     laptop.
 *   - **Most levada walks are out-and-back.** You park at Rabaçal, walk to the
 *     25 Fontes, and return the way you came. You never reach a second
 *     trailhead, because there is no second trailhead in your day.
 *   - **The canopy eats the crossing.** Under laurel forest a fix can be
 *     minutes apart and tens of metres out. The OS geofence may simply never
 *     fire — and T-145 is the reminder that a crossing nobody records did not
 *     happen as far as the app is concerned.
 *   - **People skip bits.** A landslide closure, a shuttle back, a section
 *     walked on the road. The walk still happened.
 *
 * D-009 says it in one line: *be generous filling in gaps between things you
 * are certain about.* The certain thing is not "they touched two points". It is
 * **"they were on this path, at walking pace, for kilometres"** — which the raw
 * trace already knows, because D-010 keeps every fix.
 *
 * WHAT THIS MEASURES
 * ------------------
 * How much of the drawn course has a walking-pace fix beside it. Nothing is
 * inferred and nothing is bridged: a metre of course counts only if somebody
 * was measured next to it.
 *
 * ⚠ **This is not map matching, and D-032 is not being reopened.** Matching
 * asks *which of ten thousand roads is this fix on*. This asks *how close is
 * this fix to one known line* — the line the app already ships to draw the
 * course (D-055). It is a distance calculation against 200 points, not a graph.
 *
 * Pure: no database, no clock, no Expo. Tested in `levadaCoverage.test.ts`.
 */

import { MAX_ARRIVAL_SPEED_MPS } from './stampRules.ts';

/** A point of the drawn course, in GeoJSON order. */
export type CoursePoint = [lon: number, lat: number];

/** One fix, as `rawFixDao.getTraceFixes` returns it. */
export type TraceFix = {
  ts: number;
  lat: number;
  lon: number;
  accuracy_m: number | null;
};

/**
 * How far from the drawn line a fix may be and still count as *on* it.
 *
 * ⚠ NOT TUNED. Three things stack up inside this number: the course is
 * simplified at ~8 m (`build-levadas.mjs`), a levada path and its channel are
 * drawn as one line when they are metres apart, and a GPS fix under laurel
 * canopy is the whole reason this module exists. 60 m is deliberately wider
 * than a path and narrower than the next valley.
 */
export const CORRIDOR_M = 60;

/**
 * Extra corridor granted for a fix that admits its own imprecision.
 *
 * ⚠ **The generosity is proportional to the doubt, not fixed.** A fix that
 * reports ±45 m is *saying* it could be 45 m from where it claims; holding it
 * to a 60 m corridor punishes it for being honest, and under canopy the honest
 * fixes are the only ones there are. So the corridor widens by the reported
 * accuracy, capped — past the cap the fix is too vague to place at all.
 */
export const MAX_ACCURACY_SLACK_M = 60;

/** Beyond this, a fix is not evidence of being anywhere. */
export const MAX_USABLE_ACCURACY_M = 150;

/**
 * Enough of the course to call it walked, as a fraction.
 *
 * ⚠ NOT TUNED. Deliberately not 1.0 and not close to it: the out-and-back case
 * covers half a levada by definition, and a skipped section is normal.
 */
export const WALKED_FRACTION = 0.6;

/**
 * …or this much of it in absolute terms, whichever comes first.
 *
 * ⚠ **This is the rule that handles a levada that is really a network.** Levada
 * do Norte is 40 km of drawn ways; nobody walks it, and a fraction gate would
 * make its stamp unearnable. Three kilometres beside a levada, on foot, is a
 * levada walk by any honest reading.
 */
export const WALKED_ABSOLUTE_M = 3000;

/** Below the thresholds above but far past nothing — worth asking the user about. */
export const CONFIRMABLE_FRACTION = 0.3;
export const CONFIRMABLE_ABSOLUTE_M = 1500;

/**
 * The fastest average pace that can still be walking, over the covered ground.
 *
 * ⚠ **This is what stops a road being credited as a levada.** On this island a
 * road runs beside or above the channel for kilometres at a time, and a car on
 * it is well inside a 60 m corridor. Speed is not read from the fix — it is
 * derived from the covered distance and the time it took, which cannot be
 * faked by a single bad reading.
 */
export const MAX_WALKING_PACE_MPS = MAX_ARRIVAL_SPEED_MPS;

export type Coverage = {
  /** Total drawn length of the course, in metres. */
  courseM: number;
  /** How much of it had a usable fix beside it. */
  coveredM: number;
  /** `coveredM / courseM`, 0–1. */
  fraction: number;
  /** Time between the first and last fix that was on the corridor, in seconds. */
  secondsOnCourse: number;
  /** Fixes that landed in the corridor. Zero means the user was never here. */
  fixesOnCourse: number;
  /** Mean pace over the covered ground, or null when there is no time to divide by. */
  paceMps: number | null;
};

export type CoverageVerdict = {
  /** Award it now. */
  credited: boolean;
  /**
   * Not enough to award, far too much to ignore: worth asking the user
   * *"did you walk the Levada do Furado?"* with the evidence attached.
   *
   * ⚠ **A confirmation, never a claim.** The user is completing a record the
   * app already half-has, not typing in an achievement. If this were an
   * unconditional "mark as collected" button the stamps would mean nothing,
   * which is the one thing D-002 cannot afford.
   */
  offerConfirmation: boolean;
  /** Stored on the award and written to the diary. Always explains itself. */
  reason: string;
  /** 0–1, stored, never shown (D-009, T-072). */
  confidence: number;
};

/** Metres per degree of latitude, and of longitude at a given latitude. */
function metresPerDegree(lat: number): { x: number; y: number } {
  const radians = (lat * Math.PI) / 180;
  return { x: 111_320 * Math.cos(radians), y: 110_540 };
}

/**
 * Distance from a point to a segment, in metres.
 *
 * Flat-earth on purpose: the segments here are tens of metres long and the
 * island is 60 km across, so the projection error is far below the corridor
 * width and this runs inside a loop that executes hundreds of thousands of
 * times on a phone.
 */
function metresToSegment(
  point: { lat: number; lon: number },
  a: CoursePoint,
  b: CoursePoint
): number {
  const scale = metresPerDegree(point.lat);
  const px = (point.lon - a[0]) * scale.x;
  const py = (point.lat - a[1]) * scale.y;
  const bx = (b[0] - a[0]) * scale.x;
  const by = (b[1] - a[1]) * scale.y;

  const lengthSquared = bx * bx + by * by;
  if (lengthSquared === 0) {
    return Math.hypot(px, py);
  }

  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared));
  return Math.hypot(px - t * bx, py - t * by);
}

/** How wide the corridor is for this fix, given what it admits about itself. */
function corridorFor(fix: TraceFix): number {
  const accuracy = fix.accuracy_m ?? 0;
  return CORRIDOR_M + Math.min(accuracy, MAX_ACCURACY_SLACK_M);
}

/**
 * How much of the course this trace covers.
 *
 * The course arrives as many separate lines — `build-levadas.mjs` keeps OSM's
 * own way splits, 39 of them for Levada do Furado — and each segment of each
 * line is judged independently. A segment counts once, however many fixes are
 * beside it, so standing still for an hour covers no more ground than walking
 * past does.
 */
export function computeCoverage(
  lines: readonly (readonly CoursePoint[])[],
  fixes: readonly TraceFix[]
): Coverage {
  const usable = fixes.filter(
    (fix) =>
      Number.isFinite(fix.lat) &&
      Number.isFinite(fix.lon) &&
      (fix.accuracy_m === null || fix.accuracy_m <= MAX_USABLE_ACCURACY_M)
  );

  let courseM = 0;
  let coveredM = 0;
  let fixesOnCourse = 0;
  let firstTs: number | null = null;
  let lastTs: number | null = null;
  const countedFixes = new Set<number>();

  // Where the fixes are, so a levada nobody went near costs one comparison
  // rather than one per segment. A trip is one island wide; a course is one
  // valley, and most of them will miss this box entirely.
  const bounds = boundsOf(usable);
  const grid = indexFixes(usable);

  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const a = line[i - 1];
      const b = line[i];
      const scale = metresPerDegree(b[1]);
      const segmentM = Math.hypot((b[0] - a[0]) * scale.x, (b[1] - a[1]) * scale.y);
      courseM += segmentM;

      if (bounds === null || !segmentNearBounds(a, b, bounds)) {
        continue;
      }

      let covered = false;
      for (const index of candidatesNear(grid, a, b)) {
        const fix = usable[index];
        if (metresToSegment(fix, a, b) > corridorFor(fix)) {
          continue;
        }
        covered = true;
        if (!countedFixes.has(index)) {
          countedFixes.add(index);
          fixesOnCourse += 1;
          firstTs = firstTs === null ? fix.ts : Math.min(firstTs, fix.ts);
          lastTs = lastTs === null ? fix.ts : Math.max(lastTs, fix.ts);
        }
      }
      if (covered) {
        coveredM += segmentM;
      }
    }
  }

  const secondsOnCourse =
    firstTs === null || lastTs === null ? 0 : Math.max(0, Math.round((lastTs - firstTs) / 1000));

  return {
    courseM: Math.round(courseM),
    coveredM: Math.round(coveredM),
    fraction: courseM === 0 ? 0 : coveredM / courseM,
    secondsOnCourse,
    fixesOnCourse,
    paceMps: secondsOnCourse === 0 ? null : coveredM / secondsOnCourse,
  };
}

/**
 * A coarse grid of the trace, so a segment only meets the fixes near it.
 *
 * ⚠ **Without this the loop is quadratic on the two things that grow.** A
 * week-long trip holds ~20,000 fixes and Levada do Norte draws ~650 segments:
 * 13 million distance calculations, per levada, on a phone, inside a pass that
 * runs every time the passport opens. The grid turns that into the handful of
 * fixes that were actually beside each segment.
 *
 * Cell size is a little over the widest corridor, so a segment never needs more
 * than the nine cells around it.
 */
const CELL_DEGREES = 0.002;

type FixGrid = Map<string, number[]>;

function cellKey(lat: number, lon: number): string {
  return `${Math.floor(lat / CELL_DEGREES)},${Math.floor(lon / CELL_DEGREES)}`;
}

function indexFixes(fixes: readonly TraceFix[]): FixGrid {
  const grid: FixGrid = new Map();
  for (const [index, fix] of fixes.entries()) {
    const key = cellKey(fix.lat, fix.lon);
    const bucket = grid.get(key);
    if (bucket === undefined) {
      grid.set(key, [index]);
    } else {
      bucket.push(index);
    }
  }
  return grid;
}

/** Every fix index in the cells this segment passes through, plus a ring around them. */
function candidatesNear(grid: FixGrid, a: CoursePoint, b: CoursePoint): number[] {
  const latFrom = Math.floor(Math.min(a[1], b[1]) / CELL_DEGREES) - 1;
  const latTo = Math.floor(Math.max(a[1], b[1]) / CELL_DEGREES) + 1;
  const lonFrom = Math.floor(Math.min(a[0], b[0]) / CELL_DEGREES) - 1;
  const lonTo = Math.floor(Math.max(a[0], b[0]) / CELL_DEGREES) + 1;

  const found: number[] = [];
  for (let lat = latFrom; lat <= latTo; lat += 1) {
    for (let lon = lonFrom; lon <= lonTo; lon += 1) {
      const bucket = grid.get(`${lat},${lon}`);
      if (bucket !== undefined) {
        found.push(...bucket);
      }
    }
  }
  return found;
}

/** The bounding box of the trace, widened by the widest corridor allowed. */
function boundsOf(fixes: readonly TraceFix[]): {
  north: number;
  south: number;
  east: number;
  west: number;
} | null {
  if (fixes.length === 0) {
    return null;
  }
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;
  for (const fix of fixes) {
    north = Math.max(north, fix.lat);
    south = Math.min(south, fix.lat);
    east = Math.max(east, fix.lon);
    west = Math.min(west, fix.lon);
  }
  // The widest a corridor can be, in degrees, with room to spare.
  const pad = (CORRIDOR_M + MAX_ACCURACY_SLACK_M) / 110_540 + 0.0005;
  return { north: north + pad, south: south - pad, east: east + pad, west: west - pad };
}

function segmentNearBounds(
  a: CoursePoint,
  b: CoursePoint,
  bounds: { north: number; south: number; east: number; west: number }
): boolean {
  return (
    Math.max(a[1], b[1]) >= bounds.south &&
    Math.min(a[1], b[1]) <= bounds.north &&
    Math.max(a[0], b[0]) >= bounds.west &&
    Math.min(a[0], b[0]) <= bounds.east
  );
}

/** Metres as a person would say them, for the diary and the confirmation copy. */
function readable(metres: number): string {
  return metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
}

/**
 * Is this coverage a walk?
 *
 * Order matters: the pace check comes first, because a fast pace does not mean
 * *not enough evidence*, it means *the wrong kind of evidence*, and saying so
 * is what makes a refusal explainable to the person it happened to.
 */
export function judgeCoverage(coverage: Coverage): CoverageVerdict {
  const percent = Math.round(coverage.fraction * 100);
  const walked = `${readable(coverage.coveredM)} of ${readable(coverage.courseM)} (${percent}%)`;

  if (coverage.fixesOnCourse === 0) {
    return {
      credited: false,
      offerConfirmation: false,
      reason: 'no fix was ever beside this course',
      confidence: 0,
    };
  }

  const enough =
    coverage.fraction >= WALKED_FRACTION || coverage.coveredM >= WALKED_ABSOLUTE_M;
  const nearly =
    coverage.fraction >= CONFIRMABLE_FRACTION || coverage.coveredM >= CONFIRMABLE_ABSOLUTE_M;

  // A pace faster than walking, over kilometres, is a road beside the levada —
  // which on this island is the normal case, not an exotic one.
  if (
    (enough || nearly) &&
    coverage.paceMps !== null &&
    coverage.paceMps > MAX_WALKING_PACE_MPS
  ) {
    return {
      credited: false,
      offerConfirmation: false,
      reason: `${walked} covered at ${coverage.paceMps.toFixed(1)} m/s — too fast to have been walked`,
      confidence: 0,
    };
  }

  if (enough) {
    return {
      credited: true,
      offerConfirmation: false,
      // The number that earned it, so a retune (T-131) can be argued from the
      // award rows rather than from a re-walk.
      reason: `walked ${walked} of the course`,
      confidence: Math.min(1, 0.6 + coverage.fraction * 0.4),
    };
  }

  if (nearly) {
    return {
      credited: false,
      offerConfirmation: true,
      reason: `walked ${walked} — enough to ask, not enough to award`,
      confidence: coverage.fraction,
    };
  }

  return {
    credited: false,
    offerConfirmation: false,
    reason: `only ${walked} of the course`,
    confidence: coverage.fraction,
  };
}

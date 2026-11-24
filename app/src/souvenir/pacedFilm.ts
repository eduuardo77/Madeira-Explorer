/**
 * The exported video's pen, paced by day (T-329, D-112).
 *
 * The in-app film paces its pen by ground (`penPath.ts`): one speed per metre,
 * road already drawn at a quarter. On a long trip that pen raced: on the
 * lead's 61-day trip it leapt over 1.5 km inside one frame 26 times and ran
 * at up to 119 km/s. The lead asked for three changes together, tried in
 * `tools/preview-video-options.mjs` and measured there:
 *
 *   1. **Road already drawn is not drawn again.** The pen only goes over new
 *      road. A short stretch of known road between two new pieces is run
 *      through rather than hopped (`BRIDGE_REPEAT_M`).
 *   2. **Paced by day.** Each day with new road gets a share of the same
 *      drawing time, by the square root of its new kilometres (busy days
 *      longer, small days still readable), at least `MIN_DAY_MS`; inside a day
 *      one steady speed.
 *   3. **Nothing is lost.** Slivers too short to animate (`MIN_PIECE_M`) and
 *      roads beside roads already drawn appear as their day closes, so the
 *      finished picture is the whole trip.
 *
 * Measured on trip 31 at 30 fps: leaps 26 to 0, median pen speed 28 to 12 km/s.
 *
 * Pure: roads in (the masked export, D-040), a plan out. The day a fix
 * belongs to comes from `dayKey`, which the caller supplies, so nothing here
 * knows a time zone (D-017).
 */

import { distanceM } from '../recording/distance.ts';

/** A road travelled, as the masked export gives it: timed points in order. */
export type TimedRoad = { points: ReadonlyArray<{ ts: number; lat: number; lon: number }> };

/** An award to place on the film's clock. */
export type PacedAward = { placeId: string; awardedTs: number };

/** One stroke of the pen: its points, and when the pen reaches each, ms from the film's start. */
export type PacedStroke = {
  coordinates: [number, number][]; // [lon, lat]
  timesMs: number[];
  /**
   * Shown whole as its day closes, not drawn by the pen: the slivers and the
   * roads beside roads already drawn. The pen's head never sits on one.
   */
  quiet: boolean;
};

export type PacedDay = {
  /** The caller's key for the day (a local date). */
  key: string;
  /** Day of the trip, counting the trip's first day as 1. */
  dayNumber: number;
  startMs: number;
  endMs: number;
  /** New road drawn by the pen that day, km. */
  newKm: number;
  /** [west, south, east, north] of the day's new road. */
  bounds: [number, number, number, number];
};

export type PacedFilm = {
  strokes: PacedStroke[];
  days: PacedDay[];
  /** Each award at the moment the pen passed it, ms from the film's start. */
  awards: { placeId: string; atMs: number }[];
  /** New road drawn so far, km, as [atMs, km] steps; the last is the trip's total. */
  drawnKm: [number, number][];
};

/** The 40 m grid that says "drawn already", as `penPath.ts` uses. */
const CELL_LAT_DEG = 0.00036;
const CELL_LON_DEG = 0.00043;
/** Road counts as drawn once the pen is this far past it, as `penPath.REPEAT_AFTER_M`. */
const REPEAT_AFTER_M = 300;
/** How finely a step is sampled against the grid, metres. */
const SAMPLE_M = 20;
/** Known road this short between two new pieces is run through, not hopped. */
export const BRIDGE_REPEAT_M = 500;
/** New road shorter than this is a sliver beside a drawn road: it appears as its day closes. */
export const MIN_PIECE_M = 250;
/** The least time a day with new road is given. */
export const MIN_DAY_MS = 350;

const MS_PER_DAY = 86_400_000;

type Piece = { day: string; points: [number, number, number][]; metres: number };

/**
 * Plan the pen for `drawMs` of film starting at `drawFromMs`.
 *
 * `tripStartKey` is the `dayKey` of the trip's start, for the day numbers.
 * `dayKey` must return keys that sort as dates do (`YYYY-MM-DD`).
 */
export function planPacedFilm(input: {
  roads: readonly TimedRoad[];
  awards: readonly PacedAward[];
  drawFromMs: number;
  drawMs: number;
  dayKey: (ts: number) => string;
  tripStartKey: string;
  /** The km the film ends on (the trip's lit road, D-101); the running count is scaled to finish there. */
  totalKm?: number;
}): PacedFilm {
  const { drawFromMs, drawMs, dayKey } = input;
  const runs = [...input.roads]
    .filter((road) => road.points.length >= 2)
    .sort((a, b) => a.points[0].ts - b.points[0].ts);

  // --- what is new, run by run in time order ---
  const drawn = new Map<string, number>(); // cell -> metres along the pen when first drawn
  let penAlong = 0;
  const pieces: Piece[] = [];
  const everyRoadByDay = new Map<string, [number, number][][]>();

  for (const run of runs) {
    let current: Piece | null = null;
    let held: [number, number, number][] = [];
    let heldM = 0;
    let whole: { day: string; line: [number, number][] } | null = null;

    for (let i = 1; i < run.points.length; i += 1) {
      const a = run.points[i - 1];
      const b = run.points[i];
      const day = dayKey(a.ts);
      if (whole === null || whole.day !== day) {
        whole = { day, line: [[a.lon, a.lat]] };
        const list = everyRoadByDay.get(day) ?? [];
        list.push(whole.line);
        everyRoadByDay.set(day, list);
      }
      whole.line.push([b.lon, b.lat]);

      const metres = distanceM(a, b);
      const samples = Math.max(1, Math.ceil(metres / SAMPLE_M));
      let newSamples = 0;
      const cells: string[] = [];
      for (let k = 0; k <= samples; k += 1) {
        const lat = a.lat + ((b.lat - a.lat) * k) / samples;
        const lon = a.lon + ((b.lon - a.lon) * k) / samples;
        const row = Math.round(lat / CELL_LAT_DEG);
        const col = Math.round(lon / CELL_LON_DEG);
        cells.push(`${row},${col}`);
        if (!drawnNear(drawn, row, col, penAlong - REPEAT_AFTER_M)) newSamples += 1;
      }
      const fresh = newSamples * 2 > samples + 1;
      penAlong += metres;
      for (const cell of cells) if (!drawn.has(cell)) drawn.set(cell, penAlong);

      if (fresh) {
        if (current !== null && held.length > 0 && heldM <= BRIDGE_REPEAT_M && current.day === day) {
          current.points.push(...held);
          current.metres += heldM;
        } else if (current === null || held.length > 0) {
          current = { day, points: [[a.lon, a.lat, a.ts]], metres: 0 };
          pieces.push(current);
        }
        held = [];
        heldM = 0;
        current.points.push([b.lon, b.lat, b.ts]);
        current.metres += metres;
      } else if (current !== null) {
        held.push([b.lon, b.lat, b.ts]);
        heldM += metres;
        if (heldM > BRIDGE_REPEAT_M) {
          current = null;
          held = [];
          heldM = 0;
        }
      }
    }
  }

  const kept = pieces.filter((piece) => piece.metres >= MIN_PIECE_M);
  const dayKeys = [...new Set(kept.map((piece) => piece.day))].sort();

  // --- each day's share of the drawing time ---
  const newM = dayKeys.map((key) => kept.filter((p) => p.day === key).reduce((sum, p) => sum + p.metres, 0));
  const weights = newM.map((m) => Math.sqrt(m / 1000));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let shares = weights.map((w) => (weightSum > 0 ? Math.max(MIN_DAY_MS, (drawMs * w) / weightSum) : 0));
  const shareSum = shares.reduce((a, b) => a + b, 0);
  shares = shares.map((ms) => (shareSum > 0 ? (ms * drawMs) / shareSum : 0));

  // --- the pen's clock ---
  const strokes: PacedStroke[] = [];
  const days: PacedDay[] = [];
  const drawnKm: [number, number][] = [];
  const passes: [number, number][] = []; // [real ts, film ms], for the awards
  const tripStartMs = Date.parse(`${input.tripStartKey}T00:00:00Z`);
  let clock = drawFromMs;
  let drawnSoFarM = 0;

  dayKeys.forEach((key, d) => {
    const startMs = clock;
    const dayPieces = kept.filter((p) => p.day === key);
    const totalM = newM[d];
    let along = 0;
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const piece of dayPieces) {
      const coordinates: [number, number][] = [];
      const timesMs: number[] = [];
      piece.points.forEach(([lon, lat, ts], k) => {
        if (k > 0) {
          const [plon, plat] = piece.points[k - 1];
          along += distanceM({ lat: plat, lon: plon }, { lat, lon });
        }
        const at = startMs + (totalM > 0 ? (along / totalM) * shares[d] : 0);
        coordinates.push([lon, lat]);
        timesMs.push(at);
        passes.push([ts, at]);
        if (k > 0) drawnKm.push([at, (drawnSoFarM + along) / 1000]);
        west = Math.min(west, lon);
        east = Math.max(east, lon);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      });
      strokes.push({ coordinates, timesMs, quiet: false });
    }
    drawnSoFarM += totalM;
    clock += shares[d];
    // The rest of the day, whole, as it closes.
    for (const line of everyRoadByDay.get(key) ?? []) {
      if (line.length >= 2) strokes.push({ coordinates: line, timesMs: line.map(() => clock), quiet: true });
    }
    days.push({
      key,
      dayNumber: Math.round((Date.parse(`${key}T00:00:00Z`) - tripStartMs) / MS_PER_DAY) + 1,
      startMs,
      endMs: clock,
      newKm: totalM / 1000,
      bounds: [west, south, east, north],
    });
  });

  // Days with nothing new worth drawing still show their slivers, as the day before them closes.
  for (const [key, lines] of everyRoadByDay) {
    if (dayKeys.includes(key)) continue;
    const before = days.filter((day) => day.key < key).pop();
    const at = before ? before.endMs : drawFromMs;
    for (const line of lines) if (line.length >= 2) strokes.push({ coordinates: line, timesMs: line.map(() => at), quiet: true });
  }

  // The running count ends on the trip's figure, which includes the roads shown whole.
  if (input.totalKm !== undefined && drawnSoFarM > 0) {
    const scale = input.totalKm / (drawnSoFarM / 1000);
    for (const step of drawnKm) step[1] *= scale;
  }

  passes.sort((a, b) => a[0] - b[0]);
  const awards = input.awards.map((award) => ({ placeId: award.placeId, atMs: filmTimeOf(passes, award.awardedTs, drawFromMs) }));

  return { strokes, days, awards, drawnKm };
}

/** Whether `row,col` or a neighbour was drawn by the pen before `beforeM` metres. */
function drawnNear(drawn: Map<string, number>, row: number, col: number, beforeM: number): boolean {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const at = drawn.get(`${row + dr},${col + dc}`);
      if (at !== undefined && at < beforeM) return true;
    }
  }
  return false;
}

/** The film time of the last drawn point at or before `ts`; the drawing's start if none. */
function filmTimeOf(passes: readonly [number, number][], ts: number, fallback: number): number {
  let lo = 0;
  let hi = passes.length - 1;
  let best = fallback;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (passes[mid][0] <= ts) {
      best = passes[mid][1];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/**
 * Where the pen's head is at `atMs`: on the latest stroke the pen has begun,
 * never on a quiet one; null before the first.
 */
export function headAt(film: PacedFilm, atMs: number): { lon: number; lat: number; strokeIndex: number } | null {
  let index = -1;
  for (let i = 0; i < film.strokes.length; i += 1) {
    const stroke = film.strokes[i];
    if (!stroke.quiet && stroke.timesMs[0] <= atMs) index = i;
  }
  if (index < 0) return null;
  const { coordinates, timesMs } = film.strokes[index];
  for (let i = 1; i < timesMs.length; i += 1) {
    if (timesMs[i] >= atMs) {
      const u = (atMs - timesMs[i - 1]) / Math.max(1, timesMs[i] - timesMs[i - 1]);
      return {
        lon: coordinates[i - 1][0] + (coordinates[i][0] - coordinates[i - 1][0]) * u,
        lat: coordinates[i - 1][1] + (coordinates[i][1] - coordinates[i - 1][1]) * u,
        strokeIndex: index,
      };
    }
  }
  const last = coordinates[coordinates.length - 1];
  return { lon: last[0], lat: last[1], strokeIndex: index };
}

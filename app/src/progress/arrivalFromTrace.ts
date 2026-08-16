/**
 * The second way to be somewhere: the trace says so (D-065).
 *
 * WHY A SECOND DETECTOR EXISTS AT ALL
 * -----------------------------------
 * Every stamp in this app depends on the operating system delivering a
 * geofence crossing. That is the right primary mechanism — it costs almost no
 * battery and works with the app shut (D-005) — and it is a **single point of
 * failure for the entire reward**:
 *
 *   - Android drops geofence callbacks under battery saver, in Doze, and after
 *     an OEM's own process killer has been at it (T-053 is unrun).
 *   - Under laurel canopy the OS may never get a fix confident enough to
 *     declare a crossing at all.
 *   - The working set is a *window* of the nearest places (D-033). Cross the
 *     island fast enough and a place can be entered before its geofence is
 *     registered.
 *   - T-145: for months, nothing registered any geofence at all, and 399 tests
 *     had nothing to say about it.
 *
 * In every one of those the raw trace still holds fixes inside the circle,
 * because the recorder is the one thing that never stopped writing (D-010).
 * Asking it is nearly free — the fixes are already read for levada coverage —
 * and it turns a single mechanism into two independent ones.
 *
 * ⚠ **Independent is the point.** This shares no code path with the geofence
 * route: different source, different arithmetic, same rules. A stamp earned
 * either way is the same stamp; the `reason` records which found it, so a
 * retune (T-131) can compare them over real holidays.
 *
 * THE RULES ARE NOT RELAXED HERE
 * ------------------------------
 * Dwell and pace are `stampRules.ts`'s own constants, and deliberately so:
 * this is a second *detector*, not a second *standard*. What it adds is
 * tolerance for a fix that admits imprecision — a ±40 m fix on the boundary of
 * a 200 m circle is evidence of being inside it, and refusing that is refusing
 * the honest fixes, which under canopy are the only ones there are.
 *
 * Pure: no database, no clock, no Expo. Tested in `arrivalFromTrace.test.ts`.
 */

import type { PlaceGeofence } from '../content/contentPack.ts';
import { MAX_ACCURACY_SLACK_M, MAX_USABLE_ACCURACY_M, type TraceFix } from './levadaCoverage.ts';
import { MAX_ARRIVAL_SPEED_MPS, MIN_DWELL_SECONDS } from './stampRules.ts';

/**
 * How long the trace may be silent inside a geofence before it stops counting
 * as one continuous stay.
 *
 * ⚠ NOT TUNED, and it has to exist: the sampling policy defers for up to 15
 * minutes when it believes the user is stationary, which is *exactly* what
 * standing at a miradouro looks like. Without this, the recorder's own battery
 * saving would break every visit it was saving battery during.
 */
export const MAX_GAP_SECONDS = 20 * 60;

export type TraceArrival = {
  geofenceId: string;
  enteredTs: number;
  exitedTs: number;
  dwellSeconds: number;
  /** Distance walked inside the circle over that time, divided by it. */
  meanSpeedMps: number | null;
  fixCount: number;
};

/** Metres between two coordinates. Equirectangular; the distances here are small. */
function metresBetween(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const x = (b.lon - a.lon) * 111_320 * Math.cos(meanLat);
  const y = (b.lat - a.lat) * 110_540;
  return Math.hypot(x, y);
}

/** Is this fix inside the circle, allowing for what it admits about itself? */
function isInside(fix: TraceFix, geofence: PlaceGeofence): boolean {
  if (fix.accuracy_m !== null && fix.accuracy_m > MAX_USABLE_ACCURACY_M) {
    return false;
  }
  const slack = Math.min(fix.accuracy_m ?? 0, MAX_ACCURACY_SLACK_M);
  return metresBetween(fix, geofence) <= geofence.radiusM + slack;
}

/**
 * Every stay inside this geofence that the trace can show.
 *
 * A stay ends when the fixes leave the circle **or** when they stop arriving
 * for longer than `MAX_GAP_SECONDS` — a gap that long is the recorder going
 * quiet, and treating it as continuous presence would be inventing a dwell
 * nobody measured.
 */
export function findArrivals(
  geofence: PlaceGeofence,
  fixes: readonly TraceFix[]
): TraceArrival[] {
  const inside = fixes
    .filter((fix) => Number.isFinite(fix.lat) && Number.isFinite(fix.lon))
    .filter((fix) => isInside(fix, geofence))
    .sort((a, b) => a.ts - b.ts);

  const arrivals: TraceArrival[] = [];
  let run: TraceFix[] = [];

  const close = () => {
    if (run.length === 0) {
      return;
    }
    const first = run[0];
    const last = run[run.length - 1];
    const dwellSeconds = Math.max(0, Math.round((last.ts - first.ts) / 1000));

    let metres = 0;
    for (let i = 1; i < run.length; i += 1) {
      metres += metresBetween(run[i - 1], run[i]);
    }

    arrivals.push({
      geofenceId: geofence.id,
      enteredTs: first.ts,
      exitedTs: last.ts,
      dwellSeconds,
      meanSpeedMps: dwellSeconds === 0 ? null : metres / dwellSeconds,
      fixCount: run.length,
    });
    run = [];
  };

  for (const fix of inside) {
    const previous = run[run.length - 1];
    if (previous !== undefined && fix.ts - previous.ts > MAX_GAP_SECONDS * 1000) {
      close();
    }
    run.push(fix);
  }
  close();

  return arrivals;
}

export type TraceArrivalVerdict = {
  awarded: boolean;
  reason: string;
  awardedTs: number | null;
  dwellSeconds: number | null;
  meanSpeedMps: number | null;
  confidence: number;
};

/**
 * Was the user *there*, by the same standard the geofence route applies?
 *
 * Takes the strongest stay rather than the first: somebody who drove past in
 * the morning and walked up in the afternoon earns the stamp for the afternoon.
 */
export function judgeArrivals(arrivals: readonly TraceArrival[]): TraceArrivalVerdict {
  if (arrivals.length === 0) {
    return {
      awarded: false,
      reason: 'no fix was ever inside this place',
      awardedTs: null,
      dwellSeconds: null,
      meanSpeedMps: null,
      confidence: 0,
    };
  }

  const best = arrivals.reduce((a, b) => (b.dwellSeconds > a.dwellSeconds ? b : a));
  const minutes = Math.round(best.dwellSeconds / 60);

  if (best.dwellSeconds < MIN_DWELL_SECONDS) {
    return {
      awarded: false,
      reason: `the trace shows ${minutes} min inside, and ${Math.round(MIN_DWELL_SECONDS / 60)} are needed`,
      awardedTs: null,
      dwellSeconds: best.dwellSeconds,
      meanSpeedMps: best.meanSpeedMps,
      confidence: 0.2,
    };
  }

  if (best.meanSpeedMps !== null && best.meanSpeedMps > MAX_ARRIVAL_SPEED_MPS) {
    // Long enough, but moving throughout: traffic inside a generous radius, or
    // a road that runs through the circle.
    return {
      awarded: false,
      reason: `${minutes} min inside but moving at ${best.meanSpeedMps.toFixed(1)} m/s throughout`,
      awardedTs: null,
      dwellSeconds: best.dwellSeconds,
      meanSpeedMps: best.meanSpeedMps,
      confidence: 0.1,
    };
  }

  return {
    awarded: true,
    // The evidence, in the words it would be explained in.
    reason: `the trace shows ${minutes} min inside, on foot, across ${best.fixCount} fixes`,
    awardedTs: best.exitedTs,
    dwellSeconds: best.dwellSeconds,
    meanSpeedMps: best.meanSpeedMps,
    // Below the geofence route's own confidence on purpose: this is a
    // reconstruction from samples, and the OS saw the boundary crossed.
    confidence: 0.7,
  };
}

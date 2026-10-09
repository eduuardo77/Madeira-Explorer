/**
 * A trip, one day at a time: the pages of the trip viewer (T-253, D-099).
 *
 * The project lead chose WalkNYC's walk viewer over the animated replay, and
 * chose a page per **day** over a page per trip: a WalkNYC walk is one outing
 * with its own date and figures, and on holiday the nearest thing to an outing
 * is a day. A page per trip would be the same map, growing, for two weeks.
 *
 * WHAT A DAY IS
 * -------------
 * The roads lit that day, as runs of `[lat, lon]` (a tunnel or cable car its
 * own faded run, as on the map); the road lit that day, each stretch once, as
 * the home screen's "km today" counts it (L6); the box that frames them; and the stamps
 * earned that day. A day with neither a road nor a stamp is not a page.
 *
 * ⚠ **A run that crosses midnight is split between the two pages**, at the
 * first point after midnight, and both halves keep that point so the line on
 * one page ends where the next begins. The one segment that spans midnight
 * itself counts for the day it started on: cutting it would need a time inside
 * it that nobody recorded.
 *
 * ⚠ **Midnight is the caller's.** `startOfDay` comes in as a function, the way
 * `nowMs` does elsewhere: the phone's local midnight in the app, a fixed offset
 * in the tests. This module reads no clock and no timezone.
 *
 * Pure: no React, no database. Tested in `tripDays.test.ts`.
 */

import { metresBetween } from '../matching/roadGraph.ts';
import { onceEachStretch, type TimedRun } from '../matching/roadTrace.ts';
import { DATE_LOCALES, type Language } from '../i18n/languages.ts';

/** `[west, south, east, north]`, the order `cameraFit.ts` takes. */
export type DayBounds = [number, number, number, number];

export type DayRun = {
  /** `[lat, lon]`, the order the map's polylines are built from. */
  points: [number, number][];
  faded: boolean;
};

export type ViewerStamp = {
  placeId: string;
  name: string;
  lat: number;
  lon: number;
  awardedTs: number;
};

export type TripDay = {
  /** The day's local midnight: its key, and what its date is formatted from. */
  startTs: number;
  runs: DayRun[];
  /** Road lit that day, metres, each stretch once however often travelled (L6). */
  litM: number;
  /** Everything the day lit and stamped, or null for a day of stamps alone at one point. */
  bounds: DayBounds | null;
  /** Earned that day, in the order they were earned. */
  stamps: ViewerStamp[];
};

/**
 * Split a trip's timed runs and stamps into days, oldest first.
 *
 * `runs` are what `chainTimedRuns` gives for every matched chain of the trip,
 * in any order.
 */
export function tripDays(
  runs: readonly TimedRun[],
  stamps: readonly ViewerStamp[],
  startOfDay: (ts: number) => number,
): TripDay[] {
  const days = new Map<number, TripDay>();
  // One counter per day: a road lit on two days is that day's road on each.
  const counters = new Map<TripDay, ReturnType<typeof onceEachStretch>>();
  const litOnce = (day: TripDay) => {
    let counter = counters.get(day);
    if (counter === undefined) {
      counter = onceEachStretch();
      counters.set(day, counter);
    }
    return counter;
  };
  const dayFor = (ts: number): TripDay => {
    const key = startOfDay(ts);
    let day = days.get(key);
    if (day === undefined) {
      day = { startTs: key, runs: [], litM: 0, bounds: null, stamps: [] };
      days.set(key, day);
    }
    return day;
  };

  for (const run of runs) {
    let current: { day: TripDay; run: DayRun } | null = null;
    for (let i = 1; i < run.points.length; i += 1) {
      const a = run.points[i - 1];
      const b = run.points[i];
      const day = dayFor(a.ts);
      if (current === null || current.day !== day) {
        // A new run wherever the day changes, beginning at the shared point so
        // the line on the earlier page reaches where the next one starts.
        current = { day, run: { points: [[a.lat, a.lon]], faded: run.faded } };
        day.runs.push(current.run);
      }
      current.run.points.push([b.lat, b.lon]);
      day.litM += litOnce(day)(a, b, metresBetween(a.lat, a.lon, b.lat, b.lon));
    }
  }

  for (const stamp of [...stamps].sort((x, y) => x.awardedTs - y.awardedTs)) {
    dayFor(stamp.awardedTs).stamps.push(stamp);
  }

  for (const day of days.values()) {
    day.bounds = boundsOf(day.runs, day.stamps);
  }

  return [...days.values()]
    .filter((day) => day.runs.length > 0 || day.stamps.length > 0)
    .sort((x, y) => x.startTs - y.startTs);
}

/**
 * How many pages `tripDays` would make, without building them: the days with
 * a stretch of lit road begun on them, or a stamp earned (T-262). The
 * passport's list says this number, so it always matches the viewer's
 * "Dia X de Y" (the lead's choice, 2026-10-07).
 */
export function tripDayCount(
  runs: readonly TimedRun[],
  stampTs: readonly number[],
  startOfDay: (ts: number) => number,
): number {
  const days = new Set<number>(stampTs.map(startOfDay));
  for (const run of runs) {
    for (let i = 1; i < run.points.length; i += 1) {
      days.add(startOfDay(run.points[i - 1].ts));
    }
  }
  return days.size;
}

/** Local midnight on the phone's clock: where one page of the viewer ends. */
export function localStartOfDay(ts: number): number {
  const day = new Date(ts);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/**
 * The box around some runs and stamps: a day's frame, and the shared image's
 * frame around the whole masked trip.
 */
export function boundsOf(
  runs: readonly DayRun[],
  stamps: readonly ViewerStamp[],
): DayBounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const take = (lat: number, lon: number) => {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  };
  for (const run of runs) {
    for (const [lat, lon] of run.points) {
      take(lat, lon);
    }
  }
  for (const stamp of stamps) {
    take(stamp.lat, stamp.lon);
  }
  return Number.isFinite(west) ? [west, south, east, north] : null;
}

/**
 * Which page the viewer opens on: the latest day, as WalkNYC opens on its
 * newest walk. -1 for a trip with no pages.
 */
export function openingDay(days: readonly TripDay[]): number {
  return days.length - 1;
}

/**
 * A tag's time, as WalkNYC writes its own: hours and minutes only, the day is
 * on the card. 24-hour in Portuguese and German, 12-hour in English. By hand,
 * as `formatDistance` does, because Hermes's Intl is incomplete (HANDOFF).
 */
export function formatClock(ts: number, language: Language): string {
  const date = new Date(ts);
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const hours = date.getHours();
  if (language === 'en') {
    return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
  }
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

/** The card's title for a day: "Terça-feira, 6 de outubro", in the app's language. */
export function dayTitle(startTs: number, language: Language): string {
  const text = new Date(startTs).toLocaleDateString(DATE_LOCALES[language], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

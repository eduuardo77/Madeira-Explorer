/**
 * Tests for the trip viewer's days (T-253, D-099).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { TimedRun } from '../matching/roadTrace.ts';
import { dayTitle, formatClock, openingDay, tripDays, type ViewerStamp } from './tripDays.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Midnight of the first day, on a fixed clock: no timezone in the tests. */
const D0 = 1_790_000_000_000 - (1_790_000_000_000 % DAY);
const startOfDay = (ts: number) => ts - (ts % DAY);

/** A run heading east along the Funchal seafront, one point a minute. */
function run(fromTs: number, count: number, faded = false): TimedRun {
  return {
    faded,
    points: Array.from({ length: count }, (_, i) => ({
      lat: 32.64,
      lon: -16.93 + i * 0.001,
      ts: fromTs + i * 60_000,
    })),
  };
}

const stamp = (placeId: string, awardedTs: number): ViewerStamp => ({
  placeId,
  name: placeId,
  lat: 32.65,
  lon: -16.9,
  awardedTs,
});

test('roads and stamps fall on the day they happened, oldest day first', () => {
  const days = tripDays(
    [run(D0 + 2 * DAY + 10 * HOUR, 5), run(D0 + 10 * HOUR, 5)],
    [stamp('camacha', D0 + 2 * DAY + 11 * HOUR)],
    startOfDay,
  );

  assert.deepEqual(
    days.map((d) => d.startTs),
    [D0, D0 + 2 * DAY],
  );
  assert.equal(days[0].stamps.length, 0);
  assert.deepEqual(
    days[1].stamps.map((s) => s.placeId),
    ['camacha'],
  );
});

test('a day with neither a road nor a stamp is not a page', () => {
  const days = tripDays([run(D0 + 9 * HOUR, 3), run(D0 + 3 * DAY + 9 * HOUR, 3)], [], startOfDay);
  assert.equal(days.length, 2, 'the two empty days between are skipped');
});

test('a day of stamps alone is a page, framed on its stamps', () => {
  const days = tripDays([], [stamp('a', D0 + 12 * HOUR)], startOfDay);
  assert.equal(days.length, 1);
  assert.deepEqual(days[0].bounds, [-16.9, 32.65, -16.9, 32.65]);
});

test("the metres are the day's own, and add up to the whole", () => {
  const morning = run(D0 + 9 * HOUR, 11);
  const nextDay = run(D0 + DAY + 9 * HOUR, 6);
  const days = tripDays([morning, nextDay], [], startOfDay);

  // 0.001° of longitude at 32.64° N is about 93.8 m.
  assert.ok(Math.abs(days[0].metres - 10 * 93.8) < 5, `${days[0].metres}`);
  assert.ok(Math.abs(days[1].metres - 5 * 93.8) < 5, `${days[1].metres}`);
});

test('a run across midnight is split onto two pages, and they still meet', () => {
  const late = run(D0 + DAY - 3 * 60_000, 6); // 23:57 to 00:02
  const days = tripDays([late], [], startOfDay);

  assert.equal(days.length, 2);
  const lastOfFirst = days[0].runs[0].points.at(-1);
  const firstOfSecond = days[1].runs[0].points[0];
  assert.deepEqual(lastOfFirst, firstOfSecond, 'the line must not break at midnight');
});

test('a tunnel stays faded on its page', () => {
  const days = tripDays([run(D0 + 9 * HOUR, 3), run(D0 + 10 * HOUR, 3, true)], [], startOfDay);
  assert.deepEqual(
    days[0].runs.map((r) => r.faded),
    [false, true],
  );
});

test("points come out as [lat, lon], the map's order", () => {
  const [day] = tripDays([run(D0 + 9 * HOUR, 2)], [], startOfDay);
  const [lat, lon] = day.runs[0].points[0];
  assert.ok(lat > 32 && lat < 33 && lon < -16 && lon > -17);
});

test('the viewer opens on the latest day, as WalkNYC opens on its newest walk', () => {
  const days = tripDays([run(D0 + 9 * HOUR, 2), run(D0 + DAY + 9 * HOUR, 2)], [], startOfDay);
  assert.equal(openingDay(days), 1);
  assert.equal(openingDay([]), -1);
});

test('a tag’s time: 24-hour in Portuguese and German, 12-hour in English', () => {
  const at = new Date(2026, 9, 4, 16, 5).getTime();
  assert.equal(formatClock(at, 'pt'), '16:05');
  assert.equal(formatClock(at, 'de'), '16:05');
  assert.equal(formatClock(at, 'en'), '4:05 PM');
  assert.equal(formatClock(new Date(2026, 9, 4, 0, 7).getTime(), 'en'), '12:07 AM');
});

test('the card’s title names the weekday and the date, capitalised', () => {
  const tuesday = new Date(2026, 9, 6).getTime();
  assert.equal(dayTitle(tuesday, 'pt'), 'Terça-feira, 6 de outubro');
  assert.equal(dayTitle(tuesday, 'en'), 'Tuesday 6 October');
});

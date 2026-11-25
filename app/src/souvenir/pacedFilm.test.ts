/**
 * Tests for the exported video's pen, paced by day (T-329).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MIN_PIECE_M, dayDrawnBoundsAt, headAt, planPacedFilm, type TimedRoad } from './pacedFilm.ts';

const DAY = 86_400_000;
const T0 = Date.parse('2026-10-01T09:00:00Z');
const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);

/** A straight road east from (lat, lon), `metres` long, a point every 50 m, 5 s apart. */
function eastward(lat: number, lon: number, metres: number, startTs: number): TimedRoad {
  const degPerM = 1 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const points = [];
  for (let m = 0, i = 0; m <= metres; m += 50, i += 1) points.push({ ts: startTs + i * 5000, lat, lon: lon + m * degPerM });
  return { points };
}
function reversed(road: TimedRoad, startTs: number): TimedRoad {
  const pts = [...road.points].reverse();
  return { points: pts.map((p, i) => ({ ...p, ts: startTs + i * 5000 })) };
}
const plan = (roads: TimedRoad[], extra: Partial<Parameters<typeof planPacedFilm>[0]> = {}) =>
  planPacedFilm({ roads, awards: [], drawFromMs: 1000, drawMs: 14_000, dayKey, tripStartKey: dayKey(T0), ...extra });
const penM = (film: ReturnType<typeof plan>) => {
  let metres = 0;
  for (const s of film.strokes) if (!s.quiet) for (let i = 1; i < s.coordinates.length; i += 1) {
    const [a, b] = [s.coordinates[i - 1], s.coordinates[i]];
    metres += Math.hypot((b[0] - a[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180), (b[1] - a[1]) * 110_540);
  }
  return metres;
};

test('a road driven out and back is drawn by the pen once', () => {
  const out = eastward(32.7, -16.9, 3000, T0);
  const back = reversed(out, T0 + 3_600_000);
  const film = plan([out, back]);
  assert.ok(Math.abs(penM(film) - 3000) < 150, `pen drew ${penM(film).toFixed(0)} m`);
});

test('the days share the drawing time exactly, in order', () => {
  const film = plan([eastward(32.7, -16.9, 8000, T0), eastward(32.75, -16.9, 2000, T0 + DAY), eastward(32.8, -16.9, 500, T0 + 2 * DAY)]);
  assert.equal(film.days.length, 3);
  assert.equal(film.days[0].startMs, 1000);
  assert.ok(Math.abs(film.days[2].endMs - 15_000) < 1e-6);
  for (let i = 1; i < film.days.length; i += 1) assert.equal(film.days[i].startMs, film.days[i - 1].endMs);
  // Busier days longer, but not in proportion (square root).
  const share = film.days.map((d) => d.endMs - d.startMs);
  assert.ok(share[0] > share[1] && share[1] > share[2]);
  assert.ok(share[0] / share[2] < 8000 / 500);
  assert.deepEqual(film.days.map((d) => d.dayNumber), [1, 2, 3]);
});

test('every road appears by the end, the slivers as their day closes', () => {
  const main = eastward(32.7, -16.9, 4000, T0);
  const sliver = eastward(32.71, -16.85, MIN_PIECE_M - 100, T0 + 7_200_000);
  const film = plan([main, sliver]);
  const quiet = film.strokes.filter((s) => s.quiet);
  const sliverShown = quiet.some((s) => s.coordinates.some(([lon, lat]) => Math.abs(lat - 32.71) < 1e-9 && lon >= -16.85));
  assert.ok(sliverShown, 'the sliver is shown');
  assert.ok(!film.strokes.some((s) => !s.quiet && s.coordinates.some(([, lat]) => Math.abs(lat - 32.71) < 1e-9)), 'the pen does not draw it');
  for (const s of quiet) assert.ok(s.timesMs.every((t) => t === film.days[0].endMs));
});

test('times rise along every stroke and stay inside the drawing', () => {
  const film = plan([eastward(32.7, -16.9, 6000, T0), eastward(32.75, -16.9, 3000, T0 + DAY)]);
  for (const s of film.strokes) {
    for (let i = 1; i < s.timesMs.length; i += 1) assert.ok(s.timesMs[i] >= s.timesMs[i - 1]);
    assert.ok(s.timesMs[0] >= 1000 && s.timesMs[s.timesMs.length - 1] <= 15_000 + 1e-6);
  }
});

test('an award lands when the pen passes it; one before any road, at the start', () => {
  const road = eastward(32.7, -16.9, 4000, T0);
  const midTs = road.points[40].ts;
  const film = plan([road], { awards: [{ placeId: 'mid', awardedTs: midTs }, { placeId: 'early', awardedTs: T0 - 1000 }] });
  const mid = film.awards.find((a) => a.placeId === 'mid')!.atMs;
  assert.ok(mid > 1000 + 14_000 * 0.4 && mid < 1000 + 14_000 * 0.6, `mid at ${mid}`);
  assert.equal(film.awards.find((a) => a.placeId === 'early')!.atMs, 1000);
});

test('the head is never on a quiet stroke, and follows the pen', () => {
  const film = plan([eastward(32.7, -16.9, 4000, T0), eastward(32.71, -16.85, 100, T0 + 7_200_000)]);
  assert.equal(headAt(film, 500), null);
  let lastLon = -Infinity;
  for (let t = 1000; t <= 15_000; t += 500) {
    const head = headAt(film, t)!;
    assert.equal(film.strokes[head.strokeIndex].quiet, false);
    assert.ok(head.lon >= lastLon - 1e-9);
    lastLon = head.lon;
  }
});

test('the running count ends on the trip figure when given', () => {
  const film = plan([eastward(32.7, -16.9, 4000, T0)], { totalKm: 5.5 });
  assert.ok(Math.abs(film.drawnKm[film.drawnKm.length - 1][1] - 5.5) < 1e-9);
  for (let i = 1; i < film.drawnKm.length; i += 1) assert.ok(film.drawnKm[i][1] >= film.drawnKm[i - 1][1]);
});

test('nothing to draw is an empty plan, not a crash', () => {
  const film = plan([]);
  assert.deepEqual(film, { strokes: [], days: [], awards: [], drawnKm: [] });
});

test('dayDrawnBoundsAt: only the day under way, only what the pen has reached', () => {
  const film = plan([eastward(40, 10, 4000, T0), eastward(41, 10, 4000, T0 + DAY)]);
  assert.equal(dayDrawnBoundsAt(film, 0), null);
  const second = film.days[1];
  const mid = (second.startMs + second.endMs) / 2;
  const box = dayDrawnBoundsAt(film, mid)!;
  assert.ok(box[1] > 40.5, 'the first day is not in the second day\'s box');
  const head = headAt(film, mid)!;
  assert.ok(Math.abs(box[2] - head.lon) < 1e-9, 'the box ends at the pen');
  assert.ok(box[2] < second.bounds[2], 'the road ahead is not in it');
});

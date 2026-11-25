/**
 * Tests for the job the native video view plays and exports (T-329).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { composeSouvenir } from './composition.ts';
import type { Film } from './frame.ts';
import type { TimedRoad } from './pacedFilm.ts';
import { DRIFT_ZOOM } from './videoCamera.ts';
import { END_CARD_MS } from './videoOverlay.ts';
import { VIDEO_FPS, buildVideoJob, islandGlyph, prepareVideo, type VideoJobInput } from './videoJob.ts';

const T0 = Date.parse('2026-10-01T09:00:00Z');
const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);

function eastward(lat: number, lon: number, metres: number, startTs: number): TimedRoad {
  const degPerM = 1 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const points = [];
  for (let m = 0, i = 0; m <= metres; m += 50, i += 1) points.push({ ts: startTs + i * 5000, lat, lon: lon + m * degPerM });
  return { points };
}

const roads = [eastward(40, 10, 6000, T0), eastward(40.05, 10, 3000, T0 + 86_400_000)];
const fixes = roads.flatMap((r) => r.points.map((p) => ({ ...p, accuracy_m: 10 })));
const composition = composeSouvenir({
  trace: { fixes, safeToShare: true, reason: 'test' },
  stamps: [{ placeId: 'a', awardedTs: roads[0].points[40].ts }],
  totalPlaces: 10,
  gapThresholdMs: 30 * 60_000,
  roads: roads.map((r) => ({ fixes: r.points.map((p) => ({ ...p, accuracy_m: null })), faded: false })),
});
assert.ok(composition.renderable);
const film = composition as Film;

const input = (overrides: Partial<VideoJobInput> = {}): VideoJobInput => ({
  film,
  roads,
  awards: [{ placeId: 'a', awardedTs: roads[0].points[40].ts }],
  placeNames: new Map([['a', 'A place']]),
  totalKm: 9,
  firstTs: T0,
  lastTs: T0 + 86_400_000 + 3_600_000,
  dayKey,
  language: 'pt',
  title: 'Somewhere',
  islandOutlines: [[[10, 40], [10.2, 40], [10.2, 40.1], [10, 40.1]]],
  tier: 'free',
  choices: { info: 'discreet', camera: 'normal' },
  ...overrides,
});

test('a frame for every 1/30 s of the video, the free end card included, each with its overlay', () => {
  const job = buildVideoJob(input());
  assert.equal(job.durationMs, film.durationMs + END_CARD_MS);
  assert.equal(job.frames.length, Math.floor(job.durationMs / (1000 / VIDEO_FPS)) + 1);
  assert.equal(job.overlays.length, job.frames.length);
  for (let i = 1; i < job.frames.length; i += 1) assert.ok(job.frames[i][0] > job.frames[i - 1][0]);
  for (const [, lon, lat, zoom] of job.frames) assert.ok(Number.isFinite(lon) && Number.isFinite(lat) && Number.isFinite(zoom));
});

test('paid: no end card, so the video is the film', () => {
  const job = buildVideoJob(input({ tier: 'paid' }));
  assert.equal(job.durationMs, film.durationMs);
  assert.ok(job.overlays.every((o) => o.endCard === null));
});

test('the camera is MapLibre zoom (one less than the film planner\'s) holds its place through the end card and only drifts in', () => {
  const job = buildVideoJob(input());
  const last = job.frames[job.frames.length - 1];
  const atFilmEnd = job.frames.find(([t]) => t >= film.durationMs)!;
  assert.deepEqual(last.slice(1, 3), atFilmEnd.slice(1, 3));
  assert.ok(last[3] >= atFilmEnd[3] && last[3] - atFilmEnd[3] <= DRIFT_ZOOM);
  assert.ok(job.frames.every(([, , , zoom]) => zoom > 0 && zoom < 16));
});

test('the close camera is a different, closer path', () => {
  const normal = buildVideoJob(input());
  const close = buildVideoJob(input({ choices: { info: 'discreet', camera: 'close' } }));
  const mid = Math.floor(normal.frames.length / 2);
  assert.ok(close.frames[mid][3] > normal.frames[mid][3]);
});

test('strokes are whole 1e-5 degrees, times whole milliseconds', () => {
  const job = buildVideoJob(input());
  assert.ok(job.strokes.length > 0);
  for (const s of job.strokes) {
    assert.equal(s.c.length, s.t.length);
    assert.ok(s.c.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)));
    assert.ok(s.t.every(Number.isInteger));
  }
});

test('the job survives being sent as JSON, and the same trip gives the same job', () => {
  const a = buildVideoJob(input());
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  assert.deepEqual(buildVideoJob(input()), a);
});

test('the island glyph fits a 100-wide box', () => {
  const glyph = islandGlyph([[[10, 40], [10.5, 40], [10.5, 40.2], [10, 40.2], [10.2, 40.1], [10.1, 40.05], [10.3, 40]]]);
  assert.equal(glyph.width, 100);
  const all = glyph.rings.flat();
  assert.ok(all.every(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= glyph.height));
  assert.deepEqual(islandGlyph([]), { width: 100, height: 0, rings: [] });
});

test('a job built from a prepared video is the job built from scratch', () => {
  const base = input();
  const prepared = prepareVideo(base);
  for (const choices of [{ info: 'full', camera: 'close' }, { info: 'none', camera: 'normal' }] as const) {
    assert.deepEqual(buildVideoJob({ ...base, choices }, prepared), buildVideoJob({ ...base, choices }));
  }
});

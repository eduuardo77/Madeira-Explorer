/**
 * Tests for the exported video's camera (T-329).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { fitBounds } from '../map/cameraFit.ts';
import { CLOSE_CAMERA, DAY_CAMERA, settleCamera, videoCameraAt, videoCameraPath, type CameraDay } from './videoCamera.ts';

const viewport = { width: 360, height: 640, padding: { top: 100, bottom: 130, left: 20, right: 20 } };
const whole: [number, number, number, number] = [-17.25, 32.63, -16.65, 32.87];
// Days that jump about: small boxes far apart, some very short. The case that pumped.
const days: CameraDay[] = [
  { startMs: 1200, bounds: [-16.95, 32.63, -16.85, 32.68] },
  { startMs: 1600, bounds: [-17.2, 32.8, -17.1, 32.86] },
  { startMs: 1950, bounds: [-16.8, 32.7, -16.7, 32.75] },
  { startMs: 5000, bounds: [-17.25, 32.63, -16.65, 32.87] },
  { startMs: 9000, bounds: [-16.93, 32.64, -16.9, 32.66] },
];
const STEP = 1000 / 30;
const path = (options = DAY_CAMERA, follow?: (t: number) => { lon: number; lat: number } | null) =>
  videoCameraPath({ whole, days, viewport, durationMs: 15_000, stepMs: STEP, options, follow });

test('the zoom never moves faster than its limit', () => {
  for (const p of [path(), path(CLOSE_CAMERA, (t) => ({ lon: -17.2 + t / 30_000, lat: 32.7 }))]) {
    for (let i = 1; i < p.length; i += 1) {
      const rate = Math.abs(p[i].zoom - p[i - 1].zoom) / (STEP / 1000);
      assert.ok(rate <= DAY_CAMERA.zoomRateMax + 1e-9, `zoom ${rate.toFixed(3)} levels/s at ${p[i].atMs}`);
    }
  }
});

test('a day is framed at most zoomInMax closer than the whole trip, never further out', () => {
  const p = path();
  const wholeZoom = fitBounds(whole, viewport)!.zoom;
  for (const sample of p) {
    assert.ok(sample.zoom >= wholeZoom - 1e-6);
    assert.ok(sample.zoom <= wholeZoom + DAY_CAMERA.zoomInMax + 1e-6);
  }
});

test('the camera starts easing toward a day before the day begins (smoothed both ways)', () => {
  const p = path();
  const before = videoCameraAt(p, days[3].startMs - 300)!;
  const long = videoCameraAt(p, days[3].startMs - 2500)!;
  assert.notEqual(before.zoom.toFixed(4), long.zoom.toFixed(4));
});

test('the close camera holds its pan, and stays nearer the pen than the day camera', () => {
  const pen = (t: number) => ({ lon: -17.2 + (0.5 * t) / 15_000, lat: 32.66 + (0.15 * t) / 15_000 });
  const close = path(CLOSE_CAMERA, pen);
  for (let i = 1; i < close.length; i += 1) {
    const k = Math.cos((close[i].lat * Math.PI) / 180);
    const km = Math.hypot((close[i].lon - close[i - 1].lon) * k, close[i].lat - close[i - 1].lat) * 111.32;
    assert.ok(km / (STEP / 1000) <= CLOSE_CAMERA.panMaxKmPerS + 1e-6);
  }
  const dist = (c: { lon: number; lat: number }, t: number) => Math.hypot(c.lon - pen(t).lon, c.lat - pen(t).lat);
  const t = 8000;
  assert.ok(dist(videoCameraAt(close, t)!, t) < dist(videoCameraAt(path(), t)!, t));
});

test('the same input gives the same path (a video is made frame by frame)', () => {
  assert.deepEqual(path(), path());
});

test('between samples the camera is interpolated, and out of range it holds', () => {
  const p = path();
  const mid = videoCameraAt(p, (p[10].atMs + p[11].atMs) / 2)!;
  assert.ok(Math.abs(mid.zoom - (p[10].zoom + p[11].zoom) / 2) < 1e-9);
  assert.deepEqual(videoCameraAt(p, -100), { lon: p[0].lon, lat: p[0].lat, zoom: p[0].zoom });
  assert.equal(videoCameraAt([], 0), null);
});

test('the close eases onto its target and rests there, leaving what came before alone', () => {
  const p = path();
  const target = { lon: -16.95, lat: 32.75, zoom: 9 };
  const settled = settleCamera(p, target, 12_000, 1500);
  assert.deepEqual(settled[0], p[0]);
  const before = settled.find((s) => s.atMs >= 11_900)!;
  assert.deepEqual(before, p[p.indexOf(p.find((s) => s.atMs >= 11_900)!)]);
  const last = settled[settled.length - 1];
  assert.ok(Math.abs(last.lon - target.lon) < 1e-9 && Math.abs(last.zoom - target.zoom) < 1e-9);
});

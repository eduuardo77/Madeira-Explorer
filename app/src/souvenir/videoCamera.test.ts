/**
 * Tests for the exported video's camera (T-329).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { fitBounds } from '../map/cameraFit.ts';
import { CLOSE_CAMERA, DAY_CAMERA, DRIFT_ZOOM, OPEN_ZOOM, TILT, cameraBreath, openCamera, tiltedCameraPath, settleCamera, videoCameraAt, videoCameraPath, zoomToHold, type CameraDay } from './videoCamera.ts';

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

test('with keep, what must stay in view never leaves the frame, and closing in is slow', () => {
  // The pen's road so far: a box that grows west to east across the island.
  const boundsAt = (t: number): [number, number, number, number] | null =>
    t < 1200 ? null : [-17.2, 32.65, -17.2 + Math.min(0.5, (t - 1200) / 20_000), 32.8];
  const padding = { top: 112, bottom: 28, left: 12, right: 12 };
  const p = videoCameraPath({ whole, days, viewport, durationMs: 15_000, stepMs: STEP, options: DAY_CAMERA, keep: { boundsAt, padding } });
  for (const sample of p) {
    assert.ok(sample.zoom <= zoomToHold(sample, boundsAt(sample.atMs), viewport, padding) + 1e-9, `cropped at ${sample.atMs}`);
  }
  for (let i = 1; i < p.length; i += 1) {
    assert.ok((p[i].zoom - p[i - 1].zoom) / (STEP / 1000) <= DAY_CAMERA.zoomInRateMax + 1e-9, `closing in too fast at ${p[i].atMs}`);
  }
});

test('zoomToHold: a box fits at the zoom it gives, and not much closer', () => {
  const camera = { lon: -16.95, lat: 32.75, zoom: 0 };
  const box: [number, number, number, number] = [-17.1, 32.7, -16.9, 32.8];
  const z = zoomToHold(camera, box, viewport, { top: 0, bottom: 0, left: 0, right: 0 });
  // West edge is 0.15 deg from the centre, half the frame is 180 points.
  const world = 256 * 2 ** z;
  assert.ok(Math.abs((0.15 / 360) * world - 180) < 0.5);
  assert.equal(zoomToHold(camera, null, viewport, {}), Infinity);
});

test('cameraBreath: opens wide, settles, and drifts in only after the close', () => {
  const at = { openMs: 1600, driftFromMs: 16_000, endMs: 20_000 };
  assert.equal(cameraBreath(0, at), -OPEN_ZOOM);
  assert.equal(cameraBreath(1600, at), 0);
  assert.equal(cameraBreath(10_000, at), 0);
  assert.ok(Math.abs(cameraBreath(20_000, at) - DRIFT_ZOOM) < 1e-9);
  for (let t = 0; t < 20_000; t += 33) assert.ok(Math.abs(cameraBreath(t + 33, at) - cameraBreath(t, at)) / 0.033 < 0.3, `breath too quick at ${t}`);
});

test('openCamera: held on the target, then the path itself', () => {
  const p = path();
  const target = { lon: -16.95, lat: 32.75, zoom: 9 };
  const opened = openCamera(p, target, 3000, 1200);
  const at = (t: number) => opened[Math.round(t / STEP)];
  assert.deepEqual([at(0).lon, at(0).lat, at(0).zoom], [target.lon, target.lat, target.zoom]);
  assert.deepEqual(at(5000), p[Math.round(5000 / STEP)]);
});

test('the tilted camera: whole trip, turning slowly, closer than the flat one', () => {
  const p = tiltedCameraPath({ whole, viewport, durationMs: 15_000, stepMs: STEP });
  assert.equal(p[0].bearing, TILT.bearingFrom);
  assert.ok(Math.abs(p[p.length - 1].bearing - TILT.bearingTo) < 1e-9);
  assert.ok(p.every((s) => s.pitch === TILT.pitch && s.zoom === p[0].zoom));
  for (let i = 1; i < p.length; i += 1) assert.ok(Math.abs(p[i].bearing - p[i - 1].bearing) / (STEP / 1000) < 4, 'turning gently: at most 4 degrees a second');
  assert.ok(p[0].zoom > fitBounds(whole, viewport)!.zoom, 'the island long way up the frame sits closer');
});

/**
 * Tests for the film as map instructions (D-076, T-279).
 *
 *     cd app && npm test
 *
 * Built on real compositions, like `frame.test.ts`: a hand-written frame could
 * satisfy every assertion here while disagreeing with what the app produces.
 *
 * What is being pinned down, in order of what it would cost to get wrong:
 *
 *   1. **No polyline bridges a hole.** The map is the last place ARCHITECTURE
 *      §10's rule can be broken, and joining strokes is the obvious way.
 *   2. **The pen never leaves the frame.** The lead saw it leave (19 Oct 2026);
 *      the camera here is exactly what the map's player computes.
 *   3. **The trace is the map's own trace**, same colour and width.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { projectPoint } from '../map/cameraFit.ts';
import { TRACE_PAINT } from '../map/traceStyle.ts';
import type { TraceFix } from '../map/traceGeoJson.ts';
import { composeSouvenir, type Composition, type SouvenirInput } from './composition.ts';
import { frameAt, frameTimes, type Film } from './frame.ts';
import { cameraAt, cameraPath, CLOSING_SIDE_MARGIN, replayMapFrame, STROKES_PER_LINE } from './replayMap.ts';

const T0 = 1_800_000_000_000;

/** The replay's own viewport on a 360 × 780 phone (`ReplayScreen.tsx`). */
const VIEWPORT = { width: 360, height: 780, padding: { top: 64, bottom: 160, left: 24, right: 24 } };
const OPTIONS = { style: 'light' as const, pixelRatio: 3 };

function walk(count: number, fromMinute = 0): TraceFix[] {
  return Array.from({ length: count }, (_, i) => ({
    ts: T0 + (fromMinute + i) * 60_000,
    lat: 32.65 + i * 0.001,
    lon: -16.9 + i * 0.001,
    accuracy_m: 10,
  }));
}

/** A winding road: a zigzag east with hairpins, as the north coast road is. */
function winding(points: number, fromMinute = 0, fromLon = -17.2): TraceFix[] {
  return Array.from({ length: points }, (_, i) => ({
    ts: T0 + (fromMinute + i) * 60_000,
    lat: 32.8 + 0.01 * Math.sin(i / 3),
    lon: fromLon + i * 0.002,
    accuracy_m: 10,
  }));
}

function input(overrides: Partial<SouvenirInput> = {}): SouvenirInput {
  return {
    trace: { fixes: walk(60), safeToShare: true, reason: 'nothing to mask' },
    stamps: [],
    totalPlaces: 60,
    gapThresholdMs: 30 * 60 * 1000,
    ...overrides,
  };
}

function film(composition: Composition): Film {
  assert.equal(composition.renderable, true);
  if (!composition.renderable) {
    throw new Error('unreachable');
  }
  return composition;
}

const tipOf = (strokes: [number, number][][]) => {
  const last = strokes[strokes.length - 1];
  return last === undefined ? null : last[last.length - 1];
};

test('the trace is the map’s own trace, not a colour invented for the film', () => {
  const f = film(composeSouvenir(input()));
  const lines = replayMapFrame(frameAt(f, f.durationMs), OPTIONS);

  assert.ok(lines.length > 0);
  for (const line of lines) {
    const polyline = line.polyline();
    assert.equal(polyline.id, line.id);
    assert.equal(polyline.color, TRACE_PAINT.light.coreColor);
    // Pixels, not points: a point-width line is the hairline that shipped once.
    assert.equal(polyline.width, TRACE_PAINT.light.coreWidth * 3);
  }
});

test('the dark style paints a different trace, as the map does', () => {
  const f = film(composeSouvenir(input()));
  const [light] = replayMapFrame(frameAt(f, f.durationMs), OPTIONS);
  const [dark] = replayMapFrame(frameAt(f, f.durationMs), { ...OPTIONS, style: 'dark' });

  assert.equal(dark.polyline().color, TRACE_PAINT.dark.coreColor);
  assert.notEqual(light.version, dark.version, 'a style change redraws');
});

test('no line is ever drawn across a hole: the segment there is a gap', () => {
  const fixes = [...walk(20), ...walk(20, 140)];
  const f = film(composeSouvenir(input({ trace: { fixes, safeToShare: true, reason: 'ok' } })));

  const segments = f.scenes.flatMap((s) => (s.kind === 'draw' ? s.segments : []));
  assert.equal(segments.length, 2, 'the fixture must actually contain a gap');

  const before = segments[0].coordinates[segments[0].coordinates.length - 1];
  const after = segments[1].coordinates[0];

  for (const at of frameTimes(f)) {
    for (const line of replayMapFrame(frameAt(f, at), OPTIONS)) {
      const { coordinates, gaps } = line.polyline();
      for (let i = 1; i < coordinates.length; i += 1) {
        const joined =
          coordinates[i - 1].longitude === before[0] &&
          coordinates[i - 1].latitude === before[1] &&
          coordinates[i].longitude === after[0] &&
          coordinates[i].latitude === after[1];
        assert.ok(!joined || gaps.includes(i - 1), `a line crossed the hole at ${at} ms`);
      }
    }
  }
});

test('coordinates are flipped into the map’s order, not passed through', () => {
  // `frame.ts` speaks GeoJSON, [lon, lat]. Backwards puts a Madeira walk in
  // Somalia, and that looks like a blank map rather than like an error.
  const f = film(composeSouvenir(input()));
  const first = replayMapFrame(frameAt(f, f.durationMs), OPTIONS)[0].polyline().coordinates[0];

  assert.ok(first.latitude > 32 && first.latitude < 33, `latitude ${first.latitude}`);
  assert.ok(first.longitude < -16 && first.longitude > -18, `longitude ${first.longitude}`);
});

test('a tunnel in the roads is drawn plain, in the same line as the road', () => {
  const road = walk(30);
  const underground = walk(12, 29).map((fix) => ({ ...fix, lat: fix.lat + 0.03 }));
  const after = walk(20, 40).map((fix) => ({ ...fix, lat: fix.lat + 0.03 }));
  const f = film(
    composeSouvenir(
      input({
        roads: [
          { fixes: road, faded: false },
          { fixes: underground, faded: true },
          { fixes: after, faded: false },
        ],
      })
    )
  );
  const frame = frameAt(f, f.durationMs);
  const lines = replayMapFrame(frame, OPTIONS);
  assert.equal(lines.length, 1);
  const polyline = lines[0].polyline();
  assert.equal(polyline.color, TRACE_PAINT.light.coreColor);
  const drawn = new Set(polyline.coordinates.map((point) => `${point.longitude},${point.latitude}`));
  for (const stroke of frame.strokes) {
    for (const point of stroke) assert.ok(drawn.has(point.join(',')), 'every stroke point is in the line');
  }
});

test('the strokes go to the map a fixed run to a line, and a finished line never changes', () => {
  // Many short strokes, each its own run, far enough apart that none is filled.
  const roads = Array.from({ length: 80 }, (_, k) => ({
    fixes: walk(4, k * 20).map((fix) => ({ ...fix, lon: fix.lon + k * 0.02 })),
  }));
  const f = film(composeSouvenir(input({ roads })));
  const strokes = frameAt(f, f.durationMs).strokes.length;
  assert.ok(strokes > STROKES_PER_LINE, `the fixture needs more than one line (${strokes} strokes)`);
  const end = replayMapFrame(frameAt(f, f.durationMs), OPTIONS);
  assert.equal(end.length, Math.ceil(strokes / STROKES_PER_LINE));
  assert.deepEqual(
    end.map((line) => line.id),
    end.map((_, index) => `replay-trace-${index}`)
  );

  // Every frame after the first line is full shows it unchanged: nothing to resend.
  const versions = new Set<string>();
  for (const at of frameTimes(f)) {
    const frame = frameAt(f, at);
    if (frame.strokes.length > STROKES_PER_LINE) versions.add(replayMapFrame(frame, OPTIONS)[0].version);
  }
  assert.equal(versions.size, 1, 'the first line kept one version while the film drew on');
});

test('the pen is inside the frame at every frame, on a winding road with a jump', () => {
  // Two winding days 25 km apart: hairpins, then the hop to the next day.
  const roads = [{ fixes: winding(120) }, { fixes: winding(120, 1_000, -16.95) }];
  const f = film(composeSouvenir(input({ roads })));
  const camera = cameraPath(f, VIEWPORT);
  let checked = 0;
  for (const at of frameTimes(f)) {
    const tip = tipOf(frameAt(f, at).strokes);
    if (tip === null) continue;
    const { x, y } = projectPoint({ latitude: tip[1], longitude: tip[0] }, cameraAt(camera, at), VIEWPORT);
    assert.ok(x >= 0 && x <= VIEWPORT.width && y >= 0 && y <= VIEWPORT.height, `the pen at ${x.toFixed(0)}, ${y.toFixed(0)} at ${at.toFixed(0)} ms`);
    checked += 1;
  }
  assert.ok(checked > 200, `only ${checked} frames had a pen`);
});

test('the camera opens on the whole trip and rests on it at the end', () => {
  const f = film(composeSouvenir(input()));
  const camera = cameraPath(f, VIEWPORT);
  const draw = f.scenes.find((scene) => scene.kind === 'draw');
  assert.ok(draw !== undefined);

  assert.equal(camera[0].atMs, 0);
  // Held through the opening: the map is born there and does not travel to start.
  assert.deepEqual(cameraAt(camera, draw.startMs), camera[0].camera);
  assert.equal(camera[camera.length - 1].atMs, f.durationMs);
  for (let i = 1; i < camera.length; i += 1) {
    assert.ok(camera[i].atMs >= camera[i - 1].atMs, 'the path goes back in time');
  }
});

test('the camera actually travels, including on a trace of five vertices', () => {
  // ⚠ The regression this exists for: a camera window counted in fixes covered
  // a five-vertex seafront walk at every target, and the film was a static
  // shot. Every test passed; measuring the camera's travel found zero metres.
  const sparse: TraceFix[] = [
    { ts: T0, lat: 32.64, lon: -16.94, accuracy_m: 10 },
    { ts: T0 + 360_000, lat: 32.6412, lon: -16.9355, accuracy_m: 10 },
    { ts: T0 + 720_000, lat: 32.6425, lon: -16.931, accuracy_m: 10 },
    { ts: T0 + 1_080_000, lat: 32.6436, lon: -16.9265, accuracy_m: 10 },
    { ts: T0 + 1_440_000, lat: 32.6448, lon: -16.922, accuracy_m: 10 },
  ];
  const f = film(composeSouvenir(input({ trace: { fixes: sparse, safeToShare: true, reason: 'ok' } })));
  const camera = cameraPath(f, VIEWPORT);
  let travelled = 0;
  for (let i = 1; i < camera.length; i += 1) {
    const a = camera[i - 1].camera.coordinates;
    const b = camera[i].camera.coordinates;
    travelled += Math.hypot((a.latitude - b.latitude) * 111_000, (a.longitude - b.longitude) * 93_500);
  }
  assert.ok(travelled > 500, `the camera travelled ${Math.round(travelled)} m`);
});

test('the camera never jumps between two frames', () => {
  const roads = [{ fixes: winding(120) }, { fixes: winding(120, 1_000, -16.95) }];
  const f = film(composeSouvenir(input({ roads })));
  const camera = cameraPath(f, VIEWPORT);
  const times = frameTimes(f);
  for (let i = 1; i < times.length; i += 1) {
    const a = cameraAt(camera, times[i - 1]);
    const b = cameraAt(camera, times[i]);
    // Half a zoom level in a thirtieth of a second would be a cut, not a move.
    assert.ok(Math.abs(a.zoom - b.zoom) < 0.15, `zoom ${a.zoom.toFixed(2)} to ${b.zoom.toFixed(2)} at ${times[i]} ms`);
  }
});

test('the finale rests the whole trip on the closing card, not mid-screen over sea', () => {
  // Wide and shallow, as a day along the south coast is.
  const coast: TraceFix[] = Array.from({ length: 160 }, (_, i) => ({
    ts: T0 + i * 60_000,
    lat: 32.65 + (i % 2) * 0.002,
    lon: -17.2 + i * 0.003,
    accuracy_m: 10,
  }));
  const f = film(composeSouvenir(input({ trace: { fixes: coast, safeToShare: true, reason: 'ok' } })));
  const finale = f.scenes.find((scene) => scene.kind === 'finale');
  assert.ok(finale !== undefined && finale.kind === 'finale');
  const resting = cameraAt(cameraPath(f, VIEWPORT), f.durationMs);

  const south = projectPoint({ latitude: finale.bounds.south, longitude: finale.bounds.west }, resting, VIEWPORT);
  const east = projectPoint({ latitude: finale.bounds.south, longitude: finale.bounds.east }, resting, VIEWPORT);
  const foot = VIEWPORT.height - VIEWPORT.padding.bottom;
  assert.ok(Math.abs(south.y - foot) < 1, `the trip ends ${Math.round(foot - south.y)} pt above the card`);
  assert.ok(Math.abs(east.x - south.x - (VIEWPORT.width - 2 * CLOSING_SIDE_MARGIN)) < 1, `the trip spans ${Math.round(east.x - south.x)} pt`);
});

test('no camera move in the app is handed a zero duration: Google throws on it (2026-10-08)', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = path.join(here, '..');
  const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.tsx'));
  const zero = files.filter((file) =>
    /setCameraPosition\([^)]*duration:\s*0\b/s.test(readFileSync(path.join(src, file), 'utf8'))
  );
  assert.deepEqual(zero, []);
});

test('the closing frame keeps a whole-island trip off the edges and above the card (N25)', () => {
  // The lead's trip on 27 Oct 2026: −17.169 to −16.706, 32.635 to 32.868.
  const corners: [number, number][] = [
    [32.868, -17.169],
    [32.635, -17.05],
    [32.64, -16.9],
    [32.75, -16.706],
  ];
  const fixes: TraceFix[] = [];
  for (let leg = 0; leg < corners.length - 1; leg += 1) {
    const [lat0, lon0] = corners[leg];
    const [lat1, lon1] = corners[leg + 1];
    // Dense enough to pass as a real trace: about 60 m a fix, a fix a minute.
    for (let i = 0; i < 400; i += 1) {
      const u = i / 400;
      fixes.push({ ts: T0 + fixes.length * 60_000, lat: lat0 + (lat1 - lat0) * u, lon: lon0 + (lon1 - lon0) * u, accuracy_m: 10 });
    }
  }
  const f = film(composeSouvenir(input({ trace: { fixes, safeToShare: true, reason: 'nothing to mask' } })));
  const finale = f.scenes.find((scene) => scene.kind === 'finale');
  assert.ok(finale !== undefined && finale.bounds.west < -17.16 && finale.bounds.east > -16.71, 'the film kept the whole trip');
  const path = cameraPath(f, VIEWPORT);
  const closing = path[path.length - 1].camera;
  for (const fix of fixes) {
    const { x, y } = projectPoint({ latitude: fix.lat, longitude: fix.lon }, closing, VIEWPORT);
    assert.ok(x >= 40 - 0.5 && x <= VIEWPORT.width - 40 + 0.5, `x ${x.toFixed(1)} too near an edge`);
    assert.ok(y <= VIEWPORT.height - VIEWPORT.padding.bottom + 0.5, `y ${y.toFixed(1)} under the card`);
  }
});

test('the pull-back widens the margins gradually, with no jump at its end', () => {
  const f = film(composeSouvenir(input({ trace: { fixes: winding(200), safeToShare: true, reason: 'nothing to mask' } })));
  const path = cameraPath(f, VIEWPORT);
  for (let i = 1; i < path.length; i += 1) {
    assert.ok(Math.abs(path[i].camera.zoom - path[i - 1].camera.zoom) < 0.1, `zoom jumps at ${path[i].atMs} ms`);
  }
});

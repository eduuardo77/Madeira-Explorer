/**
 * Tests for the film-as-map-instructions (D-076).
 *
 *     cd app && npm test
 *
 * Built on real compositions, like `frame.test.ts` — a hand-written frame could
 * satisfy every assertion here while disagreeing with what the app actually
 * produces.
 *
 * What is being pinned down, in order of what it would cost to get wrong:
 *
 *   1. **No polyline bridges a blackout.** The map is the last place
 *      ARCHITECTURE §10's rule can be broken, and joining strokes for
 *      "efficiency" is the obvious way to break it.
 *   2. **The trace is the map's own trace** — same colour, same width — so the
 *      replay cannot drift away from the everyday map.
 *   3. **The camera is throttled but never stuck.** A camera that stops
 *      updating is a film that stops following the walk.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { TRACE_PAINT } from '../map/traceStyle.ts';
import type { TraceFix } from '../map/traceGeoJson.ts';
import {
  composeSouvenir,
  type Composition,
  type SouvenirInput,
} from './composition.ts';
import { CATEGORY_COLOUR, STAMP_MARK_POINTS, stampMarkPoints } from './filmPaint.ts';
import { frameAt, frameTimes, type Film } from './frame.ts';
import { cameraMoveDue, cameraPlan, replayMapFrame } from './replayMap.ts';

const T0 = 1_800_000_000_000;

const VIEWPORT = { width: 390, height: 844 };
const OPTIONS = { style: 'light' as const, viewport: VIEWPORT, pixelRatio: 3 };

function walk(count: number, fromMinute = 0): TraceFix[] {
  return Array.from({ length: count }, (_, i) => ({
    ts: T0 + (fromMinute + i) * 60_000,
    lat: 32.65 + i * 0.001,
    lon: -16.9 + i * 0.001,
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

test('the camera frames the walk, and is a real zoom', () => {
  const f = film(composeSouvenir(input()));
  const { camera } = replayMapFrame(frameAt(f, f.durationMs), OPTIONS);

  assert.notEqual(camera, null);
  assert.ok(Number.isFinite(camera?.zoom));
  assert.ok((camera?.zoom ?? 0) > 0);
  // Somewhere on the walk, not off in the Atlantic.
  assert.ok(Math.abs((camera?.coordinates.latitude ?? 0) - 32.68) < 0.2);
  assert.ok(Math.abs((camera?.coordinates.longitude ?? 0) + 16.87) < 0.2);
});

test('the trace is the map’s own trace, not a colour invented for the film', () => {
  const f = film(composeSouvenir(input()));
  const { polylines } = replayMapFrame(frameAt(f, f.durationMs), OPTIONS);

  assert.ok(polylines.length > 0);
  for (const line of polylines) {
    assert.equal(line.color, TRACE_PAINT.light.coreColor);
    // Pixels, not points — a point-width line is the hairline that shipped once.
    assert.equal(line.width, TRACE_PAINT.light.coreWidth * 3);
  }
});

test('the dark style paints a different trace, as the map does', () => {
  const f = film(composeSouvenir(input()));
  const light = replayMapFrame(frameAt(f, f.durationMs), OPTIONS);
  const dark = replayMapFrame(frameAt(f, f.durationMs), { ...OPTIONS, style: 'dark' });

  assert.notEqual(light.polylines[0].color, dark.polylines[0].color);
  assert.equal(dark.polylines[0].color, TRACE_PAINT.dark.coreColor);
});

test('no polyline ever bridges a blackout', () => {
  const fixes = [...walk(20), ...walk(20, 140)];
  const f = film(composeSouvenir(input({ trace: { fixes, safeToShare: true, reason: 'ok' } })));

  const segments = f.scenes.flatMap((s) => (s.kind === 'draw' ? s.segments : []));
  assert.equal(segments.length, 2, 'the fixture must actually contain a gap');

  const before = segments[0].coordinates[segments[0].coordinates.length - 1];
  const after = segments[1].coordinates[0];

  for (const at of frameTimes(f)) {
    const { polylines } = replayMapFrame(frameAt(f, at), OPTIONS);
    for (const line of polylines) {
      for (let i = 1; i < line.coordinates.length; i += 1) {
        const joined =
          line.coordinates[i - 1].longitude === before[0] &&
          line.coordinates[i - 1].latitude === before[1] &&
          line.coordinates[i].longitude === after[0] &&
          line.coordinates[i].latitude === after[1];
        assert.ok(!joined, `a polyline crossed the blackout at ${at} ms`);
      }
    }
  }
});

test('coordinates are flipped into the map’s order, not passed through', () => {
  // `frame.ts` speaks GeoJSON — [lon, lat]. The map wants {latitude, longitude}.
  // Getting this backwards puts a Madeira walk in Somalia and looks like a
  // blank map rather than like an error.
  const f = film(composeSouvenir(input()));
  const { polylines } = replayMapFrame(frameAt(f, f.durationMs), OPTIONS);
  const first = polylines[0].coordinates[0];

  assert.ok(first.latitude > 32 && first.latitude < 33, `latitude ${first.latitude}`);
  assert.ok(first.longitude < -16 && first.longitude > -18, `longitude ${first.longitude}`);
});

test('a stamp is drawn in its category colour and settles to one size', () => {
  const stamps = [
    { placeId: 'a', name: 'A', category: 'levada' as const, awardedTs: T0 + 20 * 60_000, lat: 32.66, lon: -16.89 },
  ];
  const f = film(composeSouvenir(input({ stamps })));
  const cue = f.scenes.flatMap((s) => (s.kind === 'draw' ? s.cues : []))[0];

  const landing = replayMapFrame(frameAt(f, cue.atMs), OPTIONS);
  const settled = replayMapFrame(frameAt(f, cue.atMs + 2_000), OPTIONS);

  assert.equal(landing.circles.length, 1);
  assert.equal(landing.circles[0].color, CATEGORY_COLOUR.levada);
  // It arrives big and shrinks — the pop the film is supposed to have.
  assert.ok(landing.circles[0].radius > settled.circles[0].radius);
});

test('the mark settles to its resting size and stays there', () => {
  assert.equal(stampMarkPoints(10_000), STAMP_MARK_POINTS);
  assert.ok(stampMarkPoints(0) > STAMP_MARK_POINTS);
});

test('no stamps are drawn before their cue', () => {
  const stamps = [
    { placeId: 'a', name: 'A', category: 'viewpoint' as const, awardedTs: T0 + 10 * 60_000, lat: 32.66, lon: -16.89 },
    { placeId: 'b', name: 'B', category: 'beach' as const, awardedTs: T0 + 40 * 60_000, lat: 32.67, lon: -16.88 },
  ];
  const f = film(composeSouvenir(input({ stamps })));

  assert.equal(replayMapFrame(frameAt(f, 0), OPTIONS).circles.length, 0);
  assert.equal(replayMapFrame(frameAt(f, f.durationMs), OPTIONS).circles.length, 2);
});

test('the camera is a handful of instructions, not one per frame', () => {
  // The whole point of D-076's second pass: the map animates itself, so the app
  // issues targets rather than interpolating and then throttling itself.
  const f = film(composeSouvenir(input()));
  const plan = cameraPlan(f, VIEWPORT);

  assert.ok(plan.length >= 3, `${plan.length} instructions is not a film`);
  assert.ok(
    plan.length < frameTimes(f).length / 10,
    `${plan.length} instructions is per-frame interpolation by another name`
  );

  for (let i = 1; i < plan.length; i += 1) {
    assert.ok(plan[i].atMs >= plan[i - 1].atMs, 'instructions must be in order');
  }
});

test('the film opens where it means to, rather than gliding into place', () => {
  const f = film(composeSouvenir(input()));
  const plan = cameraPlan(f, VIEWPORT);

  assert.equal(plan[0].atMs, 0);
  assert.equal(plan[0].durationMs, 0, 'the opening shot must snap, not travel');
});

test('every instruction has a real camera and a duration that is not negative', () => {
  const f = film(composeSouvenir(input()));

  for (const move of cameraPlan(f, VIEWPORT)) {
    assert.ok(Number.isFinite(move.camera.zoom));
    assert.ok(Number.isFinite(move.camera.coordinates.latitude));
    assert.ok(Number.isFinite(move.camera.coordinates.longitude));
    assert.ok(move.durationMs >= 0, `duration ${move.durationMs}`);
  }
});

test('a pan lasts until the next instruction, so the camera is never idle mid-draw', () => {
  const f = film(composeSouvenir(input()));
  const plan = cameraPlan(f, VIEWPORT);

  // Every move except the last should arrive exactly as the next is issued.
  // A shorter duration would leave the camera parked; a longer one would be cut
  // off by the next instruction.
  for (let i = 1; i < plan.length - 1; i += 1) {
    if (plan[i].durationMs === 0) {
      continue;
    }
    assert.equal(
      plan[i].atMs + plan[i].durationMs,
      plan[i + 1].atMs,
      `instruction ${i} does not hand over cleanly`
    );
  }
});

test('the finale is animated — it is the pull-back to the whole trip', () => {
  const f = film(composeSouvenir(input()));
  const plan = cameraPlan(f, VIEWPORT);
  const finale = f.scenes.find((scene) => scene.kind === 'finale');
  assert.ok(finale !== undefined);

  const move = plan.find((m) => m.atMs === finale.startMs);
  assert.ok(move !== undefined, 'the finale must move the camera');
  assert.ok(move.durationMs > 0, 'the finale must ease, not cut');
});

test('the camera actually travels — including on a trace of five vertices', () => {
  // ⚠⚠ THE REGRESSION THIS EXISTS FOR. The camera window used to be counted in
  // *fixes*, and the trace reaching this module is the **cleaned** one: a
  // straight 2.2 km seafront walk arrives as five vertices with its full length
  // intact. "15% of the fixes, at least 8" then covered the whole walk at every
  // keyframe, so all six framed the same box and the film was a static shot.
  //
  // Every test passed. Nothing looked wrong. It was only found by measuring how
  // far the camera moved and getting **zero metres** — which is the project's
  // own rule about suspecting a result that does not move.
  const sparse: TraceFix[] = [
    { ts: T0, lat: 32.6400, lon: -16.9400, accuracy_m: 10 },
    { ts: T0 + 600_000, lat: 32.6430, lon: -16.9300, accuracy_m: 10 },
    { ts: T0 + 1_200_000, lat: 32.6455, lon: -16.9180, accuracy_m: 10 },
    { ts: T0 + 1_800_000, lat: 32.6470, lon: -16.9050, accuracy_m: 10 },
    { ts: T0 + 2_400_000, lat: 32.6490, lon: -16.8900, accuracy_m: 10 },
  ];

  const f = film(composeSouvenir(input({ trace: { fixes: sparse, safeToShare: true, reason: 'ok' } })));
  const plan = cameraPlan(f, VIEWPORT);

  let travelled = 0;
  for (let i = 1; i < plan.length; i += 1) {
    const a = plan[i - 1].camera.coordinates;
    const b = plan[i].camera.coordinates;
    travelled += Math.hypot((a.latitude - b.latitude) * 111_000, (a.longitude - b.longitude) * 93_500);
  }

  assert.ok(
    travelled > 500,
    `the camera travelled ${Math.round(travelled)} m — it is not following the walk`
  );
});

test('which instruction is due, and nothing before the first', () => {
  const f = film(composeSouvenir(input()));
  const plan = cameraPlan(f, VIEWPORT);

  assert.equal(cameraMoveDue(plan, -1), -1);
  assert.equal(cameraMoveDue(plan, 0), 0);
  assert.equal(cameraMoveDue(plan, f.durationMs), plan.length - 1);

  // And it only ever goes forwards as the film does.
  let previous = -1;
  for (const at of frameTimes(f)) {
    const due = cameraMoveDue(plan, at);
    assert.ok(due >= previous, 'the due instruction went backwards');
    previous = due;
  }
});

/**
 * Tests for sampling the film (T-105b).
 *
 *     cd app && npm test
 *
 * ⚠ **Built on real compositions, not on hand-written storyboards.** A fixture
 * invented here could satisfy every assertion below while disagreeing with what
 * `composeSouvenir` actually emits, and the bug would only appear on a device.
 * So every test starts from `composeSouvenir`.
 *
 * What is being pinned down, in order of what it would cost to get wrong:
 *
 *   1. **No stroke ever bridges a blackout.** ARCHITECTURE §10 forbids the app
 *      to draw a road nobody proved was taken, and the sampler is the last
 *      place that rule can be broken.
 *   2. **The drawing only ever grows.** A trace that shrinks between frames is
 *      a film that un-walks the holiday.
 *   3. **Every stamp is on screen by the end.** Stamps are the reward (D-002).
 *   4. **It is deterministic and stateless.** Sampling in a random order gives
 *      the same frames as sampling in sequence.
 *
 * Nothing here has been *watched*. These prove the arithmetic is consistent;
 * whether the pan reads as smooth is a question only a pair of eyes answers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { TraceFix } from '../map/traceGeoJson.ts';
import {
  composeSouvenir,
  type Composition,
  type SouvenirInput,
  type SouvenirStamp,
} from './composition.ts';
import { frameAt, frameCount, frameTimes, projector, type Film } from './frame.ts';

const GAP_MS = 30 * 60 * 1000;
const T0 = 1_800_000_000_000;

function fix(minutes: number, lat: number, lon: number): TraceFix {
  return { ts: T0 + minutes * 60_000, lat, lon, accuracy_m: 10 };
}

function walk(count: number, fromMinute = 0): TraceFix[] {
  const fixes: TraceFix[] = [];
  for (let i = 0; i < count; i += 1) {
    fixes.push(fix(fromMinute + i, 32.65 + i * 0.001, -16.9 + i * 0.001));
  }
  return fixes;
}

function stamp(minute: number, id: string): SouvenirStamp {
  return {
    placeId: id,
    name: `Place ${id}`,
    category: 'viewpoint',
    awardedTs: T0 + minute * 60_000,
    lat: 32.66,
    lon: -16.91,
  };
}

function input(overrides: Partial<SouvenirInput> = {}): SouvenirInput {
  return {
    trace: { fixes: walk(60), safeToShare: true, reason: 'nothing to mask' },
    stamps: [],
    totalPlaces: 180,
    gapThresholdMs: GAP_MS,
    ...overrides,
  };
}

/** Narrow to the renderable case, failing the test if it refused. */
function film(composition: Composition): Film {
  assert.equal(
    composition.renderable,
    true,
    `expected a film, got: ${composition.reason}`
  );
  if (!composition.renderable) {
    throw new Error('unreachable');
  }
  return composition;
}

/** Total points drawn across every stroke — the size of the drawing. */
function drawnPoints(strokes: readonly (readonly unknown[])[]): number {
  return strokes.reduce((sum, stroke) => sum + stroke.length, 0);
}

test('the schedule covers the film and never runs past it', () => {
  const f = film(composeSouvenir(input()));
  const times = frameTimes(f);

  assert.equal(times.length, frameCount(f));
  assert.equal(times[0], 0);
  assert.ok(times[times.length - 1] <= f.durationMs);
  // 30 fps over a film measured in seconds is hundreds of frames, not tens —
  // this is the number `captureRef` has to survive (docs/video-encoder-research).
  assert.ok(times.length > 100, `only ${times.length} frames`);

  for (let i = 1; i < times.length; i += 1) {
    assert.ok(times[i] > times[i - 1], 'frame times must increase');
  }
});

test('the first frame is empty and the last frame holds the whole walk', () => {
  const f = film(composeSouvenir(input()));

  const first = frameAt(f, 0);
  assert.equal(first.kind, 'establish');
  assert.deepEqual(first.strokes, []);
  assert.deepEqual(first.stamps, []);
  assert.equal(first.hero, null);

  const last = frameAt(f, f.durationMs);
  assert.equal(last.kind, 'finale');
  assert.ok(drawnPoints(last.strokes) > 0, 'the finale must still show the trace');
  assert.notEqual(last.hero, null);
});

test('the finale keeps the trace on screen', () => {
  // The regression this guards: reading strokes from the *current* scene only.
  // The finale is not a draw scene, so the map would go blank for the closing
  // shot — the one frame most likely to be screenshotted.
  const f = film(composeSouvenir(input()));
  const finale = f.scenes.find((scene) => scene.kind === 'finale');
  assert.ok(finale !== undefined);

  const frame = frameAt(f, finale.startMs + finale.durationMs / 2);
  assert.equal(frame.kind, 'finale');
  assert.ok(drawnPoints(frame.strokes) > 0);
});

test('the drawing only ever grows', () => {
  const f = film(composeSouvenir(input()));
  let previous = -1;

  for (const at of frameTimes(f)) {
    const size = drawnPoints(frameAt(f, at).strokes);
    assert.ok(
      size >= previous,
      `the trace shrank at ${at} ms: ${previous} then ${size}`
    );
    previous = size;
  }
});

test('no stroke ever bridges a blackout', () => {
  // Two walks either side of a two-hour silence. The pen must lift.
  const fixes = [...walk(20), ...walk(20, 140)];
  const f = film(composeSouvenir(input({ trace: { fixes, safeToShare: true, reason: 'ok' } })));

  const segments = f.scenes.flatMap((scene) =>
    scene.kind === 'draw' ? scene.segments : []
  );
  assert.equal(segments.length, 2, 'the fixture must actually contain a gap');

  // The join the film must never draw: the last point before the silence and
  // the first point after it, adjacent inside one stroke.
  const beforeGap = segments[0].coordinates[segments[0].coordinates.length - 1];
  const afterGap = segments[1].coordinates[0];

  for (const at of frameTimes(f)) {
    for (const stroke of frameAt(f, at).strokes) {
      for (let i = 1; i < stroke.length; i += 1) {
        const joined =
          stroke[i - 1][0] === beforeGap[0] &&
          stroke[i - 1][1] === beforeGap[1] &&
          stroke[i][0] === afterGap[0] &&
          stroke[i][1] === afterGap[1];
        assert.ok(!joined, `a stroke crossed the blackout at ${at} ms`);
      }
    }
  }
});

test('the pen is up for the whole blackout', () => {
  const fixes = [...walk(20), ...walk(20, 140)];
  const f = film(composeSouvenir(input({ trace: { fixes, safeToShare: true, reason: 'ok' } })));
  const segments = f.scenes.flatMap((scene) =>
    scene.kind === 'draw' ? scene.segments : []
  );

  // Halfway through the pen-lift: the first stroke is complete, the second has
  // not started, so exactly one stroke is on screen.
  const lift = (segments[0].endMs + segments[1].startMs) / 2;
  assert.ok(lift > segments[0].endMs && lift < segments[1].startMs);

  const frame = frameAt(f, lift);
  assert.equal(frame.strokes.length, 1);
  assert.equal(frame.strokes[0].length, segments[0].coordinates.length);
});

test('a stroke grows smoothly rather than a fix at a time', () => {
  const f = film(composeSouvenir(input()));
  const segment = f.scenes.flatMap((scene) =>
    scene.kind === 'draw' ? scene.segments : []
  )[0];

  // A quarter of the way along one edge: the interpolated head must sit
  // strictly between two recorded fixes, not on either of them.
  const edges = segment.coordinates.length - 1;
  const quarterEdge = segment.startMs + ((segment.endMs - segment.startMs) / edges) * 0.25;

  const stroke = frameAt(f, quarterEdge).strokes[0];
  const head = stroke[stroke.length - 1];
  const [fromLon, fromLat] = segment.coordinates[0];
  const [toLon, toLat] = segment.coordinates[1];

  assert.ok(head[0] > Math.min(fromLon, toLon) && head[0] < Math.max(fromLon, toLon));
  assert.ok(head[1] > Math.min(fromLat, toLat) && head[1] < Math.max(fromLat, toLat));
});

test('every stamp has landed by the end, in collection order', () => {
  const stamps = [stamp(5, 'a'), stamp(20, 'b'), stamp(50, 'c')];
  const f = film(composeSouvenir(input({ stamps })));

  const landed = frameAt(f, f.durationMs).stamps;
  assert.deepEqual(
    landed.map((s) => s.placeId),
    ['a', 'b', 'c']
  );

  // And none of them before its cue.
  const cues = f.scenes.flatMap((scene) => (scene.kind === 'draw' ? scene.cues : []));
  for (const cue of cues) {
    const justBefore = frameAt(f, cue.atMs - 1).stamps.map((s) => s.placeId);
    assert.ok(!justBefore.includes(cue.placeId), `${cue.placeId} landed early`);
  }
});

test('a stamp knows how long it has been on screen', () => {
  const f = film(composeSouvenir(input({ stamps: [stamp(5, 'a')] })));
  const cue = f.scenes.flatMap((scene) => (scene.kind === 'draw' ? scene.cues : []))[0];

  assert.equal(frameAt(f, cue.atMs).stamps[0].ageMs, 0);
  assert.equal(frameAt(f, cue.atMs + 400).stamps[0].ageMs, 400);
});

test('the stamp count never goes down', () => {
  const stamps = [stamp(5, 'a'), stamp(20, 'b'), stamp(50, 'c')];
  const f = film(composeSouvenir(input({ stamps })));

  let previous = 0;
  for (const at of frameTimes(f)) {
    const count = frameAt(f, at).stamps.length;
    assert.ok(count >= previous, `a stamp vanished at ${at} ms`);
    previous = count;
  }
  assert.equal(previous, 3);
});

test('the camera moves, and eases rather than jumps', () => {
  const f = film(composeSouvenir(input()));
  const draw = f.scenes.find((scene) => scene.kind === 'draw');
  assert.ok(draw !== undefined && draw.camera.length >= 2);

  const first = draw.camera[0];
  const second = draw.camera[1];

  // At the keyframe itself, exactly the keyframe.
  assert.deepEqual(frameAt(f, first.atMs).bounds, first.bounds);

  // Smoothstep has zero velocity at both ends, so the first tenth of the way
  // between two keyframes must cover less than a tenth of the distance. Linear
  // easing — the thing this is here to prevent — would cover exactly a tenth.
  const span = second.atMs - first.atMs;
  const early = frameAt(f, first.atMs + span * 0.1).bounds;
  const travelled = Math.abs(early.north - first.bounds.north);
  const total = Math.abs(second.bounds.north - first.bounds.north);

  // ⚠ Asserted, not guarded with an `if`. Two identical keyframes would make
  // the real check below vacuous, and a test that quietly stops testing is the
  // probe this project is told to suspect.
  assert.ok(total > 0, 'the fixture must actually move the camera');
  assert.ok(travelled < total * 0.1, 'the camera is not eased');
});

test('times outside the film are clamped, not refused', () => {
  const f = film(composeSouvenir(input()));

  assert.deepEqual(frameAt(f, -5000), frameAt(f, 0));
  assert.deepEqual(frameAt(f, f.durationMs + 5000), frameAt(f, f.durationMs));
});

test('sampling is stateless — order cannot change a frame', () => {
  // The property that lets a renderer drop a frame without drifting, and lets
  // the preview tool and the encoder agree about what frame 47 contains.
  const f = film(composeSouvenir(input({ stamps: [stamp(5, 'a'), stamp(30, 'b')] })));
  const times = frameTimes(f);

  const forwards = times.map((at) => JSON.stringify(frameAt(f, at)));
  const shuffled = [...times].reverse().map((at) => JSON.stringify(frameAt(f, at)));

  assert.deepEqual(forwards, [...shuffled].reverse());
});

test('the projection fits the box inside the frame and centres what is left', () => {
  const bounds = { north: 32.7, south: 32.6, east: -16.8, west: -16.9 };
  const toPixel = projector(bounds, 1080, 1920);

  const [westX, northY] = toPixel(bounds.west, bounds.north);
  const [eastX, southY] = toPixel(bounds.east, bounds.south);

  // Nothing is cropped: every corner lands inside the frame.
  for (const value of [westX, eastX]) {
    assert.ok(value >= 0 && value <= 1080, `x out of frame: ${value}`);
  }
  for (const value of [northY, southY]) {
    assert.ok(value >= 0 && value <= 1920, `y out of frame: ${value}`);
  }

  // Latitude grows north; the frame grows down.
  assert.ok(northY < southY);
  assert.ok(westX < eastX);

  // Centred: equal margins on the axis with room to spare.
  assert.ok(Math.abs(westX - (1080 - eastX)) < 1e-6);
});

test('longitude is compressed by latitude, not used raw', () => {
  // A square in degrees is not a square on the ground at 32.65°N. Drawing it
  // as one squashes the trace east-to-west by about a sixth.
  const bounds = { north: 32.7, south: 32.6, east: -16.8, west: -16.9 };
  const toPixel = projector(bounds, 1000, 1000);

  const width = toPixel(bounds.east, bounds.south)[0] - toPixel(bounds.west, bounds.south)[0];
  const height = toPixel(bounds.west, bounds.south)[1] - toPixel(bounds.west, bounds.north)[1];

  const expected = Math.cos((32.65 * Math.PI) / 180);
  assert.ok(Math.abs(width / height - expected) < 1e-3, `got ${width / height}`);
});

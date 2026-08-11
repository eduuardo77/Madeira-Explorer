/**
 * Tests for the souvenir composition (T-105a).
 *
 *     cd app && npm test
 *
 * What is being pinned down, in order of what it would cost to get wrong:
 *
 *   1. **An unsafe trace produces no film.** This is the D-040 guard and it is
 *      the difference between a souvenir and a published address.
 *   2. **Every stamp appears.** Stamps are the reward (D-002); a crowded
 *      collection must compress, never lose one.
 *   3. **The film is bounded.** A fortnight and an afternoon must both produce
 *      something a person will watch to the end.
 *   4. **A blackout stays a blackout.** No stroke may bridge one, and the
 *      timeline must leave the pen up while it passes.
 *   5. **It is deterministic.** No clock, no randomness — the same trip is the
 *      same film, every time.
 *
 * Nothing here has been *watched*. These tests prove the arithmetic is
 * consistent; whether 350 ms is long enough to read a badge is a question only
 * T-105b and a pair of eyes can answer.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { TraceFix } from '../map/traceGeoJson.ts';
import {
  CUE_TAIL_MS,
  ESTABLISH_MS,
  FINALE_MS,
  MAX_DRAW_MS,
  MIN_CUE_GAP_MS,
  MIN_DRAW_MS,
  MIN_SPAN_DEG,
  composeSouvenir,
  type Composition,
  type DrawScene,
  type FinaleScene,
  type SouvenirInput,
  type SouvenirStamp,
} from './composition.ts';

const GAP_MS = 30 * 60 * 1000;
const T0 = 1_800_000_000_000;

function fix(minutes: number, lat: number, lon: number): TraceFix {
  return { ts: T0 + minutes * 60_000, lat, lon, accuracy_m: 10 };
}

/** A walk of `count` fixes, one a minute, drifting north-east. */
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
function film(composition: Composition) {
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

function drawScene(composition: Composition): DrawScene {
  const scene = film(composition).scenes.find((s) => s.kind === 'draw');
  assert.ok(scene !== undefined, 'no draw scene');
  return scene as DrawScene;
}

// ---------------------------------------------------------------------------
// 1. The privacy guard
// ---------------------------------------------------------------------------

test('a trace that was withheld composes to nothing at all', () => {
  const composition = composeSouvenir(
    input({
      trace: {
        fixes: walk(60),
        safeToShare: false,
        reason: 'WITHHELD: overnight data exists but no accommodation found',
      },
    })
  );

  assert.equal(composition.renderable, false);
  // The upstream reason survives, so the diary and the UI can say *why* there
  // is no video rather than showing an empty one.
  assert.match(composition.reason, /WITHHELD/);
});

test('an unsafe trace is refused even when it still carries fixes', () => {
  // The dangerous shape: masking failed but the fix list is not empty. A
  // renderer that checked `fixes.length` instead of the flag would publish it.
  const composition = composeSouvenir(
    input({
      trace: { fixes: walk(60), safeToShare: false, reason: 'export failed' },
      stamps: [stamp(10, 'a')],
    })
  );

  assert.equal(composition.renderable, false);
});

test('nothing drawable is a refusal, not an empty film', () => {
  const composition = composeSouvenir(
    input({ trace: { fixes: [], safeToShare: true, reason: 'ok' } })
  );

  assert.equal(composition.renderable, false);
  assert.match(composition.reason, /nothing drawable/);
});

test('a single fix cannot be a line, and is refused', () => {
  const composition = composeSouvenir(
    input({
      trace: { fixes: [fix(0, 32.65, -16.9)], safeToShare: true, reason: 'ok' },
    })
  );

  assert.equal(composition.renderable, false);
});

// ---------------------------------------------------------------------------
// 2. Every stamp appears
// ---------------------------------------------------------------------------

test('every stamp gets exactly one cue, in collection order', () => {
  const stamps = [stamp(50, 'c'), stamp(10, 'a'), stamp(30, 'b')];
  const draw = drawScene(composeSouvenir(input({ stamps })));

  assert.deepEqual(
    draw.cues.map((cue) => cue.placeId),
    ['a', 'b', 'c']
  );
});

test('a stamp lands where the line reaches it, not at a share of the clock', () => {
  // 60 fixes, one a minute. A stamp earned at minute 30 belongs halfway.
  const draw = drawScene(composeSouvenir(input({ stamps: [stamp(30, 'a')] })));
  const fraction = (draw.cues[0].atMs - draw.startMs) / draw.durationMs;

  assert.ok(
    Math.abs(fraction - 30 / 59) < 0.02,
    `cue landed at ${fraction.toFixed(3)} of the draw`
  );
});

test('a crowded hour keeps every stamp, spaced apart', () => {
  // Twelve stamps inside twelve minutes: Funchal on a cruise-ship day.
  const stamps: SouvenirStamp[] = [];
  for (let i = 0; i < 12; i += 1) {
    stamps.push(stamp(20 + i / 12, `p${i}`));
  }
  const draw = drawScene(composeSouvenir(input({ stamps })));

  assert.equal(draw.cues.length, 12);
  for (let i = 1; i < draw.cues.length; i += 1) {
    assert.ok(
      draw.cues[i].atMs - draw.cues[i - 1].atMs >= MIN_CUE_GAP_MS - 0.001,
      `cues ${i - 1} and ${i} are ${draw.cues[i].atMs - draw.cues[i - 1].atMs} ms apart`
    );
  }
});

test('an absurd number of stamps compresses rather than losing any', () => {
  const stamps: SouvenirStamp[] = [];
  for (let i = 0; i < 200; i += 1) {
    stamps.push(stamp(i / 4, `p${i}`));
  }
  const draw = drawScene(composeSouvenir(input({ stamps })));

  assert.equal(draw.cues.length, 200);
  assert.equal(draw.durationMs, MAX_DRAW_MS);
  for (let i = 1; i < draw.cues.length; i += 1) {
    assert.ok(draw.cues[i].atMs >= draw.cues[i - 1].atMs);
  }
});

test('no stamp lands outside the draw, or in its closing moment', () => {
  // Awards deliberately outside the drawn window at both ends — masking can
  // remove the fixes around a place without removing the stamp.
  const stamps = [stamp(-500, 'before'), stamp(30, 'during'), stamp(9_000, 'after')];
  const draw = drawScene(composeSouvenir(input({ stamps })));
  const lastAllowed = draw.startMs + draw.durationMs - CUE_TAIL_MS;

  for (const cue of draw.cues) {
    assert.ok(cue.atMs >= draw.startMs, `${cue.placeId} cued before the draw`);
    assert.ok(cue.atMs <= lastAllowed, `${cue.placeId} cued in the tail`);
  }
});

test('the collected count is the number of stamps, and the denominator is the caller’s', () => {
  const composition = composeSouvenir(
    input({ stamps: [stamp(10, 'a'), stamp(20, 'b')], totalPlaces: 180 })
  );
  const finale = film(composition).scenes.find(
    (scene) => scene.kind === 'finale'
  ) as FinaleScene;

  assert.equal(finale.collected, 2);
  // D-024: this must be the unlocked-region total the caller worked out, never
  // recomputed here from a content pack this module cannot see.
  assert.equal(finale.total, 180);
});

// ---------------------------------------------------------------------------
// 3. The film is bounded
// ---------------------------------------------------------------------------

test('an afternoon and a fortnight both produce a watchable length', () => {
  const afternoon = film(composeSouvenir(input({ trace: safe(walk(20)) })));

  // ~1400 fixes drifting 0.001 degrees apart is a few hundred kilometres.
  const fortnight = film(composeSouvenir(input({ trace: safe(walk(1_400)) })));

  const floor = ESTABLISH_MS + MIN_DRAW_MS + FINALE_MS;
  const ceiling = ESTABLISH_MS + MAX_DRAW_MS + FINALE_MS;

  assert.ok(afternoon.durationMs >= floor);
  assert.ok(afternoon.durationMs <= ceiling);
  assert.ok(fortnight.durationMs <= ceiling);
  // A longer trip must earn more screen time, or the constant is doing nothing.
  assert.ok(fortnight.durationMs > afternoon.durationMs);
});

test('the scenes are contiguous and add up to the stated duration', () => {
  const composition = film(composeSouvenir(input({ stamps: [stamp(10, 'a')] })));

  let cursor = 0;
  for (const scene of composition.scenes) {
    assert.equal(scene.startMs, cursor, `${scene.kind} does not follow on`);
    assert.ok(scene.durationMs > 0, `${scene.kind} has no duration`);
    cursor += scene.durationMs;
  }
  assert.equal(cursor, composition.durationMs);
  assert.deepEqual(
    composition.scenes.map((scene) => scene.kind),
    ['establish', 'draw', 'finale']
  );
});

test('the frame is 9:16, because that is the whole point', () => {
  const composition = film(composeSouvenir(input()));
  assert.equal(composition.heightPx / composition.widthPx, 16 / 9);
});

// ---------------------------------------------------------------------------
// 4. A blackout stays a blackout
// ---------------------------------------------------------------------------

test('a recording gap is two strokes with the pen up in between', () => {
  const fixes = [...walk(10), ...walk(10, 600)]; // ten hours of silence
  const draw = drawScene(composeSouvenir(input({ trace: safe(fixes) })));

  assert.equal(draw.segments.length, 2);
  // The hole in the timeline is the pen-lift. Closing it would mean drawing a
  // line across a road nobody proved was taken (ARCHITECTURE §10).
  assert.ok(
    draw.segments[1].startMs > draw.segments[0].endMs,
    'the second stroke starts before the first has finished'
  );
  // No coordinate is shared between the strokes.
  assert.notDeepEqual(
    draw.segments[0].coordinates[9],
    draw.segments[1].coordinates[0]
  );
});

test('the strokes fill the draw scene from its first moment to its last', () => {
  const fixes = [...walk(10), ...walk(10, 600)];
  const draw = drawScene(composeSouvenir(input({ trace: safe(fixes) })));
  const last = draw.segments[draw.segments.length - 1];

  assert.equal(draw.segments[0].startMs, draw.startMs);
  assert.equal(last.endMs, draw.startMs + draw.durationMs);
  for (const segment of draw.segments) {
    assert.ok(segment.endMs > segment.startMs);
  }
});

test('coordinates are [lon, lat], matching the map layer', () => {
  const draw = drawScene(
    composeSouvenir(input({ trace: safe([fix(0, 32.65, -16.9), fix(1, 32.66, -16.91)]) }))
  );

  assert.deepEqual(draw.segments[0].coordinates[0], [-16.9, 32.65]);
});

// ---------------------------------------------------------------------------
// The camera
// ---------------------------------------------------------------------------

test('the camera keyframes run in order across the draw', () => {
  const draw = drawScene(composeSouvenir(input()));

  assert.ok(draw.camera.length >= 2);
  assert.equal(draw.camera[0].atMs, draw.startMs);
  assert.equal(
    draw.camera[draw.camera.length - 1].atMs,
    draw.startMs + draw.durationMs
  );
  for (let i = 1; i < draw.camera.length; i += 1) {
    assert.ok(draw.camera[i].atMs > draw.camera[i - 1].atMs);
  }
});

test('the camera follows the trace rather than sitting on the whole island', () => {
  const composition = film(composeSouvenir(input({ trace: safe(walk(400)) })));
  const draw = drawScene(composition);
  const whole = composition.bounds;

  const first = draw.camera[0].bounds;
  const last = draw.camera[draw.camera.length - 1].bounds;

  // The opening frame is near the start of the walk, the closing frame near
  // its end — and neither is the full extent.
  assert.ok(first.south < last.south, 'the camera did not move');
  assert.ok(first.north - first.south < whole.north - whole.south);
});

test('a day spent in one place is still framed, not zoomed into GPS noise', () => {
  // Twenty fixes inside a few metres.
  const still: TraceFix[] = [];
  for (let i = 0; i < 20; i += 1) {
    still.push(fix(i, 32.65 + i * 0.00001, -16.9));
  }
  const composition = film(composeSouvenir(input({ trace: safe(still) })));

  // The slack is float noise in the sixteenth decimal place, not tolerance for
  // a camera that framed the wrong thing.
  const slack = 1e-9;
  assert.ok(
    composition.bounds.north - composition.bounds.south >= MIN_SPAN_DEG - slack
  );
  for (const keyframe of drawScene(composition).camera) {
    assert.ok(
      keyframe.bounds.east - keyframe.bounds.west >= MIN_SPAN_DEG - slack,
      'a keyframe framed less than the minimum span'
    );
  }
});

test('every drawn point is inside the overall bounds', () => {
  const fixes = walk(60);
  const composition = film(composeSouvenir(input({ trace: safe(fixes) })));

  for (const point of fixes) {
    assert.ok(point.lat <= composition.bounds.north);
    assert.ok(point.lat >= composition.bounds.south);
    assert.ok(point.lon <= composition.bounds.east);
    assert.ok(point.lon >= composition.bounds.west);
  }
});

// ---------------------------------------------------------------------------
// 5. Determinism
// ---------------------------------------------------------------------------

test('the same trip composes to the same film every time', () => {
  const stamps = [stamp(10, 'a'), stamp(11, 'b'), stamp(40, 'c')];

  assert.deepEqual(
    composeSouvenir(input({ stamps })),
    composeSouvenir(input({ stamps }))
  );
});

test('the order stamps arrive in does not change the film', () => {
  const stamps = [stamp(10, 'a'), stamp(30, 'b'), stamp(50, 'c')];
  const shuffled = [stamps[2], stamps[0], stamps[1]];

  assert.deepEqual(
    composeSouvenir(input({ stamps })),
    composeSouvenir(input({ stamps: shuffled }))
  );
});

test('the first and last recorded moment reach the finale unformatted', () => {
  const composition = film(composeSouvenir(input({ trace: safe(walk(60)) })));
  const finale = composition.scenes.find(
    (scene) => scene.kind === 'finale'
  ) as FinaleScene;

  // Raw milliseconds: formatting a date needs a locale, and a locale is not
  // something a pure module should reach for.
  assert.equal(finale.firstFixTs, T0);
  assert.equal(finale.lastFixTs, T0 + 59 * 60_000);
});

function safe(fixes: TraceFix[]): SouvenirInput['trace'] {
  return { fixes, safeToShare: true, reason: 'nothing to mask' };
}

/**
 * Tests for the souvenir composition (T-105a).
 *
 *     cd app && npm test
 *
 * What is being pinned down, in order of what it would cost to get wrong:
 *
 *   1. **An unsafe trace produces no film.** This is the D-040 guard and it is
 *      the difference between a souvenir and a published address.
 *   2. **The pen keeps one speed** along the road, however densely the road
 *      is drawn or however long was spent in one place (T-279).
 *   3. **The film is bounded.** A fortnight and an afternoon must both produce
 *      something a person will watch to the end.
 *   4. **A blackout stays a blackout.** No stroke may bridge one, and the
 *      timeline must leave the pen up while it passes.
 *   5. **It is deterministic.** No clock, no randomness — the same trip is the
 *      same film, every time.
 *
 * Nothing here has been *watched*. These tests prove the arithmetic is
 * consistent; `tools/film-check.mjs` measures it on a real trip.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { TraceFix } from '../map/traceGeoJson.ts';
import { REPEAT_PACE } from './penPath.ts';
import {
  ESTABLISH_MS,
  FINALE_MS,
  MAX_DRAW_MS,
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
  return { placeId: id, awardedTs: T0 + minute * 60_000 };
}

/** A straight road east along 32.65°, `points` evenly spaced from `fromLon` to `toLon`. */
function road(fromLon: number, toLon: number, points: number, fromMinute = 0): TraceFix[] {
  return Array.from({ length: points }, (_, i) =>
    fix(fromMinute + i, 32.65, fromLon + ((toLon - fromLon) * i) / (points - 1))
  );
}

/** How long the pen spends on each stroke, ms. */
function strokeTimes(draw: DrawScene): number[] {
  return draw.segments.map((segment) => segment.endMs - segment.startMs);
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
// 2. The pen keeps one speed
// ---------------------------------------------------------------------------

test('the pen keeps one speed, however densely a road is drawn', () => {
  // The same length twice: a straight stretch of two points, then a stretch of
  // fifty, as a hairpin village would be. Points once bought time.
  const draw = drawScene(
    composeSouvenir(
      input({ roads: [{ fixes: road(-16.92, -16.9, 2) }, { fixes: road(-16.9, -16.88, 50, 10) }] })
    )
  );
  const [sparse, dense] = strokeTimes(draw);
  assert.ok(Math.abs(sparse - dense) / sparse < 0.01, `${sparse.toFixed(0)} ms against ${dense.toFixed(0)} ms`);
});

test('road drawn again is drawn faster, since it shows nothing new', () => {
  // There, then back along the same road: the evening drive home.
  const there = road(-16.92, -16.88, 20);
  const back = [...there].reverse().map((point, i) => ({ ...point, ts: T0 + (100 + i) * 60_000 }));
  const draw = drawScene(composeSouvenir(input({ roads: [{ fixes: there }, { fixes: back }] })));
  const [first, again] = strokeTimes(draw);
  assert.ok(again < first * (REPEAT_PACE + 0.1), `${again.toFixed(0)} ms back against ${first.toFixed(0)} ms there`);
});

test('time spent standing in one place buys no time on screen', () => {
  // A hundred fixes at one spot, as a lunch stop is recorded, then a walk on.
  const lunch = Array.from({ length: 100 }, (_, i) => fix(i, 32.65, -16.92));
  const walkOn = road(-16.92, -16.9, 10, 100);
  const draw = drawScene(composeSouvenir(input({ roads: [{ fixes: [...lunch, ...walkOn.slice(1)] }] })));
  const times = draw.segments[0].timesMs;
  assert.equal(times[99], times[0], 'the pen moved while the phone stood still');
  assert.equal(times[times.length - 1], draw.startMs + draw.durationMs);
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
    composeSouvenir(input({ trace: safe([fix(0, 32.65, -16.9), fix(1, 32.652, -16.902)]) }))
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

// ---------------------------------------------------------------------------
// A day with no stamp (T-217, review N2). The passport asks the planner itself
// whether to offer the film (PassportScreen); this is the rule it relies on.
// ---------------------------------------------------------------------------

test('a day with no stamp still makes a film', () => {
  // The review's case: walked all day, reached none of the places.
  const composition = film(composeSouvenir(input({ stamps: [] })));
  const finale = composition.scenes.find((scene) => scene.kind === 'finale') as FinaleScene;
  assert.equal(finale.collected, 0);
});

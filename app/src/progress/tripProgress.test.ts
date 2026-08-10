/**
 * Tests for trip progress (T-072a, T-073).
 *
 *     cd app && npm test
 *
 * The one that matters most is the denominator. HANDOFF names it explicitly:
 * *"the stamp denominator must count unlocked regions only, or the headline
 * number breaks in exactly the way D-024 exists to prevent."* A user who never
 * takes the ferry must never see a total they cannot reach.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Category, ContentPack, Place } from '../content/contentPack.ts';
import { computeTripProgress, suggestNextRegion } from './tripProgress.ts';

function place(
  id: string,
  category: Category,
  regionId: string
): Place {
  return {
    id,
    name: id,
    category,
    regionId,
    geofences: [{ id, role: 'main', lat: 32.65, lon: -16.9, radiusM: 200 }],
  };
}

function pack(places: Place[]): ContentPack {
  return { formatVersion: 1, places };
}

test('the hero number counts stamps against places', () => {
  const progress = computeTripProgress(
    pack([
      place('a', 'viewpoint', 'funchal'),
      place('b', 'viewpoint', 'funchal'),
      place('c', 'beach', 'machico'),
    ]),
    new Set(['a'])
  );

  assert.equal(progress.collected, 1);
  assert.equal(progress.total, 3);
});

test('all five passport rows exist even when empty', () => {
  // A passport whose pages appear and disappear as you travel is not a
  // passport (D-027).
  const progress = computeTripProgress(
    pack([place('a', 'viewpoint', 'funchal')]),
    new Set()
  );

  assert.deepEqual(
    progress.byCategory.map((row) => row.category),
    ['viewpoint', 'levada', 'village', 'beach', 'landmark']
  );
  assert.equal(progress.byCategory[1].total, 0);
});

test('category counts track collected against total', () => {
  const progress = computeTripProgress(
    pack([
      place('v1', 'viewpoint', 'funchal'),
      place('v2', 'viewpoint', 'funchal'),
      place('l1', 'levada', 'santana'),
    ]),
    new Set(['v1', 'l1'])
  );

  const viewpoints = progress.byCategory.find((r) => r.category === 'viewpoint');
  const levadas = progress.byCategory.find((r) => r.category === 'levada');

  assert.deepEqual(
    [viewpoints?.collected, viewpoints?.total],
    [1, 2]
  );
  assert.deepEqual([levadas?.collected, levadas?.total], [1, 1]);
});

// ---------------------------------------------------------------------------
// the denominator — D-024's trap
// ---------------------------------------------------------------------------

test('a locked region is excluded from BOTH halves of the hero number', () => {
  const progress = computeTripProgress(
    pack([
      place('a', 'viewpoint', 'funchal'),
      place('b', 'beach', 'funchal'),
      place('ps1', 'beach', 'porto-santo'),
      place('ps2', 'landmark', 'porto-santo'),
    ]),
    new Set(['a']),
    new Set(['porto-santo'])
  );

  assert.equal(progress.total, 2, 'the unreachable places must not be counted');
  assert.equal(progress.collected, 1);
  assert.equal(progress.lockedRegionCount, 1);
});

test('a locked region is absent from the category rows too', () => {
  const progress = computeTripProgress(
    pack([
      place('a', 'beach', 'funchal'),
      place('ps1', 'beach', 'porto-santo'),
    ]),
    new Set(),
    new Set(['porto-santo'])
  );

  const beaches = progress.byCategory.find((r) => r.category === 'beach');
  assert.equal(beaches?.total, 1);
});

test('a stamp earned in a locked region cannot inflate the numerator', () => {
  // The arithmetic nobody should have to explain: 2 / 1.
  const progress = computeTripProgress(
    pack([
      place('a', 'viewpoint', 'funchal'),
      place('ps1', 'beach', 'porto-santo'),
    ]),
    new Set(['a', 'ps1']),
    new Set(['porto-santo'])
  );

  assert.equal(progress.collected, 1);
  assert.equal(progress.total, 1);
  assert.ok(progress.collected <= progress.total);
});

test('unlocking a region adds it to both halves', () => {
  const places = [
    place('a', 'viewpoint', 'funchal'),
    place('ps1', 'beach', 'porto-santo'),
  ];
  const awarded = new Set(['a', 'ps1']);

  const locked = computeTripProgress(pack(places), awarded, new Set(['porto-santo']));
  const unlocked = computeTripProgress(pack(places), awarded, new Set());

  assert.deepEqual([locked.collected, locked.total], [1, 1]);
  assert.deepEqual([unlocked.collected, unlocked.total], [2, 2]);
});

test('locked regions do not appear in the region list', () => {
  const progress = computeTripProgress(
    pack([
      place('a', 'viewpoint', 'funchal'),
      place('ps1', 'beach', 'porto-santo'),
    ]),
    new Set(),
    new Set(['porto-santo'])
  );

  assert.deepEqual(
    progress.byRegion.map((r) => r.regionId),
    ['funchal']
  );
});

// ---------------------------------------------------------------------------
// regions and the nudge
// ---------------------------------------------------------------------------

test('regions are ordered most-collected first, stably', () => {
  const progress = computeTripProgress(
    pack([
      place('a', 'viewpoint', 'santana'),
      place('b', 'viewpoint', 'funchal'),
      place('c', 'viewpoint', 'funchal'),
      place('d', 'viewpoint', 'calheta'),
    ]),
    new Set(['b', 'c'])
  );

  assert.deepEqual(
    progress.byRegion.map((r) => r.regionId),
    ['funchal', 'calheta', 'santana']
  );
});

test('the nudge points at the region nearest to finishing', () => {
  const progress = computeTripProgress(
    pack([
      // Funchal: 1 of 4 — started, but three to go.
      place('f1', 'viewpoint', 'funchal'),
      place('f2', 'viewpoint', 'funchal'),
      place('f3', 'viewpoint', 'funchal'),
      place('f4', 'viewpoint', 'funchal'),
      // Machico: 1 of 2 — started, and one away.
      place('m1', 'beach', 'machico'),
      place('m2', 'beach', 'machico'),
    ]),
    new Set(['f1', 'm1'])
  );

  assert.equal(suggestNextRegion(progress)?.regionId, 'machico');
});

test('nothing started means no nudge', () => {
  const progress = computeTripProgress(
    pack([place('a', 'viewpoint', 'funchal')]),
    new Set()
  );
  assert.equal(suggestNextRegion(progress), null);
});

test('everything finished means no nudge', () => {
  const progress = computeTripProgress(
    pack([place('a', 'viewpoint', 'funchal')]),
    new Set(['a'])
  );
  assert.equal(suggestNextRegion(progress), null);
});

test('an empty pack produces zeroes, not a crash', () => {
  const progress = computeTripProgress(pack([]), new Set());

  assert.equal(progress.collected, 0);
  assert.equal(progress.total, 0);
  assert.equal(progress.byCategory.length, 5);
  assert.equal(progress.byRegion.length, 0);
  assert.equal(suggestNextRegion(progress), null);
});

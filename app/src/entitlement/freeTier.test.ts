/**
 * The free tier's arithmetic, and the rule that keeps it out of the recorder.
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Category } from '../content/contentPack.ts';
import {
  FREE_STAMP_ALLOWANCE,
  GUARANTEED_CATEGORY,
  visibleStamps,
  type EarnedStamp,
} from './freeTier.ts';

const HOUR = 3_600_000;

/** `n` stamps, one an hour apart, all of one category unless told otherwise. */
function earned(n: number, category: Category = 'viewpoint', from = 0): EarnedStamp[] {
  return Array.from({ length: n }, (_, i) => ({
    placeId: `${category}-${from + i}`,
    category,
    awardedTs: (from + i) * HOUR,
  }));
}

test('everything is visible once the passport is unlocked', () => {
  const result = visibleStamps(earned(37), true);
  assert.equal(result.visible.length, 37);
  assert.deepEqual(result.locked, []);
  assert.equal(result.earnedCount, 37);
});

test('under the allowance, nothing is locked', () => {
  const result = visibleStamps(earned(4), false);
  assert.equal(result.visible.length, 4);
  assert.deepEqual(result.locked, []);
});

test('the free ten are the first ten earned', () => {
  const result = visibleStamps(earned(14), false);
  assert.deepEqual(result.visible, earned(10).map((s) => s.placeId));
  assert.equal(result.locked.length, 4);
  assert.equal(result.earnedCount, 14);
});

test('a driving day of viewpoints still gets its first levada, whenever it comes', () => {
  // Ten roadside viewpoints, then a walk on day four. This is the case the
  // exemption exists for: without it the eleventh stamp is a paywall and the
  // user has never seen what the app is actually for.
  const stamps = [...earned(10), { placeId: 'levada-late', category: 'levada' as const, awardedTs: 99 * HOUR }];
  const result = visibleStamps(stamps, false);

  assert.equal(result.visible.length, 11);
  assert.ok(result.visible.includes('levada-late'));
  assert.deepEqual(result.locked, []);
});

test('the levada is guaranteed even when it is buried behind other locked stamps', () => {
  const stamps = [
    ...earned(10),
    ...earned(5, 'village', 20),
    { placeId: 'levada-late', category: 'levada' as const, awardedTs: 99 * HOUR },
    ...earned(3, 'beach', 200),
  ];
  const result = visibleStamps(stamps, false);

  assert.equal(result.visible.length, 11);
  assert.ok(result.visible.includes('levada-late'));
  assert.equal(result.locked.length, 8);
  assert.ok(!result.locked.includes('levada-late'));
});

test('a levada inside the free ten does not also buy an eleventh stamp', () => {
  const stamps = [
    ...earned(3),
    { placeId: 'levada-early', category: 'levada' as const, awardedTs: 3.5 * HOUR },
    ...earned(10, 'village', 10),
  ];
  const result = visibleStamps(stamps, false);

  assert.equal(result.visible.length, FREE_STAMP_ALLOWANCE);
  assert.ok(result.visible.includes('levada-early'));
});

test('only the first levada is free — the second is locked like anything else', () => {
  const stamps = [
    ...earned(10),
    { placeId: 'levada-a', category: 'levada' as const, awardedTs: 50 * HOUR },
    { placeId: 'levada-b', category: 'levada' as const, awardedTs: 60 * HOUR },
  ];
  const result = visibleStamps(stamps, false);

  assert.deepEqual(result.locked, ['levada-b']);
});

test('the free tier never shows more than eleven', () => {
  const stamps = [...earned(40), ...earned(6, 'levada', 100)];
  const result = visibleStamps(stamps, false);
  assert.equal(result.visible.length, 11);
});

test('nothing earned, nothing locked', () => {
  const result = visibleStamps([], false);
  assert.deepEqual(result, { visible: [], locked: [], earnedCount: 0 });
});

test('stamps sharing a timestamp order deterministically', () => {
  // The award pass writes a trip's worth in one loop, faster than the clock
  // ticks. Without the tie-break the tenth and eleventh could swap per render.
  const same: EarnedStamp[] = Array.from({ length: 12 }, (_, i) => ({
    placeId: `place-${String(i).padStart(2, '0')}`,
    category: 'viewpoint',
    awardedTs: 1000,
  }));

  const first = visibleStamps(same, false);
  const again = visibleStamps([...same].reverse(), false);

  assert.deepEqual(first.visible, again.visible);
  assert.deepEqual(first.locked, again.locked);
});

test('the guaranteed category is the levada, and the allowance is ten', () => {
  // Both are D-072's words. If either changes, the store listing, the privacy
  // copy and `docs/marketing-plan.md` all say something untrue.
  assert.equal(FREE_STAMP_ALLOWANCE, 10);
  assert.equal(GUARANTEED_CATEGORY, 'levada');
});

/**
 * ⚠⚠ THE ONE THAT MATTERS. T-145's shape, made into a build failure.
 *
 * Gating the *award* side instead of the display would break D-072's
 * "buy later, get everything" promise with no crash and no failing assertion.
 * The only cheap defence is to forbid the dependency outright: the recorder and
 * the award pass must not know that a free tier exists.
 */
test('the recorder and the award pass never learn about the paywall', () => {
  const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  const mustNotKnow = [
    'recording/geofenceSelection.ts',
    'recording/geofenceManager.ts',
    'progress/stampAwards.ts',
    'progress/stampRules.ts',
    'progress/stampConfirmation.ts',
  ];

  for (const relative of mustNotKnow) {
    const source = readFileSync(path.join(srcRoot, relative), 'utf8');
    assert.ok(
      !/entitlement\//.test(source),
      `${relative} imports from entitlement/. Gate the DISPLAY, never the award — see D-072 and T-145.`
    );
  }
});

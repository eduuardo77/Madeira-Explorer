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
  freeLeftIn,
  freeStampsLeft,
  ISLAND_FREE_ALLOWANCE,
  GUARANTEED_CATEGORY,
  offerWithStamp,
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

test('D-109: an island with its own passport has one free stamp, apart from the five', () => {
  // Two island stamps, earned second and eighth; the main five are still five.
  const first: EarnedStamp = { placeId: 'island-beach', category: 'beach', awardedTs: 1.5 * HOUR };
  const second: EarnedStamp = { placeId: 'island-peak', category: 'viewpoint', awardedTs: 7.5 * HOUR };
  const all = [...earned(6), first, second];
  const islands = new Map([['island-beach', 'small'], ['island-peak', 'small']]);
  const result = visibleStamps(all, false, islands);
  assert.deepEqual(result.visible, ['viewpoint-0', 'viewpoint-1', 'island-beach', 'viewpoint-2', 'viewpoint-3', 'viewpoint-4']);
  assert.deepEqual(result.locked, ['viewpoint-5', 'island-peak']);
  assert.equal(result.earnedCount, 8, 'every stamp still counted as earned');
  assert.equal(freeLeftIn(all, islands, null), 0);
  assert.equal(freeLeftIn(all, islands, 'small'), 0);
  assert.equal(freeLeftIn(earned(2), islands, 'small'), ISLAND_FREE_ALLOWANCE);
  // Without the map the island stamp would take a main slot: the check moves.
  assert.ok(visibleStamps(all, false).locked.includes('viewpoint-4'));
  assert.deepEqual(visibleStamps(all, true, islands).locked, []);
});

test('D-109: the levada guarantee is the main island only', () => {
  const islandLevada: EarnedStamp = { placeId: 'island-levada', category: 'levada', awardedTs: 10 * HOUR };
  const islandFirst: EarnedStamp = { placeId: 'island-beach', category: 'beach', awardedTs: 9 * HOUR };
  const islands = new Map([['island-levada', 'small'], ['island-beach', 'small']]);
  const result = visibleStamps([...earned(5), islandFirst, islandLevada], false, islands);
  assert.deepEqual(result.locked, ['island-levada']);
});

test('D-109: an island stamp brings no offer and does not move the main ordinals', () => {
  const island: EarnedStamp = { placeId: 'island-beach', category: 'beach', awardedTs: 0.5 * HOUR };
  const all = [...earned(5), island];
  const islands = new Map([['island-beach', 'small']]);
  assert.equal(offerWithStamp('island-beach', all, false, islands), null);
  // viewpoint-2 is the third main stamp, though fourth earned.
  assert.equal(offerWithStamp('viewpoint-2', all, false, islands), freeStampsLeft(3));
});

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

test('the fifth stamp shows and the sixth locks', () => {
  // D-089 rule 2: the first five earned, of any kind. The boundary is where a
  // wrong comparison (`<=` for `<`, a stale 10) hides, so it is pinned exactly.
  const result = visibleStamps(earned(7), false);
  assert.deepEqual(result.visible, earned(5).map((s) => s.placeId));
  assert.deepEqual(result.locked, ['viewpoint-5', 'viewpoint-6']);
  assert.equal(result.earnedCount, 7);
});

test('a levada earned sixth is shown, the guaranteed extra', () => {
  // Five roadside viewpoints, then a walk. D-089 rule 3: the first levada is
  // free whenever it comes, so the free tier's largest case is six.
  const stamps = [...earned(5), { placeId: 'levada-sixth', category: 'levada' as const, awardedTs: 50 * HOUR }];
  const result = visibleStamps(stamps, false);

  assert.equal(result.visible.length, 6);
  assert.ok(result.visible.includes('levada-sixth'));
  assert.deepEqual(result.locked, []);
});

test('a driving day of viewpoints still gets its first levada, whenever it comes', () => {
  // The case the exemption exists for: without it the user meets the lock
  // having never seen what the app is actually for.
  const stamps = [
    ...earned(5),
    ...earned(5, 'village', 20),
    { placeId: 'levada-late', category: 'levada' as const, awardedTs: 99 * HOUR },
    ...earned(3, 'beach', 200),
  ];
  const result = visibleStamps(stamps, false);

  assert.equal(result.visible.length, 6);
  assert.ok(result.visible.includes('levada-late'));
  assert.equal(result.locked.length, 8);
  assert.ok(!result.locked.includes('levada-late'));
});

test('a levada earned third means the sixth stamp is locked: the guarantee only adds', () => {
  const stamps = [
    ...earned(2),
    { placeId: 'levada-early', category: 'levada' as const, awardedTs: 2.5 * HOUR },
    ...earned(5, 'village', 10),
  ];
  const result = visibleStamps(stamps, false);

  assert.equal(result.visible.length, 5);
  assert.ok(result.visible.includes('levada-early'));
  assert.deepEqual(result.locked, ['village-12', 'village-13', 'village-14']);
});

test('only the first levada is free; the second is locked like anything else', () => {
  const stamps = [
    ...earned(5),
    { placeId: 'levada-a', category: 'levada' as const, awardedTs: 50 * HOUR },
    { placeId: 'levada-b', category: 'levada' as const, awardedTs: 60 * HOUR },
  ];
  const result = visibleStamps(stamps, false);

  assert.deepEqual(result.locked, ['levada-b']);
});

test('the free tier never shows more than six', () => {
  const stamps = [...earned(40), ...earned(6, 'levada', 100)];
  const result = visibleStamps(stamps, false);
  assert.equal(result.visible.length, 6);
});

test('nothing earned, nothing locked', () => {
  const result = visibleStamps([], false);
  assert.deepEqual(result, { visible: [], locked: [], earnedCount: 0 });
});

test('stamps sharing a timestamp order deterministically across the boundary', () => {
  // The award pass writes a trip's worth in one loop, faster than the clock
  // ticks. Without the tie-break the fifth and sixth could swap per render, so
  // a stamp would appear and disappear as the user watched.
  const same: EarnedStamp[] = Array.from({ length: 7 }, (_, i) => ({
    placeId: `place-${String(i).padStart(2, '0')}`,
    category: 'viewpoint',
    awardedTs: 1000,
  }));

  const first = visibleStamps(same, false);
  const again = visibleStamps([...same].reverse(), false);

  assert.deepEqual(first.visible, ['place-00', 'place-01', 'place-02', 'place-03', 'place-04']);
  assert.deepEqual(first.visible, again.visible);
  assert.deepEqual(first.locked, again.locked);
});

test('the guaranteed category is the levada, and the allowance is five', () => {
  // Both are D-089's words (rules 2 and 3). If either changes, the store
  // listing, the unlock sheet and `docs/marketing-plan.md` say something
  // untrue, and after the public release the allowance may only go up (rule 9).
  assert.equal(FREE_STAMP_ALLOWANCE, 5);
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
    // The count behind the rank and the hero (D-075, OQ-1): it counts what was
    // collected, locked or not. Filtered through the free tier, the rank would
    // quietly stop at the allowance.
    'progress/tripProgress.ts',
  ];

  for (const relative of mustNotKnow) {
    const source = readFileSync(path.join(srcRoot, relative), 'utf8');
    assert.ok(
      !/entitlement\//.test(source),
      `${relative} imports from entitlement/. Gate the DISPLAY, never the award — see D-072 and T-145.`
    );
  }
});

test('the passport counts the free stamps down to zero, never below (D-105)', () => {
  assert.equal(freeStampsLeft(0), FREE_STAMP_ALLOWANCE);
  assert.equal(freeStampsLeft(3), 2);
  assert.equal(freeStampsLeft(5), 0);
  assert.equal(freeStampsLeft(9), 0);
});

test('the third and fifth stamps offer the unlock, by earned order, and nothing once paid (D-105)', () => {
  const five = earned(5);
  assert.deepEqual(five.map((stamp) => offerWithStamp(stamp.placeId, five, false)), [null, null, 2, null, 0]);
  assert.deepEqual(five.map((stamp) => offerWithStamp(stamp.placeId, five, true)), [null, null, null, null, null]);
  // Order is by when it was earned, not by the list it arrives in.
  assert.equal(offerWithStamp('viewpoint-2', [...five].reverse(), false), 2);
  assert.equal(offerWithStamp('missing', five, false), null);
});

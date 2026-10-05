/**
 * The numbers a new stamp's celebration shows (T-249, E2 revised).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Category } from '../content/contentPack.ts';
import { celebrationFor } from './stampCelebration.ts';

const HOUR = 3_600_000;

function earned(list: Array<[string, Category]>) {
  return list.map(([placeId, category], i) => ({ placeId, category, awardedTs: (i + 1) * HOUR }));
}

const TOTALS: Record<Category, number> = { viewpoint: 19, levada: 18, village: 19, beach: 8, landmark: 16 };
const PLACES = 80;

test('the counter goes from the count before this stamp to the count with it', () => {
  const list = earned([['a', 'viewpoint'], ['b', 'village'], ['c', 'viewpoint']]);
  const c = celebrationFor('c', list, PLACES, TOTALS);
  assert.equal(c?.collectedBefore, 2);
  assert.equal(c?.collectedAfter, 3);
  assert.equal(c?.total, 80);
});

test('the set counts this stamp and the ones of its category before it', () => {
  const list = earned([['a', 'viewpoint'], ['b', 'village'], ['c', 'viewpoint']]);
  const c = celebrationFor('c', list, PLACES, TOTALS);
  assert.equal(c?.category, 'viewpoint');
  assert.equal(c?.inCategory, 2);
  assert.equal(c?.categoryTotal, 19);
});

test('⚠ an older stamp announced late counts as it was, not as today', () => {
  // Several pop-ups can queue; each says what was true when it was earned.
  const list = earned([['a', 'viewpoint'], ['b', 'viewpoint'], ['c', 'viewpoint']]);
  const c = celebrationFor('a', list, PLACES, TOTALS);
  assert.equal(c?.collectedAfter, 1);
  assert.equal(c?.inCategory, 1);
});

test('⚠ a rank-up is reported only when this stamp crossed the line (D-078)', () => {
  const nine = earned(Array.from({ length: 9 }, (_, i) => [`v${i}`, 'viewpoint'] as [string, Category]));
  const ten = [...nine, { placeId: 'x', category: 'village' as Category, awardedTs: 10 * HOUR }];
  assert.equal(celebrationFor('x', ten, PLACES, TOTALS)?.rankUp, 'silver');
  assert.equal(celebrationFor('v8', ten, PLACES, TOTALS)?.rankUp, null);
  assert.equal(celebrationFor('v7', ten, PLACES, TOTALS)?.rankUp, null);
});

test('the first stamp of all makes the passport bronze', () => {
  assert.equal(celebrationFor('a', earned([['a', 'beach']]), PLACES, TOTALS)?.rankUp, 'bronze');
});

test('a stamp that is not in the list has nothing to celebrate', () => {
  assert.equal(celebrationFor('zzz', earned([['a', 'beach']]), PLACES, TOTALS), null);
});

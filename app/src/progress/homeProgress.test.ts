/**
 * Tests for the home map's progress strip (D-090).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { homeProgress } from './homeProgress.ts';

/** The island with no municipality started: the strip counts the island. */
const island = (collected: number, total: number) => ({ collected, total, byRegion: [] });

test('the strip shows at zero, because that is who it is for', () => {
  // The second review's N1: a new visitor at 0 stamps saw nothing to collect.
  assert.deepEqual(homeProgress(island(0, 80)), {
    collected: 0,
    total: 80,
    fraction: 0,
    region: null,
  });
});

test('the bar fills in proportion to the count', () => {
  assert.equal(homeProgress(island(20, 80))?.fraction, 0.25);
  assert.equal(homeProgress(island(80, 80))?.fraction, 1);
});

test('no strip when there is nothing to count', () => {
  // `0 / 0` reads as an error, not as a start.
  assert.equal(homeProgress(island(0, 0)), null);
  assert.equal(homeProgress(island(3, -1)), null);
  assert.equal(homeProgress(island(3, Number.NaN)), null);
});

test('the bar never runs past its track, and never goes negative', () => {
  // A place cut from the pack stays collected (D-075), so for a moment the
  // count can exceed the total.
  assert.deepEqual(homeProgress(island(83, 80)), {
    collected: 80,
    total: 80,
    fraction: 1,
    region: null,
  });
  assert.equal(homeProgress(island(-2, 80))?.fraction, 0);
  assert.equal(homeProgress(island(Number.NaN, 80))?.collected, 0);
});

test('⚠ with a municipality started, the strip counts that one (option B, 2026-09-25)', () => {
  // The one closest to finished: 2 of 4 left beats 11 of 12 left.
  const progress = {
    collected: 3,
    total: 80,
    byRegion: [
      { regionId: 'santana', collected: 1, total: 12 },
      { regionId: 'calheta', collected: 2, total: 4 },
      { regionId: 'funchal', collected: 0, total: 14 },
    ],
  };
  const names: Record<string, string> = { santana: 'Santana', calheta: 'Calheta', funchal: 'Funchal' };
  assert.deepEqual(homeProgress(progress, (id) => names[id] ?? null), {
    collected: 2,
    total: 4,
    fraction: 0.5,
    region: 'Calheta',
  });
  // Unnamed, it would be Calheta's count under the island's words: the island instead.
  assert.deepEqual(homeProgress(progress, () => null), {
    collected: 3,
    total: 80,
    fraction: 3 / 80,
    region: null,
  });
});

test('a finished municipality hands the strip back to the island', () => {
  const progress = { collected: 4, total: 80, byRegion: [{ regionId: 'calheta', collected: 4, total: 4 }] };
  assert.equal(homeProgress(progress, () => 'Calheta')?.region, null);
  assert.equal(homeProgress(progress)?.collected, 4);
});

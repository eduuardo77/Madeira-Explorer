import test from 'node:test';
import assert from 'node:assert/strict';

import { ISLAND_FREE_ALLOWANCE } from '../entitlement/freeTier.ts';
import { islandCardLine } from './islandCardLine.ts';

test('before buying, the card names the free stamp in grey, not "included" (N22)', () => {
  assert.deepEqual(islandCardLine(ISLAND_FREE_ALLOWANCE), {
    key: 'passport.island.freeLeft',
    tone: 'muted',
    count: ISLAND_FREE_ALLOWANCE,
  });
});

test('once the free stamp is used, only "the others with the passport" stays', () => {
  assert.deepEqual(islandCardLine(0), { key: 'passport.island.freeUsed', tone: 'muted' });
});

test('after buying, the island is included, as before', () => {
  assert.deepEqual(islandCardLine(null), { key: 'passport.island.included', tone: 'link' });
});

/**
 * The passport button's stamp, and the rim round it (D-083).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Category } from '../content/contentPack.ts';
import { FREE_STAMP_ALLOWANCE } from '../entitlement/freeTier.ts';
import { buttonStamp, PLACEHOLDER_ID } from './passportButton.ts';
import { designFor } from './stampArt.ts';
import { RIM_METAL_UNITS, RIM_PAD_UNITS, rimElements, rimFor } from './stampRim.ts';
import { mapChrome } from '../ui/theme.ts';
import { NIGHT_LAND } from '../map/googleNightStyle.ts';
import { TIER_METAL, TIERS } from './stampTier.ts';

const HOUR = 3_600_000;

function places(n: number, category: Category = 'viewpoint') {
  return Array.from({ length: n }, (_, i) => ({
    id: `${category}-${i}`,
    name: `Place ${category} ${i}`,
    category,
  }));
}

function awardsFor(list: { id: string }[]) {
  return list.map((place, i) => ({ placeId: place.id, awardedTs: i * HOUR }));
}

test('before the first stamp, the button shows the placeholder, uncollected', () => {
  const stamp = buttonStamp([], places(3), false, 'Passport');
  assert.equal(stamp.placeId, PLACEHOLDER_ID);
  assert.equal(stamp.name, 'Passport');
  assert.equal(stamp.collected, false);
});

test('the placeholder id is one no place may have', () => {
  // contentPack.ts rejects ids starting with `__`; this is what keeps the
  // placeholder's design and clip id from colliding with a real stamp's.
  assert.ok(PLACEHOLDER_ID.startsWith('__'));
});

test('the button shows the most recent stamp, collected', () => {
  const pack = places(3);
  const stamp = buttonStamp(awardsFor(pack), pack, false, 'Passport');
  assert.equal(stamp.placeId, 'viewpoint-2');
  assert.equal(stamp.name, 'Place viewpoint 2');
  assert.equal(stamp.collected, true);
});

test('⚠ a locked stamp is never the one on the button', () => {
  // Twelve viewpoints, unpaid: the eleventh and twelfth are locked. Showing the
  // twelfth would give away the artwork the unlock sells (D-072, D-075).
  const pack = places(FREE_STAMP_ALLOWANCE + 2);
  const stamp = buttonStamp(awardsFor(pack), pack, false, 'Passport');
  assert.equal(stamp.placeId, `viewpoint-${FREE_STAMP_ALLOWANCE - 1}`);
});

test('once unlocked, the latest stamp is shown whatever its number', () => {
  const pack = places(FREE_STAMP_ALLOWANCE + 2);
  const stamp = buttonStamp(awardsFor(pack), pack, true, 'Passport');
  assert.equal(stamp.placeId, `viewpoint-${FREE_STAMP_ALLOWANCE + 1}`);
});

test('the free levada counts as visible, so it can be the latest', () => {
  // Ten viewpoints then a levada, unpaid: the levada is the guaranteed extra.
  const pack = [...places(FREE_STAMP_ALLOWANCE), ...places(1, 'levada')];
  const stamp = buttonStamp(awardsFor(pack), pack, false, 'Passport');
  assert.equal(stamp.placeId, 'levada-0');
});

test('a stamp for a place no longer in the pack is skipped, not drawn blank', () => {
  const pack = places(2);
  const awards = [...awardsFor(pack), { placeId: 'gone', awardedTs: 99 * HOUR }];
  const stamp = buttonStamp(awards, pack, false, 'Passport');
  assert.equal(stamp.placeId, 'viewpoint-1');
});

test('no metal before the first stamp; one rim per metal after it, on either map', () => {
  assert.equal(rimFor('none', 'light'), null);
  for (const style of ['light', 'dark'] as const) {
    for (const tier of TIERS.filter((t) => t !== 'none')) {
      assert.deepEqual(rimFor(tier, style), {
        metal: TIER_METAL[tier].fill,
        metalUnits: RIM_METAL_UNITS,
        hairline: TIER_METAL[tier].ink,
      });
    }
  }
});

test('⚠ on the night map the placeholder gets a light edge, and it clears 3:1', async () => {
  // Its own border measured 2.63:1 on the night land (2026-09-22); the project
  // lead asked for the edge. The night map's own control edge, so it matches.
  const { contrastRatio } = await import('../ui/contrast.ts');
  const edge = rimFor('none', 'dark');
  assert.ok(edge !== null);
  assert.equal(edge.metal, mapChrome.dark.border);
  assert.equal(edge.hairline, null);
  assert.ok(edge.metalUnits < RIM_METAL_UNITS, 'an edge, thinner than a rank rim');
  assert.ok(
    contrastRatio(edge.metal, NIGHT_LAND) >= 3,
    `the edge measures ${contrastRatio(edge.metal, NIGHT_LAND).toFixed(2)}:1 on the night map`
  );
  // One stroke, no hairline.
  assert.equal(rimElements(designFor('x', 'levada'), edge).length, 1);
});

test('the rim follows the cut edge: hairline under metal, both wider than they show', () => {
  const design = designFor('viewpoint-0', 'viewpoint');
  const [hairline, metal] = rimElements(design, {
    metal: '#C8874A',
    metalUnits: RIM_METAL_UNITS,
    hairline: '#1C1C1E',
  });

  assert.equal(hairline.kind, 'polygon');
  assert.equal(metal.kind, 'polygon');
  if (hairline.kind !== 'polygon' || metal.kind !== 'polygon') return;

  // The stamp covers the inner half of each stroke.
  assert.equal(metal.strokeWidth, 2 * RIM_METAL_UNITS);
  assert.equal(hairline.strokeWidth, 2 * RIM_PAD_UNITS);
  assert.ok(hairline.strokeWidth > metal.strokeWidth, 'the hairline must show outside the metal');
  // Same outline for both, and it is the drawn (cut) one.
  assert.equal(hairline.points, metal.points);
  assert.equal(metal.fill, 'none');
  assert.equal(metal.strokeLinejoin, 'round');
});

test('⚠ the hairline, as drawn, stands the pale metals off the light map', async () => {
  // Measured 2026-09-22: platinum alone is 1.08:1 on Google's light land and
  // silver 1.42:1 — option 2 of the drawn five, which is why the hairline
  // exists. It is drawn at partial opacity, so measure the colour it becomes.
  const { contrastRatio } = await import('../ui/contrast.ts');
  const { RIM_HAIRLINE_OPACITY } = await import('./stampRim.ts');
  const LIGHT_LAND = '#F2EFE9';
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  const over = (ink: string, ground: string, alpha: number) =>
    '#' +
    [0, 1, 2]
      .map((i) =>
        Math.round(alpha * channel(ink, i) + (1 - alpha) * channel(ground, i))
          .toString(16)
          .padStart(2, '0')
      )
      .join('');

  for (const tier of TIERS.filter((t) => t !== 'none')) {
    const rim = rimFor(tier, 'light');
    assert.ok(rim !== null && rim.hairline !== null);
    const drawn = over(rim.hairline, LIGHT_LAND, RIM_HAIRLINE_OPACITY);
    assert.ok(
      contrastRatio(drawn, LIGHT_LAND) >= 3,
      `${tier}: the hairline measures ${contrastRatio(drawn, LIGHT_LAND).toFixed(2)}:1 on the light map`
    );
  }
});

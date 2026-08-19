/**
 * Tests for the collection's rank (T-158, D-078).
 *
 *     cd app && npm test
 *
 * What is being pinned down, in order of what it would cost to get wrong:
 *
 *   1. **Platinum means everything.** A platinum handed out at 90% is a
 *      platinum nobody believes, and it can never be taken back.
 *   2. **A rank never goes down.** Collecting more must not demote you — the
 *      obvious way to get that wrong is a threshold that runs the wrong way
 *      past the end of a small pack.
 *   3. **The metals are legible on the button they sit on**, which is the only
 *      place the rank is ever seen.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { contrastRatio } from '../ui/contrast.ts';
import { colors } from '../ui/theme.ts';
import {
  TIERS,
  TIER_METAL,
  TIER_THRESHOLDS,
  tierFor,
  toNextTier,
  type Tier,
} from './stampTier.ts';

const TOTAL = 60;

test('nothing collected is no rank, not a failed one', () => {
  assert.equal(tierFor(0, TOTAL), 'none');
  assert.equal(tierFor(-3, TOTAL), 'none');
});

test('the first stamp is bronze — the button should say something is in here', () => {
  assert.equal(tierFor(1, TOTAL), 'bronze');
  assert.equal(tierFor(9, TOTAL), 'bronze');
});

test('silver lands exactly where the free tier ends', () => {
  // D-072 gives ten stamps free. A visitor who never pays reaches silver and
  // can see gold above them — honest about what buying gets you, rather than a
  // rank invented to sit just out of reach.
  assert.equal(TIER_THRESHOLDS.silver, 10);
  assert.equal(tierFor(10, TOTAL), 'silver');
  assert.equal(tierFor(24, TOTAL), 'silver');
});

test('gold at twenty-five, and it is not platinum', () => {
  assert.equal(tierFor(25, TOTAL), 'gold');
  assert.equal(tierFor(59, TOTAL), 'gold');
});

test('platinum means everything, and only everything', () => {
  assert.equal(tierFor(59, 60), 'gold');
  assert.equal(tierFor(60, 60), 'platinum');
  // More than the pack — a stale count, a shrunken pack — is still finished.
  assert.equal(tierFor(61, 60), 'platinum');
});

test('a small pack can still be finished', () => {
  // ⚠ The regression this guards: thresholds checked *before* completion would
  // leave a five-place pack stuck at bronze forever, because 5 never reaches
  // silver. Finishing is finishing.
  assert.equal(tierFor(5, 5), 'platinum');
  assert.equal(tierFor(3, 5), 'bronze');
});

test('a rank never goes down as the collection grows', () => {
  const order = (t: Tier) => TIERS.indexOf(t);
  let previous = order('none');

  for (let collected = 0; collected <= TOTAL; collected += 1) {
    const rank = order(tierFor(collected, TOTAL));
    assert.ok(
      rank >= previous,
      `collecting ${collected} demoted the rank from ${TIERS[previous]} to ${TIERS[rank]}`
    );
    previous = rank;
  }

  assert.equal(TIERS[previous], 'platinum');
});

test('with no pack at all there is no platinum to give', () => {
  // `total` is 0 before the content pack loads. A rank of platinum on an empty
  // pack would be the app congratulating somebody for nothing.
  assert.equal(tierFor(0, 0), 'none');
  assert.equal(tierFor(3, 0), 'bronze');
});

test('how many more the next rank needs', () => {
  assert.equal(toNextTier(0, TOTAL), 1);
  assert.equal(toNextTier(1, TOTAL), 9);
  assert.equal(toNextTier(10, TOTAL), 15);
  assert.equal(toNextTier(25, TOTAL), 35);
  assert.equal(toNextTier(59, TOTAL), 1);
  assert.equal(toNextTier(60, TOTAL), null);
});

test('the distance to the next rank is never zero or negative', () => {
  for (let collected = 0; collected <= TOTAL; collected += 1) {
    const left = toNextTier(collected, TOTAL);
    if (left !== null) {
      assert.ok(left >= 1, `${collected} collected reported ${left} to go`);
    }
  }
});

test('the mark and the count stay readable on every metal', () => {
  // ⚠ This test changed the design. It first asserted the *metal* was legible
  // on the button's blue, and every metal failed — silver 1.29:1, platinum
  // 1.15:1. There is no bronze that shows up on #5AA9FF. So the metal became
  // the button's fill and the mark stayed near-black, which reads on all of
  // them. The button *is* the stamp, so the metal belongs to the whole thing.
  for (const tier of TIERS) {
    const metal = TIER_METAL[tier];
    assert.ok(metal !== undefined, `${tier} has no metal`);

    const ratio = contrastRatio(colors.actionText, metal.fill);
    assert.ok(
      ratio >= 4.5,
      `the mark scores ${ratio.toFixed(2)}:1 on ${tier} (${metal.fill}) — under 4.5:1`
    );
  }
});

test('the metals are told apart from each other', () => {
  // ⚠ Contrast is the wrong tool here and using it was a mistake: two colours
  // can differ in hue and share a luminance, which is exactly the bronze/gold
  // and silver/platinum case. What matters is whether they *look* different,
  // so this measures distance in colour, not in brightness.
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const distance = (a: string, b: string) => {
    const [r1, g1, b1] = rgb(a);
    const [r2, g2, b2] = rgb(b);
    return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
  };

  const metals: Tier[] = ['bronze', 'silver', 'gold', 'platinum'];

  for (let i = 0; i < metals.length; i += 1) {
    for (let j = i + 1; j < metals.length; j += 1) {
      const apart = distance(TIER_METAL[metals[i]].fill, TIER_METAL[metals[j]].fill);
      assert.ok(
        apart >= 40,
        `${metals[i]} and ${metals[j]} are ${apart.toFixed(0)} apart in colour — too close to tell`
      );
    }
  }
});

test('no rank is dressed as a trophy before the first stamp', () => {
  // `none` is the app's ordinary action colour. A metal here would be the app
  // congratulating somebody for having been nowhere.
  assert.equal(TIER_METAL.none.fill, colors.action);
  assert.notEqual(TIER_METAL.bronze.fill, colors.action);
});

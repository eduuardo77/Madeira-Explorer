/**
 * Font scaling for map labels (T-061).
 *
 * The tests that carry the weight are the last two: they run over the **real
 * shipped styles** and assert that every size actually moved. A style is
 * regenerated from `tiles/style/generate.mjs` whenever the cartography
 * changes, and a new expression shape would otherwise be silently left
 * unscaled — a label that quietly ignores an accessibility setting, which is
 * exactly the failure D-015 exists to prevent and exactly the kind that no
 * screenshot would reveal.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import darkStyle from '../../assets/map/dark.json' with { type: 'json' };
import lightStyle from '../../assets/map/light.json' with { type: 'json' };
import {
  applyFontScale,
  scaleTextSize,
  type StyleDocument,
} from './mapTextScale.ts';

test('a plain size is multiplied', () => {
  assert.equal(scaleTextSize(10, 1.3), 13);
  assert.equal(scaleTextSize(10, 1), 10);
});

test('a zoom interpolate scales its outputs and never its stops', () => {
  // Multiplying a zoom stop would move the zoom at which the size changes,
  // which is not a font-size change at all.
  const scaled = scaleTextSize(
    ['interpolate', ['linear'], ['zoom'], 2, 8, 15, 12],
    2
  );

  assert.deepEqual(scaled, ['interpolate', ['linear'], ['zoom'], 2, 16, 15, 24]);
});

test('a case expression scales outputs and the fallback, not conditions', () => {
  const scaled = scaleTextSize(
    ['case', ['<', ['get', 'population_rank'], 13], 8, 20],
    1.5
  );

  assert.deepEqual(scaled, [
    'case',
    ['<', ['get', 'population_rank'], 13],
    12,
    30,
  ]);
});

test('a step expression scales every output', () => {
  const scaled = scaleTextSize(['step', ['zoom'], 10, 5, 12, 10, 14], 2);
  assert.deepEqual(scaled, ['step', ['zoom'], 20, 5, 24, 10, 28]);
});

test('a match expression scales outputs and the fallback', () => {
  const scaled = scaleTextSize(
    ['match', ['get', 'kind'], 'city', 12, 'town', 10, 8],
    2
  );
  assert.deepEqual(scaled, ['match', ['get', 'kind'], 'city', 24, 'town', 20, 16]);
});

test('the real shape from the shipped style scales end to end', () => {
  // Lifted from `places_locality` — a zoom interpolate whose outputs are
  // `case` expressions keyed on population_rank. This is the shape that made
  // the obvious `["*", scale, …]` approach impossible.
  const real = [
    'interpolate',
    ['linear'],
    ['zoom'],
    2,
    ['case', ['<', ['get', 'population_rank'], 13], 8, ['>=', ['get', 'population_rank'], 13], 13, 0],
    15,
    ['case', ['<', ['get', 'population_rank'], 8], 12, ['>=', ['get', 'population_rank'], 8], 22, 0],
  ];

  const scaled = scaleTextSize(real, 2) as unknown[];

  assert.equal(scaled[3], 2, 'zoom stop must not move');
  assert.equal(scaled[5], 15, 'zoom stop must not move');
  assert.deepEqual(scaled[4], [
    'case',
    ['<', ['get', 'population_rank'], 13],
    16,
    ['>=', ['get', 'population_rank'], 13],
    26,
    0,
  ]);
});

test('a scale of 1 returns the style untouched, object identity included', () => {
  const style = lightStyle as unknown as StyleDocument;
  assert.equal(applyFontScale(style, 1), style);
});

test('a nonsense scale is ignored rather than corrupting the map', () => {
  const style = lightStyle as unknown as StyleDocument;
  for (const scale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(applyFontScale(style, scale), style, String(scale));
  }
});

/** Every number reachable inside a `text-size`, in document order. */
function sizesIn(value: unknown, into: number[] = []): number[] {
  if (typeof value === 'number') into.push(value);
  else if (Array.isArray(value)) for (const item of value) sizesIn(item, into);
  return into;
}

/** The `text-size` of every symbol layer that has one. */
function textSizes(style: StyleDocument): unknown[] {
  const layers = (style.layers ?? []) as {
    type?: unknown;
    layout?: Record<string, unknown>;
  }[];
  return layers
    .filter((l) => l.type === 'symbol' && l.layout?.['text-size'] !== undefined)
    .map((l) => l.layout!['text-size']);
}

for (const [name, style] of [
  ['light', lightStyle],
  ['dark', darkStyle],
] as const) {
  test(`${name}: every label in the shipped style has a text-size`, () => {
    const sizes = textSizes(style as unknown as StyleDocument);
    assert.ok(sizes.length > 0, 'no symbol layers found — the style changed shape');
  });

  test(`${name}: scaling the shipped style changes every size, and only sizes`, () => {
    // The regression guard. `generate.mjs` can introduce a new expression
    // shape at any time; if `scaleTextSize` does not understand it, the sizes
    // come back unchanged and the accessibility setting is silently ignored.
    const original = style as unknown as StyleDocument;
    const scaled = applyFontScale(original, 2);

    const before = textSizes(original).flatMap((v) => sizesIn(v));
    const after = textSizes(scaled).flatMap((v) => sizesIn(v));

    assert.equal(after.length, before.length, 'the expression shape changed');

    // Zoom stops and `population_rank` thresholds are numbers too and must NOT
    // move, so this asserts the *set of sizes* changed, not that every number
    // did — and that at least the font sizes doubled.
    //
    // ⚠ Counted as "neither doubled nor unchanged", not as two tallies that
    // should sum. The style's `case` expressions use `0` as a fallback, and
    // zero is its own double — so the two sets overlap and summing them
    // over-counted by exactly the number of zeroes. The first version of this
    // test failed for that reason and the code was fine.
    const wrong = before.filter(
      (n, i) => after[i] !== n * 2 && after[i] !== n
    ).length;
    const doubled = before.filter((n, i) => after[i] === n * 2 && n !== 0).length;

    assert.ok(doubled > 0, 'no size was scaled at all');
    assert.equal(wrong, 0, 'a number changed by something other than the scale');
  });
}

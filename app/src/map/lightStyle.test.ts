/**
 * The light map style and the trace over it, held to D-015 (T-060, D-026).
 *
 * WHY THIS EXISTS SEPARATELY FROM `darkStyle.test.ts`
 * ---------------------------------------------------
 * The dark style had ten contrast tests and the light style had none — and the
 * light style is **the one that matters more**. D-026 chose it as the everyday
 * map precisely because sunlight legibility is the binding constraint, and
 * sunlight is exactly where a low-contrast mark disappears. The souvenir look
 * was being held to a standard the working map was not.
 *
 * The two styles need **opposite** rules, which is why the assertions are not
 * shared: on the dark ground the trace must be the brightest thing, and on the
 * light ground it must be the darkest and heaviest (D-026, design brief §2.4).
 *
 * ⚠ **Contrast is a floor, not a verdict.** Nothing here says the map looks
 * good. T-065 — outdoors, in Funchal, at midday, held at arm's length — is the
 * only judge whose verdict counts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { contrastRatio } from '../ui/contrast.ts';
import { PLACE_MARKER_PAINT, signalColor } from './placeStyle.ts';
import { TRACE_PAINT } from './traceStyle.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

type Layer = { id: string; type: string; paint?: Record<string, unknown> };

function style(name: 'light' | 'dark'): { layers: Layer[] } {
  const file = path.resolve(here, '..', '..', 'assets', 'map', `${name}.json`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

function colour(layers: Layer[], id: string, property: string): string | null {
  const layer = layers.find((candidate) => candidate.id === id);
  const value = layer?.paint?.[property];
  return typeof value === 'string' && value.startsWith('#') ? value : null;
}

/** Every flat line colour in the basemap, so "the trace dominates" is checkable. */
function basemapLineColours(layers: Layer[]): { id: string; hex: string }[] {
  const out: { id: string; hex: string }[] = [];
  for (const layer of layers) {
    if (layer.id.startsWith('trace')) continue;
    const value = layer.paint?.['line-color'];
    if (typeof value === 'string' && value.startsWith('#')) {
      out.push({ id: layer.id, hex: value });
    }
  }
  return out;
}

const light = style('light').layers;
const GROUND = colour(light, 'earth', 'fill-color');
const WATER = colour(light, 'water', 'fill-color');

test('the light style has a ground and water to measure against', () => {
  assert.ok(GROUND !== null, 'no flat `earth` fill — the style changed shape');
  assert.ok(WATER !== null, 'no flat `water` fill — the style changed shape');
});

test('the ground is light but never pure white', () => {
  // Pure white is a screen at maximum brightness in direct sun, and it leaves
  // nowhere for a pale road to sit. The mirror of the dark style's "never
  // pure black".
  assert.notEqual(GROUND!.toLowerCase(), '#ffffff');
  assert.ok(
    contrastRatio('#ffffff', GROUND!) > 1.02,
    'the ground is indistinguishable from white'
  );
});

test('THE RULE: the trace is the most contrasty thing on the map', () => {
  // D-032 makes the trace the whole visual product of v1, and CONTEXT §6.5
  // says weight always carries part of the signal — but weight is useless if
  // something else is louder. This is the assertion that keeps the basemap
  // muted as `generate.mjs` evolves.
  const trace = contrastRatio(TRACE_PAINT.light.coreColor, GROUND!);

  let loudest = { id: 'nothing', ratio: 0 };
  for (const { id, hex } of basemapLineColours(light)) {
    const ratio = contrastRatio(hex, GROUND!);
    if (ratio > loudest.ratio) loudest = { id, ratio };
  }

  assert.ok(
    trace > loudest.ratio * 2,
    `trace ${trace.toFixed(2)}:1 is not clearly louder than ${loudest.id} at ${loudest.ratio.toFixed(2)}:1`
  );
});

test('the trace clears 3:1 against the ground it is normally drawn on', () => {
  const ratio = contrastRatio(TRACE_PAINT.light.coreColor, GROUND!);
  assert.ok(ratio >= 3, `trace over land is ${ratio.toFixed(2)}:1`);
});

test('the trace clears 3:1 over WATER, which was the case that failed', () => {
  // ⚠ The reason this test exists. The original `#c2402a` measured **2.97:1**
  // over water — under the floor, on the one mark the product is built around.
  // It is not a hypothetical case: a coastal road puts the trace on the sea,
  // and the Porto Santo ferry (D-021, in scope) puts an entire crossing there.
  const ratio = contrastRatio(TRACE_PAINT.light.coreColor, WATER!);
  assert.ok(ratio >= 3, `trace over water is only ${ratio.toFixed(2)}:1`);
});

test('in the light style the trace is DARKER than the ground, not brighter', () => {
  // D-026: "visited is brighter" holds only in the dark style. Here visited is
  // darker and heavier. A trace that got brighter than the paper would be the
  // dark style's rule applied to the wrong ground.
  const traceVsWhite = contrastRatio(TRACE_PAINT.light.coreColor, '#ffffff');
  const groundVsWhite = contrastRatio(GROUND!, '#ffffff');
  assert.ok(
    traceVsWhite > groundVsWhite,
    'the trace is not darker than the ground it sits on'
  );
});

test('the casing separates the trace without outshining it', () => {
  // The casing exists to lift the line off terrain shading. In this style it
  // is pale; what matters is that the *core* stays the thing the eye finds.
  const core = contrastRatio(TRACE_PAINT.light.coreColor, GROUND!);
  const casing = contrastRatio(TRACE_PAINT.light.casingColor, GROUND!);
  assert.ok(
    core > casing,
    `casing ${casing.toFixed(2)}:1 is louder than the core at ${core.toFixed(2)}:1`
  );
  assert.ok(
    TRACE_PAINT.light.casingWidth > TRACE_PAINT.light.coreWidth,
    'the casing must be wider than the core or it cannot outline it'
  );
});

test('roads are visible at all — never near-invisible (D-015)', () => {
  // The light style deliberately mutes roads so the trace can dominate, and a
  // road is read from its casing rather than its fill. This is the floor that
  // stops "muted" drifting into "absent".
  for (const id of ['roads_minor_casing', 'roads_major_casing_late', 'roads_highway_casing_late']) {
    const hex = colour(light, id, 'line-color');
    assert.ok(hex !== null, `${id} has no flat colour — the style changed shape`);
    const ratio = contrastRatio(hex!, GROUND!);
    assert.ok(ratio >= 1.15, `${id} is ${ratio.toFixed(2)}:1 against the ground`);
  }
});

test('a road casing is darker than its own fill, so a road reads as a line', () => {
  const fill = colour(light, 'roads_major', 'line-color');
  const casing = colour(light, 'roads_major_casing_late', 'line-color');
  assert.ok(fill !== null && casing !== null);
  assert.ok(
    contrastRatio(casing!, '#ffffff') > contrastRatio(fill!, '#ffffff'),
    'the casing is not darker than the road it outlines'
  );
});

test('sea and land are separable', () => {
  assert.ok(
    contrastRatio(WATER!, GROUND!) >= 1.3,
    `water and land are ${contrastRatio(WATER!, GROUND!).toFixed(2)}:1 apart`
  );
});

test('place labels are readable, and the island label is at least large-text readable', () => {
  // Locality names are small and must clear the 4.5:1 body-text floor. The
  // island label is large italic, so 3:1 is the right bar for it.
  for (const layer of light.filter((l) => l.type === 'symbol')) {
    const text = layer.paint?.['text-color'];
    assert.ok(typeof text === 'string', `${layer.id} has no flat text colour`);
    const floor = layer.id === 'earth_label_islands' ? 3 : 4.5;
    const ratio = contrastRatio(text as string, GROUND!);
    assert.ok(
      ratio >= floor,
      `${layer.id} is ${ratio.toFixed(2)}:1, under its ${floor}:1 floor`
    );
  }
});

// ---------------------------------------------------------------------------
// The place markers (T-115)
// ---------------------------------------------------------------------------

test('a place marker is legible, and never louder than the trace', () => {
  // The whole design rule for `placeStyle.ts`, as two numbers. Eighty markers
  // that out-shout one line would undo D-032 — the trace is the visual
  // product of v1 — and markers under 3:1 would be dust (D-015).
  const trace = contrastRatio(TRACE_PAINT.light.coreColor, GROUND!);

  for (const state of ['uncollected', 'collected'] as const) {
    const paint = PLACE_MARKER_PAINT.light[state];
    const ratio = contrastRatio(signalColor(paint, state), GROUND!);
    assert.ok(ratio >= 3, `the ${state} marker is ${ratio.toFixed(2)}:1`);
    assert.ok(
      ratio < trace,
      `the ${state} marker at ${ratio.toFixed(2)}:1 is louder than the trace at ${trace.toFixed(2)}:1`
    );
  }
});

test('collected differs from uncollected in more than colour', () => {
  // D-015's "never hue alone" rule, and here it is not optional: the band
  // between the 3:1 floor and the trace's contrast is narrow enough that the
  // two states are nearly the same grey. Shape, size and weight carry it.
  const { collected, uncollected } = PLACE_MARKER_PAINT.light;

  assert.ok(collected.radius > uncollected.radius, 'collected is not larger');
  assert.ok(
    collected.strokeWidth > uncollected.strokeWidth,
    'collected is not heavier'
  );
  // Hollow vs filled: the uncollected disc is near the ground colour, so what
  // the eye sees is a ring. This is the assertion that keeps it that way.
  const hollow = contrastRatio(uncollected.fillColor, GROUND!);
  assert.ok(hollow < 1.5, `the uncollected disc reads as filled at ${hollow.toFixed(2)}:1`);
  assert.ok(
    contrastRatio(collected.fillColor, GROUND!) >= 3,
    'the collected disc does not read as filled'
  );
});

test('in the light style a collected marker is DARKER than the ground', () => {
  // The same inversion as the trace: design brief §2.4 makes visited darker
  // and heavier here, brighter and heavier on the dark style.
  assert.ok(
    contrastRatio(PLACE_MARKER_PAINT.light.collected.fillColor, '#ffffff') >
      contrastRatio(GROUND!, '#ffffff'),
    'the collected marker is not darker than the ground'
  );
});

test('the two styles paint the markers differently, for the same reason as the trace', () => {
  assert.notEqual(
    PLACE_MARKER_PAINT.light.collected.fillColor,
    PLACE_MARKER_PAINT.dark.collected.fillColor
  );
  assert.notEqual(
    PLACE_MARKER_PAINT.light.uncollected.strokeColor,
    PLACE_MARKER_PAINT.dark.uncollected.strokeColor
  );
});

test('the two styles paint the trace differently, and that is the point', () => {
  // If these ever converge, one of the two grounds is being ignored — which is
  // exactly the defect T-060 found: one colour used for both, scoring 2.70:1
  // on the dark ground with a casing brighter than the line.
  assert.notEqual(TRACE_PAINT.light.coreColor, TRACE_PAINT.dark.coreColor);
  assert.notEqual(TRACE_PAINT.light.casingColor, TRACE_PAINT.dark.casingColor);
});

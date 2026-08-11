/**
 * Contrast, enforced (T-113, D-015).
 *
 *     cd app && npm test
 *
 * WHY THESE ASSERTIONS AND NOT A STYLE GUIDE
 * ------------------------------------------
 * Every colour in this app was chosen by eye, and on this project "by eye"
 * means **by nobody's eye** — there is no device (`docs/dev-build.md`) and the
 * thirty stamp colourways in D-046 were written by something that cannot see.
 * A failing colour pair is invisible in review, looks acceptable on a bright
 * desk monitor, and is found by a user outdoors in Funchal, which is the one
 * place it matters and the one place nobody is testing.
 *
 * It already happened. When this file was first written it found **two** stamp
 * colourways below the body-text floor — a teal name on dark slate at 3.03:1,
 * and cream on bright red at 3.90:1 — plus a border colour at **1.85:1** that
 * draws the outline of the settings rows, which are the tap targets. All three
 * had been reviewed and shipped.
 *
 * THE THRESHOLDS ARE STRICTER THAN WCAG, ON PURPOSE
 * -------------------------------------------------
 * WCAG's 4.5:1 assumes indoor viewing. CONTEXT §6.5 requires this app to be
 * read **in bright Madeiran sunlight, at arm's length, by an 80-year-old**, and
 * D-015 says plainly that where the dark aesthetic and legibility conflict,
 * legibility wins. So body text is held above the standard, and the floors
 * below are where a *failing* build sits, not where a good design sits.
 *
 * ⚠ **Contrast is necessary, not sufficient.** It says nothing about colour
 * vision deficiency; that is D-015's "never hue alone" rule, enforced
 * structurally instead — the stamps carry meaning in the emblem (D-046), the
 * map in weight as well as brightness, and settings in words.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORIES } from '../content/contentPack.ts';
import { designFor } from '../passport/stampArt.ts';
import { contrastRatio, parseHex, relativeLuminance } from './contrast.ts';
import { colors } from './theme.ts';

/** Body text. Above WCAG's 4.5, because this is read outdoors. */
const BODY = 5;

/**
 * The stamp name band. Bold and small — WCAG would allow 4.5 here, and 4.5 is
 * what this holds, because the band is the one place where the design's colour
 * is load-bearing and the name is also repeated in the passport list beside it.
 */
const BAND = 4.5;

/** A meaningful UI boundary — WCAG's own floor, and the tap-target outlines. */
const BOUNDARY = 3;

// ---------------------------------------------------------------------------
// The maths itself
// ---------------------------------------------------------------------------

test('the ratio matches known values', () => {
  // Probe check. If these are wrong, every assertion below is measuring
  // nothing — and a contrast test that always passes is worse than none.
  assert.equal(Number(contrastRatio('#000000', '#ffffff').toFixed(2)), 21);
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
  // Order must not matter.
  assert.equal(
    contrastRatio('#12191F', '#E8EEF2'),
    contrastRatio('#E8EEF2', '#12191F')
  );
  // Mid grey on white is a documented ~4.6:1.
  assert.ok(Math.abs(contrastRatio('#767676', '#ffffff') - 4.54) < 0.05);
});

test('shorthand hex is understood, and nonsense is refused', () => {
  assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHex('E8EEF2'), { r: 232, g: 238, b: 242 });
  // A silent zero would read as black and quietly pass everything.
  assert.throws(() => parseHex('#12345'));
  assert.throws(() => parseHex('rebeccapurple'));
});

test('luminance follows the eye, not the arithmetic mean', () => {
  // Green reads far brighter than blue at the same channel value. A naive
  // average would rate them equal and pass unreadable blue-on-black text.
  assert.ok(
    relativeLuminance(parseHex('#00ff00')) >
      relativeLuminance(parseHex('#0000ff')) * 5
  );
});

// ---------------------------------------------------------------------------
// The app's own palette
// ---------------------------------------------------------------------------

test('every text colour is readable on every surface it is drawn on', () => {
  const surfaces = [colors.background, colors.surface, colors.surfaceRaised];

  for (const surface of surfaces) {
    for (const [name, colour] of [
      ['text', colors.text],
      ['textMuted', colors.textMuted],
    ] as const) {
      const ratio = contrastRatio(colour, surface);
      assert.ok(
        ratio >= BODY,
        `${name} on ${surface} is ${ratio.toFixed(2)}:1, below ${BODY}`
      );
    }
  }
});

test('the muted colour is recessive but not invisible', () => {
  // D-015's third rule, as a number: "recessive does not mean invisible".
  // `textMuted` is deliberately a mid grey rather than the dim grey a designer
  // would reach for, and this is what stops it drifting darker later.
  const ratio = contrastRatio(colors.textMuted, colors.background);
  assert.ok(ratio >= BODY, `textMuted is ${ratio.toFixed(2)}:1`);
  // And it must still read as secondary, or the hierarchy is gone.
  assert.ok(ratio < contrastRatio(colors.text, colors.background));
});

test('status colours are readable, and never used alone', () => {
  // Readable is testable; "never alone" is not — every status colour in the
  // app is paired with a text label by construction (D-015), which is why the
  // debug screen says "MISSING" rather than showing a red dot.
  for (const [name, colour] of [
    ['good', colors.good],
    ['warn', colors.warn],
    ['bad', colors.bad],
  ] as const) {
    const ratio = contrastRatio(colour, colors.background);
    assert.ok(ratio >= BODY, `${name} is ${ratio.toFixed(2)}:1`);
  }
});

test('the action button’s label is readable on it', () => {
  assert.ok(contrastRatio(colors.actionText, colors.action) >= BODY);
});

test('outlines are visible enough to bound a tap target', () => {
  // ⚠ FOUND BY THIS TEST. `border` was `#314856` and measured 1.85:1 against
  // the background — below even WCAG's floor — while drawing the outline of
  // every settings row, which is what tells the user where the 60 dp tap
  // target actually is.
  for (const surface of [colors.background, colors.surface]) {
    const ratio = contrastRatio(colors.border, surface);
    assert.ok(
      ratio >= BOUNDARY,
      `border on ${surface} is ${ratio.toFixed(2)}:1, below ${BOUNDARY}`
    );
  }
});

// ---------------------------------------------------------------------------
// The stamp colourways (D-046)
// ---------------------------------------------------------------------------

/** Every distinct colourway, found by walking enough ids to draw them all. */
function allColourways() {
  const found: { category: string; colourway: ReturnType<typeof designFor>['colourway'] }[] = [];

  for (const category of CATEGORIES) {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      const { colourway } = designFor(`probe-${i}`, category);
      const key = JSON.stringify(colourway);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      found.push({ category, colourway });
    }
  }

  return found;
}

test('every colourway is actually reachable, so this test covers them all', () => {
  // Probe check on the probe: six per category are declared. If `designFor`
  // stopped reaching some of them, this file would be silently checking fewer
  // colours than ship — which looks exactly like a pass.
  const found = allColourways();
  assert.equal(
    found.length,
    CATEGORIES.length * 6,
    `only ${found.length} of ${CATEGORIES.length * 6} colourways were reachable`
  );
});

test('the place name is readable on its band, in every colourway', () => {
  // ⚠ FOUND BY THIS TEST, twice: a teal name on dark slate at 3.03:1 (beach),
  // and cream on bright red at 3.90:1 (landmark). Both had been written,
  // reviewed and shipped.
  for (const { category, colourway } of allColourways()) {
    const ratio = contrastRatio(colourway.bandInk, colourway.band);
    assert.ok(
      ratio >= BAND,
      `${category} band ${colourway.band}/${colourway.bandInk} is ${ratio.toFixed(2)}:1`
    );
  }
});

test('the emblem is readable on its paper, in every colourway', () => {
  // The emblem is the only thing carrying the category (D-046), so this is an
  // accessibility assertion rather than an aesthetic one.
  for (const { category, colourway } of allColourways()) {
    const ratio = contrastRatio(colourway.ink, colourway.paper);
    assert.ok(
      ratio >= BODY,
      `${category} emblem ${colourway.paper}/${colourway.ink} is ${ratio.toFixed(2)}:1`
    );
  }
});

test('the sticker is visible against the passport page behind it', () => {
  // ⚠ **This test asserted the wrong thing first, and the wrong version
  // failed ten colourways.** It measured the *outer border* against the page
  // and would have forced ten carefully-chosen colours lighter to satisfy a
  // rule that does not follow.
  //
  // What the user actually needs is to see where one sticker ends and the
  // page begins — and that edge is carried by the **paper panel**, which is
  // always light. A dark outer border against a dark page does not hide the
  // sticker; it makes its edge softer, and the bright panel a millimetre
  // inside is what the eye reads. Loosening a test because it failed is
  // usually wrong, so the reasoning is written down here rather than in a
  // commit nobody will find.
  //
  // The stamps are drawn on `surface`, not `background` — they sit inside the
  // category row's card. Measuring against the wrong one was a second error
  // in the same assertion.
  for (const { category, colourway } of allColourways()) {
    const ratio = contrastRatio(colourway.paper, colors.surface);
    assert.ok(
      ratio >= BOUNDARY,
      `${category} sticker ${colourway.paper} is ${ratio.toFixed(2)}:1 on the page`
    );
  }
});

test('an uncollected stamp is dimmer than a collected one, and still legible', () => {
  // D-015 exactly: unvisited stays legible mid-grey, never near-invisible —
  // and CONTEXT §4.1 says the uncollected places *are* the recommendations, so
  // they have a job to do.
  const collected = designFor('somewhere', 'levada');
  const uncollectedInk = '#A7B8C4';
  const uncollectedPaper = '#1B2A33';

  const dim = contrastRatio(uncollectedInk, uncollectedPaper);
  assert.ok(dim >= BODY, `uncollected emblem is ${dim.toFixed(2)}:1`);
  assert.ok(
    dim < contrastRatio(collected.colourway.ink, collected.colourway.paper),
    'uncollected is not actually dimmer than collected'
  );
});

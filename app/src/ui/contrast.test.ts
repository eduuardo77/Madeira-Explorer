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
import { designFor, UNCOLLECTED } from '../passport/stampArt.ts';
import { contrastRatio, parseHex, relativeLuminance } from './contrast.ts';
import { NIGHT_LAND } from '../map/googleNightStyle.ts';
import { colors, mapChrome, settingsLight } from './theme.ts';

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

test('tinted text is readable on every surface it is a button on', () => {
  // D-054 replaced the outlined secondary buttons with iOS's plain tinted
  // text — which means this colour is now carrying an action with no fill and
  // no border behind it, and it is read as body text. It has to clear the body
  // floor on every surface a card can sit on.
  for (const surface of [
    colors.background,
    colors.surface,
    colors.surfaceRaised,
  ]) {
    const ratio = contrastRatio(colors.tint, surface);
    assert.ok(
      ratio >= BODY,
      `tint on ${surface} is ${ratio.toFixed(2)}:1, below ${BODY}`
    );
  }
});

test('the primary button is legible where Apple’s own would not be', () => {
  // ⚠ The one place D-054 refuses to copy iOS. Apple's dark-mode filled button
  // is white on systemBlue `#0A84FF`, which measures 3.65:1 — under this
  // project's floor for text read in Madeiran sun. This asserts the thing we
  // did instead is genuinely better, so nobody "corrects" it back later.
  assert.ok(contrastRatio('#FFFFFF', '#0A84FF') < BODY, 'the premise changed');
  assert.ok(
    contrastRatio(colors.actionText, colors.action) >
      contrastRatio('#FFFFFF', '#0A84FF')
  );
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
// The light settings screen (T-168, D-080)
// ---------------------------------------------------------------------------

test('every settings colour is readable on both surfaces it is drawn on', () => {
  // ⚠ This screen is the one place in the app where a colour is read on
  // **white**, and every instinct in `colors` above is calibrated for the
  // opposite. Reusing the dark palette's blue here would have shipped a
  // 2.6:1 action row — legible on a desk monitor, gone in Madeiran sun.
  for (const surface of [settingsLight.background, settingsLight.surface]) {
    for (const [name, colour] of [
      ['text', settingsLight.text],
      ['textMuted', settingsLight.textMuted],
      ['action', settingsLight.action],
      ['danger', settingsLight.danger],
    ] as const) {
      const ratio = contrastRatio(colour, surface);
      assert.ok(
        ratio >= BODY,
        `settings ${name} on ${surface} is ${ratio.toFixed(2)}:1, below ${BODY}`
      );
    }
  }
});

test('the settings blue and red are not Apple’s, and this is why', () => {
  // ⚠ Somebody will "correct" these to the system colours one day, because
  // the reference app uses them and they look right on a bright screen.
  assert.ok(contrastRatio('#007AFF', '#FFFFFF') < BODY, 'the premise changed');
  assert.ok(contrastRatio('#FF3B30', '#FFFFFF') < BODY, 'the premise changed');
  assert.ok(
    contrastRatio(settingsLight.action, settingsLight.surface) >
      contrastRatio('#007AFF', '#FFFFFF')
  );
  assert.ok(
    contrastRatio(settingsLight.danger, settingsLight.surface) >
      contrastRatio('#FF3B30', '#FFFFFF')
  );
});

test('a settings row outline can bound a tap target', () => {
  // The separators and the segmented control's edges are what tell the user
  // where the 60 dp target is — the same rule that caught `#314856` above.
  for (const surface of [settingsLight.background, settingsLight.surface]) {
    const ratio = contrastRatio(settingsLight.border, surface);
    assert.ok(
      ratio >= BOUNDARY,
      `settings border on ${surface} is ${ratio.toFixed(2)}:1, below ${BOUNDARY}`
    );
  }
});

test('the selected segment keeps its label readable', () => {
  // The tint is only half the signal (the weight is the other half, D-015),
  // but the label still has to be read on it.
  assert.ok(contrastRatio(settingsLight.text, settingsLight.selected) >= BODY);
  assert.ok(contrastRatio(settingsLight.action, settingsLight.selected) >= BODY);
});

test('the Done button’s label is readable on it', () => {
  assert.ok(
    contrastRatio(settingsLight.surface, settingsLight.action) >= BODY,
    'white on the settings blue'
  );
});

test('the light screen is genuinely light, and the dark one genuinely dark', () => {
  // A probe on the pair: if somebody ever "unifies" these two palettes, this
  // is the assertion that notices before a user does.
  assert.ok(
    relativeLuminance(parseHex(settingsLight.background)) >
      relativeLuminance(parseHex(colors.background)) * 10
  );
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
  // they have a job to do. Since D-058 they are also most of the screen for
  // most of a trip.
  //
  // ⚠ These used to be copied literals, which is why the palette could drift
  // out from under them unnoticed. It is imported now.
  const collected = designFor('somewhere', 'levada');

  const dim = contrastRatio(UNCOLLECTED.ink, UNCOLLECTED.paper);
  assert.ok(dim >= BODY, `uncollected emblem is ${dim.toFixed(2)}:1`);
  assert.ok(
    dim < contrastRatio(collected.colourway.ink, collected.colourway.paper),
    'uncollected is not actually dimmer than collected'
  );
});

test('an uncollected sticker is visible as a SHAPE on the page', () => {
  // ⚠ **The assertion that was missing, and the defect it would have caught.**
  // Every colourway was measured against the page except the uncollected one,
  // so when D-054 changed the card to a neutral grey the uncollected paper
  // ended up at 1.16:1 against it — an invisible sticker with an emblem
  // apparently floating on the card. Now that D-058 draws every place, that is
  // most of the passport.
  //
  // The *border* is what has to clear the bar, not the paper: a die-cut
  // sticker reads by its edge, and keeping the paper muted is the whole point
  // of the uncollected state.
  const edge = contrastRatio(UNCOLLECTED.border, colors.surface);
  assert.ok(
    edge >= BOUNDARY,
    `the uncollected sticker's edge is ${edge.toFixed(2)}:1 on the page`
  );
  assert.ok(
    contrastRatio(UNCOLLECTED.bandInk, UNCOLLECTED.band) >= BAND,
    'the uncollected name band is not readable'
  );
});

/**
 * The map's floating chrome (T-112).
 *
 * ⚠ These controls are the one part of the app that does **not** live on the
 * app's dark palette — they sit on whichever map the user chose, so they are
 * measured against the map, not against `colors.background`. `mapChrome` has the
 * reasoning; this holds the numbers.
 */
test('⚠ the glyph on a floating map control is readable in both map styles', () => {
  for (const style of ['light', 'dark'] as const) {
    const { surface, content } = mapChrome[style];
    const ratio = contrastRatio(content, surface);
    assert.ok(
      ratio >= BODY,
      `map chrome glyph on the ${style} map is ${ratio.toFixed(2)}:1, below ${BODY}`
    );
  }
});

test('⚠ a map control that does not contrast with its map must carry an edge or a shadow', () => {
  // Google's light land, sampled from a device screenshot 2026-08-17. White
  // chrome on it is ~1.06:1 — legible inside itself and invisible against the
  // map — which is exactly why `mapChrome.light` carries elevation. The dark
  // control has the same problem against the night ground and solves it with a
  // border. Either answer is acceptable; *neither* is not, and that is the thing
  // worth failing a build over.
  const grounds = { light: '#F2EFE9', dark: NIGHT_LAND } as const;

  for (const style of ['light', 'dark'] as const) {
    const chrome = mapChrome[style];
    const againstMap = contrastRatio(chrome.surface, grounds[style]);
    if (againstMap >= 3) {
      continue;
    }
    assert.ok(
      chrome.border !== null || chrome.elevation > 0,
      `${style} map chrome is ${againstMap.toFixed(2)}:1 against its map and has ` +
        'neither a border nor a shadow to separate it'
    );
  }
});

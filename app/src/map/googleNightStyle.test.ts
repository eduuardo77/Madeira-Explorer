/**
 * Tests for the authored night style (T-146).
 *
 *     cd app && npm test
 *
 * A map style is data handed to a native SDK that reports nothing when it does
 * not like it — a malformed rule is dropped in silence and the map comes back
 * partly styled. So what is checked here is the shape, and the two properties
 * the style exists for: the sea must not look like the land, and nothing may
 * outshine the trace.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { contrastRatio } from '../ui/contrast.ts';
import { colors } from '../ui/theme.ts';
import {
  GOOGLE_NIGHT_STYLE_JSON,
  NIGHT_LAND,
  NIGHT_STYLE_RULES,
} from './googleNightStyle.ts';
import { HIDE_GOOGLE_POIS } from './mapClutter.ts';
import { TRACE_PAINT } from './traceStyle.ts';

/** Relative luminance, the WCAG definition — the same one `contrast.ts` uses. */
function luminance(hex: string): number {
  const channel = (raw: number) => {
    const value = raw / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const int = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((int >> 16) & 255) +
    0.7152 * channel((int >> 8) & 255) +
    0.0722 * (int & 255)
  );
}

function colorFor(featureType: string, elementType: string): string | null {
  for (const rule of NIGHT_STYLE_RULES) {
    if (rule.featureType === featureType && rule.elementType === elementType) {
      const styler = rule.stylers.find((entry) => 'color' in entry);
      if (styler !== undefined) {
        return String(styler.color);
      }
    }
  }
  return null;
}

test('it is valid JSON, because the SDK is handed a string', () => {
  const parsed: unknown = JSON.parse(GOOGLE_NIGHT_STYLE_JSON);
  assert.ok(Array.isArray(parsed));
  assert.ok((parsed as unknown[]).length > 0);
});

test('every rule has stylers, or the SDK drops it in silence', () => {
  for (const rule of NIGHT_STYLE_RULES) {
    assert.ok(Array.isArray(rule.stylers), JSON.stringify(rule));
    assert.ok(rule.stylers.length > 0, JSON.stringify(rule));
    for (const styler of rule.stylers) {
      assert.equal(typeof styler, 'object');
      assert.ok(Object.keys(styler).length > 0);
    }
  }
});

test('every colour is a full six-digit hex', () => {
  // Three-digit hex and named colours are both accepted by some parsers and
  // not by this one; a rejected colour leaves that feature at its default,
  // which on a night map means one bright white shape.
  for (const rule of NIGHT_STYLE_RULES) {
    for (const styler of rule.stylers) {
      if ('color' in styler) {
        assert.match(String(styler.color), /^#[0-9a-fA-F]{6}$/);
      }
    }
  }
});

test('⚠ the sea does not look like the land', () => {
  // On an island the coastline is the orientation. This is the one distinction
  // a night style cannot afford to lose.
  const water = colorFor('water', 'geometry');
  assert.ok(water !== null);

  const base = NIGHT_STYLE_RULES.find(
    (rule) => rule.elementType === 'geometry' && rule.featureType === undefined
  );
  const land = String(base?.stylers[0].color);

  assert.notEqual(water, land);
  // Bluer, specifically: the blue channel must lead, or "dark water" just
  // reads as a second shade of charcoal.
  const blue = parseInt(water!.slice(5, 7), 16);
  const red = parseInt(water!.slice(1, 3), 16);
  assert.ok(blue > red, `water ${water} is not blue-dominant`);
});

test('⚠ nothing in the basemap outshines the trace', () => {
  // D-026's dark map exists so the trace glows on it. The ceiling is the
  // trace's own colour, not a guessed grey: if a road or a label ever gets
  // brighter than the line, the souvenir stops being a picture of where you
  // walked and becomes a picture of Madeira's roads.
  const CEILING = luminance(TRACE_PAINT.dark.coreColor);

  for (const rule of NIGHT_STYLE_RULES) {
    for (const styler of rule.stylers) {
      if ('color' in styler) {
        const value = luminance(String(styler.color));
        assert.ok(
          value <= CEILING + 0.001,
          `${String(styler.color)} is brighter than the label grey`
        );
      }
    }
  }
});

test("Google's own points of interest follow the switch, in this style too", () => {
  // ⚠ **This test used to pin the answer instead of following it**, and it was
  // the only thing in the project that did. It asserted the night style hides
  // Google's POIs full stop — written when D-052 had just deleted our own place
  // markers and the map belonged entirely to the trace.
  //
  // Two things happened after. T-153 gave the app **its own marks** for the
  // places you earned — a ring and a disc in the app's palette, tuned for
  // contrast against both grounds — so an earned place is no longer
  // indistinguishable from basemap clutter, which was the actual harm D-070
  // was written to stop. And the project lead settled the question this switch
  // was left open for (D-070 amended, 2026-08-19): **Google's POIs go back on.**
  //
  // So this now checks what `darkMode.test.ts` checks — that every style path
  // agrees with `HIDE_GOOGLE_POIS`. A switch that half-applies is worse than
  // either answer.
  const nightHidesPoi = NIGHT_STYLE_RULES.some(
    (rule) =>
      rule.featureType?.startsWith('poi') === true &&
      rule.stylers.some((styler) => styler.visibility === 'off')
  );
  assert.equal(nightHidesPoi, HIDE_GOOGLE_POIS);
});

test('⚠ the floating controls survive the night map', () => {
  // The dark map arrived on 2026-08-15 and took the settings button with it:
  // `colors.surface` measures 15.36:1 on Google's light map and **1.13:1** on
  // this land colour. The button did not fade, it vanished.
  //
  // So the dark map carries a hairline border, and this is the number that
  // says it is enough. 3:1 is the WCAG floor for a control that is not text.
  assert.ok(
    contrastRatio(colors.textMuted, NIGHT_LAND) >= 3,
    'the settings control outline is not legible on the night map'
  );

  // And the passport button, which is filled rather than outlined and is the
  // primary action — it must not need an outline to be found.
  assert.ok(
    contrastRatio(colors.action, NIGHT_LAND) >= 3,
    'the passport button does not stand off the night map'
  );
});

test('⚠ the road network is legible, or the map is a dark rectangle', () => {
  // The first version of this style used the app's near-black chrome colour
  // for land, which left roads 1.35:1 above it — texture, not roads. The
  // project lead's report was "too dark, and not like Google's dark mode".
  //
  // 1.4:1 is not a WCAG threshold; nothing here is text. It is the floor below
  // which a filled shape on a filled ground stops being separable at arm's
  // length in daylight, which is the only condition this map is used in.
  const land = String(
    NIGHT_STYLE_RULES.find(
      (rule) => rule.elementType === 'geometry' && rule.featureType === undefined
    )?.stylers[0].color
  );

  const road = colorFor('road', 'geometry');
  const major = colorFor('road.highway', 'geometry');
  assert.ok(road !== null && major !== null);

  assert.ok(
    contrastRatio(road!, land) >= 1.4,
    `roads are ${contrastRatio(road!, land).toFixed(2)}:1 on the land`
  );
  // And the motorways step above the ordinary roads, or the hierarchy that
  // makes a map readable at a glance is flat.
  assert.ok(contrastRatio(major!, land) > contrastRatio(road!, land));
});

test('⚠ the sea is darker than the land as well as bluer', () => {
  // Hue alone separates them for most people; luminance alone survives
  // sunlight and polarised sunglasses. The coastline is the orientation on an
  // island, so it has to work both ways.
  const water = colorFor('water', 'geometry');
  const land = String(
    NIGHT_STYLE_RULES.find(
      (rule) => rule.elementType === 'geometry' && rule.featureType === undefined
    )?.stylers[0].color
  );
  assert.ok(water !== null);
  assert.ok(luminance(water!) < luminance(land), 'the sea is not darker');
});

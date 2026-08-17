/**
 * Tests for the dark-map policy (T-147).
 *
 *     cd app && npm test
 *
 * Small, and worth having for one reason: the light path must never carry a
 * style JSON. Passing a style replaces Google's cartography wholesale, and the
 * failure mode of getting that wrong is a *light* map drawn with the night
 * palette — which looks like a rendering bug rather than a wiring one, and
 * nobody would think to look here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { darkMapPropsFor } from './darkMode.ts';
import { GOOGLE_NIGHT_STYLE_JSON, NIGHT_STYLE_RULES } from './googleNightStyle.ts';
import {
  ALWAYS_HIDDEN_RULES,
  HIDE_GOOGLE_POIS,
  MAP_CLUTTER_RULES,
  MAP_CLUTTER_STYLE_JSON,
} from './mapClutter.ts';

const NATIVE_WORKS = () => true;
const NATIVE_BROKEN = () => false;

test('light asks for the light map, whatever the renderer does', () => {
  for (const check of [NATIVE_WORKS, NATIVE_BROKEN]) {
    assert.equal(darkMapPropsFor('light', check).dark, false);
  }
});

test('⚠ the light map carries the clutter rules and NOT the night palette', () => {
  // This test used to assert the light path carried no style at all, and that
  // was the right guard for the wrong reason. The danger it was written for is
  // real and unchanged: the *night palette* on the light map looks like a
  // rendering bug rather than a wiring one, and nobody would think to look here.
  // What changed (2026-08-17) is that the light map now carries
  // visibility-only rules to take Google's POI pins off it — see
  // `mapClutter.ts`. So the assertion narrows from "no style" to "not that
  // style", which is what was actually meant.
  for (const check of [NATIVE_WORKS, NATIVE_BROKEN]) {
    const props = darkMapPropsFor('light', check);
    assert.equal(props.mapStyleJson, MAP_CLUTTER_STYLE_JSON);
    assert.notEqual(props.mapStyleJson, GOOGLE_NIGHT_STYLE_JSON);
  }
});

test('⚠ the clutter rules change no colour, so Google keeps drawing its own map', () => {
  // D-057 chose the platform's map to avoid owning cartography. A `color` or
  // `hue` styler here would quietly take that obligation back on, one rule at a
  // time, and the light map would drift away from the phone's other maps.
  for (const rule of MAP_CLUTTER_RULES) {
    for (const styler of rule.stylers) {
      assert.deepEqual(
        Object.keys(styler),
        ['visibility'],
        `${rule.featureType ?? 'all'} styles something other than visibility`
      );
    }
  }
});

test('⚠ where Google can draw its own dark map, it keeps its cartography', () => {
  // The project lead asked for this in as many words: *keep it OEM as possible*.
  // It still holds — the rules carried here change no colour, so Google's dark
  // palette is untouched. What it no longer gets is `undefined`, because that is
  // where light and dark came apart. See the note in `darkMode.ts`.
  const props = darkMapPropsFor('dark', NATIVE_WORKS);
  assert.equal(props.dark, true);
  assert.equal(props.mapStyleJson, MAP_CLUTTER_STYLE_JSON);
});

test('⚠⚠ LIGHT AND DARK HIDE THE SAME THINGS, on every renderer', () => {
  // The project lead's instruction, 2026-08-17: "just make sure light and dark
  // mode are the same, that's really important." It had NOT been true — the
  // light map hid Google's POI pins while the native dark map still drew them,
  // so one setting changed which product you were looking at.
  //
  // Asserted on the rules themselves rather than on the strings, because the two
  // dark paths legitimately differ in *colour* and must not differ in what is
  // *hidden*.
  const hidden = (rules: readonly { featureType?: string; elementType?: string; stylers: Record<string, string | number>[] }[]) =>
    rules
      .filter((rule) => rule.stylers.some((styler) => 'visibility' in styler))
      .map((rule) => `${rule.featureType ?? '*'}/${rule.elementType ?? '*'}=${rule.stylers.map((s) => s.visibility).join(',')}`)
      .sort();

  // ⚠ ONE named exception, and it must stay named. A road *casing* on a dark
  // ground draws as a pale outline around every street, which is a night-palette
  // problem the light map does not have. Anything else appearing in this list is
  // the two styles drifting apart again, which is what this test exists to stop.
  const NIGHT_PALETTE_ONLY = ['road/geometry.stroke=off'];

  const darkOnly = hidden(NIGHT_STYLE_RULES).filter(
    (rule) => !hidden(MAP_CLUTTER_RULES).includes(rule)
  );
  const lightOnly = hidden(MAP_CLUTTER_RULES).filter(
    (rule) => !hidden(NIGHT_STYLE_RULES).includes(rule)
  );

  assert.deepEqual(lightOnly, [], 'the light map hides something the dark map does not');
  assert.deepEqual(
    darkOnly,
    NIGHT_PALETTE_ONLY,
    'the dark map hides something the light map does not, and it is not a palette rule'
  );
});

test('⚠ the POI switch governs every path together, or none of them', () => {
  // `HIDE_GOOGLE_POIS` is one boolean because the project lead has not settled
  // whether hiding Google's POIs costs too much of the OEM feel. Whichever way it
  // goes, all three style paths must agree — a switch that half-applies is worse
  // than either answer.
  const poiRulesPresent = MAP_CLUTTER_RULES.some((rule) => rule.featureType?.startsWith('poi'));
  assert.equal(poiRulesPresent, HIDE_GOOGLE_POIS);

  const nightHidesPoi = NIGHT_STYLE_RULES.some(
    (rule) =>
      rule.featureType?.startsWith('poi') === true &&
      rule.stylers.some((styler) => styler.visibility === 'off')
  );
  assert.equal(nightHidesPoi, HIDE_GOOGLE_POIS);
});

test('⚠ the road shields stay hidden even if Google POIs come back', () => {
  // A palette finding, not a preference: on the night map the yellow ER/VR
  // shields measured as the brightest thing after the trace. It must survive the
  // switch being flipped either way, which is why it lives outside it.
  const shields = ALWAYS_HIDDEN_RULES.some(
    (rule) => rule.featureType === 'road' && rule.elementType === 'labels.icon'
  );
  assert.ok(shields);
});

test('⚠ where it cannot, ours is drawn rather than a white map', () => {
  // The legacy renderer ignores `colorScheme` in silence, so the alternative
  // to the fallback is not "slightly less OEM" — it is a bright white map for
  // somebody who chose dark.
  const props = darkMapPropsFor('dark', NATIVE_BROKEN);
  assert.equal(props.dark, true);
  assert.ok(
    props.mapStyleJson !== undefined && props.mapStyleJson.length > 0
  );
});

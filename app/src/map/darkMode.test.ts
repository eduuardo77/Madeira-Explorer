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
import { GOOGLE_NIGHT_STYLE_JSON } from './googleNightStyle.ts';
import { MAP_CLUTTER_RULES, MAP_CLUTTER_STYLE_JSON } from './mapClutter.ts';

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

test('⚠ where Google can draw its own dark map, it draws it untouched', () => {
  // The project lead asked for this in as many words: *keep it OEM as
  // possible*. Better cartography than this project will ever maintain, and it
  // changes when Google's light map changes.
  const props = darkMapPropsFor('dark', NATIVE_WORKS);
  assert.equal(props.dark, true);
  assert.equal(props.mapStyleJson, undefined);
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

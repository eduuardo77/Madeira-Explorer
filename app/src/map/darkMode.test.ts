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

const NATIVE_WORKS = () => true;
const NATIVE_BROKEN = () => false;

test('light leaves Google to draw its own map', () => {
  for (const check of [NATIVE_WORKS, NATIVE_BROKEN]) {
    const props = darkMapPropsFor('light', check);
    assert.equal(props.dark, false);
    assert.equal(props.mapStyleJson, undefined);
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

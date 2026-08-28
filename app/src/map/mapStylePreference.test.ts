/**
 * Tests for the map style preference (T-140, D-026).
 *
 *     cd app && npm test
 *
 * Two values and a fallback, which is barely worth a file — except that the
 * value lives in a **text column** and is read on the path that draws the map.
 * The failure this pins is not a wrong choice; it is a hand-edited or
 * half-written value producing a style name that does not exist, and the map
 * failing to load at all.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MAP_STYLE,
  MAP_STYLE_CHOICE_ENABLED,
  effectiveMapStyle,
  parseMapStyle,
} from './mapStylePreference.ts';

test('light is the default, and it is a deliberate choice', () => {
  // D-026: the everyday map is read outdoors in Madeiran sunlight and the light
  // style is the one tuned for that. Dark exists for the souvenir.
  assert.equal(DEFAULT_MAP_STYLE, 'light');
  assert.equal(parseMapStyle(null), 'light');
});

test('a stored choice is honoured', () => {
  assert.equal(parseMapStyle('dark'), 'dark');
  assert.equal(parseMapStyle('light'), 'light');
});

test('a corrupt value costs the preference, never the map', () => {
  // Read while drawing the map, from a text column, on a project with a debug
  // screen. Anything unrecognised must fall back rather than produce a style
  // name `buildMapStyle` cannot resolve (D-010).
  for (const raw of ['', '   ', 'DARKISH', 'nonsense', 'null', '0']) {
    assert.equal(parseMapStyle(raw), 'light', `"${raw}" did not fall back`);
  }
});

test('case and whitespace do not defeat it', () => {
  // The value is written by the app, but a debug session or a future migration
  // could reasonably produce either.
  assert.equal(parseMapStyle(' Dark '), 'dark');
  assert.equal(parseMapStyle('LIGHT'), 'light');
});

test('the map style choice is off, so the everyday map is always light', () => {
  // ⚠ This test is the switch's alarm, not its decoration. If somebody flips
  // MAP_STYLE_CHOICE_ENABLED back on, this fails and makes them look at the
  // settings section and the two screens that read the preference — which is
  // the whole set of things that have to move together.
  assert.equal(MAP_STYLE_CHOICE_ENABLED, false);
  assert.equal(effectiveMapStyle('dark'), 'light');
  assert.equal(effectiveMapStyle('light'), 'light');
});

test('a stored dark preference survives the choice being hidden', () => {
  // The override is at the point of drawing, never at the point of storing.
  // Someone who chose dark before today still has that value, and gets it back
  // the moment the choice returns — rather than having been quietly reset.
  assert.equal(parseMapStyle('dark'), 'dark');
});

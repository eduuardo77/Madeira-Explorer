/**
 * Tests for the Directions handoff URLs (T-115, D-018).
 *
 *     cd app && npm test
 *
 * These are strings handed to another application, which makes them the kind
 * of thing that is either exactly right or silently broken — a malformed
 * `geo:` URL does not throw, it opens the wrong place or nothing at all, on a
 * phone this project does not have. So the shapes are pinned here.
 *
 * The two that would actually happen in the field:
 *   - a comma decimal separator on a phone set to Portuguese;
 *   - a place name with a space or an accent in it, which is most of them.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDirectionsLinks } from './directionsLink.ts';

const TARGET = { name: 'Pico do Areeiro', lat: 32.735, lon: -16.928 };

test('android leads with directions and falls back to the place', () => {
  const links = buildDirectionsLinks(TARGET, 'android');

  assert.equal(links.length, 2);
  assert.ok(links[0].startsWith('google.navigation:'), links[0]);
  // The fallback is scheme-only and app-agnostic: OsmAnd, Organic Maps and
  // Google Maps all answer `geo:`, and none of them needs a network for it.
  assert.ok(links[1].startsWith('geo:'), links[1]);
});

test('ios leads with the Apple Maps scheme and falls back to the universal form', () => {
  const links = buildDirectionsLinks(TARGET, 'ios');

  assert.equal(links.length, 2);
  assert.ok(links[0].startsWith('maps://'), links[0]);
  assert.ok(links[1].startsWith('http://maps.apple.com/'), links[1]);
});

test('no link is an https route URL — a browser is not a maps app offline', () => {
  // The documented Google form (`https://www.google.com/maps/dir/?api=1…`)
  // falls through to a browser when the app is absent, and the browser needs a
  // network the user of this app may well not have.
  for (const platform of ['android', 'ios'] as const) {
    for (const url of buildDirectionsLinks(TARGET, platform)) {
      assert.ok(!url.includes('/maps/dir/'), url);
      assert.ok(!url.startsWith('https://'), url);
    }
  }
});

test('coordinates are plain decimals, never exponential', () => {
  // `String(0.0000004)` is `4e-7`, which every one of these schemes reads as
  // garbage. A coordinate near the equator is not a Madeira case, but the
  // formatting rule that saves it is the same one that keeps a Portuguese
  // locale from writing `32,735`.
  for (const platform of ['android', 'ios'] as const) {
    for (const url of buildDirectionsLinks(
      { name: 'x', lat: 0.0000004, lon: -16.9 },
      platform
    )) {
      assert.ok(!/e-/i.test(url), `exponent leaked into ${url}`);
      assert.ok(url.includes('0.000000'), url);
    }
  }
});

test('six decimals of precision, which is finer than any geofence in the pack', () => {
  const [navigation] = buildDirectionsLinks(TARGET, 'android');
  assert.equal(navigation, 'google.navigation:q=32.735000,-16.928000');
});

test('the place name is encoded, so spaces and accents survive', () => {
  const links = buildDirectionsLinks(
    { name: 'Ponta de São Lourenço', lat: 32.74, lon: -16.69 },
    'android'
  );

  assert.ok(links[1].includes('(Ponta%20de%20S%C3%A3o%20Louren%C3%A7o)'), links[1]);
  assert.ok(!links[1].includes(' '), 'a raw space would truncate the label');
});

test('a name with a parenthesis cannot break out of the geo: label', () => {
  const [, geo] = buildDirectionsLinks(
    { name: 'Somewhere (old)', lat: 32.7, lon: -16.9 },
    'android'
  );
  // ⚠ `encodeURIComponent` leaves parentheses alone, and `geo:` uses them as
  // the label's delimiters — so exactly one pair may survive, and it must be
  // ours. Without the extra escaping this reads four.
  assert.equal((geo.match(/\(/g) ?? []).length, 1);
  assert.equal((geo.match(/\)/g) ?? []).length, 1);
  assert.ok(geo.endsWith('(Somewhere%20%28old%29)'), geo);
});

test('an unusable coordinate yields no links at all', () => {
  // The caller must read this as "no Directions button", not as an error to
  // put in front of the user.
  assert.deepEqual(buildDirectionsLinks({ name: 'x', lat: 999, lon: 0 }, 'ios'), []);
  assert.deepEqual(
    buildDirectionsLinks({ name: 'x', lat: Number.NaN, lon: 0 }, 'android'),
    []
  );
});

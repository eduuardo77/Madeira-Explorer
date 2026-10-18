/**
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { backTarget, keepsMapMounted, keepsPassportMounted } from './backNavigation.ts';

test('T-211: Back goes one step towards the map, and the map lets the OS have it', () => {
  assert.equal(backTarget('settings'), 'map');
  assert.equal(backTarget('passport'), 'map');
  assert.equal(backTarget('debug'), 'map');
  assert.equal(backTarget('replay'), 'passport');
  assert.equal(backTarget('timelapse'), 'replay');
  assert.equal(backTarget('map'), null);
});

test('the map stays alive under Settings and the passport, not under screens with maps of their own', () => {
  for (const screen of ['map', 'settings', 'passport', 'debug'] as const) {
    assert.equal(keepsMapMounted(screen), true, screen);
  }
  assert.equal(keepsMapMounted('replay'), false);
  assert.equal(keepsMapMounted('timelapse'), false);
});

test('the passport is built when first opened, then kept under every screen', () => {
  assert.equal(keepsPassportMounted('map', false), false, 'not before it is asked for');
  assert.equal(keepsPassportMounted('passport', false), true);
  for (const screen of ['map', 'settings', 'replay', 'timelapse', 'debug'] as const) {
    assert.equal(keepsPassportMounted(screen, true), true, screen);
  }
});

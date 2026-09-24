/**
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { backTarget } from './backNavigation.ts';

test('T-211: Back goes one step towards the map, and the map lets the OS have it', () => {
  assert.equal(backTarget('settings'), 'map');
  assert.equal(backTarget('passport'), 'map');
  assert.equal(backTarget('debug'), 'map');
  assert.equal(backTarget('replay'), 'passport');
  assert.equal(backTarget('map'), null);
});

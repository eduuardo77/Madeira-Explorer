import assert from 'node:assert/strict';
import { test } from 'node:test';

import { showsMyLocation } from './myLocation.ts';

test('the blue dot needs a granted location permission (N23)', () => {
  assert.equal(showsMyLocation('always'), true);
  assert.equal(showsMyLocation('while_using'), true);
  assert.equal(showsMyLocation('denied'), false);
  assert.equal(showsMyLocation('undetermined'), false);
});

test('the blue dot stays off until the permission has been read', () => {
  assert.equal(showsMyLocation(null), false);
  assert.equal(showsMyLocation(undefined), false);
});

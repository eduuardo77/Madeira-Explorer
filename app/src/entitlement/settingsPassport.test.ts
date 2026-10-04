/**
 * The Settings rows for the passport (T-156e).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { passportSettings } from './settingsPassport.ts';

test('locked: unlock, and recover a purchase made elsewhere', () => {
  assert.deepEqual(passportSettings({ unlocked: false, beta: false }), {
    rows: ['unlock', 'recover'],
    footnote: 'locked',
  });
});

test('unlocked: only recover, which is always offered', () => {
  // A new phone, or after erase-all: the row that asks Google again (OQ-7).
  assert.deepEqual(passportSettings({ unlocked: true, beta: false }), {
    rows: ['recover'],
    footnote: 'unlocked',
  });
});

test('⚠ a beta build shows no passport group at all (D-084)', () => {
  // The beta is unlocked and has nothing to sell; a Buy row there would be a lie.
  assert.equal(passportSettings({ unlocked: true, beta: true }), null);
  assert.equal(passportSettings({ unlocked: false, beta: true }), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { replicaOverflows } from './replicaFit.ts';

test('the replica goes dense when the words overflow the card (N18)', () => {
  // The emulator, 360 × 780 dp: the scrolling area about 520 dp, the words about 540.
  assert.equal(replicaOverflows(520, 540, 8), true);
  assert.equal(replicaOverflows(520, 500, 8), false);
  assert.equal(replicaOverflows(520, 504, 8), false, 'exactly fitting is fitting');
});

test('nothing goes dense before the card has been measured', () => {
  assert.equal(replicaOverflows(0, 540, 8), false);
  assert.equal(replicaOverflows(520, 0, 8), false);
});

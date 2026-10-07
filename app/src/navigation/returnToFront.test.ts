import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isReturnToFront } from './returnToFront.ts';

test('T-273: "active" while already active is the launch, not a return', () => {
  assert.equal(isReturnToFront('active', 'active'), false);
});

test('T-273: back from the background, or from a dialog, is a return', () => {
  assert.equal(isReturnToFront('background', 'active'), true);
  assert.equal(isReturnToFront('inactive', 'active'), true);
});

test('T-273: started in the background and then opened is a return (T-212)', () => {
  assert.equal(isReturnToFront('unknown', 'active'), true);
});

test('T-273: leaving the front is never a return', () => {
  assert.equal(isReturnToFront('active', 'background'), false);
  assert.equal(isReturnToFront('background', 'background'), false);
});

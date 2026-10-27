import test from 'node:test';
import assert from 'node:assert/strict';

import { stacksNudgeButton } from './textScale.ts';

test('the unlock card keeps its button beside the words at normal text', () => {
  assert.equal(stacksNudgeButton(1), false);
  assert.equal(stacksNudgeButton(1.1), false);
});

test('the unlock card puts its button under the words at 130% and 160% (N16)', () => {
  assert.equal(stacksNudgeButton(1.3), true);
  assert.equal(stacksNudgeButton(1.6), true);
  assert.equal(stacksNudgeButton(2), true);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasLaunchManager } from './launchManager.ts';

test('T-258: Huawei and Honor, as Android reports them, have the launch manager', () => {
  assert.equal(hasLaunchManager('HUAWEI'), true);
  assert.equal(hasLaunchManager('Huawei'), true);
  assert.equal(hasLaunchManager('HONOR'), true);
});

test('T-258: other phones, or none known, are not told about it', () => {
  assert.equal(hasLaunchManager('samsung'), false);
  assert.equal(hasLaunchManager('Google'), false);
  assert.equal(hasLaunchManager(''), false);
  assert.equal(hasLaunchManager(undefined), false);
});

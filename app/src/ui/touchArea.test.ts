import test from 'node:test';
import assert from 'node:assert/strict';

import { growTouch, MEASURED_TARGET } from './touchArea.ts';

test('the four small controls of the 27 Oct review reach 48 dp (N27)', () => {
  // Measured on the P30: the gold badge 19 × 22, See all 19 tall, the trip link 31, the switch 32.
  for (const [height, width] of [[22, 19], [19, undefined], [31, undefined], [32, undefined]] as const) {
    const growth = growTouch(height, width);
    assert.ok(height + 2 * growth.paddingVertical >= MEASURED_TARGET, `height ${height}`);
    if (width !== undefined) assert.ok(width + 2 * growth.paddingHorizontal >= MEASURED_TARGET, `width ${width}`);
  }
});

test('the growth gives its space back, so nothing moves', () => {
  const growth = growTouch(19, 22);
  assert.equal(growth.paddingVertical + growth.marginVertical, 0);
  assert.equal(growth.paddingHorizontal + growth.marginHorizontal, 0);
});

test('a control already big enough is left alone', () => {
  assert.deepEqual(growTouch(60, 60), { paddingVertical: 0, marginVertical: 0, paddingHorizontal: 0, marginHorizontal: 0 });
});

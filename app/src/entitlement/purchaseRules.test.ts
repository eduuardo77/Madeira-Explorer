/**
 * The purchase rules (T-156a, D-089, D-091).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decidePurchases, type StorePurchase } from './purchaseRules.ts';

const OURS = 'passport_test';
const DAY = 86_400_000;

/** A purchase of our product, bought and acknowledged, unless told otherwise. */
function purchase(overrides: Partial<StorePurchase> = {}): StorePurchase {
  return {
    productId: OURS,
    state: 'purchased',
    purchaseTimeMs: 10 * DAY,
    acknowledged: true,
    ...overrides,
  };
}

test('no purchases: locked, nothing pending, nothing to acknowledge', () => {
  assert.deepEqual(decidePurchases([], OURS), {
    unlocked: false,
    pending: false,
    toAcknowledge: [],
    purchaseTimeMs: null,
  });
});

test('a purchase of our product unlocks and keeps its time', () => {
  const decision = decidePurchases([purchase()], OURS);
  assert.equal(decision.unlocked, true);
  assert.equal(decision.pending, false);
  assert.equal(decision.purchaseTimeMs, 10 * DAY);
});

test('only our product ID counts', () => {
  const decision = decidePurchases(
    [purchase({ productId: 'passport_elsewhere', acknowledged: false })],
    OURS
  );
  assert.equal(decision.unlocked, false);
  assert.equal(decision.purchaseTimeMs, null);
  // Not ours to acknowledge either: another product is another app's business.
  assert.deepEqual(decision.toAcknowledge, []);
});

test('a pending purchase never unlocks, and says it is pending', () => {
  const decision = decidePurchases([purchase({ state: 'pending', acknowledged: false })], OURS);
  assert.equal(decision.unlocked, false);
  assert.equal(decision.pending, true);
  assert.equal(decision.purchaseTimeMs, null);
  // Google refuses to acknowledge a pending purchase; only a purchased one is.
  assert.deepEqual(decision.toAcknowledge, []);
});

test('an unknown state neither unlocks nor reads as pending', () => {
  const decision = decidePurchases([purchase({ state: 'unknown', acknowledged: false })], OURS);
  assert.equal(decision.unlocked, false);
  assert.equal(decision.pending, false);
  assert.deepEqual(decision.toAcknowledge, []);
});

test('⚠ an unacknowledged purchase is always passed on to be acknowledged', () => {
  // Google refunds a purchase nobody acknowledges within three days, so a
  // missed one costs the sale silently (§4.3 of the execution plan).
  const unacknowledged = purchase({ acknowledged: false });
  const decision = decidePurchases([unacknowledged], OURS);
  assert.equal(decision.unlocked, true);
  assert.deepEqual(decision.toAcknowledge, [unacknowledged]);
});

test('an acknowledged purchase is not acknowledged twice', () => {
  assert.deepEqual(decidePurchases([purchase()], OURS).toAcknowledge, []);
});

test('the adapter gets back its own objects, so it can acknowledge without this module seeing a token', () => {
  const withToken = { ...purchase({ acknowledged: false }), token: 'opaque' };
  const [returned] = decidePurchases([withToken], OURS).toAcknowledge;
  assert.equal(returned, withToken);
  assert.equal(returned.token, 'opaque');
});

test('a completed purchase wins over a pending one, and the pending one is not reported', () => {
  const decision = decidePurchases(
    [purchase({ state: 'pending', purchaseTimeMs: 2 * DAY }), purchase({ purchaseTimeMs: 5 * DAY })],
    OURS
  );
  assert.equal(decision.unlocked, true);
  assert.equal(decision.pending, false);
  // A pending purchase is not a purchase yet, so its time is not the purchase time.
  assert.equal(decision.purchaseTimeMs, 5 * DAY);
});

test('the earliest purchase time wins when there are several', () => {
  const decision = decidePurchases(
    [purchase({ purchaseTimeMs: 9 * DAY }), purchase({ purchaseTimeMs: 3 * DAY }), purchase({ purchaseTimeMs: 6 * DAY })],
    OURS
  );
  assert.equal(decision.purchaseTimeMs, 3 * DAY);
});

test('a purchase with no usable time still unlocks, and its time is not invented', () => {
  // The founder stamp (T-233) reads this time. A missing one must not become
  // NaN, zero or "now": zero would make every such buyer a founder.
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0]) {
    const decision = decidePurchases([purchase({ purchaseTimeMs: bad })], OURS);
    assert.equal(decision.unlocked, true, `time ${bad}`);
    assert.equal(decision.purchaseTimeMs, null, `time ${bad}`);
  }
  const mixed = decidePurchases(
    [purchase({ purchaseTimeMs: Number.NaN }), purchase({ purchaseTimeMs: 7 * DAY })],
    OURS
  );
  assert.equal(mixed.purchaseTimeMs, 7 * DAY);
});

test('pure: imports nothing but types', () => {
  // No expo-iap, React Native, storage or i18n (T-156a). Only this half can be
  // tested without a phone, which is the reason it is a module of its own.
  const source = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'purchaseRules.ts'),
    'utf8'
  );
  const imports = source.match(/^import .*$/gm) ?? [];
  for (const line of imports) {
    assert.match(line, /^import type /, `purchaseRules.ts has a runtime import: ${line}`);
  }
});

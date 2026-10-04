/**
 * The order of operations for a purchase (T-156c, plan §4.3).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { applyStoreAnswer } from './purchaseFlow.ts';
import { decidePurchases, type PurchaseDecision, type StorePurchase } from './purchaseRules.ts';

const OURS = 'passport_test';

function purchase(acknowledged: boolean, state: StorePurchase['state'] = 'purchased'): StorePurchase {
  return { productId: OURS, state, purchaseTimeMs: 1_000, acknowledged };
}

/** Fakes that write every call into one log, so the order can be read back. */
function fakes(options: { recordFails?: boolean; acknowledgeFails?: boolean } = {}) {
  const log: string[] = [];
  return {
    log,
    deps: {
      record: async (decision: PurchaseDecision<StorePurchase>) => {
        log.push(`record unlocked=${decision.unlocked}`);
        if (options.recordFails) throw new Error('disk full');
      },
      acknowledge: async (_p: StorePurchase) => {
        log.push('acknowledge');
        return !options.acknowledgeFails;
      },
    },
  };
}

test('⚠ the unlock is saved before Google is told, never after', () => {
  // Killed between the two, a paying user is still unlocked, and the next
  // launch finds the purchase unacknowledged and acknowledges it.
  const { log, deps } = fakes();
  return applyStoreAnswer([purchase(false)], OURS, deps).then(() => {
    assert.deepEqual(log, ['record unlocked=true', 'acknowledge']);
  });
});

test('⚠ if saving fails, nothing is acknowledged', async () => {
  // Acknowledged but not saved would be paid and locked until the next query.
  const { log, deps } = fakes({ recordFails: true });
  await assert.rejects(applyStoreAnswer([purchase(false)], OURS, deps));
  assert.deepEqual(log, ['record unlocked=true']);
});

test('every unacknowledged purchase is acknowledged, and an acknowledged one is not', async () => {
  const { log, deps } = fakes();
  await applyStoreAnswer([purchase(false), purchase(true), purchase(false)], OURS, deps);
  assert.equal(log.filter((line) => line === 'acknowledge').length, 2);
});

test('a failed acknowledgement does not throw; the next query retries it', async () => {
  const { deps } = fakes({ acknowledgeFails: true });
  const result = await applyStoreAnswer([purchase(false)], OURS, deps);
  assert.equal(result.acknowledgeFailures, 1);
  assert.equal(result.decision.unlocked, true);
});

test('an empty answer is still recorded, because the store decides what it may change', async () => {
  // entitlementStore merges it (mergeEntitlement) and never applies a lock over an unlock.
  const { log, deps } = fakes();
  const result = await applyStoreAnswer([], OURS, deps);
  assert.deepEqual(log, ['record unlocked=false']);
  assert.deepEqual(result.decision, decidePurchases([], OURS));
});

test('a pending purchase is reported and never acknowledged', async () => {
  const { log, deps } = fakes();
  const result = await applyStoreAnswer([purchase(false, 'pending')], OURS, deps);
  assert.equal(result.decision.pending, true);
  assert.ok(!log.includes('acknowledge'));
});

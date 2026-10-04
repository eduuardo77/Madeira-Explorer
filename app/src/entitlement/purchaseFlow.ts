/**
 * The order of operations when Google reports purchases (T-156c, plan §4.3).
 *
 * 1. Decide what the purchases mean (`purchaseRules`).
 * 2. **Save the result on the phone first.**
 * 3. **Then acknowledge** each purchase that needs it.
 *
 * Why save first: if the app dies between the two, the user is unlocked and
 * the next query finds the purchase unacknowledged and acknowledges it. The
 * other order could leave a paying user locked until the next query. Both
 * recover; only this one never leaves a paying user locked.
 *
 * The store and the database are passed in, so the order itself is tested in
 * Node (`purchaseFlow.test.ts`). `billingSync.ts` passes the real ones.
 */

import { decidePurchases, type PurchaseDecision, type StorePurchase } from './purchaseRules.ts';

export interface PurchaseFlowDeps<P extends StorePurchase> {
  /** Save the decision. Throws if it could not be saved. */
  record: (decision: PurchaseDecision<P>) => Promise<void>;
  /** Acknowledge one purchase, as non-consumable. False if Google refused. */
  acknowledge: (purchase: P) => Promise<boolean>;
}

export interface PurchaseFlowResult<P extends StorePurchase> {
  decision: PurchaseDecision<P>;
  /** Left unacknowledged; the next query finds them again and retries. */
  acknowledgeFailures: number;
}

export async function applyStoreAnswer<P extends StorePurchase>(
  purchases: readonly P[],
  productId: string,
  deps: PurchaseFlowDeps<P>
): Promise<PurchaseFlowResult<P>> {
  const decision = decidePurchases(purchases, productId);
  // A failed save throws here, before anything is acknowledged.
  await deps.record(decision);

  let acknowledgeFailures = 0;
  for (const purchase of decision.toAcknowledge) {
    if (!(await deps.acknowledge(purchase))) acknowledgeFailures += 1;
  }
  return { decision, acknowledgeFailures };
}

/**
 * What Google's list of purchases means for this phone (T-156a, D-089, D-091).
 *
 * The store adapter (`storeBilling.ts`, T-156b) asks Google which purchases the
 * account owns and turns each into a `StorePurchase`. This module decides what
 * that list means; `billingSync.ts` (T-156c) applies the decision: it saves the
 * unlock through `entitlementStore` **first**, then acknowledges.
 *
 * THE RULES
 * ---------
 * - **Only our product counts.** The ID comes from `content/` (D-017), so it is
 *   a parameter, never a literal here.
 * - **A pending purchase never unlocks.** Cash at a shop or a slow card is not
 *   money yet. `pending` is reported only while nothing has unlocked, because
 *   it exists to tell a waiting user why their passport is still closed.
 * - **Every purchased, unacknowledged purchase is returned for acknowledging.**
 *   Google refunds one that nobody acknowledges within three days, so a missed
 *   one costs the sale with no error anywhere.
 * - **The earliest purchase time is kept** (for the founder stamp, T-233). A
 *   time that is missing or not a real moment is never kept: zero would make
 *   that buyer a founder, and "now" would make them not one.
 * - **An empty list means locked here, and nothing more.** ⚠ It must never
 *   re-lock a passport that was unlocked: an empty answer is as likely to be a
 *   phone that cannot reach Google as a refund. `entitlementStore` holds that
 *   rule (T-156c), because only it knows what was stored before.
 *
 * ⚠ **No purchase token passes through here.** `decidePurchases` is generic so
 * the adapter gets its own objects back in `toAcknowledge`, token included,
 * without this module knowing the token exists. Nothing here can log one.
 *
 * Pure: no store, no database, no clock, no i18n. `purchaseRules.test.ts` fails
 * if a runtime import appears.
 */

/** Google's purchase states, reduced to the three this app acts on. */
export type PurchaseState = 'purchased' | 'pending' | 'unknown';

/** One purchase as the store adapter reports it. */
export interface StorePurchase {
  productId: string;
  state: PurchaseState;
  /** When Google says it was bought, in milliseconds since 1970 (UTC). */
  purchaseTimeMs: number;
  acknowledged: boolean;
}

export interface PurchaseDecision<P extends StorePurchase> {
  unlocked: boolean;
  /** Our product is waiting for payment, and nothing has unlocked yet. */
  pending: boolean;
  /** Purchased and not yet acknowledged: each must be acknowledged, as non-consumable. */
  toAcknowledge: P[];
  /** The earliest real purchase time of our product, or null if there is none. */
  purchaseTimeMs: number | null;
}

export function decidePurchases<P extends StorePurchase>(
  purchases: readonly P[],
  productId: string
): PurchaseDecision<P> {
  const ours = purchases.filter((p) => p.productId === productId);
  const purchased = ours.filter((p) => p.state === 'purchased');
  const unlocked = purchased.length > 0;

  const times = purchased.map((p) => p.purchaseTimeMs).filter(isRealMoment);

  return {
    unlocked,
    pending: !unlocked && ours.some((p) => p.state === 'pending'),
    toAcknowledge: purchased.filter((p) => !p.acknowledged),
    purchaseTimeMs: times.length > 0 ? Math.min(...times) : null,
  };
}

/** A finite time after 1970. Zero is excluded: it is what a missing field becomes. */
function isRealMoment(ms: number): boolean {
  return Number.isFinite(ms) && ms > 0;
}

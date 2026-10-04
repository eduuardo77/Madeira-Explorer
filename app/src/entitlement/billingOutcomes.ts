/**
 * What the store's answers mean, as the app's own small vocabulary (T-156b,
 * D-091, execution plan §4.3).
 *
 * `storeBilling.ts` is the only file that talks to `expo-iap`; this is the
 * part of it that can be tested without a phone. It turns the library's
 * purchases into `StorePurchase` (what `purchaseRules` reads) and its error
 * codes into a closed set of outcomes, one screen state each (T-156d).
 *
 * ⚠ **The codes are copied as strings**, not imported from `expo-iap`'s
 * `ErrorCode` enum, because importing the library here would make this module
 * untestable in Node and break the one-importer rule. They are the values of
 * that enum in **expo-iap 5.8.2**; `billingOutcomes.test.ts` holds the list, so
 * an upgrade that renames one should be checked against it.
 *
 * Pure: no store, no database, no clock, no i18n.
 */

import type { PurchaseState, StorePurchase } from './purchaseRules.ts';

/**
 * Every way a request to the store can end, other than a purchase arriving.
 * `purchased` and `pending` come as purchases through the listener; the rest
 * come from here.
 */
export type StoreFailure = 'cancelled' | 'alreadyOwned' | 'pending' | 'offline' | 'unavailable' | 'failed';

/** Codes that mean the user closed Google's sheet. Nothing to say. */
const CANCELLED = new Set(['user-cancelled']);

/** The account owns it already: run a restore, then unlock. */
const ALREADY_OWNED = new Set(['already-owned']);

/** Accepted but not paid yet (cash at a shop, a slow card). */
const PENDING = new Set(['pending', 'deferred-payment']);

/**
 * Could not reach Google. Google's SERVICE_UNAVAILABLE arrives as
 * `service-error`, which is what a phone with no network gets.
 */
const OFFLINE = new Set(['network-error', 'service-timeout', 'service-error', 'remote-error']);

/**
 * This phone cannot buy through Google Play at all.
 *
 * ⚠ `billing-unavailable` is ambiguous: no Play Store (some Huawei phones),
 * but also a Play Store that is too old, or an account in a country Play does
 * not sell in. T-156d's wording must not claim the phone has no Google Play.
 */
const UNAVAILABLE = new Set(['billing-unavailable', 'iap-not-available', 'feature-not-supported']);

/**
 * The outcome for a library error code. Anything not listed, including a code
 * a later version adds, is `failed`: the caller records the code where the
 * Debug screen can show it, and the user is offered a retry.
 */
export function outcomeForErrorCode(code: string | null | undefined): StoreFailure {
  if (code == null) return 'failed';
  if (CANCELLED.has(code)) return 'cancelled';
  if (ALREADY_OWNED.has(code)) return 'alreadyOwned';
  if (PENDING.has(code)) return 'pending';
  if (OFFLINE.has(code)) return 'offline';
  if (UNAVAILABLE.has(code)) return 'unavailable';
  return 'failed';
}

/** The fields of an `expo-iap` purchase this app reads. Nothing else is copied. */
export interface LibraryPurchase {
  productId: string;
  purchaseState: string;
  /** Milliseconds since 1970, UTC. */
  transactionDate: number;
  /** Android only; absent elsewhere. */
  isAcknowledgedAndroid?: boolean | null;
}

const STATES: readonly PurchaseState[] = ['purchased', 'pending', 'unknown'];

/**
 * A library purchase as `purchaseRules` reads it.
 *
 * ⚠ **An absent acknowledgement reads as not acknowledged.** Acknowledging
 * twice is harmless; not acknowledging is a refund after three days.
 */
export function toStorePurchase(purchase: LibraryPurchase): StorePurchase {
  const state = STATES.find((s) => s === purchase.purchaseState) ?? 'unknown';
  return {
    productId: purchase.productId,
    state,
    purchaseTimeMs: purchase.transactionDate,
    acknowledged: purchase.isAcknowledgedAndroid === true,
  };
}

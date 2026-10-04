/**
 * The one file that talks to Google Play Billing (T-156b, D-091).
 *
 * ⚠ **The only importer of `expo-iap`.** `billingOutcomes.test.ts` fails if any
 * other file imports it, so swapping the library (D-091's exits are
 * `react-native-iap` and RevenueCat) changes this file and nothing else.
 *
 * **Pinned to expo-iap 5.8.2.** The library has renamed functions between
 * versions. The names used here, as of that version: `initConnection`,
 * `endConnection`, `fetchProducts({ skus, type: 'in-app' })`,
 * `getAvailablePurchases()`, `requestPurchase({ request: { google: { skus } },
 * type: 'in-app' })`, `finishTransaction({ purchase, isConsumable })`,
 * `purchaseUpdatedListener`, `purchaseErrorListener`. A purchase's time is
 * `transactionDate` and its acknowledgement `isAcknowledgedAndroid`.
 *
 * WHAT THIS FILE DOES NOT DO
 * --------------------------
 * - **Decide anything.** What a list of purchases means is `purchaseRules.ts`;
 *   what an error means is `billingOutcomes.ts`. Both are tested in Node.
 * - **Keep or log a purchase token.** The library's purchase object travels
 *   inside `OwnedPurchase.handle` only so it can be handed back to
 *   `finishTransaction`. Errors are recorded by their code, never their
 *   message, so nothing the store sent is written down.
 * - **Call a verification service.** `expo-iap` ships one (IAPKit) that is
 *   contacted only if called. D-091: no server between the phone and Google.
 *   A test fails if this file mentions it.
 * - **Run the lifecycle.** When to connect, query and acknowledge is
 *   `billingSync.ts` (T-156c). This is the plumbing.
 *
 * The store flavour is Play: expo-iap's Gradle picks Play unless a Quest or
 * Fire device is attached to a debug build, and a release build never asks
 * the device. No config plugin is needed for Play, so none is added.
 */

import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from 'expo-iap';

import * as recordingEventDao from '../storage/dao/recordingEventDao';
import { outcomeForErrorCode, toStorePurchase, type StoreFailure } from './billingOutcomes';
import type { StorePurchase } from './purchaseRules';

/** A purchase as the rules read it, carrying the library's object to acknowledge with. */
export interface OwnedPurchase extends StorePurchase {
  readonly handle: Purchase;
}

export type StoreResult<T> = { ok: true; value: T } | { ok: false; failure: StoreFailure };

/** Open the connection to Google Play. Every other call needs it. */
export async function connect(): Promise<StoreResult<void>> {
  try {
    const connected = await initConnection();
    return connected ? { ok: true, value: undefined } : { ok: false, failure: 'unavailable' };
  } catch (error) {
    return failure('connect', error);
  }
}

export async function disconnect(): Promise<void> {
  try {
    await endConnection();
  } catch (error) {
    await record('disconnect', error);
  }
}

/**
 * The price as Google shows it to this user, in their currency ("5,99 €").
 * ⚠ The only source of a price: the app never holds one of its own.
 */
export async function fetchPrice(productId: string): Promise<StoreResult<string>> {
  try {
    const products = (await fetchProducts({ skus: [productId], type: 'in-app' })) ?? [];
    const product = products.find((p) => p.id === productId);
    if (product === undefined) {
      // Not created in Play Console, or not active yet.
      await recordingEventDao.logError('billing fetchPrice', 'product not found'); // i18n-exempt: written to the recording diary, never shown on a screen
      return { ok: false, failure: 'failed' };
    }
    return { ok: true, value: product.displayPrice };
  } catch (error) {
    return failure('fetchPrice', error);
  }
}

/** What the account owns or has pending. Android's query is itself the restore. */
export async function queryOwned(): Promise<StoreResult<OwnedPurchase[]>> {
  try {
    const purchases = await getAvailablePurchases();
    return { ok: true, value: purchases.map(owned) };
  } catch (error) {
    return failure('queryOwned', error);
  }
}

/**
 * Open Google's purchase sheet. The result does not come back here: it arrives
 * through `listen`, as a purchase or a failure.
 */
export async function startPurchase(productId: string): Promise<StoreResult<void>> {
  try {
    await requestPurchase({ request: { google: { skus: [productId] } }, type: 'in-app' });
    return { ok: true, value: undefined };
  } catch (error) {
    return failure('startPurchase', error);
  }
}

/**
 * Tell Google the purchase was granted, after the unlock is saved (§4.3).
 *
 * ⚠ **Non-consumable, always.** Consuming would drop the ownership: the
 * passport could be bought again and a restore would find nothing. A test
 * fails if this call changes.
 */
export async function acknowledge(purchase: OwnedPurchase): Promise<boolean> {
  try {
    await finishTransaction({ purchase: purchase.handle, isConsumable: false });
    return true;
  } catch (error) {
    await record('acknowledge', error);
    return false;
  }
}

/** Results of `startPurchase`, and purchases completed while the app is open. Returns the unsubscribe. */
export function listen(handlers: {
  onPurchase: (purchase: OwnedPurchase) => void;
  onFailure: (failure: StoreFailure) => void;
}): () => void {
  const purchases = purchaseUpdatedListener((purchase) => handlers.onPurchase(owned(purchase)));
  const errors = purchaseErrorListener((error) => {
    const outcome = outcomeForErrorCode(error.code);
    if (outcome === 'failed') void record('purchase', error);
    handlers.onFailure(outcome);
  });
  return () => {
    purchases.remove();
    errors.remove();
  };
}

function owned(purchase: Purchase): OwnedPurchase {
  const isAcknowledgedAndroid = 'isAcknowledgedAndroid' in purchase ? purchase.isAcknowledgedAndroid : null;
  return { ...toStorePurchase({ ...purchase, isAcknowledgedAndroid }), handle: purchase };
}

async function failure<T>(where: string, error: unknown): Promise<StoreResult<T>> {
  const outcome = outcomeForErrorCode(codeOf(error));
  if (outcome === 'failed') await record(where, error);
  return { ok: false, failure: outcome };
}

/** For the Debug screen: where it failed and the code. Never the message (see the header). */
async function record(where: string, error: unknown): Promise<void> {
  await recordingEventDao.logError(`billing ${where}`, codeOf(error) ?? 'no code'); // i18n-exempt: written to the recording diary, never shown on a screen
}

function codeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

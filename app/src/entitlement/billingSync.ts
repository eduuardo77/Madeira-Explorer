/**
 * Keeping the passport in step with Google Play (T-156c, D-091).
 *
 * Started once from the app's root (`App.tsx`). It:
 *
 * - **connects and asks Google what the account owns** at launch, and again
 *   **every time the app comes back to the front**, which catches a purchase
 *   finished while the app was closed (a pending one that cleared, a promo
 *   code redeemed in the Play Store);
 * - **listens** for purchases while the app is open;
 * - runs every answer through `applyStoreAnswer`: **saved first, then
 *   acknowledged** (`purchaseFlow.ts` says why, and its test holds the order);
 * - offers `buyPassport` and `restorePurchases` to the unlock sheet and the
 *   Settings row (T-156d, T-156e), and tells them what happened through
 *   `subscribe`.
 *
 * ⚠ **Does nothing in a beta build** (D-084, plan §4.6): the beta is unlocked
 * and offers nothing to buy, and **nothing when the content pack names no
 * product**, which is how a pack that sells nothing is spelled (D-017).
 *
 * Offline is not an error here. A failed query changes nothing, and the next
 * return to the front tries again.
 */

import { onReturnToFront } from '../navigation/onReturnToFront';

import { getContentPack } from '../content/poiCatalogue';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import type { StoreFailure } from './billingOutcomes';
import { BETA_BUILD, recordStoreAnswer } from './entitlementStore';
import { applyStoreAnswer } from './purchaseFlow';
import * as store from './storeBilling';

/** What the unlock sheet needs to hear. */
export type BillingEvent =
  | { kind: 'unlocked' }
  | { kind: 'pending' }
  | { kind: 'failure'; failure: StoreFailure };

const listeners = new Set<(event: BillingEvent) => void>();

/** Hear what billing did. Returns the unsubscribe. */
export function subscribe(listener: (event: BillingEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: BillingEvent): void {
  for (const listener of listeners) listener(event);
}

let connected = false;

/**
 * One answer at a time. A launch query, a resume query and a live purchase can
 * all arrive together; run in parallel, two of them could read the same stored
 * state and acknowledge the same purchase twice.
 */
let queue: Promise<unknown> = Promise.resolve();
function serially<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

function productId(): string | null {
  return BETA_BUILD ? null : getContentPack().productId;
}

/** Start keeping in step. Call once, from the app's root. Returns the stop. */
export function startBillingSync(): () => void {
  if (productId() === null) return () => {};

  const stopListening = store.listen({
    onPurchase: (purchase) => void serially(() => handle([purchase])),
    onFailure: (failure) => emit({ kind: 'failure', failure }),
  });
  // T-273: on a return, not on the "active" Android reports as the app
  // starts, which asked Play twice at every launch.
  const stopResume = onReturnToFront(() => void restorePurchases());
  void restorePurchases();

  return () => {
    stopResume();
    stopListening();
    connected = false;
    void store.disconnect();
  };
}

/**
 * Ask Google what the account owns, and apply it. Also the Settings row's
 * "Restore purchase" (T-156e): on Android the query is itself the restore.
 * Returns the failure, or null if Google answered.
 */
export function restorePurchases(): Promise<StoreFailure | null> {
  return serially(async () => {
    const notConnected = await ensureConnected();
    if (notConnected !== null) {
      await recordingEventDao.log('billing', `connect failed: ${notConnected}`); // i18n-exempt: written to the recording diary, never shown on a screen
      return notConnected;
    }
    const owned = await store.queryOwned();
    if (!owned.ok) {
      await recordingEventDao.log('billing', `query failed: ${owned.failure}`); // i18n-exempt: written to the recording diary, never shown on a screen
      return dropConnection(owned.failure);
    }
    await handle(owned.value);
    return null;
  });
}

/** Open Google's purchase sheet. The result arrives through `subscribe`. */
export async function buyPassport(): Promise<StoreFailure | null> {
  const id = productId();
  if (id === null) return 'unavailable';
  const notConnected = await ensureConnected();
  if (notConnected !== null) return notConnected;
  const started = await store.startPurchase(id);
  return started.ok ? null : dropConnection(started.failure);
}

/** The price as Google shows it to this user, or the reason there is none. */
export async function passportPrice(): Promise<{ price: string } | { failure: StoreFailure }> {
  const id = productId();
  if (id === null) return { failure: 'unavailable' };
  const notConnected = await ensureConnected();
  if (notConnected !== null) return { failure: notConnected };
  const price = await store.fetchPrice(id);
  return price.ok ? { price: price.value } : { failure: dropConnection(price.failure) };
}

/** Connect if not connected. Returns why it could not, or null. */
async function ensureConnected(): Promise<StoreFailure | null> {
  if (connected) return null;
  const result = await store.connect();
  connected = result.ok;
  return result.ok ? null : result.failure;
}

/**
 * After a failed call, connect afresh next time: Play's connection can drop
 * while the app sits in the background, and a dead one fails every call.
 */
function dropConnection(failure: StoreFailure): StoreFailure {
  if (failure !== 'cancelled' && failure !== 'alreadyOwned' && failure !== 'pending') connected = false;
  return failure;
}

async function handle(purchases: store.OwnedPurchase[]): Promise<void> {
  const id = productId();
  if (id === null) return;
  try {
    let unlockedNow = false;
    const { decision } = await applyStoreAnswer(purchases, id, {
      record: async (answer) => {
        unlockedNow = await recordStoreAnswer(answer);
      },
      acknowledge: store.acknowledge,
    });
    await recordingEventDao.log(
      'billing',
      `owned ${purchases.length}, unlocked ${decision.unlocked}, pending ${decision.pending}` // i18n-exempt: written to the recording diary, never shown on a screen
    );
    if (unlockedNow) emit({ kind: 'unlocked' });
    else if (decision.pending) emit({ kind: 'pending' });
  } catch (error) {
    // The save failed, so nothing was acknowledged; the next query retries.
    await recordingEventDao.logError('billing save', error);
    emit({ kind: 'failure', failure: 'failed' });
  }
}

/**
 * The workbench has no Play Store (T-156b). Metro picks this file over
 * `storeBilling.ts` for web, the `backgroundTasks.web.ts` pattern, so the
 * unlock sheet's states can be seen in a browser.
 *
 * Nothing here is real: `scriptStore` decides what the next calls return, and
 * workbench scenarios (§4.7, with T-156d) set it. The price is an obvious
 * placeholder, never a real one (no price lives in the app).
 *
 * `conforms` at the bottom makes the compiler check that this file offers
 * exactly what the real adapter does, with the same signatures.
 */

import type { StoreFailure } from './billingOutcomes';
import type { OwnedPurchase, StoreResult } from './storeBilling';

export type { OwnedPurchase, StoreResult } from './storeBilling';

/** What the scripted store answers. `null` means the call succeeds. */
interface Script {
  failure: StoreFailure | null;
  owned: OwnedPurchase[];
  price: string;
}

let script: Script = { failure: null, owned: [], price: '0,00 € (workbench)' };
let purchaseHandlers: Parameters<typeof listen>[0] | null = null;

/** Set what the next calls return. For workbench scenarios only. */
export function scriptStore(next: Partial<Script>): void {
  script = { ...script, ...next };
}

function answer<T>(value: T): StoreResult<T> {
  return script.failure === null ? { ok: true, value } : { ok: false, failure: script.failure };
}

export async function connect(): Promise<StoreResult<void>> {
  return answer(undefined);
}

export async function disconnect(): Promise<void> {}

export async function fetchPrice(_productId: string): Promise<StoreResult<string>> {
  return answer(script.price);
}

export async function queryOwned(): Promise<StoreResult<OwnedPurchase[]>> {
  return answer(script.owned);
}

export async function startPurchase(_productId: string): Promise<StoreResult<void>> {
  // Like Google's sheet, the result arrives through the listener, not here.
  if (script.failure !== null) purchaseHandlers?.onFailure(script.failure);
  else for (const purchase of script.owned) purchaseHandlers?.onPurchase(purchase);
  return { ok: true, value: undefined };
}

export async function acknowledge(_purchase: OwnedPurchase): Promise<boolean> {
  return true;
}

export function listen(handlers: {
  onPurchase: (purchase: OwnedPurchase) => void;
  onFailure: (failure: StoreFailure) => void;
}): () => void {
  purchaseHandlers = handlers;
  return () => {
    if (purchaseHandlers === handlers) purchaseHandlers = null;
  };
}

const conforms: typeof import('./storeBilling') = {
  connect,
  disconnect,
  fetchPrice,
  queryOwned,
  startPurchase,
  acknowledge,
  listen,
};
void conforms;

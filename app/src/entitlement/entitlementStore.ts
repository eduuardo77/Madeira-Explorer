/**
 * Whether this device's passport is unlocked: the impure half of T-155 and
 * T-156c.
 *
 * `freeTier.ts` holds the arithmetic and is tested; this is the state it needs,
 * and it is deliberately the only place in the app that decides what
 * "unlocked" means. Google Play is the authority (`billingSync.ts`); its
 * answer is written here so the passport can render at launch, offline, in a
 * levada valley, on a phone that has not seen a network since the airport.
 *
 * ⚠ **A cache, and it must fail closed-to-open.** When the store cannot be
 * reached, the last known answer stands. A paid user whose phone is in a valley
 * must not watch their stamps disappear; that is the rug pull D-072 exists to
 * prevent, and an unpaid user seeing a few extra stamps for a while costs
 * nothing by comparison. `mergeEntitlement` holds the rule and is tested.
 *
 * Erase all (`deleteAllUserData`) clears the `app_state` table, both keys with
 * it (OQ-7). The purchase lives in the Google account and comes back at the
 * next query with a network.
 */

import * as appStateDao from '../storage/dao/appStateDao';
import { AppStateKey } from '../storage/dao/appStateDao';
import { effectiveUnlocked } from './betaBuild';
import {
  mergeEntitlement,
  type Entitlement,
  type PurchaseDecision,
  type StorePurchase,
} from './purchaseRules';

/**
 * A closed-beta build (D-084): `EXPO_PUBLIC_PROA_BETA=1` at build time, inlined
 * by Expo. Read here and nowhere else, so the one place that decides what
 * "unlocked" means stays the one place.
 */
export const BETA_BUILD = process.env.EXPO_PUBLIC_PROA_BETA === '1';

export async function isUnlocked(): Promise<boolean> {
  return effectiveUnlocked(await appStateDao.getFlag(AppStateKey.StampsUnlocked), BETA_BUILD);
}

/** When the passport was bought, if it was and Google said when (the founder stamp, T-233). */
export async function purchaseTimeMs(): Promise<number | null> {
  return (await readStored()).purchaseTimeMs;
}

/**
 * Record Google's answer, merged with what is stored.
 *
 * ⚠ **Once true, never set back to false** by an empty or failed lookup: only a
 * refund may take the passport away, and the app cannot see one without a
 * server (D-091). Even then the awards stay in the database, because they
 * were earned.
 *
 * Returns true if the passport became unlocked with this answer.
 */
export async function recordStoreAnswer(decision: PurchaseDecision<StorePurchase>): Promise<boolean> {
  const stored = await readStored();
  const next = mergeEntitlement(stored, decision);
  if (next.unlocked !== stored.unlocked) {
    await appStateDao.setFlag(AppStateKey.StampsUnlocked, next.unlocked);
  }
  if (next.purchaseTimeMs !== stored.purchaseTimeMs) {
    await appStateDao.setJson(AppStateKey.PurchaseRecord, { purchaseTimeMs: next.purchaseTimeMs });
  }
  return next.unlocked && !stored.unlocked;
}

async function readStored(): Promise<Entitlement> {
  const record = await appStateDao.getJson<{ purchaseTimeMs?: unknown }>(AppStateKey.PurchaseRecord);
  const time = record?.purchaseTimeMs;
  return {
    unlocked: await appStateDao.getFlag(AppStateKey.StampsUnlocked),
    purchaseTimeMs: typeof time === 'number' && Number.isFinite(time) ? time : null,
  };
}

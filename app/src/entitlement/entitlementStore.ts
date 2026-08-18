/**
 * Whether this device's passport is unlocked — the impure half of T-155.
 *
 * `freeTier.ts` holds the arithmetic and is tested; this is the one line of
 * state it needs, and it is deliberately the only place in the app that decides
 * what "unlocked" means.
 *
 * ⚠ **Today it is a local flag with no way for a user to set it.** That is not
 * an oversight: **T-156** puts Play Billing behind `isUnlocked` and makes the
 * store the authority, writing its answer here so the passport can render at
 * launch — offline, in a levada valley, on a phone that has not seen a network
 * since the airport. Until then `setUnlocked` exists for the workbench and for
 * the emulator, and no screen calls it.
 *
 * ⚠ **A cache, and it must fail closed-to-open.** When the store cannot be
 * reached, the last known answer stands. A paid user whose phone is in a valley
 * must not watch their stamps disappear; that is the rug pull D-072 exists to
 * prevent, and an unpaid user seeing a few extra stamps for a while costs
 * nothing by comparison.
 */

import * as appStateDao from '../storage/dao/appStateDao';
import { AppStateKey } from '../storage/dao/appStateDao';

export async function isUnlocked(): Promise<boolean> {
  return appStateDao.getFlag(AppStateKey.StampsUnlocked);
}

/**
 * Record the store's answer.
 *
 * ⚠ **Once true, never set back to false on a failed lookup** (T-156). Only a
 * refund, which Play reports explicitly, may take the passport away — and even
 * then the awards stay in the database, because they were earned.
 */
export async function setUnlocked(unlocked: boolean): Promise<void> {
  await appStateDao.setFlag(AppStateKey.StampsUnlocked, unlocked);
}

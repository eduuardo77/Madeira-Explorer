/**
 * What the unlock sheet says and offers, for each state (T-156d, D-089,
 * execution plan §4.3).
 *
 * The sheet (`ui/UnlockSheet.tsx`) is the one place a user can buy the
 * passport. Every outcome the store can return has a state here, and each
 * state decides its text and its buttons, so the whole table is tested in
 * Node rather than found on a phone.
 *
 * THE RULES IT HOLDS
 * ------------------
 * - **The only price is Google's.** Before Google answers there is no price,
 *   never a remembered or hardcoded one.
 * - **Nothing is offered that does not exist yet.** Medals (T-235) and the
 *   founder stamp (T-233, and only while its window is open) are listed when
 *   the caller says they are real.
 * - **Offline is not an error.** It says *later*, and Buy stays.
 * - **Unavailable does not blame the phone**: the same answer comes from an
 *   old Play Store or a country Play does not sell in (T-156b).
 * - **A failure makes no promise about charges**, because the app cannot know.
 * - **A locked stamp was earned**, never missed (the tone rule in `strings.ts`).
 *
 * Pure: takes the language, as `placeCard.ts` does, and never imports
 * `i18n/index.ts`.
 */

import type { Language } from '../i18n/languages.ts';
import { PLURALS, STRINGS } from '../i18n/strings.ts';
import { plural, translate } from '../i18n/translate.ts';
import type { StoreFailure } from './billingOutcomes.ts';

/** Where the sheet is. */
export type UnlockState =
  | { kind: 'offer' }
  | { kind: 'working' }
  | { kind: 'pending' }
  | { kind: 'offline' }
  | { kind: 'unavailable' }
  | { kind: 'failed' }
  | { kind: 'unlocked' }
  | { kind: 'nothingToRestore' };

export interface UnlockSheetInput {
  state: UnlockState;
  /**
   * Google's price for this user ("5,99 €"), or null until it answers. Apart
   * from the state so that no state loses it: seen on the P30, the button fell
   * back to a bare "Unlock" after a failed purchase.
   */
  price: string | null;
  /** How many earned stamps are locked: the headline's count (D-097, sheet A). */
  waiting: number;
  /** What paying adds beyond the stamps, once each exists. */
  offers: { medals: boolean; founder: boolean };
  language: Language;
}

export interface UnlockSheetModel {
  /** The small line over the headline. */
  eyebrow: string;
  title: string;
  earned: string;
  adds: string[];
  /** The line under the list, for every state but a plain offer. */
  notice: string | null;
  buy: { label: string; enabled: boolean } | null;
  restore: string | null;
  close: string;
}

export function unlockSheetModel(input: UnlockSheetInput): UnlockSheetModel {
  const { state, language } = input;
  const say = (key: keyof typeof STRINGS, values?: Record<string, string>) =>
    translate(STRINGS[key], language, values);

  const adds = [say('unlock.adds.stamps')];
  if (input.offers.medals) adds.push(say('unlock.adds.medals'));
  if (input.offers.founder) adds.push(say('unlock.adds.founder'));
  adds.push(say('unlock.adds.once'));

  const { price } = input;
  const waiting = input.waiting > 0;
  // Sheet A (D-097): with stamps waiting, the offer is to see what is already
  // theirs; with none (opened from Settings), it is the plain unlock.
  const buyLabel = waiting
    ? price === null
      ? say('unlock.buy.see.noPrice')
      : say('unlock.buy.see', { price })
    : price === null
      ? say('unlock.buy.noPrice')
      : say('unlock.buy', { price });
  const canBuy = { label: buyLabel, enabled: true };

  const model: UnlockSheetModel = {
    eyebrow: say('unlock.eyebrow'),
    title: waiting
      ? plural(PLURALS['unlock.title.waiting'], input.waiting, language)
      : say('unlock.title'),
    earned: waiting ? plural(PLURALS['unlock.lead'], input.waiting, language) : say('unlock.earned.none'),
    adds,
    notice: null,
    buy: canBuy,
    restore: say('unlock.restore'),
    close: say('unlock.notNow'),
  };

  switch (state.kind) {
    case 'offer':
      return model;
    case 'working':
      return { ...model, buy: { label: say('unlock.working'), enabled: false } };
    case 'pending':
      // Already bought, so nothing to buy twice; Restore asks Google again.
      return { ...model, notice: say('unlock.pending'), buy: null };
    case 'offline':
      return { ...model, notice: say('unlock.offline') };
    case 'unavailable':
      return { ...model, notice: say('unlock.unavailable'), buy: null, restore: null };
    case 'failed':
      return { ...model, notice: say('unlock.failed') };
    case 'nothingToRestore':
      return { ...model, notice: say('unlock.nothingToRestore') };
    case 'unlocked':
      return { ...model, notice: say('unlock.unlocked'), buy: null, restore: null, close: say('unlock.done') };
  }
}

/**
 * Where a failure from the store leaves the sheet.
 *
 * ⚠ Cancelling arrives while the sheet says *waiting for Google Play*, so it
 * must return to the offer, never stay where it is.
 * `alreadyOwned` becomes `working`: the sheet then runs a restore, which unlocks.
 */
/** How many stamps the sheet shows when none of the user's is locked. */
export const SHOWCASE_COUNT = 3;

/**
 * What the sheet shows when nothing is waiting: a few places drawn in colour,
 * picked at random each time it opens, so the offer is never an empty card
 * (the lead, 2026-10-10: "It should show at least 3 random stamps").
 *
 * `random` returns [0, 1), as `Math.random` does; a test passes its own.
 * Fewer places than `count` gives all of them.
 */
export function showcase<T>(places: readonly T[], count: number, random: () => number): T[] {
  const pool = [...places];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picked;
}

export function stateAfterFailure(failure: StoreFailure): UnlockState {
  switch (failure) {
    case 'cancelled':
      return { kind: 'offer' };
    case 'alreadyOwned':
      return { kind: 'working' };
    default:
      return { kind: failure };
  }
}

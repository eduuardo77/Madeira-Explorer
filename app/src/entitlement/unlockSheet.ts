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
 * - **Offline is not an error.** It says *later*, and Buy stays; the button
 *   says a connection is needed (Q2, 30 Oct), and a tap tries again.
 * - **Unavailable does not blame the phone**: the same answer comes from an
 *   old Play Store or a country Play does not sell in (T-156b).
 * - **A failure makes no promise about charges**, because the app cannot know.
 * - **A locked stamp was earned**, never missed (the tone rule in `strings.ts`).
 * - **The launch price says when it ends** (D-110), and only where the button
 *   is. It never names a price of its own or a discount: "then it doubles".
 *
 * Pure: takes the language, as `placeCard.ts` does, and never imports
 * `i18n/index.ts`.
 */

import { DATE_LOCALES, type Language } from '../i18n/languages.ts';
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
  offers: {
    medals: boolean;
    founder: boolean;
    /**
     * Islands with a passport of their own, by name (D-109): named from day
     * one as part of what the purchase covers. An island still hidden
     * (`hiddenIslands`) is left out by the caller.
     */
    islands?: readonly string[];
  };
  /**
   * The first millisecond after the launch price (D-110: the day after
   * content's `launchPriceUntil`), or null when there is none. Shown only before it.
   */
  launchPriceEndMs?: number | null;
  nowMs?: number;
  /**
   * T-319: the stamp the user tapped to get here, by name, or null when the
   * sheet opened from anywhere else. Page 1 then shows that one stamp.
   */
  focusName?: string | null;
  /** The user's places on the main island, for the island page; null leaves it out. */
  places?: { visited: number; total: number } | null;
  /** The first millisecond after the founder window (`founderWindowEndMs`), for its page's date. */
  founderEndMs?: number | null;
  language: Language;
}

/**
 * One page of the swiped sheet (T-319, the lead, 23 Nov): one picture and
 * one line, with a quieter line under it. The view draws the picture for
 * `kind`; the words are all here.
 */
export type UnlockPage =
  | { kind: 'stamps'; art: 'focus' | 'reveal' | 'showcase'; line: string; sub: string; once: string }
  | { kind: 'island'; line: string; count: string; sub: string }
  | { kind: 'sets'; line: string }
  | { kind: 'founder'; line: string; sub: string };

export interface UnlockSheetModel {
  /** The small line over the headline. */
  eyebrow: string;
  /** What paying gives, as pages: never one for what the app does not have yet. */
  pages: UnlockPage[];
  /** Over the button, for every state but a plain offer. */
  notice: string | null;
  buy: { label: string; enabled: boolean } | null;
  /** Over the button while the launch price lasts (D-110), else null. */
  launchPrice: string | null;
  /** The X in the corner, said to screen readers (the lead, 23 Nov). */
  closeIcon: string;
  close: string;
}

export function unlockSheetModel(input: UnlockSheetInput): UnlockSheetModel {
  const { state, language } = input;
  const say = (key: keyof typeof STRINGS, values?: Record<string, string>) =>
    translate(STRINGS[key], language, values);

  const { price } = input;
  const pages = unlockPages(input, say);
  // Q2 b (30 Oct 2026, D-097 amended): one label, what the tap does and what
  // it costs. It was "See my stamps · 5,99 €" with stamps waiting, which said
  // neither that it was a purchase nor of what. Offline it says so instead.
  const buyLabel =
    state.kind === 'offline'
      ? say('unlock.buy.needsConnection')
      : price === null
        ? say('unlock.buy.passport.noPrice')
        : say('unlock.buy.passport', { price });
  const canBuy = { label: buyLabel, enabled: true };

  // The last day, not the first after it: "until 28 February" while the
  // price ends at midnight UTC on 1 March. Noon of that day, not a
  // `timeZone` option, which Hermes was never seen to honour: noon UTC is the
  // same date in every zone from UTC-11 to UTC+11.
  const end = input.launchPriceEndMs ?? null;
  const launchPrice =
    end !== null && input.nowMs !== undefined && input.nowMs < end
      ? say('unlock.launchPrice', { date: lastDay(end, language) })
      : null;

  const model: UnlockSheetModel = {
    eyebrow: say('unlock.eyebrow'),
    pages,
    notice: null,
    buy: canBuy,
    launchPrice,
    closeIcon: say('common.close'),
    close: say('unlock.notNow'),
  };

  switch (state.kind) {
    case 'offer':
      return model;
    case 'working':
      return { ...model, buy: { label: say('unlock.working'), enabled: false } };
    case 'pending':
      // Already bought, so nothing to buy twice; Google's confirmation unlocks it.
      return { ...model, notice: say('unlock.pending'), buy: null, launchPrice: null };
    case 'offline':
      return { ...model, notice: say('unlock.offline') };
    case 'unavailable':
      return { ...model, notice: say('unlock.unavailable'), buy: null, launchPrice: null };
    case 'failed':
      return { ...model, notice: say('unlock.failed') };
    case 'nothingToRestore':
      return { ...model, notice: say('unlock.nothingToRestore') };
    case 'unlocked':
      return { ...model, notice: say('unlock.unlocked'), buy: null, launchPrice: null, close: say('unlock.done') };
  }
}

/**
 * The day before `endMs`, "28 February", as the user's language writes it.
 * Noon of that day, not a `timeZone` option, which Hermes was never seen to
 * honour: noon UTC is the same date in every zone from UTC-11 to UTC+11.
 */
function lastDay(endMs: number, language: Language): string {
  return new Date(endMs - 12 * 3_600_000).toLocaleDateString(DATE_LOCALES[language], { day: 'numeric', month: 'long' });
}

/**
 * The pages, in order (T-319): the user's stamps first, then the island, the
 * sets and the founder stamp, each only when it exists. Reuses the lead's
 * wording from the list it replaces wherever a line survived.
 */
function unlockPages(
  input: UnlockSheetInput,
  say: (key: keyof typeof STRINGS, values?: Record<string, string>) => string
): UnlockPage[] {
  const { language } = input;
  const once = say('unlock.adds.once');
  const others = input.waiting - 1;
  const first: UnlockPage =
    input.waiting === 0
      ? { kind: 'stamps', art: 'showcase', line: say('unlock.title'), sub: say('unlock.earned.none'), once }
      : input.focusName
        ? {
            kind: 'stamps',
            art: 'focus',
            line: say('unlock.page.focus', { name: input.focusName }),
            sub:
              others > 0
                ? plural(PLURALS['unlock.page.focusMore'], others, language)
                : plural(PLURALS['unlock.lead'], 1, language),
            once,
          }
        : {
            kind: 'stamps',
            art: 'reveal',
            line: plural(PLURALS['unlock.title.waiting'], input.waiting, language),
            sub: plural(PLURALS['unlock.lead'], input.waiting, language),
            once,
          };
  const pages: UnlockPage[] = [first];
  if (input.places) {
    const islands = input.offers.islands ?? [];
    pages.push({
      kind: 'island',
      line: say('unlock.page.island'),
      count: say('unlock.page.places', {
        visited: String(input.places.visited),
        total: String(input.places.total),
      }),
      sub: islands.length > 0 ? say('unlock.page.islandAlso', { island: islands.join(', ') }) : say('unlock.adds.stamps'),
    });
  }
  if (input.offers.medals) pages.push({ kind: 'sets', line: say('unlock.adds.medals') });
  const founderEnd = input.founderEndMs ?? null;
  if (input.offers.founder && founderEnd !== null) {
    pages.push({
      kind: 'founder',
      line: say('unlock.page.founder', { date: lastDay(founderEnd, language) }),
      sub: say('unlock.page.founderSub'),
    });
  }
  return pages;
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

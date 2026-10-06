/**
 * Who is a founder (T-233, D-089 rule 6).
 *
 * Anyone who buys the passport within the first months after the public
 * launch gets a stamp nobody can earn afterwards. Two rules make it fair, and
 * both are the project lead's (plan §4.2, OQ-5):
 *
 *  - **Google's purchase time decides, never the phone's clock.** It is on
 *    the purchase record, survives a reinstall through restore, and cannot be
 *    moved by changing the date in Settings.
 *  - **Bought before the window closes, however early.** Testers and early
 *    promo codes buy before the launch date; they were there first, so a
 *    purchase before `start` counts.
 *
 * While `start` is null nobody is a founder, and the unlock sheet does not
 * offer it: `start` is set, as a date, in the public release commit itself,
 * and `tools/smoke-release.mjs` refuses a release without it.
 *
 * Pure: the window and the times come in. Tested in `founder.test.ts`.
 */

import type { FounderWindow } from '../content/contentPack.ts';

/** `YYYY-MM-DD`, read as midnight UTC. */
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Midnight UTC of a `YYYY-MM-DD` date, or null when it is not a real date. */
export function parseWindowStart(start: string): number | null {
  const match = DATE.exec(start);
  if (match === null) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const back = new Date(ms);
  // 2027-02-30 would roll over to March; a date that does not round-trip is not a date.
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

/**
 * The first millisecond after the window: `start` plus `months` calendar
 * months, at midnight UTC. A start late in the month keeps to the target
 * month's last day (31 Aug + 3 months is 30 Nov, and 30 Nov + 3 months is
 * 28 Feb, or 29 in a leap year), rather than spilling into the month after.
 */
export function founderWindowEndMs(window: FounderWindow | null): number | null {
  if (window === null || window.start === null) return null;
  const startMs = parseWindowStart(window.start);
  if (startMs === null) return null;
  const start = new Date(startMs);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + window.months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay));
}

/** Whether a purchase made at this time (Google's) earns the founder stamp. */
export function isFounder(purchaseTimeMs: number | null, window: FounderWindow | null): boolean {
  if (purchaseTimeMs === null || !Number.isFinite(purchaseTimeMs)) return false;
  const end = founderWindowEndMs(window);
  return end !== null && purchaseTimeMs < end;
}

/**
 * Whether buying now would still make a founder, for the unlock sheet's list
 * of what the purchase adds. Read off the phone's clock, which is fine for an
 * offer: the award itself is decided by Google's time above.
 */
export function founderWindowOpen(nowMs: number, window: FounderWindow | null): boolean {
  const end = founderWindowEndMs(window);
  return end !== null && nowMs < end;
}

/**
 * Whether a public release must not go out with this window (T-233): a window
 * whose `start` is unset. It is the state every testing build ships in, so it
 * is the one somebody forgets to change, and a public release with it would
 * make nobody a founder, silently, for good. A pack with no window at all
 * offers no founder stamp and has nothing to forget. Read by
 * `tools/smoke-release.mjs`, which says why in its own words.
 */
export function founderStartMissing(window: FounderWindow | null): boolean {
  return window !== null && window.start === null;
}

/** The year the window opened, for the stamp's face; null while unset. */
export function founderYear(window: FounderWindow | null): number | null {
  if (window === null || window.start === null) return null;
  const startMs = parseWindowStart(window.start);
  return startMs === null ? null : new Date(startMs).getUTCFullYear();
}

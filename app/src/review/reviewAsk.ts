/**
 * When the app may ask for a Play Store rating (T-326). The pure half;
 * `reviewPrompt.ts` is the impure one beside it.
 *
 * WHAT IS SHOWN
 * -------------
 * Google's own in-app review sheet (Play In-App Review API), never a dialog of
 * ours. Three reasons, each of which ruled out the obvious alternative:
 *
 * - **Google's policy forbids the usual pre-prompt.** A "Do you like the app?"
 *   question that sends happy users to the store and unhappy ones to email is
 *   review gating, and an app can be pulled for it. So nothing of ours stands
 *   in front of the sheet, and nothing asks the user's opinion first.
 * - **The sheet stays inside the app.** The user rates without leaving and is
 *   back on the map in one tap, which is most of why it does not annoy.
 * - **Google rations it.** Play decides whether the sheet actually appears and
 *   shows it to one user only a few times a year whatever the app asks. These
 *   rules are stricter than that quota, so Play's limit is the backstop, not
 *   the plan.
 *
 * WHEN
 * ----
 * Only as a celebration closes: the user has just been somewhere and seen a
 * stamp land. Never at launch, never over a sheet, never during a first run,
 * never beside an offer to buy (a stamp that offered the unlock is skipped, so
 * "pay" and "rate" never follow each other), and only once the user has
 * enough of the island behind them to have an opinion worth asking for.
 *
 * The app cannot know whether the user rated: the API says only that the flow
 * finished. So every ask counts, rated or not, and a user who rates from
 * Settings by hand is never asked again.
 */

export const REVIEW_RULES = {
  /** Not in the first days: a visitor's first outing is not the moment. */
  minDaysInstalled: 3,
  /** Stamps collected, this one included. Three is a real use of the app. */
  minStamps: 3,
  /** Between two asks. Play's own quota is of the same order. */
  minDaysBetween: 120,
  /** In the app's whole life on this phone. */
  maxAsks: 3,
  /** After the celebration closes, so its fade is over before the sheet rises. */
  delayMs: 900,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What is stored between launches (`AppStateKey.ReviewAsks`). */
export type ReviewHistory = {
  /** When the app asked Play to show the sheet, oldest first. */
  askedTs: number[];
  /** When the user opened the store page from Settings, if ever. */
  openedStoreTs: number | null;
};

export const EMPTY_HISTORY: ReviewHistory = { askedTs: [], openedStoreTs: null };

export type ReviewMoment = {
  nowMs: number;
  /** `AppStateKey.InstalledTs`; null when unknown, which never asks. */
  installedTs: number | null;
  /** Stamps collected once this one is counted. */
  collected: number;
  /** The stamp just closed was withheld by the free tier. */
  locked: boolean;
  /** The stamp's celebration carried the offer to unlock (D-105). */
  offeredUnlock: boolean;
  /** More celebrations are waiting behind this one. */
  moreWaiting: boolean;
  /** A beta build: testers' ratings are private feedback, and they have email. */
  beta: boolean;
};

export function shouldAskForReview(moment: ReviewMoment, history: ReviewHistory): boolean {
  if (moment.beta || moment.locked || moment.offeredUnlock || moment.moreWaiting) {
    return false;
  }
  if (history.openedStoreTs !== null) {
    return false;
  }
  if (moment.installedTs === null || moment.nowMs - moment.installedTs < REVIEW_RULES.minDaysInstalled * DAY_MS) {
    return false;
  }
  if (moment.collected < REVIEW_RULES.minStamps) {
    return false;
  }
  if (history.askedTs.length >= REVIEW_RULES.maxAsks) {
    return false;
  }
  const last = history.askedTs[history.askedTs.length - 1];
  if (last !== undefined && moment.nowMs - last < REVIEW_RULES.minDaysBetween * DAY_MS) {
    return false;
  }
  return true;
}

export function withAsk(history: ReviewHistory, nowMs: number): ReviewHistory {
  return { ...history, askedTs: [...history.askedTs, nowMs] };
}

export function withStoreOpened(history: ReviewHistory, nowMs: number): ReviewHistory {
  return { ...history, openedStoreTs: nowMs };
}

/**
 * Read what was stored. Anything unreadable is an empty history *with an ask
 * already spent today's worth*: a corrupt row must not become a reason to ask.
 */
export function parseHistory(raw: string | null, nowMs: number): ReviewHistory {
  if (raw === null) {
    return EMPTY_HISTORY;
  }
  try {
    const value = JSON.parse(raw) as Partial<ReviewHistory>;
    const askedTs = Array.isArray(value.askedTs)
      ? value.askedTs.filter((ts): ts is number => typeof ts === 'number' && Number.isFinite(ts)).sort((a, b) => a - b)
      : [];
    const openedStoreTs = typeof value.openedStoreTs === 'number' ? value.openedStoreTs : null;
    return { askedTs, openedStoreTs };
  } catch {
    return { askedTs: [nowMs], openedStoreTs: null };
  }
}

/**
 * The Play Store page. The web address, not `market://`: on the P30 (EMUI 12)
 * `market://` is claimed by Huawei's AppGallery too, and Android asks which
 * store to open, where Bruma is not. `play.google.com` is the Play Store's own
 * verified link, so it opens Play directly, and a browser where there is none.
 */
export function storePageUrl(packageName: string): string {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`;
}

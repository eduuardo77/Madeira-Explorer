/**
 * Ask Play for its rating sheet, and open the store page (T-326). The impure
 * half of `reviewAsk.ts`, which says when and why.
 *
 * Never throws and never shows an error: a rating sheet that does not appear
 * is the ordinary case (Play's quota, no Play Store, offline), and the user
 * must not learn that the app tried.
 */

import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';
import * as appStateDao from '../storage/dao/appStateDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import {
  parseHistory,
  REVIEW_RULES,
  shouldAskForReview,
  storePageUrl,
  withAsk,
  withStoreOpened,
  type ReviewHistory,
  type ReviewMoment,
} from './reviewAsk';

/** Only Android has a Play Store; an iPhone build is unbuilt and unverified. */
const SUPPORTED = Platform.OS === 'android';

/** One ask in flight at a time, so two celebrations closing fast cannot both ask. */
let asking = false;

async function readHistory(nowMs: number): Promise<ReviewHistory> {
  return parseHistory(await appStateDao.get(appStateDao.AppStateKey.ReviewAsks), nowMs);
}

async function installedTs(): Promise<number | null> {
  const raw = await appStateDao.get(appStateDao.AppStateKey.InstalledTs);
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Called as a stamp's celebration closes. Asks only when `shouldAskForReview`
 * says so, after a short pause so the celebration has gone.
 */
export async function maybeAskForReview(moment: Omit<ReviewMoment, 'nowMs' | 'installedTs'>): Promise<void> {
  if (!SUPPORTED || asking) {
    return;
  }
  asking = true;
  try {
    const nowMs = Date.now();
    const history = await readHistory(nowMs);
    const full: ReviewMoment = { ...moment, nowMs, installedTs: await installedTs() };
    if (!shouldAskForReview(full, history)) {
      return;
    }
    if (!(await StoreReview.isAvailableAsync())) {
      return;
    }
    // Spent before asking: a crash inside Play's sheet must not make it ask again.
    await appStateDao.set(appStateDao.AppStateKey.ReviewAsks, JSON.stringify(withAsk(history, nowMs)));
    await new Promise((resolve) => setTimeout(resolve, REVIEW_RULES.delayMs));
    await StoreReview.requestReview();
  } catch (error) {
    await recordingEventDao.logError('review ask', error).catch(() => undefined);
  } finally {
    asking = false;
  }
}

/** The package the store knows the app by, from the build's own config. */
function packageName(): string | null {
  return Constants.expoConfig?.android?.package ?? null;
}

/** Whether Settings can offer the rating row at all. */
export function canOpenStorePage(): boolean {
  return SUPPORTED && packageName() !== null;
}

/**
 * Settings' row: the user asked, so this always goes to the store page (the
 * in-app sheet may silently not appear, which would read as a broken button).
 * Once opened, the app never asks by itself again.
 */
export async function openStorePage(): Promise<void> {
  const name = packageName();
  if (!SUPPORTED || name === null) {
    return;
  }
  try {
    await Linking.openURL(storePageUrl(name));
  } catch (error) {
    await recordingEventDao.logError('store page', error).catch(() => undefined);
    return;
  }
  try {
    const nowMs = Date.now();
    const history = await readHistory(nowMs);
    await appStateDao.set(appStateDao.AppStateKey.ReviewAsks, JSON.stringify(withStoreOpened(history, nowMs)));
  } catch (error) {
    await recordingEventDao.logError('store page', error).catch(() => undefined);
  }
}

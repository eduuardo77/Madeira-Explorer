import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EMPTY_HISTORY,
  parseHistory,
  REVIEW_RULES,
  shouldAskForReview,
  storePageUrl,
  withAsk,
  withStoreOpened,
  type ReviewMoment,
} from './reviewAsk.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 23, 18, 0);

/** A moment that asks: everything else is one rule broken at a time. */
const happy: ReviewMoment = {
  nowMs: NOW,
  installedTs: NOW - 10 * DAY,
  collected: 5,
  locked: false,
  offeredUnlock: false,
  moreWaiting: false,
  beta: false,
};

test('a settled user closing a free stamp is asked', () => {
  assert.equal(shouldAskForReview(happy, EMPTY_HISTORY), true);
});

test('never in the first days, nor with the install time unknown', () => {
  assert.equal(shouldAskForReview({ ...happy, installedTs: NOW - REVIEW_RULES.minDaysInstalled * DAY + 1 }, EMPTY_HISTORY), false);
  assert.equal(shouldAskForReview({ ...happy, installedTs: null }, EMPTY_HISTORY), false);
  assert.equal(shouldAskForReview({ ...happy, installedTs: NOW - REVIEW_RULES.minDaysInstalled * DAY }, EMPTY_HISTORY), true);
});

test('not before the third stamp', () => {
  assert.equal(shouldAskForReview({ ...happy, collected: REVIEW_RULES.minStamps - 1 }, EMPTY_HISTORY), false);
  assert.equal(shouldAskForReview({ ...happy, collected: REVIEW_RULES.minStamps }, EMPTY_HISTORY), true);
});

test('never beside an offer to buy, a locked stamp, another celebration, or in a beta', () => {
  for (const broken of [{ locked: true }, { offeredUnlock: true }, { moreWaiting: true }, { beta: true }]) {
    assert.equal(shouldAskForReview({ ...happy, ...broken }, EMPTY_HISTORY), false, JSON.stringify(broken));
  }
});

test('rare: months apart, and a few times in the app\'s life', () => {
  const once = withAsk(EMPTY_HISTORY, NOW - (REVIEW_RULES.minDaysBetween - 1) * DAY);
  assert.equal(shouldAskForReview(happy, once), false);
  const longAgo = withAsk(EMPTY_HISTORY, NOW - REVIEW_RULES.minDaysBetween * DAY);
  assert.equal(shouldAskForReview(happy, longAgo), true);
  let spent = EMPTY_HISTORY;
  for (let i = 0; i < REVIEW_RULES.maxAsks; i += 1) spent = withAsk(spent, NOW - (1000 - i) * DAY);
  assert.equal(shouldAskForReview(happy, spent), false);
});

test('a user who opened the store page from Settings is never asked again', () => {
  assert.equal(shouldAskForReview(happy, withStoreOpened(EMPTY_HISTORY, NOW - 400 * DAY)), false);
});

test('the stored history reads back, and a corrupt one never becomes a reason to ask', () => {
  const stored = withStoreOpened(withAsk(EMPTY_HISTORY, NOW - DAY), NOW);
  assert.deepEqual(parseHistory(JSON.stringify(stored), NOW), stored);
  assert.deepEqual(parseHistory(null, NOW), EMPTY_HISTORY);
  const corrupt = parseHistory('{not json', NOW);
  assert.equal(shouldAskForReview(happy, corrupt), false);
  assert.deepEqual(parseHistory('{"askedTs":["x",3,1]}', NOW).askedTs, [1, 3]);
});

test('the store page is the Play web address, never market:// (AppGallery claims it on Huawei)', () => {
  assert.equal(storePageUrl('com.example.app'), 'https://play.google.com/store/apps/details?id=com.example.app');
});

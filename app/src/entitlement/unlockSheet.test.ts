/**
 * What the unlock sheet says and offers in each state (T-156d).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stateAfterFailure, unlockSheetModel, type UnlockSheetInput } from './unlockSheet.ts';

function input(overrides: Partial<UnlockSheetInput> = {}): UnlockSheetInput {
  return {
    state: { kind: 'offer', price: '5,99 €' },
    collected: 14,
    waiting: 8,
    offers: { medals: false, founder: false },
    language: 'en',
    ...overrides,
  };
}

test('the offer names the price Google gave, on the button', () => {
  const model = unlockSheetModel(input());
  assert.equal(model.buy?.label, 'Unlock for 5,99 €');
  assert.equal(model.buy?.enabled, true);
  assert.equal(model.restore, 'Restore purchase');
  assert.equal(model.close, 'Not now');
  assert.equal(model.notice, null);
});

test('⚠ no price from Google means no price at all, never a remembered one', () => {
  const model = unlockSheetModel(input({ state: { kind: 'offer', price: null } }));
  assert.equal(model.buy?.label, 'Unlock');
  assert.doesNotMatch(JSON.stringify(model), /\d[.,]\d\d/);
});

test('it says what was earned and how much is waiting, in the user\'s language', () => {
  assert.equal(
    unlockSheetModel(input()).earned,
    'You have collected 14 places, and 8 stamps are waiting to be seen.'
  );
  assert.equal(
    unlockSheetModel(input({ waiting: 1 })).earned,
    'You have collected 14 places, and 1 stamp is waiting to be seen.'
  );
  assert.equal(
    unlockSheetModel(input({ language: 'pt' })).earned,
    'Já visitou 14 lugares, e 8 carimbos estão à espera de serem vistos.'
  );
  assert.match(unlockSheetModel(input({ waiting: 0 })).earned, /Every stamp you collect/);
});

test('⚠ it never offers what the app does not have yet', () => {
  // Medals (T-235) and the founder stamp (T-233) are listed only when they exist.
  const plain = unlockSheetModel(input()).adds.join(' ');
  assert.doesNotMatch(plain, /medal|founder/i);
  const full = unlockSheetModel(input({ offers: { medals: true, founder: true } })).adds.join(' ');
  assert.match(full, /medal/i);
  assert.match(full, /founder/i);
});

test('every list says it is one payment and no subscription', () => {
  assert.ok(unlockSheetModel(input()).adds.some((line) => /One payment\. No subscription\./.test(line)));
});

test('while Google is working, Buy waits and says so', () => {
  const model = unlockSheetModel(input({ state: { kind: 'working' } }));
  assert.equal(model.buy?.enabled, false);
  assert.equal(model.buy?.label, 'Waiting for Google Play');
});

test('pending: told why it is closed, and nothing to buy twice', () => {
  const model = unlockSheetModel(input({ state: { kind: 'pending' } }));
  assert.match(model.notice ?? '', /Payment pending/);
  assert.equal(model.buy, null);
  assert.equal(model.restore, 'Restore purchase');
});

test('offline is never an error, and Buy stays to try again', () => {
  const model = unlockSheetModel(input({ state: { kind: 'offline' } }));
  assert.match(model.notice ?? '', /later, when you have a connection/);
  assert.equal(model.buy?.enabled, true);
});

test('⚠ unavailable does not claim the phone has no Google Play', () => {
  // billing-unavailable can also be an old Play Store or an unsupported country.
  const model = unlockSheetModel(input({ state: { kind: 'unavailable' } }));
  assert.doesNotMatch(model.notice ?? '', /does not have|no Google Play/i);
  assert.equal(model.buy, null);
  assert.equal(model.restore, null);
});

test('failed: an honest line and a retry, and no promise about charges', () => {
  // The app cannot know whether anything was charged, so it does not say.
  const model = unlockSheetModel(input({ state: { kind: 'failed' } }));
  assert.match(model.notice ?? '', /did not go through/);
  assert.doesNotMatch(model.notice ?? '', /charg/i);
  assert.equal(model.buy?.enabled, true);
});

test('unlocked: one way out, to the stamps', () => {
  const model = unlockSheetModel(input({ state: { kind: 'unlocked' } }));
  assert.match(model.notice ?? '', /unlocked/);
  assert.equal(model.buy, null);
  assert.equal(model.restore, null);
  assert.equal(model.close, 'See my stamps');
});

test('a restore that finds nothing says so, and the offer stays', () => {
  const model = unlockSheetModel(input({ state: { kind: 'nothingToRestore', price: null } }));
  assert.match(model.notice ?? '', /found no purchase/);
  assert.equal(model.buy?.enabled, true);
});

test('what each failure from the store becomes', () => {
  const price = '5,99 €';
  // ⚠ Closing Google's sheet arrives while the sheet says "waiting": it must go
  // back to the offer with its price, quietly, and never stay waiting.
  assert.deepEqual(stateAfterFailure('cancelled', price), { kind: 'offer', price });
  assert.deepEqual(stateAfterFailure('cancelled', null), { kind: 'offer', price: null });
  assert.deepEqual(stateAfterFailure('pending', price), { kind: 'pending' });
  assert.deepEqual(stateAfterFailure('offline', price), { kind: 'offline' });
  assert.deepEqual(stateAfterFailure('unavailable', price), { kind: 'unavailable' });
  assert.deepEqual(stateAfterFailure('failed', price), { kind: 'failed' });
  // Already owned: the screen runs a restore, which unlocks.
  assert.deepEqual(stateAfterFailure('alreadyOwned', price), { kind: 'working' });
});

test('no text a user reads has a dash, in any language or state', () => {
  const states: UnlockSheetInput['state'][] = [
    { kind: 'offer', price: '5,99 €' },
    { kind: 'offer', price: null },
    { kind: 'working' },
    { kind: 'pending' },
    { kind: 'offline' },
    { kind: 'unavailable' },
    { kind: 'failed' },
    { kind: 'unlocked' },
    { kind: 'nothingToRestore', price: null },
  ];
  for (const language of ['en', 'pt', 'de'] as const) {
    for (const state of states) {
      for (const waiting of [0, 1, 8]) {
        const text = JSON.stringify(
          unlockSheetModel(input({ state, language, waiting, offers: { medals: true, founder: true } }))
        );
        assert.doesNotMatch(text, /[–—]/, `${language} ${state.kind}`);
      }
    }
  }
});

test('pure: no runtime import except the strings and the translator', () => {
  const source = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'unlockSheet.ts'),
    'utf8'
  );
  for (const line of source.match(/^import .*$/gm) ?? []) {
    assert.match(line, /^import type |from '\.\.\/i18n\/(strings|translate)\.ts'/, line);
  }
});

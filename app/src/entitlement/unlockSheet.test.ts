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

import { showcase, stateAfterFailure, unlockSheetModel, type UnlockSheetInput } from './unlockSheet.ts';

function input(overrides: Partial<UnlockSheetInput> = {}): UnlockSheetInput {
  return {
    state: { kind: 'offer' },
    price: '5,99 €',
    waiting: 8,
    offers: { medals: false, founder: false },
    language: 'en',
    ...overrides,
  };
}

test('D-097, sheet A: the headline counts what is waiting, and the button offers to see it', () => {
  const model = unlockSheetModel(input());
  assert.equal(model.eyebrow, 'YOUR PASSPORT');
  assert.equal(model.title, 'You have 8 stamps waiting for you');
  assert.equal(model.earned, "You've been there. All that's left is to see them.");
  assert.equal(model.buy?.label, 'See my stamps · 5,99 €');
  assert.equal(unlockSheetModel(input({ waiting: 1 })).title, 'You have 1 stamp waiting for you');
});

test('D-097, sheet A, in Portuguese as the project lead chose it', () => {
  const model = unlockSheetModel(input({ language: 'pt' }));
  assert.equal(model.eyebrow, 'O TEU PASSAPORTE');
  assert.equal(model.title, 'Tens 8 carimbos à tua espera');
  assert.equal(model.earned, 'Já lá estiveste. Só falta vê-los.');
  assert.equal(model.buy?.label, 'Ver os meus carimbos · 5,99 €');
  assert.equal(unlockSheetModel(input({ language: 'pt', waiting: 1 })).title, 'Tens 1 carimbo à tua espera');
  // One stamp is "it" (P30, 2026-10-10: the sheet said "vê-los" for one).
  assert.equal(unlockSheetModel(input({ language: 'pt', waiting: 1 })).earned, 'Já lá estiveste. Só falta vê-lo.');
});

test('with nothing waiting (from Settings), the plain offer names the price Google gave', () => {
  const model = unlockSheetModel(input({ waiting: 0 }));
  assert.equal(model.title, 'Unlock your passport');
  assert.equal(model.buy?.label, 'Unlock for 5,99 €');
  assert.equal(model.buy?.enabled, true);
  assert.equal(model.restore, 'Restore purchase');
  assert.equal(model.close, 'Not now');
  assert.equal(model.notice, null);
});

test('⚠ no price from Google means no price at all, never a remembered one', () => {
  assert.equal(unlockSheetModel(input({ price: null })).buy?.label, 'See my stamps');
  const model = unlockSheetModel(input({ price: null, waiting: 0 }));
  assert.equal(model.buy?.label, 'Unlock');
  assert.doesNotMatch(JSON.stringify(model), /\d[.,]\d\d/);
});

test('with nothing waiting, it says what paying will show', () => {
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
  const model = unlockSheetModel(input({ state: { kind: 'nothingToRestore' } }));
  assert.match(model.notice ?? '', /found no purchase/);
  assert.equal(model.buy?.enabled, true);
});

test('what each failure from the store becomes', () => {
  // ⚠ Closing Google's sheet arrives while the sheet says "waiting": it must go
  // back to the offer, quietly, and never stay waiting.
  assert.deepEqual(stateAfterFailure('cancelled'), { kind: 'offer' });
  assert.deepEqual(stateAfterFailure('pending'), { kind: 'pending' });
  assert.deepEqual(stateAfterFailure('offline'), { kind: 'offline' });
  assert.deepEqual(stateAfterFailure('unavailable'), { kind: 'unavailable' });
  assert.deepEqual(stateAfterFailure('failed'), { kind: 'failed' });
  // Already owned: the screen runs a restore, which unlocks.
  assert.deepEqual(stateAfterFailure('alreadyOwned'), { kind: 'working' });
});

test("⚠ a failure keeps Google's price on the button (seen on the P30)", () => {
  // The first version kept the price in the offer state only, and after a
  // failed purchase the button fell back to a bare "Unlock".
  for (const kind of ['failed', 'offline', 'nothingToRestore', 'offer'] as const) {
    assert.equal(unlockSheetModel(input({ state: { kind } })).buy?.label, 'See my stamps · 5,99 €', kind);
    assert.equal(unlockSheetModel(input({ state: { kind }, waiting: 0 })).buy?.label, 'Unlock for 5,99 €', kind);
  }
});

test('no text a user reads has a dash, in any language or state', () => {
  const states: UnlockSheetInput['state'][] = [
    { kind: 'offer' },
    { kind: 'working' },
    { kind: 'pending' },
    { kind: 'offline' },
    { kind: 'unavailable' },
    { kind: 'failed' },
    { kind: 'unlocked' },
    { kind: 'nothingToRestore' },
  ];
  for (const language of ['en', 'pt', 'de'] as const) {
    for (const state of states) {
      for (const [waiting, price] of [[0, null], [1, '5,99 €'], [8, null]] as const) {
        const text = JSON.stringify(
          unlockSheetModel(input({ state, language, waiting, price, offers: { medals: true, founder: true } }))
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

test('with nothing waiting, the sheet shows three different places, chosen by the random source', () => {
  const places = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(showcase(places, 3, () => 0), ['a', 'b', 'c']);
  assert.deepEqual(showcase(places, 3, () => 0.99), ['e', 'd', 'c']);
  const picked = showcase(places, 3, Math.random);
  assert.equal(new Set(picked).size, 3);
  assert.deepEqual(showcase(['a', 'b'], 3, Math.random).sort(), ['a', 'b']);
  assert.deepEqual(places, ['a', 'b', 'c', 'd', 'e'], 'the catalogue is not reordered');
});

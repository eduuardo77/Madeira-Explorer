/**
 * The replica of Android's dialog says what the phone says (T-250).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { alwaysOpensSettings, systemAskFor } from './systemAsk.ts';

const P30 = { android: true, apiLevel: 29, language: 'pt' as const };
const PIXEL = { android: true, apiLevel: 34, language: 'pt' as const };

test('T-250: the P30 (Android 10) is told to pick the button its own dialog shows', () => {
  // Read off the P30's PermissionController, 2026-10-05.
  const location = systemAskFor('location', P30);
  assert.deepEqual(location, {
    kind: 'dialog',
    options: ['Permitir apenas durante a utilização da aplicação', 'Recusar'],
    pick: 0,
  });
  const always = systemAskFor('always', P30);
  assert.equal(always?.kind, 'dialog');
  assert.deepEqual(always?.options, ['Permitir sempre', 'Manter acesso durante a utilização']);
});

test('T-250: Android 11 and later get their own words, and Always on a settings page', () => {
  assert.deepEqual(systemAskFor('location', PIXEL)?.options, ['Enquanto uso a app', 'Apenas desta vez', 'Não permitir']);
  const always = systemAskFor('always', PIXEL);
  assert.equal(always?.kind, 'settings');
  assert.equal(always?.options[always.pick], 'Permitir sempre');
  assert.equal(alwaysOpensSettings(PIXEL), true);
  assert.equal(alwaysOpensSettings(P30), false);
});

test('T-250: "Deny" became "Don\'t allow" at Android 12', () => {
  assert.deepEqual(systemAskFor('activity', { ...P30, language: 'en' })?.options, ['Allow', 'Deny']);
  assert.deepEqual(systemAskFor('activity', { ...PIXEL, language: 'en' })?.options, ['Allow', 'Don’t allow']);
});

test('T-250: every ask marks an answer that exists, in every language', () => {
  const asks = ['location', 'always', 'activity', 'notifications', 'keep-running', 'always-upgrade', 'downgrade'] as const;
  for (const language of ['en', 'pt', 'de'] as const) {
    for (const apiLevel of [29, 30, 31, 34]) {
      for (const ask of asks) {
        const replica = systemAskFor(ask, { android: true, apiLevel, language });
        assert.ok(replica !== null, `${ask} ${apiLevel} ${language}`);
        assert.ok(replica.options.length >= 2);
        assert.ok(replica.options.every((label) => label.length > 0 && !label.includes('{')));
        assert.ok(replica.pick >= 0 && replica.pick < replica.options.length);
      }
    }
  }
});

test('T-250: iOS draws no replica', () => {
  assert.equal(systemAskFor('location', { android: false, apiLevel: 0, language: 'en' }), null);
});

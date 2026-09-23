/**
 * The tests that stop translations rotting (T-160).
 *
 *     cd app && npm test
 *
 * ⚠ **The parity tests are the whole point of this file.** Translations do not
 * fail loudly — they fail by a Portuguese user quietly seeing English, months
 * after somebody added a string in a hurry. Nothing in a code review catches
 * that, and no manual test catches it either unless the reviewer speaks all three
 * languages. So it is a build rule instead.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LANGUAGES, FALLBACK_LANGUAGE, languageFor } from './languages.ts';
import { PLURALS, STRINGS } from './strings.ts';
import { interpolate, plural, translate } from './translate.ts';

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('⚠ every string exists in every language, and none is empty', () => {
  const missing: string[] = [];
  for (const [key, phrase] of Object.entries(STRINGS)) {
    for (const language of LANGUAGES) {
      const text = (phrase as Record<string, string>)[language];
      if (typeof text !== 'string' || text.trim() === '') {
        missing.push(`${key} [${language}]`);
      }
    }
  }
  assert.deepEqual(missing, [], `untranslated strings:\n  ${missing.join('\n  ')}`);
});

test('⚠ every plural exists in both forms in every language', () => {
  const missing: string[] = [];
  for (const [key, forms] of Object.entries(PLURALS)) {
    for (const form of ['one', 'other'] as const) {
      for (const language of LANGUAGES) {
        const text = (forms[form] as Record<string, string>)[language];
        if (typeof text !== 'string' || text.trim() === '') {
          missing.push(`${key}.${form} [${language}]`);
        }
      }
    }
  }
  assert.deepEqual(missing, [], `untranslated plurals:\n  ${missing.join('\n  ')}`);
});

test('⚠⚠ a translation may not drop or invent a placeholder', () => {
  // The failure this catches is specific and nasty: a translator writes natural
  // prose and quietly loses `{app}`, so the German notification reads "merkt
  // sich, wo Sie gewesen sind" with no subject — or invents `{name}`, which
  // renders literally as "{name}" on a stranger's phone.
  const wrong: string[] = [];
  for (const [key, phrase] of Object.entries(STRINGS)) {
    const expected = placeholders((phrase as Record<string, string>)[FALLBACK_LANGUAGE]);
    for (const language of LANGUAGES) {
      const got = placeholders((phrase as Record<string, string>)[language]);
      if (got.join(',') !== expected.join(',')) {
        wrong.push(`${key} [${language}]: expected {${expected.join('} {')}}, got {${got.join('} {')}}`);
      }
    }
  }
  assert.deepEqual(wrong, [], `placeholder mismatch:\n  ${wrong.join('\n  ')}`);
});

test('the device locale maps to a language we actually have', () => {
  assert.equal(languageFor(['pt-PT']), 'pt');
  assert.equal(languageFor(['de-AT']), 'de');
  assert.equal(languageFor(['en-GB']), 'en');
});

test('⚠ a regional variant we did not write for still gets its language', () => {
  // Refusing pt-BR because the strings are European Portuguese would hand a
  // Brazilian visitor English, which is worse in every direction.
  assert.equal(languageFor(['pt-BR']), 'pt');
  assert.equal(languageFor(['de-CH']), 'de');
});

test('an unknown language falls back to English rather than failing', () => {
  assert.equal(languageFor(['fi-FI']), 'en');
  assert.equal(languageFor([]), 'en');
  assert.equal(languageFor(['nonsense', '', 'pt']), 'pt');
});

test('the phone’s preference order is respected', () => {
  // Somebody with German first and Portuguese second gets German.
  assert.equal(languageFor(['de-DE', 'pt-PT']), 'de');
  assert.equal(languageFor(['fr-FR', 'pt-PT']), 'pt');
});

test('placeholders are filled, and an unknown one is left visible', () => {
  // ⚠ A made-up value on purpose: using the real app name here trips
  // `brand.test.ts`, which is the guard working correctly. Interpolation does not
  // care what the value is.
  assert.equal(interpolate('Look for {app}', { app: 'Somewhere' }), 'Look for Somewhere');
  // Left alone rather than blanked: a visible {oops} is a bug report, a silent
  // gap is a mystery.
  assert.equal(interpolate('Look for {oops}', {}), 'Look for {oops}');
});

test('translate returns the asked-for language', () => {
  assert.equal(translate(STRINGS['passport.title'], 'pt'), 'Passaporte');
  assert.equal(translate(STRINGS['passport.title'], 'de'), 'Reisepass');
});

test('⚠ zero takes the plural form, in all three languages', () => {
  for (const language of LANGUAGES) {
    const zero = plural(PLURALS['passport.collected'], 0, language);
    const many = plural(PLURALS['passport.collected'], 7, language);
    assert.equal(zero, many, `${language}: zero should read like any other count`);
  }
});

test('exactly one takes the singular', () => {
  assert.equal(plural(PLURALS['passport.collected'], 1, 'en'), 'place collected');
  assert.equal(plural(PLURALS['passport.collected'], 2, 'en'), 'places collected');
  assert.equal(plural(PLURALS['passport.collected'], 1, 'pt'), 'lugar visitado');
  assert.equal(plural(PLURALS['passport.collected'], 3, 'pt'), 'lugares visitados');
});

test('a counted phrase can use the count it was given', () => {
  const text = plural(PLURALS['passport.a11y.openWithCount'], 3, 'en', {
    collected: 3,
    total: 60,
  });
  assert.equal(text, 'Open your passport, 3 of 60 places collected');
});

/**
 * Promises the app cannot keep, in any language (D-073, teardown §1, T-193).
 * `/never uploaded/` joined 2026-09-23: the iOS permission texts said it.
 */
const BANNED_PRIVACY_CLAIMS = [
    /leaves (this|your|the) phone/i, /nothing is uploaded/i, /never uploaded/i, /\bno backup\b/i, /only copy/i,
    /sai d[oe]s?t?e? telemóvel/i, /nada é enviado/i, /não há cópia de segurança/i, /única cópia/i,
    /verlässt (dieses|Ihr) Telefon/i, /nichts wird hochgeladen/i, /keine Sicherung/i, /einzige Kopie/i,
    /works offline/i,
    // T-193: the absolute forms of "uploaded" and "shared" in all three.
    /nunca é enviad[oa]/i, /nie hochgeladen/i,
    /never shared/i, /nunca é partilhad[oa]/i, /nie weitergegeben/i,
];

test('⚠ no string claims the trip never leaves the phone, or that there is no backup', () => {
  // D-073 bans "nothing leaves your phone" (Google's basemap, D-057), and it is
  // false a second way: plugins/withAndroidBackupRules.js puts the database in
  // the phone's own Google/iCloud backup on purpose (ARCHITECTURE §4a). Six
  // strings said otherwise until 2026-09-22 — one of them inside the erase
  // confirmation, at the moment the user decides (reference-app-teardown §1).
  const banned = BANNED_PRIVACY_CLAIMS;
  const found: string[] = [];
  for (const [key, phrase] of Object.entries(STRINGS)) {
    for (const [language, text] of Object.entries(phrase as Record<string, string>)) {
      if (banned.some((re) => re.test(text))) found.push(`${key} [${language}]`);
    }
  }
  assert.deepEqual(found, [], `strings that promise more than the app keeps:\n  ${found.join('\n  ')}`);
});


test('⚠ T-193 — the permission texts in app.json make no promise the app cannot keep', () => {
  // The review (P0-7) found "Your location stays on this phone and is never
  // uploaded" in the iOS purpose strings: the absolute claim D-073 forbids, in
  // the text a reviewer, a journalist or a data-protection authority reads
  // first. The in-app copy already said the true thing: never sent *to us*.
  const appJson = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'app.json');
  const texts: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') texts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(JSON.parse(readFileSync(appJson, 'utf8')));
  const found = texts.filter((text) => BANNED_PRIVACY_CLAIMS.some((re) => re.test(text)));
  assert.deepEqual(found, []);
  // And the probe is real: the permission texts are in what it read.
  assert.ok(texts.some((text) => /never sent to us/.test(text)));
});

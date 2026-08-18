/**
 * Tests for the privacy policy (T-124).
 *
 *     cd app && npm test
 *
 * A privacy policy is prose, and most of it cannot be tested. Three things
 * can, and each of them is a way this document has failed elsewhere:
 *
 *   1. **It says the two things a careless policy omits.** "Nothing leaves
 *      your phone" is very nearly true here, and the two exceptions — the
 *      device's own backup, and anything the user shares — are exactly what
 *      gets left out when a policy is written from the marketing line instead
 *      of from the code.
 *   2. **It is readable.** D-015 and CONTEXT §6.5 apply here as much as to any
 *      screen. The vocabulary is checked rather than eyeballed, the same way
 *      T-114 checked the onboarding copy.
 *   3. **It never ships a placeholder contact address.** The constant is null
 *      until somebody decides what it should be, and the section is omitted
 *      rather than filled with something fake — the same stance D-041 takes on
 *      the unmeasured battery figure.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_NAME } from '../brand.ts';
import {
  CONTACT_EMAIL,
  POLICY_VERSION,
  policySections,
  policyText,
} from './privacyPolicy.ts';

// ---------------------------------------------------------------------------
// 1. The two honest exceptions
// ---------------------------------------------------------------------------

test('the policy admits the trip is in the phone’s own backup', () => {
  // ARCHITECTURE §4a puts the database in normal encrypted device backup on
  // purpose — it is the answer to "my phone died on day 5". A policy that says
  // "nothing ever leaves your phone" while a copy goes to iCloud is false, and
  // false in the direction that matters.
  const text = policyText().toLowerCase();

  assert.ok(text.includes('icloud'), 'iCloud is not mentioned');
  assert.ok(text.includes('google'), 'Google backup is not mentioned');
  assert.ok(text.includes('backup'), 'backups are not mentioned');
});

test('the policy admits that sharing the souvenir publishes where you went', () => {
  const text = policyText().toLowerCase();

  assert.ok(text.includes('share') || text.includes('sharing'));
  // D-040: masking is unconditional, and the app withholds rather than
  // exporting something it could not verify. Both are promises to the user and
  // both belong in the document that makes promises.
  assert.ok(
    text.includes('where you slept'),
    'the accommodation masking is not described'
  );
  assert.ok(
    text.includes('no setting to switch it off'),
    'the policy does not say the masking cannot be turned off'
  );
});

test('the policy states there is no account and no server', () => {
  const text = policyText().toLowerCase();

  assert.ok(text.includes('no account'));
  assert.ok(text.includes('no server'));
  assert.ok(text.includes('no adverts') || text.includes('no ads'));
});

test('the policy explains how to delete everything', () => {
  const text = policyText().toLowerCase();

  assert.ok(text.includes('eras'), 'erasing is not explained');
  // There is genuinely nothing to request from us, and saying so is more
  // useful than an address that cannot help.
  assert.ok(text.includes('cannot be undone'));
});

// ---------------------------------------------------------------------------
// 2. Readable
// ---------------------------------------------------------------------------

test('no jargon reaches the reader', () => {
  // The same check that was run over the onboarding DOM (T-114). Each of these
  // is a word somebody writing this from the code rather than for the reader
  // would use without noticing.
  const banned = [
    'geofence',
    'sdk',
    'api',
    'telemetry',
    'analytics',
    'third-party',
    'third party',
    'gps',
    'metadata',
    'processing',
    'data controller',
    'opt-in',
    'opt out',
    'aggregate',
    'anonymi', // anonymised / anonymized — a word that promises more than it means
    'pursuant',
    'herein',
  ];
  const text = policyText().toLowerCase();

  for (const word of banned) {
    assert.ok(!text.includes(word), `the policy says "${word}"`);
  }
});

test('sentences stay short enough to read', () => {
  // Not a style preference: this document exists to be understood by somebody
  // deciding whether to trust the app with a week of their location, and
  // CONTEXT §6.5's target reader is 80 years old.
  const longest = policyText()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().split(/\s+/).length)
    .reduce((a, b) => Math.max(a, b), 0);

  assert.ok(longest <= 45, `the longest sentence is ${longest} words`);
});

test('every section has a heading and something under it', () => {
  const sections = policySections();

  assert.ok(sections.length >= 6);
  for (const section of sections) {
    assert.ok(section.heading.length > 0);
    assert.ok(section.paragraphs.length > 0, `${section.heading} is empty`);
    for (const paragraph of section.paragraphs) {
      assert.ok(paragraph.trim().length > 0, `${section.heading} has a blank`);
    }
  }
});

test('the app is named, and dated', () => {
  assert.ok(policyText().includes(APP_NAME));
  assert.match(POLICY_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

// ---------------------------------------------------------------------------
// 3. No placeholder contact
// ---------------------------------------------------------------------------

test('there is no invented contact address, and no empty section either', () => {
  // ⚠ This test is what stops `example@example.com` shipping. When a real
  // address is decided, CONTACT_EMAIL is set and the section appears — this
  // test then checks the section is real rather than checking it is absent.
  const headings = policySections().map((section) => section.heading);

  if (CONTACT_EMAIL === null) {
    assert.ok(
      !headings.includes('Getting in touch'),
      'a contact section exists with no address in it'
    );
    // Nothing that looks like an address may appear anywhere in the text.
    assert.ok(
      !/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(policyText()),
      'the policy contains an email address that is not CONTACT_EMAIL'
    );
  } else {
    assert.ok(headings.includes('Getting in touch'));
    assert.ok(policyText().includes(CONTACT_EMAIL));
    assert.ok(
      !CONTACT_EMAIL.includes('example'),
      'CONTACT_EMAIL is still a placeholder'
    );
  }
});

/**
 * The Portuguese policy (T-160b).
 *
 * ⚠ **The risk here is not a clumsy sentence, it is a missing promise.** This is
 * a compliance document: if the Portuguese quietly drops "no account" or "never
 * uploaded", the app is making different commitments to different users, and the
 * one who was told less is the one who cannot read the original.
 */

test('⚠ the Portuguese policy makes the same promises as the English one', () => {
  const pt = policyText('pt').toLowerCase();

  // Each pair is one commitment, in both languages. The English is already
  // asserted above; this checks the Portuguese did not lose it in translation.
  const promises: [string, string][] = [
    ['no account', 'não há conta'],
    ['no server', 'não há servidor'],
    ['never sent to us', 'nunca nos é enviada'],
    ['no adverts', 'não há publicidade'],
    ['never leaves the phone', 'nunca sai do telemóvel'],
  ];

  const lost = promises.filter(([, portuguese]) => !pt.includes(portuguese));
  assert.deepEqual(
    lost.map(([english]) => english),
    [],
    'the Portuguese policy is missing a promise the English one makes'
  );
});

test('⚠ the Portuguese policy has every section the English one has', () => {
  // A dropped section is the quietest possible failure: nothing looks wrong,
  // there is simply less policy in one language.
  assert.equal(
    policySections('pt').length,
    policySections('en').length,
    'the two policies have a different number of sections'
  );
});

test('⚠ a German reader is told which languages the policy exists in', () => {
  // Not silently served English, which reads as a failed translation rather
  // than a decision. See LANGUAGE_NOTE in privacyPolicy.ts.
  const de = policySections('de');
  assert.equal(de.length, policySections('en').length + 1);
  assert.match(de[0].paragraphs[0], /Englisch und Portugiesisch/);
});

test('the Portuguese policy still names the app', () => {
  assert.ok(policyText('pt').includes(APP_NAME));
});

test('⚠ Portuguese sentences stay as short as the English ones', () => {
  // D-015 and CONTEXT §6.5 apply in every language: a policy an eighty-year-old
  // will not read is decoration. Portuguese runs longer than English by nature,
  // so the bar is a little higher rather than absent.
  const longest = policyText('pt')
    .split(/(?<=[.!?])\s+/)
    .reduce((worst, sentence) => Math.max(worst, sentence.split(/\s+/).length), 0);
  assert.ok(longest <= 60, `longest Portuguese sentence is ${longest} words`);
});

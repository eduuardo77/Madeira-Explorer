/**
 * Tests for the confirmation prompt (T-149, D-065).
 *
 *     cd app && npm test
 *
 * Three of the four rules in the module header are mechanical, so they are
 * pinned here: ask once, ask about one thing, and never ask about a stamp
 * already held. The fourth — *a confirmation, never a claim* — is a rule about
 * what does **not** exist, and the test for it is that there is no function in
 * this module that awards anything without evidence attached.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIRMED_CONFIDENCE,
  confirmationReason,
  nextPrompt,
  type ConfirmationCandidate,
} from './stampConfirmation.ts';

const furado: ConfirmationCandidate = {
  placeId: 'levada-do-furado',
  name: 'Levada do Furado',
  evidence: 'walked 2.1 km of 5.0 km (42%)',
};
const rei: ConfirmationCandidate = {
  placeId: 'levada-do-rei',
  name: 'Levada do Rei',
  evidence: 'walked 1.6 km of 4.8 km (33%)',
};

test('the question names the place and carries the evidence', () => {
  const prompt = nextPrompt([furado], new Set());
  assert.ok(prompt !== null);
  assert.equal(prompt.question, 'Did you walk the Levada do Furado?');
  assert.match(prompt.detail, /2\.1 km of 5\.0 km/);
  // The affirmative says what it does — "Yes" alone means nothing read aloud.
  assert.equal(prompt.confirmLabel, 'I walked it');
});

test('one question at a time, however many walks qualify', () => {
  const prompt = nextPrompt([furado, rei], new Set());
  assert.equal(prompt?.placeId, 'levada-do-furado');
});

test('a declined question is never asked again', () => {
  const declined = new Set(['levada-do-furado']);
  assert.equal(nextPrompt([furado], declined), null);
  // …and the next candidate moves up rather than the screen going quiet.
  assert.equal(nextPrompt([furado, rei], declined)?.placeId, 'levada-do-rei');
});

test('a stamp already held is never asked about', () => {
  const awarded = new Set(['levada-do-furado']);
  assert.equal(nextPrompt([furado], new Set(), awarded), null);
});

test('nothing to ask is null, not an empty prompt', () => {
  assert.equal(nextPrompt([], new Set()), null);
});

test('a confirmed stamp keeps the machine’s evidence in its reason', () => {
  // T-131 retunes the thresholds by reading these rows: every confirmed walk is
  // a data point saying the bar was too high. A bare "confirmed by the user"
  // would throw that away.
  const reason = confirmationReason(furado.evidence);
  assert.match(reason, /confirmed by the user/);
  assert.match(reason, /2\.1 km/);
});

test('confirmed beats the machine, and still is not certainty', () => {
  assert.ok(CONFIRMED_CONFIDENCE > 0.7, 'the person who was there beats a partial trace');
  assert.ok(CONFIRMED_CONFIDENCE < 1, 'a stored 1.0 would later read as measured');
});

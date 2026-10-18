/**
 * The passport's kept trip line (2026-10-18).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePassportSummary, encodePassportSummary, type PassportSummary } from './passportSummary.ts';

const SUMMARY: PassportSummary = { tripId: 31, tripLitM: 263_312, totalLitM: 270_000, days: 12, canWatch: true };

test('a summary comes back as it was kept, for its own trip', () => {
  assert.deepEqual(decodePassportSummary(encodePassportSummary(SUMMARY), 31), SUMMARY);
});

test("another trip's summary is never shown", () => {
  assert.equal(decodePassportSummary(encodePassportSummary(SUMMARY), 32), null);
});

test('anything doubtful is dropped rather than shown', () => {
  assert.equal(decodePassportSummary(null, 31), null);
  assert.equal(decodePassportSummary('not json', 31), null);
  assert.equal(decodePassportSummary(JSON.stringify({ ...SUMMARY, days: -1 }), 31), null);
  assert.equal(decodePassportSummary(JSON.stringify({ ...SUMMARY, canWatch: 'yes' }), 31), null);
  assert.equal(decodePassportSummary(JSON.stringify({ ...SUMMARY, tripLitM: undefined }), 31), null);
});

/**
 * Tests for the released-object predicate (T-142).
 *
 *     cd app && npm test
 *
 * The whole safety argument for retrying is that this predicate is **narrow**:
 * the rejected call never executed, so repeating it cannot write twice. If it
 * ever starts matching a constraint violation or a disk error, the retry stops
 * being safe and starts hiding defects. That is what these pin down.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isReleasedSharedObject,
  MAX_RELEASED_OBJECT_RETRIES,
} from './releasedObject.ts';

/** The real thing, copied from the diary on 2026-08-14. */
const REAL = [
  "Call to function 'NativeStatement.runAsync' has been rejected.",
  '→ Caused by: The 1st argument cannot be cast to type class expo.modules.sqlite.NativeStatement (received class java.lang.Integer)',
  '→ Caused by: Cannot use shared object that was already released',
].join('\n');

test('the rejection this exists for is recognised', () => {
  assert.equal(isReleasedSharedObject(new Error(REAL)), true);
});

test('it is recognised from every call it arrives on', () => {
  // It has been seen on all three, which is why the match is on the cause and
  // not on the operation name.
  for (const call of ['runAsync', 'prepareAsync', 'finalizeAsync']) {
    const error = new Error(
      `Call to function 'NativeStatement.${call}' has been rejected.\n` +
        '→ Caused by: Cannot use shared object that was already released'
    );
    assert.equal(isReleasedSharedObject(error), true, call);
  }
});

test('a bare rejection that is not an Error still matches', () => {
  // Native modules do not always reject with an `Error`.
  assert.equal(isReleasedSharedObject(REAL), true);
});

test('⚠ REAL failures are not swallowed — this is the safety argument', () => {
  // Retrying any of these would either write twice or hide a defect.
  const mustNotMatch = [
    new Error('UNIQUE constraint failed: stamp_award.trip_id, stamp_award.place_id'),
    new Error('database or disk is full'),
    new Error('no such table: raw_fix'),
    new Error('raw_fix is append-only (CONTEXT 6.2)'),
    new Error('database is locked'),
    new Error('attempt to write a readonly database'),
  ];

  for (const error of mustNotMatch) {
    assert.equal(isReleasedSharedObject(error), false, error.message);
  }
});

test('nothing is not an error', () => {
  assert.equal(isReleasedSharedObject(null), false);
  assert.equal(isReleasedSharedObject(undefined), false);
});

test('the retry cap is small and finite', () => {
  // ⚠ An unbounded retry turns a permanently dead handle into a spin. The
  // diary is how this project finds things, so a real failure must reach it.
  assert.ok(MAX_RELEASED_OBJECT_RETRIES >= 1);
  assert.ok(MAX_RELEASED_OBJECT_RETRIES <= 3);
});

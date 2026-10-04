/**
 * Which new stamps to announce (D-096).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTold, stampNews } from './stampNews.ts';

test('the first run announces nothing and remembers everything already earned', () => {
  assert.deepEqual(stampNews(['a', 'b'], null), { announce: [], record: ['a', 'b'] });
});

test('a stamp earned since is announced once, then remembered', () => {
  const first = stampNews(['a', 'b'], ['a']);
  assert.deepEqual(first, { announce: ['b'], record: ['a', 'b'] });
  assert.deepEqual(stampNews(['a', 'b'], first.record).announce, []);
});

test('several new stamps are announced in the order they were earned', () => {
  assert.deepEqual(stampNews(['a', 'c', 'b'], ['a']).announce, ['c', 'b']);
});

test('an unreadable record seeds again rather than announcing a backlog', () => {
  assert.equal(parseTold('not json'), null);
  assert.equal(parseTold('{"a":1}'), null);
  assert.deepEqual(parseTold('["a"]'), ['a']);
  assert.equal(parseTold(null), null);
});

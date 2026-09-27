/**
 * Moving or at rest, from the speed the phone reported (D-093).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { movingMask, speedCeiling } from './motionGate.ts';
import { fixAt } from './testNetwork.ts';

/**
 * The desk's drift, as measured on the P30 on 22 to 25 September: a fix every
 * 10 s wandering out to 44 m and back, at ±5 m, reporting 0.1 to 0.4 m/s.
 * By position that is a slow walk.
 */
function deskDrift() {
  const metresOut = [0, 2, 1, 23, 29, 34, 39, 44, 38, 27, 20, 12, 3, 1, 0];
  const speeds = [0.04, 0.03, 0.05, 0.27, 0.25, 0.19, 0.15, 0.13, 0.12, 0.34, 0.2, 0.14, 0.05, 0.04, 0.03];
  return metresOut.map((m, i) => fixAt(i * 10, m, 0, speeds[i]));
}

test('the desk drift is at rest, although its positions move like a walk', () => {
  const fixes = deskDrift();
  assert.ok(movingMask(fixes).every((moving) => !moving));
});

test('one wild speed in the drift does not make it move', () => {
  // Measured: a few drift fixes reported 1 to 9 m/s, one at a time.
  const fixes = deskDrift();
  fixes[6] = { ...fixes[6], speed_mps: 8.9 };
  assert.ok(movingMask(fixes).every((moving) => !moving));
});

test('a walk is moving, including a slow stretch', () => {
  const speeds = [1.3, 1.4, 1.2, 0.7, 0.6, 1.1, 1.4, 1.5];
  const fixes = speeds.map((v, i) => fixAt(i * 10, i * 13, 0, v));
  assert.ok(movingMask(fixes).every((moving) => moving));
});

test('exactly zero is "no speed", and displacement decides', () => {
  // Android writes 0 when a fix has no speed at all (network fixes). A walk
  // on such fixes must not read as standing still.
  const walking = Array.from({ length: 8 }, (_, i) => fixAt(i * 30, i * 42, 0, 0, 30));
  assert.ok(movingMask(walking).every((moving) => moving), 'moving by displacement');

  const still = Array.from({ length: 8 }, (_, i) => fixAt(i * 30, (i % 2) * 6, 0, 0, 30));
  assert.ok(still.every((_, i) => !movingMask(still)[i]), 'at rest by displacement');
});

test('the speed ceiling is the fastest reported nearby, ignoring zeros', () => {
  const fixes = [
    fixAt(0, 0, 0, 1.2),
    fixAt(10, 12, 0, 0),
    fixAt(20, 25, 0, 1.6),
    fixAt(100, 125, 0, 0),
  ];
  const ceiling = speedCeiling(fixes);
  assert.equal(ceiling[0], 1.6);
  assert.equal(ceiling[1], 1.6);
  assert.equal(ceiling[3], null, 'nothing within 30 s reported a speed');
});

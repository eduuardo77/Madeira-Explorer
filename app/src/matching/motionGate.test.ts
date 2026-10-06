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

/** D-094: the motion sensors as a second witness. */
test('still vetoes a slow median speed, but not a car the receiver clearly measures', () => {
  const slowDrift = Array.from({ length: 10 }, (_, i) => ({ ...fixAt(i * 10, i * 6, 0, 0.8 + i * 1e-3), activity: 'still' as const }));
  assert.ok(movingMask(slowDrift).every((moving) => !moving), '0.8 m/s would pass alone; still vetoes it');

  const pullingAway = Array.from({ length: 10 }, (_, i) => ({ ...fixAt(i * 10, i * 60, 0, 6 + i * 0.1), activity: 'still' as const }));
  assert.ok(movingMask(pullingAway).every((moving) => moving), 'the label lags; 6 m/s is not still');
});

test('with no speeds, the motion sensors decide before the positions do', () => {
  const walkingOnWifi = Array.from({ length: 6 }, (_, i) => ({ ...fixAt(i * 30, (i % 2) * 10, 0, 0, 30), activity: 'walking' as const }));
  assert.ok(movingMask(walkingOnWifi).every((moving) => moving));

  const stillButJumping = Array.from({ length: 6 }, (_, i) => ({ ...fixAt(i * 30, i * 60, 0, 0, 30), activity: 'still' as const }));
  assert.ok(stillButJumping.every((_, i) => !movingMask(stillButJumping)[i]), 'wifi jumps are not a walk when the phone is still');
});

/**
 * 2026-10-06, the P30 after a ride: every fix at home carried the last riding
 * speed, 8.589351654052734 m/s, and the motion label still said *driving*.
 */
test('a speed copied onto a phone at rest does not make it move, nor does a lagging driving label', () => {
  const copied = 8.589351654052734;
  const atHome = Array.from({ length: 30 }, (_, i) => ({
    ...fixAt(i * 10, (i % 4) * 3, (i % 3) * 2, copied, 18),
    activity: 'driving' as const,
  }));
  assert.ok(movingMask(atHome).every((moving) => !moving), 'nothing at home is movement');
  assert.ok(speedCeiling(atHome).slice(4).every((ceiling) => ceiling === null), 'beyond the first reading, a copy bounds nothing');
});

test('a genuine ride is still moving, and its first reading is not mistaken for a copy', () => {
  const ride = Array.from({ length: 12 }, (_, i) => ({
    ...fixAt(i * 10, i * 85, 0, 8.4 + Math.sin(i) * 0.6),
    activity: 'driving' as const,
  }));
  assert.ok(movingMask(ride).every((moving) => moving));
});

test('a copy among measured desk speeds leaves the desk at rest', () => {
  // 4 October: 1.2663035392 m/s at ±100 m kept reappearing at home between
  // real readings of a few centimetres a second.
  const fixes = Array.from({ length: 15 }, (_, i) =>
    fixAt(i * 10, (i % 5) * 4, 0, i % 4 === 0 ? 1.2663035392 : 0.03 + i * 1e-3)
  );
  assert.ok(movingMask(fixes).every((moving) => !moving));
});

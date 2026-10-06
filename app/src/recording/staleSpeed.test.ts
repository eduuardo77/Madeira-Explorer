/**
 * Speeds the phone copied rather than measured (2026-10-06).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { meanFreshSpeed, staleSpeedMask } from './staleSpeed.ts';

const fix = (seconds: number, speed: number | null) => ({ ts: 1_800_000_000_000 + seconds * 1000, speed_mps: speed });

test('a speed repeated at later moments is a copy; its first appearance is not', () => {
  // The P30 at home after the ride, 8.589351654052734 m/s on every fix.
  const fixes = [fix(0, 8.589351654052734), fix(10, 8.589351654052734), fix(20, 8.589351654052734)];
  assert.deepEqual(staleSpeedMask(fixes), [false, true, true]);
});

test('measured speeds that differ in the last digits are all kept', () => {
  const fixes = [fix(0, 1.2663035392), fix(6, 1.2653149366), fix(13, 1.2458184957)];
  assert.deepEqual(staleSpeedMask(fixes), [false, false, false]);
});

test('a copy is recognised hours later, across other readings and fixes without speed', () => {
  // 22 August: a motorway speed came back six hours later at a standstill.
  const fixes = [fix(0, 31.748403549), fix(3, 31.6), fix(3600, 0), fix(4 * 3600, null), fix(6 * 3600, 31.748403549)];
  assert.deepEqual(staleSpeedMask(fixes), [false, false, false, false, true]);
});

test('one fix stored twice is not a copy, and zero is never one', () => {
  const fixes = [fix(0, 0.198), fix(0, 0.198), fix(10, 0), fix(20, 0)];
  assert.deepEqual(staleSpeedMask(fixes), [false, false, false, false]);
});

test('speeds seen before the window mark copies inside it', () => {
  const fixes = [fix(100, 8.5), fix(110, 0.4)];
  assert.deepEqual(staleSpeedMask(fixes, new Set([8.5])), [true, false]);
});

test('the mean leaves copies out, still counts zero, and is null when nothing is left', () => {
  // A stop after a ride: the copies alone would refuse the stamp as a drive-by.
  const stop = [fix(0, 0.3), fix(10, 0), fix(20, 0.5)];
  assert.deepEqual(meanFreshSpeed(stop, new Set([8.589351654052734])), { meanSpeedMps: 0.8 / 3, fixCount: 3 });

  const copiesOnly = [fix(0, 8.589351654052734), fix(10, 8.589351654052734)];
  assert.deepEqual(meanFreshSpeed(copiesOnly, new Set([8.589351654052734])), { meanSpeedMps: null, fixCount: 0 });
});

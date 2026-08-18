/**
 * Tests for the replay's clock (T-105e).
 *
 *     cd app && npm test
 *
 * The whole point of this module existing is that pausing is where players go
 * wrong, so most of these are about a pause: that time does not pass while
 * paused, that resuming does not jump, and that the sums survive being done
 * twice.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STOPPED,
  isFinished,
  isPlaying,
  pause,
  play,
  positionMs,
  restart,
} from './playback.ts';

const DURATION = 10_000;
const T = 1_800_000_000_000;

test('a stopped player sits at the first frame and stays there', () => {
  assert.equal(positionMs(STOPPED, T, DURATION), 0);
  assert.equal(positionMs(STOPPED, T + 60_000, DURATION), 0);
  assert.equal(isPlaying(STOPPED), false);
});

test('playing advances with the wall clock', () => {
  const playing = play(STOPPED, T, DURATION);
  assert.equal(isPlaying(playing), true);
  assert.equal(positionMs(playing, T, DURATION), 0);
  assert.equal(positionMs(playing, T + 2_500, DURATION), 2_500);
});

test('time does not pass while paused', () => {
  const playing = play(STOPPED, T, DURATION);
  const paused = pause(playing, T + 3_200, DURATION);

  assert.equal(isPlaying(paused), false);
  assert.equal(positionMs(paused, T + 3_200, DURATION), 3_200);
  // An hour later, still 3.2 seconds in.
  assert.equal(positionMs(paused, T + 3_600_000, DURATION), 3_200);
});

test('resuming continues from where it stopped, not from where the clock is', () => {
  // The bug this exists to prevent: resuming after a long pause and having the
  // film jump to the end because the sum used the wall clock alone.
  const paused = pause(play(STOPPED, T, DURATION), T + 3_200, DURATION);
  const resumed = play(paused, T + 3_600_000, DURATION);

  assert.equal(positionMs(resumed, T + 3_600_000, DURATION), 3_200);
  assert.equal(positionMs(resumed, T + 3_600_000 + 1_000, DURATION), 4_200);
});

test('pausing and resuming repeatedly does not lose or gain time', () => {
  let state = play(STOPPED, T, DURATION);
  let now = T;

  // Six runs of 500 ms with a minute of pause between each.
  for (let i = 0; i < 6; i += 1) {
    now += 500;
    state = pause(state, now, DURATION);
    now += 60_000;
    state = play(state, now, DURATION);
  }

  assert.equal(positionMs(state, now, DURATION), 3_000);
});

test('pausing twice, or playing twice, changes nothing', () => {
  const playing = play(STOPPED, T, DURATION);
  assert.deepEqual(play(playing, T + 1_000, DURATION), playing);

  const paused = pause(playing, T + 1_000, DURATION);
  assert.deepEqual(pause(paused, T + 5_000, DURATION), paused);
});

test('the film stops at the end rather than running past it or looping', () => {
  const playing = play(STOPPED, T, DURATION);

  assert.equal(positionMs(playing, T + DURATION, DURATION), DURATION);
  assert.equal(positionMs(playing, T + DURATION * 3, DURATION), DURATION);
  assert.equal(isFinished(playing, T + DURATION, DURATION), true);
  assert.equal(isFinished(playing, T + 1, DURATION), false);
});

test('playing a finished film starts it again', () => {
  // Pressing play and watching nothing happen is a player that looks broken.
  const finished = play(STOPPED, T, DURATION);
  const again = play(finished, T + DURATION + 5_000, DURATION);

  assert.equal(positionMs(again, T + DURATION + 5_000, DURATION), 0);
  assert.equal(isPlaying(again), true);
});

test('pausing at the end keeps it finished', () => {
  const finished = pause(play(STOPPED, T, DURATION), T + DURATION + 1, DURATION);

  assert.equal(positionMs(finished, T + DURATION + 1, DURATION), DURATION);
  assert.equal(isFinished(finished, T + DURATION + 1, DURATION), true);
});

test('restart goes to the first frame and plays', () => {
  const late = play(STOPPED, T, DURATION);
  const again = restart(T + 4_000);

  assert.equal(positionMs(again, T + 4_000, DURATION), 0);
  assert.equal(isPlaying(again), true);
  assert.notEqual(positionMs(late, T + 4_000, DURATION), 0);
});

test('a clock that goes backwards cannot push the film before its start', () => {
  // Wall clocks do move backwards — a manual change, an NTP correction. It is
  // rare and it must not produce a negative frame time.
  const playing = play(STOPPED, T, DURATION);
  assert.equal(positionMs(playing, T - 60_000, DURATION), 0);
});

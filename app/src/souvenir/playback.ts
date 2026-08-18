/**
 * Where a replay has got to (T-105e, OD-12).
 *
 * `frame.ts` answers *what is on screen at time t*. This answers the smaller
 * question in front of it: **given a wall clock, what is t?**
 *
 * WHY THIS IS NOT JUST A `useState` IN THE SCREEN
 * ----------------------------------------------
 * Because pausing is arithmetic and arithmetic in a component is arithmetic
 * nobody tests. A player holds two facts — how much had already played, and
 * when the current run started — and every bug in a scrubber is a mistake in
 * how those two combine across a pause. Here they are three functions and a
 * type, and the hook that drives them holds no sums of its own.
 *
 * Same split as everywhere else: `stampRules`/`stampAwards`,
 * `movementPolicy`/`samplingGate`, and now `playback`/`useReplay`.
 *
 * ⚠ **No clock of its own.** `nowMs` is passed in, exactly as `nowMs` is passed
 * to `healthCheckPolicy` and `tripEnd`. That is what makes a pause at 3.2
 * seconds testable without waiting 3.2 seconds.
 *
 * Pure: no React, no Expo, no clock. Tested in `playback.test.ts`.
 */

export type Playback = {
  /**
   * Milliseconds of the film that had already played when the current run
   * began — the accumulated total across every previous run.
   */
  playedMs: number;
  /**
   * The wall clock at which the current run began, or `null` when paused.
   *
   * ⚠ A wall-clock instant rather than a tick count, so the player cannot drift
   * away from the film. A counter incremented once per animation frame gains a
   * few milliseconds every dropped frame, and by the finale the stamps land
   * against the wrong part of the trace.
   */
  runningSinceMs: number | null;
};

/** Held at the first frame, not playing. */
export const STOPPED: Playback = { playedMs: 0, runningSinceMs: null };

/**
 * Where the film has got to, clamped into it.
 *
 * Clamped rather than wrapped: a replay that silently loops is one the user
 * cannot tell the end of, and the end is where the hero number is.
 */
export function positionMs(
  state: Playback,
  nowMs: number,
  durationMs: number
): number {
  const raw =
    state.runningSinceMs === null
      ? state.playedMs
      : state.playedMs + (nowMs - state.runningSinceMs);

  return Math.min(Math.max(raw, 0), durationMs);
}

export function isPlaying(state: Playback): boolean {
  return state.runningSinceMs !== null;
}

/** Has it reached the end? True whether it was played there or paused there. */
export function isFinished(
  state: Playback,
  nowMs: number,
  durationMs: number
): boolean {
  return positionMs(state, nowMs, durationMs) >= durationMs;
}

/**
 * Start, or resume.
 *
 * ⚠ **Playing from the end restarts.** Pressing play on a finished film and
 * watching nothing happen is the player appearing broken; there is no other
 * sensible reading of the gesture.
 */
export function play(
  state: Playback,
  nowMs: number,
  durationMs: number
): Playback {
  if (isFinished(state, nowMs, durationMs)) {
    return { playedMs: 0, runningSinceMs: nowMs };
  }
  if (isPlaying(state)) {
    return state;
  }
  return { ...state, runningSinceMs: nowMs };
}

/** Stop where it stands. Pausing twice is not an error and changes nothing. */
export function pause(
  state: Playback,
  nowMs: number,
  durationMs: number
): Playback {
  if (!isPlaying(state)) {
    return state;
  }
  return {
    playedMs: positionMs(state, nowMs, durationMs),
    runningSinceMs: null,
  };
}

/** Back to the first frame, playing. */
export function restart(nowMs: number): Playback {
  return { playedMs: 0, runningSinceMs: nowMs };
}

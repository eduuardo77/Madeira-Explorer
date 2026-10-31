/**
 * The recorder's profile switching, with its storage, provider and clock
 * passed in (E3, A3 of the 30 Oct fix plan, `docs/fix-plan-2026-10-30.md`).
 *
 * WHY THIS EXISTS
 * ---------------
 * The decisions were already pure and tested (`movementPolicy`,
 * `motionWakePolicy`, `recorderControls`). The code that calls them was not:
 * which fixes the gate reads, writing a profile before applying it and taking
 * it back on a refusal, the profile cache, the motion wake's looks and the
 * still check. Three faults in October lived there (T-286, N15, T-294), each
 * found on the P30 and none by a test, because that code imported SQLite and
 * Expo and could not load in Node.
 *
 * So it moved here unchanged, and everything impure comes in as `deps`:
 * `samplingGate.ts` and `backgroundTasks.ts` pass the real database and
 * provider; `recorderReplay.ts` passes an in-memory store and a fake clock, and
 * replays real batches through it (`recorderCore.test.ts`).
 *
 * ⚠ One instance per process, like the module state it replaced: the profile
 * cache and the newest motion labels live in it, and a restart forgets them.
 *
 * Pure in the sense the project uses: no Expo, no database, no clock of its own.
 */

import type { LocationSample, SamplingProfile } from './LocationProvider';
import type { MovementSample } from './movementPolicy.ts';
import {
  decideProfile,
  MOVING_PROFILE,
  STATIONARY_EDGE_MS,
  STATIONARY_WINDOW_MS,
} from './movementPolicy.ts';
import {
  canStartStillCheck,
  confirmsDriving,
  decideStillCheck,
  type FollowUp,
  launchProfile,
  type MotionLabel,
  nextWakeCheck,
  parseFollowUp,
  parsePendingStillCheck,
  type PendingStillCheck,
  STILL_CHECK_WAIT_MS,
} from './motionWakePolicy.ts';
import { outingAwakeOver, type OutingClock } from './recorderControls.ts';
import { SAMPLING_PROFILES } from './samplingPolicy.ts';
import type { RecordingEventKind } from '../storage/types';

/**
 * How many recent fixes to look at: enough to span the window and its edge
 * (twelve minutes) at a fix every two seconds, and still a bounded query.
 *
 * ⚠ It was forty, on the belief that the moving profile gives ~20 fixes in ten
 * minutes. The P30 delivers one every ten seconds on the precise tier, so forty
 * reached back under seven minutes and the window could never be covered
 * (2026-10-04). Four short columns a row: a few hundred rows cost nothing.
 */
export const WINDOW_FIX_LIMIT = 400;
/** While stationary: the newest few, enough for the window and the fix before it. */
export const STATIONARY_FIX_LIMIT = 40;

/** What the motion wake's task is handed by the native side (D-106, T-295). */
export type MotionWakeData = { source?: string; activity?: string; step?: string };

/** Everything impure the recorder touches. Each member is one call it made before. */
export type RecorderDeps = {
  /** `Date.now()`. */
  now(): number;
  /** `app_state`: the sampling profile and the still check under way. */
  state: {
    getProfile(): Promise<string | null>;
    setProfile(profile: SamplingProfile): Promise<void>;
    /** When the profile row was last written, by the clock at the write. */
    getProfileUpdatedTs(): Promise<number | null>;
    getStillCheck(): Promise<unknown>;
    setStillCheck(value: PendingStillCheck): Promise<void>;
    /** Written as an empty string, as before. */
    clearStillCheck(): Promise<void>;
  };
  trace: {
    getActiveTripId(): Promise<number | null>;
    /** Newest first, `ts >= sinceTs`, at most `limit` (`rawFixDao.getMovementWindow`). */
    getMovementWindow(tripId: number, sinceTs: number, limit: number): Promise<MovementSample[]>;
    getLastFixTs(tripId: number): Promise<number | null>;
  };
  provider: {
    /** `hasStartedLocationUpdatesAsync`: the task is registered, not proof it runs (T-174). */
    isRecording(): Promise<boolean>;
    setSamplingProfile(profile: SamplingProfile): Promise<void>;
    /** One GPS position, or null when none comes within `WAKE_FIX_TIMEOUT_MS`. */
    currentPosition(): Promise<LocationSample | null>;
  };
  outing: {
    readClock(nowMs: number): Promise<OutingClock>;
    getAwakeApplied(): Promise<boolean>;
  };
  /** Book an Android alarm for a follow-up (T-295); false when there is none. */
  scheduleAlarm(delayMs: number, followUp: FollowUp): boolean;
  /** A JavaScript timer: keeps time only while the app is open. */
  setTimer(delayMs: number, run: () => void): void;
  /** What a batch goes through besides the gate, in order (`recordSamples`). */
  batch: {
    store(samples: LocationSample[]): Promise<void>;
    /** The anchor backstop (T-039). */
    noteLatest(latest: LocationSample): Promise<void>;
    /** The stamp announcer (D-096), after the gate. */
    afterGate(): Promise<void>;
  };
  diary: {
    log(kind: RecordingEventKind, detail: string): Promise<void>;
    logError(where: string, error: unknown): Promise<void>;
  };
};

export type Recorder = ReturnType<typeof createRecorder>;

export function createRecorder(deps: RecorderDeps) {
  /**
   * The profile we believe the provider is currently using.
   *
   * Persisted because the process is killed and relaunched constantly, and
   * memoised because this module is its only writer: after the first read of a
   * process, the database cannot know anything we do not. Getting it wrong is
   * cheap in one direction (a redundant `setSamplingProfile` call) and expensive
   * in the other (thinking we are on the moving profile when the OS has us on the
   * cheap one), so it is written before it is trusted.
   */
  let cachedProfile: SamplingProfile | null = null;
  /** The newest moving label from the motion wake, for the still check (T-286). */
  let lastMovingSignalMs: number | null = null;
  /**
   * The newest label of any kind, for confirming a drive (T-296). In memory: a
   * restart forgets it, which only means waiting for one more label.
   */
  let lastLabel: MotionLabel | null = null;

  async function readCurrentProfile(): Promise<SamplingProfile> {
    if (cachedProfile !== null) {
      return cachedProfile;
    }
    const stored = await deps.state.getProfile();
    // Membership is checked against the profile table rather than a list of
    // string literals, so adding a fourth profile cannot leave this line quietly
    // refusing to read it back and resetting every relaunch to the default.
    // ⚠ N15, found on the P30 2026-10-27: a read begun before a write and
    // finished after it must not undo the write. At launch the motion wake
    // started this read on an empty cache, the launch then wrote *stationary*,
    // and the late read put the stale *driving* back: the recorder was
    // re-asserted on driving one second after the diary said stationary.
    if (cachedProfile !== null) {
      return cachedProfile;
    }
    cachedProfile =
      stored !== null && stored in SAMPLING_PROFILES
        ? (stored as SamplingProfile)
        : // Nothing recorded yet: assume moving. Assuming stationary would start
          // every fresh install on the cheap profile, which is exactly wrong:
          // a fresh install is somebody who has just landed.
          MOVING_PROFILE;
    return cachedProfile;
  }

  async function writeCurrentProfile(profile: SamplingProfile): Promise<void> {
    cachedProfile = profile;
    await deps.state.setProfile(profile);
  }

  /**
   * Look at the last few minutes of fixes and adjust the sampling profile.
   *
   * `now` is the batch's own timestamp rather than wall-clock, which matters
   * when the OS hands us a batch it has been sitting on for several minutes.
   * Never throws: it runs inside an OS callback, and a failure here must cost
   * a profile change, never a batch of fixes (D-010).
   */
  async function applySamplingGate(now: number, wallNowMs: number = deps.now()): Promise<void> {
    try {
      // Three independent questions, so three round-trips in parallel rather than
      // in series. One of them crosses the native bridge, which is the expensive
      // one, and this runs on every OS wake-up for a week.
      const [recording, tripId, current] = await Promise.all([
        deps.provider.isRecording(),
        deps.trace.getActiveTripId(),
        readCurrentProfile(),
      ]);

      if (!recording) {
        // Not recording at all. Changing the profile would restart location
        // updates behind the user's back: on While-Using that would be a
        // straightforward bug (D-008).
        return;
      }
      if (tripId === null) {
        return;
      }

      // Only the window the policy will actually consider. While stationary,
      // the newest fixes whatever their age: the last one at home is usually
      // older than the window, and it is the one that shows the phone has left
      // (`decideProfile`, F1).
      const samples = await deps.trace.getMovementWindow(
        tripId,
        current === 'stationary' ? 0 : now - STATIONARY_WINDOW_MS - STATIONARY_EDGE_MS,
        current === 'stationary' ? STATIONARY_FIX_LIMIT : WINDOW_FIX_LIMIT
      );

      // When the current profile was entered: out of stationary, stillness only
      // counts from then (`decideProfile`, D-106).
      const since = await deps.state.getProfileUpdatedTs();
      const decision = decideProfile(current, samples, now, since ?? undefined, wallNowMs);

      if (!decision.changed) {
        // T-285: an outing started standing still keeps the gate on
        // `stationary` throughout, so its awake window has to be closed here,
        // by re-applying the same profile, or the GPS would stay on.
        if (
          outingAwakeOver(
            current,
            await deps.outing.readClock(deps.now()),
            await deps.outing.getAwakeApplied()
          )
        ) {
          await deps.provider.setSamplingProfile(current);
          await deps.diary.log('outing', 'outing awake window over: sleeping at stops again');
        }
        return;
      }

      // Write the intent before acting on it. If the process dies between the
      // two, the next wake-up re-derives the same decision from the same fixes
      // and applies it again, which is harmless. The other order could leave
      // the stored profile permanently disagreeing with the OS.
      await writeCurrentProfile(decision.profile);
      try {
        await deps.provider.setSamplingProfile(decision.profile);
      } catch (error) {
        // ⚠ Refused, so the OS is still on `current`: say so, or the gate sees
        // "no change" from now on and never retries. Found 2026-10-04: a refusal
        // at 12:13 on a ride left the stored profile disagreeing with the OS
        // until the app was next opened.
        await writeCurrentProfile(current);
        throw error;
      }

      await deps.diary.log('start', `profile ${current} -> ${decision.profile}: ${decision.reason}`);
    } catch (error) {
      await deps.diary.logError('sampling gate', error);
    }
  }

  /**
   * Raise the profile on the motion sensors' word alone (D-106): walking to
   * driving when Google says in a vehicle, without waiting for the walking
   * profile's next batch. Only ever to a denser profile (D-094).
   */
  async function raiseProfile(to: SamplingProfile, reason: string): Promise<void> {
    try {
      const current = await readCurrentProfile();
      if (current === to || current === 'stationary' || to !== 'driving') {
        return;
      }
      await writeCurrentProfile(to);
      try {
        await deps.provider.setSamplingProfile(to);
      } catch (error) {
        await writeCurrentProfile(current);
        throw error;
      }
      await deps.diary.log('start', `profile ${current} -> ${to}: ${reason}`);
    } catch (error) {
      await deps.diary.logError('sampling gate', error);
    }
  }

  /**
   * Drop a moving profile to stationary on the still check's word (T-286),
   * for the stop the gate cannot see: on *driving* no fix passes the 50 m filter
   * while still, so `applySamplingGate` never runs.
   */
  async function lowerProfile(reason: string): Promise<void> {
    try {
      const current = await readCurrentProfile();
      if (current === 'stationary') {
        return;
      }
      await writeCurrentProfile('stationary');
      try {
        await deps.provider.setSamplingProfile('stationary');
      } catch (error) {
        await writeCurrentProfile(current);
        throw error;
      }
      await deps.diary.log('start', `profile ${current} -> stationary: ${reason}`);
    } catch (error) {
      await deps.diary.logError('sampling gate', error);
    }
  }

  /**
   * N15: before the launch re-asserts the recorder, drop a stored moving
   * profile to stationary unless a fix in the last five minutes says the phone
   * is moving now (`launchProfile`). Returns the profile to start on.
   */
  async function settleLaunchProfile(nowMs: number): Promise<SamplingProfile> {
    try {
      const raw = await deps.state.getProfile();
      const stored = raw !== null && raw in SAMPLING_PROFILES ? (raw as SamplingProfile) : null;
      const tripId = await deps.trace.getActiveTripId();
      const lastFixTs = tripId === null ? null : await deps.trace.getLastFixTs(tripId);
      const decision = launchProfile(stored, lastFixTs, nowMs);
      if (stored !== null && decision.profile !== null) {
        await writeCurrentProfile(decision.profile);
        await deps.diary.log('start', `profile ${stored} -> ${decision.profile}: ${decision.reason}`);
      }
    } catch (error) {
      await deps.diary.logError('sampling gate', error);
    }
    return getCurrentSamplingProfile();
  }

  /** What the gate thinks it has set. */
  async function getCurrentSamplingProfile(): Promise<SamplingProfile> {
    try {
      return await readCurrentProfile();
    } catch {
      return MOVING_PROFILE;
    }
  }

  /**
   * What every batch goes through, from the OS or from a motion wake: stored,
   * the anchor backstop, the sampling gate, the stamp announcer.
   */
  async function recordSamples(samples: LocationSample[]): Promise<void> {
    // Storage first, always. The trace is the irreplaceable thing (D-010).
    await deps.batch.store(samples);
    const latest = samples[samples.length - 1];
    await deps.batch.noteLatest(latest);
    // `latest.ts`, not the clock: the OS may have been holding this batch for
    // several minutes, and judging staleness against wall-clock would read a
    // perfectly healthy batch as an outage.
    await applySamplingGate(latest.ts);
    await deps.batch.afterGate();
  }

  /**
   * The motion wake (D-106). While the recorder is stationary it looks for a
   * GPS position up to three times over three minutes, each through the same
   * pipeline as any batch, so the gate alone decides whether the phone has
   * left. On a moving profile a still label starts the still check (T-286),
   * and a driving label may raise walking (T-296).
   */
  async function onMotionWake(data: MotionWakeData | null | undefined): Promise<void> {
    if (!(await deps.provider.isRecording())) {
      return;
    }
    const { source, activity, step } = data ?? {};
    if (source === 'follow_up') {
      const followUp = parseFollowUp(step);
      if (followUp?.kind === 'look') await wakeLook(followUp.index);
      if (followUp?.kind === 'still') await finishStillCheck();
      return;
    }
    const profile = await getCurrentSamplingProfile();
    const nowMs = deps.now();
    const previousLabel = lastLabel;
    if (activity !== undefined) {
      lastLabel = { activity, ts: nowMs };
      if (activity !== 'still') lastMovingSignalMs = nowMs;
    }
    if (activity === 'still') {
      if (profile !== 'stationary') await startStillCheck(profile);
      return;
    }
    if (profile !== 'stationary') {
      // Already recording: only a car can make it denser (`raiseProfile`), and
      // only when the sensors say so twice running (T-296, floor -1 on 31 Oct).
      if (profile === 'walking' && activity === 'driving') {
        if (confirmsDriving(previousLabel, activity, nowMs)) {
          await raiseProfile('driving', 'the motion sensors say driving twice'); // i18n-exempt: diary reason, D-106
        } else {
          await deps.diary.log('activity', 'motion sensors say driving once, waiting for a second'); // i18n-exempt: diary line, T-296
        }
      }
      return;
    }
    await deps.diary.log('activity', `motion wake: ${source ?? 'unknown'}${activity ? ` (${activity})` : ''}`); // i18n-exempt: diary line, D-106
    await wakeLook(0);
  }

  /**
   * Wait `delayMs`, then run `followUp`: by an Android alarm where there is one
   * (T-295), else by a timer, which keeps time only while the app is open.
   */
  function scheduleFollowUp(delayMs: number, followUp: FollowUp): void {
    if (deps.scheduleAlarm(delayMs, followUp)) return;
    deps.setTimer(delayMs, () => {
      void (followUp.kind === 'look' ? wakeLook(followUp.index) : finishStillCheck());
    });
  }

  /**
   * Look `index` of a motion wake: one position while the recorder is still
   * stationary. The next look is booked first, so a position that never comes
   * cannot end the wake; the next look itself gives up once the gate has left
   * stationary.
   */
  async function wakeLook(index: number): Promise<void> {
    const profile = await getCurrentSamplingProfile();
    if (nextWakeCheck(index, profile) === null) return;
    if (index > 0) {
      await deps.diary.log('activity', `motion wake: look ${index + 1}`); // i18n-exempt: diary line, T-295
    }
    const wait = nextWakeCheck(index + 1, profile);
    if (wait !== null) scheduleFollowUp(wait, { kind: 'look', index: index + 1 });
    const fix = await deps.provider.currentPosition();
    if (fix !== null) {
      await recordSamples([fix]);
    }
  }

  async function readStillCheck(): Promise<PendingStillCheck | null> {
    try {
      return parsePendingStillCheck(await deps.state.getStillCheck());
    } catch {
      return null;
    }
  }

  /**
   * T-286: the sensors say still while on a moving profile. A position now and
   * one five minutes later, each recorded like any batch, and the pure check
   * decides (`decideStillCheck`). Any fix that arrives meanwhile goes through
   * the gate as usual, which may already have decided.
   *
   * ⚠ T-295: the second half runs from an alarm (`finishStillCheck`), and the
   * check under way is kept in `app_state`, not in memory.
   * ⚠ N15: it waits the five minutes even when the first look finds nothing.
   */
  async function startStillCheck(profile: SamplingProfile): Promise<void> {
    const wakeMs = deps.now();
    if (!canStartStillCheck(await readStillCheck(), wakeMs)) return;
    await deps.state.setStillCheck({ wakeMs, first: null });
    await deps.diary.log('activity', `still check: started on ${profile}`); // i18n-exempt: diary line, T-286
    // Booked before the first look, so a look that never returns cannot cost the check.
    scheduleFollowUp(STILL_CHECK_WAIT_MS, { kind: 'still' });
    const first = await deps.provider.currentPosition();
    if (first === null) return;
    await recordSamples([first]);
    const pending = await readStillCheck();
    if (pending?.wakeMs === wakeMs) {
      const sample: MovementSample = {
        ts: first.ts,
        lat: first.lat,
        lon: first.lon,
        accuracyM: first.accuracyM,
      };
      await deps.state.setStillCheck({ wakeMs, first: sample });
    }
  }

  /** The still check's second half, five minutes on, from the alarm (T-295). */
  async function finishStillCheck(): Promise<void> {
    const pending = await readStillCheck();
    if (pending === null) return;
    await deps.state.clearStillCheck();
    if ((await getCurrentSamplingProfile()) === 'stationary') return; // the gate got there first
    const second = await deps.provider.currentPosition();
    if (second !== null) await recordSamples([second]);
    const after = await getCurrentSamplingProfile();
    const nowMs = deps.now();
    const check = decideStillCheck(after, pending.first, second, lastMovingSignalMs, pending.wakeMs, nowMs);
    if (check.sleep) {
      await lowerProfile(check.reason);
    } else {
      const waitedMin = Math.round((nowMs - pending.wakeMs) / 60000);
      await deps.diary.log('activity', `still check: stay after ${waitedMin} min, ${check.reason}`); // i18n-exempt: diary line, T-286
    }
  }

  return {
    applySamplingGate,
    raiseProfile,
    lowerProfile,
    settleLaunchProfile,
    getCurrentSamplingProfile,
    recordSamples,
    onMotionWake,
  };
}

/**
 * Watching your trip back (T-105e, OD-12).
 *
 * `ReplayView` is the picture, `frame.ts` decides what is in it and
 * `playback.ts` decides where the film has got to. This is the plumbing: read
 * the trip, run a clock, and get out of the way.
 *
 * WHY THIS EXISTS BEFORE THE VIDEO
 * --------------------------------
 * OD-12: the end-of-trip **video** is D-013's distribution strategy and needs
 * Kotlin, `MediaCodec` and a physical Android that this project does not have.
 * The **replay** is the same film through the same `frameAt`, driven by a wall
 * clock into a view instead of by a frame counter into an encoder — and it
 * needs none of that. It ships the composition to real users first, which is
 * also the only way anybody finds out whether the film is worth encoding.
 *
 * ⚠ **The whole screen is one tap.** Tapping the film plays or pauses it; there
 * is no scrubber, no timeline and no chrome over the picture. A replay is a
 * thing you watch, and the design brief's standing complaint about the
 * reference app is controls competing with the content.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { t } from '../i18n';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import type { Composition } from './composition';
import { frameAt } from './frame';
import {
  STOPPED,
  isFinished,
  isPlaying,
  pause,
  play,
  positionMs,
  restart,
  type Playback,
} from './playback';
import ReplayView from './ReplayView';
import { formatDateRange } from './shareCard';
import { getSouvenirComposition } from './souvenirPlan';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from '../ui/theme';

export default function ReplayScreen({ onClose }: { onClose: () => void }) {
  const [composition, setComposition] = useState<Composition | null>(null);
  const [caption, setCaption] = useState('');
  const [clock, setClock] = useState<Playback>(STOPPED);
  /**
   * The wall clock, re-read once per animation frame while playing.
   *
   * ⚠ **State, not a ref.** The frame on screen is a function of `now`, so it
   * has to be something React re-renders on. The cost is a render per frame,
   * which is what any player does.
   */
  const [now, setNow] = useState(() => Date.now());

  const { width, height } = useWindowDimensions();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [plan, trip] = await Promise.all([
          getSouvenirComposition(),
          tripDao.getActiveTrip(),
        ]);

        if (cancelled) {
          return;
        }

        setComposition(plan);
        if (trip !== null) {
          setCaption(
            formatDateRange(trip.started_ts, trip.ended_ts ?? Date.now())
          );
        }

        // Autoplay. The user asked to watch it; making them press play as well
        // is a step that exists only because it was easier to build.
        if (plan.renderable) {
          setClock(restart(Date.now()));
        }
      } catch (error) {
        await recordingEventDao.logError('replay', error);
        if (!cancelled) {
          setComposition({ renderable: false, reason: 'the trip could not be read' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const durationMs =
    composition !== null && composition.renderable ? composition.durationMs : 0;

  // A frame loop while playing, and nothing at all while paused or finished —
  // a replay left on screen must not hold the CPU awake for a still picture.
  const playing = isPlaying(clock);
  useEffect(() => {
    if (!playing) {
      return;
    }
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Stop the loop the moment the film ends, rather than re-rendering the same
  // final frame sixty times a second until the user leaves.
  //
  // ⚠ No guard flag: pausing makes `playing` false, which is the condition this
  // effect and the loop above both key on, so it cannot fire twice. The clock
  // is also honest afterwards — `isPlaying` says false on a finished film, and
  // a control reading "Pause" over a still picture would be a small lie.
  useEffect(() => {
    if (playing && durationMs > 0 && isFinished(clock, now, durationMs)) {
      setClock((state) => pause(state, Date.now(), durationMs));
    }
  }, [playing, clock, now, durationMs]);

  const frame = useMemo(() => {
    if (composition === null || !composition.renderable) {
      return null;
    }
    return frameAt(composition, positionMs(clock, now, durationMs));
  }, [composition, clock, now, durationMs]);

  const toggle = () => {
    const at = Date.now();
    setNow(at);
    if (isFinished(clock, at, durationMs)) {
      setClock(restart(at));
      return;
    }
    setClock(playing ? pause(clock, at, durationMs) : play(clock, at, durationMs));
  };

  return (
    <View style={styles.root}>
      {composition === null ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={colors.action} />
        </View>
      ) : !composition.renderable || frame === null ? (
        // ⚠ Honest and unspecific. `composition.reason` is written for the
        // recorder's diary — "no drawable segments after masking" is true and
        // is not a sentence to hand a person at the end of their holiday.
        <View style={styles.centre}>
          <Text style={styles.empty}>{t('replay.nothingToWatch')}</Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isFinished(clock, now, durationMs)
              ? t('replay.a11y.watchAgain')
              : playing
                ? t('replay.a11y.pause')
                : t('replay.a11y.play')
          }
          onPress={toggle}
          style={styles.stage}
        >
          <ReplayView
            frame={frame}
            width={width}
            height={height}
            heroCaption={caption === '' ? undefined : caption}
          />
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('replay.a11y.close')}
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Text style={styles.closeText}>{t('replay.close')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  stage: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    textAlign: 'center',
  },
  pressed: { opacity: 0.75 },
  // Over the film rather than beside it: the picture is the screen, and a bar
  // holding one word would take a tenth of it.
  close: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.sm,
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  closeText: {
    color: colors.tint,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});

/**
 * Watching your trip back, on the real map (T-105e, D-076, OD-12).
 *
 * ⚠⚠ **REBUILT 2026-08-18, ON THE PROJECT LEAD'S INSTRUCTION.** The first
 * version drew the trace as white lines on a black rectangle. They looked at it
 * and said: *"Some lines on a black screen? It is supposed to have a map behind
 * it to know where you've been. It should be a video of the already existing
 * map, as if someone was screen-recording while you were walking, but adding
 * some motion."*
 *
 * So the replay **is** the map screen, played back: Google's own cartography,
 * the camera following the walk, the trace growing behind it, a stamp landing
 * where each one was earned. Nothing here draws a basemap of its own, because
 * the whole point is that the basemap is the part that says *where*.
 *
 * WHAT SURVIVED THE REWRITE, AND WHY THAT MATTERS
 * ----------------------------------------------
 * All of it, except the drawing. `composition.ts` still plans the film,
 * `frame.ts` still says what is on screen at time *t*, and `playback.ts` still
 * says what *t* is. Only `ReplayView` — the SVG — was replaced, by
 * `replayMap.ts`, which turns the same frame into a camera, some polylines and
 * some circles. That is the dividend for having split the film into *what
 * happens* and *how it is drawn*.
 *
 * ⚠ **THE APP DOES NOT MOVE THE CAMERA. IT TELLS THE MAP WHERE TO GO.**
 * A native map camera cannot be reset thirty times a second — every assignment
 * restarts its own animation, so per-frame interpolation stutters. The first
 * version answered that with a tuned throttle, which was a guess nobody could
 * judge without hardware. It is gone: `setCameraPosition` takes a **duration**,
 * `composition.ts` has emitted camera **keyframes** since T-105a, and handing
 * each keyframe over with the gap to the next as its duration lets the platform
 * do the easing. Six instructions for a ten-second film, no tunable numbers.
 *
 * ⚠ The trace and the marks still update every frame. They are cheap, they are
 * what the eye is following, and they are ordinary props rather than an
 * animation somebody else owns.
 *
 * ⚠ **The whole screen is one tap.** Tapping plays or pauses. There is no
 * scrubber and no chrome over the picture — and the map's own gestures are off,
 * because for these ten seconds the film owns the camera.
 */

import { GoogleMaps } from 'expo-maps';
import { GoogleMapsColorScheme, GoogleMapsMapType } from 'expo-maps/build/google/GoogleMaps.types';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { t } from '../i18n';
import { darkMapPropsFor } from '../map/darkMode';
import type { MapStyleName } from '../map/mapStyle';
import { parseMapStyle } from '../map/mapStylePreference';
import { supportsNativeDarkMap } from '../map/mapsRenderer';
import * as appStateDao from '../storage/dao/appStateDao';
import { AppStateKey } from '../storage/dao/appStateDao';
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
import { cameraMoveDue, cameraPlan, replayMapFrame } from './replayMap';
import { formatDateRange } from './shareCard';
import { getSouvenirComposition } from './souvenirPlan';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from '../ui/theme';

export default function ReplayScreen({ onClose }: { onClose: () => void }) {
  const [composition, setComposition] = useState<Composition | null>(null);
  const [caption, setCaption] = useState('');
  const [styleName, setStyleName] = useState<MapStyleName>('light');
  const [clock, setClock] = useState<Playback>(STOPPED);
  /**
   * The wall clock, re-read once per animation frame while playing.
   *
   * ⚠ State, not a ref: the frame on screen is a function of `now`, so it has
   * to be something React re-renders on.
   */
  const [now, setNow] = useState(() => Date.now());

  const { width, height } = useWindowDimensions();
  const darkMap = darkMapPropsFor(styleName, supportsNativeDarkMap);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [plan, trip, preference] = await Promise.all([
          getSouvenirComposition(),
          tripDao.getActiveTrip(),
          appStateDao.get(AppStateKey.MapStyle),
        ]);

        if (cancelled) {
          return;
        }

        setComposition(plan);
        setStyleName(parseMapStyle(preference));
        if (trip !== null) {
          setCaption(formatDateRange(trip.started_ts, trip.ended_ts ?? Date.now()));
        }

        // Autoplay. The user pressed *Watch*; making them press play as well is
        // a step that exists only because it was easier to build.
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

  const playing = isPlaying(clock);

  // A frame loop while playing, and nothing at all while paused or finished — a
  // replay left on screen must not hold the CPU awake over a still picture.
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

  // Stop the loop the moment the film ends. No guard flag: pausing makes
  // `playing` false, which is what this and the loop above both key on.
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

  const viewport = useMemo(
    () => ({
      width,
      height,
      // The finale's number sits over the bottom of the map, so the walk is
      // framed into what is left — the same reasoning as the map screen's own
      // padding for its controls.
      padding: {
        top: spacing.xl * 2,
        bottom: spacing.xl * 4,
        left: spacing.lg,
        right: spacing.lg,
      },
    }),
    [width, height]
  );

  const painted = useMemo(() => {
    if (frame === null) {
      return null;
    }
    return replayMapFrame(frame, {
      style: styleName,
      viewport,
      pixelRatio: PixelRatio.get(),
    });
  }, [frame, styleName, viewport]);

  const mapRef = useRef<GoogleMaps.MapView>(null);

  /** The film's camera, as a handful of instructions. Six, not three hundred. */
  const plan = useMemo(
    () =>
      composition !== null && composition.renderable
        ? cameraPlan(composition, viewport)
        : [],
    [composition, viewport]
  );

  /**
   * Which instruction the map has already been given.
   *
   * ⚠ A ref, not state: issuing one is a side effect on the native view, not
   * something the React tree renders, and making it state would re-render the
   * whole screen to record that a camera was told to move.
   */
  const issuedRef = useRef(-1);

  const atMs = positionMs(clock, now, durationMs);

  useEffect(() => {
    if (mapRef.current === null || plan.length === 0) {
      return;
    }

    const due = cameraMoveDue(plan, atMs);

    // Scrubbed backwards, or restarted. Re-issue from wherever we now are —
    // and snap, because the film is not where the map thinks it is.
    if (due < issuedRef.current) {
      issuedRef.current = due;
      if (due >= 0) {
        mapRef.current.setCameraPosition({ ...plan[due].camera, duration: 0 });
      }
      return;
    }

    // ⚠ Only ever the newest one, and only once. Re-sending an instruction
    // restarts an animation that is halfway through, which is the stutter this
    // whole approach exists to avoid.
    if (due > issuedRef.current) {
      issuedRef.current = due;
      const move = plan[due];
      mapRef.current.setCameraPosition({
        ...move.camera,
        // ⚠ Paused, the film is a still picture, so a camera still gliding to
        // its target would be the one thing on screen that had not stopped.
        duration: playing ? move.durationMs : 0,
      });
    }
  }, [plan, atMs, playing]);

  const toggle = () => {
    const at = Date.now();
    setNow(at);
    if (isFinished(clock, at, durationMs)) {
      setClock(restart(at));
      return;
    }
    setClock(playing ? pause(clock, at, durationMs) : play(clock, at, durationMs));
  };

  if (composition === null) {
    return (
      <View style={[styles.root, styles.centre]}>
        <ActivityIndicator size="large" color={colors.action} />
      </View>
    );
  }

  if (!composition.renderable || frame === null || painted === null) {
    // ⚠ Honest and unspecific. `composition.reason` is written for the
    // recorder's diary — "no drawable segments after masking" is true and is
    // not a sentence to hand a person at the end of their holiday.
    return (
      <View style={[styles.root, styles.centre]}>
        <Text style={styles.empty}>{t('replay.nothingToWatch')}</Text>
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

  return (
    <View style={styles.root}>
      <GoogleMaps.View
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        // ⚠ No `cameraPosition` prop. The camera is driven imperatively through
        // `setCameraPosition` so the map can animate itself; a prop would fight
        // that by snapping the camera back on every render.
        polylines={painted.polylines}
        circles={painted.circles}
        colorScheme={
          darkMap.dark ? GoogleMapsColorScheme.DARK : GoogleMapsColorScheme.LIGHT
        }
        properties={{
          mapType: GoogleMapsMapType.NORMAL,
          mapStyleOptions:
            darkMap.mapStyleJson === undefined
              ? undefined
              : { json: darkMap.mapStyleJson },
          isMyLocationEnabled: false,
          isTrafficEnabled: false,
          isBuildingEnabled: false,
          selectionEnabled: false,
        }}
        uiSettings={{
          // ⚠ Every gesture off, not just the chrome. For these ten seconds the
          // film owns the camera, and a stray thumb dragging the map mid-replay
          // would leave the walk drawing itself somewhere off screen.
          compassEnabled: false,
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          scaleBarEnabled: false,
          togglePitchEnabled: false,
          mapToolbarEnabled: false,
          scrollGesturesEnabled: false,
          zoomGesturesEnabled: false,
          rotationGesturesEnabled: false,
          tiltGesturesEnabled: false,
        }}
      />

      {/* The closing card, over the map rather than instead of it — the last
          frame is the one people screenshot, and it should still show where
          they were. Fades in with the finale rather than appearing. */}
      {frame.hero === null ? null : (
        <View
          style={[styles.hero, { opacity: Math.min(1, frame.sceneProgress * 4) }]}
          pointerEvents="none"
        >
          <Text style={styles.heroNumber}>
            {frame.hero.collected}
            <Text style={styles.heroTotal}> / {frame.hero.total}</Text>
          </Text>
          {caption === '' ? null : <Text style={styles.heroCaption}>{caption}</Text>}
        </View>
      )}

      {/* Over the whole map, so the film is one tap. It sits above the map view
          and therefore also swallows the gestures the map already refuses. */}
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
        style={StyleSheet.absoluteFill}
      />

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
  centre: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  empty: { color: colors.textMuted, fontSize: fontSize.body, textAlign: 'center' },
  pressed: { opacity: 0.75 },
  hero: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.xl * 2,
    alignItems: 'center',
  },
  heroNumber: {
    color: colors.text,
    fontSize: fontSize.hero,
    fontWeight: '700',
    // The map underneath can be any colour at all, so the number carries its
    // own separation rather than trusting the ground — the same problem the
    // status-bar scrim solves on the map screen.
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  heroTotal: { color: colors.textMuted, fontSize: fontSize.title, fontWeight: '700' },
  heroCaption: {
    color: colors.text,
    fontSize: fontSize.body,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
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
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
});

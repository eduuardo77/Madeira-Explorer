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
import { deviceLanguage, t } from '../i18n';
import { darkMapPropsFor } from '../map/darkMode';
import type { MapStyleName } from '../map/mapStyle';
import { supportsNativeDarkMap } from '../map/mapsRenderer';
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
import { cameraMoveDue, cameraPlan, mapDuration, openingCamera, replayMapFrame, SNAP_MS } from './replayMap';
import { formatDateRange } from './shareCard';
import { getSouvenirComposition } from './souvenirPlan';
import { REFUSAL_KEYS } from './shareTrip';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from '../ui/theme';

/**
 * Where the closing card sits, and how much of the map it covers.
 *
 * The card's foot is `HERO_BOTTOM` above the screen's; the number (48 sp) and
 * the caption (17 sp) stack about 80 points above that. The map frames the trip
 * into what is left, and the finale rests the trip on the card (T-253).
 */
const HERO_BOTTOM = spacing.xl * 2;
const HERO_CLEARANCE = spacing.xl * 5;

/**
 * How long the film waits for the map to report its tiles drawn (T-253).
 *
 * ⚠ A safety net, not a tuning. Google calls `onMapLoaded` once every tile in
 * view has been fetched, which with no signal may be never; the film must
 * still play then, over whatever the map has cached.
 */
const MAP_READY_FALLBACK_MS = 3_000;

export default function ReplayScreen({
  tripId,
  onClose,
}: {
  /** The trip to play (T-275); the trip on show when absent. */
  tripId?: number;
  onClose: () => void;
}) {
  const [composition, setComposition] = useState<Composition | null>(null);
  const [caption, setCaption] = useState('');
  /**
   * Always the dark map (T-253, 2026-10-07): WalkNYC's Replay plays on a dark
   * map with the blocks glowing, and the lit roads read the same way here. Not
   * the everyday map's setting: this is the one screen made to be watched.
   */
  const styleName: MapStyleName = 'dark';
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
        // T-204: the film of a trip that has ended is the one worth watching.
        const trip =
          tripId === undefined ? await tripDao.getTripOnShow() : await tripDao.getTrip(tripId);
        // The same trip's film: the plan's own default can be a different one
        // while a trip is open and an ended one is on show.
        const plan = await getSouvenirComposition({ tripId: trip?.id });

        if (cancelled) {
          return;
        }

        setComposition(plan);
        if (trip !== null) {
          setCaption(formatDateRange(trip.started_ts, trip.ended_ts ?? Date.now(), deviceLanguage()));
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
  }, [tripId]);

  const durationMs =
    composition !== null && composition.renderable ? composition.durationMs : 0;

  /**
   * Whether the map has drawn its first picture (T-253).
   *
   * Until then a cover hides it, and the film's clock has not started: the
   * opening seconds of the film are the establish shot, and spending them on a
   * blank map is how the third review saw nothing at all.
   */
  const [mapReady, setMapReady] = useState(false);

  const renderable = composition !== null && composition.renderable;

  useEffect(() => {
    if (!renderable || mapReady) {
      return;
    }
    const fallback = setTimeout(() => setMapReady(true), MAP_READY_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [renderable, mapReady]);

  // Autoplay, once the map is showing. The user pressed *Watch*; making them
  // press play as well is a step that exists only because it was easier to build.
  useEffect(() => {
    if (renderable && mapReady) {
      setClock(restart(Date.now()));
    }
  }, [renderable, mapReady]);

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
        bottom: HERO_CLEARANCE,
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
   * The map's first camera, given as a prop so the map is born on the trip.
   *
   * ⚠ Memoised, and that is load-bearing: the native view rebuilds its camera
   * only when this value changes, so a stable value is set once and then leaves
   * `setCameraPosition` in charge. A fresh object each render would not move
   * the camera (the record compares by value) but would cost a prop update per
   * frame.
   */
  const initialCamera = useMemo(() => openingCamera(plan) ?? undefined, [plan]);

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
        mapRef.current.setCameraPosition({ ...plan[due].camera, duration: SNAP_MS });
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
        duration: playing ? mapDuration(move.durationMs) : SNAP_MS,
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
    // ⚠ Honest. `composition.reason` is written for the recorder's diary;
    // the person reads the share's sentence for the same refusal (T-275), so
    // a trip hidden for privacy does not claim nothing was recorded.
    const refusal = composition.renderable ? undefined : composition.refusal;
    return (
      <View style={[styles.root, styles.centre]}>
        <Text style={styles.empty}>
          {refusal === undefined || refusal === 'nothing'
            ? t('replay.nothingToWatch')
            : t(REFUSAL_KEYS[refusal])}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('replay.close')}
          accessibilityHint={t('replay.a11y.close')}
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
        // The opening shot only. Every move after it goes through
        // `setCameraPosition`, so the map can animate itself.
        cameraPosition={initialCamera}
        onMapLoaded={() => setMapReady(true)}
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

      {/* Hides the map until its first picture is drawn: plain background, never
          a half-loaded map or an empty grid. */}
      {mapReady ? null : (
        <View style={[StyleSheet.absoluteFill, styles.root, styles.centre]} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.action} />
        </View>
      )}

      {/* The closing card, over the map rather than instead of it — the last
          frame is the one people screenshot, and it should still show where
          they were. Fades in with the finale rather than appearing. */}
      {frame.hero === null ? null : (
        <View
          style={[styles.hero, { opacity: Math.min(1, frame.sceneProgress * 4) }]}
          pointerEvents="none"
        >
          {/* T-217: a day with no stamp ends on its dates, not on "0 / 80".
              The film is offered without a stamp now, and a zero as the last
              frame of somebody's walk reads as a verdict on it. */}
          {frame.hero.collected === 0 ? null : (
            <Text style={styles.heroNumber}>
              {frame.hero.collected}
              <Text style={styles.heroTotal}> / {frame.hero.total}</Text>
            </Text>
          )}
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
        accessibilityLabel={t('replay.close')}
        accessibilityHint={t('replay.a11y.close')}
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Text style={styles.closeText}>{t('replay.close')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Dark, like the map it always plays on (T-253): a light cover flashed first.
  root: { flex: 1, backgroundColor: '#0d1319' },
  centre: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  empty: { color: 'rgba(255, 255, 255, 0.7)', fontSize: fontSize.body, textAlign: 'center' },
  pressed: { opacity: 0.75 },
  hero: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: HERO_BOTTOM,
    alignItems: 'center',
  },
  heroNumber: {
    // White on the dark map it always plays on; dark text vanished there.
    color: '#FFFFFF',
    fontSize: fontSize.hero,
    fontWeight: '700',
    // The map underneath can be any colour at all, so the number carries its
    // own separation rather than trusting the ground — the same problem the
    // status-bar scrim solves on the map screen.
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  heroTotal: { color: 'rgba(255, 255, 255, 0.7)', fontSize: fontSize.title, fontWeight: '700' },
  heroCaption: {
    color: '#FFFFFF',
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

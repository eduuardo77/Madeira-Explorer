/**
 * The primary screen, on the platform's own map (T-075, D-057).
 *
 * ⚠ THIS REPLACED A WORKING MAPLIBRE SCREEN, ON PURPOSE
 * ------------------------------------------------------
 * `MapLibreScreen.tsx` is the same screen drawn on our own offline tile pack,
 * and it still works. The project lead chose the platform map on 2026-08-13 —
 * D-057 has the reasoning and the costs. **The old screen is kept, not
 * deleted**, at their instruction: if this trade goes badly, the way back is a
 * one-line change in `App.tsx`.
 *
 * WHAT IS THE SAME AND WHAT IS NOT
 * --------------------------------
 * Everything above the map is unchanged: the passport, the card, the controls,
 * the stamps, the recorder. The map itself is now Google's on Android — and
 * Apple's on iOS the day an iOS build exists (`expo-maps` splits exactly that
 * way, which is the split the project lead wants).
 *
 * The trace and the levada course are **polylines** rather than styled layers.
 * That is the whole of the porting work, and it is why the colours still come
 * from `traceStyle.ts` and `levadaHighlight.ts`: the palette was measured
 * against real ground (D-015, D-056) and none of that reasoning changed
 * because the renderer did.
 *
 * ⚠ **`expo-maps` is alpha and says so.** It is pinned, its API surface here
 * is deliberately small — a basemap, two polylines, one marker, a camera — and
 * the fallback is a file away.
 *
 * ⚠ **The Android map needs a Google Maps API key** in `app.json` under
 * `android.config.googleMaps.apiKey`. Without one the map renders as a grey
 * grid with the Google logo and no tiles, which looks like a bug in this file
 * and is not. See `docs/dev-build.md`.
 */

import { GoogleMaps } from 'expo-maps';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import {
  GoogleMapsColorScheme,
  GoogleMapsMapType,
} from 'expo-maps/build/google/GoogleMaps.types';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  PixelRatio,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Place } from '../content/contentPack';
import { getLevadaCourse } from '../content/levadaCourses';
import { getContentPack } from '../content/poiCatalogue';
import { getRegionName } from '../content/regionCatalogue';
import type { PlaceCard } from '../places/placeCard';
import { buildPlaceCard } from '../places/placeCard';
import { getCurrentProgress } from '../progress/currentProgress';
import { runAwardPass } from '../progress/stampAwards';
import { isUnlocked } from '../entitlement/entitlementStore';
import { buttonStamp, type ButtonStamp } from '../passport/passportButton';
import type { TripProgress } from '../progress/tripProgress';
import { locationProvider } from '../recording/ExpoLocationProvider';
import {
  endOuting,
  readControlInput,
  restartRecording,
  resumeRecording,
  startOuting,
} from '../recording/walkSession';
import {
  formatClock,
  formatDuration,
  primaryControl,
  recorderNotice,
  type ControlInput,
  type RecorderNotice,
} from '../recording/recorderControls';
import { GAP_THRESHOLD_MS } from '../recording/recorderHealth';
import * as appStateDao from '../storage/dao/appStateDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import PlaceCardView from '../ui/PlaceCardView';
import { useBackHandler } from '../ui/useBackHandler';
import PrimaryOverlay, { type MapNotice } from '../ui/PrimaryOverlay';
import { colors, fontSize, mapChrome, MIN_TAP_TARGET, spacing } from '../ui/theme';
import { fitBounds, type Bounds, type CameraFit } from './cameraFit';
import { COURSE_PAINT, courseBounds, hasCourse } from './levadaHighlight';
import { effectiveMapStyle, parseMapStyle } from './mapStylePreference';
import type { MapStyleName } from './mapStyle';
import { buildCollectedMarks } from './collectedMarks';
import { buildToCollectMarks } from './placesToCollect';
import { mapMayMount } from './mapMountGate';
import { representativeGeofence } from './placeMarkers';
import { PLACE_MARKER_PAINT } from './placeStyle';
import { darkMapPropsFor } from './darkMode';
import { supportsNativeDarkMap } from './mapsRenderer';
import { drawableSegments, traceBounds } from './traceGeoJson';
import { TRACE_PAINT } from './traceStyle';

import lightTemplate from '../../assets/map/light.json';
import { deviceLanguage, t } from '../i18n';

/**
 * The island, for a user who has recorded nothing yet.
 *
 * Still read from the shipped style's metadata rather than written here, even
 * though the style no longer draws anything: D-017 says the app knows nothing
 * about where its content is until the content tells it, and that rule did not
 * change with the renderer.
 */
const HOME_BOUNDS = lightTemplate.metadata['madeira:home'] as Bounds;

/**
 * What the card and the controls cover, in points.
 *
 * MapLibre took this as `fitBounds` padding; here it is fed to `cameraFit`,
 * which does the same arithmetic by hand (D-057).
 *
 * ⚠ **THE BOTTOM VALUE WAS 220 AND THAT WAS THE FRAMING BUG** (found by looking,
 * 2026-08-17). `fitBounds` centres the trace in the area chrome does *not* cover,
 * which is correct — but 220 pt overstated the chrome by a wide margin, so the
 * "centre" sat high and the trace was drawn at 43% of screen height with the
 * whole lower half left empty. On a coastal walk that half is featureless sea,
 * and it read as the app failing to fill the screen.
 *
 * Measured against `PrimaryOverlay` instead of guessed: the passport pill is
 * `MIN_TAP_TARGET` (60) plus `spacing.xl` (32) of bottom inset; the recording
 * control, when shown, adds another 60 and a `spacing.sm` (8) gap. So the real
 * numbers are 92 and 160 — and which one applies depends on whether the user
 * granted Always, which is why this is a function now rather than a constant.
 */
function cameraPadding(hasRecordingControl: boolean) {
  const bottomChrome = hasRecordingControl
    ? MIN_TAP_TARGET * 2 + spacing.sm + spacing.xl
    : MIN_TAP_TARGET + spacing.xl;
  return {
    // The settings control plus the status bar it sits below.
    top: MIN_TAP_TARGET + spacing.xl + (StatusBar.currentHeight ?? 0),
    right: spacing.lg,
    bottom: bottomChrome + spacing.md,
    left: spacing.lg,
  };
}

const EMPTY_PROGRESS: TripProgress = {
  collected: 0,
  total: 0,
  byCategory: [],
  byRegion: [],
  lockedRegionCount: 0,
};

export type FocusPlace = {
  place: Place;
  collected: boolean;
};

/** A polyline as `expo-maps` wants it. */
type Polyline = {
  id: string;
  coordinates: { latitude: number; longitude: number }[];
  color: string;
  width: number;
};

/**
 * ⚠ NO CASING, AND THAT IS A RETREAT RATHER THAN A CHOICE.
 *
 * MapLibre drew a casing under the trace for free, and it earned its place:
 * it separates a coloured line from ground of a similar tone. `expo-maps` has
 * no such concept, so it was tried as two polylines — the wide pale one first,
 * the core after, with every casing emitted before every core so one segment's
 * casing could not paint over another's core.
 *
 * **It rendered wrong on the device anyway.** One segment came out as a bare
 * white casing with a hairline core; another came out correct. The colours and
 * widths in the array were right, so the most likely cause is `expo-maps`
 * binding polyline updates by **position** rather than by `id` — which is the
 * kind of thing an alpha library does, and which no amount of care on this side
 * fixes.
 *
 * So: one polyline per segment, weighted to carry itself. Google's basemap is
 * pale enough that the trace reads without a casing, which is exactly the
 * property our own dark hillshaded style did *not* have. Worth revisiting when
 * `expo-maps` leaves alpha — the casing matters more on the dark map (D-026).
 *
 * ⚠ **Widths are in PIXELS here; the style constants are in points.** MapLibre
 * scaled them itself. A width of 4 on a 2.75× screen is four physical pixels —
 * a hairline, which is exactly how the first build looked.
 */
function px(points: number): number {
  return points * PixelRatio.get();
}

export default function NativeMapScreen({
  focusPlace,
  onFocusHandled,
  onOpenPassport,
  onOpenSettings,
}: {
  focusPlace: FocusPlace | null;
  onFocusHandled: () => void;
  onOpenPassport: () => void;
  onOpenSettings: () => void;
}) {
  const { width, height } = useWindowDimensions();

  const [styleName, setStyleName] = useState<MapStyleName>('light');
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [tracePolylines, setTracePolylines] = useState<Polyline[]>([]);
  const [coursePolylines, setCoursePolylines] = useState<Polyline[]>([]);
  const [marker, setMarker] = useState<
    { coordinates: { latitude: number; longitude: number }; title: string }[]
  >([]);
  const [camera, setCamera] = useState<CameraFit | null>(null);
  /**
   * ⚠ A latch, not a live check — the same bug as before the renderer changed
   * (D-053). `focusPlace` is cleared the instant it is consumed, so guarding
   * the trace framing on "is a focus pending" lets the trace win a race it
   * does not know it is in, a beat later.
   */
  const cameraHeldByFocus = useRef(false);
  const [progress, setProgress] = useState<TripProgress>(EMPTY_PROGRESS);
  /** What the passport button draws (D-083) — the placeholder until loaded. */
  const [passportStamp, setPassportStamp] = useState<ButtonStamp>(() =>
    buttonStamp([], [], false, t('passport.title'))
  );
  const [card, setCard] = useState<PlaceCard | null>(null);
  /**
   * The user's own walk (2026-08-28). ⚠ Starts `false` on every launch and is
   * only ever moved by the button — see `manualWalk.ts`. Never derived from
   * `isRecording`, which the app turns on by itself.
   */
  const [walkStarted, setWalkStarted] = useState(false);
  /**
   * What the recorder is doing, read from evidence (D-087, T-174). Null until
   * the first read; the button shows *start* until then, the safe default.
   */
  const [controlInput, setControlInput] = useState<ControlInput | null>(null);
  const [silentForMs, setSilentForMs] = useState<number | null>(null);
  /** Notices closed this session. `recorder-stopped` never lands here (T-174). */
  const [dismissedNotices, setDismissedNotices] = useState<
    ReadonlySet<Exclude<RecorderNotice, null>>
  >(new Set());
  /** A press is being handled; a second tap must not start a second outing. */
  const [busy, setBusy] = useState(false);
  /**
   * Where the camera is looking, so *Re-centre* can know whether it is worth
   * offering. Null until the first `onCameraMove`.
   */
  const [cameraCentre, setCameraCentre] =
    useState<{ latitude: number; longitude: number } | null>(null);
  /** The user's own position, for the same question. */
  const [userAt, setUserAt] =
    useState<{ latitude: number; longitude: number } | null>(null);
  /**
   * Which places have actually been awarded, and the live zoom needed to size
   * their marks (T-112). Zoom comes from `onCameraMove` because the user's own
   * pans and pinches change it and nothing else tells us.
   */
  const [collectedIds, setCollectedIds] = useState<ReadonlySet<string>>(new Set());
  const [places, setPlaces] = useState<readonly Place[]>([]);
  const [zoom, setZoom] = useState<number | null>(null);
  /**
   * A place tapped on the map, as opposed to one arriving from the passport.
   *
   * ⚠ Kept separate from the `focusPlace` **prop** and merged below rather than
   * duplicating the focus effect. That effect flies the camera, draws the
   * course, sets the marker and builds the card; a second copy of it would be
   * two places for the same behaviour to drift apart.
   */
  const [tappedPlace, setTappedPlace] = useState<FocusPlace | null>(null);
  /**
   * T-177: whether the app has been in the foreground yet. The map is not built
   * before then, because a map view built with no current Activity can end up
   * blank for the life of the process (`mapMountGate.ts`).
   */
  const [activityReady, setActivityReady] = useState(() =>
    mapMayMount(false, AppState.currentState)
  );
  useEffect(() => {
    if (activityReady) {
      return undefined;
    }
    // A logcat marker, so a launch loop can see how often this path happens.
    console.info('T-177 map: waiting for the foreground before building the map');
    const subscription = AppState.addEventListener('change', (next) => {
      setActivityReady((already) => mapMayMount(already, next));
    });
    return () => subscription.remove();
  }, [activityReady]);

  const darkMap = darkMapPropsFor(styleName, supportsNativeDarkMap);
  const tracePaint = TRACE_PAINT[styleName];
  const coursePaint = COURSE_PAINT[styleName];

  /**
   * The marks for places already earned.
   *
   * ⚠ Only ever the **collected** ones — `collectedMarks.ts` explains why that
   * is not the all-places layer the project lead deleted in D-052 revised.
   * Falls back to the camera's own zoom before the first `onCameraMove` lands,
   * so the marks appear on the first frame rather than after the first pan.
   */
  /**
   * ⚠ D-085 (2026-09-23): the places still to collect, as hollow rings, the
   * nearest three called out. Drawn *under* the collected marks, so a place
   * is never shown as both. `placesToCollect.ts` holds the rule that they can
   * never look collected.
   */
  const toCollectMarks = buildToCollectMarks({
    places,
    collectedIds,
    zoom: zoom ?? camera?.zoom ?? 0,
    position: userAt === null ? null : { lat: userAt.latitude, lon: userAt.longitude },
    faint: PLACE_MARKER_PAINT[styleName].uncollected,
    collected: PLACE_MARKER_PAINT[styleName].collected,
  });

  const collectedMarks = buildCollectedMarks(
    places,
    collectedIds,
    zoom ?? camera?.zoom ?? 0,
    PLACE_MARKER_PAINT[styleName].collected
  );

  const frame = (bounds: Bounds): CameraFit | null =>
    fitBounds(bounds, {
      width,
      height,
      // ⚠ Always true since 2026-08-28: the walk button is no longer
      // conditional, so the bottom of the map is always spoken for.
      padding: cameraPadding(true),
    });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const preference = await appStateDao.get(appStateDao.AppStateKey.MapStyle);
        if (!cancelled) {
          setStyleName(effectiveMapStyle(parseMapStyle(preference)));
        }
      } catch (error) {
        await recordingEventDao.logError('map style preference', error);
      }

      try {
        await runAwardPass();

        const nextProgress = await getCurrentProgress();
        // ⚠ The walk flag, read from storage and never inferred. The control
        // itself is no longer conditional: the project lead asked for it for
        // everybody, 2026-08-28. It used to appear only when
        // `permission !== 'always' || !backgroundAllowed`, i.e. only when the
        // app could not fill the map in by itself; those two are now read at
        // press time by `isBackgroundRecordingLive`, because they can change
        // while this screen is open and a stale copy decides wrongly.
        const control = await readControlInput(Date.now());
        if (!cancelled) {
          setProgress(nextProgress);
          setWalkStarted(control.input.walkInProgress);
          setControlInput(control.input);
          setSilentForMs(control.silentForMs);
        }

        // The places, and which of them have been earned. Both are needed to
        // mark the collected ones on the map (T-112).
        const pack = getContentPack();
        if (!cancelled) {
          setPlaces(pack.places);
        }

        const trip = await tripDao.getActiveTrip();
        if (trip !== null) {
          const awarded = await stampAwardDao.getAwardedPlaceIds(trip.id);
          if (!cancelled) {
            setCollectedIds(awarded);
          }
          // ⚠ Through the free tier, like the passport: the button must never
          // show a stamp the passport is withholding (passportButton.ts).
          const awards = await stampAwardDao.getAwards(trip.id);
          const nextStamp = buttonStamp(
            awards.map((award) => ({ placeId: award.place_id, awardedTs: award.awarded_ts })),
            pack.places,
            await isUnlocked(),
            t('passport.title')
          );
          if (!cancelled) {
            setPassportStamp(nextStamp);
          }
          const fixes = await rawFixDao.getTraceFixes(trip.id);
          if (!cancelled) {
            // The same gap rule as before: where the recorder admits silence,
            // the drawing breaks rather than bridging it (ARCHITECTURE §10).
            //
            // ⚠ **`drawableSegments`, never `splitIntoSegments` — T-167.** The
            // raw splitter applies the accuracy filter and the two break rules
            // and stops there, so spikes under 250 m, the scribble where
            // somebody stood still, and every jitter vertex were all drawn in
            // full. This screen called it for a month: it was written (Aug 14)
            // before `traceCleanup.ts` existed (Aug 16), the cleanup was wired
            // into `buildTrace`, and the only caller of *that* is the retired
            // MapLibre screen in `app/attic/`. So the souvenir and every
            // preview tool drew the cleaned trace and the phone did not.
            // `traceDrawn.test.ts` fails the build if this comes unwired again.
            const segments = drawableSegments(fixes, GAP_THRESHOLD_MS);
            setTracePolylines(
              segments.map((segment, index) => ({
                id: `trace-${index}`,
                coordinates: segment.fixes.map((fix) => ({
                  latitude: fix.lat,
                  longitude: fix.lon,
                })),
                color: tracePaint.coreColor,
                width: px(tracePaint.coreWidth),
              }))
            );
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordingEventDao.logError('map screen', error);
        if (!cancelled) {
          setFailure(message);
        }
      }

      if (!cancelled) {
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Frame what was walked, or the island on day one (D-053). */
  useEffect(() => {
    if (!ready || cameraHeldByFocus.current || camera !== null) {
      return;
    }

    const drawn = tracePolylines.flatMap((line) =>
      line.coordinates.map(
        (point) => [point.longitude, point.latitude] as [number, number]
      )
    );

    setCamera(frame(drawn.length > 0 ? traceBoundsOf(drawn) : HOME_BOUNDS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tracePolylines]);

  /**
   * Somebody asked for a place — the passport via the prop (T-115, D-052,
   * D-055), or a tap on one of the collected marks (T-112). One effect, either
   * way, so the two entry points cannot drift.
   */
  const requestedPlace = focusPlace ?? tappedPlace;

  useEffect(() => {
    if (requestedPlace === null || !ready) {
      return;
    }

    let cancelled = false;

    void (async () => {
      let position = null;
      try {
        const trip = await tripDao.getActiveTrip();
        position = trip === null ? null : await rawFixDao.getLastFix(trip.id);
      } catch (error) {
        await recordingEventDao.logError('place card position', error);
      }
      if (cancelled) {
        return;
      }

      const geofence = representativeGeofence(requestedPlace.place);
      const course = hasCourse(requestedPlace.place.category)
        ? getLevadaCourse(requestedPlace.place.id)
        : null;

      cameraHeldByFocus.current = true;

      setCoursePolylines(
        course === null
          ? []
          : course.features[0].geometry.coordinates.map((line, index) => ({
              id: `course-${index}`,
              coordinates: line.map(([lon, lat]) => ({
                latitude: lat,
                longitude: lon,
              })),
              color: coursePaint.color,
              width: px(coursePaint.width),
            }))
      );

      setMarker([
        {
          coordinates: { latitude: geofence.lat, longitude: geofence.lon },
          title: requestedPlace.place.name,
        },
      ]);

      setCard(
        buildPlaceCard({
          placeId: requestedPlace.place.id,
          name: requestedPlace.place.name,
          category: requestedPlace.place.category,
          collected: requestedPlace.collected,
          regionName: getRegionName(requestedPlace.place.regionId),
          lat: geofence.lat,
          lon: geofence.lon,
          position,
          nowMs: Date.now(),
          language: deviceLanguage(),
          why: requestedPlace.place.why,
        })
      );

      // The whole walk where there is one, the trailhead where there is not.
      const bounds =
        course === null
          ? null
          : courseBounds(course.features[0].geometry.coordinates);

      setCamera(
        bounds === null
          ? {
              coordinates: { latitude: geofence.lat, longitude: geofence.lon },
              zoom: 13,
            }
          : frame(bounds)
      );

      onFocusHandled();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPlace, ready]);

  const closeCard = () => {
    setCard(null);
    setMarker([]);
    setCoursePolylines([]);
    // ⚠ Must clear too, or the same mark can never be tapped twice: the effect
    // is keyed on `requestedPlace`, so leaving it set means the second tap
    // changes nothing and the card does not come back.
    setTappedPlace(null);
  };
  // T-211: Back closes an open card rather than leaving the app.
  useBackHandler(card !== null, closeCard);

  /**
   * Keep a rough idea of where the user is, so *Re-centre* can hide when it has
   * nothing to do (2026-08-28).
   *
   * ⚠ A poll rather than a subscription, and it is cheaper than it looks:
   * `getLastKnownPosition` reads the system's cache and never powers up the GNSS
   * chip (CONTEXT §6.3). Ten seconds is far below the rate at which somebody
   * walks out of a 200 m circle, and this only runs while the map is on screen.
   */
  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      void (async () => {
        const fix = await locationProvider.getLastKnownPosition(RECENTRE_MAX_AGE_MS);
        if (!cancelled && fix !== null) {
          setUserAt({ latitude: fix.lat, longitude: fix.lon });
        }
      })();
      // D-087 §4: the same poll keeps the notice honest. A recorder can stop,
      // or a pause end, while the map is on screen.
      void (async () => {
        try {
          const control = await readControlInput(Date.now());
          if (!cancelled) {
            setControlInput(control.input);
            setSilentForMs(control.silentForMs);
            setWalkStarted(control.input.walkInProgress);
          }
        } catch (error) {
          await recordingEventDao.logError('control state', error);
        }
      })();
    };

    refresh();
    const timer = setInterval(refresh, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  /**
   * ⚠ Offered only when it would actually move the map. WalkNYC shows the same
   * control the same way, and a re-centre button that is always lit is a button
   * that does nothing most of the times it is pressed.
   *
   * Degrees, not metres: this is a "has the map wandered off" test, not a
   * distance, and a haversine here would be arithmetic nobody reads. Longitude
   * degrees shrink with latitude, which at Madeira's 32°N makes the east–west
   * threshold about 15% tighter than the north–south one — harmless for a
   * visibility rule, and wrong only if this ever becomes a measurement.
   */
  const showRecentre =
    userAt !== null &&
    cameraCentre !== null &&
    (Math.abs(cameraCentre.latitude - userAt.latitude) > RECENTRE_SHOW_DEGREES ||
      Math.abs(cameraCentre.longitude - userAt.longitude) > RECENTRE_SHOW_DEGREES);

  /** Re-read the recorder's state now, after something the user did. */
  const rereadControl = async () => {
    const control = await readControlInput(Date.now());
    setControlInput(control.input);
    setSilentForMs(control.silentForMs);
    setWalkStarted(control.input.walkInProgress);
  };

  /**
   * The main button (D-087 §3). What it does is decided by `primaryControl`
   * from evidence, never from what this screen last rendered.
   */
  const toggleRecording = () => {
    if (busy) {
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const now = Date.now();
        const current = (await readControlInput(now)).input;
        const control = primaryControl(current);
        if (control === 'grant-location') {
          await locationProvider.requestWhileUsingPermission();
        } else if (control === 'start-walk') {
          await startOuting(now);
        } else {
          // D-087 §7: a short summary when the outing ends.
          const summary = await endOuting(now);
          Alert.alert(summary.title, summary.lines.join('\n'), [{ text: t('walk.summary.ok') }]);
        }
        await rereadControl();
      } catch (error) {
        await recordingEventDao.logError('walk toggle', error);
      } finally {
        setBusy(false);
      }
    })();
  };

  /** The notice in words, and what tapping it does (D-087 §4). */
  const noticeKind =
    controlInput === null ? null : recorderNotice(controlInput, dismissedNotices);
  const dismiss = (kind: Exclude<RecorderNotice, null>) => () =>
    setDismissedNotices((closed) => new Set([...closed, kind]));
  const act = (action: () => Promise<void>) => () => {
    void (async () => {
      try {
        await action();
        await rereadControl();
      } catch (error) {
        await recordingEventDao.logError('notice action', error);
      }
    })();
  };
  const notice: MapNotice | null =
    noticeKind === 'paused' && controlInput?.pausedUntilTs != null
      ? {
          text: t('notice.paused', { time: formatClock(controlInput.pausedUntilTs) }),
          actionLabel: t('notice.paused.action'),
          onAction: act(resumeRecording),
        }
      : noticeKind === 'needs-always'
        ? {
            text: t('notice.needsAlways'),
            actionLabel: t('notice.needsAlways.action'),
            onAction: act(() => Linking.openSettings()),
            onDismiss: dismiss('needs-always'),
          }
        : noticeKind === 'recorder-stopped'
          ? {
              text: t('notice.silent', { duration: formatDuration(silentForMs ?? 0) }),
              actionLabel: t('notice.silent.action'),
              onAction: act(restartRecording),
              // ⚠ No onDismiss: hiding this is how T-174 went unseen for weeks.
            }
          : null;

  /**
   * Re-centre on the user (2026-08-28).
   *
   * ⚠ `getLastKnownPosition`, not a fresh fix. It returns what the system
   * already has and never powers up the GNSS chip (CONTEXT §6.3) — and with
   * Google's own location layer on, something is keeping that cache warm. A
   * button that costs a GPS acquisition every tap is the kind of thing that
   * shows up in T-054 and nowhere else.
   */
  const recentre = () => {
    void (async () => {
      try {
        const fix = await locationProvider.getLastKnownPosition(RECENTRE_MAX_AGE_MS);
        if (fix === null) {
          return;
        }
        cameraHeldByFocus.current = true;
        setCamera({
          coordinates: { latitude: fix.lat, longitude: fix.lon },
          zoom: RECENTRE_ZOOM,
        });
        setCameraCentre({ latitude: fix.lat, longitude: fix.lon });
      } catch (error) {
        await recordingEventDao.logError('recentre', error);
      }
    })();
  };

  if (failure !== null) {
    return (
      <View style={styles.centred}>
        <Text style={styles.failureTitle}>{t('map.couldNotStart')}</Text>
        <Text style={styles.failureDetail}>{failure}</Text>
      </View>
    );
  }

  if (!ready || !activityReady) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={colors.action} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <GoogleMaps.View
        style={styles.map}
        cameraPosition={camera ?? undefined}
        // The trace under the course: the course is only ever on screen in
        // answer to a direct question, so for those few seconds it wins.
        polylines={[...tracePolylines, ...coursePolylines]}
        markers={marker}
        // The places already earned (T-112). Circles rather than markers
        // because a marker needs an image ref and therefore `expo-image`, which
        // this app does not carry — see `collectedMarks.ts`.
        circles={[...toCollectMarks, ...collectedMarks]}
        onCircleClick={(circle) => {
          const place = places.find((candidate) => candidate.id === circle.id);
          if (place !== undefined) {
            // Same route in as the passport's *Show on map* (D-052), so a mark
            // on the map and a stamp in the passport open the identical card.
            // ⚠ Since D-085 not every drawn place is collected, so it is asked.
            setTappedPlace({ place, collected: collectedIds.has(place.id) });
          }
        }}
        // ⚠ The only source of the user's own zoom. Without it the marks keep
        // the size they had when the camera was last set by the app, and a
        // pinch makes them grow or shrink with the ground.
        onCameraMove={(event) => {
          setZoom(event.zoom);
          // Where we are looking, so *Re-centre* knows whether it has a job.
          // ⚠ expo-maps types both halves as optional, so a partial coordinate is
          // dropped rather than coerced — a centre with one axis missing would
          // make the distance test below compare against zero and offer the
          // button in the middle of the Atlantic.
          const { latitude, longitude } = event.coordinates;
          if (latitude !== undefined && longitude !== undefined) {
            setCameraCentre({ latitude, longitude });
          }
        }}
        // The dark/light choice, and which of the two dark maps it draws —
        // Google's own by default (T-147). `darkMode.ts` holds that decision
        // and the reason it is not obvious.
        // ⚠ Always explicit, never `FOLLOW_SYSTEM`: this preference was set in
        // *this* app, for reading a map outdoors in Madeiran sunlight (D-026),
        // and a phone-wide theme set for something else must not overrule it.
        colorScheme={
          darkMap.dark
            ? GoogleMapsColorScheme.DARK
            : GoogleMapsColorScheme.LIGHT
        }
        properties={{
          mapType: GoogleMapsMapType.NORMAL,
          // Undefined unless the authored fallback is switched on, so that
          // Google's cartography ships exactly as Google drew it.
          mapStyleOptions:
            darkMap.mapStyleJson === undefined
              ? undefined
              : { json: darkMap.mapStyleJson },
          // ⚠ Google's own blue dot, on the project lead's instruction
          // (2026-08-28). This is **data, not chrome**: the design brief's
          // three-control budget is about buttons, and no drawing of ours
          // would be the dot people already recognise — with the heading
          // wedge and the accuracy halo that come with it for free.
          // ⚠ Google's own re-centre button stays off below; ours is a
          // labelled control, because D-015 forbids an icon alone.
          isMyLocationEnabled: true,
          isTrafficEnabled: false,
          isBuildingEnabled: false,
          selectionEnabled: false,
        }}
        uiSettings={{
          // The screen is allowed three controls (design brief §3), and none
          // of Google's chrome is one of them.
          compassEnabled: false,
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          scaleBarEnabled: false,
          togglePitchEnabled: false,
          mapToolbarEnabled: false,
        }}
      />

      {/* ⚠ A scrim under the status bar (T-112, found by looking 2026-08-17).
          Google draws its place and road labels right to the top of the view, so
          "SÃO ROQUE" and "MONTE" collided with the clock and the battery icon —
          two sets of white text over each other, neither readable.

          Faked as stacked bands rather than a real gradient, because a gradient
          needs `expo-linear-gradient` and this app does not carry it: four steps
          over the status bar's own height read as smooth at this size, and a
          single hard-edged block would look like a title bar the app does not
          have. The colour is the map's own chrome colour, so it darkens the dark
          map and lightens the light one — the same inversion as every other
          floating control here. */}
      {/* ⚠ The status bar's own icons have to invert with the map too, and
          forgetting this made the first version of the scrim worse than no
          scrim: `App.tsx` sets `style="light"` because every screen in this app
          is dark, so on the **light** map a white clock was being laid over a
          white scrim. The map is the one screen that is not always dark, so it
          is the one screen that has to say so. Mounted here, below App's, and
          the last one mounted wins. */}
      <ExpoStatusBar style={styleName === 'dark' ? 'light' : 'dark'} />

      <View style={styles.statusScrim} pointerEvents="none">
        {SCRIM_BANDS.map((opacity, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              backgroundColor: mapChrome[styleName].surface,
              opacity,
            }}
          />
        ))}
      </View>

      <PrimaryOverlay
        progress={progress}
        passportStamp={passportStamp}
        mapStyle={styleName}
        // No chip naming the nearest place (removed 2026-09-24, D-085): the
        // map stays as quiet as WalkNYC's. A ring is named by tapping it.
        bottomSlot={card !== null ? <PlaceCardView card={card} onClose={closeCard} /> : null}
        onOpenPassport={onOpenPassport}
        onOpenSettings={onOpenSettings}
        isWalking={walkStarted}
        control={controlInput === null ? 'start-walk' : primaryControl(controlInput)}
        notice={notice}
        onToggleRecording={toggleRecording}
        showRecentre={showRecentre}
        onRecentre={recentre}
      />
    </View>
  );
}

/**
 * How stale a cached fix may be and still be worth re-centring on (2026-08-28).
 *
 * Two minutes: long enough that the answer is almost always already there, short
 * enough that the map does not jump to where the user was before they walked
 * away from it. A miss simply leaves the camera alone.
 */
const RECENTRE_MAX_AGE_MS = 2 * 60 * 1000;

/** Street level — close enough to see which path you are standing on. */
const RECENTRE_ZOOM = 16;

/**
 * How far the camera may drift before *Re-centre* is worth offering, in degrees
 * of latitude. ~0.002° is roughly 200 m, which is about a screen at
 * `RECENTRE_ZOOM` — below that the button would be offering to do nothing.
 */
const RECENTRE_SHOW_DEGREES = 0.002;

/** The box around drawn trace points, reusing the trace's own rule. */
function traceBoundsOf(points: [number, number][]): Bounds {
  return traceBounds({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: points },
      },
    ],
  }) as Bounds;
}

/**
 * The scrim's opacity per band, densest against the top edge.
 *
 * Four bands, easing out: enough that the system clock sits on a settled ground,
 * little enough that the map still plainly continues underneath. The last band is
 * nearly clear so the scrim has no visible bottom edge.
 */
const SCRIM_BANDS = [0.55, 0.34, 0.16, 0.05];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  statusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // A little past the status bar, so the fade finishes below the clock rather
    // than at it. 24 is Android's own default where the platform reports none.
    height: (StatusBar.currentHeight ?? 24) * 1.6,
  },
  map: { flex: 1 },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  failureTitle: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  failureDetail: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    textAlign: 'center',
  },
});

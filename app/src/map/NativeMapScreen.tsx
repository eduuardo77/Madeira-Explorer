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
import type { TripProgress } from '../progress/tripProgress';
import { locationProvider } from '../recording/ExpoLocationProvider';
import { startTrip, stopTrip } from '../recording/tripRecording';
import { GAP_THRESHOLD_MS } from '../recording/recorderHealth';
import * as appStateDao from '../storage/dao/appStateDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import PlaceCardView from '../ui/PlaceCardView';
import PrimaryOverlay from '../ui/PrimaryOverlay';
import { colors, fontSize, mapChrome, MIN_TAP_TARGET, spacing } from '../ui/theme';
import { fitBounds, type Bounds, type CameraFit } from './cameraFit';
import { recenterCamera, RECENTER_MAX_AGE_MS } from './recenterCamera';
import { COURSE_PAINT, courseBounds, hasCourse } from './levadaHighlight';
import { parseMapStyle } from './mapStylePreference';
import type { MapStyleName } from './mapStyle';
import { buildCollectedMarks } from './collectedMarks';
import { representativeGeofence } from './placeMarkers';
import { PLACE_MARKER_PAINT } from './placeStyle';
import { darkMapPropsFor } from './darkMode';
import { supportsNativeDarkMap } from './mapsRenderer';
import { splitIntoSegments, traceBounds } from './traceGeoJson';
import { TRACE_PAINT } from './traceStyle';

import lightTemplate from '../../assets/map/light.json';
import { t } from '../i18n';

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
 * `MIN_TAP_TARGET` (60) plus `spacing.xl` (32) of bottom inset.
 *
 * ⚠ **A CONSTANT AGAIN SINCE D-080**, and the reason is worth keeping. It was a
 * function of *"did the user grant Always"*, because the walk button was hidden
 * from those who had. Both extra controls are now unconditional — re-center and
 * the walk button, each `MIN_TAP_TARGET` with a `spacing.sm` gap — so the
 * chrome is the same height for every user and there is nothing left to branch
 * on. Getting this wrong is invisible in a screenshot and frames every trace
 * too high (it once stood at 220 and drew coastal walks at 43% of screen
 * height), so it is measured, not guessed.
 */
function cameraPadding() {
  const bottomChrome = MIN_TAP_TARGET * 3 + spacing.sm * 2 + spacing.xl;
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
  const [card, setCard] = useState<PlaceCard | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  /**
   * May Google draw its own blue dot? (T-167, D-080)
   *
   * ⚠ **Not "should" — "may".** The user asked for *"a pointer with my
   * location"*, and Google's own dot is the one every Android user already
   * recognises, heading arrow included. It is the platform's layer rather than
   * ours, so the *permission* gates it: this is the OS's answer, read once at
   * launch, not a preference.
   */
  const [canShowLocation, setCanShowLocation] = useState(false);
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
      padding: cameraPadding(),
    });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const preference = await appStateDao.get(appStateDao.AppStateKey.MapStyle);
        if (!cancelled) {
          setStyleName(parseMapStyle(preference));
        }
      } catch (error) {
        await recordingEventDao.logError('map style preference', error);
      }

      try {
        await runAwardPass();

        const [nextProgress, permission, recording] = await Promise.all([
          getCurrentProgress(),
          locationProvider.getPermissionLevel(),
          locationProvider.isRecording(),
        ]);
        if (!cancelled) {
          setProgress(nextProgress);
          setIsRecording(recording);
          // ⚠ The blue dot is Google's own, and it needs a granted permission
          // to draw anything at all. Asking the map to show it while the OS has
          // refused is how a map screen ends up throwing on launch, so the flag
          // follows what the OS actually said (D-080).
          setCanShowLocation(permission !== 'denied' && permission !== 'undetermined');
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
          const fixes = await rawFixDao.getTraceFixes(trip.id);
          if (!cancelled) {
            // The same gap rule as before: where the recorder admits silence,
            // the drawing breaks rather than bridging it (ARCHITECTURE §10).
            const segments = splitIntoSegments(fixes, GAP_THRESHOLD_MS);
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

  /**
   * "Where am I" (T-167).
   *
   * ⚠ **It asks the OS, it does not read the trace.** The last recorded fix
   * belongs to a walk that may have ended yesterday; `getLastKnownPosition`
   * answers from the platform's own cache with a staleness bound, so a stale
   * answer comes back as `null` rather than as a confident wrong place.
   *
   * ⚠ **And a miss is spoken, not swallowed.** Under canopy, or in the first
   * seconds of a cold launch, there is genuinely no position — a control that
   * silently does nothing there reads as a broken button, which is the same
   * failure as the grey map reading as a broken app.
   */
  const recenter = () => {
    void (async () => {
      try {
        const position = await locationProvider.getLastKnownPosition(
          RECENTER_MAX_AGE_MS
        );
        const next = recenterCamera(position, zoom);

        if (next === null) {
          Alert.alert(t('map.noPositionTitle'), t('map.noPositionBody'));
          return;
        }

        // ⚠ Releases the focus hold, or the framing effect fights the user:
        // opening a place card sets `cameraHeldByFocus`, and a re-center after
        // that is the user overruling the card's framing on purpose.
        cameraHeldByFocus.current = true;
        setCamera(next);
      } catch (error) {
        await recordingEventDao.logError('recenter', error);
        Alert.alert(t('map.noPositionTitle'), t('map.noPositionBody'));
      }
    })();
  };

  const toggleRecording = () => {
    void (async () => {
      try {
        if (isRecording) {
          await stopTrip();
        } else {
          // The same profile the MapLibre screen used. ⚠ On the emulator this
          // must stay `driving` in practice — `walking` asks for `balanced`
          // accuracy, which an emulator cannot serve at all (D-047).
          // ⚠ `startTrip`, never `locationProvider.startRecording` — the
          // geofences have to be registered in the same breath, and for
          // months they were not (T-145).
          await startTrip('walking');
        }
        setIsRecording(await locationProvider.isRecording());
      } catch (error) {
        await recordingEventDao.logError('recording toggle', error);
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

  if (!ready) {
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
        circles={collectedMarks}
        onCircleClick={(circle) => {
          const place = places.find((candidate) => candidate.id === circle.id);
          if (place !== undefined) {
            // Same route in as the passport's *Show on map* (D-052), so a mark
            // on the map and a stamp in the passport open the identical card.
            // Only collected places are drawn, so `collected` is known.
            setTappedPlace({ place, collected: true });
          }
        }}
        // ⚠ The only source of the user's own zoom. Without it the marks keep
        // the size they had when the camera was last set by the app, and a
        // pinch makes them grow or shrink with the ground.
        onCameraMove={(event) => setZoom(event.zoom)}
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
          // ⚠ Google's own blue dot, with the heading arrow Android users
          // already know (T-167). Off for eighteen months because design brief
          // §3 allowed the screen three controls and Google's my-location
          // *button* came with it; `myLocationButtonEnabled: false` below keeps
          // the button off while the dot comes back, so the app still owns its
          // own chrome.
          isMyLocationEnabled: canShowLocation,
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
        mapStyle={styleName}
        isRecording={isRecording}
        onRecenter={recenter}
        bottomSlot={
          card === null ? null : (
            <PlaceCardView card={card} onClose={closeCard} />
          )
        }
        onOpenPassport={onOpenPassport}
        onOpenSettings={onOpenSettings}
        onToggleRecording={toggleRecording}
      />
    </View>
  );
}

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

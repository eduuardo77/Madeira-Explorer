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
import {
  GoogleMapsColorScheme,
  GoogleMapsMapType,
} from 'expo-maps/build/google/GoogleMaps.types';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PixelRatio,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Place } from '../content/contentPack';
import { getLevadaCourse } from '../content/levadaCourses';
import type { PlaceCard } from '../places/placeCard';
import { buildPlaceCard } from '../places/placeCard';
import { getCurrentProgress } from '../progress/currentProgress';
import { runAwardPass } from '../progress/stampAwards';
import type { TripProgress } from '../progress/tripProgress';
import { locationProvider } from '../recording/ExpoLocationProvider';
import { startTrip, stopTrip } from '../recording/tripRecording';
import { isBackgroundTrackingAllowed } from '../recording/trackingSettings';
import { GAP_THRESHOLD_MS } from '../recording/recorderHealth';
import * as appStateDao from '../storage/dao/appStateDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import PlaceCardView from '../ui/PlaceCardView';
import PrimaryOverlay from '../ui/PrimaryOverlay';
import { colors, fontSize, spacing } from '../ui/theme';
import { fitBounds, type Bounds, type CameraFit } from './cameraFit';
import { COURSE_PAINT, courseBounds, hasCourse } from './levadaHighlight';
import { parseMapStyle } from './mapStylePreference';
import type { MapStyleName } from './mapStyle';
import { representativeGeofence } from './placeMarkers';
import { darkMapPropsFor } from './darkMode';
import { supportsNativeDarkMap } from './mapsRenderer';
import { splitIntoSegments, traceBounds } from './traceGeoJson';
import { TRACE_PAINT } from './traceStyle';

import lightTemplate from '../../assets/map/light.json';

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
 */
const CAMERA_PADDING = { top: 96, right: 48, bottom: 220, left: 48 };

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
  const [needsRecordingControl, setNeedsRecordingControl] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const darkMap = darkMapPropsFor(styleName, supportsNativeDarkMap);
  const tracePaint = TRACE_PAINT[styleName];
  const coursePaint = COURSE_PAINT[styleName];

  const frame = (bounds: Bounds): CameraFit | null =>
    fitBounds(bounds, { width, height, padding: CAMERA_PADDING });

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

        const [nextProgress, permission, recording, backgroundAllowed] =
          await Promise.all([
            getCurrentProgress(),
            locationProvider.getPermissionLevel(),
            locationProvider.isRecording(),
            isBackgroundTrackingAllowed(),
          ]);
        if (!cancelled) {
          setProgress(nextProgress);
          // ⚠ Two different reasons to show it, and both are the same to the
          // user: the app cannot fill the map in by itself. Either the OS did
          // not grant Always, or the user turned background tracking off
          // themselves (T-146) — and somebody who turned it off deliberately
          // still needs a way to record the walk they are on right now, which
          // is the project lead's point in asking for this button.
          setNeedsRecordingControl(permission !== 'always' || !backgroundAllowed);
          setIsRecording(recording);
        }

        const trip = await tripDao.getActiveTrip();
        if (trip !== null) {
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

  /** The passport asked for a place (T-115, D-052, D-055). */
  useEffect(() => {
    if (focusPlace === null || !ready) {
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

      const geofence = representativeGeofence(focusPlace.place);
      const course = hasCourse(focusPlace.place.category)
        ? getLevadaCourse(focusPlace.place.id)
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
          title: focusPlace.place.name,
        },
      ]);

      setCard(
        buildPlaceCard({
          placeId: focusPlace.place.id,
          name: focusPlace.place.name,
          category: focusPlace.place.category,
          collected: focusPlace.collected,
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
  }, [focusPlace, ready]);

  const closeCard = () => {
    setCard(null);
    setMarker([]);
    setCoursePolylines([]);
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
        <Text style={styles.failureTitle}>The map could not start</Text>
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
          isMyLocationEnabled: false,
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

      <PrimaryOverlay
        progress={progress}
        mapStyle={styleName}
        showRecordingControl={needsRecordingControl}
        isRecording={isRecording}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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

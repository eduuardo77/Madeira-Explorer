/**
 * The primary screen (T-075): the map (T-056) with the recorded trace over it
 * (T-059) and the three controls (`PrimaryOverlay`).
 *
 * This is `docs/design-brief.md` §3 in full — gear top-left, stamp button
 * bottom-right carrying the hero number, and the conditional start/stop for
 * users without Always. The map itself is offline basemap, shaded terrain and
 * the user's own trace, which after D-032 is the whole visual product of v1.
 *
 * Everything on this screen comes from files copied out of the app binary by
 * `mapAssets.ts`. Nothing here talks to a network, ever (D-001).
 */

import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
} from '@maplibre/maplibre-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PixelRatio,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Place } from '../content/contentPack';
import type { PlaceCard } from '../places/placeCard';
import { buildPlaceCard } from '../places/placeCard';
import { openDirections } from '../places/openDirections';
import { getCurrentProgress } from '../progress/currentProgress';
import { runAwardPass } from '../progress/stampAwards';
import type { TripProgress } from '../progress/tripProgress';
import { locationProvider } from '../recording/ExpoLocationProvider';
import { GAP_THRESHOLD_MS } from '../recording/recorderHealth';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as appStateDao from '../storage/dao/appStateDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import PlaceCardView from '../ui/PlaceCardView';
import PrimaryOverlay from '../ui/PrimaryOverlay';
import { colors, fontSize, spacing } from '../ui/theme';
import { prepareMapAssets } from './mapAssets';
import { buildMapStyle, type MapStyleName } from './mapStyle';
import { parseMapStyle } from './mapStylePreference';
import type { PlaceMarkerCollection } from './placeMarkers';
import { buildFocusMarker, EMPTY_PLACE_MARKERS, representativeGeofence } from './placeMarkers';
import { PLACE_MARKER_PAINT } from './placeStyle';
import { TRACE_PAINT } from './traceStyle';
import type { TraceCollection } from './traceGeoJson';
import { buildTrace, traceBounds } from './traceGeoJson';

import lightTemplate from '../../assets/map/light.json';

/**
 * The camera's home view, read from the style the app shipped with rather
 * than from coordinates in code (D-017 — the app knows nothing about where
 * its content is until the content tells it).
 */
/**
 * Where the camera may go, and where it starts (T-062).
 *
 * ⚠ These are two different rectangles and conflating them was the first defect
 * a real device found. `madeira:bounds` is the whole tile pack — the entire
 * archipelago, 1.12° of longitude — and fitting it on a tall phone put the
 * island small and adrift in a screen of ocean. `madeira:home` is the main
 * island, which is where the user is standing.
 *
 * Both come from the shipped style's metadata, never from a literal here
 * (D-017, called absolute in CONTEXT §6.1).
 */
const PACK_BOUNDS = lightTemplate.metadata['madeira:bounds'] as [
  number,
  number,
  number,
  number,
];
const HOME_BOUNDS = lightTemplate.metadata['madeira:home'] as [
  number,
  number,
  number,
  number,
];

const EMPTY_TRACE: TraceCollection = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * A place the user asked to see, handed over from the passport (T-115).
 *
 * The whole `Place` rather than a coordinate, because the card wants its name
 * and category and the marker wants the *representative* geofence — which for
 * a levada is its trailhead, a rule that lives in `placeMarkers.ts` and should
 * not be re-derived by the caller.
 */
/**
 * A camera instruction, in the shape the native side reads (`CameraStop.kt`).
 * Either a `center` or a `bounds`, never both.
 */
type CameraStop = {
  center?: [number, number];
  bounds?: [number, number, number, number];
  zoom?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  duration: number;
  easing: 'fly';
};

export type FocusPlace = {
  place: Place;
  collected: boolean;
};

/**
 * How close the camera gets when it flies to a place.
 *
 * ⚠ Not tuned, and deliberately not tight. 13 puts a place in the context of
 * the valley it is in, which is the question a levada raises — *where is this,
 * and how do I get to it?* Framing it at street level answers a question the
 * app has already refused to be in the business of (D-018).
 */
const FOCUS_ZOOM = 13;

const EMPTY_PROGRESS: TripProgress = {
  collected: 0,
  total: 0,
  byCategory: [],
  byRegion: [],
  lockedRegionCount: 0,
};

export default function MapScreen({
  focusPlace,
  onFocusHandled,
  onOpenPassport,
  onOpenSettings,
}: {
  /**
   * A place the user asked to see, from a stamp in the passport (T-115).
   * The camera flies to it and its card opens. Null the rest of the time,
   * which is nearly always.
   */
  focusPlace: FocusPlace | null;
  /** Called once the focus has been consumed, so it does not re-fire. */
  onFocusHandled: () => void;
  onOpenPassport: () => void;
  onOpenSettings: () => void;
}) {
  const [styleJson, setStyleJson] = useState<string | null>(null);
  // Kept alongside the style so the trace can be painted for the ground it
  // actually sits on (T-060) — the two styles need opposite treatments.
  const [styleName, setStyleName] = useState<MapStyleName>('light');
  const [failure, setFailure] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceCollection>(EMPTY_TRACE);
  // At most one marker, and only while a card is open (D-052 revised —
  // the field of dots over every place was deleted by the project lead).
  const [marker, setMarker] = useState<PlaceMarkerCollection>(EMPTY_PLACE_MARKERS);
  /**
   * Where the camera has been told to go, or null for wherever it is.
   *
   * ⚠ **Declarative, not the `CameraRef` methods, and that is not a style
   * preference.** `camera.current.flyTo` throws *"NativeCameraComponent ref is
   * null, wait for the map being initialized"* when the native view has not
   * attached yet — which is precisely the case this feature has, because
   * arriving from the passport remounts this screen and asks it to move the
   * camera in the same breath. Inside an async handler that throw becomes an
   * unhandled rejection: no crash, no log, and a camera that silently ignores
   * you. Passed as a prop it is applied by the native side whenever *it* is
   * ready, which is the only party that knows.
   */
  const [cameraStop, setCameraStop] = useState<CameraStop | null>(null);
  /**
   * True once the passport has pointed the camera somewhere.
   *
   * ⚠ `focusPlace` is cleared as soon as it is consumed, so guarding the trace
   * framing with *"is a focus pending"* passes the moment it matters: the
   * trace finishes loading a beat later, sees no pending focus, and frames the
   * walk — leaving a card that names a place two valleys from what is on
   * screen. A latch, not a live check.
   */
  const cameraHeldByFocus = useRef(false);
  const [progress, setProgress] = useState<TripProgress>(EMPTY_PROGRESS);
  // The tapped place (T-115). Null is the normal state — the card is the one
  // thing on this screen that is not always there.
  const [card, setCard] = useState<PlaceCard | null>(null);
  const [cardNotice, setCardNotice] = useState<string | null>(null);
  // D-008: the start/stop control exists only for users without Always, for
  // whom it is a primary action rather than a setting (design brief §3.3).
  const [needsRecordingControl, setNeedsRecordingControl] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // The user's choice, not a hardcoded style (T-139/T-140, D-026). Read
        // before the assets so a slow copy does not decide the appearance.
        const [preference, uris] = await Promise.all([
          appStateDao.get(appStateDao.AppStateKey.MapStyle),
          prepareMapAssets(),
        ]);
        if (!cancelled) {
          const chosen = parseMapStyle(preference);
          setStyleName(chosen);
          // The phone's text-size setting. Read here rather than inside
          // `buildMapStyle` so that module stays pure and testable without
          // React Native (CONTEXT §6.6) — T-061.
          setStyleJson(buildMapStyle(chosen, uris, PixelRatio.getFontScale()));
        }
      } catch (error) {
        // A map that cannot load its files is a bug to fix, not a condition
        // to paper over — but the screen still has to say something rather
        // than sit on a spinner forever.
        const message = error instanceof Error ? error.message : String(error);
        await recordingEventDao.logError('map assets', error);
        if (!cancelled) {
          setFailure(message);
        }
      }

      try {
        // Stamps are judged on demand rather than as events arrive (T-071) —
        // opening the app is one of the two moments that trigger it, trip end
        // being the other. Idempotent, so this costs nothing when nothing is
        // new.
        await runAwardPass();

        const [nextProgress, permission, recording] = await Promise.all([
          getCurrentProgress(),
          locationProvider.getPermissionLevel(),
          locationProvider.isRecording(),
        ]);
        if (!cancelled) {
          setProgress(nextProgress);
          setNeedsRecordingControl(permission !== 'always');
          setIsRecording(recording);
        }

        const trip = await tripDao.getActiveTrip();
        if (trip !== null) {
          const fixes = await rawFixDao.getTraceFixes(trip.id);
          if (!cancelled) {
            // The same gap rule the recorder's health check uses: where the
            // recorder admits silence, the drawing breaks (ARCHITECTURE §10).
            setTrace(buildTrace(fixes, GAP_THRESHOLD_MS));
          }
        }
      } catch (error) {
        await recordingEventDao.logError('map trace', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Frame what the user actually did (2026-08-13).
   *
   * ⚠ **This is the fix for the emptiest-looking screen in the app.** Fitting
   * the island on a tall phone leaves roughly 60% of the screen as flat blue
   * sea — a screenshot made that obvious in a way no test could. The island is
   * still the day-one view, because on day one there is nothing else to show;
   * from the first recorded fix onward the camera looks at the trace.
   *
   * Skipped when the passport asked for a specific place: that request is more
   * recent than anything this knows about, and two cameras fighting is worse
   * than either.
   */
  useEffect(() => {
    if (
      styleJson === null ||
      focusPlace !== null ||
      cameraHeldByFocus.current ||
      trace.features.length === 0
    ) {
      return;
    }

    const bounds = traceBounds(trace);
    if (bounds === null) {
      return;
    }

    setCameraStop({
      bounds,
      // Asymmetric on purpose: the bottom of this screen belongs to the
      // controls and, when it is open, the card. Padding the trace out from
      // under them is what stops the newest part of a walk sitting behind a
      // button.
      padding: { top: 96, right: 48, bottom: 220, left: 48 },
      duration: 600,
      easing: 'fly',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace, styleJson]);

  /**
   * The passport asked for a place (T-115, D-052 revised).
   *
   * ⚠ Waits for `styleJson`, because until the style loads the `Camera` is not
   * mounted and `camera.current` is null — arriving from the passport is
   * exactly the case where that race happens, since this screen has just been
   * remounted.
   *
   * The last fix is read here rather than held from mount: the card asserts a
   * distance, and the freshest thing the app can honestly say is whatever the
   * recorder has stored at the moment the card opens. `placeCard.ts` throws
   * the number away if that turns out to be too old.
   */
  useEffect(() => {
    if (focusPlace === null || styleJson === null) {
      return;
    }

    let cancelled = false;

    void (async () => {
      let position = null;
      try {
        const trip = await tripDao.getActiveTrip();
        position = trip === null ? null : await rawFixDao.getLastFix(trip.id);
      } catch (error) {
        // A card without a distance is still a card with a Directions button,
        // which is the part D-018 actually promises.
        await recordingEventDao.logError('place card position', error);
      }
      if (cancelled) {
        return;
      }

      const geofence = representativeGeofence(focusPlace.place);

      // Claimed before the camera moves, so the trace framing cannot win a
      // race it does not know it is in.
      cameraHeldByFocus.current = true;

      setMarker(buildFocusMarker(focusPlace.place, focusPlace.collected));
      setCardNotice(null);
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

      // Flown, not jumped: the movement is what tells the user the map they
      // are looking at is the same island, moved — a cut leaves them
      // wondering what they are looking at.
      setCameraStop({
        center: [geofence.lon, geofence.lat],
        zoom: FOCUS_ZOOM,
        // Room for the card, which opens under it at the same moment.
        padding: { top: 96, right: 48, bottom: 220, left: 48 },
        duration: 900,
        easing: 'fly',
      });

      onFocusHandled();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPlace, styleJson]);

  if (failure !== null) {
    return (
      <View style={styles.centre}>
        <Text style={styles.failureTitle}>The map could not load</Text>
        <Text style={styles.failureDetail}>{failure}</Text>
      </View>
    );
  }

  if (styleJson === null) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={colors.action} />
        <Text style={styles.loadingNote}>Preparing the map…</Text>
      </View>
    );
  }

  const tracePaint = TRACE_PAINT[styleName];
  const markerPaint = PLACE_MARKER_PAINT[styleName];

  const closeCard = () => {
    setCard(null);
    setCardNotice(null);
    // The marker exists only for the card. Closing one closes the other, and
    // the map goes back to being the trace and nothing else (D-032).
    setMarker(EMPTY_PLACE_MARKERS);
  };

  const handleDirections = () => {
    if (card === null) {
      return;
    }
    void (async () => {
      const opened = await openDirections({
        name: card.name,
        lat: card.lat,
        lon: card.lon,
      });
      if (!opened) {
        // The one button on the card did nothing, so it has to say so.
        setCardNotice('No maps app on this phone could open this place.');
      }
    })();
  };

  const toggleRecording = () => {
    void (async () => {
      try {
        if (isRecording) {
          await locationProvider.stopRecording();
        } else {
          await locationProvider.startRecording('walking');
        }
        setIsRecording(await locationProvider.isRecording());
      } catch (error) {
        await recordingEventDao.logError('recording toggle', error);
      }
    })();
  };

  return (
    <View style={styles.map}>
      <MapLibreMap
        style={styles.map}
        mapStyle={styleJson}
        // The map is the product; the chrome is not (design brief §3). The
        // renderer's own UI stays off — attribution is presented on the About
        // screen (T-124) instead, which the licence permits for a mobile app.
        attribution={false}
        logo={false}
        compass={false}
      >
        <Camera
          {...(cameraStop ?? {})}
          initialViewState={{
            bounds: [HOME_BOUNDS[0], HOME_BOUNDS[1], HOME_BOUNDS[2], HOME_BOUNDS[3]],
          }}
          // Panning may not leave the archipelago: there is nothing outside it
          // but empty ocean tiles, and "where did the island go" is not a
          // support conversation worth having (CONTEXT §3, radical simplicity).
          // Slack outside the pack on purpose, so the coastline is never jammed
          // flush against the viewport edge.
          maxBounds={[
            PACK_BOUNDS[0] - 0.4,
            PACK_BOUNDS[1] - 0.3,
            PACK_BOUNDS[2] + 0.4,
            PACK_BOUNDS[3] + 0.3,
          ]}
          minZoom={7}
          maxZoom={16}
        />

        {/* The trace: the one saturated, heavy thing on the map (D-032,
            design brief §2.4). Two layers, one line — a casing under a strong
            core keeps it legible over both terrain shadow and pale roads.
            ⚠ The paint comes from `traceStyle.ts` and differs per style,
            because the requirements are opposite: dark-and-heavy on the light
            ground, bright-and-glowing on the dark one (D-026). A single colour
            scored 2.70:1 on the dark ground with a casing brighter than the
            line itself. */}
        <GeoJSONSource id="trace" data={trace}>
          <Layer
            type="line"
            id="trace_casing"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': tracePaint.casingColor,
              'line-opacity': tracePaint.casingOpacity,
              'line-width': tracePaint.casingWidth,
            }}
          />
          <Layer
            type="line"
            id="trace_line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': tracePaint.coreColor,
              'line-width': tracePaint.coreWidth,
            }}
          />
        </GeoJSONSource>

        {/* The one place the user asked to see (T-115, D-052 revised).
            Empty unless a card is open.

            ⚠ This used to be a dot on every curated place, and the project
            lead deleted it on 2026-08-13: the map belongs to the trace
            (D-032), and eighty markers over one line is not a map of your
            holiday. The way in is a stamp in the passport.

            Drawn after the trace so it sits above it, and not pressable —
            nothing here needs to be tapped, because the card that explains
            this marker is already open underneath. */}
        <GeoJSONSource id="place_focus" data={marker}>
          <Layer
            type="circle"
            id="place_uncollected"
            filter={['!=', ['get', 'collected'], true]}
            paint={{
              'circle-color': markerPaint.uncollected.fillColor,
              'circle-radius': markerPaint.uncollected.radius,
              'circle-stroke-color': markerPaint.uncollected.strokeColor,
              'circle-stroke-width': markerPaint.uncollected.strokeWidth,
              'circle-stroke-opacity': markerPaint.uncollected.strokeOpacity,
            }}
          />
          <Layer
            type="circle"
            id="place_collected"
            filter={['==', ['get', 'collected'], true]}
            paint={{
              'circle-color': markerPaint.collected.fillColor,
              'circle-radius': markerPaint.collected.radius,
              'circle-stroke-color': markerPaint.collected.strokeColor,
              'circle-stroke-width': markerPaint.collected.strokeWidth,
              'circle-stroke-opacity': markerPaint.collected.strokeOpacity,
            }}
          />
        </GeoJSONSource>
      </MapLibreMap>

      <PrimaryOverlay
        progress={progress}
        showRecordingControl={needsRecordingControl}
        isRecording={isRecording}
        // The card shares the bottom of the screen with the controls, and the
        // overlay lays both out — nothing here may become unreachable because
        // a card is open (design brief §3).
        bottomSlot={
          card === null ? null : (
            <PlaceCardView
              card={card}
              notice={cardNotice}
              onDirections={handleDirections}
              onClose={closeCard}
            />
          )
        }
        onOpenPassport={onOpenPassport}
        onOpenSettings={onOpenSettings}
        onToggleRecording={toggleRecording}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  loadingNote: {
    color: colors.textMuted,
    fontSize: fontSize.body,
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

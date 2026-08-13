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
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  PixelRatio,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
} from 'react-native';
import { getContentPack } from '../content/poiCatalogue';
import type { Category } from '../content/contentPack';
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
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import PlaceCardView from '../ui/PlaceCardView';
import PrimaryOverlay from '../ui/PrimaryOverlay';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from '../ui/theme';
import { prepareMapAssets } from './mapAssets';
import { buildMapStyle, type MapStyleName } from './mapStyle';
import { parseMapStyle } from './mapStylePreference';
import type { PlaceMarkerCollection } from './placeMarkers';
import { buildPlaceMarkers, EMPTY_PLACE_MARKERS } from './placeMarkers';
import { PLACE_MARKER_PAINT } from './placeStyle';
import { TRACE_PAINT } from './traceStyle';
import type { TraceCollection } from './traceGeoJson';
import { buildTrace } from './traceGeoJson';

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

const EMPTY_PROGRESS: TripProgress = {
  collected: 0,
  total: 0,
  byCategory: [],
  byRegion: [],
  lockedRegionCount: 0,
};

export default function MapScreen({
  onOpenPassport,
  onOpenSettings,
}: {
  onOpenPassport: () => void;
  onOpenSettings: () => void;
}) {
  const [styleJson, setStyleJson] = useState<string | null>(null);
  // Kept alongside the style so the trace can be painted for the ground it
  // actually sits on (T-060) — the two styles need opposite treatments.
  const [styleName, setStyleName] = useState<MapStyleName>('light');
  const [failure, setFailure] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceCollection>(EMPTY_TRACE);
  const [places, setPlaces] = useState<PlaceMarkerCollection>(EMPTY_PLACE_MARKERS);
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

        // The curated places, drawn so they can be tapped (T-115). Built from
        // the same award set the passport uses, so a stamp earned on this
        // launch fills its marker in on this launch.
        const awarded =
          trip === null
            ? new Set<string>()
            : await stampAwardDao.getAwardedPlaceIds(trip.id);
        if (!cancelled) {
          setPlaces(buildPlaceMarkers(getContentPack(), awarded));
        }

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

  /**
   * A marker was pressed (T-115).
   *
   * The last fix is read **here**, not held in state from mount: the card
   * asserts a distance, and the freshest thing the app can honestly say is
   * whatever the recorder has stored at the moment the card opens.
   * `placeCard.ts` throws the number away if that turns out to be too old.
   */
  const openCard = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = event.nativeEvent.features[0];
    const properties = feature?.properties as
      | { placeId?: string; name?: string; category?: Category; collected?: boolean }
      | undefined;
    const geometry = feature?.geometry;

    if (
      properties?.placeId === undefined ||
      properties.name === undefined ||
      properties.category === undefined ||
      geometry?.type !== 'Point'
    ) {
      return;
    }

    // Native hands the geometry back as JSON, so this is a plain array.
    const [lon, lat] = geometry.coordinates as [number, number];

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

      setCardNotice(null);
      setCard(
        buildPlaceCard({
          placeId: properties.placeId!,
          name: properties.name!,
          category: properties.category!,
          collected: properties.collected === true,
          lat,
          lon,
          position,
          nowMs: Date.now(),
        })
      );
    })();
  };

  const closeCard = () => {
    setCard(null);
    setCardNotice(null);
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

        {/* The curated places (T-115). Drawn *after* the trace, so they sit
            above it — which is also what makes them hittable: the press goes
            to the topmost layer under the finger.

            ⚠ Quiet on purpose. `placeStyle.ts` holds every colour here below
            the trace's contrast, because D-032 made the trace the whole
            visual product of v1 and eighty markers are more than enough to
            drown one line. */}
        <GeoJSONSource
          id="places"
          data={places}
          onPress={openCard}
          // The default hitbox is 44 dp. D-015 says 60, and a 4 pt circle is
          // by far the smallest target in the app — this is where that rule
          // earns its keep.
          // ⚠ These are insets *around the press point*, not a size: the box
          // is 2× each value. Half of 60, therefore, not 60.
          hitbox={{
            top: MIN_TAP_TARGET / 2,
            right: MIN_TAP_TARGET / 2,
            bottom: MIN_TAP_TARGET / 2,
            left: MIN_TAP_TARGET / 2,
          }}
        >
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

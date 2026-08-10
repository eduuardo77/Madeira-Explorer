/**
 * The map (T-056), with the recorded trace drawn over it (T-059).
 *
 * This is not yet the primary screen of `docs/design-brief.md` §3 — no gear,
 * no stamp button (those are T-075, and they need content to count). It is
 * the map itself: offline basemap, shaded terrain, and the user's own trace,
 * which after D-032 is the whole visual product of v1.
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
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GAP_THRESHOLD_MS } from '../recording/recorderHealth';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import { colors, fontSize, spacing } from '../ui/theme';
import { prepareMapAssets } from './mapAssets';
import { buildMapStyle } from './mapStyle';
import type { TraceCollection } from './traceGeoJson';
import { buildTrace } from './traceGeoJson';

import lightTemplate from '../../assets/map/light.json';

/**
 * The camera's home view, read from the style the app shipped with rather
 * than from coordinates in code (D-017 — the app knows nothing about where
 * its content is until the content tells it).
 */
const [WEST, SOUTH, EAST, NORTH] = lightTemplate.metadata[
  'madeira:bounds'
] as [number, number, number, number];

const EMPTY_TRACE: TraceCollection = {
  type: 'FeatureCollection',
  features: [],
};

export default function MapScreen() {
  const [styleJson, setStyleJson] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceCollection>(EMPTY_TRACE);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const uris = await prepareMapAssets();
        if (!cancelled) {
          setStyleJson(buildMapStyle('light', uris));
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

  return (
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
        initialViewState={{ bounds: [WEST, SOUTH, EAST, NORTH] }}
        // Panning may not leave the archipelago: there is nothing outside it
        // but empty ocean tiles, and "where did the island go" is not a
        // support conversation worth having (CONTEXT §3, radical simplicity).
        maxBounds={[WEST - 0.4, SOUTH - 0.3, EAST + 0.4, NORTH + 0.3]}
        minZoom={7}
        maxZoom={16}
      />

      {/* The trace: the one saturated, heavy thing on the map (D-032,
          design brief §2.4 — visited is darker AND heavier in the light
          style). Two layers, one line: a pale casing under a strong core
          keeps it legible over both terrain shadow and pale roads. */}
      <GeoJSONSource id="trace" data={trace}>
        <Layer
          type="line"
          id="trace_casing"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': '#ffffff',
            'line-opacity': 0.55,
            'line-width': 7,
          }}
        />
        <Layer
          type="line"
          id="trace_line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': '#c2402a',
            'line-width': 3.5,
          }}
        />
      </GeoJSONSource>
    </MapLibreMap>
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

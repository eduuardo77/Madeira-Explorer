/**
 * The trip, one day at a time, on the real map (T-253, D-099).
 *
 * ⚠⚠ **REPLACED THE ANIMATED REPLAY, ON THE PROJECT LEAD'S INSTRUCTION
 * (2026-10-06).** The lead asked for WalkNYC's way, and WalkNYC's walk viewer
 * was studied on an emulator: a still map framed on the walk, a round back
 * button, a "Walk 1 of 1" pill, a Share pill, dark time tags, and one card at
 * the foot with the date, arrows to the other walks and its figures. Of three
 * drawn options (`tools/preview-trip-viewer-options.mjs`) the lead chose **B,
 * a page per day**: on holiday a day is the nearest thing to a WalkNYC walk.
 *
 * WHAT IS ON THE MAP
 * ------------------
 * The day's lit roads at full strength, and the rest of the trip pale behind
 * them so the day is seen in its place. The day's stamps as marks, each with a
 * dark tag giving the time it was earned. **No S and E**: WalkNYC marks where a
 * walk began and ended, and a Bruma day begins and ends at the hotel, which the
 * app keeps out of everything shared (D-040).
 *
 * SHARE
 * -----
 * WalkNYC's way: one picture of this screen, the whole trip with its figures
 * and a line about the app. The screen switches to the trip, drawn from the
 * **masked** roads (`tripShare.ts`: where the user slept is cut out), hides
 * its buttons, has Google photograph the map (`takeSnapshot`, added to
 * expo-maps by this project's patch), lays that photograph under the tags and
 * the card, captures the lot and opens the share sheet. Then it switches back.
 * The live map cannot be captured directly: it is a GL surface, and
 * view-shot sees it as black.
 *
 * ⚠ **The map's gestures are off.** The tags are React views pinned with
 * `projectPoint` against the camera this screen set; a map the thumb could pan
 * would leave them behind. The arrows are how one moves.
 */

import { GoogleMaps } from 'expo-maps';
import { GoogleMapsColorScheme, GoogleMapsMapType } from 'expo-maps/build/google/GoogleMaps.types';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { getContentPack } from '../content/poiCatalogue';
import { deviceLanguage, n, t } from '../i18n';
import { fitBounds, projectPoint, type CameraFit, type Viewport } from '../map/cameraFit';
import { metresPerPoint } from '../map/collectedMarks';
import { darkMapPropsFor } from '../map/darkMode';
import type { MapStyleName } from '../map/mapStyle';
import { effectiveMapStyle, parseMapStyle } from '../map/mapStylePreference';
import { supportsNativeDarkMap } from '../map/mapsRenderer';
import { PLACE_MARKER_PAINT } from '../map/placeStyle';
import { TRACE_PAINT } from '../map/traceStyle';
import { formatDistance } from '../places/placeCard';
import * as appStateDao from '../storage/dao/appStateDao';
import { AppStateKey } from '../storage/dao/appStateDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import { colors, fontSize, mapChrome, MIN_TAP_TARGET, radius, spacing } from '../ui/theme';
import { formatDateRange } from './shareCard';
import { REFUSAL_KEYS, shareCardImage } from './shareTrip';
import {
  boundsOf,
  dayTitle,
  formatClock,
  openingDay,
  type DayRun,
  type ViewerStamp,
} from './tripDays';
import { buildShareScene } from './tripShare';
import { loadTripView, type TripView } from './tripViewerData';

/**
 * The pills' row, and the card at the foot: the camera frames the day between
 * them. The top leaves room for a tag above the highest stamp (seen on the P30:
 * Camacha's tag sat under the pills at 112).
 */
const TOP_CLEARANCE = 112 + 34;
/**
 * The card's foot sits above Google's logo, which must stay visible: map
 * attribution is one of the things Bruma keeps that others trade away. At
 * `spacing.md` the card covered half of it, in the viewer and the shared image.
 */
const CARD_BOTTOM = spacing.xl + spacing.sm;
const CARD_CLEARANCE = 236 + CARD_BOTTOM - spacing.md;

/**
 * How long the map gets to fetch its tiles after the camera moves for a share,
 * before it is photographed. ⚠ A wait, not a signal: expo-maps reports when a
 * map first loads, not when a later camera move has finished drawing. Too
 * short shows as grey squares in the image; it is only ever spent on a share.
 */
const MAP_SETTLE_MS = 1500;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The share's picture: the masked trip, framed, and Google's photograph of it once taken. */
type ShareScene = { runs: DayRun[]; camera: CameraFit; snapshot: string | null };

export default function TripViewerScreen({
  onClose,
  onReplay,
}: {
  onClose: () => void;
  /** WalkNYC's Replay: the animated film of the whole trip. */
  onReplay: () => void;
}) {
  const [view, setView] = useState<TripView | null | 'loading'>('loading');
  const [styleName, setStyleName] = useState<MapStyleName>('light');
  const [dayIndex, setDayIndex] = useState(-1);
  const { width, height } = useWindowDimensions();
  const language = deviceLanguage();
  const mapRef = useRef<GoogleMaps.MapView>(null);
  /**
   * What a share captures: the photograph, the tags and the card, and not the
   * live map. With the map in the captured tree the first build's image had
   * the map and nothing over it (P30, 2026-10-06).
   */
  const shareFrameRef = useRef<View>(null);
  const [shareScene, setShareScene] = useState<ShareScene | null>(null);
  const [sharing, setSharing] = useState(false);
  /** Resolved when the snapshot under the card has loaded, so the capture includes it. */
  const snapshotLoaded = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loaded, preference] = await Promise.all([
          loadTripView(),
          appStateDao.get(AppStateKey.MapStyle),
        ]);
        if (!cancelled) {
          setStyleName(effectiveMapStyle(parseMapStyle(preference)));
          setView(loaded);
          setDayIndex(loaded === null ? -1 : openingDay(loaded.days));
        }
      } catch (error) {
        await recordingEventDao.logError('trip viewer', error);
        if (!cancelled) {
          setView(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const viewport: Viewport = useMemo(
    () => ({
      width,
      height,
      padding: {
        top: TOP_CLEARANCE,
        bottom: CARD_CLEARANCE,
        left: spacing.xl,
        right: spacing.xl,
      },
    }),
    [width, height],
  );

  /** The share frames the whole trip; nothing sits at the top but its tags. */
  const shareViewport: Viewport = useMemo(
    () => ({
      width,
      height,
      padding: {
        top: spacing.xl * 2 + TAG_LIFT,
        bottom: CARD_CLEARANCE + spacing.lg,
        left: spacing.xl,
        right: spacing.xl,
      },
      // The trip rests on the card, as the replay's finale does: a wide, shallow
      // trip centred left empty sea between them (seen in the first shared image).
      align: 'bottom',
    }),
    [width, height],
  );

  const days = view !== null && view !== 'loading' ? view.days : [];
  const day = days[dayIndex] ?? null;
  const allStamps = useMemo(() => days.flatMap((d) => d.stamps), [days]);

  const camera: CameraFit | null = useMemo(
    () => (day?.bounds == null ? null : fitBounds(day.bounds, viewport)),
    [day, viewport],
  );

  /**
   * The first day's camera, given to the map as its initial camera on the
   * very render that mounts it, so the map is born there.
   *
   * A ref set during render, before the map exists, so the first value the
   * native view ever receives is the right one (the replay learnt this: born
   * with no camera, the map shows 0°, 0°). Later days move the camera through
   * `setCameraPosition`, which animates.
   *
   * ⚠ A blank map on the P30 on 2026-10-06 was first blamed on this, wrongly:
   * the phone had no network, and the home map was blank too.
   */
  const initialCamera = useRef<CameraFit | undefined>(undefined);
  if (initialCamera.current === undefined && camera !== null) {
    initialCamera.current = camera;
  }

  const shownCamera = useRef<CameraFit | null>(null);
  useEffect(() => {
    if (camera === null) {
      return;
    }
    if (shownCamera.current !== null && shownCamera.current !== camera) {
      mapRef.current?.setCameraPosition({ ...camera, duration: 400 });
    }
    shownCamera.current = camera;
  }, [camera]);

  const paint = TRACE_PAINT[styleName];
  const darkMap = darkMapPropsFor(styleName, supportsNativeDarkMap);

  /** What is on the map now: the day in its trip, or the masked trip for a share. */
  const shown: {
    runs: DayRun[];
    stamps: ViewerStamp[];
    camera: CameraFit | null;
    viewport: Viewport;
  } =
    shareScene !== null
      ? {
          runs: shareScene.runs,
          stamps: allStamps,
          camera: shareScene.camera,
          viewport: shareViewport,
        }
      : { runs: day?.runs ?? [], stamps: day?.stamps ?? [], camera, viewport };

  const polylines = useMemo(() => {
    if (view === null || view === 'loading' || day === null) {
      return [];
    }
    const px = PixelRatio.get();
    // The whole trip first, pale, then the day on top of it at full strength.
    // A share has no pale trip: only the masked roads may be in that picture.
    const behind = (shareScene !== null ? [] : view.lines).map((line, index) => ({
      id: `trip-${index}`,
      coordinates: line.points.map(([latitude, longitude]) => ({ latitude, longitude })),
      color: paint.otherDayColor,
      width: paint.coreWidth * px,
    }));
    const today = shown.runs.map((run, index) => ({
      id: `day-${index}`,
      coordinates: run.points.map(([latitude, longitude]) => ({ latitude, longitude })),
      color: run.faded ? paint.fadedColor : paint.coreColor,
      width: paint.coreWidth * px,
    }));
    return [...behind, ...today];
  }, [view, day, paint, shareScene, shown.runs]);

  const marks = PLACE_MARKER_PAINT[styleName].collected;
  const circles = useMemo(
    () =>
      shown.camera === null
        ? []
        : shown.stamps.map((stamp) => ({
            id: `stamp-${stamp.placeId}`,
            center: { latitude: stamp.lat, longitude: stamp.lon },
            radius: marks.radius * metresPerPoint(shown.camera?.zoom ?? 0, stamp.lat),
            color: marks.fillColor,
            lineColor: marks.strokeColor,
            lineWidth: marks.strokeWidth,
          })),
    [shown.camera, shown.stamps, marks],
  );

  const share = async () => {
    if (sharing || view === null || view === 'loading') {
      return;
    }
    setSharing(true);
    try {
      const scene = await buildShareScene();
      if (!scene.ok) {
        Alert.alert(t('passport.share.nothingTitle'), t(REFUSAL_KEYS[scene.refusal]));
        return;
      }
      const bounds = boundsOf(scene.runs, allStamps);
      const shareCamera = bounds === null ? null : fitBounds(bounds, shareViewport);
      if (shareCamera === null) {
        Alert.alert(t('passport.share.failedTitle'), t(REFUSAL_KEYS.failed));
        return;
      }
      setShareScene({ runs: scene.runs, camera: shareCamera, snapshot: null });
      // ⚠ 1, not 0: Google's animateCamera refuses a zero duration, and the
      // share's first build photographed the day it had not left (P30).
      mapRef.current?.setCameraPosition({ ...shareCamera, duration: 1 });
      await pause(MAP_SETTLE_MS);
      const snapshot = (await mapRef.current?.takeSnapshot()) ?? null;
      if (snapshot === null) {
        await recordingEventDao.logError('trip share', new Error('the map gave no snapshot'));
        Alert.alert(t('passport.share.failedTitle'), t(REFUSAL_KEYS.failed));
        return;
      }
      // Wait for the photograph to be drawn under the card, but not forever.
      await Promise.race([
        new Promise<void>((resolve) => {
          snapshotLoaded.current = resolve;
          setShareScene((current) => (current === null ? null : { ...current, snapshot }));
        }),
        pause(3000),
      ]);
      const sent = await shareCardImage(shareFrameRef);
      if (!sent.ok) {
        Alert.alert(t('passport.share.failedTitle'), t(REFUSAL_KEYS[sent.refusal]));
      }
    } finally {
      snapshotLoaded.current = null;
      setShareScene(null);
      if (camera !== null) {
        mapRef.current?.setCameraPosition({ ...camera, duration: 1 });
      }
      setSharing(false);
    }
  };

  if (view === 'loading') {
    return (
      <View style={[styles.root, styles.centre]}>
        <ActivityIndicator size="large" color={colors.action} />
      </View>
    );
  }

  if (view === null || day === null) {
    return (
      <View style={[styles.root, styles.centre]}>
        <Text style={styles.empty}>{t('replay.nothingToWatch')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('replay.close')}
          accessibilityHint={t('trip.a11y.back')}
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Text style={styles.closeText}>{t('replay.close')}</Text>
        </Pressable>
      </View>
    );
  }

  const chrome = mapChrome.light;
  const range = formatDateRange(view.startedTs, view.endTs, language);

  const destination = getContentPack().destination ?? t('share.fallbackTitle');

  const tags =
    shown.camera === null
      ? null
      : shown.stamps.map((stamp) => {
          const at = projectPoint(
            { latitude: stamp.lat, longitude: stamp.lon },
            shown.camera as CameraFit,
            shown.viewport,
          );
          const time = formatClock(stamp.awardedTs, language);
          return (
            <View
              key={stamp.placeId}
              accessible
              accessibilityLabel={t('trip.a11y.stampAt', { name: stamp.name, time })}
              pointerEvents="none"
              style={[
                styles.tagAnchor,
                // Kept on screen: a stamp on the coast at the frame's edge pushed its tag off it.
                {
                  left: Math.max(TAG_HALF, Math.min(width - TAG_HALF, at.x)),
                  top: at.y - TAG_LIFT,
                },
              ]}
            >
              <Text style={styles.tag}>{time}</Text>
            </View>
          );
        });

  return (
    <View style={styles.root}>
      <GoogleMaps.View
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        cameraPosition={initialCamera.current}
        polylines={polylines}
        circles={circles}
        colorScheme={darkMap.dark ? GoogleMapsColorScheme.DARK : GoogleMapsColorScheme.LIGHT}
        properties={{
          mapType: GoogleMapsMapType.NORMAL,
          mapStyleOptions:
            darkMap.mapStyleJson === undefined ? undefined : { json: darkMap.mapStyleJson },
          isMyLocationEnabled: false,
          isTrafficEnabled: false,
          isBuildingEnabled: false,
          selectionEnabled: false,
        }}
        uiSettings={{
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

      {shareScene !== null ? null : tags}

      {shareScene !== null ? null : (
        <View style={styles.topRow} pointerEvents="box-none">
          {/* Centred on the screen, not between its neighbours, as WalkNYC's is. */}
          <View style={styles.pillCentre} pointerEvents="none">
            <View style={[styles.pill, { backgroundColor: chrome.surface }]}>
              <Text style={[styles.pillText, { color: chrome.content }]}>
                {t('trip.day', { day: dayIndex + 1, days: days.length })}
              </Text>
            </View>
          </View>
          {/* Back and play on the left: on the right, play met the pill at 360 dp. */}
          <View style={styles.buttonGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('trip.a11y.back')}
              onPress={onClose}
              hitSlop={(MIN_TAP_TARGET - ROUND) / 2}
              style={({ pressed }) => [
                styles.round,
                { backgroundColor: chrome.surface },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.roundGlyph, { color: chrome.content }]}>{'←'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('trip.a11y.replay')}
              onPress={onReplay}
              hitSlop={(MIN_TAP_TARGET - ROUND) / 2}
              style={({ pressed }) => [
                styles.round,
                { backgroundColor: chrome.surface },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.playGlyph, { color: chrome.link }]}>{'▶'}</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: sharing }}
            disabled={sharing}
            onPress={() => void share()}
            hitSlop={(MIN_TAP_TARGET - PILL) / 2}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: chrome.surface },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.pillText, { color: chrome.link }]}>
              {sharing ? t('passport.sharing') : t('trip.share')}
            </Text>
          </Pressable>
        </View>
      )}

      {shareScene !== null ? (
        <View
          ref={shareFrameRef}
          collapsable={false}
          // Opaque, so no corner of the image is ever transparent: the first
          // shared image showed Android's checkerboard wherever nothing was drawn.
          style={[StyleSheet.absoluteFill, styles.root]}
          pointerEvents="none"
        >
          {shareScene.snapshot === null ? null : (
            <Image
              source={{ uri: shareScene.snapshot }}
              style={StyleSheet.absoluteFill}
              // ⚠ No fade: Android fades a loaded image in over 300 ms, and the
              // first shared image was captured mid-fade, the map a faint ghost.
              fadeDuration={0}
              onLoad={() => snapshotLoaded.current?.()}
            />
          )}
          {tags}
          <View style={styles.card}>
            <View style={styles.navText}>
              <Text style={styles.title}>{range}</Text>
              <Text style={styles.subtitle}>{destination}</Text>
            </View>
            <View style={styles.stats}>
              <Stat
                value={String(view.stampCount)}
                label={n('trip.stat.stamps', view.stampCount)}
                first
              />
              <Stat
                value={formatDistance(view.travelledM, language)}
                label={t('trip.stat.travelled')}
              />
              <Stat value={String(days.length)} label={n('trip.stat.days', days.length)} />
            </View>
            <Text style={styles.plug}>{t('trip.share.plug')}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.nav}>
            <Arrow
              glyph={'‹'}
              label={t('trip.a11y.previous')}
              enabled={dayIndex > 0}
              onPress={() => setDayIndex((i) => Math.max(0, i - 1))}
            />
            <View style={styles.navText}>
              <Text style={styles.title}>{dayTitle(day.startTs, language)}</Text>
              <Text style={styles.subtitle}>{t('trip.ofTrip', { range })}</Text>
            </View>
            <Arrow
              glyph={'›'}
              label={t('trip.a11y.next')}
              enabled={dayIndex < days.length - 1}
              onPress={() => setDayIndex((i) => Math.min(days.length - 1, i + 1))}
            />
          </View>
          <View style={styles.stats}>
            <Stat
              value={String(day.stamps.length)}
              label={n('trip.stat.stamps', day.stamps.length)}
              first
            />
            <Stat value={formatDistance(day.metres, language)} label={t('trip.stat.travelled')} />
            <Stat value={formatDistance(view.travelledM, language)} label={t('trip.stat.trip')} />
          </View>
          <View style={styles.dots} importantForAccessibility="no-hide-descendants">
            {days.map((d, index) => (
              <View key={d.startTs} style={[styles.dot, index === dayIndex && styles.dotOn]} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Arrow({
  glyph,
  label,
  enabled,
  onPress,
}: {
  glyph: string;
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      hitSlop={(MIN_TAP_TARGET - ARROW) / 2}
      style={({ pressed }) => [
        styles.arrow,
        !enabled && styles.arrowOff,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.arrowGlyph}>{glyph}</Text>
    </Pressable>
  );
}

function Stat({ value, label, first = false }: { value: string; label: string; first?: boolean }) {
  return (
    <View style={[styles.stat, !first && styles.statDivided]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Drawn sizes; each control's target is grown to 60 dp with `hitSlop` (D-015). */
const ROUND = 40;
const PILL = 34;
const ARROW = 36;
/** How far above its stamp a tag sits, so the mark stays visible under it. */
const TAG_LIFT = 34;
/** Half the widest tag ("12:07 PM"): how close to an edge a tag's centre may come. */
const TAG_HALF = 44;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centre: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  empty: { color: colors.textMuted, fontSize: fontSize.body, textAlign: 'center' },
  pressed: { opacity: 0.75 },
  closeButton: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  closeText: { color: colors.tint, fontSize: fontSize.body, fontWeight: '600' },
  topRow: {
    position: 'absolute',
    top: spacing.xl + spacing.sm,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  round: {
    width: ROUND,
    height: ROUND,
    borderRadius: ROUND / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: mapChrome.light.elevation,
  },
  roundGlyph: { fontSize: fontSize.title, fontWeight: '600' },
  pill: {
    height: PILL,
    paddingHorizontal: spacing.md,
    borderRadius: PILL / 2,
    justifyContent: 'center',
    elevation: mapChrome.light.elevation,
  },
  pillCentre: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  buttonGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  playGlyph: { fontSize: fontSize.label, marginLeft: 3 },
  pillText: { fontSize: fontSize.small, fontWeight: '600' },
  tagAnchor: {
    position: 'absolute',
    transform: [{ translateX: -50 }],
    width: 100,
    alignItems: 'center',
  },
  tag: {
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
    fontSize: fontSize.small,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  card: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: CARD_BOTTOM,
    backgroundColor: colors.surface,
    borderRadius: radius.card + 4,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm + spacing.xs,
    elevation: 4,
  },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navText: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  title: { color: colors.text, fontSize: fontSize.label, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.small, textAlign: 'center' },
  arrow: {
    width: ARROW,
    height: ARROW,
    borderRadius: ARROW / 2,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowOff: { opacity: 0.35 },
  arrowGlyph: { color: colors.text, fontSize: fontSize.title, lineHeight: fontSize.title + 2 },
  stats: { flexDirection: 'row', marginTop: spacing.md },
  stat: { flex: 1, alignItems: 'center' },
  statDivided: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.surfaceRaised },
  statValue: { color: colors.text, fontSize: fontSize.label, fontWeight: '700' },
  statLabel: {
    color: colors.textMuted,
    fontSize: fontSize.small - 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md },
  dot: {
    flexShrink: 1,
    width: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
  },
  dotOn: { backgroundColor: mapChrome.light.link },
  plug: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

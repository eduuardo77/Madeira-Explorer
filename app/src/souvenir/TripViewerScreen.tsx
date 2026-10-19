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
 * them so the day is seen in its place. Clean by default: no mark where a stamp
 * was earned and no time; the *Horas* pill shows a dark tag with each stamp's
 * time (the lead, 19 Oct 2026; the share follows the pill). **No S and E**: WalkNYC marks where a
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
import { darkMapPropsFor } from '../map/darkMode';
import type { MapStyleName } from '../map/mapStyle';
import { effectiveMapStyle, parseMapStyle } from '../map/mapStylePreference';
import { supportsNativeDarkMap } from '../map/mapsRenderer';
import { TRACE_PAINT } from '../map/traceStyle';
import { packTrace } from '../map/mergedTrace';
import { groupLabel, groupTags } from './tagGroups';
import { formatDistance } from '../places/placeCard';
import * as appStateDao from '../storage/dao/appStateDao';
import { AppStateKey } from '../storage/dao/appStateDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import { colors, fontSize, mapChrome, MIN_TAP_TARGET, radius, spacing } from '../ui/theme';
import { formatDateRange } from './shareCard';
import { SNAP_MS } from './replayMap';
import { REFUSAL_KEYS, shareCardImage } from './shareTrip';
import {
  boundsOf,
  dayTitle,
  formatClock,
  openingDay,
  sameDays,
  type DayRun,
  type ViewerStamp,
} from './tripDays';
import ChevronMark from '../ui/ChevronMark';
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

/** The local midnight after the one at `startTs`: a day's end, daylight saving included. */
function nextMidnight(startTs: number): number {
  const next = new Date(startTs);
  next.setDate(next.getDate() + 1);
  return next.getTime();
}

export default function TripViewerScreen({
  tripId,
  onClose,
  onReplay,
}: {
  /** The trip to show, from the passport's list (T-261); the trip on show when absent. */
  tripId?: number;
  onClose: () => void;
  /**
   * WalkNYC's Replay: the animated film of the trip shown, of one day of it
   * when `range` is given (the lead, 17 Oct 2026: "for the day, both").
   */
  onReplay: (tripId: number, range?: { fromTs: number; toTs: number }) => void;
}) {
  const [view, setView] = useState<TripView | null | 'loading'>('loading');
  const [styleName, setStyleName] = useState<MapStyleName>('light');
  const [dayIndex, setDayIndex] = useState(-1);
  /** ▶ was pressed: this day, or the whole trip. */
  const [choosing, setChoosing] = useState(false);
  /** Every stamp's time on the map, the *Horas* pill. Off, the picture is clean. */
  const [showTimes, setShowTimes] = useState(false);
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
          loadTripView(tripId, 'stored'),
          appStateDao.get(AppStateKey.MapStyle),
        ]);
        if (!cancelled) {
          setStyleName(effectiveMapStyle(parseMapStyle(preference)));
          setView(loaded);
          setDayIndex(loaded === null ? -1 : openingDay(loaded.days));
        }
        // What was recorded since the map last matched, behind the page; the
        // day shown stays the day shown.
        const matched = await loadTripView(tripId, 'matched');
        if (!cancelled && matched !== null && (loaded === null || !sameDays(loaded.days, matched.days))) {
          setView(matched);
          if (loaded === null) setDayIndex(openingDay(matched.days));
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
  }, [tripId]);

  const viewport: Viewport = useMemo(
    () => ({
      width,
      height,
      padding: {
        top: TOP_CLEARANCE,
        bottom: CARD_CLEARANCE,
        // Tighter than the share's: a day that spans the island fills more of the width.
        left: spacing.md,
        right: spacing.md,
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
    // Only the day shown (the lead, 17 Oct 2026): the other days' roads, drawn
    // pale behind it, cluttered the view.
    // As few polylines as the runs' round ends allow (T-278, `mergedTrace.ts`).
    return packTrace(
      shown.runs.map((run) => run.points.map(([latitude, longitude]) => ({ latitude, longitude })))
    ).map(({ coordinates, gaps }, index) => ({
      id: `day-${index}`,
      coordinates,
      gaps,
      color: paint.coreColor,
      width: paint.coreWidth * px,
    }));
  }, [view, day, paint, shareScene, shown.runs]);

  const showDay = (index: number) => setDayIndex(Math.max(0, Math.min(days.length - 1, index)));

  const share = async () => {
    if (sharing || view === null || view === 'loading') {
      return;
    }
    setSharing(true);
    try {
      const scene = await buildShareScene(view.tripId);
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
      // ⚠ Not 0 (`SNAP_MS` says why), and the share's first build
      // photographed the day it had not left (P30).
      mapRef.current?.setCameraPosition({ ...shareCamera, duration: SNAP_MS });
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
        mapRef.current?.setCameraPosition({ ...camera, duration: SNAP_MS });
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
    // No trip yet, or a trip whose positions never followed a road (the P30's
    // August day: 128 of them, all at a standstill): "go out with the app"
    // is true of the first and false of the second (T-275).
    return (
      <View style={[styles.root, styles.centre]}>
        <Text style={styles.empty}>
          {view === null ? t('replay.nothingToWatch') : t('trip.nothingLit')}
        </Text>
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

  /**
   * The stamps' times, only when the *Horas* pill asks for them, in the viewer
   * and the share alike. Clean by default, and no mark where a stamp was: the
   * lead, 19 Oct 2026, the times and then their dots made the picture less
   * pleasing. Tags that would overlap share one (`tagGroups.ts`, 17 Oct 2026).
   */
  const tags =
    !showTimes || shown.camera === null
      ? null
      : groupTags(
          shown.stamps.map((stamp) => {
            const at = projectPoint(
              { latitude: stamp.lat, longitude: stamp.lon },
              shown.camera as CameraFit,
              shown.viewport,
            );
            return { id: stamp.placeId, x: at.x, y: at.y, ts: stamp.awardedTs };
          })
        ).map((group) => {
          const named = group.items.map((item) => ({
            name: shown.stamps.find((stamp) => stamp.placeId === item.id)?.name ?? '',
            time: formatClock(item.ts, language),
          }));
          return (
            <View
              key={group.id}
              accessible
              accessibilityLabel={named.map((one) => t('trip.stampAt', one)).join('. ')}
              pointerEvents="none"
              style={[
                styles.tagAnchor,
                // Kept on screen: a stamp on the coast at the frame's edge pushed its tag off it.
                {
                  left: Math.max(TAG_HALF, Math.min(width - TAG_HALF, group.x)),
                  top: group.y - TAG_LIFT,
                },
              ]}
            >
              <Text style={styles.tag}>{groupLabel(named.map((one) => one.time))}</Text>
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
            {/* T-275: the timelapse and the share are of the trip shown, any of
                them, through the same masked export. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('trip.a11y.replay')}
              accessibilityState={{ expanded: choosing }}
              onPress={() => setChoosing((open) => !open)}
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

      {shareScene !== null ? null : (
        <View style={styles.timesRow} pointerEvents="box-none">
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={t('trip.times')}
            accessibilityHint={t('trip.a11y.times')}
            accessibilityState={{ checked: showTimes }}
            onPress={() => setShowTimes((on) => !on)}
            hitSlop={(MIN_TAP_TARGET - PILL) / 2}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: showTimes ? chrome.link : chrome.surface },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.pillText, { color: showTimes ? chrome.surface : chrome.link }]}>
              {t('trip.times')}
            </Text>
          </Pressable>
        </View>
      )}

      {shareScene !== null || !choosing ? null : (
        <View style={styles.choiceRow} pointerEvents="box-none">
          {day !== null ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setChoosing(false);
                onReplay(view.tripId, { fromTs: day.startTs, toTs: nextMidnight(day.startTs) });
              }}
              hitSlop={(MIN_TAP_TARGET - PILL) / 2}
              style={({ pressed }) => [styles.pill, { backgroundColor: chrome.surface }, pressed && styles.pressed]}
            >
              <Text style={[styles.pillText, { color: chrome.link }]}>{t('trip.replay.day')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setChoosing(false);
              onReplay(view.tripId);
            }}
            hitSlop={(MIN_TAP_TARGET - PILL) / 2}
            style={({ pressed }) => [styles.pill, { backgroundColor: chrome.surface }, pressed && styles.pressed]}
          >
            <Text style={[styles.pillText, { color: chrome.link }]}>{t('trip.replay.trip')}</Text>
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
                value={formatDistance(view.litM, language)}
                label={t('trip.stat.lit')}
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
              direction="left"
              label={t('trip.a11y.previous')}
              enabled={dayIndex > 0}
              onPress={() => showDay(dayIndex - 1)}
            />
            <View style={styles.navText}>
              <Text style={styles.title}>{dayTitle(day.startTs, language)}</Text>
            </View>
            <Arrow
              direction="right"
              label={t('trip.a11y.next')}
              enabled={dayIndex < days.length - 1}
              onPress={() => showDay(dayIndex + 1)}
            />
          </View>
          <View style={styles.stats}>
            <Stat
              value={String(day.stamps.length)}
              label={n('trip.stat.stamps', day.stamps.length)}
              first
            />
            <Stat value={formatDistance(day.litM, language)} label={t('trip.stat.lit')} />
            <Stat value={formatDistance(view.litM, language)} label={t('trip.stat.trip')} />
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
  direction,
  label,
  enabled,
  onPress,
}: {
  direction: 'left' | 'right';
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
      <ChevronMark size={24} color={colors.text} direction={direction} />
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
/** How far above its stamp's place a tag sits. */
const TAG_LIFT = 34;
/** Half the widest tag ("12:07 PM"): how close to an edge a tag's centre may come. */
const TAG_HALF = 70;

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
  /** Under the back and play buttons: the film of this day, or of the trip. */
  choiceRow: {
    position: 'absolute',
    top: spacing.xl + spacing.sm + PILL + spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  /** Under the share pill, on the right, level with the film's choice on the left. */
  timesRow: {
    position: 'absolute',
    top: spacing.xl + spacing.sm + PILL + spacing.md,
    right: spacing.md,
  },
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
    transform: [{ translateX: -80 }],
    width: 160,
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

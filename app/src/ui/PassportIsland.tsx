/**
 * The passport's island (T-325): the small island beside the title, and the
 * map it opens into, inside the page, under the numbers.
 *
 * The map is `islandMapArt.ts`'s, the same drawing the unlock sheet shows,
 * with the user's lit roads under the dots: the roads are what this app is
 * (CONTEXT §4), the stamps sit on them. A dot is gold where the stamp is in
 * colour, a gold ring where it waits behind the unlock, grey where the user
 * has not been. A tap shows the place in a bubble pinned to its dot; the
 * bubble does what tapping the stamp in its row does. Dots a finger cannot
 * split show as a list; a double tap, or the list's *zoom in*, brings that
 * part of the island closer, with the dots kept their size on screen.
 *
 * Sketched and approved in `tools/preview-island-bubble.mjs` (23 Nov 2026).
 * Arithmetic in `passport/islandView.ts`; this file draws and keeps state.
 *
 * ⚠ With *reduce motion* on, nothing animates: the island is there, lit.
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import type { Category } from '../content/contentPack';
import { islandMap, type IslandMapPlace, type IslandMapRegion } from '../passport/islandMapArt';
import { islandRoads } from '../passport/islandRoads';
import {
  bubblePlacement,
  dotState,
  fullView,
  GROUP_ZOOM,
  groupCircle,
  hitTest,
  isZoomed,
  lightingOrder,
  onScreen,
  stateCounts,
  TAP_ZOOM,
  toScreen,
  unitsPerPixel,
  zoomAround,
  type DotState,
  type IslandDot,
  type IslandViewBox,
} from '../passport/islandView';
import { designFor } from '../passport/stampArt';
import type { StampAward } from '../storage/types';
import { deviceLanguage, n, t } from '../i18n';
import { DATE_LOCALES } from '../i18n/languages';
import Padlock from './Padlock';
import StampArt from './StampArt';
import { album, fontSize, MIN_TAP_TARGET, reward, spacing } from './theme';
import type { PassportStamp } from './PassportView';
import { useReduceMotion } from './useReduceMotion';

/** What the screen hands the island: content and the user's roads, worked out once. */
export type PassportIslandData = {
  regions: IslandMapRegion[];
  /** Each place with its category and its municipality's name, for the bubble. */
  places: Array<IslandMapPlace & { category: Category; regionName: string | null }>;
  /** Every trip's lit roads, `[lon, lat]`, as the map draws them. */
  roads: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  /** Places earned since the island was last opened, in earned order (`freshSince`). */
  fresh: readonly string[];
  /** The island was opened: remember when, for next time's `fresh`. */
  onSeen?: () => void;
};

const LAND = '#2A2A2E';
const LAND_LIT = '#3A3424';
const COAST = '#48484A';
const GREY = '#6E6E76';
const BUBBLE = '#2C2C2E';
const BUBBLE_EDGE = '#48484A';
const BUBBLE_W = 280;
/** The four sides a `drawnW` x `drawnH` control grows by to reach the 60 dp target (D-015). */
const slopFor = (drawnH: number, drawnW: number) => {
  const v = Math.max(0, Math.ceil((MIN_TAP_TARGET - drawnH) / 2));
  const h = Math.max(0, Math.ceil((MIN_TAP_TARGET - drawnW) / 2));
  return { top: v, bottom: v, left: h, right: h };
};
const PILL_SLOP = slopFor(28, 96);
const LINK_SLOP = slopFor(20, 72);
/** Chips sit 6 dp apart: they grow up and down only. */
const CHIP_SLOP = { ...slopFor(32, MIN_TAP_TARGET), left: 0, right: 0 };
/** One dot lights every this many ms as the island opens. */
const LIGHT_STEP_MS = 45;
const CATEGORIES: Category[] = ['viewpoint', 'levada', 'village', 'beach', 'landmark'];
/** The bubble names one place, so the singular, as the place card does. */
const ONE_CATEGORY_KEYS = {
  viewpoint: 'placeCard.category.viewpoint',
  levada: 'placeCard.category.levada',
  village: 'placeCard.category.village',
  beach: 'placeCard.category.beach',
  landmark: 'placeCard.category.landmark',
} as const;
const CATEGORY_KEYS = {
  viewpoint: 'passport.category.viewpoint',
  levada: 'passport.category.levada',
  village: 'passport.category.village',
  beach: 'passport.category.beach',
  landmark: 'passport.category.landmark',
} as const;

/** The small island beside the title: the shape, the roads in thread, a gold point per place. */
export const IslandMark = memo(function IslandMark({
  data,
  stamps,
  width = 84,
}: {
  data: PassportIslandData;
  stamps: readonly PassportStamp[];
  width?: number;
}) {
  const visited = useMemo(() => new Set(stamps.filter((stamp) => stamp.collected).map((stamp) => stamp.placeId)), [stamps]);
  const map = useMemo(() => islandMap(data.regions, data.places, visited, width), [data.regions, data.places, visited, width]);
  const roads = useMemo(() => islandRoads(data.regions, data.roads, width, 1.5), [data.regions, data.roads, width]);
  if (map === null) return null;
  return (
    <Svg width={map.width} height={map.height} viewBox={`0 0 ${map.width} ${map.height}`}>
      {map.regions.map((region) => (
        <Path key={region.id} d={region.d} fill={album.surface} stroke="#636366" strokeWidth={0.6} />
      ))}
      {roads === '' ? null : (
        <Path d={roads} fill="none" stroke={reward.gold} strokeWidth={0.7} strokeOpacity={0.7} strokeLinejoin="round" />
      )}
      {map.dots
        .filter((dot) => dot.visited)
        .map((dot) => (
          <Circle key={dot.id} cx={dot.x} cy={dot.y} r={1.3} fill={reward.gold} />
        ))}
    </Svg>
  );
});

type Selection = { kind: 'one'; id: string } | { kind: 'group'; ids: string[] } | null;

function PassportIsland({
  data,
  stamps,
  awards,
  width,
  onSelectStamp,
}: {
  data: PassportIslandData;
  stamps: readonly PassportStamp[];
  awards: readonly StampAward[];
  /** The page's content width. */
  width: number;
  onSelectStamp?: (stamp: PassportStamp) => void;
}) {
  const reduceMotion = useReduceMotion();
  const byPlace = useMemo(() => new Map(stamps.map((stamp) => [stamp.placeId, stamp])), [stamps]);
  const visited = useMemo(() => new Set(stamps.filter((stamp) => stamp.collected).map((stamp) => stamp.placeId)), [stamps]);
  const map = useMemo(() => islandMap(data.regions, data.places, visited, width), [data.regions, data.places, visited, width]);
  const roads = useMemo(() => islandRoads(data.regions, data.roads, width), [data.regions, data.roads, width]);
  const categoryOf = useMemo(() => new Map(data.places.map((place) => [place.id, place.category])), [data.places]);
  const regionOf = useMemo(() => new Map(data.places.map((place) => [place.id, place.regionName])), [data.places]);
  const stateOf = (id: string): DotState => dotState(byPlace.get(id));
  const awardedAt = useMemo(() => new Map(awards.map((award) => [award.place_id, award.awarded_ts])), [awards]);

  const [view, setView] = useState<IslandViewBox>(fullView(width));
  const [only, setOnly] = useState<Category | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [bubbleH, setBubbleH] = useState(72);
  const height = map?.height ?? 0;

  // The dots light in the order they were earned; the new ones last, with a burst.
  const shown = useMemo(() => new Set(map?.dots.map((dot) => dot.id) ?? []), [map]);
  const order = useMemo(() => lightingOrder(awards, shown, data.fresh), [awards, shown, data.fresh]);
  const [lit, setLit] = useState(reduceMotion ? Number.MAX_SAFE_INTEGER : 0);
  const [burst, setBurst] = useState(false);
  const [toast, setToast] = useState(false);
  const appear = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    data.onSeen?.();
    if (reduceMotion) {
      setLit(Number.MAX_SAFE_INTEGER);
      appear.setValue(1);
      return;
    }
    Animated.timing(appear, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      setLit(count);
      if (count >= order.length) {
        clearInterval(timer);
        if (data.fresh.length > 0) {
          setBurst(true);
          setToast(true);
        }
      }
    }, LIGHT_STEP_MS);
    return () => clearInterval(timer);
    // Once per opening: the island is mounted when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!burst) return;
    const off = setTimeout(() => setBurst(false), 1600);
    const hide = setTimeout(() => setToast(false), 3200);
    return () => {
      clearTimeout(off);
      clearTimeout(hide);
    };
  }, [burst]);
  const litSet = useMemo(() => new Set(order.slice(0, lit)), [order, lit]);
  const freshSet = useMemo(() => new Set(data.fresh), [data.fresh]);

  // Before the early return: hooks run in the same order every time.
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);

  if (map === null) return null;
  const k = unitsPerPixel(view, width);
  const zoomed = isZoomed(view, width);
  const tappable: IslandDot[] = map.dots.filter((dot) => only === null || categoryOf.get(dot.id) === only);

  // ── Touch ──────────────────────────────────────────────────────────────
  const onMapPress = (event: GestureResponderEvent) => {
    const { locationX: sx, locationY: sy } = event.nativeEvent;
    const now = Date.now();
    const previous = lastTap.current;
    lastTap.current = { at: now, x: sx, y: sy };
    if (previous !== null && now - previous.at < 300 && Math.hypot(previous.x - sx, previous.y - sy) < 30) {
      // A double tap: closer, or back to the whole island.
      lastTap.current = null;
      setSelection(null);
      const x = view.x + sx * k;
      const y = view.y + sy * k;
      setView(zoomed ? fullView(width) : zoomAround(x, y, TAP_ZOOM, width, height));
      return;
    }
    setSelection(hitTest(tappable, view, width, sx, sy));
  };
  const zoomToGroup = (ids: string[]) => {
    const ring = groupCircle(map.dots.filter((dot) => ids.includes(dot.id)));
    setSelection(null);
    setView(zoomAround(ring.x, ring.y, GROUP_ZOOM, width, height));
  };

  // ── The ring and the bubble ───────────────────────────────────────────
  const selectedDots = selection === null ? [] : map.dots.filter((dot) => (selection.kind === 'one' ? dot.id === selection.id : selection.ids.includes(dot.id)));
  const ring = selectedDots.length === 0 ? null : groupCircle(selectedDots);
  const [ringSx, ringSy] = ring === null ? [0, 0] : toScreen(view, width, ring.x, ring.y);
  const bubbleW = Math.min(BUBBLE_W, width);
  const place = ring === null ? null : bubblePlacement(ringSx, ringSy, bubbleW, bubbleH, width);
  const onLayoutBubble = (event: LayoutChangeEvent) => {
    const measured = Math.round(event.nativeEvent.layout.height);
    if (Math.abs(measured - bubbleH) > 1) setBubbleH(measured);
  };

  const counts = stateCounts(map.dots.map((dot) => stateOf(dot.id)));
  const chips = CATEGORIES.map((category) => {
    const ids = map.dots.filter((dot) => categoryOf.get(dot.id) === category).map((dot) => dot.id);
    return { category, total: ids.length, collected: ids.filter((id) => visited.has(id)).length };
  }).filter((chip) => chip.total > 0);
  const onlyChip = chips.find((chip) => chip.category === only);

  const dateOf = (id: string) => {
    const ts = awardedAt.get(id);
    return ts === undefined ? '' : new Date(ts).toLocaleDateString(DATE_LOCALES[deviceLanguage()], { day: 'numeric', month: 'short' });
  };

  return (
    <Animated.View style={{ opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
      <View style={[styles.mapBox, { width, height }]}>
        <Pressable onPress={onMapPress} accessible={false} style={styles.mapTouch}>
          <Svg width={width} height={height} viewBox={`${view.x} ${view.y} ${view.w} ${(view.w * height) / width}`}>
            {map.regions.map((region) => (
              <Path key={region.id} d={region.d} fill={region.lit ? LAND_LIT : LAND} stroke={COAST} strokeWidth={0.7 * k} />
            ))}
            {roads === '' ? null : (
              <G opacity={only === null ? 1 : 0.3}>
                <Path d={roads} fill="none" stroke={reward.gold} strokeWidth={4.5 * k} strokeOpacity={0.16} strokeLinejoin="round" strokeLinecap="round" />
                <Path d={roads} fill="none" stroke={reward.gold} strokeWidth={1.3 * k} strokeOpacity={0.8} strokeLinejoin="round" strokeLinecap="round" />
              </G>
            )}
            {/* Grey first, gold last, so a visited place is never under one not visited. */}
            {[...map.dots]
              .sort((a, b) => RANK[stateOf(a.id)] - RANK[stateOf(b.id)])
              .map((dot) => {
                const state = stateOf(dot.id);
                const dim = only !== null && categoryOf.get(dot.id) !== only;
                const hidden = state !== 'new' && !litSet.has(dot.id);
                if (hidden) return null;
                return (
                  <G key={dot.id} opacity={dim ? 0.12 : 1}>
                    {burst && freshSet.has(dot.id) ? <Burst x={dot.x} y={dot.y} k={k} /> : null}
                    {state === 'open' ? (
                      <>
                        <Circle cx={dot.x} cy={dot.y} r={8 * k} fill={reward.gold} opacity={0.25} />
                        <Circle cx={dot.x} cy={dot.y} r={4.2 * k} fill={reward.gold} />
                      </>
                    ) : state === 'waiting' ? (
                      <Circle cx={dot.x} cy={dot.y} r={3.6 * k} fill={album.background} stroke={reward.gold} strokeWidth={1.8 * k} />
                    ) : (
                      <Circle cx={dot.x} cy={dot.y} r={2.6 * k} fill={GREY} />
                    )}
                  </G>
                );
              })}
            {ring === null ? null : (
              <Circle cx={ring.x} cy={ring.y} r={ring.r + 9 * k} fill="none" stroke="#FFFFFF" strokeWidth={2 * k} />
            )}
          </Svg>
        </Pressable>

        {zoomed ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSelection(null);
              setView(fullView(width));
            }}
            style={styles.pill}
            hitSlop={PILL_SLOP}
          >
            <Text style={styles.pillText}>{t('passport.island.wholeIsland')}</Text>
          </Pressable>
        ) : null}
        {toast ? (
          <View style={styles.toast} pointerEvents="none">
            <View style={styles.toastDot} />
            <Text style={styles.toastText}>{n('passport.island.fresh', data.fresh.length)}</Text>
          </View>
        ) : null}

        {selection !== null && place !== null && onScreen(ringSx, ringSy, width, height) ? (
          // A drawn triangle: a border triangle did not render on the P30.
          <View
            pointerEvents="none"
            style={[styles.tip, { left: place.left + place.tip - 9, top: place.below ? place.top - 8 : place.top + bubbleH - 1.5 }]}
          >
            <Svg width={18} height={9} viewBox="0 0 18 9">
              <Path
                d={place.below ? 'M0 9L9 0L18 9Z' : 'M0 0L9 9L18 0Z'}
                fill={BUBBLE}
                stroke={BUBBLE_EDGE}
                strokeWidth={1}
              />
              <Path d={place.below ? 'M1 9.5H17' : 'M1 -0.5H17'} stroke={BUBBLE} strokeWidth={2} />
            </Svg>
          </View>
        ) : null}
        {selection !== null && place !== null && onScreen(ringSx, ringSy, width, height) ? (
          <View
            onLayout={onLayoutBubble}
            style={[styles.bubble, { left: place.left, top: place.top, width: bubbleW }]}
          >
            {selection.kind === 'one' ? (
              <OnePlace
                stamp={byPlace.get(selection.id)}
                state={stateOf(selection.id)}
                where={[t(ONE_CATEGORY_KEYS[categoryOf.get(selection.id) ?? 'landmark']), regionOf.get(selection.id)].filter(Boolean).join(' · ')}
                date={dateOf(selection.id)}
                onPress={() => {
                  const stamp = byPlace.get(selection.id);
                  if (stamp !== undefined) onSelectStamp?.(stamp);
                }}
              />
            ) : (
              <View>
                <View style={styles.listHead}>
                  <Text style={styles.listHeadText}>{n('passport.island.group', selection.ids.length)}</Text>
                  <Pressable accessibilityRole="button" onPress={() => zoomToGroup(selection.ids)} hitSlop={LINK_SLOP}>
                    <Text style={styles.zoomIn}>{t('passport.island.zoomIn')}</Text>
                  </Pressable>
                </View>
                {selection.ids.map((id) => {
                  const state = stateOf(id);
                  return (
                    <Pressable
                      key={id}
                      accessibilityRole="button"
                      onPress={() => setSelection({ kind: 'one', id })}
                      style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
                    >
                      <MiniStamp stamp={byPlace.get(id)} size={30} />
                      <Text style={styles.listName} numberOfLines={1}>
                        {byPlace.get(id)?.name ?? id}
                      </Text>
                      <Text style={[styles.tag, state === 'new' ? styles.tagGrey : styles.tagGold]}>
                        {state === 'open' ? dateOf(id) : state === 'waiting' ? t('passport.island.tag.waiting') : t('passport.island.tag.new')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </View>

      {onlyChip === undefined ? (
        <View style={styles.legend}>
          {counts.open > 0 ? <LegendItem kind="open" label={n('passport.island.legend.open', counts.open)} /> : null}
          {counts.waiting > 0 ? <LegendItem kind="waiting" label={n('passport.island.legend.waiting', counts.waiting)} /> : null}
          <LegendItem kind="new" label={n('passport.island.legend.new', counts.new)} />
        </View>
      ) : (
        <View style={styles.legend}>
          <Text style={styles.legendText}>
            {t('passport.island.filter', { category: t(CATEGORY_KEYS[onlyChip.category]), collected: onlyChip.collected, total: onlyChip.total })}
            {'  '}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setOnly(null)} hitSlop={LINK_SLOP}>
            <Text style={styles.showAll}>{t('passport.island.showAll')}</Text>
          </Pressable>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipStrip} contentContainerStyle={styles.chips}>
        {chips.map((chip) => {
          const on = chip.category === only;
          return (
            <Pressable
              key={chip.category}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setSelection(null);
                setOnly(on ? null : chip.category);
              }}
              hitSlop={CHIP_SLOP}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={styles.chipText}>
                {t(CATEGORY_KEYS[chip.category])} <Text style={on ? styles.chipCountOn : styles.chipCount}>{chip.collected}/{chip.total}</Text>
              </Text>
              <View style={[styles.chipBar, { width: `${(chip.collected / chip.total) * 100}%` }]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const RANK: Record<DotState, number> = { new: 0, waiting: 1, open: 2 };

/** Eight short gold rays round a place earned since the island was last opened. */
function Burst({ x, y, k }: { x: number; y: number; k: number }) {
  return (
    <G>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <Line
            key={deg}
            x1={x + Math.cos(a) * 8 * k}
            y1={y + Math.sin(a) * 8 * k}
            x2={x + Math.cos(a) * 12 * k}
            y2={y + Math.sin(a) * 12 * k}
            stroke={reward.gold}
            strokeWidth={1.6 * k}
            strokeLinecap="round"
          />
        );
      })}
    </G>
  );
}

function LegendItem({ kind, label }: { kind: DotState; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={kind === 'open' ? styles.lgOpen : kind === 'waiting' ? styles.lgWaiting : styles.lgNew} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

/** A stamp as the rows draw it, small: in colour, frosted with a padlock, or muted. */
function MiniStamp({ stamp, size }: { stamp: PassportStamp | undefined; size: number }) {
  if (stamp === undefined) return <View style={{ width: size, height: size }} />;
  const locked = stamp.locked === true;
  return (
    <View style={{ width: size, height: size }}>
      <StampArt
        placeId={stamp.placeId}
        design={designFor(stamp.placeId, stamp.category)}
        name={stamp.name}
        collected={locked ? true : stamp.collected}
        blur={locked ? 1.6 : undefined}
        postmark={null}
        size={size}
      />
      {locked ? (
        <View style={styles.lockOver} pointerEvents="none">
          <Padlock size={Math.round(size * 0.42)} />
        </View>
      ) : null}
    </View>
  );
}

/** One place in the bubble: its stamp, category, name, state, and the round button. */
function OnePlace({
  stamp,
  state,
  where,
  date,
  onPress,
}: {
  stamp: PassportStamp | undefined;
  state: DotState;
  where: string;
  date: string;
  onPress: () => void;
}) {
  const line =
    state === 'open'
      ? t('passport.island.bubble.open', { date })
      : state === 'waiting'
        ? t('passport.island.bubble.waiting', { date })
        : t('passport.island.bubble.new');
  const action = state === 'open' ? t('passport.island.a11y.see') : state === 'waiting' ? t('passport.island.a11y.unlock') : t('passport.island.a11y.place');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${stamp?.name ?? ''}, ${line}. ${action}`}
      onPress={onPress}
      style={({ pressed }) => [styles.one, pressed && styles.pressed]}
    >
      <MiniStamp stamp={stamp} size={46} />
      <View style={styles.oneText}>
        <Text style={styles.where} numberOfLines={1}>
          {where}
        </Text>
        <Text style={styles.name} numberOfLines={2}>
          {stamp?.name ?? ''}
        </Text>
        <Text style={[styles.line, state === 'new' ? null : styles.lineGold]} numberOfLines={1}>
          {line}
        </Text>
      </View>
      <View style={[styles.action, state === 'waiting' ? styles.actionGold : null]}>
        {state === 'waiting' ? <Padlock size={18} /> : <Text style={styles.chevron}>›</Text>}
      </View>
    </Pressable>
  );
}

export default memo(PassportIsland);

const styles = StyleSheet.create({
  mapBox: { marginTop: spacing.md + 2, position: 'relative' },
  // The map is far taller than the target; said so for D-015's check.
  mapTouch: { minHeight: MIN_TAP_TARGET },
  pill: {
    position: 'absolute',
    right: 0,
    top: -4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: BUBBLE,
    borderWidth: 1,
    borderColor: BUBBLE_EDGE,
  },
  pillText: { color: album.tint, fontSize: fontSize.small, fontWeight: '600' },
  toast: {
    position: 'absolute',
    left: 0,
    top: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 5,
    paddingLeft: 9,
    paddingRight: 11,
    borderRadius: 14,
    backgroundColor: BUBBLE,
    borderWidth: 1,
    borderColor: BUBBLE_EDGE,
  },
  toastDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: reward.gold },
  toastText: { color: album.text, fontSize: fontSize.small },
  bubble: {
    position: 'absolute',
    zIndex: 3,
    backgroundColor: BUBBLE,
    borderColor: BUBBLE_EDGE,
    borderWidth: 1,
    borderRadius: 16,
    elevation: 8,
  },
  tip: { position: 'absolute', zIndex: 4, elevation: 9, width: 18, height: 9 },
  one: { minHeight: MIN_TAP_TARGET, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingLeft: 9, paddingRight: 10, borderRadius: 16 },
  oneText: { flex: 1, minWidth: 0 },
  where: { color: album.textMuted, fontSize: fontSize.small },
  name: { color: album.text, fontSize: fontSize.label, fontWeight: '700', marginTop: 1 },
  line: { color: album.textMuted, fontSize: fontSize.small, marginTop: 1 },
  lineGold: { color: reward.goldInk },
  action: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5AA9FF26' },
  actionGold: { backgroundColor: reward.goldButton },
  chevron: { color: album.tint, fontSize: fontSize.title, fontWeight: '600', marginTop: -2 },
  pressed: { opacity: 0.7 },
  lockOver: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  listHeadText: { color: album.textMuted, fontSize: fontSize.small },
  zoomIn: { color: album.tint, fontSize: fontSize.small, fontWeight: '600' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TAP_TARGET, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BUBBLE_EDGE },
  listName: { flex: 1, color: album.text, fontSize: fontSize.small },
  tag: { fontSize: fontSize.small },
  tagGold: { color: reward.goldInk },
  tagGrey: { color: album.textMuted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { color: album.textMuted, fontSize: fontSize.small },
  showAll: { color: album.tint, fontSize: fontSize.small },
  lgOpen: { width: 9, height: 9, borderRadius: 5, backgroundColor: reward.gold },
  lgWaiting: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.8, borderColor: reward.gold },
  lgNew: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREY },
  chipStrip: { marginTop: 12, marginRight: -spacing.md },
  chips: { gap: 6, paddingRight: spacing.md },
  chip: { borderWidth: 1, borderColor: album.hairline, borderRadius: 16, paddingHorizontal: 11, paddingTop: 5, paddingBottom: 7, overflow: 'hidden' },
  chipOn: { backgroundColor: '#3A3A3C', borderColor: album.text },
  chipText: { color: album.text, fontSize: fontSize.small },
  chipCount: { color: album.textMuted, fontWeight: '600' },
  chipCountOn: { color: album.text, fontWeight: '600' },
  chipBar: { position: 'absolute', left: 0, bottom: 0, height: 2, backgroundColor: album.text },
});

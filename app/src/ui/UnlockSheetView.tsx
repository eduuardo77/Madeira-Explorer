/**
 * How the unlock sheet looks (T-319, the project lead, 23 Nov 2026): one
 * screen, swiped. Chosen from `tools/out/paywall-carousel.html` over the card
 * with a list it replaces (D-097's sheet A), which "had too much information
 * and was less visual".
 *
 * The bottom never moves: the dots, any notice, the launch price, the gold
 * button and *Not now*. Above it, pages of one picture and one line each,
 * from `unlockSheetModel`'s `pages`:
 *
 * - **stamps**: the stamp the user tapped, half frosted and half in colour
 *   (`focus`); or their waiting stamps frosted round one in colour (`reveal`);
 *   or, with nothing waiting, a few places in colour (`showcase`).
 * - **island**: the main island, lit where they have been (`IslandMap`).
 * - **sets**: the category medals with their progress.
 * - **founder**: the founder medal, only while its window is open.
 *
 * Props in, pixels out: no store, no database, so the workbench draws it in
 * every state (`App.web.tsx`). `UnlockSheet` holds the state and the data.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { UnlockPage, UnlockSheetModel } from '../entitlement/unlockSheet';
import type { FounderWords, SetMedalWords } from '../passport/medalArt';
import type { IslandMap as IslandMapData } from '../passport/islandMapArt';
import { designFor } from '../passport/stampArt';
import IslandMap from './IslandMap';
import MedalArt from './MedalArt';
import type { PassportStamp } from './PassportView';
import Padlock from './Padlock';
import StampArt from './StampArt';
import { fontSize, MIN_TAP_TARGET, radius, reward, spacing } from './theme';

/** A set medal's row on the sets page. */
export type UnlockMedal = { id: string; name: string; collected: number; total: number; words: SetMedalWords };

/** How many waiting stamps circle the one in colour. */
const ORBIT = 6;
const CLOSE_BOX = 40;

export default function UnlockSheetView({
  model,
  waiting,
  showcase = [],
  island = null,
  medals = [],
  founder = null,
  unlocked,
  onBuy,
  onClose,
}: {
  model: UnlockSheetModel;
  /** The locked stamps, the tapped one first; drawn frosted until paid for. */
  waiting: PassportStamp[];
  /** With nothing waiting: places in colour, none of them the user's yet. */
  showcase?: PassportStamp[];
  /** The island page's drawing, built to the page's width by the caller. */
  island?: IslandMapData | null;
  medals?: UnlockMedal[];
  founder?: FounderWords | null;
  /** Paid: every stamp is drawn sharp. */
  unlocked: boolean;
  onBuy: () => void;
  onClose: () => void;
}) {
  const breath = useLoop(2200);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [index, setIndex] = useState(0);
  const pages = model.pages.filter((page) => page.kind !== 'island' || island !== null);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
    setHeight(event.nativeEvent.layout.height);
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };
  // The picture fills what the page leaves after its words, and no more.
  const art = Math.max(120, Math.min(width * 0.62, height - 190));

  return (
    <View style={styles.screen} accessibilityViewIsModal>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="unlock-stage" cx="50" cy="28" rx="70" ry="60" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#3A2F55" />
            <Stop offset="0.45" stopColor={reward.panelTop} />
            <Stop offset="1" stopColor={reward.panelBottom} />
          </RadialGradient>
        </Defs>
        <Rect width="100" height="100" fill="url(#unlock-stage)" />
      </Svg>

      <Text style={styles.eyebrow}>{model.eyebrow}</Text>
      {/* A second way out besides "Not now" (the lead, 23 Nov). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={model.closeIcon}
        onPress={onClose}
        hitSlop={(MIN_TAP_TARGET - CLOSE_BOX) / 2}
        style={({ pressed }) => [styles.closeIcon, pressed && styles.pressed]}
      >
        <Svg width={16} height={16} viewBox="0 0 16 16">
          <Path d="M2 2 L14 14 M14 2 L2 14" stroke={reward.textMuted} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      </Pressable>

      <View style={styles.pager} onLayout={onLayout}>
        {width === 0 ? null : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={32}
          >
            {pages.map((page) => (
              <View
                key={page.kind}
                style={[styles.page, { width, height }]}
                accessible
                accessibilityLabel={pageWords(page).join('. ')}
              >
                <PageArt
                  page={page}
                  size={art}
                  width={width}
                  waiting={waiting}
                  showcase={showcase}
                  island={island}
                  medals={medals}
                  founder={founder}
                  unlocked={unlocked}
                />
                <PageWords page={page} />
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.bottom}>
        {pages.length < 2 ? null : (
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {pages.map((page, i) => (
              <View key={page.kind} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
          </View>
        )}
        {model.notice === null ? null : (
          <Text style={styles.notice} accessibilityLiveRegion="polite">
            {model.notice}
          </Text>
        )}
        {model.launchPrice === null ? null : (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{model.launchPrice}</Text>
          </View>
        )}
        {model.buy === null ? null : (
          <Animated.View
            style={[
              styles.buyWrap,
              model.buy.enabled
                ? { transform: [{ scale: breath.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.03, 1] }) }] }
                : null,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !model.buy.enabled }}
              disabled={!model.buy.enabled}
              onPress={onBuy}
              style={({ pressed }) => [styles.buy, !model.buy?.enabled && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.buyText}>{model.buy.label}</Text>
            </Pressable>
          </Animated.View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.plain, pressed && styles.pressed]}
        >
          <Text style={styles.dismiss}>{model.close}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Every line a page shows, in reading order: for the screen reader. */
function pageWords(page: UnlockPage): string[] {
  switch (page.kind) {
    case 'stamps':
      return [page.line, page.sub, page.once];
    case 'island':
      return [page.count, page.line, page.sub];
    case 'sets':
      return [page.line];
    case 'founder':
      return [page.line, page.sub];
  }
}

function PageWords({ page }: { page: UnlockPage }) {
  return (
    <View style={styles.words} importantForAccessibility="no-hide-descendants">
      {page.kind === 'island' ? <Text style={styles.count}>{page.count}</Text> : null}
      <Text style={styles.line}>{page.line}</Text>
      {page.kind === 'sets' ? null : <Text style={styles.sub}>{page.sub}</Text>}
      {page.kind === 'stamps' ? <Text style={styles.once}>{page.once}</Text> : null}
    </View>
  );
}

function PageArt({
  page,
  size,
  width,
  waiting,
  showcase,
  island,
  medals,
  founder,
  unlocked,
}: {
  page: UnlockPage;
  size: number;
  width: number;
  waiting: PassportStamp[];
  showcase: PassportStamp[];
  island: IslandMapData | null;
  medals: UnlockMedal[];
  founder: FounderWords | null;
  unlocked: boolean;
}) {
  switch (page.kind) {
    case 'stamps':
      if (page.art === 'focus' && waiting.length > 0) return <SplitStamp stamp={waiting[0]} size={size * 0.9} unlocked={unlocked} />;
      if (page.art === 'reveal' && waiting.length > 0) return <Reveal stamps={waiting} size={size} unlocked={unlocked} />;
      return <Fan stamps={showcase} size={Math.min(size * 0.42, width / 4)} />;
    case 'island':
      return island === null ? null : <IslandMap map={island} />;
    case 'sets':
      return <MedalList medals={medals} width={width - 2 * spacing.lg} />;
    case 'founder':
      return founder === null ? null : (
        <View style={styles.glow}>
          <MedalArt id="unlock-founder" drawing={{ kind: 'founder', words: founder }} size={size * 0.85} />
        </View>
      );
  }
}

function stampArt(stamp: PassportStamp, size: number, blur?: number, key?: string) {
  return (
    <StampArt
      key={key}
      placeId={`unlock-${key ?? ''}-${stamp.placeId}`}
      design={designFor(stamp.placeId, stamp.category)}
      name={stamp.name}
      collected
      postmark={null}
      size={size}
      blur={blur}
    />
  );
}

/** The tapped stamp, frosted on the left with the padlock on the seam, in colour on the right. */
function SplitStamp({ stamp, size, unlocked }: { stamp: PassportStamp; size: number; unlocked: boolean }) {
  const half = size / 2;
  if (unlocked) return <View style={styles.glow}>{stampArt(stamp, size, undefined, 'whole')}</View>;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.half, { width: half, height: size }]}>{stampArt(stamp, size, 3.4, 'frost')}</View>
      <View style={[styles.half, styles.glow, { left: half, width: half, height: size }]}>
        <View style={{ marginLeft: -half }}>{stampArt(stamp, size, undefined, 'clear')}</View>
      </View>
      <View style={[styles.seam, { left: half - 1, height: size }]} />
      <View style={[styles.knob, { left: half - 26, top: half - 26 }]}>
        <Padlock />
      </View>
    </View>
  );
}

/** One of the user's stamps in colour, the others frosted round it. */
function Reveal({ stamps, size, unlocked }: { stamps: PassportStamp[]; size: number; unlocked: boolean }) {
  const hero = size * 0.62;
  const small = size * 0.27;
  const box = size * 1.2;
  const others = stamps.slice(1, 1 + ORBIT);
  return (
    <View style={{ width: box, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {others.map((stamp, i) => {
        // Round an ellipse, from the top left, clockwise.
        const angle = -Math.PI * 0.8 + (i * 2 * Math.PI) / Math.max(others.length, 1);
        const x = box / 2 + Math.cos(angle) * (box / 2 - small / 2) - small / 2;
        const y = size / 2 + Math.sin(angle) * (size / 2 - small / 2) - small / 2;
        return (
          <View key={stamp.placeId} style={[styles.orbit, { left: x, top: y, transform: [{ rotate: `${((i % 3) - 1) * 10}deg` }] }]}>
            {/* Frosted harder than the hero's size would need: at a quarter of
                its size, 3.4 left them nearly sharp on the P30. */}
            {stampArt(stamp, small, unlocked ? undefined : 7, 'orbit')}
          </View>
        );
      })}
      <View style={[styles.orbit, styles.glow, { left: (box - hero) / 2, top: (size - hero) / 2, transform: [{ rotate: '-3deg' }] }]}>
        {stampArt(stamps[0], hero, undefined, 'hero')}
      </View>
    </View>
  );
}

/** With nothing waiting: a few places in colour, fanned. */
function Fan({ stamps, size }: { stamps: PassportStamp[]; size: number }) {
  return (
    <View style={styles.fan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {stamps.map((stamp, i) => (
        <View
          key={stamp.placeId}
          style={{
            marginHorizontal: -size * 0.08,
            transform: [{ rotate: `${(i - (stamps.length - 1) / 2) * 9}deg` }, { translateY: Math.abs(i - (stamps.length - 1) / 2) * 6 }],
          }}
        >
          {stampArt(stamp, size, undefined, 'fan')}
        </View>
      ))}
    </View>
  );
}

function MedalList({ medals, width }: { medals: UnlockMedal[]; width: number }) {
  return (
    <View style={[styles.medals, { width }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {medals.map((medal) => (
        <View key={medal.id} style={styles.medal}>
          <MedalArt id={`unlock-${medal.id}`} drawing={{ kind: 'set', words: medal.words }} size={48} />
          <View style={styles.medalText}>
            <View style={styles.medalHead}>
              <Text style={styles.medalName}>{medal.name}</Text>
              <Text style={styles.medalCount}>
                {medal.collected}/{medal.total}
              </Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${medal.total === 0 ? 0 : Math.round((medal.collected / medal.total) * 100)}%` }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** A value running 0 → 1 over and over, for a looping animation. */
function useLoop(durationMs: number): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [value, durationMs]);
  return value;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    // The modal draws under the status bar (statusBarTranslucent).
    paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.sm,
  },
  closeIcon: {
    position: 'absolute',
    top: spacing.xl + spacing.sm,
    right: spacing.sm,
    width: CLOSE_BOX,
    height: CLOSE_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  eyebrow: {
    color: reward.goldInk,
    fontSize: fontSize.label,
    fontWeight: '700',
    letterSpacing: 1.6,
    lineHeight: CLOSE_BOX - 16,
  },
  pager: {
    flex: 1,
    alignSelf: 'stretch',
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  words: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  count: {
    color: reward.goldInk,
    fontSize: fontSize.label,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  line: {
    color: reward.text,
    fontSize: fontSize.title + 4,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    color: reward.textMuted,
    fontSize: fontSize.body,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  once: {
    color: reward.textMuted,
    fontSize: fontSize.small,
    textAlign: 'center',
    marginTop: spacing.sm,
    opacity: 0.8,
  },
  glow: {
    shadowColor: reward.gold,
    shadowOpacity: 0.6,
    shadowRadius: 18,
  },
  half: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  seam: {
    position: 'absolute',
    top: 0,
    width: 2,
    backgroundColor: reward.gold,
  },
  knob: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: reward.gold,
    backgroundColor: reward.panelBottom,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbit: {
    position: 'absolute',
  },
  fan: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medals: {
    gap: spacing.sm,
  },
  medal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  medalText: {
    flex: 1,
  },
  medalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  medalName: {
    color: reward.text,
    fontSize: fontSize.label,
    fontWeight: '700',
  },
  medalCount: {
    color: reward.textMuted,
    fontSize: fontSize.small,
  },
  bar: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF18',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: reward.gold,
  },
  bottom: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF33',
  },
  dotOn: {
    width: 20,
    backgroundColor: reward.goldInk,
  },
  notice: {
    color: reward.text,
    fontSize: fontSize.label,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pill: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFD45C40',
    backgroundColor: '#FFD45C14',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  pillText: {
    color: reward.goldInk,
    fontSize: fontSize.small,
    fontWeight: '600',
    textAlign: 'center',
  },
  buyWrap: {
    marginTop: spacing.md,
  },
  buy: {
    minHeight: MIN_TAP_TARGET,
    borderRadius: radius.control,
    backgroundColor: reward.goldButton,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buyText: {
    color: reward.goldButtonText,
    fontSize: fontSize.body,
    fontWeight: '800',
    textAlign: 'center',
  },
  plain: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismiss: {
    color: reward.textMuted,
    fontSize: fontSize.label,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
});

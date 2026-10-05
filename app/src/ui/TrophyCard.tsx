/**
 * A collected stamp, shown as a trophy (T-251, T1 layout A, picked 2026-10-05
 * from `tools/preview-trophy-options.mjs`).
 *
 * Opened by tapping a stamp in the passport that is collected and not locked;
 * a locked or uncollected one still opens the place card. A spotlight comes
 * on, the stamp rises onto a lit pedestal and floats there, and under it is
 * what the stamp means (`places/trophy.ts`): the medal of its municipality,
 * with that set's stamps lighting in turn, and the nearest stamp not yet
 * collected. *Partilhar* sends a picture of the trophy through the phone's
 * own share sheet, as the passport's share does.
 *
 * With the phone's "remove animations" on, it all appears at once, still.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Alert, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { t } from '../i18n';
import type { Category } from '../content/contentPack';
import { designFor } from '../passport/stampArt';
import { REFUSAL_KEYS, shareCardImage } from '../souvenir/shareTrip';
import StampArt from './StampArt';
import { postmarkFor } from './postmark';
import { fontSize, MIN_TAP_TARGET, radius, reward, spacing } from './theme';
import { useReduceMotion } from './useReduceMotion';

const STAMP_SIZE = 176;
const MINI = 46;
/**
 * A set larger than a row (Santana has 12) wraps, with smaller stamps, rather
 * than running off the card's sides as the first version did on the emulator.
 */
const MINI_ROW = 6;
const MINI_SMALL = 36;

export interface TrophyStamp {
  placeId: string;
  name: string;
  category: Category;
}

export default function TrophyCard({
  stamp,
  awardedTs,
  subtitle,
  ribbon,
  medal,
  next,
  onShowOnMap,
  onShowNext,
  onClose,
}: {
  stamp: TrophyStamp;
  /** When it was earned, for its postmark. */
  awardedTs: number | null;
  /** "Aldeia · 4 de outubro de 2026" */
  subtitle: string;
  /** "2.º CARIMBO DA VIAGEM", or null when the order is unknown. */
  ribbon: string | null;
  /** The municipality's medal set, or null when it has none (OQ-3). */
  medal: {
    title: string;
    progress: string;
    stamps: Array<TrophyStamp & { collected: boolean }>;
  } | null;
  /** The nearest stamp not collected yet, or null with everything collected. */
  next: TrophyStamp & { distance: string; countsForMedal: boolean } | null;
  onShowOnMap: () => void;
  onShowNext: () => void;
  onClose: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const anim = useEntrance(reduceMotion, medal?.stamps.length ?? 0);
  const shareRef = useRef<View>(null);

  const share = () => {
    void (async () => {
      const shared = await shareCardImage(shareRef);
      if (!shared.ok && shared.refusal !== 'unavailable') {
        Alert.alert(t('passport.share.failedTitle'), t(REFUSAL_KEYS[shared.refusal]));
      }
    })();
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen} accessibilityViewIsModal>
        <View style={styles.middle}>
          {/* What Partilhar photographs: the stamp, its name and its medal. */}
          <View ref={shareRef} collapsable={false} style={styles.shareable}>
            <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="trophy-ground" cx="50%" cy="26%" r="75%">
                  <Stop offset="0" stopColor={reward.trophyWarm} />
                  <Stop offset="0.55" stopColor={reward.panelBottom} />
                  <Stop offset="1" stopColor={reward.stage} />
                </RadialGradient>
              </Defs>
              <Rect width="100" height="100" fill="url(#trophy-ground)" />
            </Svg>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim.spot }]} pointerEvents="none">
              {/* ⚠ Its gradient is defined here, in the same drawing: a fill that
                  names a gradient in another Svg is black on Android (seen on the
                  emulator, 2026-10-05). */}
              <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
                <Defs>
                  <LinearGradient id="trophy-beam" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={reward.flash} stopOpacity={0.22} />
                    <Stop offset="1" stopColor={reward.flash} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Polygon points="40,0 60,0 92,55 8,55" fill="url(#trophy-beam)" />
              </Svg>
            </Animated.View>

            <View style={styles.top}>
              {ribbon === null ? <View /> : (
                <Animated.Text style={[styles.ribbon, { opacity: anim.text }]}>{ribbon}</Animated.Text>
              )}
            </View>

            <Animated.View
              style={[
                styles.stamp,
                { opacity: anim.rise, transform: [{ translateY: anim.riseY }, { scale: anim.riseScale }, { translateY: anim.float }] },
              ]}
            >
              <StampArt
                placeId={`trophy-${stamp.placeId}`}
                design={designFor(stamp.placeId, stamp.category)}
                name={stamp.name}
                collected
                postmark={postmarkFor(awardedTs)}
                size={STAMP_SIZE}
              />
            </Animated.View>
            <Animated.View style={{ opacity: anim.rise }}>
              <Svg width={190} height={22} viewBox="0 0 190 22">
                <Defs>
                  <RadialGradient id="pedestal" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={reward.gold} stopOpacity={0.45} />
                    <Stop offset="1" stopColor={reward.gold} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx={95} cy={11} rx={95} ry={11} fill="url(#pedestal)" />
              </Svg>
            </Animated.View>

            <Animated.Text style={[styles.name, { opacity: anim.text }]} accessibilityRole="header">
              {stamp.name}
            </Animated.Text>
            <Animated.Text style={[styles.subtitle, { opacity: anim.text }]}>{subtitle}</Animated.Text>

            {medal === null ? null : (
              <Animated.View style={[styles.medalCard, { opacity: anim.medal, transform: [{ scale: anim.medalScale }] }]}>
                <View style={styles.medalHead}>
                  <View style={styles.sealMini} />
                  <View style={styles.medalText}>
                    <Text style={styles.medalTitle}>{medal.title}</Text>
                    <Text style={styles.medalProgress}>{medal.progress}</Text>
                  </View>
                </View>
                <View style={styles.setRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {medal.stamps.map((each, i) => (
                    <Animated.View
                      key={each.placeId}
                      style={[
                        styles.mini,
                        each.collected
                          ? { opacity: anim.lit[i], transform: [{ scale: anim.litScale[i] }] }
                          : styles.miniDim,
                      ]}
                    >
                      <StampArt
                        placeId={`trophy-set-${each.placeId}`}
                        design={designFor(each.placeId, each.category)}
                        name={each.name}
                        collected={each.collected}
                        postmark={null}
                        size={medal.stamps.length > MINI_ROW ? MINI_SMALL : MINI}
                      />
                    </Animated.View>
                  ))}
                </View>
              </Animated.View>
            )}
          </View>

          {next === null ? null : (
            <Animated.View style={{ alignSelf: 'stretch', opacity: anim.next }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('trophy.a11y.next', { name: next.name, distance: next.distance })}
                onPress={onShowNext}
                style={({ pressed }) => [styles.nextCard, pressed && styles.pressed]}
              >
                <View style={styles.nextStamp}>
                  <StampArt
                    placeId={`trophy-next-${next.placeId}`}
                    design={designFor(next.placeId, next.category)}
                    name={next.name}
                    collected={false}
                    postmark={null}
                    size={40}
                  />
                </View>
                <View style={styles.nextText}>
                  <Text style={styles.nextLabel}>{t('trophy.next.label')}</Text>
                  <Text style={styles.nextName}>{next.name}</Text>
                  <Text style={styles.nextDetail}>
                    {t('trophy.next.distance', { distance: next.distance })}
                    {next.countsForMedal ? ` · ${t('trophy.next.medal')}` : ''}
                  </Text>
                </View>
                <Text style={styles.nextGo}>›</Text>
              </Pressable>
            </Animated.View>
          )}

        </View>

        <Animated.View style={[styles.buttons, { opacity: anim.buttons }]}>
          <Pressable
            accessibilityRole="button"
            onPress={onShowOnMap}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{t('placeCard.showOnMap')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={share}
            style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
          >
            <Text style={styles.ghostText}>{t('passport.share')}</Text>
          </Pressable>
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Text style={styles.closeText}>{t('common.close')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/** The entrance: the light, the rise, then the words and the set in turn. */
function useEntrance(reduceMotion: boolean, setSize: number) {
  const v = useRef({
    spot: new Animated.Value(0),
    rise: new Animated.Value(0),
    float: new Animated.Value(0),
    text: new Animated.Value(0),
    medal: new Animated.Value(0),
    next: new Animated.Value(0),
    buttons: new Animated.Value(0),
    lit: Array.from({ length: Math.max(setSize, 1) }, () => new Animated.Value(0)),
  }).current;

  useEffect(() => {
    const ends = [v.spot, v.rise, v.text, v.medal, v.next, v.buttons, ...v.lit];
    if (reduceMotion) {
      for (const value of ends) value.setValue(1);
      return;
    }
    const at = (ms: number, value: Animated.Value, duration: number, easing = Easing.out(Easing.cubic)) =>
      Animated.sequence([
        Animated.delay(ms),
        Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true }),
      ]);
    // The spotlight catches, flickers once and holds, as a stage light does.
    const spot = Animated.sequence([
      Animated.timing(v.spot, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(v.spot, { toValue: 0.4, duration: 90, useNativeDriver: true }),
      Animated.timing(v.spot, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]);
    const entrance = Animated.parallel([
      spot,
      at(450, v.rise, 900, Easing.out(Easing.back(1.4))),
      at(1000, v.text, 400),
      at(1250, v.medal, 450, Easing.out(Easing.back(1.6))),
      ...v.lit.map((value, i) => at(1600 + i * 150, value, 500, Easing.out(Easing.back(2)))),
      at(1500, v.next, 450),
      at(1750, v.buttons, 400),
    ]);
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(v.float, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v.float, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    entrance.start(() => float.start());
    return () => {
      entrance.stop();
      float.stop();
    };
  }, [reduceMotion, v]);

  return useMemo(
    () => ({
      spot: v.spot,
      rise: v.rise,
      riseY: v.rise.interpolate({ inputRange: [0, 1], outputRange: [70, 0] }),
      riseScale: v.rise.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
      float: v.float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }),
      text: v.text,
      medal: v.medal,
      medalScale: v.medal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
      lit: v.lit,
      litScale: v.lit.map((value) => value.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.8, 1.12, 1] })),
      next: v.next,
      buttons: v.buttons,
    }),
    [v]
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: reward.stage,
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  middle: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  shareable: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderRadius: radius.sheet,
    overflow: 'hidden',
  },
  top: {
    alignSelf: 'stretch',
    alignItems: 'center',
    minHeight: 28,
    marginTop: spacing.md,
  },
  ribbon: {
    color: reward.goldInk,
    fontSize: fontSize.label,
    fontWeight: '800',
    letterSpacing: 2,
  },
  stamp: {
    width: STAMP_SIZE,
    height: STAMP_SIZE,
    marginTop: spacing.sm,
  },
  name: {
    color: reward.text,
    fontSize: fontSize.title + 4,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: reward.textMuted,
    fontSize: fontSize.label,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  medalCard: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    marginHorizontal: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: reward.nudgeEdge,
    backgroundColor: reward.cardFill,
  },
  medalHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sealMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: reward.gold,
  },
  medalText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  medalTitle: {
    color: reward.text,
    fontSize: fontSize.label,
    fontWeight: '800',
  },
  medalProgress: {
    color: reward.textMuted,
    fontSize: fontSize.label,
  },
  setRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  mini: {
    marginHorizontal: spacing.xs,
  },
  miniDim: {
    opacity: 0.55,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TAP_TARGET,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: reward.panelEdge,
    backgroundColor: reward.cardFill,
  },
  nextStamp: {
    width: 40,
    height: 40,
  },
  nextText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  nextLabel: {
    color: reward.link,
    fontSize: fontSize.small,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  nextName: {
    color: reward.text,
    fontSize: fontSize.label,
    fontWeight: '800',
  },
  nextDetail: {
    color: reward.textMuted,
    fontSize: fontSize.small,
  },
  nextGo: {
    color: reward.link,
    fontSize: fontSize.title,
    marginLeft: spacing.sm,
  },
  buttons: {
    alignSelf: 'stretch',
    flexDirection: 'row',
  },
  primary: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    borderRadius: radius.control,
    backgroundColor: reward.goldButton,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  primaryText: {
    color: reward.goldButtonText,
    fontSize: fontSize.body,
    fontWeight: '800',
  },
  ghost: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: reward.panelEdge,
    backgroundColor: reward.cardFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    color: reward.text,
    fontSize: fontSize.body,
    fontWeight: '800',
  },
  close: {
    alignSelf: 'stretch',
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: reward.textMuted,
    fontSize: fontSize.body,
  },
  pressed: {
    opacity: 0.75,
  },
});

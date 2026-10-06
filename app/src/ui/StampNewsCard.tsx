/**
 * The celebration for a stamp earned since the map was last on screen (D-096),
 * redrawn as E2 revised, with E3 for a locked stamp (D-097, T-249, picked
 * 2026-10-05 from `tools/preview-trophy-options.mjs`).
 *
 * A gold flash opens rotating rays; the stamp drops in spinning and lands with
 * a shake, a short vibration, an ink ring and confetti; a postmark is stamped
 * on with the day; then the passport's counter ticks up, the set's bar fills,
 * and, only when this stamp crossed a line, the passport's new rank arrives.
 * Every number is `stampCelebration.ts`'s, as of this stamp.
 *
 * E3: a locked stamp gets the same arrival, but lands frosted under a padlock,
 * with the offer to unlock. It is the moment it is most worth offering: the
 * user has just been there.
 *
 * All motion is React Native's own `Animated` on the native driver. With the
 * phone's "remove animations" setting on, everything appears at once, still.
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { n, t } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { designFor } from '../passport/stampArt';
import type { StampPopup } from '../progress/stampAnnouncer';
import MedalArt from './MedalArt';
import Padlock from './Padlock';
import StampArt from './StampArt';
import { postmarkFor } from './postmark';
import { fontSize, MIN_TAP_TARGET, radius, reward, spacing } from './theme';
import { useReduceMotion } from './useReduceMotion';

const STAMP_SIZE = 196;
/** The completed set's medal, beside its title (T-235). */
const MEDAL_SIZE = 60;
const RAYS_SIZE = 560;
const CONFETTI = 26;
/** When the stamp lands, in ms: the impact everything else is timed from. */
const IMPACT_MS = 1100;

export default function StampNewsCard({
  stamp,
  onClose,
  onOpenPassport,
  onUnlock,
}: {
  stamp: StampPopup;
  onClose: () => void;
  onOpenPassport: () => void;
  /** A locked stamp's offer (E3). Absent in a beta build, which sells nothing. */
  onUnlock?: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const anim = useTimeline(reduceMotion, stamp.locked);
  const celebration = stamp.celebration;
  const offer = stamp.locked && onUnlock !== undefined;
  const postmark = postmarkFor(stamp.awardedTs);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.stage} accessibilityViewIsModal>
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="stage" cx="50%" cy="34%" r="70%">
              <Stop offset="0" stopColor={reward.stageGlow} />
              <Stop offset="1" stopColor={reward.stage} />
            </RadialGradient>
          </Defs>
          <Rect width="100" height="100" fill="url(#stage)" />
        </Svg>

        <View style={styles.middle}>
          <Animated.Text
            style={[styles.heading, { opacity: anim.title, transform: [{ scale: anim.title }] }]}
            accessibilityRole="header"
          >
            {t('stampNews.heading')}
          </Animated.Text>

          <View style={styles.stampBox}>
            {/* Behind the stamp and centred on it: the rays, the flash, the ink
                ring and the confetti all start where it lands. */}
            <View style={styles.burst} pointerEvents="none">
              <Animated.View style={{ opacity: anim.rays, transform: [{ scale: anim.rays }, { rotate: anim.spin }] }}>
                <Rays />
              </Animated.View>
              <Animated.View style={[styles.flash, { opacity: anim.flashOpacity, transform: [{ scale: anim.flashScale }] }]} />
              <Animated.View style={[styles.ring, { opacity: anim.ringOpacity, transform: [{ scale: anim.ringScale }] }]} />
              {reduceMotion ? null : <Confetti progress={anim.confetti} />}
            </View>
            <Animated.View
              style={[
                styles.stamp,
                {
                  opacity: anim.dropOpacity,
                  transform: [
                    { translateX: anim.shake },
                    { translateY: anim.dropY },
                    { scale: anim.dropScale },
                    { rotate: anim.dropRotate },
                  ],
                },
              ]}
            >
              <StampArt
                placeId={`news-${stamp.placeId}`}
                design={designFor(stamp.placeId, stamp.category)}
                name={stamp.name}
                collected
                postmark={null}
                size={STAMP_SIZE}
                blur={stamp.locked ? 3.4 : undefined}
              />
              {stamp.locked ? (
                <View style={styles.lockOver}>
                  <Padlock size={56} />
                </View>
              ) : postmark === null ? null : (
                <Animated.View style={[styles.postmark, { opacity: anim.postmark, transform: [{ scale: anim.postmarkScale }, { rotate: '-12deg' }] }]}>
                  <Postmark top={postmark.top} bottom={postmark.bottom} />
                </Animated.View>
              )}
            </Animated.View>
          </View>

          <Animated.Text style={[styles.place, { opacity: anim.name }]}>{stamp.name}</Animated.Text>

          {stamp.locked ? (
            <Animated.Text style={[styles.lockedLine, { opacity: anim.details }]}>
              {stamp.othersWaiting > 0
                ? n('stampNews.lockedMore', stamp.othersWaiting)
                : t('stampNews.locked')}
            </Animated.Text>
          ) : celebration === null ? null : (
            <Animated.View style={[styles.numbers, { opacity: anim.details }]}>
              <View style={styles.counter}>
                <View style={styles.counterDigits}>
                  <Animated.Text style={[styles.counterNumber, styles.counterOld, { opacity: anim.counterOld, transform: [{ translateY: anim.counterOldY }] }]}>
                    {celebration.collectedBefore}
                  </Animated.Text>
                  <Animated.Text style={[styles.counterNumber, { opacity: anim.counterNew, transform: [{ translateY: anim.counterNewY }] }]}>
                    {celebration.collectedAfter}
                  </Animated.Text>
                </View>
                <Text style={styles.counterTotal}>
                  {' '}/ {celebration.total} {n('passport.collected', celebration.collectedAfter)}
                </Text>
              </View>
              {celebration.rankUp === null ? (
                <View style={styles.set}>
                  <View style={styles.bar}>
                    <Animated.View
                      style={[
                        styles.barFill,
                        {
                          width: `${(100 * celebration.inCategory) / celebration.categoryTotal}%`,
                          transform: [{ scaleX: anim.bar }],
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.setText}>
                    {t(`stampNews.set.${celebration.category}` as StringKey, {
                      count: celebration.inCategory,
                      total: celebration.categoryTotal,
                    })}
                  </Text>
                </View>
              ) : (
                <Animated.View style={[styles.rankUp, { opacity: anim.rank, transform: [{ scale: anim.rank }] }]}>
                  <View style={[styles.medal, { backgroundColor: reward.medal[celebration.rankUp] }]}>
                    <Text style={styles.medalText}>{celebration.collectedAfter}</Text>
                  </View>
                  <Text style={styles.rankTitle}>{t(`stampNews.rankUp.${celebration.rankUp}` as StringKey)}</Text>
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* T-235: the set this stamp completed, said once, here, as the last
              beat. One quiet card, not a second celebration. */}
          {stamp.medals.map((medal) => {
            const line = t(medal.locked ? 'stampNews.medal.locked' : 'stampNews.medal.done');
            return (
              <Animated.View
                key={medal.id}
                style={[styles.medalRow, { opacity: anim.buttons }]}
                accessible
                accessibilityLabel={`${medal.title}. ${line}`}
              >
                <View>
                  <MedalArt
                    id={`news-${medal.id}`}
                    drawing={{ kind: 'set', words: medal.words }}
                    size={MEDAL_SIZE}
                    blur={medal.locked ? 3 : undefined}
                  />
                  {medal.locked ? (
                    <View style={styles.medalLock}>
                      <Padlock size={24} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.medalWords}>
                  <Text style={styles.medalTitle}>{medal.title}</Text>
                  <Text style={styles.medalLine}>{line}</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>

        <Animated.View style={[styles.actions, { opacity: anim.buttons }]}>
          <Pressable
            accessibilityRole="button"
            onPress={offer ? onUnlock : onOpenPassport}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{t(offer ? 'stampNews.unlock' : 'stampNews.passport')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{t(offer ? 'unlock.notNow' : 'stampNews.close')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Every moving value, on one timeline that starts when the card opens. */
function useTimeline(reduceMotion: boolean, locked: boolean) {
  const v = useRef({
    flash: new Animated.Value(0),
    rays: new Animated.Value(0),
    spin: new Animated.Value(0),
    title: new Animated.Value(0),
    drop: new Animated.Value(0),
    shake: new Animated.Value(0),
    ring: new Animated.Value(0),
    confetti: new Animated.Value(0),
    postmark: new Animated.Value(0),
    name: new Animated.Value(0),
    details: new Animated.Value(0),
    counter: new Animated.Value(0),
    bar: new Animated.Value(0),
    rank: new Animated.Value(0),
    buttons: new Animated.Value(0),
  }).current;

  useEffect(() => {
    if (reduceMotion) {
      // Everything at its resting place, nothing moving.
      for (const value of [v.rays, v.title, v.drop, v.postmark, v.name, v.details, v.counter, v.bar, v.rank, v.buttons]) {
        value.setValue(1);
      }
      v.flash.setValue(1);
      v.ring.setValue(1);
      return;
    }
    const at = (ms: number, value: Animated.Value, duration: number, easing = Easing.out(Easing.cubic)) =>
      Animated.sequence([
        Animated.delay(ms),
        Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true }),
      ]);
    const shake = Animated.sequence([
      Animated.delay(IMPACT_MS),
      ...[-7, 6, -4, 3, 0].map((toValue) =>
        Animated.timing(v.shake, { toValue, duration: 70, useNativeDriver: true })
      ),
    ]);
    const timeline = Animated.parallel([
      at(100, v.flash, 700),
      at(150, v.rays, 800),
      at(700, v.title, 500, Easing.out(Easing.back(2))),
      at(350, v.drop, IMPACT_MS - 350, Easing.in(Easing.cubic)),
      shake,
      at(IMPACT_MS, v.ring, 1000),
      at(IMPACT_MS, v.confetti, 1800, Easing.out(Easing.quad)),
      at(IMPACT_MS + 450, v.postmark, 350, Easing.out(Easing.back(3))),
      at(1300, v.name, 400),
      at(1600, v.details, 400),
      at(2100, v.counter, 500),
      at(2500, v.bar, 900),
      at(2300, v.rank, 500, Easing.out(Easing.back(2))),
      at(2500, v.buttons, 400),
    ]);
    const spin = Animated.loop(
      Animated.timing(v.spin, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true })
    );
    timeline.start();
    spin.start();
    // The impact, felt. Short, once; a locked stamp lands just as hard.
    const buzz = setTimeout(() => Vibration.vibrate(locked ? 25 : 40), IMPACT_MS);
    return () => {
      timeline.stop();
      spin.stop();
      clearTimeout(buzz);
    };
  }, [reduceMotion, locked, v]);

  return useMemo(
    () => ({
      flashOpacity: v.flash.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }),
      flashScale: v.flash.interpolate({ inputRange: [0, 1], outputRange: [0.2, 3] }),
      rays: v.rays,
      spin: v.spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
      title: v.title,
      dropOpacity: v.drop.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
      dropY: v.drop.interpolate({ inputRange: [0, 1], outputRange: [-260, 0] }),
      dropScale: v.drop.interpolate({ inputRange: [0, 1], outputRange: [2.2, 1] }),
      dropRotate: v.drop.interpolate({ inputRange: [0, 1], outputRange: ['-200deg', '-4deg'] }),
      shake: v.shake,
      // Hidden until its moment: an animation not yet started shows its first frame.
      ringOpacity: v.ring.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 0.95, 0] }),
      ringScale: v.ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2] }),
      confetti: v.confetti,
      postmark: v.postmark,
      postmarkScale: v.postmark.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }),
      name: v.name,
      details: v.details,
      counterOld: v.counter.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] }),
      counterOldY: v.counter.interpolate({ inputRange: [0, 0.5], outputRange: [0, -20], extrapolate: 'clamp' }),
      counterNew: v.counter.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
      counterNewY: v.counter.interpolate({ inputRange: [0.5, 1], outputRange: [20, 0], extrapolate: 'clamp' }),
      bar: v.bar.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
      rank: v.rank,
      buttons: v.buttons,
    }),
    [v]
  );
}

/** Gold rays from the centre, drawn once and turned by the stage. */
function Rays() {
  const rays = Array.from({ length: 20 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 20;
    const w = 0.08;
    const r = 50;
    const p = (angle: number) => `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
    return `M50,50 L${p(a - w)} L${p(a + w)} Z`;
  });
  return (
    <Svg width={RAYS_SIZE} height={RAYS_SIZE} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="rays-fade" cx="50%" cy="50%" r="50%">
          <Stop offset="0.15" stopColor={reward.gold} stopOpacity={0.45} />
          <Stop offset="1" stopColor={reward.gold} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {rays.map((d) => (
        <Path key={d} d={d} fill="url(#rays-fade)" />
      ))}
    </Svg>
  );
}

/** Confetti thrown from where the stamp lands: up a little, then down. */
function Confetti({ progress }: { progress: Animated.Value }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => ({
        colour: reward.confetti[i % reward.confetti.length],
        drift: ((i * 53) % 160) - 80,
        lift: 40 + ((i * 29) % 70),
        turn: (i * 47) % 360,
        left: ((i * 37) % 90) - 45,
      })),
    []
  );
  return (
    <>
      {pieces.map((piece, i) => (
        <Animated.View
          key={i}
          style={[
            styles.confettiPiece,
            {
              backgroundColor: piece.colour,
              left: '50%',
              marginLeft: piece.left,
              opacity: progress.interpolate({ inputRange: [0, 0.01, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] }) },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 0.18, 1],
                    outputRange: [0, -piece.lift, 380],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [`${piece.turn}deg`, `${piece.turn + 540}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </>
  );
}

/** A cancellation in red ink with the day: rings, the date, wavy lines. */
function Postmark({ top, bottom }: { top: string; bottom: string }) {
  const ink = reward.postmarkInk;
  return (
    <Svg width={112} height={66} viewBox="0 0 120 70">
      <Circle cx={35} cy={35} r={26} stroke={ink} strokeWidth={2.4} fill="none" />
      <Circle cx={35} cy={35} r={20} stroke={ink} strokeWidth={1} fill="none" />
      {[20, 30, 40, 50].map((y) => (
        <Path key={y} d={`M64 ${y} q8 -5 16 0 t16 0 t16 0`} stroke={ink} strokeWidth={2.2} fill="none" />
      ))}
      <SvgText x={35} y={33} textAnchor="middle" fontSize={10} fontWeight="800" fill={ink}>
        {top}
      </SvgText>
      <SvgText x={35} y={45} textAnchor="middle" fontSize={9} fontWeight="700" fill={ink}>
        {bottom}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  middle: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampBox: {
    width: STAMP_SIZE,
    height: STAMP_SIZE,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** As big as the rays, centred on the stamp; drawn behind it. */
  burst: {
    position: 'absolute',
    width: RAYS_SIZE,
    height: RAYS_SIZE,
    left: (STAMP_SIZE - RAYS_SIZE) / 2,
    top: (STAMP_SIZE - RAYS_SIZE) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flash: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: reward.flash,
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 7,
    borderColor: reward.gold,
  },
  confettiPiece: {
    position: 'absolute',
    top: '50%',
    width: 8,
    height: 13,
    borderRadius: 2,
  },
  heading: {
    color: reward.gold,
    fontSize: fontSize.title + 6,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  stamp: {
    width: STAMP_SIZE,
    height: STAMP_SIZE,
  },
  lockOver: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postmark: {
    position: 'absolute',
    right: -28,
    top: -8,
  },
  place: {
    color: reward.text,
    fontSize: fontSize.title + 2,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  lockedLine: {
    color: reward.textMuted,
    fontSize: fontSize.body,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  medalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.sm + 4,
    borderRadius: radius.card,
    backgroundColor: reward.cardFill,
    borderWidth: 1,
    borderColor: reward.panelEdge,
  },
  medalLock: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  medalWords: { flex: 1, gap: 2 },
  medalTitle: { color: reward.goldInk, fontSize: fontSize.label, fontWeight: '800' },
  medalLine: { color: reward.textMuted, fontSize: fontSize.small },
  numbers: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  counterDigits: {
    minWidth: 36,
    alignItems: 'flex-end',
  },
  counterNumber: {
    color: reward.text,
    fontSize: fontSize.title + 8,
    fontWeight: '900',
  },
  counterOld: {
    position: 'absolute',
    right: 0,
  },
  counterTotal: {
    color: reward.textMuted,
    fontSize: fontSize.body,
  },
  set: {
    marginTop: spacing.sm,
  },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: reward.barTrack,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: reward.gold,
    transformOrigin: 'left',
  },
  setText: {
    color: reward.textMuted,
    fontSize: fontSize.label,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  rankUp: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: reward.panelEdge,
  },
  medal: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: {
    color: reward.goldButtonText,
    fontSize: fontSize.body,
    fontWeight: '900',
  },
  rankTitle: {
    marginLeft: spacing.md,
    color: reward.text,
    fontSize: fontSize.body,
    fontWeight: '800',
  },
  actions: {
    alignSelf: 'stretch',
  },
  primary: {
    minHeight: MIN_TAP_TARGET,
    borderRadius: radius.control,
    backgroundColor: reward.goldButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: reward.goldButtonText,
    fontSize: fontSize.body,
    fontWeight: '800',
  },
  secondary: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: reward.textMuted,
    fontSize: fontSize.body,
  },
  pressed: {
    opacity: 0.75,
  },
});

/**
 * How the unlock sheet looks: design A, "your stamps are waiting" (D-097,
 * T-249, picked 2026-10-05 from `tools/preview-unlock-options.mjs`).
 *
 * Props in, pixels out: no store, no database, so the workbench draws it in
 * every state (`App.web.tsx`). `UnlockSheet` holds the state and wraps this
 * in a modal.
 *
 * The user's own waiting stamps are drawn **in colour behind frosted glass**:
 * what is sold is already theirs, and the sheet shows it rather than saying it.
 * A padlock wobbles over them and the button breathes. Both are
 * `Animated` loops on the native driver; nothing here needs a new library.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { UnlockSheetModel } from '../entitlement/unlockSheet';
import { designFor } from '../passport/stampArt';
import type { PassportStamp } from './PassportView';
import Padlock from './Padlock';
import StampArt from './StampArt';
import { fontSize, MIN_TAP_TARGET, radius, reward, spacing } from './theme';

/** How many waiting stamps the fan shows; more would shrink each below reading. */
const FAN = 5;
const FAN_STAMP = 66;

export default function UnlockSheetView({
  model,
  waiting,
  unlocked,
  working,
  onBuy,
  onRestore,
  onClose,
}: {
  model: UnlockSheetModel;
  /** The locked stamps, the tapped one first; drawn frosted until paid for. */
  waiting: PassportStamp[];
  /** Paid: the fan is drawn sharp. */
  unlocked: boolean;
  /** Google is busy: Restore waits too. */
  working: boolean;
  onBuy: () => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  const wobble = useLoop(2600);
  const breath = useLoop(2200);
  const fan = waiting.slice(0, FAN);

  return (
    <View style={styles.card} accessibilityViewIsModal>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="unlock-panel" x1="0" y1="0" x2="0.25" y2="1">
            <Stop offset="0" stopColor={reward.panelTop} />
            <Stop offset="0.55" stopColor={reward.panelBottom} />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill="url(#unlock-panel)" />
      </Svg>

      <Text style={styles.eyebrow}>{model.eyebrow}</Text>
      <Text style={styles.title} accessibilityRole="header">
        {model.title}
      </Text>

      {fan.length === 0 ? null : (
        <View style={styles.fan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {fan.map((stamp, index) => (
            <View
              key={stamp.placeId}
              style={[
                styles.fanStamp,
                {
                  transform: [
                    { rotate: `${(index - (fan.length - 1) / 2) * 9}deg` },
                    { translateY: Math.abs(index - (fan.length - 1) / 2) * 4 },
                  ],
                },
              ]}
            >
              <StampArt
                placeId={`unlock-${stamp.placeId}`}
                design={designFor(stamp.placeId, stamp.category)}
                name={stamp.name}
                collected
                postmark={null}
                size={FAN_STAMP}
                blur={unlocked ? undefined : 3.4}
              />
            </View>
          ))}
          {unlocked ? null : (
            <Animated.View
              style={[
                styles.padlock,
                {
                  transform: [
                    {
                      rotate: wobble.interpolate({
                        inputRange: [0, 0.7, 0.8, 0.9, 1],
                        outputRange: ['0deg', '0deg', '-12deg', '10deg', '0deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Padlock />
            </Animated.View>
          )}
        </View>
      )}

      <Text style={styles.lead}>{model.earned}</Text>
      <View style={styles.adds}>
        {model.adds.map((line) => (
          <View key={line} style={styles.addRow}>
            <Text style={styles.tick}>✓</Text>
            <Text style={styles.add}>{line}</Text>
          </View>
        ))}
      </View>

      {model.notice === null ? null : (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {model.notice}
        </Text>
      )}

      {model.buy === null ? null : (
        <Animated.View
          style={[
            styles.buyWrap,
            // The button breathes while it can be pressed. A glow drawn behind
            // it read as a grey frame on Android (seen on the emulator,
            // 2026-10-05), which has no blur under a view.
            model.buy.enabled
              ? { transform: [{ scale: breath.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.035, 1] }) }] }
              : null,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !model.buy.enabled }}
            disabled={!model.buy.enabled}
            onPress={onBuy}
            style={({ pressed }) => [
              styles.buy,
              !model.buy?.enabled && styles.disabled,
              pressed && styles.pressed,
            ]}
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
      {/* Last and quiet (the project lead, 2026-10-06): restoring is for the
          few who bought on another phone, so it sits under "Not now" in small
          grey type, as store apps keep it. The tap target stays full size. */}
      {model.restore === null ? null : (
        <Pressable
          accessibilityRole="button"
          disabled={working}
          onPress={onRestore}
          style={({ pressed }) => [styles.plain, pressed && styles.pressed]}
        >
          <Text style={styles.restore}>{model.restore}</Text>
        </Pressable>
      )}
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
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: reward.panelEdge,
    padding: spacing.lg,
    alignItems: 'center',
    overflow: 'hidden',
  },
  eyebrow: {
    color: reward.goldInk,
    fontSize: fontSize.label,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    color: reward.text,
    fontSize: fontSize.title + 4,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  fan: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: FAN_STAMP + 26,
    marginVertical: spacing.sm,
  },
  fanStamp: {
    marginHorizontal: -8,
  },
  padlock: {
    position: 'absolute',
  },
  lead: {
    color: reward.text,
    fontSize: fontSize.body,
    textAlign: 'center',
  },
  adds: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  tick: {
    color: reward.tick,
    fontSize: fontSize.body,
    fontWeight: '800',
    width: 24,
  },
  add: {
    flex: 1,
    color: reward.textMuted,
    fontSize: fontSize.label,
  },
  notice: {
    color: reward.text,
    fontSize: fontSize.label,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  buyWrap: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
  buy: {
    minHeight: MIN_TAP_TARGET,
    borderRadius: radius.control,
    backgroundColor: reward.action,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buyText: {
    color: reward.actionText,
    fontSize: fontSize.body,
    fontWeight: '800',
    textAlign: 'center',
  },
  plain: {
    alignSelf: 'stretch',
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restore: {
    color: reward.textMuted,
    fontSize: fontSize.small,
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

/**
 * The standing reminder on the passport (D-097, R1, picked 2026-10-05): a gold
 * card under the passport's number while stamps are locked. Always there,
 * never over anything; tapping it opens the unlock sheet.
 *
 * Props in, pixels out, so the workbench can draw it. The caller decides when
 * it shows (locked stamps, not a beta build).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { n, t } from '../i18n';
import { designFor } from '../passport/stampArt';
import type { PassportStamp } from './PassportView';
import StampArt from './StampArt';
import { fontSize, MIN_TAP_TARGET, radius, reward, spacing } from './theme';

/** Three is a stack; more would only be smaller. */
const STACK = 3;
const STACK_STAMP = 42;

export default function UnlockNudge({
  waiting,
  onPress,
}: {
  /** The locked stamps; at least one, or the caller draws nothing. */
  waiting: PassportStamp[];
  onPress: () => void;
}) {
  const title = n('passport.nudge.title', waiting.length);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${t('passport.nudge.body')}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="nudge-panel" x1="0" y1="0" x2="1" y2="0.4">
            <Stop offset="0" stopColor={reward.nudgeFrom} />
            <Stop offset="1" stopColor={reward.panelTop} />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill="url(#nudge-panel)" />
      </Svg>
      <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {waiting.slice(0, STACK).map((stamp, index) => (
          <View
            key={stamp.placeId}
            style={[
              styles.stacked,
              { left: index * 9, top: index * 2, transform: [{ rotate: `${(index - 1) * 10}deg` }] },
            ]}
          >
            <StampArt
              placeId={`nudge-${stamp.placeId}`}
              design={designFor(stamp.placeId, stamp.category)}
              name={stamp.name}
              collected
              postmark={null}
              size={STACK_STAMP}
              blur={3}
            />
          </View>
        ))}
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{t('passport.nudge.body')}</Text>
      </View>
      <View style={styles.button}>
        <Text style={styles.buttonText}>{t('passport.nudge.button')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TAP_TARGET + 12,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: reward.nudgeEdge,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.8,
  },
  stack: {
    width: STACK_STAMP + 2 * 9 + 4,
    height: STACK_STAMP + 8,
  },
  stacked: {
    position: 'absolute',
  },
  text: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  title: {
    color: reward.text,
    fontSize: fontSize.body,
    fontWeight: '800',
  },
  body: {
    color: reward.textMuted,
    fontSize: fontSize.label,
  },
  button: {
    backgroundColor: reward.goldButton,
    borderRadius: radius.control,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  buttonText: {
    color: reward.goldButtonText,
    fontSize: fontSize.label,
    fontWeight: '800',
  },
});

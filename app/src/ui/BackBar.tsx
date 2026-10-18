/**
 * The top of a screen reached from another: a back arrow and the screen's own
 * title on one line, as Android and WalkNYC draw it (2026-10-18).
 *
 * It was *‹ Mapa* in tinted words with the title as a large heading below it
 * (2026-09-25), two rows for one job, and the project lead found WalkNYC's
 * settings tidier beside ours. Before that, a *Concluído* bar at the foot.
 *
 * The arrow's spoken name says where it goes ("Voltar ao mapa"); the title is a
 * header. Android's Back does the same thing (T-211).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

export default function BackBar({
  title,
  accessibilityLabel,
  onPress,
}: {
  /** This screen's name: "Definições". */
  title: string;
  /** Where the arrow goes: "Voltar ao mapa". */
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="M20 12H5M11 5l-7 7 7 7" stroke={colors.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  back: {
    width: MIN_TAP_TARGET,
    height: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, color: colors.text, fontSize: fontSize.title, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});

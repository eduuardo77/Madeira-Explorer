/**
 * The way back, at the top of a screen: tinted words after a chevron, no fill
 * (2026-09-25). *‹ Mapa* on Settings, *‹ Definições* on Privacy and Licences.
 *
 * It replaced a *Concluído* bar pinned to the foot of each of those screens,
 * which the project lead found heavy; the passport already had this shape. The
 * spoken name contains the visible word (WCAG 2.5.3, `accessibility.test.ts`),
 * and Android's Back does the same thing (T-211).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

export default function BackBar({
  label,
  accessibilityLabel,
  onPress,
}: {
  /** The screen it goes back to, as a word: "Mapa", "Definições". */
  label: string;
  /** "Voltar às definições": must contain `label`. */
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
        <Text style={styles.text}>{`‹ ${label}`}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingTop: spacing.xl, paddingHorizontal: spacing.sm },
  back: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
  },
  // D-095: the label size, as every control's since the map was measured
  // against WalkNYC's. The target is the 60 dp row, not the words.
  text: { color: colors.tint, fontSize: fontSize.label, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});

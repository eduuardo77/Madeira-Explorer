/**
 * A question with two answers, over the screen, in WalkNYC's shape
 * (2026-10-18): a glyph, a title, a short paragraph with one phrase in bold,
 * and the answers as words on the right, the one the app recommends first.
 *
 * Android's Back answers with the second choice, as declining is what leaving
 * a question means; a tap outside does nothing, so the question is answered on
 * purpose rather than by a stray touch on the map.
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import SettingsIcon, { type SettingsIconName } from './SettingsIcon';
import { colors, fontSize, MIN_TAP_TARGET, radius, spacing } from './theme';

export type DialogChoice = { label: string; onPress: () => void };

export default function ChoiceDialog({
  icon,
  title,
  lead,
  strong,
  rest,
  primary,
  secondary,
}: {
  icon: SettingsIconName;
  title: string;
  /** The paragraph: `lead`, then `strong` in bold, then `rest`. */
  lead: string;
  strong: string;
  rest: string;
  primary: DialogChoice;
  secondary: DialogChoice;
}) {
  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={secondary.onPress} visible>
      <View style={styles.scrim}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.icon}>
            <SettingsIcon name={icon} color={colors.tint} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.body}>
            {lead} <Text style={styles.strong}>{strong}</Text> {rest}
          </Text>
          <View style={styles.choices}>
            {[primary, secondary].map((choice) => (
              <Pressable
                key={choice.label}
                accessibilityRole="button"
                onPress={choice.onPress}
                style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
              >
                <Text style={styles.choiceText}>{choice.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.scrim,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  icon: { alignItems: 'center' },
  title: { color: colors.text, fontSize: fontSize.title, fontWeight: '700' },
  body: { color: colors.text, fontSize: fontSize.label, lineHeight: Math.round(fontSize.label * 1.45) },
  strong: { fontWeight: '700' },
  choices: { alignItems: 'flex-end' },
  choice: { minHeight: MIN_TAP_TARGET, justifyContent: 'center' },
  choiceText: { color: colors.tint, fontSize: fontSize.label, fontWeight: '600', textAlign: 'right' },
  pressed: { opacity: 0.6 },
});

/**
 * The privacy policy, on screen (T-124).
 *
 * **Shown inside the app, not opened in a browser.** The obvious
 * implementation is a link to a hosted page, and it is wrong here for two
 * reasons: this app makes no network requests at all (D-001), so the privacy
 * policy would become the only thing in the product that does; and a tourist
 * reading it is frequently a tourist with no signal, which is the moment they
 * are most likely to wonder what the app is doing with their location.
 *
 * The same text is published to a URL for the store listings — generated from
 * the same source by `tools/generate-privacy-policy.mjs`, so the two cannot
 * drift.
 *
 * The button sits **outside** the ScrollView, which is load-bearing and was
 * learned the expensive way on the onboarding screens (D-041): at 2× text
 * scaling a long document pushes anything below it off the screen, for exactly
 * the users who need large text most (D-015).
 *
 * Presentational: props in, pixels out, so the workbench can mount it (D-038).
 */

import { APP_NAME } from '../brand';
import { deviceLanguage, t } from '../i18n';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  POLICY_VERSION,
  policySections,
} from '../legal/privacyPolicy';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

export default function PrivacyPolicyView({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('privacy.title')}</Text>
        <Text style={styles.dateline}>
          {APP_NAME} · last changed {POLICY_VERSION}
        </Text>

        {policySections(deviceLanguage()).map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.heading}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.body}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('privacy.a11y.back')}
          onPress={onClose}
          style={({ pressed }) => [styles.done, pressed && styles.pressed]}
        >
          <Text style={styles.doneText}>{t('common.done')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.md,
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heading: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  dateline: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    marginTop: -spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  body: {
    color: colors.text,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.5,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: { opacity: 0.75 },
  done: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.action,
  },
  doneText: {
    color: colors.actionText,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});

/**
 * The privacy policy, on screen (T-124).
 *
 * **Shown inside the app, not opened in a browser.** A tourist reading it is
 * frequently a tourist with no signal, which is the moment they are most likely
 * to wonder what the app does with their location. The same text is published
 * to a URL for the store listings, generated from the same source by
 * `tools/generate-privacy-policy.mjs`, so the two cannot drift.
 *
 * SUMMARY FIRST, THE FULL TEXT ON REQUEST (2026-09-25)
 * ----------------------------------------------------
 * The project lead: the Portuguese is fine, but *"it's quite a bit of text which
 * is not very well presented"*. It was nine grey boxes of paragraphs. Now it
 * opens on five short points with a glyph each, the way WalkNYC's footnotes
 * put the essential in a sentence, and the policy itself follows as sections
 * that open on a tap. The wording of the policy is unchanged; only the page.
 *
 * ⚠ **The summary may only say what the policy says.** Each point restates a
 * promise the full text makes, and `privacyPolicy.test.ts` holds the promises.
 * Changing the policy means reading these five lines again.
 *
 * Presentational: props in, pixels out, so the workbench can mount it (D-038).
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { deviceLanguage, t } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { POLICY_VERSION, policySections } from '../legal/privacyPolicy';
import BackBar from './BackBar';
import SettingsIcon, { type SettingsIconName } from './SettingsIcon';
import { colors, fontSize, MIN_TAP_TARGET, radius, spacing } from './theme';

/** The five points, in the order a worried reader asks them. */
const SUMMARY: { icon: SettingsIconName; key: StringKey }[] = [
  { icon: 'privacy', key: 'privacy.summary.local' },
  { icon: 'recording', key: 'privacy.summary.map' },
  { icon: 'licences', key: 'privacy.summary.backup' },
  { icon: 'send', key: 'privacy.summary.share' },
  { icon: 'erase', key: 'privacy.summary.erase' },
];

export default function PrivacyPolicyView({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={styles.root}>
      <BackBar
        label={t('settings.title')}
        accessibilityLabel={t('privacy.a11y.back')}
        onPress={onClose}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.heading}>{t('privacy.title')}</Text>
          <Text style={styles.dateline}>{t('privacy.lastChanged', { date: POLICY_VERSION })}</Text>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t('privacy.summary.title')}</Text>
          <View style={styles.card}>
            {SUMMARY.map(({ icon, key }, index) => (
              <View key={key} style={[styles.point, index > 0 && styles.divided]}>
                <SettingsIcon name={icon} color={icon === 'erase' ? colors.bad : colors.tint} />
                <Text style={styles.pointText}>{t(key)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t('privacy.fullText')}</Text>
          <View style={styles.card}>
            {policySections(deviceLanguage()).map((section, index) => {
              const expanded = open === section.heading;
              return (
                <View key={section.heading} style={index > 0 && styles.divided}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={section.heading}
                    onPress={() => setOpen(expanded ? null : section.heading)}
                    style={({ pressed }) => [styles.sectionRow, pressed && styles.pressed]}
                  >
                    <Text style={styles.sectionTitle}>{section.heading}</Text>
                    <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
                      {expanded ? '⌃' : '⌄'}
                    </Text>
                  </Pressable>
                  {expanded
                    ? section.paragraphs.map((paragraph) => (
                        <Text key={paragraph} style={styles.body} selectable>
                          {paragraph}
                        </Text>
                      ))
                    : null}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heading: { color: colors.text, fontSize: fontSize.title, fontWeight: '700' },
  dateline: { color: colors.textMuted, fontSize: fontSize.small, marginTop: spacing.xs },
  group: { gap: spacing.xs },
  groupTitle: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
  },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  pointText: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.35,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TAP_TARGET,
  },
  sectionTitle: { flex: 1, color: colors.text, fontSize: fontSize.body, fontWeight: '600' },
  chevron: { color: colors.textMuted, fontSize: fontSize.body },
  body: {
    color: colors.text,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.5,
    paddingBottom: spacing.md,
  },
  pressed: { opacity: 0.75 },
});

/**
 * The open-source software the app is built with, and its licences (T-202).
 *
 * The list is generated, never typed: `node tools/build-licences.mjs` walks the
 * production dependency tree and writes `legal/licences.json`, and
 * `licences.test.ts` fails the build if a direct dependency is missing from it.
 * Each row opens its licence text in place. The note at the top names what the
 * list cannot cover: Google Maps and Google Play services, which come under
 * Google's own terms, not an open-source licence.
 *
 * Laid out like `PrivacyPolicyView`, which it sits beside in *Sobre*.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import LICENCES from '../legal/licences.json';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

type Licence = { name: string; version: string; license: string; text: string | null };

export default function LicencesView({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const licences = LICENCES as Licence[];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('licences.title')}</Text>
        <Text style={styles.note}>{t('licences.note', { count: licences.length })}</Text>

        <View style={styles.section}>
          {licences.map((licence) => {
            const key = `${licence.name}@${licence.version}`;
            const expanded = open === key;
            return (
              <View key={key}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${licence.name} ${licence.version}, ${licence.license}`}
                  onPress={() => setOpen(expanded ? null : key)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <Text style={styles.name} numberOfLines={1}>
                    {licence.name}
                  </Text>
                  <Text style={styles.meta}>{`${licence.version} · ${licence.license}`}</Text>
                </Pressable>
                {expanded ? (
                  <Text style={styles.text} selectable>
                    {licence.text ?? t('licences.noText', { license: licence.license })}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('licences.a11y.back')}
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
  heading: { color: colors.text, fontSize: fontSize.title, fontWeight: '700' },
  note: { color: colors.textMuted, fontSize: fontSize.body, lineHeight: fontSize.body * 1.4 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  row: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { color: colors.text, fontSize: fontSize.body },
  meta: { color: colors.textMuted, fontSize: fontSize.small },
  text: {
    color: colors.text,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    paddingVertical: spacing.sm,
  },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.75 },
  done: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.action,
  },
  doneText: { color: colors.actionText, fontSize: fontSize.body, fontWeight: '700' },
});

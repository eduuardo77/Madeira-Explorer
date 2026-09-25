/**
 * The open-source software the app is built with, and its licences (T-202).
 *
 * The list is generated, never typed: `node tools/build-licences.mjs` reads
 * what the release build contains and writes `legal/licences.json`. Each row
 * opens its licence text in place. The note at the top names what the list
 * cannot cover: Google Maps and Google Play services, which come under Google's
 * own terms, not an open-source licence.
 *
 * ⚠ **Two sections since T-221 (review N5).** The list used to be the npm
 * install tree: build tools that never reach the phone, and no Android library
 * at all. It is now what ships, and over 240 of its entries are Android
 * libraries, so they get their own heading. An Apache module shows the one
 * shared copy of the Apache terms; one whose POM gives only an address shows
 * the address.
 *
 * A `SectionList`, not a `ScrollView`: close to 300 rows, and only the ones on
 * screen need to exist.
 *
 * Laid out like `PrivacyPolicyView`, which it sits beside in *Sobre*.
 */

import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import LICENCES from '../legal/licences.json';
import BackBar from './BackBar';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

type Licence = {
  name: string;
  version: string;
  /** Where it ships from: the JavaScript bundle, the Android build, or both. */
  source: 'js' | 'android' | 'both';
  license: string;
  /** False for Google Play services and Firebase, under Google's SDK terms. */
  openSource: boolean;
  text: string | null;
  /** The shared copy in `texts` this entry uses, when it has none of its own. */
  textRef?: string;
  url: string | null;
};

const { packages, texts } = LICENCES as {
  packages: Licence[];
  texts: Record<string, string>;
};

/**
 * The note says "{count} open-source packages". Google Play services and
 * Firebase are listed too, and are not: the note names Google's terms apart.
 */
const OPEN_SOURCE_COUNT = packages.filter((licence) => licence.openSource).length;

const JAVASCRIPT = packages.filter((licence) => licence.source !== 'android');
const ANDROID = packages.filter((licence) => licence.source === 'android');

/** What a row says when opened: its own text, the shared one, or where to read it. */
function body(licence: Licence): string {
  if (licence.text !== null) return licence.text;
  if (licence.textRef !== undefined && texts[licence.textRef] !== undefined) {
    return texts[licence.textRef];
  }
  if (licence.url !== null) return t('licences.atUrl', { license: licence.license, url: licence.url });
  return t('licences.noText', { license: licence.license });
}

export default function LicencesView({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  // Titled here, not at import: the language can change in Settings (T-160).
  const sections = [
    { title: t('licences.section.js'), data: JAVASCRIPT },
    { title: t('licences.section.android'), data: ANDROID },
  ];

  return (
    <View style={styles.root}>
      {/* The way back, at the top, as on Settings and Privacy (2026-09-25). */}
      <BackBar
        label={t('settings.title')}
        accessibilityLabel={t('licences.a11y.back')}
        onPress={onClose}
      />
      <SectionList
        sections={sections}
        keyExtractor={(licence) => `${licence.name}@${licence.version}`}
        contentContainerStyle={styles.content}
        // Re-render the one row that opened or closed.
        extraData={open}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading}>{t('licences.title')}</Text>
            <Text style={styles.note}>{t('licences.note', { count: OPEN_SOURCE_COUNT })}</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{`${section.title} (${section.data.length})`}</Text>
        )}
        stickySectionHeadersEnabled={false}
        renderItem={({ item: licence }) => {
          const key = `${licence.name}@${licence.version}`;
          const expanded = open === key;
          return (
            <View style={styles.item}>
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
                  {body(licence)}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: { gap: spacing.lg, marginBottom: spacing.lg },
  heading: { color: colors.text, fontSize: fontSize.title, fontWeight: '700' },
  note: { color: colors.textMuted, fontSize: fontSize.body, lineHeight: fontSize.body * 1.4 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Each row carries the card's fill, so a list of rows still reads as one card.
  item: {
    backgroundColor: colors.surface,
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
  pressed: { opacity: 0.75 },
});

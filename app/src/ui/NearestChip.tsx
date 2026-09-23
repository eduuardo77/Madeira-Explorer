/**
 * *Mais perto por visitar: Praia dos Reis Magos* — one line above the controls,
 * naming the nearest place still to collect (D-085, T-199, 2026-09-23).
 *
 * WHY THIS EXISTS
 * ---------------
 * Seen on the P30: the hollow ring for a place still to collect was an
 * unlabelled small circle beside Google's own named pin for the same beach. It
 * kept D-085's rule — never mistakable for a collected place — and said
 * nothing about what it was. This names the nearest one, and tapping it opens
 * that place's card, which flies the map there and carries the distance with
 * its "in a straight line" (placeCard.ts rule 2). The chip shows no number, so
 * the two can never be separated.
 *
 * Rejected, and recorded in D-085: labels on the map (expo-maps markers need an
 * image ref, so `expo-image`, a dependency and a network audit, D-043), and
 * hiding Google's pin where ours sits (Google's POI layer is all or nothing).
 *
 * Styled as the map's own chrome, like *Re-centre*: a quiet pill, not a banner.
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import { t } from '../i18n';
import type { MapStyleName } from '../map/mapStyle';
import { fontSize, mapChrome, MIN_TAP_TARGET, radius, spacing } from './theme';

export default function NearestChip({
  name,
  mapStyle,
  onPress,
}: {
  name: string;
  mapStyle: MapStyleName;
  onPress: () => void;
}) {
  const chrome = mapChrome[mapStyle];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('map.a11y.nearest', { name })}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: chrome.surface,
          elevation: chrome.elevation,
          shadowColor: '#000000',
          shadowOpacity: chrome.elevation === 0 ? 0 : 0.18,
          shadowRadius: chrome.elevation,
          shadowOffset: { width: 0, height: 1 },
        },
        chrome.border !== null && { borderWidth: 1, borderColor: chrome.border },
        pressed && styles.pressed,
      ]}
    >
      {/* One line; a long place name is cut rather than pushing the controls. */}
      <Text numberOfLines={1} style={[styles.text, { color: chrome.content }]}>
        {t('map.nearest', { name })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'center',
    maxWidth: '100%',
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  pressed: { opacity: 0.75 },
});

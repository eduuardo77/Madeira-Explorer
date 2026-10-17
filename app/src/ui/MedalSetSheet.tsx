/**
 * A medal's set, over the passport (the lead, 2026-10-17): "I should be able to
 * click any one and see which stamps am I missing."
 *
 * The first version opened the set as a row under the medal shelf, out of
 * sight, so a tap only dimmed the tile; and a medal waiting for the unlock went
 * straight to the paywall. Now every medal opens this sheet: the set's stamps
 * as the passport draws them (earned, missing, frosted while locked), a tap on
 * one opens its card, and a locked medal's sheet offers the unlock too.
 */

import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { t } from '../i18n';
import { stripStampSize } from '../passport/stripLayout';
import type { StampAward } from '../storage/types';
import { CategoryRow, stripGeometry, type MedalTile, type PassportStamp } from './PassportView';
import { album, colors, fontSize, MIN_TAP_TARGET, radius, spacing } from './theme';

export default function MedalSetSheet({
  medal,
  stamps,
  awards,
  onSelectStamp,
  onUnlock,
  onClose,
}: {
  medal: MedalTile;
  /** Every curated place, as the passport has them. */
  stamps: PassportStamp[];
  awards: StampAward[];
  onSelectStamp: (stamp: PassportStamp) => void;
  /** Offered only for a medal waiting for the unlock; absent in a beta build. */
  onUnlock: (() => void) | undefined;
  onClose: () => void;
}) {
  const byId = new Map(stamps.map((stamp) => [stamp.placeId, stamp]));
  const set = medal.placeIds.flatMap((id) => {
    const stamp = byId.get(id);
    return stamp === undefined ? [] : [stamp];
  });
  const awardedAt = new Map(awards.map((award) => [award.place_id, award.awarded_ts]));
  const stampSize = stripStampSize(stripGeometry(null, useWindowDimensions().width));

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessible={false} />
      <View style={styles.panel} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={styles.content}>
          <CategoryRow
            initiallyExpanded
            title={medal.name}
            seeAllLabel={t('passport.a11y.seeAll.set', { total: medal.total, name: medal.name })}
            collected={medal.collected}
            total={medal.total}
            stamps={set}
            awardedAt={awardedAt}
            stampSize={stampSize}
            onStripWidth={() => undefined}
            onSelectStamp={onSelectStamp}
          />
          {medal.locked && onUnlock !== undefined ? (
            <Pressable
              accessibilityRole="button"
              onPress={onUnlock}
              style={({ pressed }) => [styles.unlock, pressed && styles.pressed]}
            >
              <Text style={styles.unlockText}>{t('stampNews.unlock')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>{t('stampNews.close')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  panel: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.xl,
    maxHeight: '75%',
    backgroundColor: album.background,
    borderRadius: radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: album.hairline,
  },
  content: { paddingVertical: spacing.md },
  unlock: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    minHeight: MIN_TAP_TARGET,
    borderRadius: radius.control,
    backgroundColor: album.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockText: { color: album.actionText, fontSize: fontSize.body, fontWeight: '700' },
  close: { minHeight: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  closeText: { color: album.tint, fontSize: fontSize.body },
  pressed: { opacity: 0.6 },
});

/**
 * The pop-up for a stamp earned since the map was last on screen (D-096).
 *
 * On the passport's dark page (`album`), because the stamps' colours are drawn
 * and measured against it (`contrast.test.ts`): on the light map they would be
 * judged against a ground nobody checked.
 *
 * A locked stamp (the free tier) is named and drawn muted, with the sentence
 * that says why; the artwork is what is withheld, never the visit.
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { designFor } from '../passport/stampArt';
import type { StampPopup } from '../progress/stampAnnouncer';
import StampArt from './StampArt';
import { postmarkFor } from './postmark';
import { album, colors, fontSize, MIN_TAP_TARGET, radius, spacing } from './theme';

const STAMP_SIZE = 180;

export default function StampNewsCard({
  stamp,
  onClose,
  onOpenPassport,
}: {
  stamp: StampPopup;
  onClose: () => void;
  onOpenPassport: () => void;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.heading} accessibilityRole="header">
            {t('stampNews.heading')}
          </Text>
          <View style={styles.stamp}>
            <StampArt
              placeId={`news-${stamp.placeId}`}
              design={designFor(stamp.placeId, stamp.category)}
              name={stamp.name}
              collected={!stamp.locked}
              postmark={stamp.locked ? null : postmarkFor(stamp.awardedTs)}
              size={STAMP_SIZE}
            />
          </View>
          <Text style={styles.name}>{stamp.name}</Text>
          {stamp.locked ? <Text style={styles.note}>{t('stampNews.locked')}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={onOpenPassport}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{t('stampNews.passport')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{t('stampNews.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: album.background,
    borderRadius: radius.sheet,
    padding: spacing.lg,
    alignItems: 'center',
  },
  heading: {
    color: album.textMuted,
    fontSize: fontSize.label,
    fontWeight: '600',
  },
  stamp: {
    marginVertical: spacing.md,
  },
  name: {
    color: album.text,
    fontSize: fontSize.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  note: {
    color: album.textMuted,
    fontSize: fontSize.label,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  primary: {
    alignSelf: 'stretch',
    minHeight: MIN_TAP_TARGET,
    marginTop: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: album.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: album.actionText,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  secondary: {
    alignSelf: 'stretch',
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: album.tint,
    fontSize: fontSize.body,
  },
  pressed: {
    opacity: 0.7,
  },
});

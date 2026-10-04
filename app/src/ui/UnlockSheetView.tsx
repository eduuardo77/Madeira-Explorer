/**
 * How the unlock sheet looks (T-156d). Props in, pixels out: no store, no
 * database, so the workbench draws it in every state (`App.web.tsx`).
 * `UnlockSheet` holds the state and wraps this in a modal.
 *
 * On the passport's dark page (`album`), like `StampNewsCard`, because the
 * stamp it shows is drawn and measured against that ground.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { UnlockSheetModel } from '../entitlement/unlockSheet';
import { designFor } from '../passport/stampArt';
import type { PassportStamp } from './PassportView';
import StampArt from './StampArt';
import { album, fontSize, MIN_TAP_TARGET, radius, spacing } from './theme';

const STAMP_SIZE = 140;

export default function UnlockSheetView({
  model,
  stamp,
  unlocked,
  working,
  onBuy,
  onRestore,
  onClose,
}: {
  model: UnlockSheetModel;
  /** The locked stamp that was tapped, or null when opened from Settings. */
  stamp: PassportStamp | null;
  /** Drawn in full once paid for. */
  unlocked: boolean;
  /** Google is busy: Restore waits too. */
  working: boolean;
  onBuy: () => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.card} accessibilityViewIsModal>
      <Text style={styles.title} accessibilityRole="header">
        {model.title}
      </Text>
      {stamp === null ? null : (
        <View style={styles.stamp}>
          <StampArt
            placeId={`unlock-${stamp.placeId}`}
            design={designFor(stamp.placeId, stamp.category)}
            name={stamp.name}
            collected={unlocked}
            postmark={null}
            size={STAMP_SIZE}
          />
        </View>
      )}
      <Text style={styles.earned}>{model.earned}</Text>
      <View style={styles.adds}>
        {model.adds.map((line) => (
          <Text key={line} style={styles.add}>
            {line}
          </Text>
        ))}
      </View>
      {model.notice === null ? null : (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {model.notice}
        </Text>
      )}
      {model.buy === null ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !model.buy.enabled }}
          disabled={!model.buy.enabled}
          onPress={onBuy}
          style={({ pressed }) => [
            styles.primary,
            !model.buy?.enabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryText}>{model.buy.label}</Text>
        </Pressable>
      )}
      {model.restore === null ? null : (
        <Pressable
          accessibilityRole="button"
          disabled={working}
          onPress={onRestore}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>{model.restore}</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryText}>{model.close}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: album.background,
    borderRadius: radius.sheet,
    padding: spacing.lg,
    alignItems: 'center',
  },
  title: {
    color: album.text,
    fontSize: fontSize.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  stamp: {
    marginVertical: spacing.md,
  },
  earned: {
    color: album.text,
    fontSize: fontSize.body,
    textAlign: 'center',
  },
  adds: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
  add: {
    color: album.textMuted,
    fontSize: fontSize.label,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  notice: {
    color: album.text,
    fontSize: fontSize.label,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  primary: {
    alignSelf: 'stretch',
    minHeight: MIN_TAP_TARGET,
    marginTop: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: album.action,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryText: {
    color: album.actionText,
    fontSize: fontSize.body,
    fontWeight: '600',
    textAlign: 'center',
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
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
});

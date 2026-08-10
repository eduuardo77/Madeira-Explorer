/**
 * Settings (T-141), and the erase control that lives at the bottom of it
 * (T-125).
 *
 * THE DISCIPLINE IS ORDERING AND EXPLANATION, NOT DELETION
 * -------------------------------------------------------
 * `docs/design-brief.md` §5 is explicit that this screen will not stay small —
 * the docs already require more than a couple of items — and that the way to
 * let it grow without becoming hostile is two patterns, both copied
 * deliberately from the reference app:
 *
 *   1. **Every section gets a header and a plain-English footnote** saying what
 *      it does and what it costs.
 *   2. **The destructive action goes last, in its own section, in red, with an
 *      icon.** Findable, not fat-fingerable.
 *
 * ERASING IS PERMANENT AND THE COPY HAS TO SAY SO
 * -----------------------------------------------
 * There is no cloud, no account and no restore (D-001) — the very properties
 * that make this app private are the ones that make deletion final. Somebody
 * who taps it expecting the usual safety net of a sync service would lose
 * their whole holiday. So the copy states the consequence plainly, in the
 * user's words rather than a developer's, and a second confirmation is
 * required (T-125).
 *
 * Presentational: props in, pixels out, so the workbench can mount it (D-038).
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PermissionLevel } from '../recording/LocationProvider';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

export type SettingsViewProps = {
  permission: PermissionLevel;
  /** Light for use, dark for the souvenir (D-026). */
  mapStyle: 'light' | 'dark';
  /** Bytes on disk, or null while unknown. */
  mapPackBytes: number | null;
  onChangeMapStyle: (style: 'light' | 'dark') => void;
  onOpenSystemSettings: () => void;
  onOpenPrivacyPolicy: () => void;
  onOpenDebug: () => void;
  /** Opens the confirmation. Must never erase on its own (T-125). */
  onEraseRequested: () => void;
  onClose: () => void;
};

function Section({
  title,
  footnote,
  destructive,
  children,
}: {
  title: string;
  footnote: string;
  destructive?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.section, destructive === true && styles.sectionDanger]}>
      <Text style={[styles.sectionTitle, destructive === true && styles.dangerText]}>
        {title}
      </Text>
      {children}
      {/* The footnote, not a tooltip. §5: this is what lets the screen grow. */}
      <Text style={styles.footnote}>{footnote}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Action({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        danger === true && styles.actionDanger,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.actionText, danger === true && styles.dangerText]}>
        {danger === true ? '⚠  ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

/** Permission, in the user's words rather than the platform's. */
function describePermission(permission: PermissionLevel): string {
  switch (permission) {
    case 'always':
      return 'Fills in by itself';
    case 'while_using':
      return 'Only while the app is open';
    case 'denied':
      return 'Off';
    case 'undetermined':
      return 'Not set up yet';
  }
}

export default function SettingsView({
  permission,
  mapStyle,
  mapPackBytes,
  onChangeMapStyle,
  onOpenSystemSettings,
  onOpenPrivacyPolicy,
  onOpenDebug,
  onEraseRequested,
  onClose,
}: SettingsViewProps) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Settings</Text>

        <Section
          title="Recording"
          footnote={
            permission === 'always'
              ? 'Your map fills in on its own, even when the app is closed.'
              : 'Your map only fills in while the app is open. You can change this on your phone’s settings screen.'
          }
        >
          <Row label="Recording your trip" value={describePermission(permission)} />
          <Action label="Open phone settings" onPress={onOpenSystemSettings} />
        </Section>

        <Section
          title="Appearance"
          footnote="Light is easier to read outdoors. Dark is what your end-of-trip video uses, whichever you pick here."
        >
          {/* Two labelled buttons rather than a switch: a switch needs the
              user to know which state is which, and D-015 forbids meaning
              carried by anything but words. */}
          <View style={styles.choiceRow}>
            {(['light', 'dark'] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Use the ${option} map`}
                onPress={() => onChangeMapStyle(option)}
                style={({ pressed }) => [
                  styles.choice,
                  mapStyle === option && styles.choiceActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    mapStyle === option && styles.choiceTextActive,
                  ]}
                >
                  {option === 'light' ? 'Light' : 'Dark'}
                  {mapStyle === option ? '  ✓' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section
          title="Map"
          footnote="The whole island is already on your phone, so the map works with no signal and uses no data."
        >
          <Row
            label="Map of Madeira"
            value={
              mapPackBytes === null
                ? 'Ready'
                : `Ready · ${(mapPackBytes / 1_000_000).toFixed(0)} MB`
            }
          />
        </Section>

        <Section
          title="About"
          footnote="Nothing you record leaves this phone. There is no account and no server."
        >
          <Action label="Privacy" onPress={onOpenPrivacyPolicy} />
          <Action label="Technical details" onPress={onOpenDebug} />
        </Section>

        {/* Last, its own section, red, with an icon. §5, T-125. */}
        <Section
          title="Erase"
          destructive
          footnote="This cannot be undone. There is no backup and no account to restore from — everything you recorded is only on this phone."
        >
          <Action
            label="Erase everything I have recorded"
            onPress={onEraseRequested}
            danger
          />
        </Section>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to the map"
          onPress={onClose}
          style={({ pressed }) => [styles.done, pressed && styles.pressed]}
        >
          <Text style={styles.doneText}>Done</Text>
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
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionDanger: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.bad,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dangerText: { color: colors.bad },
  footnote: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
    minHeight: spacing.xl,
  },
  rowLabel: { color: colors.text, fontSize: fontSize.body, flexShrink: 1 },
  rowValue: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  action: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionDanger: { borderColor: colors.bad, borderWidth: 2 },
  actionText: { color: colors.text, fontSize: fontSize.body, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceActive: { borderColor: colors.action, borderWidth: 2 },
  choiceText: { color: colors.textMuted, fontSize: fontSize.body, fontWeight: '700' },
  choiceTextActive: { color: colors.text },
  pressed: { opacity: 0.75 },
  footer: { padding: spacing.md },
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

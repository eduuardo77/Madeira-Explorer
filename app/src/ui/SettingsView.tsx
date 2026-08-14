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
import { colors, fontSize, MIN_TAP_TARGET, radius, spacing } from './theme';

export type SettingsViewProps = {
  permission: PermissionLevel;
  /** Light for use, dark for the souvenir (D-026). */
  mapStyle: 'light' | 'dark';
  onChangeMapStyle: (style: 'light' | 'dark') => void;
  onOpenSystemSettings: () => void;
  /**
   * Android only, and absent on iOS (T-046). Deliberately paired with no
   * state: the app cannot read whether it is currently exempt, and showing a
   * value it cannot know would be an invented fact — see
   * `recording/batteryOptimisation.ts`.
   */
  onOpenBatterySettings: (() => void) | null;
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
    // iOS grouped-inset list (D-054): the heading sits **above** the card and
    // the footnote **below** it, both in the page's margin. The card holds
    // only the controls. It matches the passport, which is the point — two
    // screens laid out by two different rules is what "generic" looks like.
    <View style={styles.group}>
      <Text style={[styles.sectionTitle, destructive === true && styles.dangerText]}>
        {title}
      </Text>
      {children === undefined ? null : (
        <View style={[styles.section, destructive === true && styles.sectionDanger]}>
          {children}
        </View>
      )}
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
  onChangeMapStyle,
  onOpenSystemSettings,
  onOpenBatterySettings,
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

        {/* Android only. The label says what it achieves, not what Android
            calls it — "battery optimisation" is the phone's word for it, and
            the footnote uses that word so the screen it opens is recognisable
            when the user gets there. */}
        {onOpenBatterySettings !== null ? (
          <Section
            title="If recording keeps stopping"
            footnote="Some phones pause apps to save battery, which can stop your map filling in. This opens your phone’s battery settings, where you can let this app keep running. Look for Madeira Explorer in the list."
          >
            <Action
              label="Let this app keep running"
              onPress={onOpenBatterySettings}
            />
          </Section>
        ) : null}

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

        {/* ⚠ This section said the opposite until 2026-08-14: *the whole island
            is already on your phone, so the map works with no signal and uses
            no data*. That was true of the offline pack and became false the
            day the app switched to Google's map (D-057), which streams. It is
            the kind of stale reassurance that is worse than no reassurance,
            because the user finds out in a laurel forest with no signal.

            The row that reported the pack's size went with it. It was already
            dead — the caller had been passing `null` — and it implied the map
            on screen was the one on the phone.

            What replaces it is the distinction that actually matters: the map
            needs a connection, and the recording does not. If the MapLibre
            path ever ships again (`map/MapLibreScreen.tsx` is kept), this is
            one of the places that has to change back. */}
        <Section
          title="Map"
          footnote="The map is Google's and needs a connection to draw. Your trip is recorded either way — losing signal on a levada costs you the map, never the walk."
        />

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
    // The Done button is pinned below this list, and a scroll that ends level
    // with it hides its last row behind it.
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  heading: {
    color: colors.text,
    // The same large title as the passport. Two screens, one rule.
    fontSize: fontSize.largeTitle,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  group: {
    gap: spacing.sm,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
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
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.xs,
  },
  dangerText: { color: colors.bad },
  footnote: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.4,
    paddingHorizontal: spacing.xs,
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
    borderRadius: radius.control,
    // Filled rather than outlined: on iOS a row inside a group is a surface,
    // not a box drawn on one. The 60 dp target is the height (D-015).
    backgroundColor: colors.surfaceRaised,
  },
  actionDanger: { borderWidth: 2, borderColor: colors.bad },
  actionText: { color: colors.text, fontSize: fontSize.body, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.surfaceRaised,
  },
  // ⚠ The tick in the label carries the state as well — D-015 forbids hue
  // alone, and a "selected" that is only a border colour is exactly that.
  choiceActive: { borderWidth: 2, borderColor: colors.action },
  choiceText: { color: colors.textMuted, fontSize: fontSize.body, fontWeight: '700' },
  choiceTextActive: { color: colors.text },
  pressed: { opacity: 0.75 },
  footer: { padding: spacing.md },
  done: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.action,
  },
  doneText: {
    color: colors.actionText,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});

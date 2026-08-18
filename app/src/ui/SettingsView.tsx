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

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { APP_NAME } from '../brand';
import { t } from '../i18n';
import type { PermissionLevel } from '../recording/LocationProvider';
import type { TrackingQuality } from '../recording/trackingPreference';
import { colors, fontSize, MIN_TAP_TARGET, radius, spacing } from './theme';

export type SettingsViewProps = {
  permission: PermissionLevel;
  /** Light for use, dark for the souvenir (D-026). */
  mapStyle: 'light' | 'dark';
  /** May the app record while it is closed (T-146)? */
  backgroundTracking: boolean;
  onChangeBackgroundTracking: (allowed: boolean) => void;
  /** How closely, when it may. Only shown when the switch above is on. */
  trackingQuality: TrackingQuality;
  onChangeTrackingQuality: (quality: TrackingQuality) => void;
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
  /**
   * Send one walk back so the thresholds can stop being guesses (OD-11, D-069).
   *
   * ⚠ Optional, and absent is a legitimate state — the workbench mounts this
   * screen with no database behind it.
   */
  onDonateWalk?: () => void;
  /** True while the file is being built, so the row can say so. */
  donating?: boolean;
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

/**
 * A labelled switch (T-146).
 *
 * A real `Switch` rather than two buttons, because a switch is *the* iOS
 * settings control and this screen follows iOS conventions (D-054). D-015 is
 * satisfied by the row's own words: the state is never carried by the switch's
 * colour alone — the section footnote below it changes with the state and says
 * in a sentence what is currently true.
 */
function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled === true && styles.rowDisabled]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        // Explicit colours: the platform default is a green that belongs to no
        // other part of this interface.
        trackColor={{ false: colors.surfaceRaised, true: colors.action }}
        thumbColor={colors.actionText}
      />
    </View>
  );
}

/**
 * One of several exclusive choices, with room to say what it means (T-146).
 *
 * ⚠ The description is not decoration. These three options differ in a way the
 * user cannot see and the app is not allowed to price — see
 * `trackingPreference.ts` on why there are no percentages here — so the
 * sentence under each label is the entire basis for choosing. A row of bare
 * words would be three synonyms for "tracking".
 */
function Choice({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stackedChoice,
        selected && styles.stackedChoiceActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.stackedChoiceHeader}>
        <Text
          style={[
            styles.stackedChoiceLabel,
            selected && styles.stackedChoiceLabelActive,
          ]}
        >
          {label}
        </Text>
        {/* The tick, not just a border — D-015 forbids state carried by hue. */}
        {selected ? <Text style={styles.stackedChoiceTick}>✓</Text> : null}
      </View>
      <Text style={styles.stackedChoiceDescription}>{description}</Text>
    </Pressable>
  );
}

/** Permission, in the user's words rather than the platform's. */
function describePermission(permission: PermissionLevel): string {
  switch (permission) {
    case 'always':
      return t('settings.permission.always');
    case 'while_using':
      return t('settings.permission.whenInUse');
    case 'denied':
      return 'Off';
    case 'undetermined':
      return t('settings.permission.none');
  }
}

export default function SettingsView({
  permission,
  mapStyle,
  backgroundTracking,
  onChangeBackgroundTracking,
  trackingQuality,
  onChangeTrackingQuality,
  onChangeMapStyle,
  onOpenSystemSettings,
  onOpenBatterySettings,
  onOpenPrivacyPolicy,
  onOpenDebug,
  onEraseRequested,
  onDonateWalk,
  donating,
  onClose,
}: SettingsViewProps) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('settings.title')}</Text>

        <Section
          title={t('settings.section.recording')}
          footnote={
            permission === 'always'
              ? t('settings.recording.footnote')
              : t('settings.recording.footnoteLimited')
          }
        >
          <Row label={t('settings.recording.title')} value={describePermission(permission)} />
          <Action label={t('settings.openPhoneSettings')} onPress={onOpenSystemSettings} />
        </Section>

        {/* Android only. The label says what it achieves, not what Android
            calls it — "battery optimisation" is the phone's word for it, and
            the footnote uses that word so the screen it opens is recognisable
            when the user gets there. */}
        {onOpenBatterySettings !== null ? (
          <Section
            title={t('settings.section.stopping')}
            footnote={t('settings.keepRunning.footnote', { app: APP_NAME })}
          >
            <Action
              label={t('settings.keepRunning')}
              onPress={onOpenBatterySettings}
            />
          </Section>
        ) : null}

        {/* Between "Recording" (what the phone allows) and everything else:
            this is the user's own answer, and it only means anything once they
            have read what the phone has granted. */}
        <Section
          title={t('settings.section.background')}
          footnote={
            permission !== 'always'
              ? t('settings.background.blocked')
              : backgroundTracking
                ? t('settings.background.on')
                : t('settings.background.off')
          }
        >
          <Toggle
            label={t('settings.background.toggle')}
            value={backgroundTracking && permission === 'always'}
            onChange={onChangeBackgroundTracking}
            // ⚠ Disabled rather than hidden when the permission is missing. A
            // control that vanishes leaves the user hunting for a setting they
            // remember seeing; one that is visible and explained tells them
            // where the real gate is — which is the phone, not this screen.
            disabled={permission !== 'always'}
          />
        </Section>

        {backgroundTracking && permission === 'always' ? (
          <Section
            title={t('settings.section.quality')}
            footnote={t('settings.quality.footnote')}
          >
            <Choice
              label={t('settings.quality.saver')}
              description="Asks least often, and lets your phone rest when you are still. Your places still fill in; the line on your map will be rougher."
              selected={trackingQuality === 'saver'}
              onPress={() => onChangeTrackingQuality('saver')}
            />
            <Choice
              label={t('settings.quality.balanced')}
              description="The usual choice. Enough detail to recognise the walk you did, without following every step."
              selected={trackingQuality === 'balanced'}
              onPress={() => onChangeTrackingQuality('balanced')}
            />
            <Choice
              label={t('settings.quality.best')}
              description="Asks most often and keeps going even when you stop, so a long lunch is not a gap in the line. Uses the most battery, by some way."
              selected={trackingQuality === 'precise'}
              onPress={() => onChangeTrackingQuality('precise')}
            />
          </Section>
        ) : null}

        <Section
          title={t('settings.section.appearance')}
          footnote={t('settings.appearance.footnote')}
        >
          {/* Two labelled buttons rather than a switch: a switch needs the
              user to know which state is which, and D-015 forbids meaning
              carried by anything but words. */}
          <View style={styles.choiceRow}>
            {(['light', 'dark'] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={
                  option === 'dark'
                    ? t('settings.a11y.useDarkMap')
                    : t('settings.a11y.useLightMap')
                }
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
                  {option === 'light' ? t('settings.appearance.light') : t('settings.appearance.dark')}
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
          title={t('settings.section.map')}
          footnote={t('settings.map.footnote')}
        />

        <Section
          title={t('settings.section.about')}
          footnote={t('settings.about.footnote')}
        >
          <Action label={t('settings.about.privacy')} onPress={onOpenPrivacyPolicy} />
          <Action label={t('settings.about.technical')} onPress={onOpenDebug} />
        </Section>

        {/* A rare action, so it lives where rare lives (design brief §3.2) —
            not on the passport beside the reward (OD-11, D-069). */}
        {onDonateWalk === undefined ? null : (
          <Section
            title={t('settings.section.help')}
            footnote={
              t('settings.help.footnote')
            }
          >
            <Action
              label={donating === true ? t('settings.help.preparing') : t('settings.help.send')}
              onPress={onDonateWalk}
            />
          </Section>
        )}

        {/* Last, its own section, red, with an icon. §5, T-125. */}
        <Section
          title={t('settings.section.erase')}
          destructive
          footnote={t('settings.erase.footnote')}
        >
          <Action
            label={t('settings.erase.action')}
            onPress={onEraseRequested}
            danger
          />
        </Section>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.a11y.backToMap')}
          onPress={onClose}
          style={({ pressed }) => [styles.done, pressed && styles.pressed]}
        >
          <Text style={styles.doneText}>{t('settings.done')}</Text>
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
  rowDisabled: { opacity: 0.5 },
  stackedChoice: {
    borderRadius: radius.control,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.xs,
    // Transparent rather than absent, so selecting a row cannot shift the rows
    // around it by two pixels.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stackedChoiceActive: { borderColor: colors.action },
  stackedChoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stackedChoiceLabel: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  stackedChoiceLabelActive: { color: colors.text },
  stackedChoiceTick: {
    color: colors.action,
    fontSize: fontSize.small,
    fontWeight: '700',
  },
  stackedChoiceDescription: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    lineHeight: Math.round(fontSize.small * 1.4),
  },
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

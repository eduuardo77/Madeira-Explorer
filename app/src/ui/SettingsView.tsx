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
import { MAP_STYLE_CHOICE_ENABLED } from '../map/mapStylePreference';
import type { StringKey } from '../i18n/strings';
import {
  TRACKING_QUALITIES,
  type TrackingQuality,
} from '../recording/trackingPreference';
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
 * What each tier is called and what it promises.
 *
 * A `Record` keyed by the type, so adding a tier to `trackingPreference.ts`
 * fails the build here rather than rendering a blank segment. The **order** is
 * not repeated — it comes from `TRACKING_QUALITIES`, which owns it — because a
 * second copy of an order is a second thing to get out of step.
 *
 * ⚠ Three keys per tier, and they are not interchangeable. The segment is too
 * narrow for the full name in Portuguese or German, so it wears `short`; the
 * screen reader gets `full`, which is the real name; `detail` is the sentence
 * below the control and the only place the difference is actually explained.
 */
const QUALITY_TEXT: Record<
  TrackingQuality,
  { short: StringKey; full: StringKey; detail: StringKey }
> = {
  saver: {
    short: 'settings.quality.short.saver',
    full: 'settings.quality.saver',
    detail: 'settings.quality.detail.saver',
  },
  balanced: {
    short: 'settings.quality.short.balanced',
    full: 'settings.quality.balanced',
    detail: 'settings.quality.detail.balanced',
  },
  precise: {
    short: 'settings.quality.short.best',
    full: 'settings.quality.best',
    detail: 'settings.quality.detail.best',
  },
};

/**
 * The three tiers as one pill, three segments wide (2026-08-28).
 *
 * ⚠ **This replaced three stacked cards on the project lead's instruction.**
 * The reference app they pointed at puts this same choice in a segmented
 * control with a single sentence underneath. Three full-width cards, each
 * carrying its own paragraph, had made the most ordinary setting in the app the
 * tallest thing on the screen — the user had to read three paragraphs to make
 * one choice.
 *
 * ⚠ **D-015 is still satisfied, and not by the fill.** The selected segment is
 * tinted, but what actually carries the state is the sentence directly below,
 * which names the chosen tier and says what it does. That is the same argument
 * `Toggle` makes above, and it is the reason the descriptions moved *out* of
 * the segments rather than being deleted with them.
 *
 * ⚠ `numberOfLines={1}` is deliberate. A segment that wraps to two lines makes
 * the pill taller than its neighbours and the row stops reading as one control;
 * `short` exists precisely so nothing has to wrap.
 */
function Segmented({
  value,
  onChange,
}: {
  value: TrackingQuality;
  onChange: (next: TrackingQuality) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {TRACKING_QUALITIES.map((quality) => {
        const selected = quality === value;
        return (
          <Pressable
            key={quality}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(QUALITY_TEXT[quality].full)}
            onPress={() => onChange(quality)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.segmentText, selected && styles.segmentTextActive]}
            >
              {t(QUALITY_TEXT[quality].short)}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
  // Both halves of one decision. The switch means nothing until the phone
  // has granted Always, and the tier means nothing until the switch is on —
  // so the screen asks the question once and every branch below reads it.
  const recordingInBackground = backgroundTracking && permission === 'always';

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

        {/* ⚠ ONE CARD, NOT TWO (2026-08-28, the project lead's instruction).
            "May the app record?" and "how closely?" were separate sections, and
            the second appeared out of nowhere when you flipped the first —
            which reads as a glitch rather than a reveal. In the reference app
            they point at, consent and cost sit in one card because the second
            is meaningless without the first. `trackingPreference.ts` still
            keeps them as two independent stored values; only the presentation
            is joined. */}
        <Section
          title={t('settings.section.background')}
          footnote={
            permission !== 'always'
              ? t('settings.background.blocked')
              : recordingInBackground
                ? t('settings.quality.footnote')
                : t('settings.background.off')
          }
        >
          <Toggle
            label={t('settings.background.toggle')}
            value={recordingInBackground}
            onChange={onChangeBackgroundTracking}
            // ⚠ Disabled rather than hidden when the permission is missing. A
            // control that vanishes leaves the user hunting for a setting they
            // remember seeing; one that is visible and explained tells them
            // where the real gate is — which is the phone, not this screen.
            disabled={permission !== 'always'}
          />
          {recordingInBackground ? (
            <>
              <View style={styles.divider} />
              <Segmented
                value={trackingQuality}
                onChange={onChangeTrackingQuality}
              />
              {/* The state, in words. Not decoration — see `Segmented`. */}
              <Text style={styles.segmentDetail}>
                {t(QUALITY_TEXT[trackingQuality].detail)}
              </Text>
            </>
          ) : null}
        </Section>

        {/* ⚠ HIDDEN, NOT DELETED (2026-08-28). The project lead asked for one
            theme, always light, until the app has earned a second one. Light was
            already the default and the style tuned for Madeiran sunlight (D-026),
            so nothing a new user sees changes.
            ⚠ The dark map is NOT dead: the souvenir renders dark whatever this
            says. Only the *choice* is off, and `MAP_STYLE_CHOICE_ENABLED` in
            `map/mapStylePreference.ts` is the one line that brings it back with
            every stored preference intact. */}
        {MAP_STYLE_CHOICE_ENABLED ? (
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

        ) : null}

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
  // A hairline between the consent switch and the cost dial. They are one card
  // now (see the section above) but they are still two questions, and without
  // a rule between them the pill reads as part of the switch's row.
  divider: { height: 1, backgroundColor: colors.surfaceRaised },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.control,
    // The trough. Each segment paints over it when selected, so `overflow`
    // is what keeps the tint inside the rounded ends.
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  segment: {
    // Equal thirds regardless of how long the word is in this language.
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  segmentActive: { backgroundColor: colors.action },
  segmentText: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '700',
    textAlign: 'center',
  },
  // ⚠ `actionText` on `action` is the pair `contrast.test.ts` already proves
  // readable — the same one the primary button uses. Do not hand-pick a colour
  // here; the test only covers the pairs the theme declares.
  segmentTextActive: { color: colors.actionText },
  segmentDetail: {
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

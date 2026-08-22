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
 * ⚠⚠ **IT IS LIGHT, AND EVERY OTHER SCREEN IN THIS APP IS DARK** (2026-08-22,
 * D-080). The project lead asked for it with the app in their hand — *"I prefer
 * light colour settings"* — after sending five screenshots of the reference
 * app's own settings screen. The palette is `settingsLight` in `theme.ts`,
 * which exists rather than reusing `colors` because the dark palette's blue is
 * **2.6:1 on white**: reuse here would have shipped an unreadable action row.
 *
 * ⚠ **The light/dark map choice is hidden, not deleted** — same instruction,
 * *"lets hide the light / dark toggle for now"*. The preference, its storage,
 * both map styles and every test around them are untouched; one block of JSX is
 * commented out and the props are still wired, so bringing it back is deleting
 * a comment. **Do not "clean up" the unused props.**
 *
 * WHAT WAS TAKEN FROM THE REFERENCE APP, AND WHAT WAS NOT
 * -------------------------------------------------------
 * Taken: the light grouped list, the **one card per idea** with its footnote
 * underneath, a **segmented control** for the three tracking qualities instead
 * of three stacked cards, and an icon on the rows that carry weight.
 * Not taken: its blues and reds — iOS system blue is 4.02:1 on white and system
 * red 3.55:1, both under this project's 5:1 floor for text read in Madeiran sun
 * (D-015). The hues here are the same idea carried down until they pass.
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
import { fontSize, MIN_TAP_TARGET, radius, settingsLight, spacing } from './theme';
import { PinMark, TrashMark } from './SettingsGlyphs';

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

/** The row icons. Big enough to read, small enough not to become the row. */
const ROW_ICON_SIZE = 22;

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
  icon,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  /** Drawn beside the words, never instead of them (D-015). */
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      {icon === undefined ? null : <View style={styles.actionIcon}>{icon}</View>}
      {/* ⚠ The `⚠  ` that used to be glued to the front of a destructive label
          is gone: it was read out by the screen reader as the word "warning"
          in English regardless of the user's language, and the row already
          says *Erase everything* in red beside a bin. */}
      <Text style={[styles.actionText, danger === true && styles.dangerText]}>
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
  icon,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <View style={[styles.row, disabled === true && styles.rowDisabled]}>
      {icon === undefined ? null : <View style={styles.actionIcon}>{icon}</View>}
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        // Explicit colours: the platform default is a green that belongs to no
        // other part of this interface.
        trackColor={{ false: settingsLight.border, true: settingsLight.action }}
        thumbColor={settingsLight.surface}
      />
    </View>
  );
}

/**
 * The three tracking qualities, as one segmented control (T-168).
 *
 * ⚠ **THIS REPLACED THREE STACKED CARDS, AND THE EXPLANATION DID NOT GO WITH
 * THEM.** The old design gave each option a paragraph inside its own card,
 * because these three differ in a way the user cannot see and the app is not
 * allowed to price (`trackingPreference.ts` on why there are no percentages
 * here, D-041 on why there is no battery number). The reference app's
 * segmented control is what the project lead asked for — so the paragraph
 * moved to the **section footnote**, which now changes with the selection.
 * Nothing was deleted; the sentence that justifies the choice is still on
 * screen, once, under the control.
 *
 * ⚠ **The labels wrap rather than clip.** In the reference app's own
 * screenshot *"Battery Saver"* is cut off mid-word. German is worse
 * (*Höchste Genauigkeit*), and CONTEXT §6.5's reader has the system font scaled
 * up. Each segment is `flex: 1` with the label allowed two lines, so the row
 * grows instead of truncating — the same rule as D-041's onboarding buttons.
 */
function Segmented({
  options,
}: {
  options: { key: string; label: string; selected: boolean; onPress: () => void }[];
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable
          key={option.key}
          accessibilityRole="radio"
          accessibilityState={{ selected: option.selected }}
          accessibilityLabel={option.label}
          onPress={option.onPress}
          style={({ pressed }) => [
            styles.segment,
            option.selected && styles.segmentSelected,
            pressed && styles.pressed,
          ]}
        >
          <Text
            numberOfLines={2}
            style={[
              styles.segmentText,
              option.selected && styles.segmentTextSelected,
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The sentence under the tracking card — the selected quality's own (T-168).
 *
 * ⚠ This is where the three paragraphs went when the stacked cards became a
 * segmented control. They are not decoration: nothing else on this screen says
 * what the difference between the options *is*, because the app refuses to
 * price it in battery percentage until somebody measures one (D-041).
 */
function qualityFootnote(quality: TrackingQuality): string {
  switch (quality) {
    case 'saver':
      return t('settings.quality.saver.detail');
    case 'balanced':
      return t('settings.quality.balanced.detail');
    case 'precise':
      return t('settings.quality.best.detail');
  }
}

/** Permission, in the user's words rather than the platform's. */
function describePermission(permission: PermissionLevel): string {
  switch (permission) {
    case 'always':
      return t('settings.permission.always');
    case 'while_using':
      return t('settings.permission.whenInUse');
    case 'denied':
      // ⚠ Was the string `'Off'`, in English, for every user of every language
      // — invisible to `i18nCoverage.test.ts`, whose blind spot is text inside
      // `{}`. Same shape as the ten English labels T-166 found.
      return t('settings.permission.denied');
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

        {/* ⚠ ONE CARD, NOT TWO (T-168). The toggle and the three qualities
            used to be separate sections, and separating them was the mistake:
            the qualities only exist *because* the toggle is on, and a section
            that appears out of nowhere when you flip a switch two cards above
            reads as the screen rearranging itself. The reference app puts both
            in one card under one heading, and it is right.

            Between "Recording" (what the phone allows) and everything else:
            this is the user's own answer, and it only means anything once they
            have read what the phone has granted. */}
        <Section
          title={t('settings.section.background')}
          footnote={
            permission !== 'always'
              ? t('settings.background.blocked')
              : !backgroundTracking
                ? t('settings.background.off')
                : // ⚠ The footnote now carries the *selected quality's* own
                  // sentence, which is the whole justification for choosing it
                  // (see `Segmented`). Off, or blocked, and it says that
                  // instead — the state of the card, in one sentence, always.
                  qualityFootnote(trackingQuality)
          }
        >
          <Toggle
            icon={<PinMark size={ROW_ICON_SIZE} color={settingsLight.action} />}
            label={t('settings.background.toggle')}
            value={backgroundTracking && permission === 'always'}
            onChange={onChangeBackgroundTracking}
            // ⚠ Disabled rather than hidden when the permission is missing. A
            // control that vanishes leaves the user hunting for a setting they
            // remember seeing; one that is visible and explained tells them
            // where the real gate is — which is the phone, not this screen.
            disabled={permission !== 'always'}
          />

          {backgroundTracking && permission === 'always' ? (
            <Segmented
              options={[
                {
                  key: 'saver',
                  label: t('settings.quality.saver'),
                  selected: trackingQuality === 'saver',
                  onPress: () => onChangeTrackingQuality('saver'),
                },
                {
                  key: 'balanced',
                  label: t('settings.quality.balanced'),
                  selected: trackingQuality === 'balanced',
                  onPress: () => onChangeTrackingQuality('balanced'),
                },
                {
                  key: 'precise',
                  label: t('settings.quality.best'),
                  selected: trackingQuality === 'precise',
                  onPress: () => onChangeTrackingQuality('precise'),
                },
              ]}
            />
          ) : null}
        </Section>

        {/* ⚠⚠ **THE LIGHT/DARK MAP CHOICE IS HIDDEN, NOT REMOVED** — the
            project lead, 2026-08-22: *"lets hide the light / dark toggle for
            now"*. Everything behind it is intact and still tested: the stored
            preference (`mapStylePreference.ts`), both map styles, Google's own
            night map (T-147) and the souvenir's use of the dark one (D-026).
            `mapStyle` and `onChangeMapStyle` are still props and still wired
            by `SettingsScreen`, so restoring this screen's control is deleting
            a comment — **do not "tidy up" the props on the way past.**

            <Section
              title={t('settings.section.appearance')}
              footnote={t('settings.appearance.footnote')}
            >
              … two labelled buttons, light and dark, with a tick on the
              selected one (D-015: never hue alone) …
            </Section>
        */}

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
            icon={<TrashMark size={ROW_ICON_SIZE} color={settingsLight.danger} />}
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
  // ⚠ Light, alone among this app's screens (D-080). Every colour below comes
  // from `settingsLight`, whose values are measured against **these two
  // surfaces** — the page and a white card — in `contrast.test.ts`. The dark
  // palette's `colors` must not be mixed in here: its blue is 2.6:1 on white.
  root: { flex: 1, backgroundColor: settingsLight.background },
  content: {
    padding: spacing.md,
    paddingTop: spacing.xl * 2,
    // The Done button is pinned below this list, and a scroll that ends level
    // with it hides its last row behind it.
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  heading: {
    color: settingsLight.text,
    // The same large title as the passport. Two screens, one rule.
    fontSize: fontSize.largeTitle,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  group: {
    gap: spacing.sm,
  },
  section: {
    backgroundColor: settingsLight.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    // ⚠ White on `#F2F2F7` is **1.12:1** — the card is legible inside itself
    // and nearly invisible against the page, which is the same problem the map
    // chrome had (`mapChrome` in `theme.ts`). Elevation is what separates them
    // on every platform; an outline here would read as an Android box.
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  // ⚠ The destructive card is not painted red. The reference app's *Danger
  // Zone* is an ordinary card whose **words** are red, and that is also what
  // D-015 asks for: meaning in the word first, the colour second. What makes
  // this row safe is the second confirmation (T-125), not its border.
  sectionDanger: {},
  sectionTitle: {
    color: settingsLight.textMuted,
    fontSize: fontSize.small,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.xs,
  },
  dangerText: { color: settingsLight.danger },
  footnote: {
    color: settingsLight.textMuted,
    fontSize: fontSize.small,
    lineHeight: Math.round(fontSize.small * 1.4),
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TAP_TARGET,
  },
  rowLabel: {
    color: settingsLight.text,
    fontSize: fontSize.body,
    flexShrink: 1,
    // Takes the space the switch does not, so the switch stays hard right and
    // a long German label wraps instead of shoving it off the card.
    flexGrow: 1,
  },
  rowValue: {
    color: settingsLight.textMuted,
    fontSize: fontSize.body,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  action: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // ⚠ No fill. On the dark screen a row was a raised surface because that is
    // how a dark grouped list separates rows; on white the row *is* the card,
    // and a second grey rectangle inside it is the Android box this design
    // spent D-054 removing. The 60 dp target is the height.
    borderRadius: radius.control,
  },
  actionIcon: {
    width: ROW_ICON_SIZE,
    alignItems: 'center',
  },
  // ⚠ Tinted text, iOS's plain button — and the tint is a *darker* blue than
  // Apple's, because system blue is 4.02:1 on white (see the header).
  actionText: {
    color: settingsLight.action,
    fontSize: fontSize.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  rowDisabled: { opacity: 0.5 },

  // ── The segmented control (T-168) ────────────────────────────────────────
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: settingsLight.border,
    // `hidden` so the selected segment's fill is clipped to the pill rather
    // than squaring off its corners.
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    // The divider between segments. Only ever between: the first segment's
    // left edge is the pill's own border.
    borderLeftWidth: 1,
    borderLeftColor: settingsLight.border,
  },
  segmentSelected: { backgroundColor: settingsLight.selected },
  segmentText: {
    color: settingsLight.textMuted,
    fontSize: fontSize.body,
    textAlign: 'center',
  },
  // ⚠ Weight and ink as well as the fill — D-015 forbids state carried by hue
  // alone, and a tinted background is exactly that on its own.
  segmentTextSelected: { color: settingsLight.text, fontWeight: '700' },

  pressed: { opacity: 0.75 },
  footer: {
    padding: spacing.md,
    backgroundColor: settingsLight.background,
  },
  done: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: settingsLight.action,
  },
  doneText: {
    // White on `#0B62CC` measures 5.78:1 — above the floor, unlike white on
    // Apple's own systemBlue, which is why this blue is not that blue.
    color: settingsLight.surface,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});

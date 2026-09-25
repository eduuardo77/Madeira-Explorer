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
 *   2. **The destructive action goes last, in its own section, in red.**
 *      Findable, not fat-fingerable. Its words carry the meaning, so colour is
 *      never the only signal (D-015). ⚠ It also carried a ⚠ emoji until
 *      2026-09-24; the review (N7) read that as a warning sign pasted on rather
 *      than a designed control, and an emoji draws differently on every skin.
 *
 * ONE SCREEN'S WORTH, NOT FOUR (2026-09-25)
 * -----------------------------------------
 * The project lead on the P30: *"the settings take too much space"*, and the
 * page jumped whenever a language was picked. The first screenful held two
 * controls: a large title, a status row that wrapped, each button a grey box in
 * a white card, a whole section for one button, and a Done bar pinned at the
 * foot. Now every control is a plain list row with a chevron (`ListRow`), the
 * location status and its button are one row, the battery row joined
 * *Registo*, and the way back is *‹ Mapa* at the top, as on the passport.
 *
 * ⚠ **Language is first, and one row that opens a list** (`LanguageSheet`).
 * Four radio rows sat under every other section, so choosing one re-wrote all
 * the text above it in another language, and the rows slid out from under the
 * finger: measured on the P30, the IDIOMA heading left the screen for over a
 * second. With nothing above it, nothing can move it.
 *
 * ⚠ **Rows stay 60 dp** (D-015). The project lead finds them tall; that is a
 * decision about D-015 to put to them, not one to take here.
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

import { Children, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { APP_NAME } from '../brand';
import { t } from '../i18n';
import { systemLanguage } from '../i18n/deviceLocale';
import { LANGUAGE_NAMES, LANGUAGES, type Language } from '../i18n/languages';
import type { PermissionLevel } from '../recording/LocationProvider';
import { formatClock } from '../recording/recorderControls';
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
  /** The open-source licences (T-202). Absent hides the row (the workbench). */
  onOpenLicences?: () => void;
  /**
   * The debug screen. **Undefined in every release build** (T-189), which hides
   * the row: `App.tsx` passes it only under `__DEV__`.
   */
  onOpenDebug?: () => void;
  /** Opens the confirmation. Must never erase on its own (T-125). */
  onEraseRequested: () => void;
  /**
   * The language chosen here, or null to follow the phone (T-202). Absent
   * hides the section (the workbench).
   */
  languageChoice?: Language | null;
  onChangeLanguage?: (language: Language | null) => void;
  /** `0.1.0`: the version a support email needs (T-202). Absent hides the row. */
  version?: string;
  /**
   * Opens a mail to the support address (T-202). ⚠ Absent until
   * `privacyPolicy.CONTACT_EMAIL` exists, which waits on the project lead's
   * domain (T-187, D-044): no address, no row, rather than a dead one.
   */
  onContact?: () => void;
  /**
   * Send one walk back so the thresholds can stop being guesses (OD-11, D-069).
   *
   * ⚠ Optional, and absent is a legitimate state — the workbench mounts this
   * screen with no database behind it.
   */
  onDonateWalk?: () => void;
  /** True while the file is being built, so the row can say so. */
  donating?: boolean;
  /**
   * The end of the current pause, or null (D-087 §6). Optional so the workbench
   * can mount the screen with no recorder behind it; absent hides the control.
   */
  pausedUntil?: number | null;
  onPause?: () => void;
  onResume?: () => void;
  onClose: () => void;
};

/**
 * One group of rows (D-054's grouped list): an optional heading above the card,
 * the rows inside it with a hairline between each, and an optional footnote
 * below. The footnote is one or two sentences, never a paragraph.
 */
function Group({
  title,
  footnote,
  destructive,
  children,
}: {
  title?: string;
  footnote?: string;
  destructive?: boolean;
  children: ReactNode;
}) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title === undefined ? null : (
        <Text style={[styles.sectionTitle, destructive === true && styles.dangerText]}>{title}</Text>
      )}
      <View style={styles.section}>
        {rows.map((row, index) => (
          <View key={index}>
            {index === 0 ? null : <View style={styles.divider} />}
            {row}
          </View>
        ))}
      </View>
      {footnote === undefined ? null : <Text style={styles.footnote}>{footnote}</Text>}
    </View>
  );
}

/**
 * A row: a label, an optional value on the right, an optional line of detail
 * under the label, and a chevron when it leads somewhere. Without `onPress` it
 * is information only (the version).
 */
function ListRow({
  label,
  value,
  detail,
  onPress,
  danger,
}: {
  label: string;
  value?: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const body = (
    <>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger === true && styles.dangerText]}>{label}</Text>
        {detail === undefined ? null : <Text style={styles.rowDetail}>{detail}</Text>}
      </View>
      {value === undefined ? null : <Text style={styles.rowValue}>{value}</Text>}
      {onPress === undefined || danger === true ? null : (
        <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      )}
    </>
  );
  if (onPress === undefined) {
    return <View style={styles.row}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value === undefined ? label : `${label}, ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

/**
 * The language list, over the screen (2026-09-25). A sheet rather than rows in
 * the page, so a choice cannot move anything under the finger; it closes on a
 * choice, on *Cancelar*, on the backdrop and on Android's Back.
 *
 * T-202's radio semantics are kept (T-215): each option says whether it is
 * `checked`, and *Automático* says which language it resolves to.
 */
function LanguageSheet({
  choice,
  onChoose,
  onClose,
}: {
  choice: Language | null;
  onChoose: (language: Language | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} visible>
      <Pressable style={styles.scrim} onPress={onClose} accessible={false} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{t('settings.section.language')}</Text>
        <View accessibilityRole="radiogroup">
          {([null, ...LANGUAGES] as (Language | null)[]).map((option) => {
            const selected = option === choice;
            const label =
              option === null
                ? t('settings.language.auto', { language: LANGUAGE_NAMES[systemLanguage()] })
                : LANGUAGE_NAMES[option];
            return (
              <Pressable
                key={option ?? 'auto'}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={label}
                onPress={() => onChoose(option)}
                style={({ pressed }) => [styles.radioRow, pressed && styles.pressed]}
              >
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.tick}>{selected ? '✓' : ''}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.footnote}>{t('settings.language.footnote')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={onClose}
          style={({ pressed }) => [styles.radioRow, styles.sheetCancel, pressed && styles.pressed]}
        >
          <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </Modal>
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
      <Text style={[styles.rowLabel, styles.rowText]}>{label}</Text>
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
 * Two keys per tier: `short` is the word on the segment, and `detail` is the
 * sentence below the control that explains it.
 *
 * ⚠ **The screen reader says the word on the segment, not a longer name**
 * (review N4, 2026-09-24). It used to announce a separate full name, so a
 * segment reading *Preciso* was spoken as *Máximo detalhe*: a user who says
 * what they see to voice control, or a sighted helper beside a TalkBack user,
 * could not match the two (WCAG 2.5.3, label in name). Each segment's hint is
 * its `detail` sentence instead, so a screen-reader user hears what an option
 * does before choosing it, which the full name never told them.
 */
const QUALITY_TEXT: Record<TrackingQuality, { short: StringKey; detail: StringKey }> = {
  saver: {
    short: 'settings.quality.short.saver',
    detail: 'settings.quality.detail.saver',
  },
  balanced: {
    short: 'settings.quality.short.balanced',
    detail: 'settings.quality.detail.balanced',
  },
  precise: {
    short: 'settings.quality.short.best',
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
            accessibilityState={{ checked: selected }}
            accessibilityLabel={t(QUALITY_TEXT[quality].short)}
            accessibilityHint={t(QUALITY_TEXT[quality].detail)}
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
  onOpenLicences,
  onOpenDebug,
  onEraseRequested,
  onDonateWalk,
  donating,
  pausedUntil,
  onPause,
  onResume,
  version,
  onContact,
  languageChoice,
  onChangeLanguage,
  onClose,
}: SettingsViewProps) {
  // Both halves of one decision. The switch means nothing until the phone
  // has granted Always, and the tier means nothing until the switch is on —
  // so the screen asks the question once and every branch below reads it.
  const recordingInBackground = backgroundTracking && permission === 'always';
  const [choosingLanguage, setChoosingLanguage] = useState(false);
  const paused = pausedUntil != null && pausedUntil > Date.now();

  return (
    <View style={styles.root}>
      {/* The way back, where the passport has it (T-211 also wires Back). */}
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.a11y.backToMap')}
          onPress={onClose}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>{`‹ ${t('settings.back')}`}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('settings.title')}</Text>

        {/* First, so choosing one cannot re-flow anything above it. */}
        {languageChoice === undefined || onChangeLanguage === undefined ? null : (
          <Group>
            <ListRow
              label={t('settings.section.language')}
              value={
                languageChoice === null
                  ? t('settings.language.auto', { language: LANGUAGE_NAMES[systemLanguage()] })
                  : LANGUAGE_NAMES[languageChoice]
              }
              onPress={() => setChoosingLanguage(true)}
            />
          </Group>
        )}

        {/* ⚠ ONE CARD (2026-08-28, the project lead's instruction): "may the app
            record" and "how closely" sit together because the second means
            nothing without the first. Since 2026-09-25 the location status and
            the battery row live here too, one row each. */}
        <Group
          // D-087 §1: the background recorder keeps its own name.
          title={t('settings.section.background')}
          // With recording on, the quality's own line says what it costs, so
          // the group needs no second paragraph about battery (2026-09-25).
          footnote={
            permission !== 'always'
              ? t('settings.recording.footnoteLimited')
              : recordingInBackground
                ? undefined
                : t('settings.background.off')
          }
        >
          <ListRow
            label={t('settings.location')}
            value={describePermission(permission)}
            onPress={onOpenSystemSettings}
          />
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
            <View style={styles.quality}>
              <Segmented value={trackingQuality} onChange={onChangeTrackingQuality} />
              {/* The state, in words. Not decoration — see `Segmented`. */}
              <Text style={styles.rowDetail}>{t(QUALITY_TEXT[trackingQuality].detail)}</Text>
            </View>
          ) : null}
          {/* D-087 §6: the pause lives with the thing it pauses. A pause in the
              past is no pause, the same rule the sink applies. */}
          {recordingInBackground && onPause !== undefined && onResume !== undefined ? (
            <ListRow
              label={
                paused
                  ? t('settings.pause.until', { time: formatClock(pausedUntil ?? 0) })
                  : t('settings.pause.hour')
              }
              value={paused ? t('settings.pause.resume') : undefined}
              detail={paused ? undefined : t('settings.pause.footnote')}
              onPress={paused ? onResume : onPause}
            />
          ) : null}
          {/* Android only. The label says what it achieves, not what Android
              calls it; the detail uses the phone's word, so the screen it opens
              is recognisable when the user gets there. */}
          {onOpenBatterySettings === null ? null : (
            <ListRow
              label={t('settings.keepRunning', { app: APP_NAME })}
              detail={t('settings.keepRunning.detail')}
              onPress={onOpenBatterySettings}
            />
          )}
        </Group>

        {/* ⚠ HIDDEN, NOT DELETED (2026-08-28). The project lead asked for one
            theme, always light, until the app has earned a second one. Light was
            already the default and the style tuned for Madeiran sunlight (D-026),
            so nothing a new user sees changes.
            ⚠ The dark map is NOT dead: the souvenir renders dark whatever this
            says. Only the *choice* is off, and `MAP_STYLE_CHOICE_ENABLED` in
            `map/mapStylePreference.ts` is the one line that brings it back with
            every stored preference intact. */}
        {MAP_STYLE_CHOICE_ENABLED ? (
          <Group
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
          </Group>
        ) : null}

                <Group title={t('settings.section.about')} footnote={t('settings.about.footnote')}>
          <ListRow label={t('settings.about.privacy')} onPress={onOpenPrivacyPolicy} />
          {onOpenLicences === undefined ? null : (
            <ListRow label={t('settings.about.licences')} onPress={onOpenLicences} />
          )}
          {onContact === undefined ? null : (
            <ListRow label={t('settings.about.contact')} onPress={onContact} />
          )}
          {/* A rare action, so it lives where rare lives (design brief §3.2),
              not on the passport beside the reward (OD-11, D-069). What it
              sends is spelled out in the confirmation before anything leaves. */}
          {onDonateWalk === undefined ? null : (
            <ListRow
              label={donating === true ? t('settings.help.preparing') : t('settings.help.send')}
              detail={t('settings.help.detail')}
              onPress={onDonateWalk}
            />
          )}
          {version === undefined ? null : (
            <ListRow label={t('settings.about.version')} value={version} />
          )}
          {onOpenDebug === undefined ? null : (
            <ListRow label={t('settings.about.technical')} onPress={onOpenDebug} />
          )}
        </Group>

        {/* Last, its own group, in red. §5, T-125. */}
        <Group title={t('settings.section.erase')} destructive footnote={t('settings.erase.footnote')}>
          <ListRow label={t('settings.erase.action')} onPress={onEraseRequested} danger />
        </Group>
      </ScrollView>

      {choosingLanguage && languageChoice !== undefined && onChangeLanguage !== undefined ? (
        <LanguageSheet
          choice={languageChoice}
          onChoose={(language) => {
            setChoosingLanguage(false);
            onChangeLanguage(language);
          }}
          onClose={() => setChoosingLanguage(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  bar: { paddingTop: spacing.xl, paddingHorizontal: spacing.sm },
  back: { minHeight: MIN_TAP_TARGET, justifyContent: 'center', paddingHorizontal: spacing.sm, alignSelf: 'flex-start' },
  // The passport's back control: tinted text with a chevron, no fill.
  backText: { color: colors.tint, fontSize: fontSize.body, fontWeight: '600' },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heading: {
    color: colors.text,
    // A title, not the large title: this screen is a list, and the large one
    // was a sixth of the first screenful (2026-09-25).
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  group: { gap: spacing.xs },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
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
  // ⚠ Every row is a tap target or sits among them, so every row is 60 dp
  // (D-015). The language options were once 32 dp, measured from source by
  // the review (N4).
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TAP_TARGET,
    paddingVertical: spacing.sm,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: colors.text, fontSize: fontSize.body },
  rowDetail: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    lineHeight: Math.round(fontSize.small * 1.35),
  },
  rowValue: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    textAlign: 'right',
    flexShrink: 1,
  },
  chevron: { color: colors.textMuted, fontSize: fontSize.title, marginLeft: spacing.xs },
  rowDisabled: { opacity: 0.5 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  quality: { paddingVertical: spacing.sm, gap: spacing.sm },
  radioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TAP_TARGET,
  },
  tick: { color: colors.tint, fontSize: fontSize.body, fontWeight: '700' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  sheetTitle: { color: colors.text, fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing.xs },
  sheetCancel: { justifyContent: 'center' },
  sheetCancelText: { color: colors.tint, fontSize: fontSize.body, fontWeight: '600' },
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
});

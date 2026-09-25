/**
 * Settings (T-141), and the erase control that lives at the bottom of it
 * (T-125).
 *
 * THE DISCIPLINE IS ORDERING AND EXPLANATION, NOT DELETION
 * -------------------------------------------------------
 * `docs/design-brief.md` §5 is explicit that this screen will not stay small,
 * and that the way to let it grow without becoming hostile is two patterns,
 * both copied deliberately from the reference app:
 *
 *   1. **Every group gets a heading and a plain-language footnote** saying
 *      what it does and what it costs.
 *   2. **The destructive action goes last, in its own group, in red.**
 *      Findable, not fat-fingerable. Its words carry the meaning, so colour is
 *      never the only signal (D-015).
 *
 * THE SHAPE, AFTER WALKNYC (2026-09-25, three passes in one day)
 * --------------------------------------------------------------
 * 1. *"The settings take too much space"*, and the page jumped when a language
 *    was picked: grey boxes in white cards became list rows, the Done bar
 *    became *‹ Mapa* at the top, and language became the first row, opening a
 *    list, so nothing above it can re-flow under the finger (measured on the
 *    P30: the heading used to leave the screen for over a second).
 * 2. Automatic recording became one row and a list of modes. The project lead:
 *    *"you made them too simple. Now I only see text. Bring back the toggle."*
 * 3. So, looked at on the P30 itself: WalkNYC's *Passive Capture* is a toggle
 *    with a blue pin and a three-way control under it, with one explanation
 *    below; every row starts with a small coloured glyph; actions are blue
 *    words; headings are in sentence case; a quiet line at the foot names the
 *    app. This screen follows that (`SettingsIcon`, `ListRow`'s `tone`), and
 *    keeps pass 1's language list and pass 2's rule that location access
 *    shows only when it needs fixing.
 *
 * 4. The same day: the pause removed (the switch already stops recording), and
 *    the chosen tier's explanation shown under the control, one at a time.
 *
 * ⚠ **Rows stay 60 dp** (D-015); the project lead confirmed the height.
 *
 * ERASING IS PERMANENT AND THE COPY HAS TO SAY SO
 * -----------------------------------------------
 * There is no cloud, no account and no restore (D-001) — the very properties
 * that make this app private are the ones that make deletion final. So the
 * copy states the consequence plainly and a second confirmation is required
 * (T-125).
 *
 * Presentational: props in, pixels out, so the workbench can mount it (D-038).
 */

import { Children, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { APP_NAME } from '../brand';
import { t } from '../i18n';
import { systemLanguage } from '../i18n/deviceLocale';
import { LANGUAGE_NAMES, LANGUAGES, type Language } from '../i18n/languages';
import type { StringKey } from '../i18n/strings';
import { MAP_STYLE_CHOICE_ENABLED } from '../map/mapStylePreference';
import type { PermissionLevel } from '../recording/LocationProvider';
import { TRACKING_QUALITIES, type TrackingQuality } from '../recording/trackingPreference';
import BackBar from './BackBar';
import SettingsIcon, { SETTINGS_ICON_SIZE, type SettingsIconName } from './SettingsIcon';
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
   * hides the row (the workbench).
   */
  languageChoice?: Language | null;
  onChangeLanguage?: (language: Language | null) => void;
  /** `0.1.0`: the version a support email needs (T-202). Absent hides it. */
  version?: string;
  /**
   * Opens a mail to the support address (T-202). ⚠ Absent until
   * `privacyPolicy.CONTACT_EMAIL` exists, which waits on the project lead's
   * domain (T-187, D-044): no address, no row, rather than a dead one.
   */
  onContact?: () => void;
  /**
   * Send one walk back so the thresholds can stop being guesses (OD-11, D-069).
   * ⚠ Optional, and absent is a legitimate state — the workbench mounts this
   * screen with no database behind it.
   */
  onDonateWalk?: () => void;
  /** True while the file is being built, so the row can say so. */
  donating?: boolean;
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
  /** A sentence, or for automatic recording the explanation of each tier. */
  footnote?: ReactNode;
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
      {footnote == null ? null : typeof footnote === 'string' ? (
        <Text style={styles.footnote}>{footnote}</Text>
      ) : (
        footnote
      )}
    </View>
  );
}

/**
 * How a row reads (after WalkNYC):
 * - `link` leads somewhere: dark words and a chevron;
 * - `action` does something here and now: blue words, no chevron;
 * - `danger` destroys: red words, no chevron;
 * - `info` only says something (no `onPress`).
 */
type Tone = 'link' | 'action' | 'danger';

const TONE_INK: Record<Tone, string> = {
  link: colors.text,
  action: colors.tint,
  danger: colors.bad,
};

/** A row: glyph, label, optional detail under it, optional value, chevron. */
function ListRow({
  icon,
  iconColor = colors.tint,
  label,
  value,
  detail,
  tone = 'link',
  onPress,
}: {
  icon?: SettingsIconName;
  iconColor?: string;
  label: string;
  value?: string;
  detail?: string;
  tone?: Tone;
  onPress?: () => void;
}) {
  const body = (
    <>
      {icon === undefined ? null : <SettingsIcon name={icon} color={tone === 'danger' ? colors.bad : iconColor} />}
      {/* ⚠ With a value, the label keeps its own width and the value takes the
          rest: a long value such as "Automático (Português)" once squeezed
          "Idioma" to a letter a line on the P30. */}
      <View style={[styles.rowText, value !== undefined && styles.rowTextBeside]}>
        <Text style={[styles.rowLabel, { color: TONE_INK[tone] }]}>{label}</Text>
        {detail === undefined ? null : <Text style={styles.rowDetail}>{detail}</Text>}
      </View>
      {value === undefined ? null : <Text style={styles.rowValue}>{value}</Text>}
      {onPress === undefined || tone !== 'link' ? null : (
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
 * A labelled switch with its glyph (T-146), WalkNYC's *Always Gathering* row.
 * The state is never carried by the switch's colour alone: the group's
 * footnote says in a sentence what is true (D-015).
 */
function ToggleRow({
  icon,
  label,
  value,
  onChange,
  disabled,
}: {
  icon: SettingsIconName;
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled === true && styles.rowDisabled]}>
      <SettingsIcon name={icon} color={colors.tint} />
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
 * How far the chosen chip sits inside the grey track, in dp. Each segment's
 * target is grown back by the same amount above and below, so it stays 60 dp
 * (D-015) while the chip draws smaller than the track around it.
 */
const SEGMENT_INSET = 3;
const SEGMENT_HIT_SLOP = { top: SEGMENT_INSET, bottom: SEGMENT_INSET, left: 0, right: 0 };

/**
 * The three tiers, three segments wide: a grey track with the chosen tier as a
 * raised white chip, the platforms' own segmented control. ⚠ Was an outlined
 * pill with round ends (WalkNYC's) until 2026-09-25; the project lead found it
 * odd, and asked for it tidier.
 *
 * `short` is the word on the segment and what the screen reader says (review
 * N4, WCAG 2.5.3: a segment reading *Preciso* was once spoken *Máximo
 * detalhe*); `detail` is its hint, so a screen-reader user hears what a tier
 * does before choosing it. A `Record` keyed by the type, so a new tier in
 * `trackingPreference.ts` fails the build here rather than rendering blank; the
 * order comes from `TRACKING_QUALITIES`, which owns it.
 */
const QUALITY_TEXT: Record<TrackingQuality, { short: StringKey; detail: StringKey }> = {
  saver: { short: 'settings.quality.short.saver', detail: 'settings.quality.detail.saver' },
  balanced: { short: 'settings.quality.short.balanced', detail: 'settings.quality.detail.balanced' },
  precise: { short: 'settings.quality.short.best', detail: 'settings.quality.detail.best' },
};

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
            hitSlop={SEGMENT_HIT_SLOP}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentActive,
              pressed && styles.pressed,
            ]}
          >
            {/* One line: a segment that wraps makes the control uneven. */}
            <Text numberOfLines={1} style={[styles.segmentText, selected && styles.segmentTextActive]}>
              {t(QUALITY_TEXT[quality].short)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The language list, over the screen (2026-09-25). A sheet rather than rows in
 * the page, so a choice cannot move anything under the finger; it closes on a
 * choice, on *Cancelar*, on the backdrop and on Android's Back. Radio
 * semantics (T-202, T-215): each option says whether it is `checked`.
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
            const checked = option === choice;
            const label =
              option === null
                ? t('settings.language.auto', { language: LANGUAGE_NAMES[systemLanguage()] })
                : LANGUAGE_NAMES[option];
            return (
              <Pressable
                key={option ?? 'auto'}
                accessibilityRole="radio"
                accessibilityState={{ checked }}
                accessibilityLabel={label}
                onPress={() => onChoose(option)}
                style={({ pressed }) => [styles.radioRow, pressed && styles.pressed]}
              >
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.tick}>{checked ? '✓' : ''}</Text>
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

  return (
    <View style={styles.root}>
      {/* The way back, where the passport has it (T-211 also wires Back). */}
      <BackBar
        label={t('settings.back')}
        accessibilityLabel={t('settings.a11y.backToMap')}
        onPress={onClose}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('settings.title')}</Text>

        {/* First, so choosing one cannot re-flow anything above it. */}
        {languageChoice === undefined || onChangeLanguage === undefined ? null : (
          <Group>
            <ListRow
              icon="language"
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

        {/* WalkNYC's Passive Capture: a switch, the tiers under it, one
            explanation below. D-087 §1: the background recorder keeps its own
            name, as the heading. Location access shows only when it needs
            fixing, as the first row, so the way to repair it is where the
            problem is. */}
        <Group
          title={t('settings.section.background')}
          footnote={
            permission === 'always'
              ? t('settings.recording.explain')
              : t('settings.recording.footnoteLimited')
          }
        >
          {permission === 'always' ? null : (
            <ListRow
              icon="warning"
              iconColor={colors.bad}
              label={t('settings.location')}
              // Under the label, not beside it: both are long.
              detail={describePermission(permission)}
              onPress={onOpenSystemSettings}
            />
          )}
          <ToggleRow
            icon="recording"
            label={t('settings.background.toggle')}
            value={recordingInBackground}
            onChange={onChangeBackgroundTracking}
            // ⚠ Disabled rather than hidden when the permission is missing: a
            // control that vanishes leaves the user hunting for it, and the row
            // above says where the real gate is.
            disabled={permission !== 'always'}
          />
          {/* The tiers, and what the chosen one does, in words (D-015): the
              line changes as another is tapped. The project lead asked for
              each option explained on its own, not all three at once. */}
          {recordingInBackground ? (
            <View style={styles.segmentRow}>
              <Segmented value={trackingQuality} onChange={onChangeTrackingQuality} />
              <Text style={styles.rowDetail}>
                <Text style={styles.detailStrong}>{t(QUALITY_TEXT[trackingQuality].short)}</Text>
                {`: ${t(QUALITY_TEXT[trackingQuality].detail)}`}
              </Text>
            </View>
          ) : null}
          {/* Android only. The label says what it achieves; the detail uses the
              phone's own word, so the screen it opens is recognisable. */}
          {onOpenBatterySettings === null ? null : (
            <ListRow
              icon="battery"
              label={t('settings.keepRunning', { app: APP_NAME })}
              detail={t('settings.keepRunning.detail')}
              onPress={onOpenBatterySettings}
            />
          )}
        </Group>

        {/* ⚠ HIDDEN, NOT DELETED (2026-08-28): one theme, always light, until
            the app has earned a second. The dark map is not dead: the souvenir
            renders dark whatever this says. `MAP_STYLE_CHOICE_ENABLED` in
            `map/mapStylePreference.ts` brings the choice back with every stored
            preference intact. */}
        {MAP_STYLE_CHOICE_ENABLED ? (
          <Group title={t('settings.section.appearance')} footnote={t('settings.appearance.footnote')}>
            {/* Two labelled buttons rather than a switch: D-015 forbids meaning
                carried by anything but words. */}
            <View style={styles.choiceRow}>
              {(['light', 'dark'] as const).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={
                    option === 'dark' ? t('settings.a11y.useDarkMap') : t('settings.a11y.useLightMap')
                  }
                  onPress={() => onChangeMapStyle(option)}
                  style={({ pressed }) => [
                    styles.choice,
                    mapStyle === option && styles.choiceActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.choiceText, mapStyle === option && styles.choiceTextActive]}>
                    {option === 'light' ? t('settings.appearance.light') : t('settings.appearance.dark')}
                    {mapStyle === option ? '  ✓' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Group>
        ) : null}

        <Group title={t('settings.section.about')} footnote={t('settings.about.footnote')}>
          <ListRow icon="privacy" label={t('settings.about.privacy')} onPress={onOpenPrivacyPolicy} />
          {onOpenLicences === undefined ? null : (
            <ListRow icon="licences" label={t('settings.about.licences')} onPress={onOpenLicences} />
          )}
          {/* A rare action, so it lives where rare lives (design brief §3.2),
              not on the passport beside the reward (OD-11, D-069). What it
              sends is spelled out in the confirmation before anything leaves. */}
          {onDonateWalk === undefined ? null : (
            <ListRow
              icon="send"
              label={donating === true ? t('settings.help.preparing') : t('settings.help.send')}
              detail={t('settings.help.detail')}
              tone="action"
              onPress={onDonateWalk}
            />
          )}
          {onContact === undefined ? null : (
            <ListRow icon="contact" label={t('settings.about.contact')} tone="action" onPress={onContact} />
          )}
          {onOpenDebug === undefined ? null : (
            <ListRow icon="technical" label={t('settings.about.technical')} onPress={onOpenDebug} />
          )}
        </Group>

        {/* Last, its own group, in red. §5, T-125. */}
        <Group title={t('settings.section.erase')} destructive footnote={t('settings.erase.footnote')}>
          <ListRow icon="erase" label={t('settings.erase.action')} tone="danger" onPress={onEraseRequested} />
        </Group>

        {/* WalkNYC closes with who made it; ours with what it is. */}
        {version === undefined ? null : (
          <Text style={styles.colophon}>{`${APP_NAME} · ${t('settings.about.version')} ${version}`}</Text>
        )}
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
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  // A title, not the large title: this screen is a list, and the large one
  // was a sixth of the first screenful.
  heading: { color: colors.text, fontSize: fontSize.title, fontWeight: '700' },
  group: { gap: spacing.xs },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
  },
  // Sentence case, as WalkNYC's: capitals shouted over the rows they name.
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '600',
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
  // (D-015). The language options were once 32 dp, measured by the review (N4).
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  rowTextBeside: { flex: 0, flexShrink: 0 },
  rowValue: { flex: 1, color: colors.textMuted, fontSize: fontSize.body, textAlign: 'right' },
  chevron: { color: colors.textMuted, fontSize: fontSize.title, marginLeft: spacing.xs },
  rowDisabled: { opacity: 0.5 },
  // Under the label, not under the glyph: the hairline starts where words do.
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: SETTINGS_ICON_SIZE + spacing.md,
  },
  segmentRow: {
    paddingBottom: spacing.md,
    paddingLeft: SETTINGS_ICON_SIZE + spacing.md,
    gap: spacing.sm,
  },
  segmented: {
    flexDirection: 'row',
    padding: SEGMENT_INSET,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceRaised,
  },
  segment: {
    // Equal thirds whatever the word's length in this language.
    flex: 1,
    minHeight: MIN_TAP_TARGET - 2 * SEGMENT_INSET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.control - SEGMENT_INSET,
  },
  // Raised, not filled with colour: the words under the control say which
  // tier it is, so the chip only has to be findable (D-015).
  segmentActive: {
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentText: { color: colors.textMuted, fontSize: fontSize.small, fontWeight: '600', textAlign: 'center' },
  segmentTextActive: { color: colors.text, fontWeight: '700' },
  detailStrong: { color: colors.text, fontWeight: '700' },
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
  colophon: { color: colors.textMuted, fontSize: fontSize.small, textAlign: 'center' },
  // The hidden light/dark choice (MAP_STYLE_CHOICE_ENABLED): two labelled buttons.
  choiceRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
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

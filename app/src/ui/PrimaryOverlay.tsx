/**
 * The primary screen's chrome (T-075) — three controls over the map.
 *
 * THE WHOLE DESIGN, FROM `docs/design-brief.md` §3
 * -----------------------------------------------
 *   gear, top-left ─── settings, rare and slightly out of the way
 *   [ the map ] ────── the product; everything here is chrome over it
 *   stamp button, bottom-left ─── the passport, carrying the hero number
 *
 * And a conditional fourth: an explicit start/stop control, shown **only** to
 * users who have not granted Always (D-008, design brief §3.3). For them
 * start/stop is a primary action, not a setting — burying a frequent action in
 * a rare place would be the wrong trade. Users on Always never see it.
 *
 * WHY THE STAMP BUTTON CARRIES THE NUMBER
 * ---------------------------------------
 * T-075 requires one hero number, and the screen is allowed three things. Icon
 * plus `23 / 180` on a single element is how both survive — one element, two
 * jobs (design brief §3.1). It is stamps, never a coverage percentage (D-002),
 * and the competitor teardown in §6.3 shows exactly why: their `0.00%` needed
 * two decimal places to avoid reading as zero.
 *
 * ⚠ BOTTOM-**LEFT**, ON THE PROJECT LEAD'S INSTRUCTION (2026-08-12)
 * ----------------------------------------------------------------
 * This used to be bottom-right, and the reason recorded here was thumb reach:
 * the easiest place for a right-handed thumb on a large phone, for the app's
 * primary action. That reasoning is not wrong and it was overruled deliberately
 * — see design brief §3.1. The two bottom controls keep their **horizontal**
 * separation, mirrored: the passport is now left and the recording control
 * right, so neither is a mis-tap for the other. Both screen edges are
 * back-gesture territory on Android, hence the clearance on each.
 *
 * The icon is `StampMark`, not the `🛂` emoji it replaced. At 36 dp that glyph
 * rendered as a blue rectangle — the project lead looked at the running app and
 * asked what "the button to centre the map" did. D-015: minimal is not
 * unlabelled.
 *
 * Presentational: props in, pixels out, so the workbench can mount it.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TripProgress } from '../progress/tripProgress';
import SettingsMark from './SettingsMark';
import StampMark from './StampMark';
import { TIER_METAL, tierFor } from '../passport/stampTier';
import { n, t } from '../i18n';
import { colors, fontSize, mapChrome, MIN_TAP_TARGET, radius, spacing } from './theme';

/** The mark's drawn size. Comfortably above the 24 dp its geometry is tested at. */
const STAMP_MARK_SIZE = 34;

/** The settings mark, a little smaller: it is the quietest control here. */
const SETTINGS_MARK_SIZE = 22;

export type PrimaryOverlayProps = {
  progress: TripProgress;
  /**
   * Which map is underneath (T-146).
   *
   * ⚠ The chrome cannot be style-blind, and it took two goes to get right.
   * First it was `colors.surface` in both styles, which measures **15.36:1** on
   * Google's light map and **1.13:1** on our night one — the control does not
   * fade on the dark map, it vanishes. A hairline border fixed that and left the
   * light map with a solid near-black disc as its quietest control, which is what
   * looking at it on 2026-08-17 found. Now the whole treatment inverts with the
   * map: `mapChrome` in `theme.ts`.
   */
  mapStyle: 'light' | 'dark';
  /**
   * Show the start/stop control. True only for users without Always
   * permission (D-008) — the caller decides, because permission state is not
   * this component's business.
   */
  showRecordingControl: boolean;
  isRecording: boolean;
  /**
   * Anything that shares the bottom of the screen — today, the place card
   * (T-115). Rendered **above** the controls, inside the same column.
   *
   * ⚠ A slot rather than a position, because the two must not be laid out
   * independently. The first attempt anchored the card to the same corner and
   * pushed the controls up by its measured height; the measurement never
   * arrived (`onLayout` did not fire in the workbench) and the card landed on
   * top of the passport button — a mis-tap between two primary controls,
   * which is the exact failure design brief §3.1's pairing exists to prevent.
   * In one flex column the overlap is impossible at any text size, with
   * nothing to measure and nothing to keep in sync.
   */
  bottomSlot?: ReactNode;
  onOpenPassport: () => void;
  onOpenSettings: () => void;
  onToggleRecording: () => void;
};

export default function PrimaryOverlay({
  progress,
  mapStyle,
  showRecordingControl,
  isRecording,
  bottomSlot,
  onOpenPassport,
  onOpenSettings,
  onToggleRecording,
}: PrimaryOverlayProps) {
  // How far into the collection this is (D-078). The passport button has always
  // been drawn as a stamp; the rank is what kind of stamp it is.
  const tier = tierFor(progress.collected, progress.total);

  // The floating controls take their colours from the map underneath, not from
  // the app's (dark-only) palette. See `mapChrome` in `theme.ts`.
  const chrome = mapChrome[mapStyle];

  return (
    // `box-none` so the map underneath still receives pans and pinches —
    // only the controls themselves capture touches.
    <View style={styles.root} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('map.a11y.settings')}
        onPress={onOpenSettings}
        style={({ pressed }) => [
          styles.gear,
          // ⚠ Chrome follows the map, not the app (`theme.ts` → `mapChrome`).
          // This used to be `colors.surface` in both styles, which on the light
          // map drew a solid near-black disc — the heaviest object on a pale
          // map, and the one control §3.2 wants quietest.
          {
            backgroundColor: chrome.surface,
            // Elevation is what separates a white control from a pale map; see
            // `mapChrome`. Zero on the dark map, where the border does that job.
            elevation: chrome.elevation,
            shadowColor: '#000000',
            shadowOpacity: chrome.elevation === 0 ? 0 : 0.18,
            shadowRadius: chrome.elevation,
            shadowOffset: { width: 0, height: 1 },
          },
          chrome.border !== null && { borderWidth: 1, borderColor: chrome.border },
          pressed && styles.pressed,
        ]}
      >
        {/* ⚠ Drawn, not a `⚙` glyph — that read as a re-center button to the
            project lead, exactly as the `🛂` on the passport button once read
            as one (see `SettingsMark`). Still not three lines: a hamburger
            promises a drawer of destinations, and this is one screen with a
            handful of toggles (design brief §3.2, CONTEXT §6.5). */}
        <SettingsMark size={SETTINGS_MARK_SIZE} color={chrome.content} />
      </Pressable>

      {/* The two bottom controls stack rather than share a row.
          Measured, not assumed: side by side they overlapped by 38px on a
          320dp phone showing `180 / 180` with the recording control visible —
          a While-Using user with a full collection, which is a real
          combination and the worst case for width. Stacking cannot collide at
          any width, and it keeps them horizontally apart so neither is a
          mis-tap for the other.
          ⚠ The two `alignSelf` values below are a pair. When the passport moved
          left the recording control moved right, because it is that opposition
          — not the specific side — that stops a mis-tap. Changing one alone
          puts both primary controls under the same thumb. */}
      <View style={styles.bottom} pointerEvents="box-none">
        {/* The place card, when there is one (T-115). Above the controls and
            in the same column, so it can never cover them. */}
        {bottomSlot}

        {showRecordingControl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isRecording
                ? t('map.a11y.stopRecording')
                : t('map.a11y.startRecording')
            }
            onPress={onToggleRecording}
            style={({ pressed }) => [
              styles.recording,
              {
                backgroundColor: chrome.surface,
                // Elevation is what separates a white control from a pale map; see
                // `mapChrome`. Zero on the dark map, where the border does that job.
                elevation: chrome.elevation,
                shadowColor: '#000000',
                shadowOpacity: chrome.elevation === 0 ? 0 : 0.18,
                shadowRadius: chrome.elevation,
                shadowOffset: { width: 0, height: 1 },
              },
              chrome.border !== null && { borderWidth: 1, borderColor: chrome.border },
              isRecording && styles.recordingActive,
              pressed && styles.pressed,
            ]}
          >
            {/* ⚠ "Start walk", not "Start recording" — the project lead's
                wording, 2026-08-15, and it is the better one. "Recording" names
                the mechanism; "walk" names the thing the user came to do, and
                this button is now the primary action for anybody who has turned
                background tracking off (T-146). Labelled with words, never an
                icon alone (D-015). */}
            <Text style={[styles.recordingText, { color: chrome.content }]}>
              {isRecording ? t('map.stopWalk') : t('map.startWalk')}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            progress.total === 0
              ? t('map.a11y.openPassport')
              : n('passport.a11y.openWithCount', progress.collected, {
                  collected: progress.collected,
                  total: progress.total,
                })
          }
          onPress={onOpenPassport}
          style={({ pressed }) => [
            styles.stampButton,
            // ⚠ The rank, and it is the *fill* rather than the mark (D-078).
            // The button has always been drawn as a stamp; now it is drawn as
            // the stamp you have earned. Metals are pale by nature and none of
            // them survives on the action blue — a test proved that before this
            // line existed.
            { backgroundColor: TIER_METAL[tier].fill },
            pressed && styles.pressed,
          ]}
        >
          <StampMark size={STAMP_MARK_SIZE} color={colors.actionText} />
          <Text style={styles.stampCount}>
            {progress.total === 0
              ? '—'
              : `${progress.collected} / ${progress.total}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // RN 0.86 exposes the registered style, not the raw object.
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  pressed: { opacity: 0.75 },

  gear: {
    position: 'absolute',
    top: spacing.xl + spacing.md,
    left: spacing.md,
    width: MIN_TAP_TARGET,
    height: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    // A circle, like every floating control in Apple Maps (D-054). No border:
    // a filled circle on a pale map needs no outline to be found, and the
    // outline was the most Android thing on this screen.
    borderRadius: radius.pill,
    // ⚠ No `backgroundColor` here: it comes from `mapChrome` at render time,
    // because it depends on which map is underneath.
  },
  bottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.xl,
    gap: spacing.sm,
  },
  recording: {
    // Right, because the passport is left. See the pairing note above.
    alignSelf: 'flex-end',
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    // A pill, matching the passport button opposite it.
    borderRadius: radius.pill,
    // Filled from `mapChrome` at render time, like the gear.
  },
  // ⚠ Recording is signalled by the word on the button ("Stop recording"), and
  // this only reinforces it — D-015 forbids hue carrying the meaning alone.
  recordingActive: { borderWidth: 2, borderColor: colors.bad },
  recordingText: {
    fontSize: fontSize.body,
    fontWeight: '700',
  },

  stampButton: {
    // Bottom-left, on the project lead's instruction — see the header. The
    // recording control sits opposite it.
    alignSelf: 'flex-start',
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.action,
  },
  stampCount: {
    color: colors.actionText,
    fontSize: fontSize.title,
    fontWeight: '700',
  },
});

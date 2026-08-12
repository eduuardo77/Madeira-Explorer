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

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TripProgress } from '../progress/tripProgress';
import StampMark from './StampMark';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

/** The mark's drawn size. Comfortably above the 24 dp its geometry is tested at. */
const STAMP_MARK_SIZE = 34;

export type PrimaryOverlayProps = {
  progress: TripProgress;
  /**
   * Show the start/stop control. True only for users without Always
   * permission (D-008) — the caller decides, because permission state is not
   * this component's business.
   */
  showRecordingControl: boolean;
  isRecording: boolean;
  onOpenPassport: () => void;
  onOpenSettings: () => void;
  onToggleRecording: () => void;
};

export default function PrimaryOverlay({
  progress,
  showRecordingControl,
  isRecording,
  onOpenPassport,
  onOpenSettings,
  onToggleRecording,
}: PrimaryOverlayProps) {
  return (
    // `box-none` so the map underneath still receives pans and pinches —
    // only the controls themselves capture touches.
    <View style={styles.root} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={onOpenSettings}
        style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
      >
        {/* A gear, never three lines. A hamburger is a learned convention that
            promises a drawer of destinations; this is one screen with a
            handful of toggles (design brief §3.2, CONTEXT §6.5). */}
        <Text style={styles.gearGlyph}>⚙</Text>
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
        {showRecordingControl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isRecording
                ? 'Stop recording this trip'
                : 'Start recording this trip'
            }
            onPress={onToggleRecording}
            style={({ pressed }) => [
              styles.recording,
              isRecording && styles.recordingActive,
              pressed && styles.pressed,
            ]}
          >
            {/* Labelled with words, never an icon alone (D-015). */}
            <Text style={styles.recordingText}>
              {isRecording ? 'Stop recording' : 'Start recording'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            progress.total === 0
              ? 'Open your passport'
              : `Open your passport, ${progress.collected} of ${progress.total} places collected`
          }
          onPress={onOpenPassport}
          style={({ pressed }) => [styles.stampButton, pressed && styles.pressed]}
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
    borderRadius: MIN_TAP_TARGET / 2,
    // Chrome sits on a light map, so it carries its own contrast rather than
    // relying on whatever happens to be underneath it.
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gearGlyph: { color: colors.text, fontSize: fontSize.title },

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
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  recordingActive: { borderColor: colors.bad },
  recordingText: {
    color: colors.text,
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
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.action,
  },
  stampCount: {
    color: colors.actionText,
    fontSize: fontSize.title,
    fontWeight: '800',
  },
});

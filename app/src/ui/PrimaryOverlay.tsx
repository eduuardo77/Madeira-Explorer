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
import RecentreMark from './RecentreMark';
import WalkMark from './WalkMark';
import StampMark from './StampMark';
import { TIER_METAL, tierFor } from '../passport/stampTier';
import { n, t } from '../i18n';
import {
  colors,
  fontSize,
  mapButton,
  mapChrome,
  MIN_TAP_TARGET,
  radius,
  spacing,
} from './theme';

/** The mark's drawn size. Comfortably above the 24 dp its geometry is tested at. */
const STAMP_MARK_SIZE = 34;

/** The settings mark, a little smaller: it is the quietest control here. */
const SETTINGS_MARK_SIZE = 22;

/** The re-centre pill: compact by design, see the hitSlop note at its call site. */
const RECENTRE_HEIGHT = 40;
const RECENTRE_MARK_SIZE = 17;

/**
 * Grows the 40 dp pill to a 60 dp target (D-015).
 *
 * ⚠ 10 dp top and bottom, and no more. The walk button sits directly below with
 * `spacing.sm` between them; a taller slop would overlap the one control on this
 * screen that must never be pressed by accident.
 */
const RECENTRE_HIT_SLOP = { top: 10, bottom: 10, left: 16, right: 16 };

/** The glyph beside the words on the walk button. */
const WALK_MARK_SIZE = 22;

/**
 * The ink on the walk button, both states.
 *
 * ⚠ White, and measured: 6.76:1 on `colors.good` and 5.92:1 on `colors.bad`,
 * both above the project's 5:1 floor for text read outdoors. Not
 * `colors.actionText` — that happens to be white today and is the page's
 * token, which has already inverted once (2026-08-28) and would take this
 * button's label with it next time.
 */
const WALK_INK = '#FFFFFF';

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
  /**
   * Is the user on a walk **they started** (2026-08-28)?
   *
   * ⚠ Not "is the recorder running". The app starts the recorder by itself on
   * launch for anybody with background recording, and binding this button to
   * that made it open on *Stop walk* for a walk nobody began. `manualWalk.ts`
   * is the argument; the project lead's instruction was explicit.
   */
  isWalking: boolean;
  /** Offered only when the map has actually wandered off the user. */
  showRecentre: boolean;
  onRecentre: () => void;
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
  isWalking,
  showRecentre,
  onRecentre,
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

        {/* ⚠ Re-centre, above the walk button and only when it would move
            the map (2026-08-28). Compact and quiet: it is a convenience, not one
            of the screen's three real controls (design brief §3). */}
        {showRecentre ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('map.a11y.recentre')}
            onPress={onRecentre}
            // ⚠ The visible pill is deliberately smaller than the 60 dp D-015
            // asks for, because the reference app's is and the project lead
            // asked for theirs: a full-height chrome slab here shouted louder
            // than the walk button below it, which is the actual primary
            // action. The *target* is still 60 dp — that is what hitSlop buys,
            // and `PassportView`'s "See all" does the same thing for the same
            // reason. ⚠ The workbench cannot see hitSlop (see that file), so
            // this target can only be checked on a device.
            hitSlop={RECENTRE_HIT_SLOP}
            style={({ pressed }) => [
              styles.recentre,
              {
                backgroundColor: chrome.surface,
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
            <RecentreMark size={RECENTRE_MARK_SIZE} color={chrome.link} />
            <Text style={[styles.recentreText, { color: chrome.link }]}>
              {t('map.recentre')}
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
          {/* ⚠ The metal's own ink, not the app's. Every metal is pale, and the
              light palette made `colors.actionText` white — see TIER_METAL. */}
          <StampMark size={STAMP_MARK_SIZE} color={TIER_METAL[tier].ink} />
          <Text style={[styles.stampCount, { color: TIER_METAL[tier].ink }]}>
            {progress.total === 0
              ? '—'
              : `${progress.collected} / ${progress.total}`}
          </Text>
        </Pressable>

        {/* ⚠ SHOWN TO EVERYBODY SINCE 2026-08-28, on the project lead's
            instruction, and styled after the reference app: full width, filled,
            glyph beside the words.

            It used to appear only for people the app could not fill the map in
            for. That made it a fallback; it is now the way anybody says "I am on
            a walk", whatever their background setting. ⚠ Full width also settles
            the mis-tap worry the old side-by-side layout had: this cannot be
            confused with the passport pill above it at any width, because it is
            a different shape, a different colour and a different size.

            ⚠ Green and red are `colors.good` / `colors.bad`, which clear 5:1
            with white and stand off Google's light land at 5.89:1 and 5.15:1.
            They do NOT clear 3:1 on the night map (1.97 and 2.26) — the same
            open question as the passport button, and T-065's to settle
            outdoors. The word on the button is what carries the state (D-015);
            the fill and the glyph reinforce it. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isWalking ? t('map.a11y.stopRecording') : t('map.a11y.startRecording')
          }
          onPress={onToggleRecording}
          style={({ pressed }) => [
            styles.walk,
            { backgroundColor: isWalking ? colors.bad : colors.good },
            pressed && styles.pressed,
          ]}
        >
          <WalkMark size={WALK_MARK_SIZE} stopped={isWalking} color={WALK_INK} />
          {/* ⚠ "Start walk", not "Start recording" — the project lead's
              wording, 2026-08-15, and it is the better one. "Recording" names
              the mechanism; "walk" names the thing the user came to do.
              Labelled with words, never a glyph alone (D-015). */}
          <Text style={styles.walkText}>
            {isWalking ? t('map.stopWalk') : t('map.startWalk')}
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
  /** The reference app's shape: full width, tall, glyph and words centred. */
  walk: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    // A filled colour on a pale map needs the same separation the white
    // controls get; see `mapChrome.light`.
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  walkText: {
    color: WALK_INK,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  recentre: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // ⚠ Not MIN_TAP_TARGET. See the hitSlop note at the call site — the pill is
    // 40 dp and the target is 60.
    height: RECENTRE_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  recentreText: {
    fontSize: fontSize.body,
    fontWeight: '600',
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
    // ⚠ `mapButton`, not `colors.action` — this control sits on the map, and the
    // page's action blue went dark when the app went light. Overpainted by the
    // rank metal at render time anyway; this is the `none` case.
    backgroundColor: mapButton.fill,
  },
  stampCount: {
    color: colors.actionText,
    fontSize: fontSize.title,
    fontWeight: '700',
  },
});

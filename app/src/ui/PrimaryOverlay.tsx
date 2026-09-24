/**
 * The primary screen's chrome (T-075) — three controls over the map.
 *
 * THE WHOLE DESIGN, FROM `docs/design-brief.md` §3
 * -----------------------------------------------
 *   gear, top-left ─── settings, rare and slightly out of the way
 *   [ the map ] ────── the product; everything here is chrome over it
 *   stamp button, bottom-left ─── the passport, drawn as your latest stamp
 *
 * And a conditional fourth: an explicit start/stop control, shown **only** to
 * users who have not granted Always (D-008, design brief §3.3). For them
 * start/stop is a primary action, not a setting — burying a frequent action in
 * a rare place would be the wrong trade. Users on Always never see it.
 *
 * ⚠ THE STAMP BUTTON IS A STAMP, AND THE NUMBER HAS LEFT IT (D-083, 2026-09-22)
 * ---------------------------------------------------------------------------
 * It carried the seal mark and `23 / 180` on a pill, because T-075 wanted one
 * hero number on this screen. The project lead looked at it and asked for
 * *"just a stamp figure on it"*, then chose from drawn options: **your most
 * recent visible stamp**, the real artwork, with the rank (D-078) as a metal
 * rim on its die-cut edge. `passport/passportButton.ts` picks the stamp —
 * never a locked one — and `passport/stampRim.ts` draws the rim. The count is
 * still read out by a screen reader here, and still shown in the passport.
 *
 * ⚠ THE COUNT CAME BACK, OFF THE BUTTON (D-090, 2026-09-24)
 * --------------------------------------------------------
 * As a slim strip above the walk button, *"3 de 80 lugares"* and a 3 dp bar,
 * after the reference app's *"0 / 86 638 blocks"*. The project lead asked for
 * it *"very subtle"*, so it is the quietest thing at the bottom of the screen.
 * The button stays a stamp.
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
 * Before the seal it was the `🛂` emoji, which at 36 dp rendered as a blue
 * rectangle — the project lead asked what "the button to centre the map" did.
 * A real stamp is the least ambiguous answer yet: it is the thing the passport
 * is full of.
 *
 * Presentational: props in, pixels out, so the workbench can mount it.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TripProgress } from '../progress/tripProgress';
import SettingsMark from './SettingsMark';
import RecentreMark from './RecentreMark';
import WalkMark from './WalkMark';
import StampArt from './StampArt';
import { STAMP_BUTTON_SIZE, type ButtonStamp } from '../passport/passportButton';
import { designFor, TILT_FIT } from '../passport/stampArt';
import { rimFor } from '../passport/stampRim';
import { tierFor } from '../passport/stampTier';
import { homeProgress } from '../progress/homeProgress';
import { n, t } from '../i18n';
import type { PrimaryControl } from '../recording/recorderControls';
import {
  colors,
  fontSize,
  mapChrome,
  MIN_TAP_TARGET,
  radius,
  spacing,
} from './theme';

/** The settings mark, a little smaller: it is the quietest control here. */
const SETTINGS_MARK_SIZE = 22;

/** The re-centre pill: compact by design, see the hitSlop note at its call site. */
const RECENTRE_HEIGHT = 40;
const RECENTRE_MARK_SIZE = 17;

/**
 * Grows the 40 dp pill to a 60 dp target (D-015).
 *
 * ⚠ 10 dp top and bottom, and no more. The walk button sits below, the pill
 * centred on the stamp's row (2026-09-24); a taller slop would reach toward the
 * one control on this screen that must never be pressed by accident. Nothing
 * sideways: the pill is already wider than 60 dp, and the stamp is beside it.
 */
const RECENTRE_HIT_SLOP = { top: 10, bottom: 10, left: 0, right: 0 };

/** The passport button's box: the stamp, never under the 60 dp target. */
const STAMP_BOX = Math.max(STAMP_BUTTON_SIZE, MIN_TAP_TARGET);

/** The progress caption's line, fixed so the strip's height is known (D-090). */
const PROGRESS_LINE = Math.round(fontSize.small * 1.35);
const PROGRESS_BAR = 3;
const PROGRESS_GAP = spacing.xs + 2;

/**
 * How tall the progress strip draws, for `NativeMapScreen`'s camera padding:
 * the map centres a trace in the part of the screen the chrome leaves free,
 * and a guessed height is how the framing broke once before (2026-08-17).
 */
export const PROGRESS_STRIP_HEIGHT = spacing.sm * 2 + PROGRESS_LINE + PROGRESS_GAP + PROGRESS_BAR;

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

/** The × is small on purpose; its target is not (D-015). */
const NOTICE_DISMISS_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export type PrimaryOverlayProps = {
  progress: TripProgress;
  /** The stamp the passport button shows — `buttonStamp()` decides it. */
  passportStamp: ButtonStamp;
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
  /**
   * What the main button does (D-087 §3). `grant-location` takes it over when
   * the app has no location at all; otherwise it starts or ends an outing.
   */
  control: PrimaryControl;
  /**
   * The one thing to say about automatic recording, or null (D-087 §4). Only
   * ever about something wrong, or a pause the user chose.
   */
  notice: MapNotice | null;
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

/** A notice, already in words: `NativeMapScreen` decides it, this draws it. */
export type MapNotice = {
  text: string;
  actionLabel: string;
  onAction: () => void;
  /** Absent for a notice that may not be dismissed (T-174). */
  onDismiss?: () => void;
};

export default function PrimaryOverlay({
  progress,
  passportStamp,
  mapStyle,
  isWalking,
  control,
  notice,
  showRecentre,
  onRecentre,
  bottomSlot,
  onOpenPassport,
  onOpenSettings,
  onToggleRecording,
}: PrimaryOverlayProps) {
  // How far into the collection this is (D-078) — the rim round the stamp.
  const tier = tierFor(progress.collected, progress.total);

  // D-090: the one line of progress the reference app keeps above its start
  // button. Null when there is nothing to count.
  const strip = homeProgress(progress);

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

      {/* D-087 §4 — automatic recording speaks only when something is wrong.
          Beside the settings control, because it is about a setting, and
          nowhere near the two primary controls at the bottom. The words carry
          the state (D-015); the whole card is the action. */}
      {notice === null ? null : (
        <View
          style={[
            styles.notice,
            {
              backgroundColor: chrome.surface,
              elevation: chrome.elevation,
              shadowColor: '#000000',
              shadowOpacity: chrome.elevation === 0 ? 0 : 0.18,
              shadowRadius: chrome.elevation,
              shadowOffset: { width: 0, height: 1 },
            },
            chrome.border !== null && { borderWidth: 1, borderColor: chrome.border },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${notice.text}. ${notice.actionLabel}`}
            onPress={notice.onAction}
            style={({ pressed }) => [styles.noticeBody, pressed && styles.pressed]}
          >
            <Text style={[styles.noticeText, { color: chrome.content }]}>{notice.text}</Text>
            <Text style={[styles.noticeAction, { color: chrome.link }]}>{notice.actionLabel}</Text>
          </Pressable>
          {notice.onDismiss === undefined ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('notice.a11y.dismiss')}
              onPress={notice.onDismiss}
              hitSlop={NOTICE_DISMISS_HIT_SLOP}
              style={({ pressed }) => [styles.noticeDismiss, pressed && styles.pressed]}
            >
              <Text style={[styles.noticeDismissText, { color: chrome.content }]}>×</Text>
            </Pressable>
          )}
        </View>
      )}

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

        {/* The passport stamp and *Re-centre* share one row, directly above
            the walk button (the project lead, 2026-09-24: re-centre used to
            float above the passport, in the middle of the map). The stamp
            keeps the left edge and re-centre is centred on the screen, in a
            middle column that mirrors the stamp's width on the right, so it
            can never reach the stamp whatever the label's length. */}
        <View style={styles.row} pointerEvents="box-none">
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
            style={({ pressed }) => [styles.stampButton, pressed && styles.pressed]}
          >
            {/* The Pressable above says "open your passport, 3 of 80"; StampArt
                hides itself from screen readers, so it is said once. */}
            <StampArt
              placeId={`button-${passportStamp.placeId}`}
              design={designFor(passportStamp.placeId, passportStamp.category)}
              name={passportStamp.name}
              collected={passportStamp.collected}
              rim={rimFor(tier, mapStyle)}
              size={STAMP_BUTTON_SIZE * TILT_FIT}
            />
          </Pressable>

          <View style={styles.rowCentre} pointerEvents="box-none">
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
                {/* One line, shrunk if it must: "Zentrieren" is the widest and
                    the column is only as wide as the screen less two stamps. */}
                <Text
                  style={[styles.recentreText, { color: chrome.link }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {t('map.recentre')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.rowMirror} pointerEvents="none" />
        </View>

        {/* D-090 — progress, as the reference app shows it (*"0 / 86 638
            blocks"* above *Start Walk*), but quieter, on the project lead's
            word: *"very subtle"*. A muted caption and a 3 dp bar on a slim
            strip; no percentage, no tap, and a lighter shadow than the
            controls, because it is not one.
            ⚠ Hidden from screen readers on purpose: the passport button above
            already says "3 of 80 places collected", and saying it twice on one
            swipe is noise (D-083 keeps the count said once).
            ⚠ Gone while a place card is open, so the card is not pushed any
            higher up the map by a line the user is not reading then. */}
        {strip === null || bottomSlot != null ? null : (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[
              styles.progress,
              {
                backgroundColor: chrome.surface,
                elevation: chrome.elevation === 0 ? 0 : 1,
                shadowColor: '#000000',
                shadowOpacity: chrome.elevation === 0 ? 0 : 0.12,
                shadowRadius: 1,
                shadowOffset: { width: 0, height: 1 },
              },
              chrome.border !== null && { borderWidth: 1, borderColor: chrome.track },
            ]}
          >
            <Text style={[styles.progressText, { color: chrome.muted }]} numberOfLines={1}>
              {t('map.progress', { collected: strip.collected, total: strip.total })}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: chrome.track }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: chrome.link, width: `${strip.fraction * 100}%` },
                ]}
              />
            </View>
          </View>
        )}

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
            control === 'grant-location'
              ? t('map.a11y.grantLocation')
              : isWalking
                ? t('map.a11y.stopRecording')
                : t('map.a11y.startRecording')
          }
          onPress={onToggleRecording}
          style={({ pressed }) => [
            styles.walk,
            {
              backgroundColor:
                control === 'grant-location'
                  ? colors.action
                  : isWalking
                    ? colors.bad
                    : colors.good,
            },
            pressed && styles.pressed,
          ]}
        >
          <WalkMark size={WALK_MARK_SIZE} stopped={isWalking} color={WALK_INK} />
          {/* ⚠ "Start walk", not "Start recording" — the project lead's
              wording, 2026-08-15, and it is the better one. "Recording" names
              the mechanism; "walk" names the thing the user came to do.
              Labelled with words, never a glyph alone (D-015). */}
          <Text style={styles.walkText}>
            {control === 'grant-location'
              ? t('map.grantLocation')
              : isWalking
                ? t('map.stopWalk')
                : t('map.startWalk')}
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
  notice: {
    position: 'absolute',
    top: spacing.xl + spacing.md,
    left: spacing.md + MIN_TAP_TARGET + spacing.sm,
    right: spacing.md,
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.card,
    paddingLeft: spacing.md,
  },
  noticeBody: {
    flex: 1,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  noticeText: {
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  noticeAction: {
    fontSize: fontSize.body,
  },
  noticeDismiss: {
    width: 36,
    height: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeDismissText: {
    fontSize: fontSize.title,
    lineHeight: fontSize.title + 2,
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
  /** The passport stamp on the left, re-centre centred (2026-09-24). */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowCentre: { flex: 1, alignItems: 'center' },
  /** As wide as the stamp, so the middle column is centred on the screen. */
  rowMirror: { width: STAMP_BOX },
  recentre: {
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

  /** D-090: slim on purpose. The smallest type the app allows, and a 3 dp bar. */
  progress: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: PROGRESS_GAP,
    borderRadius: radius.card,
  },
  progressText: {
    fontSize: fontSize.small,
    lineHeight: PROGRESS_LINE,
  },
  progressTrack: {
    height: PROGRESS_BAR,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: PROGRESS_BAR,
    borderRadius: radius.pill,
  },

  stampButton: {
    // Bottom-left, on the project lead's instruction — see the header.
    // ⚠ No fill and no shadow: the stamp is the button (D-083), and its
    // hairline rim is what stands it off either map. Android draws no
    // elevation shadow for a view without a background anyway.
    width: STAMP_BOX,
    height: STAMP_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

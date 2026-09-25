/**
 * The place card (T-115) — the app's only detail view.
 *
 * THERE IS NO DIRECTIONS BUTTON, AS OF 2026-08-13 (D-055)
 * -------------------------------------------------------
 * D-018 put one here and it was built, tested and shipped. The project lead
 * removed it on sight: *"delete the Directions to the levada, we arent a
 * navigator. Just have the show on map."* D-018's reasoning — never build
 * navigation — is intact and now goes one step further: we do not hand off to
 * one either.
 *
 * What is left is deliberately almost nothing: what this place is, how far it
 * is, and a way to see it on the map. No description, no opening hours, no
 * reviews, no "nearby" list.
 *
 * ⚠ **One line of "why go" since T-201**, from the content pack: the review
 * (P1-4) found a card that gave no reason to go anywhere. One line, not a
 * description — the list above still holds.
 *
 * ⚠ **No photo, because there is no photo.** The content pack has no image
 * field (`placeCard.ts` explains why that is a T-066 question, not a rendering
 * one). The layout leaves the slot at the top of the card, so adding one later
 * moves nothing.
 *
 * WHY "COLLECTED" IS A WORD
 * -------------------------
 * The map already says it in shape and weight (`placeStyle.ts`). Here it is
 * spelled out, because D-015 forbids meaning carried by appearance alone and
 * because a screen reader gets nothing from a filled circle.
 *
 * THE STAMP, ON THE ALBUM'S OWN DARK (T-218)
 * ------------------------------------------
 * Opened from the passport, the card draws the stamp you tapped beside its name,
 * and takes the album's palette. The second review (N3) found a light sheet over
 * the dark album showing no trace of the sticker that had opened it: the one
 * piece of artwork in the app vanished at the moment you asked about it. Over the
 * map the card stays light and has no stamp, because the map is light and the
 * mark you tapped is still on screen behind it.
 *
 * Presentational: props in, pixels out, so the workbench (D-038) can mount it
 * without a map, a database or a location.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../content/contentPack';
import { designFor, TILT_FIT } from '../passport/stampArt';
import type { PlaceCard } from '../places/placeCard';
import StampArt from './StampArt';
import { album, colors, fontSize, MIN_TAP_TARGET, radius, spacing } from './theme';
import { t } from '../i18n';

/**
 * The card's colours on each surface it opens over. Both sets are pairs
 * `contrast.test.ts` already measures: the app's palette, and the album's text,
 * muted text, link and button on `album.surface`.
 */
const PALETTES = {
  light: {
    sheet: colors.surfaceRaised,
    grabber: colors.border,
    text: colors.text,
    muted: colors.textMuted,
    tint: colors.tint,
    action: colors.action,
    actionText: colors.actionText,
  },
  album: {
    sheet: album.surface,
    grabber: album.hairline,
    text: album.text,
    muted: album.textMuted,
    tint: album.tint,
    action: album.action,
    actionText: album.actionText,
  },
} as const;

/** The stamp beside the name, in dp: big enough to read its name band. */
const CARD_STAMP_SIZE = 88;

export type PlaceCardViewProps = {
  card: PlaceCard;
  /** Which surface the card opens over (T-218). Light unless it is the album. */
  palette?: keyof typeof PALETTES;
  /**
   * The stamp that was tapped, drawn beside the name as the passport draws it.
   * Absent on the map's card.
   */
  stamp?: {
    placeId: string;
    name: string;
    category: Category;
    collected: boolean;
    locked?: boolean;
  };
  /**
   * Show me this on the map — and, for a levada, its whole course (D-055).
   * Present on the passport's card and absent on the map's own, where it
   * would mean nothing.
   */
  onShowOnMap?: () => void;
  onClose: () => void;
};

export default function PlaceCardView({
  card,
  palette = 'light',
  stamp,
  onShowOnMap,
  onClose,
}: PlaceCardViewProps) {
  const tone = PALETTES[palette];
  const heading = (
    <View style={styles.heading}>
      <Text style={[styles.meta, { color: tone.muted }]}>{card.metaLabel}</Text>
      {/* No `numberOfLines`: a long Portuguese place name must wrap rather
          than be cut, and at 2× text scaling most of them will. */}
      <Text style={[styles.name, { color: tone.text }]}>{card.name}</Text>
    </View>
  );

  return (
    // ⚠ Not `accessibilityViewIsModal`. The card is deliberately *not* modal —
    // the passport and settings stay reachable while it is open — and marking
    // it modal hides the rest of the screen from a screen reader, which would
    // make that untrue for exactly the users who can least afford it.
    <View style={[styles.card, { backgroundColor: tone.sheet }]}>
      {/* The grabber. It is not draggable and does not pretend to be — it is
          the mark that says "this is a sheet over the thing behind it", which
          is how iOS distinguishes a temporary surface from a screen. Hidden
          from screen readers, which get the same information from the fact
          that this is a group with a Close button in it. */}
      <View
        style={[styles.grabber, { backgroundColor: tone.grabber }]}
        accessibilityElementsHidden
      />

      {stamp === undefined ? (
        heading
      ) : (
        <View style={styles.stampRow}>
          {/* Drawn exactly as the passport cell draws it, locked included:
              a locked stamp shows its muted art there, so it does here. The
              name and state are in the text beside it, so the sticker is
              hidden from screen readers (StampArt). */}
          <StampArt
            placeId={stamp.placeId}
            design={designFor(stamp.placeId, stamp.category)}
            name={stamp.name}
            collected={stamp.locked === true ? false : stamp.collected}
            size={Math.floor(CARD_STAMP_SIZE * TILT_FIT)}
          />
          {heading}
        </View>
      )}

      {/* T-201: the reason to go (review P1-4). Under the name, because it is
          about the place; above the municipality and the distance, which are
          about getting there. */}
      {card.whyLine === null ? null : (
        <Text style={[styles.why, { color: tone.text }]}>{card.whyLine}</Text>
      )}

      {/* The municipality (T-067, D-027) — *where is this*, which is the one
          question the card could not answer.
          ⚠ **Its own line, and not appended to the line above.** Measured in
          the workbench at 390 px: the meta line has 324 px, and
          "LEVADA WALK · CÂMARA DE LOBOS · COLLECTED" needs 347 — so the worst
          realistic case wraps into two lines of tracked capitals above the
          name, and the wrapping is invisible until a levada in the longest-named
          municipality is collected. Down here it is sentence case, it is the
          geography rather than the status, and it sits next to the distance,
          which is the other answer to the same question. */}
      {card.regionLabel === null ? null : (
        <Text style={[styles.region, { color: tone.text }]}>{card.regionLabel}</Text>
      )}

      {card.distanceSentence === null ? null : (
        // The qualification travels with the number (`placeCard.ts` rule 2).
        // On this island a straight line and a drive are very different
        // things, and the card must not be read as the second one.
        <Text style={[styles.distance, { color: tone.muted }]}>{card.distanceSentence}</Text>
      )}

      {/* One filled button when there is somewhere to go, and a plain tinted
          way out — the iOS convention (D-054). Each row is full width, because
          controls sharing a phone's width is how a 60 dp target quietly
          becomes a 40 dp one at large text sizes. */}
      {onShowOnMap === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            card.hasCourse
              ? t('placeCard.a11y.showWithCourse', { name: card.name })
              : t('placeCard.a11y.show', { name: card.name })
          }
          onPress={onShowOnMap}
          style={({ pressed }) => [
            styles.directions,
            { backgroundColor: tone.action },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.directionsText, { color: tone.actionText }]}>
            {t('placeCard.showOnMap')}
          </Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        style={({ pressed }) => [styles.plainButton, pressed && styles.pressed]}
      >
        <Text style={[styles.plainButtonText, { color: tone.tint }]}>{t('common.close')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // ⚠ `surfaceRaised`, **not** `surface`, and a shadow under it. On the
    // passport the cards behind this are `surface`, so a sheet painted the
    // same colour looked like it was *inside* the Levadas card rather than
    // floating over the screen — a screenshot caught that immediately. A
    // sheet has to be a step above whatever it covers.
    // The fill comes from the palette: `surfaceRaised` over the map, the album's
    // surface over the passport.
    // A sheet, not a card: iOS rounds these hard, and the radius is most of
    // what says "temporary surface" without drawing a single line.
    borderRadius: radius.sheet,
    // Both spellings: `elevation` is Android's, the `shadow*` family is iOS's,
    // and this component ships on both.
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  stampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heading: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.75 },

  meta: {
    fontSize: fontSize.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: fontSize.title,
    fontWeight: '800',
  },
  why: {
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.35,
    // Clear of the municipality under it, which is the same size and colour.
    marginBottom: spacing.sm,
  },
  // Body weight, a step above the distance under it. The municipality is a
  // fact about the place; the distance is a qualified estimate about the
  // reader, and reads as the footnote it is.
  region: {
    fontSize: fontSize.body,
  },
  distance: {
    fontSize: fontSize.small,
  },
  directions: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    marginTop: spacing.sm,
  },
  directionsText: {
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  plainButton: {
    // No fill and no border: on iOS a secondary action is tinted text, and
    // the 60 dp target is held by the row's height rather than by a box drawn
    // around it (D-015 — the target is a size, not an outline).
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});

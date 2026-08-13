/**
 * The place card (T-115, D-018) — the app's only detail view.
 *
 * WHAT D-018 ALLOWS ON IT
 * -----------------------
 * *Name, photo, distance, and a single Directions button.* No description, no
 * opening hours, no reviews, no "nearby" list, and above all no route drawn on
 * our map. Every one of those is a content obligation somebody has to maintain
 * offline, and the app's answer to all of them is the maps app the user
 * already has.
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
 * Presentational: props in, pixels out, so the workbench (D-038) can mount it
 * without a map, a database or a location.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlaceCard } from '../places/placeCard';
import { STRAIGHT_LINE_NOTE } from '../places/placeCard';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

export type PlaceCardViewProps = {
  card: PlaceCard;
  /**
   * Something to tell the user, or null. Set when the handoff found no maps
   * app — a silent no-op on the one button the card has would be indefensible.
   */
  notice: string | null;
  onDirections: () => void;
  /**
   * Take me there on the map. Present on the passport's card and absent on
   * the map's own, where it would mean nothing (T-115, D-052 revised).
   */
  onShowOnMap?: () => void;
  onClose: () => void;
};

export default function PlaceCardView({
  card,
  notice,
  onDirections,
  onShowOnMap,
  onClose,
}: PlaceCardViewProps) {
  return (
    // ⚠ Not `accessibilityViewIsModal`. The card is deliberately *not* modal —
    // the passport and settings stay reachable while it is open — and marking
    // it modal hides the rest of the screen from a screen reader, which would
    // make that untrue for exactly the users who can least afford it.
    <View style={styles.card}>
      <Text style={styles.meta}>
        {card.collected ? `${card.categoryLabel} · Collected` : card.categoryLabel}
      </Text>

      {/* No `numberOfLines`: a long Portuguese place name must wrap rather
          than be cut, and at 2× text scaling most of them will. */}
      <Text style={styles.name}>{card.name}</Text>

      {card.distanceLabel === null ? null : (
        // The qualification travels with the number (`placeCard.ts` rule 2).
        // On this island a straight line and a drive are very different
        // things, and the card must not be read as the second one.
        <Text style={styles.distance}>
          {card.distanceLabel} away, {STRAIGHT_LINE_NOTE}
        </Text>
      )}

      {notice === null ? null : <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.buttons}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Directions to ${card.name} in your maps app`}
          onPress={onDirections}
          style={({ pressed }) => [styles.directions, pressed && styles.pressed]}
        >
          <Text style={styles.directionsText}>Directions</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      {onShowOnMap === undefined ? null : (
        // Its own row rather than a third button squeezed into the one above:
        // three controls sharing a phone's width is how a 60 dp target
        // quietly becomes a 40 dp one at large text sizes.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Show ${card.name} on the map`}
          onPress={onShowOnMap}
          style={({ pressed }) => [styles.showOnMap, pressed && styles.pressed]}
        >
          <Text style={styles.closeText}>Show on map</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.75 },

  meta: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '800',
  },
  distance: {
    color: colors.textMuted,
    fontSize: fontSize.small,
  },
  notice: {
    color: colors.warn,
    fontSize: fontSize.small,
    fontWeight: '700',
  },

  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  directions: {
    // The card's one action, so it takes the room. 60 dp, D-015.
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.action,
  },
  directionsText: {
    color: colors.actionText,
    fontSize: fontSize.body,
    fontWeight: '800',
  },
  close: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  showOnMap: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});

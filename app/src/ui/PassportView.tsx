/**
 * The passport (T-074) — the second shareable screen.
 *
 * ORGANISED BY CATEGORY, ALWAYS FIVE ROWS (D-027)
 * ----------------------------------------------
 * Viewpoints · Levadas · Villages · Beaches · Landmarks. There is deliberately
 * no "Other": a place that fits nowhere is a signal about the place, not a
 * missing row (D-027). Empty categories still render, because a passport whose
 * pages appear and disappear as you travel is not a passport — the fixed set
 * of pages to fill *is* the metaphor (CONTEXT §4.2).
 *
 * Region progress is not here. It belongs on the map screen, doing the "where
 * should I go next" job (D-027).
 *
 * A STAMP IS A DOOR BACK TO THE MAP (T-115, D-052 revised)
 * -------------------------------------------------------
 * Tapping one opens its card — the same card the map shows — with *Show on
 * map* and *Directions*. This is the project lead's instruction of 2026-08-13,
 * and it replaced a layer of dots drawn over every curated place: the map
 * belongs to the trace (D-032), and the way to ask about a place is to ask
 * about the stamp you earned there.
 *
 * THE LEVADA ROW IS DIFFERENT IN KIND
 * -----------------------------------
 * Every other category means *you arrived somewhere*. A levada means *you
 * walked the whole thing* — both endpoints verified (D-009, D-037). It is the
 * hardest stamp to earn and the design brief says it should look like it, so
 * it carries a marker the others do not.
 *
 * PRESENTATIONAL ON PURPOSE
 * -------------------------
 * Props in, pixels out — no database, no clock. That is what lets the design
 * workbench (`App.web.tsx`) mount it against fixtures and answer T-081 —
 * *legible with 3 stamps and with 200* — in a browser, in seconds.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../content/contentPack';
import { designFor, TILT_FIT } from '../passport/stampArt';
import type { TripProgress } from '../progress/tripProgress';
import type { StampAward } from '../storage/types';
import StampArt from './StampArt';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

/**
 * How big a sticker is drawn, in dp.
 *
 * ⚠ **Raised from 62 on 2026-08-13, after somebody finally looked at it.** The
 * old number came from T-081's density measurement, which asked *does it still
 * fit* and got a yes. A screenshot of the real screen answered a question the
 * measurement never asked: at 62 dp the stamps are postage stamps in a mostly
 * empty card, their names are unreadable, and the artwork — the one thing in
 * this app that is not a rectangle, and the entire reward (D-046) — reads as
 * an icon rather than as something earned.
 *
 * 96 is still three across on a 360 dp phone, which was the constraint the old
 * number was protecting. D-049 cut the canvas to ~80 places, so the worst row
 * is now around 20 stamps rather than 40 — the scroll this was guarding
 * against got shorter at the same time as the reason to grow got clearer.
 */
const STAMP_SIZE = 96;

/** The drawing, shrunk so its tilted corners stay inside the cell. */
const STAMP_DRAW_SIZE = Math.floor(STAMP_SIZE * TILT_FIT);

/**
 * What each row is called, in the user's words.
 *
 * The plural display names live here rather than in the content pack because
 * they are **UI**, and the app is English-only (CONTEXT §1). Place names are
 * the opposite case — those are content, and render in Portuguese.
 */
const CATEGORY_LABELS: Record<Category, string> = {
  viewpoint: 'Viewpoints',
  levada: 'Levadas',
  village: 'Villages',
  beach: 'Beaches',
  landmark: 'Landmarks',
};


/** A stamp the user has earned, with what it takes to draw it (T-070). */
export type PassportStamp = {
  placeId: string;
  name: string;
  category: Category;
};

export type PassportViewProps = {
  progress: TripProgress;
  /**
   * A stamp was tapped. Absent in the workbench, where there is nowhere to go.
   */
  onSelectStamp?: (stamp: PassportStamp) => void;
  /** Awarded stamps, any order. Used for counts per row and for the dates. */
  awards: StampAward[];
  /**
   * The collected places, with their names, so the real artwork can be drawn
   * (T-070). Falls back to nothing when the caller has not resolved them —
   * the row counts still come from `progress`, so a passport with no names is
   * a passport with no stickers rather than a broken screen.
   */
  stamps?: PassportStamp[];
};

function CategoryRow({
  category,
  collected,
  total,
  stamps,
  onSelectStamp,
}: {
  category: Category;
  collected: number;
  total: number;
  stamps: PassportStamp[];
  onSelectStamp?: (stamp: PassportStamp) => void;
}) {

  const isEmpty = collected === 0 || stamps.length === 0;

  return (
    // An empty row is a slim line, not a full card. Five of them at full
    // height was most of a screen of dark grey slabs saying nothing — the
    // passport looked emptier than it was, which is the opposite of what
    // CONTEXT §4.1 asks a nearly-empty collection to feel like.
    <View style={[styles.row, isEmpty && styles.rowEmptyCard]}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{CATEGORY_LABELS[category]}</Text>
        {/* The count is text, not a bar. A progress bar at 3/40 reads as
            failure; "3 of 40" reads as a start (CONTEXT §4.1). */}
        <Text style={styles.rowCount}>
          {total === 0 ? '—' : `${collected} of ${total}`}
        </Text>
      </View>

      {/* An empty row is just its header. Five near-identical "no X yet"
          lines was measured at 1.1 screens on day one — a scroll that reveals
          nothing — and reads as five small failures rather than one
          invitation. The invitation is given once, under the hero. */}
      {isEmpty ? null : (
        <View style={styles.stamps}>
          {stamps.map((stamp) => (
            // The cell is 62 dp, comfortably over D-015's 60 — which is why
            // the sticker is the tap target rather than a button beside it.
            <Pressable
              key={stamp.placeId}
              accessibilityRole="button"
              accessibilityLabel={`${stamp.name}. Open for directions or to show it on the map.`}
              onPress={
                onSelectStamp === undefined
                  ? undefined
                  : () => onSelectStamp(stamp)
              }
              style={({ pressed }) => [
                styles.stampCell,
                pressed && styles.stampCellPressed,
              ]}
            >
              <StampArt
                placeId={stamp.placeId}
                design={designFor(stamp.placeId, stamp.category)}
                name={stamp.name}
                collected
                size={STAMP_DRAW_SIZE}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function PassportView({
  progress,
  awards,
  stamps,
  onSelectStamp,
}: PassportViewProps) {
  const hasContent = progress.total > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      // The header is the hero; let it scroll away rather than pin it. There
      // is only one number and the user has already read it.
    >
      <Text style={styles.heading}>Passport</Text>

      {hasContent ? (
        <View style={styles.hero}>
          <Text style={styles.heroNumber}>
            {progress.collected}
            <Text style={styles.heroTotal}> / {progress.total}</Text>
          </Text>
          <Text style={styles.heroLabel}>
            {progress.collected === 0
              ? 'places to collect'
              : progress.collected === 1
                ? 'place collected'
                : 'places collected'}
          </Text>
          {progress.collected === 0 ? (
            <Text style={styles.heroInvitation}>
              Go somewhere. They fill in by themselves.
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.rowEmpty}>
          No places are curated yet, so there is nothing to collect. (T-066)
        </Text>
      )}

      {progress.byCategory.map((row) => (
        <CategoryRow
          key={row.category}
          category={row.category}
          collected={row.collected}
          total={row.total}
          stamps={(stamps ?? []).filter(
            (stamp) => stamp.category === row.category
          )}
          onSelectStamp={onSelectStamp}
        />
      ))}

      {awards.length > 0 ? (
        <Text style={styles.footnote}>
          Most recent: {new Date(
            Math.max(...awards.map((award) => award.awarded_ts))
          ).toLocaleDateString()}
        </Text>
      ) : null}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.md,
    paddingTop: spacing.xl * 2,
    // Clear of the floating Map button, which is 60 dp sitting `xl` off the
    // bottom: without this the last category row slides under it, which a
    // screenshot caught and the workbench did not (the button is the screen's,
    // not the view's).
    paddingBottom: spacing.xl * 2 + MIN_TAP_TARGET,
    // md, not lg: with five rows the inter-row gap is the largest single
    // contributor to how far a nearly-empty passport scrolls.
    gap: spacing.md,
  },
  heading: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  heroNumber: {
    color: colors.text,
    fontSize: fontSize.hero,
    fontWeight: '800',
  },
  heroTotal: {
    color: colors.textMuted,
    fontSize: fontSize.title,
    fontWeight: '600',
  },
  heroLabel: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    marginTop: spacing.xs,
  },
  heroInvitation: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  rowEmptyCard: {
    // No sticker to hold, so no room held for one.
    paddingVertical: spacing.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surface,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  rowTitle: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  rowCount: {
    color: colors.textMuted,
    fontSize: fontSize.body,
  },
  rowEmpty: {
    color: colors.textMuted,
    fontSize: fontSize.small,
  },
  stamps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stampCell: {
    width: STAMP_SIZE,
    height: STAMP_SIZE,
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampCellPressed: { opacity: 0.6 },
  footnote: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    textAlign: 'center',
  },
});

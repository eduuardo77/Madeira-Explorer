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

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../content/contentPack';
import { designFor, TILT_FIT } from '../passport/stampArt';
import type { TripProgress } from '../progress/tripProgress';
import type { StampAward } from '../storage/types';
import StampArt from './StampArt';
import { colors, fontSize, spacing } from './theme';

/**
 * How big a sticker is drawn, in dp.
 *
 * Sized from T-081's measurement rather than picked: the placeholder disc was
 * 44 and the row density it produced is what the passport was judged at. A
 * sticker carries a name as well as a silhouette, so it needs more room — but
 * not so much that a 40-stamp category becomes a scroll.
 */
const STAMP_SIZE = 62;

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
}: {
  category: Category;
  collected: number;
  total: number;
  stamps: PassportStamp[];
}) {

  return (
    <View style={styles.row}>
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
      {collected > 0 && stamps.length > 0 ? (
        <View style={styles.stamps}>
          {stamps.map((stamp) => (
            <View key={stamp.placeId} style={styles.stampCell}>
              <StampArt
                placeId={stamp.placeId}
                design={designFor(stamp.placeId, stamp.category)}
                name={stamp.name}
                collected
                size={STAMP_DRAW_SIZE}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function PassportView({
  progress,
  awards,
  stamps,
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
    paddingBottom: spacing.xl * 2,
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
    gap: spacing.sm,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    textAlign: 'center',
  },
});

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
 * map*, which draws the place's course on the map. This is the project lead's
 * instruction of 2026-08-13, and it replaced a layer of dots drawn over every
 * curated place: the map belongs to the trace (D-032), and the way to ask about
 * a place is to ask about the stamp you earned there. There is no *Directions*
 * button and there was one for a day: *we aren't a navigator*.
 *
 * A ROW SWIPES; "SEE ALL" OPENS IT (project lead, 2026-08-14)
 * ----------------------------------------------------------
 * With 80 curated places the five wrapped grids were one very long page, and
 * the hero — the number you came to see — scrolled away before the second
 * category. Each row is now a **single horizontal strip** you swipe, with the
 * next sticker deliberately half-visible at the edge so it reads as "there are
 * more" rather than as "that is all of them", and a **See all** that unwraps
 * that row into the grid this file drew before.
 *
 * ⚠ The grid did not go away, and that matters: *See all* is the only way to
 * survey a category, and D-058's point — the uncollected places are the
 * recommendations — needs a view where you can see them all at once.
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

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Category } from '../content/contentPack';
import { designFor, TILT_FIT } from '../passport/stampArt';
import type { ConfirmationPrompt } from '../progress/stampConfirmation';
import type { TripProgress } from '../progress/tripProgress';
import type { StampAward } from '../storage/types';
import StampArt from './StampArt';
import { n, t } from '../i18n';
import { colors, fontSize, MIN_TAP_TARGET, radius, spacing } from './theme';

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
 * The padlock, in dp.
 *
 * Small on purpose. It has to be readable at arm's length and it must not
 * compete with the sticker underneath — the stamp is what the user is being
 * invited to want, and a badge that shouts turns an invitation into a nag
 * (design brief §3).
 */
const LOCK_GLYPH = 12;

/**
 * What each row is called, in the user's words.
 *
 * The plural display names live here rather than in the content pack because
 * they are **UI**, and the app is English-only (CONTEXT §1). Place names are
 * the opposite case — those are content, and render in Portuguese.
 */
/**
 * ⚠ A function, not a constant (T-160). A module-level object would be built
 * once at import, before the device language is known, and every user would get
 * whichever language happened to load first.
 */
const categoryLabel = (category: Category): string =>
  ({
    viewpoint: t('passport.category.viewpoint'),
    levada: t('passport.category.levada'),
    village: t('passport.category.village'),
    beach: t('passport.category.beach'),
    landmark: t('passport.category.landmark'),
  })[category];

/**
 * How many stickers a row may hold before *See all* is worth offering.
 *
 * Three fit across a 360 dp phone at `STAMP_SIZE`, so four is the first count
 * that genuinely scrolls. Below that the strip already shows everything and the
 * button would expand a row into the identical row.
 *
 * ⚠ A constant rather than a measurement. `onLayout` would be exact and would
 * also arrive a frame late, and this project has already paid for one
 * measured-inset-arrives-late bug (the card that overlapped the passport
 * button, 2026-08-13). The cost of being wrong here is a button that opens a
 * row you could already see.
 */
const MIN_STAMPS_FOR_SEE_ALL = 4;

/**
 * What *See all* has to be pressed by, given that it is two small words.
 *
 * ⚠ **It was `spacing.sm` on every side, and that was not enough.** The word
 * renders as a **41 × 19 dp** box, so eight all round made a **57 × 35** target
 * against the 60 dp `MIN_TAP_TARGET` that D-015 chose over the platform's 44 —
 * failing in both directions, on the one control an older user needs in order
 * to see a whole category.
 *
 * ⚠ **No measurement could have caught it, and one was run.** T-113 measured
 * every control in the workbench and found nothing, because `hitSlop` is a
 * prop rather than a style: react-native-web does not render it, so the DOM
 * shows the *word*, not the target. The workbench sees 41 × 19 whatever this
 * value is. It is the same shape as T-145 — the thing under test was not the
 * thing that ships.
 *
 * The numbers are asymmetric because the room is. Measured at both 320 and
 * 390 dp: **32 dp of clear header above, 24 dp to the first sticker below,
 * 21 dp to the screen edge on the right.** These leave ~8 dp of clearance on
 * each side, so a grown target still cannot become a mis-tap for a sticker —
 * which is the failure the two bottom controls are separated to avoid, one
 * screen along.
 */
const SEE_ALL_HIT_SLOP = { top: 24, bottom: 17, left: 12, right: 12 };


/**
 * A place in the collection, earned or not (T-070, D-058).
 *
 * ⚠ **Every curated place appears here, not only the collected ones.** The
 * project lead asked for that on 2026-08-14, and it closes a hole this app has
 * had since the map's place markers were deleted (D-052): there was no way to
 * see somewhere you had *not* been, so a user on day one had an empty passport
 * and nothing to aim at.
 *
 * CONTEXT §4.1 already said this in as many words — *the uncollected places
 * are the recommendations* — and `stampArt.ts` has drawn a muted version since
 * T-070. The passport was the only thing that never asked for them.
 */
export type PassportStamp = {
  placeId: string;
  name: string;
  category: Category;
  /** False draws the muted design (`stampArt.ts`) and reads "not collected yet". */
  collected: boolean;
  /**
   * Earned, kept forever, and behind the €4.99 unlock (T-155, D-072).
   *
   * ⚠ **A third state, and it had to be.** The cheap implementation of a free
   * tier is to draw an earned-but-unpaid stamp as *not collected*, and that is
   * the app telling the user they did not go somewhere they went. This project
   * does not do that anywhere else — T-149 refuses to ask twice about a walk
   * for the same reason — so a locked stamp keeps the muted drawing but says
   * what it is: yours, and not shown yet.
   */
  locked?: boolean;
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
   * Every curated place, with its name and whether it has been collected, so
   * the real artwork can be drawn (T-070). Falls back to nothing when the
   * caller has not resolved them — the row counts still come from `progress`,
   * so a passport with no names is a passport with no stickers rather than a
   * broken screen.
   */
  stamps?: PassportStamp[];
  /**
   * The one walk the app wants settled (T-149, D-065), or absent.
   *
   * ⚠ **Above the rows and below the hero, on purpose.** It is a question the
   * app is asking *the user*, so burying it under five category rows would
   * mean it is never seen; putting it above the hero would mean the passport
   * greets you with a chore instead of your number. It is also the only thing
   * on this screen that is ever more than one tap deep.
   */
  confirmation?: ConfirmationPrompt;
  onConfirm?: (placeId: string) => void;
  onDecline?: (placeId: string) => void;
  /**
   * Watch the trip back (T-105e, OD-12). Absent in the workbench.
   *
   * ⚠ **Under the hero, and only once there is something to watch.** That slot
   * already holds the app's one invitation — *"go to one and it fills in by
   * itself"* — which shows at zero collected and nothing else does. The two are
   * mutually exclusive by construction: before the first stamp there is no film,
   * and after it the invitation has done its job.
   */
  onWatch?: () => void;
};

/**
 * The mark on an earned stamp the user has not paid to see (T-155, D-072).
 *
 * ⚠ **Drawn here rather than in `stampArt.ts`, deliberately.** That module owns
 * the stamp *design* and has a second renderer (`tools/preview-stamps.mjs`)
 * precisely so the artwork that gets approved is the artwork that ships. A
 * paywall marker is not artwork the user earned — it is chrome the app puts on
 * top, and it should disappear from the design the moment T-156 takes the money.
 * Keeping it out of `stampArt.ts` is what makes that a deletion of six lines.
 *
 * A drawn padlock rather than a glyph: the emoji renders differently on every
 * OEM skin, and a font that lacks it draws a box.
 */
function LockBadge() {
  return (
    <View
      style={styles.lockBadge}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Svg width={LOCK_GLYPH} height={LOCK_GLYPH} viewBox="0 0 12 12">
        {/* The shackle: an open arc, stroked, sitting on the body. */}
        <Path
          d="M3.6 5.2V3.9a2.4 2.4 0 0 1 4.8 0v1.3"
          stroke={colors.text}
          strokeWidth={1.4}
          strokeLinecap="round"
          fill="none"
        />
        <Rect x={2.3} y={5.2} width={7.4} height={5.3} rx={1.2} fill={colors.text} />
      </Svg>
    </View>
  );
}

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

  // Empty means *no places curated in this category at all* — not "none
  // collected". A category with places to aim at always shows them (D-058).
  const isEmpty = stamps.length === 0;

  // Collapsed by default, per row, and not remembered. A passport you reopen
  // looks the way it looked the first time; the hero is at the top and the five
  // categories are all on one screen.
  const [expanded, setExpanded] = useState(false);
  const canExpand = stamps.length >= MIN_STAMPS_FOR_SEE_ALL;

  // ⚠ In the strip, what you earned comes first. The collapsed row shows about
  // three and a half stickers, and with 18 landmarks in pack order the one you
  // actually collected sat half off the edge — the reward (D-046) hidden behind
  // a swipe, underneath places you have never been.
  //
  // The expanded grid deliberately keeps pack order: that view is the survey
  // D-058 asks for, and a list that reorders itself as you collect is a list
  // you cannot find anything in twice.
  const ordered = expanded
    ? stamps
    : [
        ...stamps.filter((stamp) => stamp.collected),
        ...stamps.filter((stamp) => !stamp.collected),
      ];

  const cells = ordered.map((stamp) => {
    // ⚠ Locked draws the muted artwork — the same drawing as an uncollected
    // place — because the artwork *is* the thing being sold (D-046), and the
    // badge is what stops that drawing being read as "you never went".
    const locked = stamp.locked === true;

    return (
      // The cell is 96 dp, well over D-015's 60 — which is why the sticker
      // itself is the tap target rather than a button beside it.
      <Pressable
        key={stamp.placeId}
        accessibilityRole="button"
        accessibilityLabel={
          locked
            ? t('passport.locked.a11y', { name: stamp.name })
            : stamp.collected
              ? t('passport.a11y.stampCollected', { name: stamp.name })
              : t('passport.a11y.stampUncollected', { name: stamp.name })
        }
        onPress={
          onSelectStamp === undefined ? undefined : () => onSelectStamp(stamp)
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
          collected={locked ? false : stamp.collected}
          // The sticker's own label would append "not collected yet", which is
          // exactly the sentence a locked stamp must never say.
          label={locked ? t('passport.locked.a11y', { name: stamp.name }) : undefined}
          size={STAMP_DRAW_SIZE}
        />
        {locked ? <LockBadge /> : null}
      </Pressable>
    );
  });

  return (
    // iOS grouped-inset list (D-054): the section's name sits **above** the
    // card in small uppercase grey, and the card holds only content. It is the
    // single change that makes five rows read as one system rather than as
    // five boxes — and an empty category becomes a heading with nothing under
    // it, instead of a full-height slab saying "0 of 1".
    <View style={styles.section}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{categoryLabel(category)}</Text>
        {/* The count is text, not a bar. A progress bar at 3/40 reads as
            failure; "3 of 40" reads as a start (CONTEXT §4.1). */}
        <View style={styles.rowHeaderRight}>
          <Text style={styles.rowCount}>
            {total === 0 ? '—' : `${collected} of ${total}`}
          </Text>
          {/* iOS puts this exact control here — a tinted word at the trailing
              edge of a section header — which is most of why the row reads as
              a system list rather than as an app-shaped box (D-054). */}
          {canExpand ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                expanded
                  ? t('passport.a11y.collapseRow', { category: categoryLabel(category) })
                  : t('passport.a11y.seeAllRow', {
                      total,
                      category: categoryLabel(category),
                    })
              }
              onPress={() => setExpanded((open) => !open)}
              // The word is small, so the tap target is grown around it
              // rather than left at the size of the text (D-015).
              hitSlop={SEE_ALL_HIT_SLOP}
              style={({ pressed }) => [pressed && styles.seeAllPressed]}
            >
              <Text style={styles.seeAll}>
                {expanded ? t('passport.showLess') : t('passport.seeAll')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* An empty category is its heading and nothing else — no card, no
          reserved space. Five near-identical "no X yet" lines was measured at
          1.1 screens on day one, and read as five small failures rather than
          one invitation; the invitation is given once, under the hero. */}
      {isEmpty ? null : expanded ? (
        <View style={styles.stampsGrid}>{cells}</View>
      ) : (
        <View style={styles.stampsStrip}>
          <ScrollView
            horizontal
            // The bar would sit across the bottom of the stickers, and the
            // half-visible sticker at the edge already says "there is more".
            showsHorizontalScrollIndicator={false}
            // ⚠ The padding lives on the *content*, not on the strip. Put it on
            // the container and the last sticker stops short of the card edge
            // with a gap of dead space behind it, which reads as the end of the
            // row — the opposite of what the strip is for.
            contentContainerStyle={styles.stripContent}
          >
            {cells}
          </ScrollView>
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
  confirmation,
  onConfirm,
  onDecline,
  onWatch,
}: PassportViewProps) {
  const hasContent = progress.total > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      // The header is the hero; let it scroll away rather than pin it. There
      // is only one number and the user has already read it.
    >
      <Text style={styles.heading}>{t('passport.title')}</Text>

      {hasContent ? (
        <View style={styles.hero}>
          <Text style={styles.heroNumber}>
            {progress.collected}
            <Text style={styles.heroTotal}> / {progress.total}</Text>
          </Text>
          <Text style={styles.heroLabel}>
            {/* ⚠ Zero is not the plural of anything here — it is a different
                sentence. Before you have been anywhere the number is a target
                ("places to collect"), and afterwards it is a record ("places
                collected"). `n()` handles one-versus-many; the zero case is its
                own string. */}
            {progress.collected === 0
              ? t('passport.toCollect')
              : n('passport.collected', progress.collected)}
          </Text>
          {progress.collected === 0 ? (
            <Text style={styles.heroInvitation}>{t('passport.invitation')}</Text>
          ) : onWatch === undefined ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('replay.a11y.play')}
              onPress={onWatch}
              // Two words, so the target is grown around them rather than left
              // at the size of the text (D-015).
              hitSlop={SEE_ALL_HIT_SLOP}
              style={({ pressed }) => [pressed && styles.seeAllPressed]}
            >
              <Text style={styles.heroAction}>{t('replay.watch')}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Text style={styles.rowEmpty}>{t('passport.nothingCurated')}</Text>
      )}

      {confirmation === undefined ? null : (
        <View style={styles.confirmation}>
          <Text style={styles.confirmQuestion}>{confirmation.question}</Text>
          {/* The evidence, in the question. The answer should be a memory
              check, not a guess about what the app wants to hear. */}
          <Text style={styles.confirmDetail}>{confirmation.detail}</Text>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${confirmation.confirmLabel} — ${confirmation.question}`}
              onPress={() => onConfirm?.(confirmation.placeId)}
              style={({ pressed }) => [styles.confirmYes, pressed && styles.confirmPressed]}
            >
              <Text style={styles.confirmYesText}>{confirmation.confirmLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${confirmation.declineLabel} — ${confirmation.question}`}
              onPress={() => onDecline?.(confirmation.placeId)}
              style={({ pressed }) => [styles.confirmNo, pressed && styles.confirmPressed]}
            >
              <Text style={styles.confirmNoText}>{confirmation.declineLabel}</Text>
            </Pressable>
          </View>
        </View>
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
    // Room for the navigation bar the screen draws above this (`‹ Map`).
    paddingTop: spacing.xl + MIN_TAP_TARGET + spacing.sm,
    paddingBottom: spacing.xl * 2,
    // md, not lg: with five rows the inter-row gap is the largest single
    // contributor to how far a nearly-empty passport scrolls.
    gap: spacing.md,
  },
  heading: {
    color: colors.text,
    // The iOS large title. One screen, one name, said once and said big.
    fontSize: fontSize.largeTitle,
    fontWeight: '700',
    letterSpacing: 0.4,
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
  // The same slot as `heroInvitation`, in the tinted-word register iOS uses for
  // a section action — not a filled button, which would make the passport's
  // quietest area its loudest.
  heroAction: {
    color: colors.tint,
    fontSize: fontSize.body,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  heroInvitation: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
    // The heading belongs to the card below it, not to the gap above it.
    paddingHorizontal: spacing.xs,
  },
  rowTitle: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rowHeaderRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  rowCount: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  seeAll: {
    // Tinted, because it is the only thing in the header you can press.
    color: colors.tint,
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  seeAllPressed: { opacity: 0.5 },
  // A card, like a category row, because it belongs to this screen rather than
  // floating over it — and bordered rather than filled, so it reads as a
  // question rather than as an award already won.
  confirmation: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.tint,
    padding: spacing.md,
    gap: spacing.xs,
  },
  confirmQuestion: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  confirmDetail: {
    color: colors.textMuted,
    fontSize: fontSize.small,
  },
  // Stacked, never side by side: two 60 dp targets sharing a phone's width is
  // how a tap target quietly becomes 40 dp at large text sizes (T-113).
  confirmActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  confirmYes: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.action,
  },
  confirmYesText: {
    color: colors.actionText,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  confirmNo: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPressed: { opacity: 0.75 },
  confirmNoText: {
    color: colors.tint,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  rowEmpty: {
    color: colors.textMuted,
    fontSize: fontSize.small,
  },
  /** Expanded: the wrapped grid, unchanged since T-074. */
  stampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  /** Collapsed: the same card, holding one scrolling row. */
  stampsStrip: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    // Vertical only. The horizontal padding belongs to the content, so that a
    // sticker can scroll all the way to the rounded edge and be clipped by it.
    paddingVertical: spacing.md,
    // ⚠ Without this the row scrolls out over the card's corners. The card is
    // the frame; the strip has to be cut by it.
    overflow: 'hidden',
  },
  stripContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
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
  // Top-trailing corner of the cell, clear of the tilted sticker's name band,
  // which sits along the bottom.
  lockBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: LOCK_GLYPH + spacing.xs,
    height: LOCK_GLYPH + spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // A disc behind it, so the mark reads against whatever colourway the muted
    // sticker happens to be showing through.
    backgroundColor: colors.background,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    textAlign: 'center',
  },
});

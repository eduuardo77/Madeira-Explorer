/**
 * How big a passport sticker is, so that a row always shows it scrolls (T-219).
 *
 * A category row is one horizontal strip, and the only thing that says "swipe
 * for more" is the next sticker cut off at the card's edge (`PassportView`).
 * At a fixed 96 dp that worked on some widths and failed on the one that
 * mattered: on a **360 dp** phone, the P30's width, three stickers and their
 * gaps fill the strip to the pixel and the fourth begins exactly at the edge.
 * The second review (N10) saw a row of three with nothing to suggest a fourth.
 *
 * So the sticker keeps its full size wherever the cut already reads, and
 * shrinks only as far as it takes to show a clear part of the next one.
 *
 * Pure: widths in, a size out. `PassportView` passes the window's width.
 */

/**
 * The size the stickers were chosen at, and never exceeded.
 *
 * Raised from 62 on 2026-08-13, after somebody looked at it: at 62 the stamps
 * were postage stamps in an empty card, their names unreadable, and the
 * artwork, the entire reward (D-046), read as an icon rather than something
 * earned.
 */
export const MAX_STAMP_SIZE = 96;

/**
 * Never smaller than this. ⚠ A floor, not a measurement: well over the 60 dp
 * tap target and clear of the 62 dp judged too small on 2026-08-13. Computed
 * over 320 to 480 dp, nothing reaches it: the smallest is 78, at 338 dp, and
 * the P30's 360 gets 84 (peek 0.43).
 */
export const MIN_STAMP_SIZE = 76;

/**
 * How much of the next sticker must show for the cut to read as "more".
 * Below a quarter it reads as a stray edge; above 0.85 as a whole sticker
 * that happens to touch the border.
 */
export const MIN_PEEK = 0.25;
export const MAX_PEEK = 0.85;

/** The share of the next sticker shown when the size has to be adjusted. */
export const TARGET_PEEK = 0.4;

export type StripGeometry = {
  /** The strip's visible width: the card, inside the page's padding. */
  stripWidth: number;
  /** Space before the first sticker (the strip's leading padding). */
  leading: number;
  /** Space between stickers. */
  gap: number;
};

/** The share of the first sticker that does not fit whole, 0 to 1. */
export function peekAt(size: number, geometry: StripGeometry): number {
  const room = geometry.stripWidth - geometry.leading;
  const pitch = size + geometry.gap;
  const whole = Math.floor((room + geometry.gap) / pitch);
  const left = room - whole * pitch;
  return Math.min(Math.max(left / size, 0), 1);
}

export function stripStampSize(geometry: StripGeometry): number {
  const peek = peekAt(MAX_STAMP_SIZE, geometry);
  if (peek >= MIN_PEEK && peek <= MAX_PEEK) {
    return MAX_STAMP_SIZE;
  }

  // Keep the stickers that fit whole at full size (one more if the next was
  // nearly whole already), and size them so TARGET_PEEK of the next shows.
  const room = geometry.stripWidth - geometry.leading;
  const pitch = MAX_STAMP_SIZE + geometry.gap;
  const whole =
    Math.max(1, Math.floor((room + geometry.gap) / pitch)) + (peek > MAX_PEEK ? 1 : 0);
  const size = (room - whole * geometry.gap) / (whole + TARGET_PEEK);

  return Math.min(MAX_STAMP_SIZE, Math.max(MIN_STAMP_SIZE, Math.floor(size)));
}

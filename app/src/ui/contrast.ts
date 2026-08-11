/**
 * Contrast, as arithmetic rather than as an opinion (T-113, D-015).
 *
 * WHY THIS EXISTS
 * ---------------
 * D-015 is the decision this project keeps deferring to, and its three rules
 * are all about legibility: unvisited stays readable mid-grey, meaning is never
 * carried by hue alone, and everything must survive being read **in bright
 * Madeiran sunlight at arm's length** by an 80-year-old (CONTEXT §6.5).
 *
 * Every colour in `theme.ts` and every one of the thirty stamp colourways
 * (D-046) was chosen by eye — and on this project "by eye" means *by nobody's
 * eye*, because there is no device and the person who wrote them cannot see.
 * A colour pair that fails contrast is invisible in code review, looks fine on
 * a bright desk monitor, and is discovered by a user outdoors, which is the
 * one place it matters and the one place nobody is testing.
 *
 * So the pairs are **measured**, in `contrast.test.ts`, and a failing pair
 * fails the build. That is the same move as the `null` battery figure (D-041)
 * and the erase-all table list (T-125): turn a promise into something a test
 * can hold.
 *
 * WHAT THE NUMBERS MEAN
 * ---------------------
 * WCAG 2.1 contrast ratio, 1:1 (identical) to 21:1 (black on white). The
 * standard's thresholds are **floors, not targets**:
 *
 *   - **4.5:1** — normal body text.
 *   - **3:1** — large text (roughly 24 px, or 19 px bold) and UI boundaries.
 *
 * ⚠ This project should sit above them, not on them, because the standard
 * assumes indoor viewing and this app is used outdoors on a phone the user is
 * holding at arm's length. The thresholds the tests enforce are in
 * `contrast.test.ts` and are deliberately stricter than the standard's for
 * body text.
 *
 * ⚠ **Contrast is necessary and not sufficient.** It says nothing about
 * whether two colours are distinguishable to someone with colour vision
 * deficiency — that is what D-015's "never hue alone" rule handles, and it is
 * enforced structurally instead: the stamps carry meaning in the emblem
 * (D-046), the map in weight as well as brightness, and settings in words.
 *
 * Pure: no React, no Expo. Tested in `contrast.test.ts`.
 */

export type Rgb = { r: number; g: number; b: number };

/** Parse `#rgb` or `#rrggbb`. Throws on anything else — a silent 0 would read as black. */
export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '');

  if (value.length === 3) {
    return {
      r: parseInt(value[0] + value[0], 16),
      g: parseInt(value[1] + value[1], 16),
      b: parseInt(value[2] + value[2], 16),
    };
  }

  if (value.length !== 6 || !/^[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`not a hex colour: ${hex}`);
  }

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

/**
 * Relative luminance, per WCAG 2.1.
 *
 * The channel curve is the standard's, not a simple average: the eye is far
 * more sensitive to green than to blue, and averaging would rate a saturated
 * blue as much brighter than it reads.
 */
export function relativeLuminance(colour: Rgb): number {
  const channel = (raw: number): number => {
    const value = raw / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  return (
    0.2126 * channel(colour.r) +
    0.7152 * channel(colour.g) +
    0.0722 * channel(colour.b)
  );
}

/**
 * The WCAG contrast ratio between two colours, 1 to 21.
 *
 * Order does not matter — the brighter one is always the numerator.
 */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(parseHex(a));
  const second = relativeLuminance(parseHex(b));
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG's own floors, for reference. The tests use stricter ones — see above. */
export const WCAG_BODY_TEXT = 4.5;
export const WCAG_LARGE_TEXT = 3;

/**
 * How the souvenir film is painted (T-105e, D-076).
 *
 * One palette, three consumers: the map replay (`replayMap.ts`), the
 * basemap-less workbench view (`ReplayView.tsx`), and the preview tools'
 * renderer (`tools/lib/svg-render.mjs`). It was two copies before this file
 * existed and a third was about to be written, which is how a category quietly
 * becomes two different greens depending on where you look at it.
 *
 * Pure data. No React, no Expo, no clock.
 */

import type { Category } from '../content/contentPack.ts';

/**
 * A stamp's colour comes from its **category**, not from its place.
 *
 * The passport varies the colourway per place (`stampArt.ts`) because there it
 * is a 96 dp sticker with its name underneath. On the film it is a dot on a
 * moving map with no room for a name, so the only thing it can usefully carry
 * is *what kind of place that was* — the job D-015 gives the emblem.
 *
 * ⚠ These are the app's own accents (`ui/theme.ts`) plus the two the stamps
 * already use. **Levada is green and the trace is blue on purpose**: the map
 * draws levada courses green (`levadaHighlight.ts`) and the user's own path
 * blue (`traceStyle.ts`, D-054), and the film must not swap them.
 */
export const CATEGORY_COLOUR: Record<Category, string> = {
  viewpoint: '#5AA9FF',
  levada: '#30D158',
  village: '#FFD60A',
  beach: '#4CC9F0',
  landmark: '#B5179E',
};

/**
 * How long a stamp's arrival is animated for, in ms.
 *
 * ⚠ **Unwatched.** `composition.ts` spaces cues at least 350 ms apart, so a pop
 * longer than this would still be growing when the next one lands — which is
 * either lively or a mess, and only eyes can say which.
 */
export const STAMP_POP_MS = 400;

/**
 * A landed stamp's mark, in points, once it has settled.
 *
 * Deliberately close to the map's own collected-place marks so the film and the
 * everyday map agree about how big "a place you earned" is.
 */
export const STAMP_MARK_POINTS = 9;

/** How much larger the mark is at the instant it lands, before settling. */
export const STAMP_POP_SCALE = 2.6;

/**
 * The mark's radius at a given age, in points.
 *
 * Grows from nothing and settles. Kept here rather than in a renderer because
 * both renderers must agree, and because "does it settle" is arithmetic that a
 * test can hold — unlike whether it looks good.
 */
export function stampMarkPoints(ageMs: number): number {
  const grow = Math.max(0, 1 - ageMs / STAMP_POP_MS);
  return STAMP_MARK_POINTS * (1 + grow * (STAMP_POP_SCALE - 1));
}

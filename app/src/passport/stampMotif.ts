/**
 * What a stamp is a picture *of* (T-158, D-079).
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * `stampArt.ts` draws one emblem per **category**. Sixty places therefore share
 * five pictures: Pico do Areeiro, Cabo Girão and Fanal are all *viewpoint* and
 * all carry the same sun-over-ridges. The artwork knows what kind of place it
 * is and **nothing about the place**, which is why a completed passport reads
 * as a colour chart rather than as a collection.
 *
 * A motif is a second, larger vocabulary: a **cliff**, a **waterfall**, a
 * **fort**, a **cable car**. A place names one and the stamp draws it.
 *
 * ⚠⚠ **D-017 IS WHY THIS FILE LOOKS THE WAY IT DOES.** No Madeira knowledge may
 * live in `app/`, absolutely. So the split is:
 *
 *   - **the glyphs live here**, and are deliberately generic — a sea cliff is a
 *     sea cliff in the Azores, in Norway and on Madeira;
 *   - **which place gets which motif lives in `content/pois.json`**, with the
 *     coordinates and the names, where island knowledge belongs.
 *
 * `motifTest` below fails the build if an islandish word ever appears in a motif
 * id, because the tempting mistake is a motif called `levada-do-furado` and that
 * would put the island in `app/` one string at a time.
 *
 * ⚠ **THE CATEGORY SIGNAL, AND THIS IS THE PART TO ARGUE WITH.** D-015 gave the
 * emblem the job of carrying the category. A motif **replaces** the emblem, so
 * that job has to go somewhere — and it already lives somewhere better: the
 * passport is **five fixed rows, one per category** (D-027), so a sticker is
 * always read inside its own row. The category is the heading above it.
 * ⚠ **Recorded as Provisional (D-079).** If a stamp ever has to stand alone
 * outside the passport, this reasoning stops holding and the motif should
 * become a second smaller mark instead of a replacement.
 *
 * Pure data on the same 100×100 grid as `stampArt.ts`'s own emblems, with the
 * same two-layer `back`/`front` construction so nothing downstream changes.
 */

import type { Category } from '../content/contentPack.ts';
import type { Emblem } from './stampArt.ts';

/**
 * The motifs.
 *
 * ⚠ **Chosen for what can be told apart at 96 dp**, which is the size the
 * passport actually draws (`STAMP_SIZE` in `PassportView`). A motif that needs
 * a second look is a motif that has failed — and the existing emblems are
 * chunky geometry for exactly that reason, so these match rather than
 * introducing a finer style that would look broken beside them.
 */
export const MOTIFS = {
  /** A single sharp summit above a lower ridge. Distinct from the category
   *  viewpoint emblem, which is a *sun over stacked* ridges. */
  peak: {
    back: 'M6 86 L94 86 L94 96 L6 96 Z',
    front:
      'M50 12 L84 86 L16 86 Z M50 12 L58 30 L50 36 L42 30 Z M20 86 L38 58 L50 74 L62 56 L80 86 Z',
    box: [6, 12, 94, 96],
  },

  /** A vertical face dropping straight into water. */
  cliff: {
    back: 'M4 74 C20 66 32 82 50 74 C66 67 78 80 96 72 L96 96 L4 96 Z',
    front:
      'M14 8 L58 8 L58 78 L14 78 Z M58 8 L70 22 L70 78 L58 78 Z M22 20 L50 20 L50 26 L22 26 Z M22 36 L50 36 L50 42 L22 42 Z M22 52 L44 52 L44 58 L22 58 Z',
    box: [4, 8, 96, 96],
  },

  /** Water over a lip, into a pool. */
  waterfall: {
    back: 'M6 78 C22 70 34 86 50 78 C64 71 78 84 94 76 L94 96 L6 96 Z',
    front:
      'M18 6 L38 6 L38 74 L18 74 Z M62 6 L82 6 L82 74 L62 74 Z M38 6 L62 6 L62 18 L38 18 Z M44 24 L56 24 L56 74 L44 74 Z M24 30 L30 30 L30 62 L24 62 Z M70 30 L76 30 L76 62 L70 62 Z',
    box: [6, 6, 94, 96],
  },

  /** Canopy — three crowns on trunks, the shape of woodland from outside it. */
  forest: {
    back: 'M6 84 L94 84 L94 94 L6 94 Z',
    front:
      'M28 84 L28 60 L22 60 L34 30 L46 60 L40 60 L40 84 Z M60 84 L60 52 L52 52 L66 14 L80 52 L72 52 L72 84 Z M84 84 L84 66 L79 66 L88 44 L97 66 L92 66 L92 84 Z M6 84 L6 70 L12 70 L18 52 L24 70 L30 70 L30 84 Z',
    box: [6, 14, 97, 94],
  },

  /** An arch cut through rock. */
  tunnel: {
    back: 'M6 10 L94 10 L94 94 L6 94 Z',
    front:
      'M30 94 L30 52 C30 30 70 30 70 52 L70 94 L58 94 L58 52 C58 44 42 44 42 52 L42 94 Z M18 20 L34 20 L34 28 L18 28 Z M66 20 L82 20 L82 28 L66 28 Z',
    box: [6, 10, 94, 94],
  },

  /** A hull and a sail at a quay. */
  harbour: {
    back: 'M4 76 C20 68 32 84 50 76 C66 69 78 82 96 74 L96 96 L4 96 Z',
    front:
      'M16 72 L84 72 L74 88 L26 88 Z M46 12 L46 68 L54 68 L54 12 Z M56 20 L82 62 L56 62 Z M44 26 L44 62 L22 62 Z',
    box: [4, 12, 96, 96],
  },

  /** A tower with a beam. */
  lighthouse: {
    back: 'M4 80 C22 72 34 88 52 80 C68 73 80 86 96 78 L96 96 L4 96 Z',
    front:
      'M38 82 L38 34 L62 34 L62 82 Z M34 34 L66 34 L66 42 L34 42 Z M42 18 L58 18 L58 34 L42 34 Z M44 8 L56 8 L56 18 L44 18 Z M8 20 L34 26 L34 32 L8 32 Z M92 20 L66 26 L66 32 L92 32 Z M30 82 L70 82 L70 90 L30 90 Z',
    box: [4, 8, 96, 96],
  },

  /** Battlements on a wall. */
  fort: {
    back: 'M6 84 L94 84 L94 96 L6 96 Z',
    front:
      'M10 84 L10 34 L20 34 L20 24 L32 24 L32 34 L44 34 L44 24 L56 24 L56 34 L68 34 L68 24 L80 24 L80 34 L90 34 L90 84 Z M42 84 L42 60 C42 50 58 50 58 60 L58 84 Z M22 46 L32 46 L32 58 L22 58 Z M68 46 L78 46 L78 58 L68 58 Z',
    box: [6, 24, 94, 96],
  },

  /** Stepped terraces on a slope — cultivated ground. */
  terrace: {
    back: 'M4 88 L96 88 L96 96 L4 96 Z',
    front:
      'M4 84 L96 84 L96 76 L18 76 Z M18 72 L96 72 L96 64 L32 64 Z M32 60 L96 60 L96 52 L46 52 Z M46 48 L96 48 L96 40 L60 40 Z M60 36 L96 36 L96 28 L74 28 Z',
    box: [4, 28, 96, 96],
  },

  /** A cabin on a wire, between two pylons. */
  cableCar: {
    back: 'M6 88 L94 88 L94 96 L6 96 Z',
    front:
      'M4 16 L96 30 L96 36 L4 22 Z M38 32 L62 36 L62 44 L38 40 Z M34 44 L66 48 L66 76 L34 72 Z M40 54 L60 57 L60 66 L40 63 Z M8 10 L18 10 L18 88 L8 88 Z M82 24 L92 24 L92 88 L82 88 Z',
    box: [4, 10, 96, 96],
  },

  /** Dark sand under a wave — a beach that is not pale. */
  blackSand: {
    back: 'M4 62 C22 52 36 72 54 62 C70 53 80 68 96 60 L96 74 C80 82 70 67 54 76 C36 86 22 66 4 76 Z',
    front:
      'M4 78 L96 78 L96 96 L4 96 Z M16 68 L24 68 L24 74 L16 74 Z M70 66 L80 66 L80 72 L70 72 Z M4 40 C20 32 34 50 50 42 L50 50 C34 58 20 40 4 48 Z',
    box: [4, 32, 96, 96],
  },
} as const satisfies Record<string, Emblem>;

export type MotifName = keyof typeof MOTIFS;

export const MOTIF_NAMES = Object.keys(MOTIFS) as MotifName[];

export function isMotifName(value: unknown): value is MotifName {
  return typeof value === 'string' && value in MOTIFS;
}

/**
 * The emblem a place should draw.
 *
 * ⚠ **The category emblem is the fallback, not the failure case.** Sixty places
 * will not all deserve a motif, and a place whose motif would be a shrug is
 * better served by its category's picture than by a bad one. Content may leave
 * `motif` out and nothing breaks.
 */
export function emblemFor(
  category: Category,
  motif: string | undefined,
  categoryEmblems: Record<Category, Emblem>
): Emblem {
  return isMotifName(motif) ? MOTIFS[motif] : categoryEmblems[category];
}

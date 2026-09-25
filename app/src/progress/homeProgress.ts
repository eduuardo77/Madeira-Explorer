/**
 * The progress strip on the home map (D-090) — the pure half.
 *
 * The reference app keeps one line of progress above its start button,
 * *"0 / 86 638 blocks · 0,0%"*, and it is the reason its quiet map still tells
 * you there is something to do. The second review (2026-09-24, N1) found Proa's
 * home at 0 stamps saying nothing of the kind, and the project lead asked for
 * the same thing here, *"but very subtle"*.
 *
 * So this decides only what the strip shows, and `PrimaryOverlay` draws it:
 * one caption, one hairline bar, no percentage.
 *
 * ⚠ **The municipality to finish, when there is one (2026-09-25).** The
 * project lead, having seen it on the P30: *"we could explore different
 * information to present instead of 0 of 80 places"*, and chose option B of
 * `tools/out/screen-options-2.html`: the municipality already started and
 * closest to finished (`suggestNextRegion`, D-027's "where next" that was
 * computed and never shown). *Santana: 1 de 12 lugares* moves a bar that
 * *1 de 80* barely does. Before the first stamp there is none, and the strip
 * counts the island. The bar already says the
 * proportion, and `3.8%` of 80 places is false precision next to a count a
 * person can read at a glance.
 */

import { suggestNextRegion, type TripProgress } from './tripProgress.ts';

export type HomeProgress = {
  collected: number;
  total: number;
  /** How much of the bar is filled, 0 to 1. */
  fraction: number;
  /** The municipality counted, by name, or null when the count is the island. */
  region: string | null;
};

/**
 * The strip's content, or `null` for no strip.
 *
 * ⚠ **Shown at zero.** Zero is the case the strip exists for: it is how a new
 * visitor learns there are 80 places to collect before they have any. Hidden
 * only when there is nothing to count at all (an empty content pack), where
 * `0 / 0` would read as an error.
 */
export function homeProgress(
  progress: Pick<TripProgress, 'collected' | 'total' | 'byRegion'>,
  /** A region id as a word. Passed in, because this module reads no content. */
  nameOf: (regionId: string) => string | null = () => null
): HomeProgress | null {
  const region = suggestNextRegion(progress);
  const name = region === null ? null : nameOf(region.regionId)?.trim() || null;
  // ⚠ A region's count under the island's words would be a wrong sentence, so
  // a region the pack cannot name falls back to the island.
  return region === null || name === null
    ? counted(progress.collected, progress.total, null)
    : counted(region.collected, region.total, name);
}

function counted(rawCollected: number, rawTotal: number, region: string | null): HomeProgress | null {
  const total = Math.floor(rawTotal);
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }
  // Clamped, because the count and the pack can disagree for a moment: a
  // place cut from `content/` stays collected in the database (D-075 keeps
  // what was earned), and a bar drawn past its track is a bug on screen.
  const collected = Math.min(Math.max(Math.floor(rawCollected) || 0, 0), total);
  return { collected, total, fraction: collected / total, region };
}

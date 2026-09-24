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
 * one caption, one hairline bar, no percentage. The bar already says the
 * proportion, and `3.8%` of 80 places is false precision next to a count a
 * person can read at a glance.
 */

export type HomeProgress = {
  collected: number;
  total: number;
  /** How much of the bar is filled, 0 to 1. */
  fraction: number;
};

/**
 * The strip's content, or `null` for no strip.
 *
 * ⚠ **Shown at zero.** Zero is the case the strip exists for: it is how a new
 * visitor learns there are 80 places to collect before they have any. Hidden
 * only when there is nothing to count at all (an empty content pack), where
 * `0 / 0` would read as an error.
 */
export function homeProgress(progress: {
  collected: number;
  total: number;
}): HomeProgress | null {
  const total = Math.floor(progress.total);
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }
  // Clamped, because the count and the pack can disagree for a moment: a
  // place cut from `content/` stays collected in the database (D-075 keeps
  // what was earned), and a bar drawn past its track is a bug on screen.
  const collected = Math.min(Math.max(Math.floor(progress.collected) || 0, 0), total);
  return { collected, total, fraction: collected / total };
}

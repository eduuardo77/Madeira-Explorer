/**
 * Which newly earned stamps still need telling about (D-096): a notification
 * when the app is closed, a pop-up on the map when it is open.
 *
 * Each has its own record of what it already said, so a stamp announced by a
 * notification still gets its pop-up the next time the map is looked at.
 *
 * ⚠ **The first run says nothing.** A record that does not exist yet is the
 * first launch after the update that brought this, with stamps already in the
 * passport; announcing them all at once would be a pile of pop-ups for places
 * visited days ago. So it seeds the record with everything already earned and
 * announces only what comes after.
 *
 * Pure. Tested in `stampNews.test.ts`.
 */

export type StampNews = {
  /** Earned and not yet announced, in the order they were earned. */
  announce: string[];
  /** The record to store afterwards, once the caller has announced them. */
  record: string[];
};

/** `earned` in the order earned; `told` is the stored record, or null when there is none. */
export function stampNews(earned: readonly string[], told: readonly string[] | null): StampNews {
  if (told === null) {
    return { announce: [], record: [...earned] };
  }
  const known = new Set(told);
  const announce = earned.filter((placeId) => !known.has(placeId));
  return { announce, record: [...told, ...announce] };
}

/** A stored record, or null when absent or unreadable (which seeds again). */
export function parseTold(raw: string | null): string[] | null {
  if (raw === null) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
  } catch {
    return null;
  }
}

/**
 * The trip viewer's time tags, grouped where they would overlap (the lead,
 * 17 Oct 2026: the day view "is a bit cluttered"; five tags were stacked on
 * each other around Porto Moniz).
 *
 * Tags are placed by their stamp's position on screen. Any tag whose box would
 * overlap a group's first tag joins that group, which shows one tag with the
 * times in order: at most `MAX_TIMES`, then "+n". Pure; `tagGroups.test.ts`.
 */

export type TagItem = { id: string; x: number; y: number; ts: number };
export type TagGroup = { id: string; x: number; y: number; items: TagItem[] };

/** Two tags closer than this vertically, in dp, would touch. */
export const TAG_GAP_Y = 26;
/** Room left between two tags side by side, in dp. */
const TAG_SPACE = 6;
/** Times shown in one tag before "+n". */
export const MAX_TIMES = 2;

/**
 * A tag's width on screen, dp, from how many times it shows: measured off the
 * P30 at the viewer's font (one time 52 dp; two 112; two and a count 140). ⚠ An
 * estimate: a larger system font draws wider tags and they may touch again.
 */
export function tagWidth(times: number): number {
  return times <= 1 ? 52 : times === 2 ? 112 : 140;
}

/**
 * Groups whose tags would overlap merge, again and again until none do: the
 * first version compared one fixed width and a two-time tag still covered its
 * neighbour (P30, 17 Oct 2026). A group sits where its earliest stamp is.
 */
export function groupTags(items: readonly TagItem[]): TagGroup[] {
  let groups: TagGroup[] = [...items]
    .sort((a, b) => a.ts - b.ts)
    .map((item) => ({ id: item.id, x: item.x, y: item.y, items: [item] }));
  for (let merged = true; merged; ) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const [a, b] = [groups[i], groups[j]];
        const reach = (tagWidth(a.items.length) + tagWidth(b.items.length)) / 2 + TAG_SPACE;
        if (Math.abs(a.x - b.x) < reach && Math.abs(a.y - b.y) < TAG_GAP_Y) {
          const [first, second] = a.items[0].ts <= b.items[0].ts ? [a, b] : [b, a];
          const joined = { ...first, items: [...first.items, ...second.items].sort((p, q) => p.ts - q.ts) };
          groups = groups.filter((group) => group !== a && group !== b).concat(joined);
          merged = true;
          break outer;
        }
      }
    }
  }
  return groups.sort((a, b) => a.items[0].ts - b.items[0].ts);
}

/** "14:28 · 14:54", or "14:28 · 14:54 +3" for a larger group. */
export function groupLabel(times: readonly string[]): string {
  const shown = times.slice(0, MAX_TIMES).join(' · ');
  return times.length > MAX_TIMES ? `${shown} +${times.length - MAX_TIMES}` : shown;
}

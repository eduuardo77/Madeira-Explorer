/**
 * Where the camera goes when the map is shown again (2026-10-04, the project
 * lead's pick of three): **the roads lit since the user last looked, together
 * with where they are now.**
 *
 * Found on the P30 after the promenade walk: the map came back on the morning's
 * view of Caniço, the walk 12 km to the west and off the screen. WalkNYC keeps
 * the view on return and opens on a fixed area (teardown item 18); opening on
 * the user's own street would show none of what they did. So:
 *
 * - **something new since last looked:** frame the new stretch and the user,
 *   so a walk just finished shows with the blue dot at its end, and a walk 12 km
 *   from home zooms out just enough to hold both;
 * - **nothing new:** leave the camera where it is, as WalkNYC does;
 * - **never looked before:** say nothing, and the map's first framing (the
 *   trip, or the island, D-053) applies.
 *
 * Pure. Tested in `returnFraming.test.ts`.
 */

/** `[lon, lat]`, the order the map's bounds helpers take. */
export type LonLat = [number, number];

export type ReturnFramingInput = {
  /** The latest lit fix the user had been shown, or null if never. */
  seenTs: number | null;
  /** The latest lit fix now, or null when nothing is lit. */
  latestTs: number | null;
  /** The route lit after `seenTs`. */
  newRoute: readonly LonLat[];
  /** Where the user is, when fresh and on the islands; null otherwise. */
  user: LonLat | null;
};

/** The points to frame, or null to leave the camera alone. */
export function returnFraming(input: ReturnFramingInput): LonLat[] | null {
  const { seenTs, latestTs, newRoute, user } = input;
  if (seenTs === null || latestTs === null || latestTs <= seenTs || newRoute.length === 0) {
    return null;
  }
  return user === null ? [...newRoute] : [...newRoute, user];
}

/** What to remember as seen once the map has been shown. */
export function nextSeenTs(seenTs: number | null, latestTs: number | null): number | null {
  if (latestTs === null) {
    return seenTs;
  }
  return seenTs === null ? latestTs : Math.max(seenTs, latestTs);
}

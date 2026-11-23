/**
 * The passport's island, made usable (T-325): the pure half.
 *
 * The island beside the passport's title opens, inside the page, into a map of
 * the user's places: gold where the stamp is in colour, a gold ring where it
 * waits behind the unlock, grey where they have not been. A tap shows the place
 * in a bubble pinned to its dot; places a finger cannot split show as a list;
 * a double tap or the list's *zoom in* brings a part of the island closer.
 * Sketched and approved in `tools/preview-island-bubble.mjs` (23 Nov 2026).
 *
 * Everything here is arithmetic on map coordinates (the box `islandMap` draws
 * in) and screen coordinates (the same box after a zoom). No React, no clock:
 * `ui/PassportIsland.tsx` draws it.
 */

export type DotState = 'open' | 'waiting' | 'new';

/** What the map shows: all of it, or a part, `w` wide in map units from (x, y). */
export type IslandViewBox = { x: number; y: number; w: number };

export type IslandDot = { id: string; x: number; y: number };

/** A place's dot state from its stamp: in colour, earned and locked, or not yet visited. */
export function dotState(stamp: { collected: boolean; locked?: boolean } | undefined): DotState {
  if (stamp === undefined || !stamp.collected) return 'new';
  return stamp.locked === true ? 'waiting' : 'open';
}

/** The whole island, for a map `width` wide. */
export function fullView(width: number): IslandViewBox {
  return { x: 0, y: 0, w: width };
}

/** Map units per screen pixel: 1 for the whole island, less when zoomed in. */
export function unitsPerPixel(view: IslandViewBox, width: number): number {
  return view.w / width;
}

export function isZoomed(view: IslandViewBox, width: number): boolean {
  return view.w < width - 0.5;
}

/** The deepest zoom, as a fraction of the map's width: 8 times closer. */
export const MAX_ZOOM = 8;
/** A double tap's zoom. */
export const TAP_ZOOM = 2.6;
/** The list's *zoom in*: close enough that Funchal's places split (seen in the sketch). */
export const GROUP_ZOOM = 7;

/** A view kept inside the map and no deeper than `MAX_ZOOM`. */
export function fitView(view: IslandViewBox, width: number, height: number): IslandViewBox {
  const w = Math.max(width / MAX_ZOOM, Math.min(width, view.w));
  const h = (w * height) / width;
  return {
    w,
    x: Math.max(0, Math.min(width - w, view.x)),
    y: Math.max(0, Math.min(height - h, view.y)),
  };
}

/** A view `zoom` times closer, centred on (x, y) in map units, then fitted. */
export function zoomAround(x: number, y: number, zoom: number, width: number, height: number): IslandViewBox {
  const w = width / zoom;
  return fitView({ w, x: x - w / 2, y: y - (w * height) / width / 2 }, width, height);
}

export function toScreen(view: IslandViewBox, width: number, x: number, y: number): [number, number] {
  const k = unitsPerPixel(view, width);
  return [(x - view.x) / k, (y - view.y) / k];
}

export function toMap(view: IslandViewBox, width: number, sx: number, sy: number): [number, number] {
  const k = unitsPerPixel(view, width);
  return [view.x + sx * k, view.y + sy * k];
}

/** How far from a dot, in screen pixels, a tap still counts as on it. */
export const TOUCH_RADIUS = 16;

export type IslandHit = { kind: 'one'; id: string } | { kind: 'group'; ids: string[] } | null;

/**
 * What a tap at (sx, sy) on screen means.
 *
 * Distances are in screen pixels, so a zoomed map gives each dot its whole
 * touch. A tap squarely on one dot (within 5 px, the next one 4 px further)
 * opens it; a tap that cannot tell dots apart lists them, at most four, rather
 * than guess. The rule that a near tap opens the nearest was tried in the
 * sketch and opened Levada do Barreiro for a tap on Pico do Areeiro.
 */
export function hitTest(
  dots: readonly IslandDot[],
  view: IslandViewBox,
  width: number,
  sx: number,
  sy: number
): IslandHit {
  const [x, y] = toMap(view, width, sx, sy);
  const k = unitsPerPixel(view, width);
  const near = dots
    .map((dot) => ({ dot, d: Math.hypot(dot.x - x, dot.y - y) / k }))
    .filter((entry) => entry.d < TOUCH_RADIUS)
    .sort((a, b) => a.d - b.d);
  if (near.length === 0) return null;
  const square = near[0].d <= 5 && (near[1] === undefined || near[1].d > near[0].d + 4);
  if (square || near.length === 1) return { kind: 'one', id: near[0].dot.id };
  const close = near.filter((entry) => entry.d < near[0].d + 7).slice(0, 4);
  return close.length === 1 ? { kind: 'one', id: close[0].dot.id } : { kind: 'group', ids: close.map((entry) => entry.dot.id) };
}

/** The centre of some dots, and how far the farthest is from it: a group's one ring. */
export function groupCircle(dots: readonly IslandDot[]): { x: number; y: number; r: number } {
  const x = dots.reduce((sum, dot) => sum + dot.x, 0) / dots.length;
  const y = dots.reduce((sum, dot) => sum + dot.y, 0) / dots.length;
  return { x, y, r: dots.length > 1 ? Math.max(...dots.map((dot) => Math.hypot(dot.x - x, dot.y - y))) : 0 };
}

/** The gap between a bubble and its dot, and how far past the map's top a bubble may rise. */
const GAP = 15;
const OVERHANG = 10;

/**
 * Where a bubble `bubbleW` x `bubbleH` goes for a dot at (sx, sy) on a map
 * `mapW` wide: above it, or below when it would rise past the map's top (and
 * over the numbers), never past the sides. `tip` is the arrow's x inside it.
 */
export function bubblePlacement(
  sx: number,
  sy: number,
  bubbleW: number,
  bubbleH: number,
  mapW: number
): { left: number; top: number; tip: number; below: boolean } {
  const left = Math.max(-4, Math.min(mapW + 4 - bubbleW, sx - bubbleW / 2));
  const below = sy - bubbleH - GAP < -OVERHANG;
  return {
    left,
    top: below ? sy + GAP : sy - bubbleH - GAP,
    tip: Math.max(18, Math.min(bubbleW - 18, sx - left)),
    below,
  };
}

/** Whether a dot is inside the view (with a little margin), so its bubble can show. */
export function onScreen(sx: number, sy: number, width: number, height: number): boolean {
  return sx >= -6 && sx <= width + 6 && sy >= -6 && sy <= height + 6;
}

/**
 * The places earned since the island was last opened, in the order they were
 * earned: they light last, with a burst. None on the first opening ever
 * (`seenTs` null): everything is new then, and a burst on all of it says nothing.
 */
export function freshSince(
  awards: ReadonlyArray<{ place_id: string; awarded_ts: number }>,
  seenTs: number | null,
  shown: ReadonlySet<string>
): string[] {
  if (seenTs === null) return [];
  return [...awards]
    .filter((award) => award.awarded_ts > seenTs && shown.has(award.place_id))
    .sort((a, b) => a.awarded_ts - b.awarded_ts)
    .map((award) => award.place_id);
}

/** The order the dots light in when the island opens: earned order, the fresh ones last. */
export function lightingOrder(
  awards: ReadonlyArray<{ place_id: string; awarded_ts: number }>,
  shown: ReadonlySet<string>,
  fresh: readonly string[]
): string[] {
  const freshSet = new Set(fresh);
  const earned = [...awards]
    .filter((award) => shown.has(award.place_id) && !freshSet.has(award.place_id))
    .sort((a, b) => a.awarded_ts - b.awarded_ts)
    .map((award) => award.place_id);
  return [...new Set(earned), ...fresh];
}

/** The legend's three counts. */
export function stateCounts(states: Iterable<DotState>): Record<DotState, number> {
  const counts: Record<DotState, number> = { open: 0, waiting: 0, new: 0 };
  for (const state of states) counts[state] += 1;
  return counts;
}

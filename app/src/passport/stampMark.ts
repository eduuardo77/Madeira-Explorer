/**
 * The passport *mark* — one small stamp impression, used as an icon (T-075).
 *
 * This is not a stamp for a place. `stampArt.ts` draws those, and everything it
 * decides varies by `placeId` and `category`. This draws the *idea* of a stamp,
 * at button size, in one colour.
 *
 * WHY IT EXISTS
 * -------------
 * The primary screen's passport control was a `🛂` emoji. At 36 dp that renders
 * as an unreadable blue rectangle: the project lead looked at the running app
 * and asked what "the button to centre the map" was. It does not centre the
 * map, it opens the passport. An icon nobody can name is worse than no icon,
 * and D-015 says in as many words that minimal must not mean unlabelled.
 *
 * WHY IT BORROWS `stampArt`'s GEOMETRY INSTEAD OF BEING ITS OWN DRAWING
 * ---------------------------------------------------------------------
 * It is cut by the same `cutEdge` and `inset` the real stamps use, on the same
 * 100-unit canvas. So the icon standing for the collection is die-cut by the
 * same geometry as the things in it, and it cannot drift away from them when
 * that geometry is tuned.
 *
 * WHY ONE COMPOUND PATH AND NOT THREE SHAPES
 * ------------------------------------------
 * The ring is a filled outline with a hole punched through it. SVG has no
 * subtract primitive, but the even-odd fill rule is spelled the same way in a
 * browser and in `react-native-svg`, so one path with three subpaths — outer,
 * hole, centre — draws identically in both renderers with nothing to keep in
 * sync. **Anything drawing this must set the even-odd fill rule**, or it fills
 * as a solid blob.
 *
 * WHY THE CENTRE IS A DIAMOND AND NOT THREE LINES
 * -----------------------------------------------
 * Three stacked bars would read as a hamburger, which CONTEXT §6.5 rejects by
 * name as a learned convention promising a drawer of destinations. The diamond
 * is one of the eight silhouettes in `stampArt.ts`, so the mark is built only
 * from shapes the passport already uses.
 *
 * Monochrome on purpose: the caller supplies the colour, because the mark sits
 * on surfaces of different brightness in the two map styles (D-026).
 */

import { CANVAS, cutEdge, inset, type Point } from './stampArt.ts';

/**
 * An octagon, one of `stampArt`'s eight silhouettes.
 *
 * ⚠ **This was a 20-gon and it was wrong, in an instructive way.** The geometry
 * passed every test in `stampMark.test.ts` and then rendered on the phone as a
 * ring with a dot in it — a record button, or a crosshair. Which was absurd,
 * because the change it was part of existed to *remove* a control the project
 * lead had mistaken for a map-centring button.
 *
 * At 34 dp a 20-gon is a circle: the scallop is 1.6 units on a 100-unit canvas
 * and simply disappears. Corners are what survive being small, so the mark is
 * now an octagon and is tilted, because a seal pressed slightly off-square is
 * the thing that actually says "stamp". CLAUDE.md warns that artwork is judged
 * by eye and this project has none; the tests below are still worth having, but
 * they could not have caught this and did not.
 */
const SIDES = 8;

/**
 * Rotation, in degrees, applied to the whole mark.
 *
 * The real stamps tilt up to `MAX_TILT_DEG` (5°) by hash. This one is fixed and
 * a little stronger, because a single icon has no neighbours to be varied
 * against — it just needs to look pressed rather than drawn.
 */
export const TILT_DEG = -10;

/** Outer radius on the 100-unit canvas, leaving room for the cut and the tilt. */
export const RADIUS = 44;

/**
 * Ring thickness, and the one number here that is a legibility decision rather
 * than a taste one.
 *
 * `stampMark.test.ts` asserts it stays thick enough to survive at 24 dp. A
 * hairline ring is the classic icon that looks right in a drawing tool and
 * vanishes on a phone, which is the failure D-015 exists to prevent.
 */
export const RING_INSET = 9;

/**
 * The impression in the middle, as a radius on the same canvas.
 *
 * Big enough to read as a *diamond* rather than as a dot — which is the other
 * half of why the first attempt looked like a record button. A small centre
 * inside a ring is a bullseye whatever its shape.
 */
export const DIAMOND_RADIUS = 19;

/**
 * A regular polygon, rotated so the octagon sits flat-topped.
 *
 * Flat-topped rather than point-topped because a point at 12 o'clock inside a
 * rounded button reads as an arrow, and the mark already has enough to say.
 */
function regular(sides: number, radius: number): Point[] {
  const centre = CANVAS / 2;
  const rotation = 180 / sides;
  const points: Point[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = ((-90 + rotation + (360 / sides) * i) * Math.PI) / 180;
    points.push([
      centre + Math.cos(angle) * radius,
      centre + Math.sin(angle) * radius,
    ]);
  }
  return points;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A closed subpath through `points`. */
function subpath(points: Point[]): string {
  const [first, ...rest] = points;
  const move = `M${round(first[0])} ${round(first[1])}`;
  const lines = rest.map(([x, y]) => `L${round(x)} ${round(y)}`).join(' ');
  return `${move} ${lines} Z`;
}

/** The four corners of the centre impression. */
function diamond(): Point[] {
  const centre = CANVAS / 2;
  return [
    [centre, centre - DIAMOND_RADIUS],
    [centre + DIAMOND_RADIUS, centre],
    [centre, centre + DIAMOND_RADIUS],
    [centre - DIAMOND_RADIUS, centre],
  ];
}

/** The mark's three subpaths, outermost first. Exposed for the tests. */
export function stampMarkRings(): { outer: Point[]; hole: Point[]; centre: Point[] } {
  const outline = regular(SIDES, RADIUS);
  return {
    // Scalloped, like a die-cut sticker — the same call the real stamps make.
    outer: cutEdge(outline, 'scallop'),
    hole: cutEdge(inset(outline, RING_INSET), 'scallop'),
    centre: diamond(),
  };
}

/**
 * The whole mark as one `d`, to be drawn with the **even-odd** fill rule.
 *
 * Three nested subpaths, so a point inside all three crosses three boundaries
 * and fills, a point in the ring's hole crosses two and does not, and a point
 * in the ring itself crosses one and does. That is the hole and the impression
 * in a single element.
 */
export function stampMarkPath(): string {
  const { outer, hole, centre } = stampMarkRings();
  return `${subpath(outer)} ${subpath(hole)} ${subpath(centre)}`;
}

export { CANVAS };

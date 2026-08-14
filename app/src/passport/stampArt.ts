/**
 * What a passport stamp looks like (T-070).
 *
 * WHY THE ARTWORK IS GENERATED RATHER THAN DRAWN
 * ----------------------------------------------
 * The passport holds 150–250 places (D-002) and `content/pois.json` is
 * curated by the project lead, not by whoever writes this code (T-066). Two
 * things follow. Nobody is going to illustrate two hundred stickers by hand,
 * and — more importantly — **a place added to the content pack next month must
 * arrive with artwork already**, or curation acquires a second job it should
 * not have. So the design is produced from what the pack already knows: the
 * place's category, and its id.
 *
 * THE LOOK
 * --------
 * Vintage luggage labels — the die-cut travel stickers people used to stick on
 * a suitcase. Saturated colour, a heavy cut border with a second border inside
 * it, a sunburst behind a two-tone emblem, perforation dots around the panel,
 * and the place name in capitals on a band. That vocabulary was chosen by the
 * project lead from a reference sheet, and it earns its place beyond taste: it
 * is a *collection* aesthetic, which is what a passport page is for
 * (CONTEXT §4.2).
 *
 * ⚠ **THE ICON CARRIES THE CATEGORY. Shape and colour are both decoration.**
 * D-015 forbids differentiating meaning by hue alone, and the passport is
 * organised by category (D-027) — so the reader needs a non-colour signal, and
 * it is the **emblem**. An earlier version made the *silhouette* carry it, one
 * shape per category; that was revised 2026-08-11 when the project lead asked
 * for varied shapes, and the reference sheet makes the case: Greece, Spain and
 * London are all rectangles and nobody confuses them, because the icon does
 * the work. Eight silhouettes are now spread across places by hash. **Two
 * places in different categories must never share an emblem** — a test
 * enforces it.
 *
 * WHY VARIATION IS DERIVED FROM THE ID
 * ------------------------------------
 * It has to be **stable** — a stamp that changes shape or colour between two
 * launches is not a souvenir, it is a bug the user will notice and not be able
 * to describe. So variation comes from a hash of the place id and nothing
 * else: no clock, no random, no index in a list that shifts as the pack grows.
 *
 * WHY THE BAND IS PLACED BY SEARCH AND NOT BY HAND
 * ------------------------------------------------
 * Eight shapes × a name of any length is too many combinations to hand-tune,
 * and three of the shapes taper — a triangle, a diamond and a shield are all
 * narrow somewhere. So `bestBandY` **measures** each silhouette and puts the
 * band where that shape is actually widest, the name wraps to two lines when
 * one will not do, and what still does not fit is condensed to width. The
 * place name fitting is a property of the system, not of the sample data.
 *
 * Pure: no React, no Expo, no clock. Tested in `stampArt.test.ts`, and drawn
 * by `ui/StampArt.tsx`. `tools/preview-stamps.mjs` renders the same designs to
 * a standalone page, so what gets judged is what the app draws.
 */

import type { Category } from '../content/contentPack.ts';

/** Everything is designed on a 100×100 grid and scaled at draw time. */
export const CANVAS = 100;

export type Point = [number, number];

export type Colourway = {
  /** The outer cut border. */
  border: string;
  /** The second border just inside it — the detail that reads as printed. */
  inner: string;
  /** The panel the emblem sits on. */
  paper: string;
  /** The emblem's main silhouette, the keyline and the perforation dots. */
  ink: string;
  /** The emblem's second tone, and the sunburst behind it. */
  accent: string;
  /** The band the name sits on. */
  band: string;
  /** The name itself, on the band. */
  bandInk: string;
};

export type StampDesign = {
  category: Category;
  /** The sticker silhouette, before the cut edge is applied. */
  outline: Point[];
  /** The silhouette with its edge cut — what actually gets drawn. */
  cutOutline: Point[];
  /** The second border, inside the first. */
  innerOutline: Point[];
  /** The panel inside the borders. */
  panel: Point[];
  colourway: Colourway;
  /** The two halves of the category's emblem, on the same 100×100 grid. */
  icon: Emblem;
  /** Small tilt, in degrees, so a grid does not read as a spreadsheet. */
  tiltDeg: number;
  /** Which of the eight silhouettes this place drew. For tests and debugging. */
  shapeName: ShapeName;
};

/* ------------------------------------------------------------------ shapes */

export const SHAPE_NAMES = [
  'square',
  'landscape',
  'triangle',
  'diamond',
  'shield',
  'hexagon',
  'octagon',
  'round',
] as const;

export type ShapeName = (typeof SHAPE_NAMES)[number];

/** A regular polygon, for the shapes that are one. Clockwise from the top. */
function regular(sides: number, radius: number, rotationDeg = 0): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = radians(rotationDeg - 90 + (360 / sides) * i);
    points.push([50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius]);
  }
  return points;
}

/**
 * Eight silhouettes, spread across places by hash.
 *
 * Chosen to be told apart at a glance in a grid — a square and a rounded
 * square would be two shapes and one impression, which is why `round` is a
 * 20-gon rather than a squircle.
 */
const SHAPES: Record<ShapeName, Point[]> = {
  square: [
    [8, 8],
    [92, 8],
    [92, 92],
    [8, 92],
  ],
  // The classic label proportion, and the roomiest for a long name.
  landscape: [
    [4, 18],
    [96, 18],
    [96, 82],
    [4, 82],
  ],
  triangle: [
    [50, 5],
    [96, 89],
    [4, 89],
  ],
  diamond: [
    [50, 3],
    [97, 50],
    [50, 97],
    [3, 50],
  ],
  // A shield, pointing down.
  shield: [
    [9, 7],
    [91, 7],
    [91, 57],
    [50, 96],
    [9, 57],
  ],
  hexagon: [
    [24, 9],
    [76, 9],
    [97, 50],
    [76, 91],
    [24, 91],
    [3, 50],
  ],
  octagon: regular(8, 47, 22.5),
  round: regular(20, 47),
};

/**
 * The emblems: two layers each, so the artwork has depth rather than being one
 * flat silhouette. `back` is drawn in the accent colour, `front` over it in ink.
 *
 * **This is the category signal** — see the header. Deliberately drawn from
 * what a category *is* rather than from anything specific to one island, so
 * D-017 holds: these would be as correct for the Azores.
 */
export type Emblem = {
  back: string;
  front: string;
  /**
   * The emblem's real extent on the 100×100 grid, `[minX, minY, maxX, maxY]`.
   *
   * ⚠ Not decoration. Fitting a *square* into the space above the band wastes
   * whatever the artwork does not use, and these emblems are wide and short —
   * which is the wrong shape for the slot on a diamond, where the loss was
   * measured at nearly half the available size. Fitting the real box keeps the
   * emblem as large as the sticker can actually hold.
   */
  box: [number, number, number, number];
};

const ICONS: Record<Category, Emblem> = {
  // A sun over stacked ridges, seen from a lookout.
  viewpoint: {
    back: 'M50 30 m-15 0 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0 M8 74 L92 74 L92 84 L8 84 Z',
    front:
      'M6 72 L30 40 L44 58 L58 34 L78 62 L88 50 L94 72 Z M30 40 L36 48 L28 52 Z M58 34 L64 43 L55 46 Z M14 80 L86 80 L86 83 L14 83 Z',
    box: [6, 15, 94, 84]
  },
  // The channel, its parallel bank, and a leaf over it.
  levada: {
    back: 'M8 44 C26 32 42 56 60 44 C74 35 84 42 94 38 L94 56 C84 60 74 53 60 62 C42 74 26 50 8 62 Z',
    front:
      'M8 50 C26 38 42 62 60 50 C74 41 84 48 94 44 L94 50 C84 54 74 47 60 56 C42 68 26 44 8 56 Z M26 76 C40 66 60 66 76 74 L74 82 C60 75 42 75 30 83 Z M66 16 C80 14 88 22 86 34 C74 36 66 28 66 16 Z M76 20 L70 32',
    box: [8, 14, 94, 83]
  },
  // A church tower and rooftops on a slope.
  village: {
    back: 'M6 78 L94 78 L94 88 L6 88 Z M44 24 L58 24 L58 44 L44 44 Z',
    front:
      'M10 76 L10 54 L26 40 L42 54 L42 76 Z M20 76 L20 64 L32 64 L32 76 Z M62 76 L62 50 L78 36 L94 50 L94 76 Z M72 76 L72 64 L84 64 L84 76 Z M44 76 L44 30 L51 20 L58 30 L58 76 Z M48 44 L54 44 L54 54 L48 54 Z M47 76 L47 62 C47 56 55 56 55 62 L55 76 Z',
    box: [6, 20, 94, 88]
  },
  // Sun, sea and a headland.
  beach: {
    back: 'M50 26 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0 M4 60 L96 60 L96 90 L4 90 Z',
    front:
      'M50 26 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 M50 6 L53 15 L47 15 Z M50 46 L53 37 L47 37 Z M30 26 L21 29 L21 23 Z M70 26 L79 29 L79 23 Z M6 66 C20 56 30 76 44 66 C58 56 68 76 82 66 C89 61 92 65 96 63 L96 72 C92 74 89 70 82 76 C68 86 58 66 44 76 C30 86 20 66 6 76 Z M62 52 C74 46 84 50 90 58 L60 58 Z',
    box: [4, 6, 96, 90]
  },
  // A tower with an arch, on a plinth.
  landmark: {
    back: 'M22 84 L78 84 L78 94 L22 94 Z M36 26 L64 26 L64 84 L36 84 Z',
    front:
      'M34 84 L34 30 L42 30 L42 18 L50 6 L58 18 L58 30 L66 30 L66 84 Z M26 84 L26 76 L74 76 L74 84 Z M44 76 L44 52 C44 44 56 44 56 52 L56 76 Z M46 34 L54 34 L54 44 L46 44 Z M48 12 L52 12 L52 20 L48 20 Z M18 94 L82 94 L82 98 L18 98 Z',
    box: [18, 6, 82, 98]
  },
};

/* --------------------------------------------------------------- colourways */

/**
 * Six colourways per category. Saturated on purpose — this is the one screen
 * where colour is the point (the map is the opposite; the basemap must never
 * out-shout the trace, `tiles/style/generate.mjs`).
 *
 * `paper`/`ink` and `band`/`bandInk` are always a light-on-dark or
 * dark-on-light pairing rather than two mid tones, so the emblem and the name
 * survive being read at arm's length in sunlight (D-015).
 */
const COLOURWAYS: Record<Category, Colourway[]> = {
  viewpoint: [
    { border: '#E4572E', inner: '#F5C518', paper: '#FFF1CE', ink: '#2B2118', accent: '#F2913D', band: '#2B2118', bandInk: '#F5C518' },
    { border: '#2A9D8F', inner: '#F4A261', paper: '#F4F1DE', ink: '#264653', accent: '#E9C46A', band: '#264653', bandInk: '#F4F1DE' },
    { border: '#6A4C93', inner: '#FFD166', paper: '#FFE9B8', ink: '#3A2A4D', accent: '#EF7674', band: '#3A2A4D', bandInk: '#FFD166' },
    { border: '#B5179E', inner: '#4CC9F0', paper: '#F1F7FF', ink: '#1B1035', accent: '#7209B7', band: '#1B1035', bandInk: '#4CC9F0' },
    { border: '#F26419', inner: '#2F4858', paper: '#FFE0B2', ink: '#33312E', accent: '#F6AE2D', band: '#2F4858', bandInk: '#FFE0B2' },
    { border: '#006D77', inner: '#FFDDD2', paper: '#EDF6F9', ink: '#001219', accent: '#E29578', band: '#006D77', bandInk: '#FFDDD2' },
  ],
  levada: [
    { border: '#8CB369', inner: '#F4E285', paper: '#FBF6D0', ink: '#2F3E1F', accent: '#5B8C3E', band: '#2F3E1F', bandInk: '#F4E285' },
    { border: '#1B7B5A', inner: '#BFD8AF', paper: '#E7F3DE', ink: '#12331F', accent: '#3FA37A', band: '#12331F', bandInk: '#BFD8AF' },
    { border: '#D68C45', inner: '#7FB069', paper: '#E9F0C9', ink: '#2F3E1F', accent: '#B5651D', band: '#2F3E1F', bandInk: '#E9F0C9' },
    { border: '#386641', inner: '#F2E8CF', paper: '#DDE5B6', ink: '#1B2A1B', accent: '#A7C957', band: '#1B2A1B', bandInk: '#F2E8CF' },
    { border: '#00A896', inner: '#F0F3BD', paper: '#DFF6E0', ink: '#05386B', accent: '#02C39A', band: '#05386B', bandInk: '#F0F3BD' },
    { border: '#6B705C', inner: '#FFE8D6', paper: '#F3F2D9', ink: '#283618', accent: '#A5A58D', band: '#283618', bandInk: '#FFE8D6' },
  ],
  village: [
    { border: '#C1292E', inner: '#F1E4C3', paper: '#FBF0D9', ink: '#3D2314', accent: '#E8A33D', band: '#3D2314', bandInk: '#F1E4C3' },
    { border: '#E09F3E', inner: '#8B2635', paper: '#FFF3D6', ink: '#540B0E', accent: '#C1292E', band: '#8B2635', bandInk: '#FFF3D6' },
    { border: '#335C67', inner: '#E8D8C3', paper: '#F2E8DC', ink: '#20323A', accent: '#A44A3F', band: '#20323A', bandInk: '#E8D8C3' },
    { border: '#9E2A2B', inner: '#E9C46A', paper: '#FFF4E0', ink: '#2B1B12', accent: '#D67D3E', band: '#2B1B12', bandInk: '#E9C46A' },
    { border: '#5F0F40', inner: '#FB8B24', paper: '#FFEDD8', ink: '#3C1518', accent: '#E36414', band: '#3C1518', bandInk: '#FB8B24' },
    { border: '#8A5A44', inner: '#F7C59F', paper: '#FBF3E4', ink: '#33221A', accent: '#D97A34', band: '#33221A', bandInk: '#F7C59F' },
  ],
  beach: [
    { border: '#0F7BA8', inner: '#FFE9AE', paper: '#E7F6FB', ink: '#0B3C5D', accent: '#F5C518', band: '#0B3C5D', bandInk: '#FFE9AE' },
    { border: '#F08C7A', inner: '#3FA9C9', paper: '#CFEAF2', ink: '#123E52', accent: '#FFD166', band: '#123E52', bandInk: '#CFEAF2' },
    { border: '#F5C518', inner: '#0F7BA8', paper: '#A8E0E3', ink: '#0B3C5D', accent: '#FF8C42', band: '#0B3C5D', bandInk: '#A8E0E3' },
    { border: '#00B4D8', inner: '#FFB703', paper: '#CAF0F8', ink: '#03045E', accent: '#FB8500', band: '#03045E', bandInk: '#FFB703' },
    { border: '#EF476F', inner: '#FFD166', paper: '#E4FBFF', ink: '#073B4C', accent: '#06D6A0', band: '#073B4C', bandInk: '#FFD166' },
    // ⚠ `bandInk` was `#2A9D8F` (the teal) and measured 3.03:1 on this band —
    // below the body-text floor, and this app is read in sunlight (D-015).
    { border: '#F4A261', inner: '#2A9D8F', paper: '#FFF0DB', ink: '#264653', accent: '#E76F51', band: '#264653', bandInk: '#FFF0DB' },
  ],
  landmark: [
    { border: '#3B2E5A', inner: '#E8B84B', paper: '#FFF0C4', ink: '#241B38', accent: '#C1666B', band: '#241B38', bandInk: '#E8B84B' },
    { border: '#B23A48', inner: '#F0D9B5', paper: '#FBEFDD', ink: '#2E1A1F', accent: '#D5A021', band: '#2E1A1F', bandInk: '#F0D9B5' },
    // ⚠ The band was `#E63946` and measured 3.90:1 against the cream. Deepened
    // rather than abandoned — the red is what makes this colourway, and at
    // `#9E1B26` it reads the same and measures 7.45:1.
    { border: '#1D3557', inner: '#E63946', paper: '#F1FAEE', ink: '#1D3557', accent: '#457B9D', band: '#9E1B26', bandInk: '#F1FAEE' },
    { border: '#264653', inner: '#E9C46A', paper: '#FDF3D8', ink: '#1B2B31', accent: '#E76F51', band: '#1B2B31', bandInk: '#E9C46A' },
    { border: '#7B2CBF', inner: '#FFD60A', paper: '#F6EDFF', ink: '#240046', accent: '#C77DFF', band: '#240046', bandInk: '#FFD60A' },
    { border: '#A4161A', inner: '#F5CB5C', paper: '#FFF3DC', ink: '#1F1300', accent: '#BA6E1F', band: '#1F1300', bandInk: '#F5CB5C' },
  ],
};

/** How the border is cut. Three treatments, chosen by the same hash. */
export const EDGE_STYLES = ['scallop', 'zigzag', 'torn'] as const;
export type EdgeStyle = (typeof EDGE_STYLES)[number];

/** The most a stamp is tilted, in degrees. Enough to look placed by hand. */
export const MAX_TILT_DEG = 5;

/**
 * How much of a cell a stamp may occupy, once tilted.
 *
 * ⚠ **A tilted square is wider than its own side.** A 62 dp sticker rotated 5°
 * measures about 67 dp corner to corner, so drawing it at the cell's full
 * width pushes it past the edge — measured in the workbench, where three
 * stamps came back 62, 65 and 67 wide. Views do not clip on iOS, so it would
 * have looked fine there and quietly lost corners on Android.
 *
 * The growth is `cos θ + sin θ`, so dividing by it is exactly the room the
 * rotation needs and no more.
 */
export const TILT_FIT =
  1 / (Math.cos(radians(MAX_TILT_DEG)) + Math.sin(radians(MAX_TILT_DEG)));

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/* ---------------------------------------------------------------- the hash */

/**
 * A small, stable string hash (FNV-1a).
 *
 * Written out rather than imported because it must **never change**: the day
 * this function returns different numbers is the day every stamp in every
 * user's passport changes appearance. It is not a security hash and does not
 * need to be — it needs to be the same one, forever.
 */
export function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    // The FNV prime, by shifts, so this stays in 32-bit integer arithmetic.
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash = hash >>> 0;
  }
  return hash >>> 0;
}

/* ------------------------------------------------------------- the cut edge */

/**
 * Cut the edge of a silhouette, the way a die-cut sticker is cut.
 *
 * Walks the perimeter at a fixed step and pushes each new point out or in
 * along the edge's normal. It is deliberately geometric rather than random:
 * the same shape always cuts the same way, which is what stops a stamp
 * shimmering when a list re-renders.
 */
export function cutEdge(
  outline: Point[],
  style: EdgeStyle,
  stepsPerEdge = 6
): Point[] {
  const amplitude = style === 'torn' ? 2.4 : style === 'zigzag' ? 2 : 1.6;
  const cut: Point[] = [];

  for (let i = 0; i < outline.length; i += 1) {
    const [ax, ay] = outline[i];
    const [bx, by] = outline[(i + 1) % outline.length];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    // Outward normal for a clockwise polygon.
    const nx = dy / length;
    const ny = -dx / length;

    // Long edges get more steps than short ones, so a 90-unit side and a
    // 20-unit side are cut at the same pitch rather than the same count.
    const steps = Math.max(2, Math.round((length / 90) * stepsPerEdge * 2));

    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      const px = ax + dx * t;
      const py = ay + dy * t;
      let push: number;

      if (style === 'scallop') {
        push = Math.sin(t * Math.PI * steps) * amplitude;
      } else if (style === 'zigzag') {
        push = s % 2 === 0 ? amplitude : -amplitude;
      } else {
        // "Torn": uneven but fixed, from the step index alone.
        push = (((s * 7) % 5) / 4) * amplitude * (s % 2 === 0 ? 1 : -0.6);
      }

      cut.push([px + nx * push, py + ny * push]);
    }
  }

  return cut;
}

/** Shrink a silhouette toward its centre, to make an inner ring or panel. */
export function inset(outline: Point[], amount: number): Point[] {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of outline) {
    cx += x;
    cy += y;
  }
  cx /= outline.length;
  cy /= outline.length;

  return outline.map(([x, y]): Point => {
    const dx = x - cx;
    const dy = y - cy;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const scale = Math.max(0, length - amount) / length;
    return [cx + dx * scale, cy + dy * scale];
  });
}

/* ------------------------------------------------------------- the design */

/**
 * The design for one place.
 *
 * `placeId` decides everything that varies; `category` decides the emblem,
 * which is the only thing carrying meaning. Calling this twice with the same
 * arguments returns the same design, today and in five years.
 */
export function designFor(placeId: string, category: Category): StampDesign {
  const hash = hashId(placeId);
  const shapeName = SHAPE_NAMES[hash % SHAPE_NAMES.length];
  const outline = SHAPES[shapeName];
  const colourways = COLOURWAYS[category];

  const colourway = colourways[(hash >>> 3) % colourways.length];
  const edge = EDGE_STYLES[(hash >>> 8) % EDGE_STYLES.length];
  const tiltDeg = ((hash >>> 16) % (MAX_TILT_DEG * 2 + 1)) - MAX_TILT_DEG;

  return {
    category,
    outline,
    cutOutline: cutEdge(outline, edge),
    innerOutline: cutEdge(inset(outline, 4), edge),
    panel: inset(outline, 8.5),
    colourway,
    icon: ICONS[category],
    tiltDeg,
    shapeName,
  };
}

/** `points` as an SVG polygon string. */
export function toPolygon(points: Point[]): string {
  return points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ------------------------------------------------------------ the ornaments */

/**
 * A sunburst, as one path: alternating wedges radiating from a centre.
 *
 * Drawn faintly behind the emblem. It is the single cheapest thing that turns
 * a flat silhouette into something that looks *printed* — the reference sheet
 * uses it on half its stickers.
 */
export function sunburstPath(
  cx: number,
  cy: number,
  radius: number,
  wedges = 16
): string {
  const parts: string[] = [];
  const step = (Math.PI * 2) / wedges;

  for (let i = 0; i < wedges; i += 2) {
    const a = i * step;
    const b = a + step;
    parts.push(
      `M${round(cx)} ${round(cy)}` +
        ` L${round(cx + Math.cos(a) * radius)} ${round(cy + Math.sin(a) * radius)}` +
        ` L${round(cx + Math.cos(b) * radius)} ${round(cy + Math.sin(b) * radius)} Z`
    );
  }

  return parts.join(' ');
}

/**
 * Perforation dots following a silhouette, as one path of small circles.
 *
 * One path rather than N elements, because a passport can hold 250 stickers
 * and each of these would otherwise be forty more nodes for the renderer to
 * walk.
 */
export function dotsPath(outline: Point[], spacing: number, radius: number): string {
  const parts: string[] = [];

  for (let i = 0; i < outline.length; i += 1) {
    const [ax, ay] = outline[i];
    const [bx, by] = outline[(i + 1) % outline.length];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.sqrt(dx * dx + dy * dy);
    const count = Math.max(1, Math.floor(length / spacing));

    for (let s = 0; s < count; s += 1) {
      const t = s / count;
      const x = round(ax + dx * t);
      const y = round(ay + dy * t);
      parts.push(
        `M${x} ${y} m${-radius} 0 a${radius} ${radius} 0 1 0 ${radius * 2} 0 a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
      );
    }
  }

  return parts.join(' ');
}

/* --------------------------------------------------------- the composition */

/**
 * One drawable element, in a vocabulary both SVG-in-a-browser and
 * `react-native-svg` understand natively.
 *
 * **This is why the composition lives here and not in the renderer.** There
 * are two renderers — the app (`ui/StampArt.tsx`) and the preview page
 * (`tools/preview-stamps.mjs`), which exists so a design can be *judged* on a
 * project with no device. A preview that draws the stamp slightly differently
 * from the app is worse than no preview, because it is the thing that gets
 * looked at and believed. So both replay this list and neither composes
 * anything of its own.
 */
export type StampElement =
  | { kind: 'polygon'; points: string; fill: string; stroke?: string; strokeWidth?: number; opacity?: number; clip?: boolean }
  | { kind: 'path'; d: string; fill: string; transform?: string; opacity?: number; clip?: boolean }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; fill: string; opacity?: number; clip?: boolean }
  | {
      kind: 'text';
      x: number;
      y: number;
      text: string;
      fill: string;
      fontSize: number;
      opacity?: number;
      /**
       * The width the name must occupy, when it would otherwise overrun the
       * band. Null means "draw it at its natural width".
       *
       * Both SVG and `react-native-svg` implement this as `textLength` with
       * `lengthAdjust="spacingAndGlyphs"`, so a long name is condensed rather
       * than sticking out over the paper.
       */
      textLength: number | null;
      clip?: boolean;
    };

/**
 * The muted palette for a place not yet collected.
 *
 * ⚠ **Not simply "the same thing, fainter".** D-015 is explicit that
 * unvisited must stay *legible* mid-grey and never near-invisible — an
 * uncollected stamp is a recommendation (CONTEXT §4.1 calls the uncollected
 * places the recommendations), so it has a job to do and must be readable.
 * What changes is colour and ink weight, never the shape or the emblem — so
 * the category still reads, and the difference survives colour blindness.
 */
export const UNCOLLECTED: Colourway = {
  // ⚠ **Neutral since 2026-08-14, and it was a real defect.** These were
  // blue-greys taken from the old theme, and when D-054 made the passport card
  // neutral `#1C1C1E` the sticker's paper measured **1.16:1** against the card
  // behind it. The shape was invisible: a grey smudge with an emblem floating
  // in it. Nothing failed, because no test measured the *uncollected* palette
  // against the page — only the thirty collected ones.
  //
  // The **border** carries the shape now (3.36:1 on the card) rather than the
  // paper, which is what lets the paper stay properly muted. That is how a
  // real die-cut sticker reads anyway: you see its edge, not its middle.
  border: '#6E6E73',
  inner: '#8E8E93',
  paper: '#3A3A3C',
  ink: '#D1D1D6',
  accent: '#48484A',
  band: '#2C2C2E',
  bandInk: '#C7C7CC',
};

/** The most characters on one line of the band before it stops being readable. */
export const MAX_LINE_CHARS = 12;

/** Two lines is the limit. A third would be smaller than it is worth. */
export const MAX_LINES = 2;

/**
 * The least room the emblem may be left above the band, in canvas units.
 *
 * ⚠ Found by measuring, not by looking: on a **shield** the widest part is the
 * top, so a search that only maximised band width put the band at the very top
 * of the panel and left the emblem exactly **zero** room — which then escaped
 * the sticker upward. The band search now refuses any position that does not
 * leave this much.
 */
export const MIN_EMBLEM_ROOM = 30;

/**
 * Break a place name onto the band.
 *
 * Two lines rather than an ellipsis wherever possible, because the project
 * lead's requirement is that **the place name fits** — and "MIRADOURO GRA…"
 * technically fits while telling the reader nothing. Only a name too long for
 * two lines is truncated, and by then the name beside the sticker in the
 * passport list is carrying it anyway.
 */
export function wrapLabel(name: string, maxChars = MAX_LINE_CHARS): string[] {
  const upper = name.trim().toUpperCase().replace(/\s+/g, ' ');
  if (upper.length <= maxChars) {
    return [upper];
  }

  const words = upper.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current !== '') {
      lines.push(current);
    }
    current = word;
    if (lines.length === MAX_LINES) {
      break;
    }
  }
  if (current !== '' && lines.length < MAX_LINES) {
    lines.push(current);
  }

  // A single word longer than the line, or more words than two lines hold.
  const capped = lines.slice(0, MAX_LINES);
  return capped.map((line) =>
    line.length > maxChars + 3 ? `${line.slice(0, maxChars + 2)}…` : line
  );
}

/**
 * Roughly how wide a run of capitals is, without a font metric.
 *
 * ⚠ An estimate, and knowingly so: the real advance depends on the font the
 * platform picks. It only decides *whether* to condense, and it errs wide —
 * condensing a name that would just have fitted costs nothing visible, while
 * failing to condense one that does not fit puts letters on the paper.
 */
export function estimateTextWidth(label: string, fontSize: number): number {
  return label.length * (fontSize * 0.66 + 0.6);
}

/**
 * How wide the panel is at a given height.
 *
 * A scanline across the polygon: every edge straddling `y` contributes a
 * crossing, and the span between the outermost two is the width. Convex
 * shapes only, which all eight are.
 */
export function panelWidthAt(panel: Point[], y: number): number {
  const crossings: number[] = [];

  for (let i = 0; i < panel.length; i += 1) {
    const [ax, ay] = panel[i];
    const [bx, by] = panel[(i + 1) % panel.length];
    if (ay === by) {
      continue;
    }
    const low = Math.min(ay, by);
    const high = Math.max(ay, by);
    if (y < low || y > high) {
      continue;
    }
    crossings.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
  }

  if (crossings.length < 2) {
    return 0;
  }
  return Math.max(...crossings) - Math.min(...crossings);
}

/**
 * Where to put a band of a given height on a given silhouette.
 *
 * ⚠ **Searched, not tabulated.** Eight shapes times a band that is one or two
 * lines tall is sixteen placements, three of the shapes taper, and a hand-made
 * table would be wrong for one combination and nobody would notice. So this
 * measures: it scans candidate positions and takes the one where the band's
 * *narrowest* line is widest, preferring lower placements when two are equal
 * because a name belongs at the foot of a label.
 */
export function bestBandY(
  panel: Point[],
  bandHeight: number,
  requiredWidth = 0,
  emblemRoom = MIN_EMBLEM_ROOM
): number {
  const top = Math.min(...panel.map(([, y]) => y));
  const bottom = Math.max(...panel.map(([, y]) => y));

  const candidates: { y: number; width: number }[] = [];
  // Start below the emblem's room, so a shape that is widest at the top
  // cannot win the band a position that leaves the emblem nowhere to go.
  const first = Math.min(top + emblemRoom, Math.max(top, bottom - bandHeight));
  for (let y = first; y + bandHeight <= bottom; y += 0.5) {
    // The narrowest line the band covers is what actually limits the name.
    candidates.push({
      y,
      width: Math.min(
        panelWidthAt(panel, y + 1),
        panelWidthAt(panel, y + bandHeight - 1)
      ),
    });
  }
  if (candidates.length === 0) {
    return top;
  }

  const widest = Math.max(...candidates.map((candidate) => candidate.width));

  // ⚠ **Not simply the widest position.** On a diamond the widest line is the
  // middle, and a band there leaves the emblem squeezed into the top corner —
  // which looked wrong, and was the first thing visible in the generated
  // markup. A luggage label puts its name near the foot. So: take the *lowest*
  // position that is still wide enough, and only fall back to the widest when
  // nothing lower qualifies.
  const target = Math.max(requiredWidth, widest * 0.68);
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    if (candidates[i].width >= target) {
      return candidates[i].y;
    }
  }

  return candidates.reduce((best, candidate) =>
    candidate.width >= best.width ? candidate : best
  ).y;
}

/**
 * Where the emblem sits between the panel top and the band, and how big.
 *
 * ⚠ **Searched, like the band, and for the same reason.** Centring the emblem
 * in its space is the obvious thing and it is wrong on a tapering shape: the
 * midpoint of a triangle's upper half is one of the narrowest lines on the
 * sticker, and the emblem came out at 0.22 scale — a 14 dp drawing on a 62 dp
 * sticker. Since the emblem is the only thing carrying the category (D-015),
 * that is not a cosmetic loss.
 *
 * So this scans candidate centres and keeps the one that fits the largest
 * emblem, measuring the width at the emblem's own top and bottom rather than
 * at its centre — on a triangle the top edge is what actually binds.
 */
export function bestEmblem(
  panel: Point[],
  emblem: Emblem,
  top: number,
  bottom: number
): { centreY: number; scale: number } {
  const [minX, minY, maxX, maxY] = emblem.box;
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;

  let best = { centreY: (top + bottom) / 2, scale: 0 };

  for (let centreY = top; centreY <= bottom; centreY += 0.5) {
    const halfHeight = Math.min(centreY - top, bottom - centreY);
    let scale = (halfHeight * 2) / boxHeight;

    // Two passes are enough: shrinking for width can only make more room, not
    // less, so the second pass converges.
    for (let pass = 0; pass < 2; pass += 1) {
      const drawnHalf = (scale * boxHeight) / 2;
      const width = Math.min(
        panelWidthAt(panel, centreY - drawnHalf),
        panelWidthAt(panel, centreY + drawnHalf)
      );
      scale = Math.min(scale, Math.max(0, width - 3) / boxWidth);
    }

    if (scale > best.scale) {
      best = { centreY, scale };
    }
  }

  return { centreY: best.centreY, scale: Math.min(0.82, best.scale) };
}

/**
 * Everything to draw for one stamp, in order, on the 100×100 grid.
 */
export function stampElements(
  design: StampDesign,
  name: string,
  collected: boolean
): StampElement[] {
  const colours = collected ? design.colourway : UNCOLLECTED;
  const lines = wrapLabel(name);
  // ⚠ Tuned against the measured emblem scale, not by eye. At 11.5 a two-line
  // band took 28 of the 100 units and squeezed the emblem to 0.21 scale — on a
  // 62 dp sticker that is a 13 dp emblem, which is decoration rather than a
  // signal, and the emblem is the only thing carrying the category (D-015).
  const lineHeight = 9.5;
  const bandHeight = lines.length * lineHeight + 4;
  const fontSize = lineHeight * 0.86;
  const widestLine = Math.max(
    ...lines.map((line) => estimateTextWidth(line, fontSize))
  );
  const bandY = bestBandY(design.panel, bandHeight, widestLine / 0.88);

  // The emblem gets the room above the band. Both where it sits and how big
  // it is are searched — see `bestEmblem`. Nothing is floored: a floor is what
  // let the emblem escape upward on a shield. If a shape genuinely has little
  // room the emblem is small, which is a look; crossing the border is a bug.
  const panelTop = Math.min(...design.panel.map(([, y]) => y));
  const { centreY: emblemCentreY, scale: iconScale } = bestEmblem(
    design.panel,
    design.icon,
    panelTop + 1.5,
    bandY - 1.5
  );
  // Place the emblem's own box — not the 100×100 grid — centred in the slot.
  const [boxMinX, boxMinY, boxMaxX, boxMaxY] = design.icon.box;
  const offsetX = 50 - ((boxMinX + boxMaxX) / 2) * iconScale;
  const offsetY = emblemCentreY - ((boxMinY + boxMaxY) / 2) * iconScale;
  const iconTransform = `translate(${round(offsetX)} ${round(offsetY)}) scale(${round(iconScale)})`;

  const elements: StampElement[] = [
    // Two cut borders, one inside the other. The second is most of what makes
    // this read as a printed label rather than a coloured shape.
    { kind: 'polygon', points: toPolygon(design.cutOutline), fill: colours.border },
    { kind: 'polygon', points: toPolygon(design.innerOutline), fill: colours.inner },
    { kind: 'polygon', points: toPolygon(design.panel), fill: colours.paper },
    // The sunburst behind the emblem. **Clipped to the panel** — its radius
    // deliberately overshoots the canvas so the rays reach every corner, and
    // unclipped it painted straight over both borders and out of the sticker.
    {
      kind: 'path',
      d: sunburstPath(50, emblemCentreY, 62),
      fill: colours.accent,
      opacity: collected ? 0.22 : 0.14,
      clip: true,
    },
    // Perforation dots just inside the panel.
    {
      kind: 'path',
      d: dotsPath(inset(design.panel, 4), 7, 0.9),
      fill: colours.ink,
      opacity: collected ? 0.45 : 0.3,
    },
    // A keyline inside those.
    {
      kind: 'polygon',
      points: toPolygon(inset(design.panel, 7)),
      fill: 'none',
      stroke: colours.ink,
      strokeWidth: 1,
      opacity: collected ? 0.5 : 0.35,
    },
    // The emblem, in two tones.
    { kind: 'path', d: design.icon.back, fill: colours.accent, transform: iconTransform },
    { kind: 'path', d: design.icon.front, fill: colours.ink, transform: iconTransform },
    // The band runs full width and is clipped to the panel by the renderer,
    // which gives it the sticker's own shape on a triangle or a diamond free.
    { kind: 'rect', x: 0, y: bandY, width: CANVAS, height: bandHeight, fill: colours.band, clip: true },
  ];

  lines.forEach((line, index) => {
    const baseline = bandY + 4 + lineHeight * (index + 0.78);
    const available = panelWidthAt(design.panel, baseline) * 0.88;
    const natural = estimateTextWidth(line, fontSize);

    elements.push({
      kind: 'text',
      x: CANVAS / 2,
      y: baseline,
      text: line,
      fill: colours.bandInk,
      fontSize,
      textLength: natural > available ? round(available) : null,
    });
  });

  return elements;
}

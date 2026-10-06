/**
 * The founder stamp's artwork (T-233) and the set medals' (T-235).
 *
 * The same contract as `stampArt.ts`: this module decides every shape and
 * colour and returns a list of elements; two renderers replay it without
 * composing anything of their own, `ui/MedalArt.tsx` in the app and
 * `tools/lib/svg-render.mjs` for the preview page (OQ-9). What is looked at on
 * the page is what ships.
 *
 * THE GOLD POSTMARK
 * -----------------
 * A round passport stamp in gold ink, perforated like every other stamp, with
 * a star, the word FOUNDER on a band, and the destination and year under it.
 * Chosen by the project lead on 2026-10-06 from three drawn designs (a red wax
 * seal and a gold medal on a ribbon were the others): it belongs to the
 * passport's own family, only in gold.
 *
 * THE SET MEDALS
 * --------------
 * The same postmark, one per set (`content/medals.json`): a municipality's
 * medal carries the municipality's own outline from `regions.json`, the
 * levadas' medal the stamps' levada emblem, and the set's name on the band.
 * Silver with a gold arc for how far the set has got, all gold once complete.
 * A complete medal on a passport not yet unlocked is drawn gold too; the
 * screen frosts it and puts the padlock over it, as for a locked stamp.
 *
 * Nothing here knows the destination (D-017): the words and the outline come
 * in from the caller, the words already translated.
 *
 * Pure: no React, no Expo. Tested in `medalArt.test.ts`.
 */

import type { Category } from '../content/contentPack.ts';
import {
  CANVAS,
  categoryEmblem,
  dotsPath,
  sunburstPath,
  toPolygon,
  type Point,
  type StampElement,
} from './stampArt.ts';

export type FounderWords = {
  /** "FUNDADOR", "FOUNDER", "GRÜNDER": the caller translates. */
  title: string;
  /** The pack's destination, or null when it names none. */
  destination: string | null;
  /** The year the founder window opened, or null while it is unset. */
  year: number | null;
};

const GOLD = '#F2B820';
const GOLD_DEEP = '#C98A00';
const GOLD_INK = '#6B4500';
const CREAM = '#FFF6DC';

const C = CANVAS / 2;

/** A full circle as one path. */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;
}

/** A five-pointed star, its first point straight up. */
function star(cx: number, cy: number, outer: number, inner = outer * 0.45): string {
  const points: Point[] = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return toPolygon(points);
}

/** A circle as points, for the perforations (`dotsPath` follows an outline). */
function circlePoints(cx: number, cy: number, r: number, count: number): Point[] {
  return Array.from({ length: count }, (_, i): Point => {
    const a = (i * Math.PI * 2) / count;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

/** A ring of points alternating between two radii: the stamp's scalloped edge. */
function scallopedRing(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const points: Point[] = [];
  for (let i = 0; i < teeth * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / teeth;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return toPolygon(points);
}

/** Roughly how wide a capital is, as a share of the font size, in the bold the phone draws. */
const CAP_WIDTH = 0.7;
/** The smallest the words may get before they are condensed instead. */
const MIN_FONT = 5.5;

/**
 * A line of capitals that fits its width. ⚠ **Smaller first, condensed only
 * as a last resort** (found on the P30, 2026-10-06): Android draws this bold
 * wider than the browser and does not honour `textLength` the same way, so
 * "CÂMARA DE LOBOS" ran off the band while the preview page looked fine.
 */
function text(x: number, y: number, words: string, fill: string, fontSize: number, maxWidth: number): StampElement {
  const fitted = Math.max(MIN_FONT, Math.min(fontSize, maxWidth / (words.length * CAP_WIDTH)));
  const natural = words.length * fitted * CAP_WIDTH;
  return {
    kind: 'text',
    x,
    y,
    text: words,
    fill,
    fontSize: Math.round(fitted * 10) / 10,
    textLength: natural > maxWidth ? maxWidth : null,
  };
}

/** The line under the title: "MADEIRA · 2026", or whichever half is known. */
function subline(words: FounderWords): string {
  return [words.destination?.toUpperCase() ?? null, words.year === null ? null : String(words.year)]
    .filter((part): part is string => part !== null)
    .join(' · ');
}

/** The founder stamp, on the stamps' 100 by 100 canvas. */
export function founderElements(words: FounderWords): StampElement[] {
  const below = subline(words);
  return [
    { kind: 'polygon', points: scallopedRing(C, C, 48, 45.5, 36), fill: CREAM },
    { kind: 'path', d: circle(C, C, 43.5), fill: 'none', stroke: GOLD_DEEP, strokeWidth: 2.6 },
    { kind: 'path', d: circle(C, C, 36.5), fill: 'none', stroke: GOLD_DEEP, strokeWidth: 0.9 },
    { kind: 'path', d: sunburstPath(C, C, 34, 28), fill: GOLD, opacity: 0.22 },
    // Perforations, as on every passport stamp.
    { kind: 'path', d: dotsPath(circlePoints(C, C, 40, 40), 6, 0.75), fill: GOLD_DEEP },
    { kind: 'polygon', points: star(C, 31, 9.5), fill: GOLD, stroke: GOLD_DEEP, strokeWidth: 1, strokeLinejoin: 'round' },
    { kind: 'rect', x: 14, y: 47, width: 72, height: 15, fill: GOLD_DEEP },
    text(C, 58.5, words.title.toUpperCase(), CREAM, 10, 64),
    ...(below === '' ? [] : [text(C, 73, below, GOLD_INK, 6.5, 50)]),
  ];
}

/* ---------------------------------------------------------------- set medals */

/** What a set medal shows in its middle. */
export type MedalEmblem =
  | { kind: 'outline'; points: ReadonlyArray<[number, number]> }
  | { kind: 'category'; category: Category };

export type SetMedalWords = {
  emblem: MedalEmblem;
  /** The set's name for the band: the municipality, or the category's plural. */
  name: string;
  collected: number;
  total: number;
  /** `silver` while the set is under way, `gold` once it is complete. */
  look: 'silver' | 'gold';
};

type Ink = { paper: string; ring: string; emblemBack: string; emblemFront: string; band: string; bandInk: string; rays: string };

const GOLD_INKS: Ink = {
  paper: CREAM,
  ring: GOLD_DEEP,
  emblemBack: GOLD,
  emblemFront: GOLD_DEEP,
  band: GOLD_DEEP,
  bandInk: CREAM,
  rays: GOLD,
};

/**
 * Silver: grey enough to read as "not yet", dark enough to stay legible at
 * arm's length in sunlight (D-015), the same rule the uncollected stamps keep.
 */
const SILVER_INKS: Ink = {
  paper: '#F4F4F6',
  ring: '#8E8E96',
  emblemBack: '#C9C9CF',
  emblemFront: '#8E8E96',
  band: '#6E6E76',
  bandInk: '#FFFFFF',
  rays: '#C9C9CF',
};

/** Where the emblem sits: above the band, inside the inner ring. */
const EMBLEM_BOX = { x: 31, y: 21, width: 38, height: 32 };
const RING_R = 43.5;

/**
 * A municipality's outline, fitted into the emblem box. Longitude is scaled by
 * the cosine of the latitude so the shape is not stretched sideways, and the
 * ring is thinned to points at least a fiftieth of the box apart: the medal is
 * 84 points wide, and three hundred vertices would draw nothing more.
 */
export function fitOutline(points: ReadonlyArray<[number, number]>, box = EMBLEM_BOX): Point[] {
  if (points.length < 3) return [];
  const meanLat = points.reduce((sum, [, lat]) => sum + lat, 0) / points.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const flat = points.map(([lon, lat]): Point => [lon * k, -lat]);
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min(box.width / (maxX - minX || 1), box.height / (maxY - minY || 1));
  const offsetX = box.x + (box.width - (maxX - minX) * scale) / 2;
  const offsetY = box.y + (box.height - (maxY - minY) * scale) / 2;
  const fitted = flat.map(([x, y]): Point => [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale]);

  const step = Math.max(box.width, box.height) / 50;
  const kept: Point[] = [fitted[0]];
  for (const point of fitted.slice(1)) {
    const [lx, ly] = kept[kept.length - 1];
    if (Math.hypot(point[0] - lx, point[1] - ly) >= step) kept.push(point);
  }
  return kept;
}

/** A category emblem's two layers, scaled from the stamp grid into the emblem box. */
function categoryLayers(category: Category, inks: Ink): StampElement[] {
  const emblem = categoryEmblem(category);
  const [minX, minY, maxX, maxY] = emblem.box;
  const scale = Math.min(EMBLEM_BOX.width / (maxX - minX), EMBLEM_BOX.height / (maxY - minY));
  const dx = EMBLEM_BOX.x + (EMBLEM_BOX.width - (maxX - minX) * scale) / 2 - minX * scale;
  const dy = EMBLEM_BOX.y + (EMBLEM_BOX.height - (maxY - minY) * scale) / 2 - minY * scale;
  const transform = `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)})`;
  return [
    { kind: 'path', d: emblem.back, fill: inks.emblemBack, transform },
    { kind: 'path', d: emblem.front, fill: inks.emblemFront, transform },
  ];
}

/** A municipality's outline as one filled shape; nothing when it has no usable outline. */
function outlineLayer(points: ReadonlyArray<[number, number]>, inks: Ink): StampElement[] {
  const outline = fitOutline(points);
  if (outline.length < 3) return [];
  return [
    {
      kind: 'polygon',
      points: toPolygon(outline),
      fill: inks.emblemFront,
      stroke: inks.emblemFront,
      strokeWidth: 0.6,
      strokeLinejoin: 'round',
    },
  ];
}

/** The arc of a circle from the top, clockwise, for a fraction of the way round. */
function progressArc(fraction: number): string {
  const end = -Math.PI / 2 + Math.PI * 2 * Math.min(fraction, 0.9999);
  const [x0, y0] = [C, C - RING_R];
  const [x1, y1] = [C + Math.cos(end) * RING_R, C + Math.sin(end) * RING_R];
  return `M${x0} ${y0} A${RING_R} ${RING_R} 0 ${fraction > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** A set medal, on the stamps' 100 by 100 canvas. */
export function setMedalElements(words: SetMedalWords): StampElement[] {
  const inks = words.look === 'gold' ? GOLD_INKS : SILVER_INKS;
  const emblem =
    words.emblem.kind === 'outline'
      ? outlineLayer(words.emblem.points, inks)
      : categoryLayers(words.emblem.category, inks);
  const fraction = words.total === 0 ? 0 : words.collected / words.total;

  return [
    { kind: 'polygon', points: scallopedRing(C, C, 48, 45.5, 36), fill: inks.paper },
    { kind: 'path', d: circle(C, C, RING_R), fill: 'none', stroke: inks.ring, strokeWidth: words.look === 'gold' ? 2.6 : 1.4 },
    // How far the set has got, in gold over the silver ring.
    ...(words.look === 'silver' && fraction > 0
      ? [{ kind: 'path', d: progressArc(fraction), fill: 'none', stroke: GOLD, strokeWidth: 3.4 } as StampElement]
      : []),
    { kind: 'path', d: circle(C, C, 36.5), fill: 'none', stroke: inks.ring, strokeWidth: 0.9 },
    { kind: 'path', d: sunburstPath(C, C, 34, 28), fill: inks.rays, opacity: 0.22 },
    { kind: 'path', d: dotsPath(circlePoints(C, C, 40, 40), 6, 0.75), fill: inks.ring },
    ...emblem,
    { kind: 'rect', x: 14, y: 58, width: 72, height: 14, fill: inks.band },
    text(C, 68.5, words.name.toUpperCase(), inks.bandInk, 8.5, 64),
  ];
}

/**
 * The founder stamp's artwork (T-233), and later the set medals' (T-235).
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
 * Nothing here knows the destination (D-017): the words come in, already
 * translated, from the caller.
 *
 * Pure: no React, no Expo. Tested in `medalArt.test.ts`.
 */

import { CANVAS, dotsPath, sunburstPath, toPolygon, type Point, type StampElement } from './stampArt.ts';

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

function text(x: number, y: number, words: string, fill: string, fontSize: number, maxWidth: number): StampElement {
  // Condensed only when it would overrun, as the stamps' bands are (`stampArt.ts`).
  const natural = words.length * fontSize * 0.62;
  return { kind: 'text', x, y, text: words, fill, fontSize, textLength: natural > maxWidth ? maxWidth : null };
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

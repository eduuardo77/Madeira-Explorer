/**
 * The founder stamp's artwork (T-233), and later the set medals' (T-235).
 *
 * The same contract as `stampArt.ts`: this module decides every shape and
 * colour and returns a list of elements; two renderers replay it without
 * composing anything of their own, `ui/MedalArt.tsx` in the app and
 * `tools/lib/svg-render.mjs` for the preview page the project lead judges by
 * eye (OQ-9). What is approved on the page is what ships.
 *
 * THREE DESIGNS, ONE TO KEEP
 * --------------------------
 * OQ-9 asks for the art to be drawn in-house from the stamp system (D-086) and
 * approved before the UI uses it, so three are drawn, each in the stamps'
 * vocabulary of rings, rays and capitals:
 *
 *   seal     a red wax seal pressed with a gold star and laurel
 *   medal    a gold medal on a ribbon, rays behind a star
 *   postmark a round gold passport stamp, perforated, like the others
 *
 * `FOUNDER_STYLE` is the one the app draws. The other two are deleted once the
 * lead has chosen.
 *
 * Nothing here knows the destination (D-017): the words come in, already
 * translated, from the caller.
 *
 * Pure: no React, no Expo. Tested in `medalArt.test.ts`.
 */

import { CANVAS, dotsPath, sunburstPath, toPolygon, type Point, type StampElement } from './stampArt.ts';

export type FounderStyle = 'seal' | 'medal' | 'postmark';

/** The design the app draws (OQ-9: the project lead's choice). */
export const FOUNDER_STYLE: FounderStyle = 'postmark';

export type FounderWords = {
  /** "FUNDADOR", "FOUNDER", "GRÜNDER": the caller translates. */
  title: string;
  /** The pack's destination, or null when it names none. */
  destination: string | null;
  /** The year the founder window opened, or null while it is unset. */
  year: number | null;
};

const GOLD_LIGHT = '#FFE08A';
const GOLD = '#F2B820';
const GOLD_DEEP = '#C98A00';
const GOLD_INK = '#6B4500';
const CREAM = '#FFF6DC';
const WAX = '#A3202A';
const WAX_DEEP = '#7E1219';
const WAX_LIGHT = '#C0414A';
const RIBBON_BLUE = '#1F4E9E';
const RIBBON_RED = '#C0392B';

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

/** A ring of points, alternating between two radii: a scalloped or cog edge. */
function wavyRing(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const points: Point[] = [];
  for (let i = 0; i < teeth * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / teeth;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return toPolygon(points);
}

/**
 * Laurel leaves along an arc, as one path: a leaf is an almond drawn at the
 * origin, moved and turned into place. One path, not one element per leaf,
 * for the same reason the perforations are one (`dotsPath`).
 */
function laurelPath(cx: number, cy: number, radius: number, fromDeg: number, toDeg: number, leaves: number): string {
  const parts: string[] = [];
  for (let i = 0; i < leaves; i += 1) {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / (leaves - 1);
    const a = (deg * Math.PI) / 180;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    // The leaf points along the arc, tilted outward a little, like a wreath.
    const turn = a + (toDeg > fromDeg ? 1 : -1) * (Math.PI / 2 - 0.5);
    const dx = Math.cos(turn) * 4.2;
    const dy = Math.sin(turn) * 4.2;
    const nx = -dy * 0.42;
    const ny = dx * 0.42;
    parts.push(
      `M${(x - dx).toFixed(2)} ${(y - dy).toFixed(2)}` +
        ` Q${(x + nx).toFixed(2)} ${(y + ny).toFixed(2)} ${(x + dx).toFixed(2)} ${(y + dy).toFixed(2)}` +
        ` Q${(x - nx).toFixed(2)} ${(y - ny).toFixed(2)} ${(x - dx).toFixed(2)} ${(y - dy).toFixed(2)} Z`
    );
  }
  return parts.join(' ');
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

/** The founder stamp, in one of the three designs, on the stamps' 100 by 100 canvas. */
export function founderElements(words: FounderWords, style: FounderStyle = FOUNDER_STYLE): StampElement[] {
  const title = words.title.toUpperCase();
  const below = subline(words);

  switch (style) {
    case 'seal':
      return [
        { kind: 'polygon', points: wavyRing(C, C, 48, 44, 22), fill: WAX_DEEP },
        { kind: 'path', d: circle(C, C, 43), fill: WAX },
        { kind: 'path', d: circle(C, C, 36), fill: WAX_LIGHT, opacity: 0.35 },
        { kind: 'path', d: circle(C, C, 36), fill: 'none', stroke: WAX_DEEP, strokeWidth: 1.6 },
        // Under the words, never across them: drawn through them it read as flames.
        { kind: 'path', d: laurelPath(C, C, 33, 100, 150, 5), fill: GOLD },
        { kind: 'path', d: laurelPath(C, C, 33, 80, 30, 5), fill: GOLD },
        { kind: 'polygon', points: star(C, 36, 10), fill: GOLD, stroke: GOLD_DEEP, strokeWidth: 0.8, strokeLinejoin: 'round' },
        text(C, 61, title, CREAM, 9.5, 52),
        ...(below === '' ? [] : [text(C, 72, below, GOLD_LIGHT, 6, 46)]),
      ];

    case 'medal':
      return [
        { kind: 'polygon', points: toPolygon([[24, 0], [42, 0], [58, 34], [40, 34]]), fill: RIBBON_BLUE },
        { kind: 'polygon', points: toPolygon([[58, 0], [76, 0], [60, 34], [42, 34]]), fill: RIBBON_RED },
        { kind: 'path', d: circle(C, 63, 35), fill: GOLD_DEEP },
        { kind: 'polygon', points: wavyRing(C, 63, 33, 31, 30), fill: GOLD },
        { kind: 'path', d: circle(C, 63, 27), fill: GOLD_LIGHT },
        { kind: 'path', d: sunburstPath(C, 63, 27, 24), fill: GOLD, opacity: 0.45 },
        { kind: 'path', d: circle(C, 63, 27), fill: 'none', stroke: GOLD_DEEP, strokeWidth: 1.2 },
        { kind: 'polygon', points: star(C, 54, 9), fill: GOLD_INK },
        text(C, 74, title, GOLD_INK, 7.5, 40),
        ...(below === '' ? [] : [text(C, 83, below, GOLD_INK, 5, 32)]),
      ];

    case 'postmark':
      return [
        { kind: 'polygon', points: wavyRing(C, C, 48, 45.5, 36), fill: CREAM },
        { kind: 'path', d: circle(C, C, 43.5), fill: 'none', stroke: GOLD_DEEP, strokeWidth: 2.6 },
        { kind: 'path', d: circle(C, C, 36.5), fill: 'none', stroke: GOLD_DEEP, strokeWidth: 0.9 },
        { kind: 'path', d: sunburstPath(C, C, 34, 28), fill: GOLD, opacity: 0.22 },
        { kind: 'polygon', points: star(C, 31, 9.5), fill: GOLD, stroke: GOLD_DEEP, strokeWidth: 1, strokeLinejoin: 'round' },
        // Perforations, as on every passport stamp; a laurel hid behind the band.
        { kind: 'path', d: dotsPath(circlePoints(C, C, 40, 40), 6, 0.75), fill: GOLD_DEEP },
        { kind: 'rect', x: 14, y: 47, width: 72, height: 15, fill: GOLD_DEEP },
        text(C, 58.5, title, CREAM, 10, 64),
        ...(below === '' ? [] : [text(C, 73, below, GOLD_INK, 6.5, 50)]),
      ];
  }
}

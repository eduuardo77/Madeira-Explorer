/**
 * The founder stamp's drawing stays on its canvas and says what it should (T-233).
 *
 *     cd app && npm test
 *
 * Geometry is checked here; whether it looks right is judged by eye on
 * `tools/out/founder-options.html` (OQ-9), because a mark that passed every
 * geometry test once rendered as a crosshair (CLAUDE.md).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { FOUNDER_STYLE, founderElements, type FounderStyle } from './medalArt.ts';
import { CANVAS } from './stampArt.ts';

const STYLES: FounderStyle[] = ['seal', 'medal', 'postmark'];
const WORDS = { title: 'Fundador', destination: 'Madeira', year: 2026 };

/** Every coordinate a path or polygon names. */
function coordinates(element: ReturnType<typeof founderElements>[number]): number[] {
  if (element.kind === 'polygon') return element.points.split(/[ ,]/).map(Number);
  if (element.kind === 'rect') return [element.x, element.y, element.x + element.width, element.y + element.height];
  if (element.kind === 'text') return [element.x, element.y];
  // Absolute commands only: relative arcs (`a`) are offsets, measured from a point already counted.
  return [...element.d.matchAll(/[MLQ]([^MLQZa-z]+)/g)].flatMap((m) => m[1].trim().split(/[ ,]+/).map(Number));
}

test('T-233: every design stays inside the stamp canvas', () => {
  for (const style of STYLES) {
    for (const element of founderElements(WORDS, style)) {
      for (const value of coordinates(element)) {
        assert.ok(Number.isFinite(value), `${style}: ${element.kind} has a non-number`);
        assert.ok(value >= 0 && value <= CANVAS, `${style}: ${element.kind} reaches ${value}`);
      }
    }
  }
});

test('T-233: the title is drawn in capitals, with the destination and the year under it', () => {
  for (const style of STYLES) {
    const words = founderElements(WORDS, style).flatMap((e) => (e.kind === 'text' ? [e.text] : []));
    assert.deepEqual(words, ['FUNDADOR', 'MADEIRA · 2026'], style);
  }
});

test('T-233: no year yet, no destination: the line under the title says only what is known', () => {
  const texts = (words: typeof WORDS | { title: string; destination: string | null; year: number | null }) =>
    founderElements(words).flatMap((e) => (e.kind === 'text' ? [e.text] : []));
  assert.deepEqual(texts({ title: 'Founder', destination: 'Madeira', year: null }), ['FOUNDER', 'MADEIRA']);
  assert.deepEqual(texts({ title: 'Founder', destination: null, year: null }), ['FOUNDER']);
});

test('T-233: a long word is condensed to fit, a short one is drawn as it is', () => {
  const long = founderElements({ title: 'Gründungsmitglied', destination: null, year: null });
  const title = long.find((e) => e.kind === 'text');
  assert.ok(title?.kind === 'text' && title.textLength !== null);
  const short = founderElements(WORDS).find((e) => e.kind === 'text');
  assert.ok(short?.kind === 'text' && short.textLength === null);
});

test('T-233: the app draws one of the three', () => {
  assert.ok(STYLES.includes(FOUNDER_STYLE));
});

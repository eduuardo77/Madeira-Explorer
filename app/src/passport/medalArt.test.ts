/**
 * The founder stamp's and the set medals' drawings stay on their canvas and say
 * what they should (T-233, T-235).
 *
 *     cd app && npm test
 *
 * Geometry is checked here; whether it looks right is judged by eye on
 * `tools/out/founder.html` (`tools/preview-founder.mjs`, OQ-9), because a mark that passed every
 * geometry test once rendered as a crosshair (CLAUDE.md).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { fitOutline, founderElements, setMedalElements, type FounderWords, type SetMedalWords } from './medalArt.ts';
import { CANVAS } from './stampArt.ts';
import { parseRegionPack } from '../content/regionPack.ts';

const WORDS: FounderWords = { title: 'Fundador', destination: 'Madeira', year: 2026 };

/** Every coordinate a path or polygon names. */
function coordinates(element: ReturnType<typeof founderElements>[number]): number[] {
  if (element.kind === 'polygon') return element.points.split(/[ ,]/).map(Number);
  if (element.kind === 'rect') return [element.x, element.y, element.x + element.width, element.y + element.height];
  if (element.kind === 'text') return [element.x, element.y];
  // A category emblem is drawn on the stamps' own grid and moved into place by
  // its transform; `categoryLayers` fits it by its box, so its raw numbers say nothing.
  if (element.transform !== undefined) return [];
  // Absolute commands only: relative arcs (`a`) are offsets, measured from a point already counted.
  return [...element.d.matchAll(/[MLQA]([^A-Za-z]+)/g)].flatMap((m) => m[1].trim().split(/[ ,]+/).map(Number));
}

test('T-233: the founder stamp stays inside the stamp canvas', () => {
  for (const element of founderElements(WORDS)) {
    for (const value of coordinates(element)) {
      assert.ok(Number.isFinite(value), `${element.kind} has a non-number`);
      assert.ok(value >= 0 && value <= CANVAS, `${element.kind} reaches ${value}`);
    }
  }
});

test('T-233: the title is drawn in capitals, with the destination and the year under it', () => {
  const words = founderElements(WORDS).flatMap((e) => (e.kind === 'text' ? [e.text] : []));
  assert.deepEqual(words, ['FUNDADOR', 'MADEIRA · 2026']);
});

test('T-233: no year yet, no destination: the line under the title says only what is known', () => {
  const texts = (words: FounderWords) =>
    founderElements(words).flatMap((e) => (e.kind === 'text' ? [e.text] : []));
  assert.deepEqual(texts({ title: 'Founder', destination: 'Madeira', year: null }), ['FOUNDER', 'MADEIRA']);
  assert.deepEqual(texts({ title: 'Founder', destination: null, year: null }), ['FOUNDER']);
});

test('T-233: a longer word is set smaller to fit, a short one at full size', () => {
  const first = (words: FounderWords) => founderElements(words).find((e) => e.kind === 'text');
  const short = first(WORDS);
  const long = first({ title: 'Gründungsmitglied', destination: null, year: null });
  assert.ok(short?.kind === 'text' && long?.kind === 'text');
  assert.equal(short.fontSize, 10);
  assert.ok(long.fontSize < short.fontSize, `${long.fontSize}`);
});

test('⚠ T-235 (the P30): a long set name gets smaller type, not just a squeeze Android may ignore', () => {
  const band = (name: string) => setMedalElements(setMedal({ name })).find((e) => e.kind === 'text');
  const short = band('Funchal');
  const long = band('Câmara de Lobos');
  assert.ok(short?.kind === 'text' && long?.kind === 'text');
  assert.equal(short.fontSize, 8.5);
  assert.ok(long.fontSize < 7, `${long.fontSize}`);
  assert.equal(long.textLength, null, 'it fits at that size without condensing');
});

const REGIONS = parseRegionPack(
  JSON.parse(readFileSync(new URL('../../../content/regions.json', import.meta.url), 'utf8'))
).regions;

function setMedal(overrides: Partial<SetMedalWords> = {}): SetMedalWords {
  return { emblem: { kind: 'category', category: 'levada' }, name: 'Levadas', collected: 7, total: 18, look: 'silver', ...overrides };
}

test('T-235: every municipality medal and the levadas medal stay inside the canvas, in both looks', () => {
  const emblems: SetMedalWords['emblem'][] = [
    ...REGIONS.map((region) => ({ kind: 'outline' as const, points: region.outline ?? [] })),
    { kind: 'category', category: 'levada' },
  ];
  for (const emblem of emblems) {
    for (const look of ['silver', 'gold'] as const) {
      for (const element of setMedalElements(setMedal({ emblem, look }))) {
        for (const value of coordinates(element)) {
          assert.ok(Number.isFinite(value) && value >= 0 && value <= CANVAS, `${element.kind} reaches ${value}`);
        }
      }
    }
  }
});

test('T-235: a municipality outline fits its box, thinned to a drawable number of points', () => {
  for (const region of REGIONS) {
    const fitted = fitOutline(region.outline ?? []);
    assert.ok(fitted.length >= 3 && fitted.length <= 160, `${region.id}: ${fitted.length} points`);
    for (const [x, y] of fitted) assert.ok(x >= 30.9 && x <= 69.1 && y >= 20.9 && y <= 53.1, `${region.id}: ${x},${y}`);
  }
});

test('T-235: the gold arc shows how far a set has got, and only while it is under way', () => {
  const arcs = (words: SetMedalWords) =>
    setMedalElements(words).filter((e) => e.kind === 'path' && e.d.includes(' A')).length;
  assert.equal(arcs(setMedal()), 1);
  assert.equal(arcs(setMedal({ collected: 0 })), 0, 'nothing collected, no arc');
  assert.equal(arcs(setMedal({ look: 'gold', collected: 18 })), 0, 'complete: the whole medal is gold');
});

test('T-235: the band carries the set name in capitals; a missing outline costs only the picture', () => {
  const texts = setMedalElements(setMedal({ name: 'Câmara de Lobos', emblem: { kind: 'outline', points: [] } }))
    .flatMap((e) => (e.kind === 'text' ? [e.text] : []));
  assert.deepEqual(texts, ['CÂMARA DE LOBOS']);
});

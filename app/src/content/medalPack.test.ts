/**
 * Reading the medal sets out of content (T-234).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MEDAL_MINIMUM, medalContentProblems, parseMedalPack, type MedalDefinition, type MedalPlace } from './medalPack.ts';
import { parseContentPack } from './contentPack.ts';

test('T-234: the shipped medals.json parses cleanly', () => {
  const raw = JSON.parse(readFileSync(new URL('../../../content/medals.json', import.meta.url), 'utf8'));
  const { medals, problems } = parseMedalPack(raw);
  assert.deepEqual(problems, []);
  assert.ok(medals.length > 0);
});

test('T-234: a region rule and a category rule are both read', () => {
  const { medals, problems } = parseMedalPack({
    formatVersion: 1,
    medals: [
      { id: 'region-santana', rule: { region: 'santana' } },
      { id: 'category-levada', rule: { category: 'levada' } },
    ],
  });
  assert.deepEqual(problems, []);
  assert.deepEqual(medals, [
    { id: 'region-santana', rule: { region: 'santana' } },
    { id: 'category-levada', rule: { category: 'levada' } },
  ]);
});

test('T-234: a malformed file yields no medals and says why, never throws', () => {
  for (const raw of [null, 'medals', {}, { formatVersion: 2, medals: [] }, { formatVersion: 1 }]) {
    const { medals, problems } = parseMedalPack(raw);
    assert.deepEqual(medals, [], JSON.stringify(raw));
    assert.equal(problems.length, 1, JSON.stringify(raw));
  }
});

test('T-234: a bad entry is dropped and reported, and the good ones kept', () => {
  const { medals, problems } = parseMedalPack({
    formatVersion: 1,
    medals: [
      { id: 'region-santana', rule: { region: 'santana' } },
      { id: '', rule: { region: 'funchal' } },
      { id: 'region-santana', rule: { region: 'funchal' } },
      { id: 'category-castle', rule: { category: 'castle' } },
      { id: 'both', rule: { region: 'funchal', category: 'levada' } },
      { id: 'none', rule: {} },
    ],
  });
  assert.deepEqual(medals.map((medal) => medal.id), ['region-santana']);
  assert.equal(problems.length, 5);
});

const PLACES: MedalPlace[] = [
  { id: 'pico-ruivo', category: 'viewpoint', regionId: 'santana' },
  { id: 'caldeirao-verde', category: 'levada', regionId: 'santana' },
  { id: 'santana-houses', category: 'village', regionId: 'santana' },
  { id: 'rabacal', category: 'levada', regionId: 'calheta' },
];
const SANTANA: MedalDefinition = { id: 'region-santana', rule: { region: 'santana' } };
const LEVADAS: MedalDefinition = { id: 'category-levada', rule: { category: 'levada' } };

test('T-234 (OQ-3): the content check catches an unknown region and a set too small', () => {
  const regions = new Set(['santana', 'calheta']);
  assert.deepEqual(medalContentProblems([SANTANA], PLACES, regions), []);
  const [unknown] = medalContentProblems([{ id: 'region-nowhere', rule: { region: 'nowhere' } }], PLACES, regions);
  assert.match(unknown, /no region "nowhere"/);
  const [small] = medalContentProblems([LEVADAS], PLACES, regions);
  assert.match(small, new RegExp(`2 place\\(s\\), a set needs at least ${MEDAL_MINIMUM}`));
});

test('T-234: every shipped medal is sound against the shipped pack and regions', () => {
  const pack = parseContentPack(JSON.parse(readFileSync(new URL('../../../content/pois.json', import.meta.url), 'utf8'))).pack;
  const medals = parseMedalPack(JSON.parse(readFileSync(new URL('../../../content/medals.json', import.meta.url), 'utf8'))).medals;
  const regions = JSON.parse(readFileSync(new URL('../../../content/regions.json', import.meta.url), 'utf8'));
  const ids = new Set<string>(regions.features.map((feature: { properties: { id: string } }) => feature.properties.id));
  assert.deepEqual(medalContentProblems(medals, pack.places, ids), []);
});

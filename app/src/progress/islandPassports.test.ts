/** Islands with their own passport (D-109). */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseContentPack } from '../content/contentPack.ts';
import { parseMedalPack } from '../content/medalPack.ts';
import { parseRegionPack } from '../content/regionPack.ts';
import { computeTripProgress } from './tripProgress.ts';
import { medalProgress } from './medals.ts';
import { inPassport, islandByPlace, islandByRegion, islandMedalIds, placesIn } from './islandPassports.ts';

const regions = [
  { id: 'west', islandId: 'big' },
  { id: 'east', islandId: 'big' },
  { id: 'small', islandId: 'small' },
  { id: 'unknown', islandId: null },
];
const places = [
  { id: 'a', regionId: 'west', category: 'beach' as const },
  { id: 'b', regionId: 'east', category: 'viewpoint' as const },
  { id: 'c', regionId: 'small', category: 'beach' as const },
  { id: 'd', regionId: 'unknown', category: 'beach' as const },
];

test('no island passports: every place is in the main one', () => {
  const byRegion = islandByRegion(regions, []);
  assert.equal(byRegion.size, 0);
  assert.deepEqual(placesIn(places, byRegion, null).map((p) => p.id), ['a', 'b', 'c', 'd']);
});

test('an island passport takes its places out of the main one, and only those', () => {
  const byRegion = islandByRegion(regions, ['small']);
  assert.deepEqual(placesIn(places, byRegion, null).map((p) => p.id), ['a', 'b', 'd']);
  assert.deepEqual(placesIn(places, byRegion, 'small').map((p) => p.id), ['c']);
  const byPlace = islandByPlace(places, byRegion);
  assert.deepEqual([...byPlace], [['c', 'small']]);
  assert.ok(inPassport('c', byPlace, 'small'));
  assert.ok(inPassport('d', byPlace, null), 'a place on an unknown island stays in the main passport');
});

test('only the island’s own region medal belongs to its passport', () => {
  const byRegion = islandByRegion(regions, ['small']);
  const medals = [
    { id: 'region-small', rule: { region: 'small' } },
    { id: 'region-west', rule: { region: 'west' } },
    { id: 'category-beach', rule: { category: 'beach' } },
  ];
  assert.deepEqual([...islandMedalIds(medals, byRegion, 'small')], ['region-small']);
});

test('the shipped content: Porto Santo has its own passport, Madeira’s count and medals leave it out', () => {
  const read = (file: string) =>
    JSON.parse(readFileSync(new URL(`../../../content/${file}`, import.meta.url), 'utf8'));
  const pack = parseContentPack(read('pois.json')).pack;
  const shipped = parseRegionPack(read('regions.json')).regions;
  const medals = parseMedalPack(read('medals.json')).medals;

  assert.ok(pack.islandPassports.length > 0);
  const byRegion = islandByRegion(shipped, pack.islandPassports);
  assert.ok(byRegion.size > 0, 'the island has regions');
  const main = placesIn(pack.places, byRegion, null);
  const island = placesIn(pack.places, byRegion, pack.islandPassports[0]);
  assert.equal(main.length + island.length, pack.places.length);

  // The main count is the main island's places, whatever the island holds.
  const progress = computeTripProgress({ ...pack, places: main }, new Set(), new Set());
  assert.equal(progress.total, main.length);
  // No main medal includes an island place.
  const islandIds = new Set(island.map((p) => p.id));
  for (const medal of medalProgress(medals, main, [], false)) {
    assert.ok(medal.placeIds.every((id) => !islandIds.has(id)), medal.id);
  }
});

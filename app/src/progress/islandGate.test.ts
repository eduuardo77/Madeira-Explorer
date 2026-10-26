/**
 * The hidden island's gate (T-067a, D-024, D-107). Synthetic squares for the
 * rules, then the shipped content for the one thing a square cannot prove: that
 * the real outline holds the real departure point and not the other island's.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseContentPack } from '../content/contentPack.ts';
import { parseRegionPack } from '../content/regionPack.ts';
import {
  ARRIVAL_ACCURACY_M,
  insideRing,
  islandsReached,
  lockedRegionIds,
  parseVisited,
  pendingIslands,
  serialiseVisited,
  visiblePlaces,
  type GateRegion,
} from './islandGate.ts';

const square = (lon: number, lat: number, side: number): Array<[number, number]> => [
  [lon, lat],
  [lon + side, lat],
  [lon + side, lat + side],
  [lon, lat + side],
  [lon, lat],
];

const regions: GateRegion[] = [
  { id: 'big-west', islandId: 'big', islandName: 'Big', outline: square(0, 0, 1) },
  { id: 'big-east', islandId: 'big', islandName: 'Big', outline: square(1, 0, 1) },
  { id: 'small', islandId: 'small', islandName: 'Small', outline: square(5, 5, 0.2) },
  { id: 'nowhere', islandId: null, islandName: null, outline: null },
];

const onSmall = { lat: 5.1, lon: 5.1, accuracyM: 20 };

test('nothing hidden: nothing locked', () => {
  assert.deepEqual([...lockedRegionIds(regions, [], new Set())], []);
});

test('a hidden island not yet visited locks its regions, and only its regions', () => {
  assert.deepEqual([...lockedRegionIds(regions, ['small'], new Set())], ['small']);
});

test('once visited, it is open', () => {
  assert.deepEqual([...lockedRegionIds(regions, ['small'], new Set(['small']))], []);
  assert.deepEqual(pendingIslands(['small'], new Set(['small'])), []);
});

test('a region with no island is never locked', () => {
  assert.ok(!lockedRegionIds(regions, ['small', 'big'], new Set()).has('nowhere'));
});

test('a good fix inside the outline reaches the island', () => {
  assert.deepEqual(islandsReached([onSmall], regions, ['small']), ['small']);
});

test('a fix on the other island, or in the sea between, reaches nothing', () => {
  assert.deepEqual(islandsReached([{ lat: 0.5, lon: 0.5, accuracyM: 5 }], regions, ['small']), []);
  assert.deepEqual(islandsReached([{ lat: 4.9, lon: 5.1, accuracyM: 5 }], regions, ['small']), []);
});

test('a vague fix, or one with no accuracy, proves nothing', () => {
  assert.deepEqual(islandsReached([{ ...onSmall, accuracyM: ARRIVAL_ACCURACY_M + 1 }], regions, ['small']), []);
  assert.deepEqual(islandsReached([{ ...onSmall, accuracyM: null }], regions, ['small']), []);
  assert.deepEqual(islandsReached([{ ...onSmall, accuracyM: ARRIVAL_ACCURACY_M }], regions, ['small']), ['small']);
});

test('only pending islands are asked about', () => {
  assert.deepEqual(islandsReached([onSmall], regions, []), []);
});

test('insideRing follows a concave shape', () => {
  // An L: the notch at the top right is outside.
  const ell: Array<[number, number]> = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2], [0, 0]];
  assert.ok(insideRing(0.5, 1.5, ell));
  assert.ok(insideRing(1.5, 0.5, ell));
  assert.ok(!insideRing(1.5, 1.5, ell));
});

test('the flag round-trips, and nonsense reads as none visited', () => {
  assert.deepEqual([...parseVisited(serialiseVisited(new Set(['small', 'big'])))].sort(), ['big', 'small']);
  for (const raw of [null, '', '1', 'true', '{"a":1}', '[1, ""]']) {
    assert.equal(parseVisited(raw).size, 0, String(raw));
  }
});

test('visiblePlaces drops the locked regions only', () => {
  const places = [
    { id: 'a', regionId: 'big-west' },
    { id: 'b', regionId: 'small' },
  ];
  assert.deepEqual(visiblePlaces(places, new Set(['small'])).map((p) => p.id), ['a']);
  assert.deepEqual(visiblePlaces(places, new Set()).map((p) => p.id), ['a', 'b']);
});

test('the shipped content: the island outline holds its own airport and not the other', () => {
  const read = (file: string) =>
    JSON.parse(readFileSync(new URL(`../../../content/${file}`, import.meta.url), 'utf8'));
  const pack = parseContentPack(read('pois.json')).pack;
  const shipped = parseRegionPack(read('regions.json')).regions;

  // D-109 shows the island from day one, so the pack hides nothing; the gate is
  // checked against the island that has its own passport, the one it would hide.
  assert.deepEqual(pack.hiddenIslands, []);
  const hidden = pack.islandPassports[0];
  const locked = lockedRegionIds(shipped, [hidden], new Set());
  assert.ok(locked.size > 0, 'the hidden island has regions');
  assert.ok(locked.size < shipped.length, 'and it is not every region');

  // Each departure point is an airport: exactly one of them is on the hidden
  // island. The check moves with its input: the other airport reaches nothing.
  const reached = pack.departurePoints.map((point) =>
    islandsReached([{ lat: point.lat, lon: point.lon, accuracyM: 10 }], shipped, [hidden]).length
  );
  assert.deepEqual([...reached].sort(), [0, 1]);
});

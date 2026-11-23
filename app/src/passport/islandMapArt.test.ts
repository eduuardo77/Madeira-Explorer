/**
 * The unlock sheet's island (T-319).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { islandMap } from './islandMapArt.ts';
import { parseRegionPack } from '../content/regionPack.ts';
import { parseContentPack } from '../content/contentPack.ts';

const square = { id: 'a', outline: [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]] as Array<[number, number]> };

test('the box is as wide as asked, and as tall as the island is', () => {
  const map = islandMap([square], [], new Set(), 200);
  assert.ok(map);
  assert.equal(map.width, 200);
  // A square in degrees is taller than wide on the ground away from the
  // equator by 1 / cos(lat); at 0.05° that is 1.0000004, so it is square.
  assert.equal(map.height, 200);
});

test('a dot is gold where the user has been, and lights its municipality', () => {
  const other = { id: 'b', outline: [[0.2, 0], [0.3, 0], [0.3, 0.1]] as Array<[number, number]> };
  const map = islandMap(
    [square, other],
    [
      { id: 'here', regionId: 'a', lat: 0.05, lon: 0.05 },
      { id: 'not', regionId: 'b', lat: 0.05, lon: 0.25 },
    ],
    new Set(['here']),
    300
  );
  assert.ok(map);
  assert.deepEqual(
    map.regions.map((region) => [region.id, region.lit]),
    [['a', true], ['b', false]]
  );
  assert.deepEqual(
    map.dots.map((dot) => [dot.id, dot.visited]),
    [['here', true], ['not', false]]
  );
});

test('a place outside the outlines given is not drawn (another island)', () => {
  const map = islandMap([square], [{ id: 'far', regionId: 'elsewhere', lat: 5, lon: 5 }], new Set(), 200);
  assert.equal(map?.dots.length, 0);
});

test('nothing to draw gives null, never a broken picture', () => {
  assert.equal(islandMap([], [], new Set(), 200), null);
  assert.equal(islandMap([square], [], new Set(), 10), null);
});

test("on the shipped content, the main island's places all fall inside the frame", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const read = (name: string) => JSON.parse(readFileSync(path.join(here, '..', '..', '..', 'content', name), 'utf8'));
  const regions = parseRegionPack(read('regions.json')).regions;
  const pack = parseContentPack(read('pois.json')).pack;
  const islandOf = new Map(regions.map((region) => [region.id, region.islandId]));
  const main = regions.filter((region) => region.outline !== null && !pack.islandPassports.includes(region.islandId ?? ''));
  const map = islandMap(
    main.map((region) => ({ id: region.id, outline: region.outline ?? [] })),
    pack.places.map((place) => ({ id: place.id, regionId: place.regionId, lat: place.geofences[0].lat, lon: place.geofences[0].lon })),
    new Set(),
    330
  );
  assert.ok(map);
  const mainPlaces = pack.places.filter((place) => !pack.islandPassports.includes(islandOf.get(place.regionId) ?? ''));
  assert.equal(map.dots.length, mainPlaces.length);
  for (const dot of map.dots) {
    assert.ok(dot.x >= 0 && dot.x <= map.width && dot.y >= 0 && dot.y <= map.height, dot.id);
  }
  // An island wider than tall, not a corner of a box (the first sketch).
  assert.ok(map.height < map.width * 0.6 && map.height > map.width * 0.25, String(map.height));
});

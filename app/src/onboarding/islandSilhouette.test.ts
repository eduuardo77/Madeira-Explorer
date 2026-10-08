import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseRegionPack, type Region } from '../content/regionPack.ts';
import { silhouettePaths } from './islandSilhouette.ts';

const square = (lon: number, lat: number, side: number): Array<[number, number]> => [
  [lon, lat],
  [lon + side, lat],
  [lon + side, lat + side],
  [lon, lat + side],
];
const region = (id: string, islandId: string | null, outline: Array<[number, number]> | null): Region => ({
  id,
  name: id,
  islandId,
  outline,
});

/** Every coordinate in the paths, as numbers. */
const coordinates = (paths: string[]) => paths.join(' ').match(/-?\d+(\.\d+)?/g)!.map(Number);

test('the island with the most regions is drawn, one path each, and the islet is left out', () => {
  const paths = silhouettePaths(
    [
      region('a', 'big', square(0, 0, 0.1)),
      region('b', 'big', square(0.1, 0, 0.1)),
      region('islet', 'small', square(1, 1, 0.05)),
      region('no-shape', 'big', null),
    ],
    200,
    100
  );
  assert.equal(paths.length, 2);
  // Had the islet counted, the two squares would be squeezed into a corner.
  const xs = coordinates(paths).filter((_, i) => i % 2 === 0);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 150);
});

test('the shape keeps its proportions and stays inside the box, centred', () => {
  const paths = silhouettePaths([region('a', 'i', square(0, 0, 0.1)), region('b', 'i', square(0.1, 0, 0.1))], 300, 300);
  const values = coordinates(paths);
  const xs = values.filter((_, i) => i % 2 === 0);
  const ys = values.filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= 300 && Math.min(...ys) >= 0 && Math.max(...ys) <= 300);
  // Two squares side by side, a little narrower east to west for the latitude
  // cosine (1 at the equator): about twice as wide as tall.
  const ratio = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
  assert.ok(Math.abs(ratio - 2) < 0.01, `ratio ${ratio}`);
  assert.ok(Math.abs(Math.min(...ys) + Math.max(...ys) - 300) < 0.5, 'centred vertically');
});

test('no outline at all draws nothing rather than failing', () => {
  assert.deepEqual(silhouettePaths([region('a', 'i', null)], 200, 100), []);
  assert.deepEqual(silhouettePaths([], 200, 100), []);
});

test('the shipped regions make a wide shape of several municipalities', () => {
  const raw = JSON.parse(readFileSync(new URL('../../../content/regions.json', import.meta.url), 'utf8'));
  const paths = silhouettePaths(parseRegionPack(raw).regions, 220, 80);
  assert.ok(paths.length >= 2);
  const values = coordinates(paths);
  const width = Math.max(...values.filter((_, i) => i % 2 === 0)) - Math.min(...values.filter((_, i) => i % 2 === 0));
  const height = Math.max(...values.filter((_, i) => i % 2 === 1)) - Math.min(...values.filter((_, i) => i % 2 === 1));
  // Fitted, so one side fills the box; and wider than tall.
  assert.ok(width > 217 || height > 77, `${width} by ${height}`);
  assert.ok(width > height * 2, `${width} by ${height}`);
});

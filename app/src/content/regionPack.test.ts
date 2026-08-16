/**
 * Tests for region parsing (T-067).
 *
 *     cd app && npm test
 *
 * `content/regions.json` is machine-written — `tools/build-regions.mjs` fetches
 * OSM and simplifies it — so the interesting failures are not typos. They are
 * the file being **absent or stale**: built for an older content pack, or never
 * built at all on a checkout that has only ever run the tests. What is pinned
 * down here is that every one of those costs a *word on a card* and nothing
 * else. This parser never throws, and that is the whole contract.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { indexRegions, parseRegionPack } from './regionPack.ts';

/** One feature, in the shape `build-regions.mjs` writes. */
function feature(properties: Record<string, unknown> = {}): unknown {
  return {
    type: 'Feature',
    properties: {
      id: 'machico',
      name: 'Machico',
      islandId: 'ilha-da-madeira',
      ...properties,
    },
    // Geometry is deliberately not parsed, so it is deliberately nonsense here:
    // if a future change starts reading it, this test says so immediately.
    geometry: { type: 'Polygon', coordinates: 'not coordinates' },
  };
}

function collection(features: unknown[]): unknown {
  return { type: 'FeatureCollection', features };
}

test('a region becomes an id, a name and an island', () => {
  const { regions, problems } = parseRegionPack(collection([feature()]));
  assert.deepEqual(problems, []);
  assert.deepEqual(regions, [
    { id: 'machico', name: 'Machico', islandId: 'ilha-da-madeira' },
  ]);
});

test('a missing, empty or malformed file is survivable, never thrown', () => {
  for (const raw of [
    undefined,
    null,
    {},
    { features: 'nope' },
    'a string',
    42,
  ]) {
    const parsed = parseRegionPack(raw);
    assert.deepEqual(parsed.regions, []);
    assert.equal(parsed.problems.length, 1);
  }
});

test('an empty collection is not a problem — it is a pack with no regions', () => {
  const { regions, problems } = parseRegionPack(collection([]));
  assert.deepEqual(regions, []);
  assert.deepEqual(problems, []);
});

test('one bad feature costs one region, not the file', () => {
  const { regions, problems } = parseRegionPack(
    collection([
      feature({ id: undefined }),
      feature({ id: 'funchal', name: 'Funchal' }),
      feature({ name: '' }),
      null,
    ])
  );

  assert.deepEqual(
    regions.map((region) => region.id),
    ['funchal']
  );
  assert.equal(problems.length, 3);
});

test('a duplicate id is dropped rather than allowed to win by parse order', () => {
  const { regions, problems } = parseRegionPack(
    collection([feature(), feature({ name: 'Machico (old)' })])
  );

  assert.deepEqual(
    regions.map((region) => region.name),
    ['Machico']
  );
  assert.equal(problems.length, 1);
});

test('an island the file does not name is null, never a guess', () => {
  // Null means "not lockable" to D-024's gate (T-067a). A region defaulted to
  // some island would be a region that could be hidden by accident.
  for (const islandId of [undefined, null, '', 7]) {
    const { regions } = parseRegionPack(collection([feature({ islandId })]));
    assert.equal(regions[0]?.islandId, null);
  }
});

test('the index is by id, which is what every lookup has', () => {
  const { regions } = parseRegionPack(
    collection([feature(), feature({ id: 'funchal', name: 'Funchal' })])
  );
  const index = indexRegions(regions);

  assert.equal(index.get('funchal')?.name, 'Funchal');
  assert.equal(index.get('nowhere'), undefined);
  assert.equal(index.size, 2);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupLabel, groupTags } from './tagGroups.ts';

test('tags that would overlap become one group, in time order; distant ones stay apart', () => {
  const groups = groupTags([
    { id: 'c', x: 110, y: 205, ts: 3 },
    { id: 'a', x: 100, y: 200, ts: 1 },
    { id: 'b', x: 400, y: 600, ts: 2 },
  ]);
  assert.deepEqual(groups.map((group) => group.items.map((item) => item.id)), [['a', 'c'], ['b']]);
  assert.deepEqual([groups[0].x, groups[0].y], [100, 200], 'the group sits at its first tag');
});

test('a group shows two times, then a count', () => {
  assert.equal(groupLabel(['14:28']), '14:28');
  assert.equal(groupLabel(['14:28', '14:54']), '14:28 · 14:54');
  assert.equal(groupLabel(['14:28', '14:54', '15:48', '16:46', '17:12']), '14:28 · 14:54 +3');
});

test('a two-time tag that would cover its neighbour takes it in too (P30, 17 Oct)', () => {
  // 14:28 and 14:35 group; 16:46 sits 70 dp to the left, clear of a lone tag
  // but under the wider pair.
  const groups = groupTags([
    { id: 'a', x: 200, y: 300, ts: 1 },
    { id: 'b', x: 205, y: 302, ts: 2 },
    { id: 'c', x: 130, y: 298, ts: 3 },
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].items.map((item) => item.id), ['a', 'b', 'c']);
});

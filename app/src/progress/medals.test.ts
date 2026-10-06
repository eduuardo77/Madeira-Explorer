/**
 * The set medals' progress (T-234).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { medalProgress, medalsCompletedBy } from './medals.ts';
import { parseMedalPack, type MedalDefinition, type MedalPlace } from '../content/medalPack.ts';
import { parseContentPack } from '../content/contentPack.ts';
import { computeTripProgress } from './tripProgress.ts';

const SANTANA: MedalDefinition = { id: 'region-santana', rule: { region: 'santana' }, title: {} };
const LEVADAS: MedalDefinition = { id: 'category-levada', rule: { category: 'levada' }, title: {} };

const PLACES: MedalPlace[] = [
  { id: 'pico-ruivo', category: 'viewpoint', regionId: 'santana' },
  { id: 'caldeirao-verde', category: 'levada', regionId: 'santana' },
  { id: 'santana-houses', category: 'village', regionId: 'santana' },
  { id: 'rabacal', category: 'levada', regionId: 'calheta' },
  { id: 'porto-santo-beach', category: 'beach', regionId: 'porto-santo' },
];

const award = (place_id: string, awarded_ts: number) => ({ place_id, awarded_ts });

test('T-234: progress counts the set\'s places collected, in content order', () => {
  const [santana, levadas] = medalProgress([SANTANA, LEVADAS], PLACES, [award('pico-ruivo', 10), award('rabacal', 20)], true);
  assert.deepEqual(santana.placeIds, ['pico-ruivo', 'caldeirao-verde', 'santana-houses']);
  assert.equal(santana.collected, 1);
  assert.equal(santana.total, 3);
  assert.equal(santana.state, 'progress');
  assert.equal(santana.completedTs, null);
  assert.deepEqual([levadas.collected, levadas.total], [1, 2]);
});

test('T-234: a set completes at the award time of the stamp that finished it', () => {
  const awards = [award('pico-ruivo', 10), award('santana-houses', 40), award('caldeirao-verde', 25)];
  const [santana] = medalProgress([SANTANA], PLACES, awards, true);
  assert.equal(santana.state, 'complete');
  assert.equal(santana.completedTs, 40);
});

test('T-234: a place earned twice counts once, from its first award', () => {
  const awards = [award('pico-ruivo', 10), award('pico-ruivo', 5), award('santana-houses', 40), award('caldeirao-verde', 25)];
  const [santana] = medalProgress([SANTANA], PLACES, awards, true);
  assert.equal(santana.collected, 3);
  assert.equal(santana.completedTs, 40);
});

test('T-234 (D-089): a complete medal on a passport not yet unlocked is locked, and its progress still shows', () => {
  const awards = [award('pico-ruivo', 10), award('santana-houses', 40), award('caldeirao-verde', 25)];
  const [santana] = medalProgress([SANTANA], PLACES, awards, false);
  assert.equal(santana.state, 'locked');
  assert.equal(santana.collected, 3);
  const [partial] = medalProgress([SANTANA], PLACES, [award('pico-ruivo', 10)], false);
  assert.equal(partial.state, 'progress', 'a free user sees progress like anybody');
});

test('T-234: an award for a place no longer in the pack counts for nothing', () => {
  const [santana] = medalProgress([SANTANA], PLACES, [award('a-removed-place', 10)], true);
  assert.equal(santana.collected, 0);
});

test('T-234 (D-024): a locked region leaves a medal out only when the set is all in it', () => {
  const portoSanto: MedalDefinition = { id: 'region-porto-santo', rule: { region: 'porto-santo' }, title: {} };
  const beaches: MedalDefinition = { id: 'category-beach', rule: { category: 'beach' }, title: {} };
  const locked = new Set(['porto-santo']);
  const shown = medalProgress([SANTANA, portoSanto, beaches], PLACES, [], true, locked);
  assert.deepEqual(shown.map((medal) => medal.id), ['region-santana']);
  const open = medalProgress([portoSanto], PLACES, [], true, new Set());
  assert.equal(open[0].total, 1, 'once Porto Santo unlocks, its set is there');
});

test('⚠ T-234 (OQ-2): completing a medal does not move the passport\'s count', () => {
  const pack = parseContentPack(JSON.parse(readFileSync(new URL('../../../content/pois.json', import.meta.url), 'utf8'))).pack;
  const medals = parseMedalPack(JSON.parse(readFileSync(new URL('../../../content/medals.json', import.meta.url), 'utf8'))).medals;
  const levadas = pack.places.filter((place) => place.category === 'levada').map((place) => place.id);
  const before = computeTripProgress(pack, new Set(levadas.slice(1)));
  const after = computeTripProgress(pack, new Set(levadas));
  const done = medalProgress(medals, pack.places, levadas.map((id) => award(id, 1)), true);
  assert.equal(done.find((medal) => medal.id === 'category-levada')?.state, 'complete');
  assert.equal(after.collected, before.collected + 1, 'one more place, not one more place and a medal');
  assert.equal(after.total, before.total);
});

test('T-235: a medal is announced on the stamp that completed it, and on no other', () => {
  const awards = [award('pico-ruivo', 10), award('caldeirao-verde', 25), award('santana-houses', 40), award('rabacal', 50)];
  const progress = medalProgress([SANTANA, LEVADAS], PLACES, awards, true);
  assert.deepEqual(medalsCompletedBy('santana-houses', progress, awards).map((m) => m.id), ['region-santana']);
  assert.deepEqual(medalsCompletedBy('pico-ruivo', progress, awards), [], 'an earlier stamp of the set');
  assert.deepEqual(
    medalsCompletedBy('rabacal', progress, awards).map((m) => m.id),
    ['category-levada'],
    'the last levada completes the levadas, not Santana'
  );
});

test('T-235: one stamp can complete two sets at once, and a locked medal is still announced', () => {
  const both = [award('pico-ruivo', 10), award('rabacal', 20), award('santana-houses', 30), award('caldeirao-verde', 40)];
  const progress = medalProgress([SANTANA, LEVADAS], PLACES, both, false);
  const done = medalsCompletedBy('caldeirao-verde', progress, both);
  assert.deepEqual(done.map((m) => [m.id, m.state]), [['region-santana', 'locked'], ['category-levada', 'locked']]);
  assert.deepEqual(medalsCompletedBy('a-place-never-earned', progress, both), []);
});

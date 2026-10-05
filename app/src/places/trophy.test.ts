/**
 * What a collected stamp's trophy says (T-251, T1 layout A).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Category } from '../content/contentPack.ts';
import { MEDAL_MINIMUM, trophyFacts, type TrophyPlace } from './trophy.ts';

function place(id: string, regionId: string, lat: number, lon: number, category: Category = 'village'): TrophyPlace {
  return { id, name: id.toUpperCase(), category, regionId, geofences: [{ lat, lon }] };
}

// Câmara de Lobos's four, as in content/, and two elsewhere.
const PLACES = [
  place('camara-de-lobos', 'cl', 32.6487, -16.9776),
  place('cabo-girao', 'cl', 32.6563, -17.0045, 'landmark'),
  place('curral-das-freiras', 'cl', 32.7203, -16.9696),
  place('eira-do-serrado', 'cl', 32.7133, -16.9638, 'viewpoint'),
  place('praia-formosa', 'funchal', 32.6418, -16.9436, 'beach'),
  place('ponta-do-sol', 'ps', 32.6797, -17.1027),
];

test('the stamp\'s place in the trip, in the order they were earned', () => {
  const facts = trophyFacts('camara-de-lobos', PLACES, ['praia-formosa', 'camara-de-lobos']);
  assert.equal(facts.orderInTrip, 2);
});

test('the municipality\'s medal set: its places, which are collected, how many', () => {
  const facts = trophyFacts('camara-de-lobos', PLACES, ['praia-formosa', 'camara-de-lobos']);
  assert.deepEqual(facts.medal, {
    regionId: 'cl',
    placeIds: ['camara-de-lobos', 'cabo-girao', 'curral-das-freiras', 'eira-do-serrado'],
    collected: 1,
    total: 4,
  });
});

test(`⚠ OQ-3: no medal for a municipality with fewer than ${MEDAL_MINIMUM} places`, () => {
  // Ponta do Sol's single place would be a medal for one stop.
  assert.equal(trophyFacts('ponta-do-sol', PLACES, ['ponta-do-sol']).medal, null);
});

test('the next stamp is the nearest place not yet collected, and says if it counts for the medal', () => {
  const facts = trophyFacts('camara-de-lobos', PLACES, ['praia-formosa', 'camara-de-lobos']);
  assert.equal(facts.next?.placeId, 'cabo-girao');
  assert.equal(facts.next?.countsForMedal, true);
  assert.ok(facts.next !== null && facts.next.distanceM > 2500 && facts.next.distanceM < 3000, `${facts.next?.distanceM}`);
});

test('a next place in another municipality does not claim the medal', () => {
  const facts = trophyFacts('praia-formosa', PLACES, ['praia-formosa', 'camara-de-lobos']);
  assert.equal(facts.next?.countsForMedal, false);
});

test('with everything collected there is no next stamp', () => {
  const all = PLACES.map((each) => each.id);
  assert.equal(trophyFacts('camara-de-lobos', PLACES, all).next, null);
});

test('a stamp not in the trip has no order', () => {
  assert.equal(trophyFacts('camara-de-lobos', PLACES, ['praia-formosa']).orderInTrip, null);
});

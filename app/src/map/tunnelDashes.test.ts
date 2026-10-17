import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runPolylines, type LatLng } from './tunnelDashes.ts';

const line: LatLng[] = [
  { latitude: 32.65, longitude: -16.92 },
  { latitude: 32.65, longitude: -16.9186 },
  { latitude: 32.651, longitude: -16.9186 },
];

test('a tunnel is one plain line, like a road (the lead, 17 Oct 2026)', () => {
  const tunnel = runPolylines('a', line, true, '#00f', 4);
  assert.equal(tunnel.length, 1);
  assert.equal(tunnel[0].dashed, undefined);
  assert.deepEqual(tunnel[0].coordinates, line, 'every point kept, so it follows the road');
  assert.deepEqual(runPolylines('a', line, false, '#00f', 4), tunnel);
});

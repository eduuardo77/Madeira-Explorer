import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeMapSnapshot, encodeMapSnapshot } from './mapSnapshot.ts';
import type { MapSnapshot } from './mapSnapshot.ts';

const snapshot: MapSnapshot = {
  tripId: 7,
  camera: { coordinates: { latitude: 10.5, longitude: -20.25 }, zoom: 12.5 },
  lines: [
    { points: [[10.123456789, -20.987654321], [10.2, -20.9]], faded: false },
    { points: [[10.3, -20.8], [10.4, -20.7]], faded: true },
  ],
};

test('T-272: a snapshot comes back as it went in, points to six decimals', () => {
  const back = decodeMapSnapshot(encodeMapSnapshot(snapshot), 7);
  assert.ok(back !== null);
  assert.deepEqual(back.camera, snapshot.camera);
  assert.equal(back.lines.length, 2);
  assert.deepEqual(back.lines[0].points[0], [10.123457, -20.987654]);
  assert.equal(back.lines[1].faded, true);
});

test('T-272: another trip’s roads are never drawn', () => {
  assert.equal(decodeMapSnapshot(encodeMapSnapshot(snapshot), 8), null);
});

test('T-272: nothing stored, or anything doubtful, reads as no snapshot', () => {
  assert.equal(decodeMapSnapshot(null, 7), null);
  assert.equal(decodeMapSnapshot('not json', 7), null);
  assert.equal(decodeMapSnapshot('null', 7), null);
  assert.equal(decodeMapSnapshot(JSON.stringify({ tripId: 7, lines: [] }), 7), null);
  assert.equal(
    decodeMapSnapshot(
      JSON.stringify({ ...snapshot, lines: [{ points: [[1, 'x']], faded: false }] }),
      7
    ),
    null
  );
  assert.equal(
    decodeMapSnapshot(
      JSON.stringify({ ...snapshot, camera: { coordinates: { latitude: 1 }, zoom: 3 } }),
      7
    ),
    null
  );
});

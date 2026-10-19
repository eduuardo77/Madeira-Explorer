import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeTrace, splitTrace, type LatLng } from './mergedTrace.ts';

const p = (latitude: number, longitude: number): LatLng => ({ latitude, longitude });

/** The pieces the merged line draws: runs of segments that are not gaps. */
function drawnPieces({ coordinates, gaps }: ReturnType<typeof mergeTrace>): LatLng[][] {
  const pieces: LatLng[][] = [];
  let current: LatLng[] = [coordinates[0]];
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    if (gaps.includes(i)) {
      pieces.push(current);
      current = [coordinates[i + 1]];
    } else {
      current.push(coordinates[i + 1]);
    }
  }
  pieces.push(current);
  return pieces;
}

test('separate pieces are one line with a gap between them, and draw exactly as before', () => {
  const a = [p(1, 1), p(1, 2), p(1, 3)];
  const b = [p(5, 5), p(5, 6)];
  const merged = mergeTrace([a, b]);
  assert.deepEqual(merged.gaps, [2]);
  assert.deepEqual(drawnPieces(merged), [a, b]);
});

test('a piece that starts where the last stopped continues it, with no gap and no repeated point', () => {
  const merged = mergeTrace([
    [p(1, 1), p(1, 2)],
    [p(1, 2), p(1, 3)],
  ]);
  assert.deepEqual(merged.gaps, []);
  assert.deepEqual(merged.coordinates, [p(1, 1), p(1, 2), p(1, 3)]);
});

test('a piece that ends where the last stopped is walked backwards', () => {
  const merged = mergeTrace([
    [p(1, 1), p(1, 2)],
    [p(1, 4), p(1, 3), p(1, 2)],
  ]);
  assert.deepEqual(merged.gaps, []);
  assert.deepEqual(merged.coordinates, [p(1, 1), p(1, 2), p(1, 3), p(1, 4)]);
});

test('single points and empty pieces are skipped; nothing in, nothing out', () => {
  assert.deepEqual(mergeTrace([]), { coordinates: [], gaps: [] });
  const merged = mergeTrace([[p(9, 9)], [], [p(1, 1), p(1, 2)], [p(8, 8)]]);
  assert.deepEqual(merged, { coordinates: [p(1, 1), p(1, 2)], gaps: [] });
});

test('every segment of every piece is drawn, and only those (many pieces)', () => {
  const lines: LatLng[][] = [];
  for (let i = 0; i < 50; i += 1) {
    // Every third piece continues the one before it.
    const start = i % 3 === 0 || lines.length === 0 ? p(i, 0) : lines[lines.length - 1].at(-1)!;
    lines.push([start, p(i, 1), p(i, 2)]);
  }
  const merged = mergeTrace(lines);
  const segments = (pieces: LatLng[][]) =>
    pieces.flatMap((piece) => piece.slice(1).map((end, k) => JSON.stringify([piece[k], end]))).sort();
  assert.deepEqual(segments(drawnPieces(merged)), segments(lines));
  assert.ok(merged.gaps.every((gap, k) => k === 0 || gap > merged.gaps[k - 1]), 'ascending');
});

test('a piece with a free end is drawn on its own; pieces meeting others are merged', () => {
  // A triangle (every end shared) and a spur off one corner that stops in the open.
  const ab = [p(0, 0), p(0, 1)];
  const bc = [p(0, 1), p(1, 1)];
  const ca = [p(1, 1), p(0, 0)];
  const spur = [p(0, 1), p(0, 2), p(0, 3)];
  const { merged, capped } = splitTrace([ab, spur, bc, ca]);
  assert.deepEqual(capped, [spur]);
  assert.deepEqual(merged.gaps, [], 'the triangle is one continuous run');
  assert.deepEqual(merged.coordinates, [p(0, 0), p(0, 1), p(1, 1), p(0, 0)]);
});

test('an end on the middle of another piece is not free: that line covers it', () => {
  const through = [p(0, 0), p(0, 1), p(0, 2)];
  const tee = [p(0, 1), p(1, 1)];
  const { capped } = splitTrace([through, tee]);
  // The through road's own ends are free; the tee's end on it is covered, its other end free.
  assert.deepEqual(capped, [through, tee]);
  const closed = splitTrace([[p(0, 0), p(0, 1)], [p(0, 1), p(1, 1)], [p(1, 1), p(0, 0)]]);
  assert.deepEqual(closed.capped, []);
});

test('nothing in, nothing out; single points dropped', () => {
  assert.deepEqual(splitTrace([[p(1, 1)], []]), { merged: { coordinates: [], gaps: [] }, capped: [] });
});

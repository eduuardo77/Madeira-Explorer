import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeTrace, packTrace, type LatLng } from './mergedTrace.ts';

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

/** A packed line's two ends: the only places its round caps are drawn. */
const ends = (line: { coordinates: LatLng[] }) => [line.coordinates[0], line.coordinates.at(-1)!];

test('packTrace: every free end is an end of a polyline, two to a polyline', () => {
  // A triangle with three spurs off its corners, and a lone segment free at both ends.
  const triangle = [
    [p(0, 0), p(0, 1)],
    [p(0, 1), p(1, 1)],
    [p(1, 1), p(0, 0)],
  ];
  const spurs = [
    [p(0, 0), p(-1, -1)],
    [p(0, 2), p(0, 1)], // its free end first: turned round when packed
    [p(1, 1), p(2, 2)],
  ];
  const lone = [p(9, 9), p(9, 8)];
  const packed = packTrace([...triangle, ...spurs, lone]);
  assert.equal(packed.length, 3, 'the lone piece, then the spurs two to a line');
  const freeEnds = [p(-1, -1), p(0, 2), p(2, 2), p(9, 9), p(9, 8)].map((point) => JSON.stringify(point));
  const lineEnds = packed.flatMap(ends).map((point) => JSON.stringify(point));
  for (const point of freeEnds) assert.ok(lineEnds.includes(point), `${point} is a polyline end`);
});

test('packTrace draws every segment of every piece, and only those', () => {
  const lines: LatLng[][] = [
    [p(0, 0), p(0, 1), p(0, 2)],
    [p(0, 2), p(1, 2)],
    [p(1, 2), p(1, 0), p(0, 0)],
    [p(0, 1), p(5, 5)],
    [p(1, 2), p(6, 6), p(7, 6)],
    [p(8, 8), p(8, 9)],
  ];
  const undirected = (pieces: LatLng[][]) =>
    pieces
      .flatMap((piece) =>
        piece.slice(1).map((end, k) => [JSON.stringify(piece[k]), JSON.stringify(end)].sort().join('|'))
      )
      .sort();
  const drawn = packTrace(lines).flatMap((line) => drawnPieces(line));
  assert.deepEqual(undirected(drawn), undirected(lines));
});

test('packTrace with no free ends is the one merged line; nothing in, nothing out', () => {
  const closed = [
    [p(0, 0), p(0, 1)],
    [p(0, 1), p(1, 1)],
    [p(1, 1), p(0, 0)],
  ];
  assert.deepEqual(packTrace(closed), [mergeTrace(closed)]);
  assert.deepEqual(packTrace([[p(1, 1)], []]), []);
});

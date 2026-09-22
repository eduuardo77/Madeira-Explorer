/**
 * `walPolicy` (T-178).
 *
 * The rows below are shaped like what SQLite 3.50 actually returned off-device
 * for `PRAGMA wal_checkpoint(PASSIVE)` then `(TRUNCATE)`: `(0, 901, 901)` then
 * `(0, 0, 0)` on a healthy WAL, `(0, -1, -1)` on a database not in WAL mode,
 * and a thrown *"database table is locked"* with one stepped statement open.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkpointDiaryLine,
  judgeCheckpoint,
  judgeCheckpointError,
  STALLED_WAL_FRAMES,
} from './walPolicy.ts';

const row = (busy: number, log: number, checkpointed: number) => ({
  busy,
  log,
  checkpointed,
});

test('a healthy WAL is truncated, and its length comes from PASSIVE', () => {
  // TRUNCATE answers 0/0 on success, so only PASSIVE can say how long it was.
  assert.deepEqual(judgeCheckpoint(row(0, 901, 901), row(0, 0, 0)), {
    kind: 'truncated',
    frames: 901,
  });
});

test('a routine truncate writes nothing to the diary', () => {
  const outcome = judgeCheckpoint(row(0, 901, 901), row(0, 0, 0));
  assert.equal(checkpointDiaryLine('trip_end', outcome), null);
  assert.equal(
    checkpointDiaryLine('open', { kind: 'truncated', frames: 0 }),
    null
  );
});

test('the P30 WAL, at 6,560 frames, is reported as a stall with its size', () => {
  const outcome = judgeCheckpoint(row(0, 6560, 6560), row(0, 0, 0));
  const line = checkpointDiaryLine('open', outcome);
  assert.ok(line !== null);
  assert.match(line, /^open: WAL was 6560 frames \(25\.8 MB\)/);
  assert.match(line, /stalled/);
});

test('the stall threshold sits between the healthy and the pinned generation', () => {
  // Measured on the P30: a healthy generation reached 1,109 frames before it
  // reset; the pinned one reached at least 6,560.
  assert.ok(STALLED_WAL_FRAMES > 1109);
  assert.ok(STALLED_WAL_FRAMES < 6560);
  assert.equal(
    checkpointDiaryLine('open', { kind: 'truncated', frames: STALLED_WAL_FRAMES - 1 }),
    null
  );
  assert.notEqual(
    checkpointDiaryLine('open', { kind: 'truncated', frames: STALLED_WAL_FRAMES }),
    null
  );
});

test('a busy TRUNCATE is reported with how far PASSIVE got', () => {
  const outcome = judgeCheckpoint(row(0, 1200, 800), row(1, 1200, 800));
  assert.deepEqual(outcome, { kind: 'busy', frames: 1200, checkpointed: 800 });
  assert.equal(
    checkpointDiaryLine('trip_end', outcome),
    'trip_end: truncate busy — 800 of 1200 frames checkpointed, file not truncated'
  );
});

test('a database not in WAL mode is loud, not silent', () => {
  const outcome = judgeCheckpoint(row(0, -1, -1), row(0, -1, -1));
  assert.deepEqual(outcome, { kind: 'not_wal' });
  assert.equal(
    checkpointDiaryLine('open', outcome),
    'open: database is not in WAL mode'
  );
});

test('a missing row is a failure, not a success', () => {
  assert.equal(judgeCheckpoint(null, row(0, 0, 0)).kind, 'failed');
  assert.equal(judgeCheckpoint(row(0, 0, 0), null).kind, 'failed');
});

test('SQLITE_LOCKED — an open statement on our own connection — is "blocked"', () => {
  // expo-sqlite wraps SQLite's text; match the text, not the wrapper.
  const error = new Error(
    "Call to function 'NativeStatement.finalizeAsync' has been rejected.\n" +
      '→ Caused by: Error code 6: database table is locked'
  );
  const outcome = judgeCheckpointError(error);
  assert.equal(outcome.kind, 'blocked');
  const line = checkpointDiaryLine('trip_end', outcome);
  assert.ok(line !== null);
  assert.match(line, /^trip_end: blocked by an open statement/);
  assert.match(line, /pinning the WAL/);
});

test('"database is locked" is SQLITE_BUSY — another connection — and is not "blocked"', () => {
  const outcome = judgeCheckpointError(new Error('database is locked'));
  assert.deepEqual(outcome, { kind: 'failed', message: 'database is locked' });
  assert.equal(
    checkpointDiaryLine('erase_all', outcome),
    'erase_all: database is locked'
  );
});

test('a non-Error rejection still produces a line', () => {
  assert.deepEqual(judgeCheckpointError('boom'), {
    kind: 'failed',
    message: 'boom',
  });
});

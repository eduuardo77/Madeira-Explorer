/**
 * The order a batch runs in, against the real serial queue (T-243).
 *
 *     cd app && npm test
 *
 * A trip that lapsed is closed from inside `recordingQueue`, and closing a trip
 * folds the WAL, which also goes through `recordingQueue`. Folded inside, the
 * queue waits for itself: that batch never finishes and every later one waits
 * behind it, silently, the way T-242 looked from the outside. These tests run the
 * steps through the queue the recorder really uses, with a fold that queues the
 * way `truncateWal` does, and fail on a stall rather than hang.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSerialQueue, type SerialQueue } from '../storage/serialQueue.ts';
import { runQueuedBatch } from './queuedBatch.ts';

const STALL_MS = 500;

/** Resolves with the promise's value, or with 'stalled' if it takes too long. */
async function within<T>(promise: Promise<T>): Promise<T | 'stalled'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stall = new Promise<'stalled'>((resolve) => {
    timer = setTimeout(() => resolve('stalled'), STALL_MS);
  });
  try {
    return await Promise.race([promise, stall]);
  } finally {
    clearTimeout(timer);
  }
}

/** A WAL fold shaped like `truncateWal`: it takes the same queue. */
function queuedFold(queue: SerialQueue, log: string[]) {
  return () => queue(async () => void log.push('fold'));
}

test('a lapsed trip is closed, the batch recorded, and the WAL folded, without a stall', async () => {
  const queue = createSerialQueue();
  const log: string[] = [];

  const outcome = await within(
    runQueuedBatch({
      queue,
      closeLapsedTrip: async () => {
        log.push('close');
        return true;
      },
      record: async () => void log.push('record'),
      foldWal: queuedFold(queue, log),
    })
  );

  assert.notEqual(outcome, 'stalled', 'the batch deadlocked on its own queue');
  assert.deepEqual(log, ['close', 'record', 'fold']);
});

test('⚠ the batch behind a lapsed one is not held up', async () => {
  const queue = createSerialQueue();
  const log: string[] = [];
  const steps = (name: string, lapsed: boolean) =>
    runQueuedBatch({
      queue,
      closeLapsedTrip: async () => lapsed,
      record: async () => void log.push(name),
      foldWal: queuedFold(queue, log),
    });

  const outcome = await within(Promise.all([steps('first', true), steps('second', false)]));

  assert.notEqual(outcome, 'stalled');
  assert.deepEqual(log, ['first', 'second', 'fold']);
});

test('nothing lapsed, nothing folded', async () => {
  const queue = createSerialQueue();
  const log: string[] = [];

  await runQueuedBatch({
    queue,
    closeLapsedTrip: async () => false,
    record: async () => void log.push('record'),
    foldWal: queuedFold(queue, log),
  });

  assert.deepEqual(log, ['record']);
});

test('⚠ the sink closes lapsed trips without folding, and only through runQueuedBatch', () => {
  // The order above is only safe if the sink uses it. Two ways back to the
  // deadlock, each of which this catches: `checkTripEnd` called from the queue
  // with its default fold, or a handler that queues its own lapse check.
  const sink = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'recordingSink.ts'),
    'utf8'
  );
  const calls = sink.match(/checkTripEnd\([^)]*\)/g) ?? [];
  assert.ok(calls.length > 0, 'the sink no longer closes lapsed trips: T-195 needs it');
  for (const call of calls) {
    assert.match(call, /foldWal:\s*false/, `${call} would fold the WAL inside recordingQueue (T-243)`);
  }
  const handlers = ['async onLocations(', 'async onGeofenceTransition('];
  for (const handler of handlers) {
    const start = sink.indexOf(handler);
    assert.ok(start >= 0, `${handler} not found in recordingSink.ts`);
    const body = sink.slice(start, sink.indexOf('\n  },\n', start));
    assert.match(body, /runQueuedBatch\(/, `${handler} must go through runQueuedBatch`);
    assert.ok(!/await queue\(/.test(body), `${handler} queues its own work again`);
  }
});

test('the probe works: folding from inside the queue does stall', async () => {
  // The shape T-243 removed, run on purpose. If this stops stalling, the
  // `within` guard above is not measuring anything.
  const queue = createSerialQueue();
  const log: string[] = [];
  const fold = queuedFold(queue, log);

  const outcome = await within(queue(async () => fold()));

  assert.equal(outcome, 'stalled');
});

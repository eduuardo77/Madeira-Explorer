/**
 * `createSerialQueue` (T-052c).
 *
 * The two tests that carry the weight are "only one task runs at a time" and
 * "a failure does not block the queue" — the first is the property both
 * recorder bugs needed, and the second is what stops one bad write from
 * silently stopping the recorder for the rest of the trip.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createSerialQueue } from './serialQueue.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Yield long enough for any already-queued microtasks to run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('only one task runs at a time', async () => {
  const queue = createSerialQueue();
  let running = 0;
  let peak = 0;

  const work = async () => {
    running += 1;
    peak = Math.max(peak, running);
    await settle();
    running -= 1;
  };

  await Promise.all([queue(work), queue(work), queue(work), queue(work)]);

  assert.equal(peak, 1, `${peak} tasks overlapped`);
});

test('tasks run in the order they were queued', async () => {
  const queue = createSerialQueue();
  const order: number[] = [];

  const work = (id: number) => async () => {
    // The later ones ask for less delay: without a queue they would finish
    // first, so this fails loudly if ordering is not preserved.
    await new Promise((resolve) => setTimeout(resolve, 12 - id * 3));
    order.push(id);
  };

  await Promise.all([queue(work(0)), queue(work(1)), queue(work(2)), queue(work(3))]);

  assert.deepEqual(order, [0, 1, 2, 3]);
});

test('a second task does not start before the first finishes', async () => {
  const queue = createSerialQueue();
  const gate = deferred<void>();
  let secondStarted = false;

  const first = queue(() => gate.promise);
  const second = queue(async () => {
    secondStarted = true;
  });

  await settle();
  assert.equal(secondStarted, false, 'the second task jumped the queue');

  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(secondStarted, true);
});

test('each caller gets its own result', async () => {
  const queue = createSerialQueue();

  const results = await Promise.all([
    queue(async () => 'a'),
    queue(async () => 'b'),
    queue(async () => 'c'),
  ]);

  assert.deepEqual(results, ['a', 'b', 'c']);
});

test('a failure reaches its own caller and nobody else', async () => {
  const queue = createSerialQueue();

  const bad = queue(async () => {
    throw new Error('insert failed');
  });
  const good = queue(async () => 'fine');

  await assert.rejects(bad, /insert failed/);
  assert.equal(await good, 'fine');
});

test('a failure does not block everything queued behind it', async () => {
  // The recorder runs for a week. One failed write must not stop the queue for
  // the rest of the trip — that would turn a lost fix into a lost holiday.
  const queue = createSerialQueue();
  const done: string[] = [];

  const attempts = [
    queue(async () => {
      throw new Error('one');
    }).catch(() => done.push('failed')),
    queue(async () => {
      done.push('second');
    }),
    queue(async () => {
      throw new Error('three');
    }).catch(() => done.push('failed again')),
    queue(async () => {
      done.push('fourth');
    }),
  ];

  await Promise.all(attempts);

  assert.deepEqual(done, ['failed', 'second', 'failed again', 'fourth']);
});

test('a task queued from inside a completed task still runs', async () => {
  // The sink logs a diary entry after each write; if that ever moved onto the
  // queue itself, this is the shape it would take.
  const queue = createSerialQueue();
  const order: string[] = [];

  await queue(async () => {
    order.push('outer');
  });
  await queue(async () => {
    order.push('later');
  });

  assert.deepEqual(order, ['outer', 'later']);
});

test('a synchronous throw is contained like any other failure', async () => {
  const queue = createSerialQueue();

  const bad = queue((): Promise<void> => {
    throw new Error('sync');
  });
  const good = queue(async () => 'still works');

  await assert.rejects(bad, /sync/);
  assert.equal(await good, 'still works');
});

test('two queues do not wait on each other', async () => {
  // Independent bursts should not be coupled just because both are serialised.
  const a = createSerialQueue();
  const b = createSerialQueue();
  const gate = deferred<void>();

  const blocked = a(() => gate.promise);
  const other = await b(async () => 'unblocked');

  assert.equal(other, 'unblocked');
  gate.resolve();
  await blocked;
});

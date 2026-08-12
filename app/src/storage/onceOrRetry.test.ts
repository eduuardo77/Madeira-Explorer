/**
 * `onceOrRetry` (T-052c).
 *
 * The behaviour that matters is the last few tests: a failed first attempt must
 * not poison every later one. That is the bug this exists to remove, and it is
 * invisible in normal use because the first attempt almost always works.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { onceOrRetry } from './onceOrRetry.ts';

/** A promise that resolves or rejects only when told to. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('the factory runs once and everyone gets the same value', async () => {
  let calls = 0;
  const get = onceOrRetry(async () => {
    calls += 1;
    return { id: calls };
  });

  const [a, b, c] = await Promise.all([get(), get(), get()]);

  assert.equal(calls, 1);
  // The same object, not merely an equal one — callers share one database.
  assert.equal(a, b);
  assert.equal(b, c);
});

test('callers arriving during the open all wait for it, and it runs once', async () => {
  // The real case: the background location task and the UI asking together.
  // Two opens would run the migrations twice.
  let calls = 0;
  const gate = deferred<string>();
  const get = onceOrRetry(() => {
    calls += 1;
    return gate.promise;
  });

  const first = get();
  const second = get();
  assert.equal(calls, 1, 'a second caller must not start a second attempt');

  gate.resolve('db');
  assert.equal(await first, 'db');
  assert.equal(await second, 'db');
  assert.equal(calls, 1);
});

test('a resolved value is kept, so later callers do not reopen', async () => {
  let calls = 0;
  const get = onceOrRetry(async () => {
    calls += 1;
    return calls;
  });

  assert.equal(await get(), 1);
  assert.equal(await get(), 1);
  assert.equal(await get(), 1);
  assert.equal(calls, 1);
});

test('a failure reaches every caller that was waiting on it', async () => {
  const gate = deferred<string>();
  const get = onceOrRetry(() => gate.promise);

  const first = get();
  const second = get();
  gate.reject(new Error('locked'));

  await assert.rejects(first, /locked/);
  await assert.rejects(second, /locked/);
});

test('THE BUG: a failure does not poison every later attempt', async () => {
  // Previously the rejected promise stayed cached and every caller for the rest
  // of the process got the same stale failure, with nothing ever retried.
  let calls = 0;
  const get = onceOrRetry(async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error('database is locked');
    }
    return 'db';
  });

  await assert.rejects(get(), /locked/);

  assert.equal(await get(), 'db', 'the second attempt should have run');
  assert.equal(calls, 2);
});

test('after recovering, it is cached again and stops reopening', async () => {
  let calls = 0;
  const get = onceOrRetry(async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error('transient');
    }
    return calls;
  });

  await assert.rejects(get());
  assert.equal(await get(), 2);
  assert.equal(await get(), 2);
  assert.equal(calls, 2, 'a success must not be retried');
});

test('repeated failures keep retrying rather than latching', async () => {
  // A phone that stays locked should keep trying on each wake, not give up.
  let calls = 0;
  const get = onceOrRetry(async () => {
    calls += 1;
    throw new Error('still locked');
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await assert.rejects(get(), /still locked/);
  }
  assert.equal(calls, 3);
});

test('a factory that throws synchronously is still retryable', async () => {
  // `openDatabaseAsync` is async, but a wrapper that validates arguments could
  // throw before returning a promise, and that must not latch either.
  let calls = 0;
  const get = onceOrRetry((): Promise<string> => {
    calls += 1;
    if (calls === 1) {
      throw new Error('bad argument');
    }
    return Promise.resolve('db');
  });

  assert.throws(() => get(), /bad argument/);
  assert.equal(await get(), 'db');
});

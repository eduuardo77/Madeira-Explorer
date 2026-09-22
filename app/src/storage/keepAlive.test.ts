/**
 * `keepAlive` (T-179).
 *
 * The garbage-collection test forces a full collection while an operation is pending and
 * checks, through a `WeakRef`, that a held object survives while an identical
 * one passed to a native call only by id is collected — the property
 * expo-sqlite's own `getFirstAsync` lacks (expo/expo#49799).
 *
 * ⚠ What it does NOT prove, found by breaking `hold` on purpose: under V8 the
 * GC test still passes with the map removed, because V8 also keeps `hold`'s
 * own `object` parameter alive in its suspended frame. Whether Hermes does the
 * same is not something to lean on, which is why the map exists — and the
 * counting tests are the ones that fail if it stops holding.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

import { createKeepAlive } from './keepAlive.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('an object is held while its operation is pending, and released after', async () => {
  const keepAlive = createKeepAlive();
  const statement = {};
  const gate = deferred<number>();

  const pending = keepAlive.hold(statement, () => gate.promise);
  assert.equal(keepAlive.heldCount(statement), 1);

  gate.resolve(7);
  assert.equal(await pending, 7);
  assert.equal(keepAlive.heldCount(statement), 0);
});

test('a rejected operation still releases the object, and the rejection reaches the caller', async () => {
  const keepAlive = createKeepAlive();
  const statement = {};
  const failure = new Error('finalize failed');

  await assert.rejects(
    keepAlive.hold(statement, async () => {
      throw failure;
    }),
    failure
  );
  assert.equal(keepAlive.heldCount(statement), 0);
});

test('overlapping holds on one object keep it held until the last finishes', async () => {
  const keepAlive = createKeepAlive();
  const statement = {};
  const first = deferred<void>();
  const second = deferred<void>();

  const a = keepAlive.hold(statement, () => first.promise);
  const b = keepAlive.hold(statement, () => second.promise);
  assert.equal(keepAlive.heldCount(statement), 2);

  first.resolve();
  await a;
  assert.equal(keepAlive.heldCount(statement), 1, 'released too early');

  second.resolve();
  await b;
  assert.equal(keepAlive.heldCount(statement), 0);
});

test('a held object survives a forced garbage collection with no other reference', async () => {
  setFlagsFromString('--expose-gc');
  const gc = runInNewContext('gc') as () => void;

  const keepAlive = createKeepAlive();

  // Stands in for an Expo AsyncFunction: the JS object crosses as an id and
  // the work happens later, so the pending call itself references nothing.
  const nativeCall = (_objectId: number, gate: Promise<void>) => gate;

  // Each object exists only inside its block. Afterwards the WeakRef — and,
  // for the held one, the keep-alive map — are the only things that know about
  // it: the position of expo-sqlite's statement once `finalizeAsync` is called.
  const heldGate = deferred<void>();
  let heldRef!: WeakRef<object>;
  const heldCall = (() => {
    const statement = { id: 1 };
    heldRef = new WeakRef(statement);
    return keepAlive.hold(statement, () => nativeCall(statement.id, heldGate.promise));
  })();

  // ⚠ The control is what makes this a measurement. Without it a pass could
  // just mean the collector never ran, or that something else held the object.
  const bareGate = deferred<void>();
  let bareRef!: WeakRef<object>;
  const bareCall = (() => {
    const statement = { id: 2 };
    bareRef = new WeakRef(statement);
    return nativeCall(statement.id, bareGate.promise);
  })();

  // WeakRef targets are kept alive until the current job ends; yield first.
  await new Promise((resolve) => setImmediate(resolve));
  gc();

  assert.equal(bareRef.deref(), undefined, 'control: an unheld object must be collectable');
  assert.ok(heldRef.deref() !== undefined, 'collected while its call was pending');

  heldGate.resolve();
  bareGate.resolve();
  await Promise.all([heldCall, bareCall]);
});

/** Every `.ts`/`.tsx` file under `src/`, tests excluded. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

test('⚠ nothing outside storage/database.ts calls prepareAsync — it hands out an unheld statement', () => {
  const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const allowed = path.join(srcRoot, 'storage', 'database.ts');

  const offenders = sourceFiles(srcRoot)
    .filter((file) => file !== allowed)
    .filter((file) => /\.prepareAsync\s*\(/.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(srcRoot, file));

  assert.deepEqual(
    offenders,
    [],
    'use withStatement from storage/database.ts, which keeps the statement alive (T-179)'
  );
});

/**
 * The store's answers in the app's vocabulary (T-156b), and the rules that
 * keep `expo-iap` behind one file.
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { outcomeForErrorCode, toStorePurchase } from './billingOutcomes.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');

test('each error code the purchase sheet can meet has its outcome', () => {
  // The values of expo-iap 5.8.2's ErrorCode. Recheck this table on an upgrade.
  const expected: Record<string, string> = {
    'user-cancelled': 'cancelled',
    'already-owned': 'alreadyOwned',
    pending: 'pending',
    'deferred-payment': 'pending',
    'network-error': 'offline',
    'service-timeout': 'offline',
    'service-error': 'offline',
    'remote-error': 'offline',
    'billing-unavailable': 'unavailable',
    'iap-not-available': 'unavailable',
    'feature-not-supported': 'unavailable',
    'developer-error': 'failed',
    'item-unavailable': 'failed',
    'sku-not-found': 'failed',
    'service-disconnected': 'failed',
    unknown: 'failed',
  };
  for (const [code, outcome] of Object.entries(expected)) {
    assert.equal(outcomeForErrorCode(code), outcome, code);
  }
});

test('a code nobody has seen, or none at all, is a failure and never a success', () => {
  for (const code of ['a-code-from-a-later-version', '', null, undefined]) {
    assert.equal(outcomeForErrorCode(code), 'failed', String(code));
  }
});

test('a library purchase becomes what the purchase rules read', () => {
  assert.deepEqual(
    toStorePurchase({
      productId: 'passport_test',
      purchaseState: 'purchased',
      transactionDate: 1_700_000_000_000,
      isAcknowledgedAndroid: true,
    }),
    { productId: 'passport_test', state: 'purchased', purchaseTimeMs: 1_700_000_000_000, acknowledged: true }
  );
});

test('⚠ an acknowledgement the library does not report reads as not acknowledged', () => {
  // Acknowledging twice is harmless; never acknowledging is a refund in three days.
  for (const flag of [undefined, null, false]) {
    const purchase = toStorePurchase({
      productId: 'p',
      purchaseState: 'purchased',
      transactionDate: 1,
      isAcknowledgedAndroid: flag,
    });
    assert.equal(purchase.acknowledged, false, String(flag));
  }
});

test('a purchase state the app does not know is unknown, so it never unlocks', () => {
  const purchase = toStorePurchase({ productId: 'p', purchaseState: 'restored', transactionDate: 1 });
  assert.equal(purchase.state, 'unknown');
});

/** A source file without its comments, so a rule reads the code and not the prose about it. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Every .ts and .tsx file under `src`, as paths relative to it. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [path.relative(srcRoot, full).replace(/\\/g, '/')] : [];
  });
}

test('⚠ storeBilling.ts is the only file that imports expo-iap', () => {
  // D-091: if the library is ever swapped, one file changes.
  const importers = sourceFiles(srcRoot).filter((file) =>
    /from ['"]expo-iap['"]|require\(['"]expo-iap['"]\)|import\(['"]expo-iap['"]\)/.test(
      codeOf(path.join(srcRoot, file))
    )
  );
  assert.deepEqual(importers, ['entitlement/storeBilling.ts']);
});

test('⚠ the purchase is acknowledged as non-consumable, and never consumed', () => {
  // Consuming a one-time product drops the ownership: it could be bought again
  // and a restore would find nothing (§4.3).
  const source = codeOf(path.join(here, 'storeBilling.ts'));
  const calls = source.match(/finishTransaction\(\{[^}]*\}\)/g) ?? [];
  assert.ok(calls.length > 0, 'storeBilling.ts no longer calls finishTransaction');
  for (const call of calls) {
    assert.match(call, /isConsumable: false/, call);
  }
  assert.doesNotMatch(source, /consumePurchaseAndroid|isConsumable: true/);
});

test('⚠ the store adapter never calls a verification service', () => {
  // D-091: no server of ours or anyone else's. expo-iap ships one (IAPKit at
  // kit.openiap.dev) that is only contacted if called.
  const source = codeOf(path.join(here, 'storeBilling.ts'));
  assert.doesNotMatch(source, /verifyPurchase|kitApi|iapkit/i);
});

test('pure: billingOutcomes imports nothing but types', () => {
  const source = readFileSync(path.join(here, 'billingOutcomes.ts'), 'utf8');
  for (const line of source.match(/^import .*$/gm) ?? []) {
    assert.match(line, /^import type /, line);
  }
});

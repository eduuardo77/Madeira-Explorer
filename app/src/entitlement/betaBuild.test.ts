/**
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { effectiveUnlocked } from './betaBuild.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('D-084: a beta build is unlocked; a store build follows the store', () => {
  assert.equal(effectiveUnlocked(false, true), true);
  assert.equal(effectiveUnlocked(false, false), false);
  assert.equal(effectiveUnlocked(true, false), true);
});

test('⚠ D-084: nothing committed turns the beta on for a store build', () => {
  // A committed EXPO_PUBLIC_PROA_BETA=1 would give every store user the whole
  // passport for free, silently, and D-075 never takes a visible stamp away.
  for (const name of ['app.json', 'eas.json', '.env.example', 'package.json']) {
    const file = path.join(appRoot, name);
    if (!existsSync(file)) continue;
    assert.equal(
      /EXPO_PUBLIC_PROA_BETA["'\s:=]+["']?1/.test(readFileSync(file, 'utf8')),
      false,
      `${name} sets EXPO_PUBLIC_PROA_BETA`
    );
  }
});

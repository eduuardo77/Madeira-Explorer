/**
 * The recorder is re-asserted whenever the app comes to the front (T-212).
 *
 *     cd app && npm test
 *
 * A source check: the wiring is in App.tsx, which Node cannot load. Without it
 * a launch into a process Android had started in the background defers the
 * recorder and never retries (measured on the P30, 2026-09-24).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('⚠ T-212: App.tsx re-syncs the recorder when AppState turns active', () => {
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const source = readFileSync(path.join(appRoot, 'App.tsx'), 'utf8');
  assert.match(
    source,
    /AppState\.addEventListener\('change',[\s\S]{0,120}next === 'active'[\s\S]{0,80}syncRecordingWithPreferences\('active'\)/
  );
});

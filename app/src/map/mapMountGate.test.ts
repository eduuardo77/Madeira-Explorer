/**
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapMayMount } from './mapMountGate.ts';

test('T-177: the map waits for the foreground once, then stays mounted', () => {
  assert.equal(mapMayMount(false, 'background'), false);
  assert.equal(mapMayMount(false, 'unknown'), false);
  assert.equal(mapMayMount(false, 'active'), true);
  // A latch: going to the background later must not tear the map down.
  assert.equal(mapMayMount(true, 'background'), true);
});

test('⚠ T-177: the map screen renders GoogleMaps.View only behind the gate', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(path.join(here, 'NativeMapScreen.tsx'), 'utf8');
  const spinner = source.indexOf('if (!ready || !activityReady)');
  const map = source.indexOf('<GoogleMaps.View');
  assert.ok(spinner > 0, 'the spinner branch must also wait for activityReady');
  assert.ok(map > spinner, 'GoogleMaps.View must come after the gate');
  assert.equal(source.split('<GoogleMaps.View').length - 1, 1, 'one map, behind the gate');
});

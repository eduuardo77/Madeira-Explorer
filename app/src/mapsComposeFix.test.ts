/**
 * The maps-compose force outlives its reason by exactly zero releases (T-177).
 *
 *     cd app && npm test
 *
 * `withMapsComposeFix.js` forces maps-compose 6.12.1 because expo-maps pins
 * 6.10.0, whose initializer can leave the map blank for the life of the process
 * (googlemaps/android-maps-compose#776, fixed in 6.12.0). When expo-maps moves
 * to 6.12.0 or later, the force is dead weight — and worse, a pin that could
 * later hold the app *below* what expo-maps wants. This fails then, so it gets
 * removed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function parse(version: string): number[] {
  return version.split('.').map((part) => Number(part));
}

function below(a: string, b: string): boolean {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i += 1) {
    if (x[i] !== y[i]) return x[i] < y[i];
  }
  return false;
}

test('⚠ T-177: expo-maps still pins a maps-compose without the initializer fix', () => {
  const gradle = readFileSync(
    path.join(appRoot, 'node_modules', 'expo-maps', 'android', 'build.gradle'),
    'utf8'
  );
  const pinned = /com\.google\.maps\.android:maps-compose:(\d+\.\d+\.\d+)/.exec(gradle)?.[1];
  assert.ok(pinned !== undefined, 'expo-maps no longer names maps-compose; re-read T-177');
  assert.ok(
    below(pinned, '6.12.0'),
    `expo-maps now pins maps-compose ${pinned}, which has the fix: delete plugins/withMapsComposeFix.js and this test`
  );
});

test('T-177: the force is to a version that has the fix, and the plugin is applied', () => {
  const { VERSION } = require('../plugins/withMapsComposeFix.js') as { VERSION: string };
  assert.equal(below(VERSION, '6.12.0'), false);
  const appJson = JSON.parse(readFileSync(path.join(appRoot, 'app.json'), 'utf8')) as {
    expo: { plugins: unknown[] };
  };
  assert.ok(appJson.expo.plugins.includes('./plugins/withMapsComposeFix'));
});

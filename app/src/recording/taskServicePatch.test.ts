/**
 * The expo-task-manager fix that keeps background deliveries reaching JS (T-242).
 *
 *     cd app && npm test
 *
 * ⚠⚠ WHAT BROKE, MEASURED ON THE P30 (2026-09-26)
 * ---------------------------------------------
 * The recorder recorded nothing from 2026-09-25 14:31 until the next day,
 * including a whole drive with *Começar passeio* pressed, while the app said it
 * was recording. `TaskService` logged 63 deliveries and 0 `Finished task`; a
 * trace at the first line of each JS task showed JavaScript alive and **never
 * called**.
 *
 * The cause is in expo-task-manager 57 (57.0.20 too). When the process starts
 * with deliveries already waiting (after an install, a restart, or the OS
 * waking the app), `TaskService` asks the headless loader to start the app, and
 * the task manager registers as *headless*. Two seconds after the backlog
 * drains, `invalidateAppRecord` deletes that registration, even though the JS
 * instance is the screen's and stays alive. Every later delivery then waits for
 * a registration that never comes back. No error, no log.
 *
 * `patches/expo-task-manager+57.0.9.patch` is expo-task-manager 58.0.8's own
 * fix, backported: forget the headless registration only when the JS instance
 * really goes (`setTaskManager(null)`), never on invalidation. This test reads
 * the Java that Gradle compiles, so it fails if an install skipped
 * `patch-package` or an upgrade dropped the patch.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const packageDir = path.join(appRoot, 'node_modules', 'expo-task-manager');
const taskService = readFileSync(
  path.join(packageDir, 'android/src/main/java/expo/modules/taskManager/TaskService.java'),
  'utf8'
);

/** The body of a Java method, from its signature to the brace that closes it. */
function methodBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `${signature} not found in TaskService.java`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces after ${signature}`);
}

test('a JS instance that goes away is forgotten from both registration tables', () => {
  const body = methodBody(taskService, 'public void setTaskManager(');
  const nullBranch = body.slice(body.indexOf('if (taskManager == null)'), body.indexOf('return;'));
  assert.match(nullBranch, /sTaskManagers\.remove\(appScopeKey\)/);
  assert.match(
    nullBranch,
    /sHeadlessTaskManagers\.remove\(appScopeKey\)/,
    'setTaskManager(null) must also clear the headless table, or a destroyed JS instance keeps receiving deliveries'
  );
});

test('⚠ invalidating the headless record never deletes a live registration', () => {
  const body = methodBody(taskService, 'private void invalidateAppRecord(');
  assert.ok(
    !/sHeadlessTaskManagers\.remove/.test(body),
    'invalidateAppRecord deletes the task manager again: every delivery after a cold start with a backlog is lost (T-242). Is patches/expo-task-manager+*.patch applied?'
  );
});

test('⚠ the patched source is what gets compiled, not the prebuilt library', () => {
  // expo-task-manager ships a precompiled AAR in `local-maven-repo/`, and Gradle
  // uses it unless autolinking is told otherwise. Without this setting the patch
  // above is inert and every test in this file passes over an unfixed app: that
  // is how the first attempt at T-242 would have shipped.
  const { expo } = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8')) as {
    expo?: { autolinking?: { android?: { buildFromSource?: string[] } } };
  };
  assert.ok(
    expo?.autolinking?.android?.buildFromSource?.includes('expo-task-manager'),
    'package.json must list expo-task-manager under expo.autolinking.android.buildFromSource'
  );
});

test('the patch is written for the version installed, until upstream ships the fix', () => {
  const { version } = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as {
    version: string;
  };
  const major = Number(version.split('.')[0]);
  // From 58 the fix is upstream's own and the patch should be deleted with the upgrade.
  if (major >= 58) return;
  assert.ok(
    existsSync(path.join(appRoot, 'patches', `expo-task-manager+${version}.patch`)),
    `expo-task-manager ${version} is installed but no patch is written for it: regenerate with npx patch-package expo-task-manager`
  );
});

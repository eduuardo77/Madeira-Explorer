/**
 * The app's name is written once (D-074).
 *
 *     cd app && npm test
 *
 * ⚠ **THIS TEST EXISTS BECAUSE THE RENAME FOUND FIVE HARDCODED COPIES.**
 * `privacyPolicy.ts` had exported `APP_NAME` since T-124, and the souvenir card,
 * the settings footnote, the foreground-service notification and two health-check
 * notification bodies all ignored it and wrote the string out longhand. Renaming
 * the app on 2026-08-17 therefore meant editing six files, and the two that would
 * have been missed are the ones nobody looks at: notification bodies that only
 * appear when recording has already gone wrong.
 *
 * A constant most callers ignore is not a constant, it is a suggestion. This makes
 * it a rule.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APP_NAME } from './brand.ts';

const srcRoot = path.dirname(fileURLToPath(import.meta.url));

/** Every source file, except this one and the module that defines the name. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/^brand\.(ts|test\.ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

test('the app name is not hardcoded anywhere outside brand.ts', () => {
  const offenders: string[] = [];

  for (const file of sourceFiles(srcRoot)) {
    const text = readFileSync(file, 'utf8');
    // Quoted occurrences only. A comment explaining the history is fine; a
    // string literal a user could read is not.
    const quoted = new RegExp(`['"\`][^'"\`\\n]*\\b${APP_NAME}\\b[^'"\`\\n]*['"\`]`);
    if (quoted.test(text)) {
      offenders.push(path.relative(srcRoot, file).replace(/\\/g, '/'));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `these files hardcode the app name instead of importing APP_NAME from brand.ts:\n  ${offenders.join('\n  ')}`
  );
});

test('⚠ the old name is gone from every user-facing string', () => {
  // Renames leave debris in the places nobody reads. This is the sweep.
  const offenders: string[] = [];
  for (const file of sourceFiles(srcRoot)) {
    const text = readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      // Skip comment lines: the reasoning for the rename mentions the old name
      // on purpose, and deleting that history would be the worse outcome.
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
        continue;
      }
      if (line.includes('Madeira Explorer')) {
        offenders.push(`${path.relative(srcRoot, file).replace(/\\/g, '/')}: ${trimmed.slice(0, 60)}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `old app name still in code:\n  ${offenders.join('\n  ')}`);
});

test('⚠ the app config carries the name too — permission dialogs live there', () => {
  // Found during the rename: the iOS NSLocation*UsageDescription strings and the
  // Android location permission strings sit in `app.json`, NOT in `src/`. They are
  // the most user-visible text the app has — the OS permission dialog — and the
  // first version of this test could not see them at all.
  const config = readFileSync(path.join(srcRoot, '..', 'app.json'), 'utf8');
  assert.ok(!config.includes('Madeira Explorer'), 'app.json still carries the old app name');
  assert.ok(
    config.includes(`"name": "${APP_NAME}"`),
    `app.json's expo.name should be ${APP_NAME}`
  );
});

test('the name survives a watermark, which is what design brief §7.2 asks', () => {
  // Short enough to sit on the souvenir card without shrinking to nothing —
  // the surface §7.2 calls the primary distribution channel (D-013).
  assert.ok(APP_NAME.length <= 12, `${APP_NAME} is too long for a watermark`);
  assert.ok(APP_NAME.trim() === APP_NAME, 'stray whitespace in the app name');
});

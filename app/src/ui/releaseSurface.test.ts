/**
 * Nothing built for developers is reachable in a release build (T-189).
 *
 *     cd app && npm test
 *
 * ⚠⚠ WHY THIS EXISTS. The review of 2026-09-22 opened Settings → *Sobre* →
 * *Detalhes técnicos* on the P30's **release** build and found a screen headed
 * *"Recorder — Phase 1 debug view. Not the product."*: English on a Portuguese
 * phone, trip ids and fix counts, and buttons that start the recorder on
 * hard-coded profiles. `i18nCoverage.test.ts` had exempted that screen as
 * *"never shipped as a route"*, and that sentence was simply untrue.
 *
 * ⚠ WHY `__DEV__` AND NOT A FIELD-BUILD FLAG. A flag inlined into the JS bundle
 * is not an input Gradle or Metro knows about, so a bundle built under one
 * setting can be reused under the other. That is T-180's shape exactly (a
 * stale bundle shipped the old places), and here it would put the debug route
 * into a store build. `__DEV__` is set by the build type itself. The field build
 * loses the screen; field work reads the phone through `dumpsys` and `sqlite3`.
 *
 * A source scan, because nothing tests a screen (the T-145/T-167 lesson).
 * Verified by removing each guard in turn.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The file's lines with comments blanked, so a mention in prose does not count. */
function codeLines(relative: string): string[] {
  return readFileSync(path.join(appRoot, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, (_whole, before: string) => before)
    .split('\n');
}

test('⚠ T-189 — every route to the debug screen is guarded by __DEV__', () => {
  const unguarded = codeLines('App.tsx')
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => /'debug'|<DebugScreen\b/.test(text))
    // The screen-state type names the value; naming it routes nowhere.
    .filter(({ text }) => !/\|\s*'debug'/.test(text))
    .filter(({ text }) => !text.includes('__DEV__'));
  assert.deepEqual(
    unguarded.map(({ line, text }) => `App.tsx:${line}: ${text.trim()}`),
    [],
    'A line that can reach the debug screen must say __DEV__ on it.'
  );
});

test('⚠ T-189 — Settings shows the technical row only when it is given a route', () => {
  const source = codeLines('src/ui/SettingsView.tsx').join('\n');
  assert.match(source, /onOpenDebug\?: \(\) => void/);
  assert.match(
    source,
    /onOpenDebug === undefined \? null : \(\s*<ListRow[^>]*label=\{t\('settings\.about\.technical'\)\}/
  );
});

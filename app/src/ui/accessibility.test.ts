/**
 * Accessibility rules that a build can hold (T-113, D-015).
 *
 *     cd app && npm test
 *
 * WHAT THIS FILE IS AND IS NOT
 * ----------------------------
 * The real accessibility check for T-113 was a **measurement**, not a test:
 * every screen mounted in the workbench (D-038), every control's height read
 * from the DOM, at normal size and again at 2× text scaling. That found no
 * failures, and the results are recorded in TASKS.md — but it cannot run in
 * CI, because it needs a browser and a running Metro server.
 *
 * So this file holds the part that *is* mechanically checkable, chosen for one
 * property: each rule catches a regression that a measurement would only find
 * if somebody remembered to re-run it.
 *
 * ⚠ **These three rules do not prove the app is accessible.** They prove three
 * specific ways of breaking it are closed. Tap-target *sizes* are proved by
 * measurement, contrast by `contrast.test.ts`, and neither substitutes for the
 * thing nobody has done: using this on a phone, outdoors (T-065), at the text
 * size an 80-year-old actually has set (CONTEXT §6.5).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MIN_TAP_TARGET, fontSize } from './theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');

// ---------------------------------------------------------------------------
// The constants themselves
// ---------------------------------------------------------------------------

test('the tap target is 60, not the usual 44', () => {
  // D-015 chose 60 deliberately over the platform default. Somebody will
  // "correct" it to 44 one day, because 44 is what every guideline says.
  assert.equal(MIN_TAP_TARGET, 60);
});

test('no type size is small enough to be unreadable at arm’s length', () => {
  // CONTEXT §6.5's reader is 80 years old and outdoors. 14 is the floor here
  // and is used only for footnotes and section headers, never for anything a
  // decision depends on.
  for (const [name, size] of Object.entries(fontSize)) {
    assert.ok(size >= 14, `fontSize.${name} is ${size}`);
  }
  assert.ok(fontSize.body >= 17, 'body text has shrunk');
});

// ---------------------------------------------------------------------------
// Rules the source must keep
// ---------------------------------------------------------------------------

test('system font scaling is never switched off', () => {
  // ⚠ The single most damaging line somebody could add. `allowFontScaling={false}`
  // is the standard fix for text that overflows its box, and it silently
  // removes the accessibility setting the target user most relies on. The
  // right fix is always to let the box grow — which is why the onboarding
  // buttons sit outside their ScrollView (D-041).
  const offenders = sources().filter((file) =>
    /allowFontScaling\s*=\s*\{?\s*false/.test(code(file))
  );

  assert.deepEqual(
    offenders.map(relative),
    [],
    'these disable font scaling — grow the box instead (D-015, CONTEXT §6.5)'
  );
});

test('type sizes come from the theme, never from a literal', () => {
  // A hardcoded `fontSize: 12` is how "large type throughout" erodes: never in
  // one obvious change, always one component at a time.
  const offenders: string[] = [];

  for (const file of sources()) {
    if (file.endsWith(path.join('ui', 'theme.ts'))) {
      continue;
    }
    // `fontSize: 12` — but not `fontSize: fontSize.body` or an expression
    // built from one, which is how the stamp artwork sizes its band text.
    if (/fontSize:\s*\d/.test(code(file))) {
      offenders.push(relative(file));
    }
  }

  assert.deepEqual(offenders, [], 'these hardcode a type size instead of using `theme.fontSize`');
});

test('every screen that has a control knows what a tap target is', () => {
  // A proxy, and an honest one: it cannot check that each control is 60 dp —
  // that is what the workbench measurement does — but it does catch a new
  // screen adding a Pressable and sizing it by eye, which is the realistic
  // regression.
  const offenders: string[] = [];

  for (const file of sources()) {
    const source = code(file);
    const rendersControl = /<(Pressable|TouchableOpacity|TouchableHighlight)\b/.test(source);
    if (rendersControl && !source.includes('MIN_TAP_TARGET')) {
      offenders.push(relative(file));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'these render a control without referencing MIN_TAP_TARGET (D-015: 60 dp, not 44)'
  );
});

test('the rules above actually match something, so they are not vacuous', () => {
  // Probe check. Every assertion here is "this list is empty", which is also
  // what a broken pattern produces. So: prove the patterns fire on text that
  // should fail, and prove the file sweep sees the app.
  assert.ok(sources().length > 20, `only ${sources().length} source files found`);
  assert.ok(
    sources().some((file) => file.endsWith('SettingsView.tsx')),
    'the sweep is not reaching the screens'
  );

  assert.match('<Text allowFontScaling={false}>', /allowFontScaling\s*=\s*\{?\s*false/);
  assert.match('  fontSize: 12,', /fontSize:\s*\d/);
  // And the shape the app actually uses must NOT trip it.
  assert.doesNotMatch('  fontSize: fontSize.body,', /fontSize:\s*\d/);
  assert.doesNotMatch('  fontSize: bandHeight * 0.62,', /fontSize:\s*\d/);

  // The comment stripper must remove prose without eating code — theme.ts
  // both documents the rule and must keep passing it.
  const theme = code(path.join(srcRoot, 'ui', 'theme.ts'));
  assert.doesNotMatch(theme, /allowFontScaling/, 'comments are not being stripped');
  assert.match(theme, /MIN_TAP_TARGET/, 'the stripper ate the code');
});

/**
 * A file's code, with comments removed.
 *
 * ⚠ Not fussiness. The first version of this matched `theme.ts`, whose comment
 * *warns against* `allowFontScaling={false}` — the rule was failing on the
 * documentation of the rule. Every check here would have the same problem the
 * moment somebody explained one of them in prose.
 */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every `.ts`/`.tsx` under `src/`, tests excluded. */
function sources(): string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (
        (full.endsWith('.ts') || full.endsWith('.tsx')) &&
        !full.endsWith('.test.ts')
      ) {
        found.push(full);
      }
    }
  };

  walk(srcRoot);
  return found;
}

function relative(file: string): string {
  return path.relative(srcRoot, file);
}

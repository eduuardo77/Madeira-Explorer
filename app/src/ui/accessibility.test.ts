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
import { LANGUAGES } from '../i18n/languages.ts';
import { STRINGS, type StringKey } from '../i18n/strings.ts';

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

test('a hit target is computed on four sides, never guessed as one number', () => {
  // ⚠ **The rule this exists for cost a shipped control.** The passport's
  // *See all* carried `hitSlop={spacing.sm}` — eight on every side, which
  // looks like care and is not: two small words are a 41 × 19 dp box, so
  // eight all round reaches 57 × 35 against MIN_TAP_TARGET's 60.
  //
  // A scalar cannot be checked against anything, because it does not say what
  // it was trying to reach. An object per side is what somebody writes when
  // they have measured the word and the room around it — see
  // `SEE_ALL_HIT_SLOP`.
  //
  // ⚠ And no workbench measurement can catch this: react-native-web does not
  // render `hitSlop`, so the DOM shows the word rather than the target. This
  // rule is the only mechanical check that exists for it.
  const offenders: string[] = [];

  for (const file of sources()) {
    // `hitSlop={8}` or `hitSlop={spacing.sm}`. An object literal passes, and so
    // does a named constant — those are the two shapes that carry four sides.
    if (/hitSlop\s*=\s*\{\s*(\d|spacing\.)/.test(code(file))) {
      offenders.push(relative(file));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'these size a tap target with one number — give it four sides, measured (D-015)'
  );
});

// ---------------------------------------------------------------------------
// Rules added after the second review (2026-09-24, N4)
// ---------------------------------------------------------------------------
//
// ⚠ The review read the source and found three failures this file could not
// see: a 32 dp row you could press, radio rows that never said which one was
// chosen, and a control whose spoken name was not its visible word. Each rule
// below is the check that would have caught one of them.

/**
 * A radio or checkbox that reports `selected` rather than `checked`: the key
 * `selected`, first or after a comma, so `{{ checked: selected }}` (a variable
 * that happens to be called that) passes.
 */
const SELECTED_NOT_CHECKED =
  /accessibilityRole="(radio|checkbox)"[^<]*?accessibilityState=\{\{(?:[^}]*,)?\s*selected\s*[:,}]/;

test('a radio or checkbox says whether it is checked, not selected', () => {
  // Android's TalkBack announces a radio's state from `checked`. Given
  // `selected`, it says nothing at all about which language is the chosen one,
  // which was the whole point of the control (review N4).
  const offenders = sources().filter((file) => SELECTED_NOT_CHECKED.test(code(file)));

  assert.deepEqual(
    offenders.map(relative),
    [],
    'these give a radio or checkbox `selected`; TalkBack needs `checked`'
  );
});

test('every pressable reaches the tap target, or grows its target with hitSlop', () => {
  // The language rows used a 32 dp text row as their style, and nothing here
  // looked at what a Pressable's style resolved to (review N4). This does, from
  // source: a Pressable passes when it has `hitSlop`, fills the screen, or one
  // of the styles it names is sized from MIN_TAP_TARGET, directly or through a
  // constant built from it (`STAMP_BOX`, `STAMP_SIZE`).
  //
  // ⚠ Still a proxy, and it says so: it proves the style *asks* for 60 dp, not
  // that the phone draws it. A measurement on the device is the real check.
  const offenders: string[] = [];

  for (const file of sources().filter((candidate) => candidate.endsWith('.tsx'))) {
    const source = code(file);
    const sized = tapSizedNames(source);

    for (const match of source.matchAll(/<Pressable\b/g)) {
      const props = openingProps(source, match.index);
      if (/hitSlop\s*=|absoluteFill/.test(props)) {
        continue;
      }
      const styleNames = [...props.matchAll(/styles\.(\w+)/g)].map((found) => found[1]);
      const reaches = styleNames.some((name) => {
        const body = styleBody(source, name);
        return body !== null && (/absoluteFill/.test(body) || mentionsAny(body, sized));
      });
      if (!reaches) {
        offenders.push(`${relative(file)}:${lineOf(source, match.index)}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'these Pressables are not sized from MIN_TAP_TARGET and carry no hitSlop (D-015)'
  );
});

test('a control’s spoken name contains the words it shows', () => {
  // WCAG 2.5.3, label in name. Seven controls broke it on 2026-09-24: every
  // *Concluído* was spoken as *Voltar ao mapa* or *Voltar às definições*, so a
  // voice-control user saying the word on the button pressed nothing. The
  // longer explanation belongs in `accessibilityHint`, which is where it went.
  //
  // Checked wherever both are literal catalogue keys, in every language, since
  // a translation can break it when the English does not.
  const offenders: string[] = [];

  for (const file of sources().filter((candidate) => candidate.endsWith('.tsx'))) {
    for (const block of code(file).match(/<Pressable\b[\s\S]*?<\/Pressable>/g) ?? []) {
      const spoken = /accessibilityLabel=\{\s*t\(\s*'([\w.]+)'/.exec(block)?.[1];
      const shown = /<Text\b[^>]*>\s*\{\s*t\(\s*'([\w.]+)'/.exec(block)?.[1];
      if (spoken === undefined || shown === undefined || spoken === shown) {
        continue;
      }
      for (const language of LANGUAGES) {
        const name = STRINGS[spoken as StringKey];
        const label = STRINGS[shown as StringKey];
        if (!('en' in name) || !('en' in label)) {
          continue; // plural forms carry numbers; not this rule's concern
        }
        if (!words(name[language]).includes(words(label[language]))) {
          offenders.push(`${relative(file)} ${language}: "${label[language]}" is spoken as "${name[language]}"`);
        }
      }
    }
  }

  assert.deepEqual(offenders, [], 'these controls are spoken as something other than what they show');
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
  // The scalar hit target, in both the shapes it has actually been written in.
  assert.match('hitSlop={8}', /hitSlop\s*=\s*\{\s*(\d|spacing\.)/);
  assert.match('hitSlop={spacing.sm}', /hitSlop\s*=\s*\{\s*(\d|spacing\.)/);
  assert.doesNotMatch('hitSlop={SEE_ALL_HIT_SLOP}', /hitSlop\s*=\s*\{\s*(\d|spacing\.)/);
  assert.doesNotMatch(
    'hitSlop={{ top: 24, bottom: 17, left: 12, right: 12 }}',
    /hitSlop\s*=\s*\{\s*(\d|spacing\.)/
  );
  // And the shape the app actually uses must NOT trip it.
  assert.doesNotMatch('  fontSize: fontSize.body,', /fontSize:\s*\d/);
  assert.doesNotMatch('  fontSize: bandHeight * 0.62,', /fontSize:\s*\d/);

  // The three review rules, each shown the exact shape it was written for.
  assert.match(
    'accessibilityRole="radio"\n accessibilityState={{ selected }}',
    SELECTED_NOT_CHECKED
  );
  assert.match(
    'accessibilityRole="checkbox" accessibilityState={{ disabled, selected: on }}',
    SELECTED_NOT_CHECKED
  );
  assert.doesNotMatch(
    'accessibilityRole="radio"\n accessibilityState={{ checked: selected }}',
    SELECTED_NOT_CHECKED
  );
  const rowSource = 'x = <Pressable style={styles.row}><Text/></Pressable>;\n  row: {\n    minHeight: spacing.xl,\n  },';
  assert.equal(
    styleBody(rowSource, 'row')?.includes('MIN_TAP_TARGET'),
    false,
    'the 32 dp row must not read as sized'
  );
  assert.ok(
    mentionsAny('width: STAMP_BOX,', tapSizedNames('const STAMP_BOX = Math.max(A, MIN_TAP_TARGET);')),
    'a size built from MIN_TAP_TARGET is not being followed'
  );
  assert.equal(
    words('Voltar ao mapa').includes(words('Concluído')),
    false,
    'label in name would pass the case it was written for'
  );
  assert.ok(words('Centrar o mapa onde está').includes(words('Centrar')));

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

/**
 * `MIN_TAP_TARGET` and every constant in the file built from it, so a style
 * that says `width: STAMP_BOX` counts as sized when `STAMP_BOX` is
 * `Math.max(STAMP_BUTTON_SIZE, MIN_TAP_TARGET)`.
 */
function tapSizedNames(source: string): string[] {
  const names = ['MIN_TAP_TARGET'];
  let grew = true;
  while (grew) {
    grew = false;
    for (const match of source.matchAll(/\bconst\s+(\w+)\s*=([^;]*);/g)) {
      if (!names.includes(match[1]) && mentionsAny(match[2], names)) {
        names.push(match[1]);
        grew = true;
      }
    }
  }
  return names;
}

function mentionsAny(text: string, names: string[]): boolean {
  return names.some((name) => new RegExp(`\\b${name}\\b`).test(text));
}

/**
 * A Pressable's props: from `<Pressable` to the first `<` after it, which is
 * its first child or its closing tag. Props here never contain a `<`.
 */
function openingProps(source: string, start: number): string {
  const next = source.indexOf('<', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

/** The body of `name: { ... }` in the file's StyleSheet, braces balanced. */
function styleBody(source: string, name: string): string | null {
  const found = new RegExp(`\\n\\s+${name}:\\s*\\{`).exec(source);
  if (found === null) {
    return null;
  }
  let at = found.index + found[0].length;
  for (let depth = 1; depth > 0 && at < source.length; at += 1) {
    if (source[at] === '{') depth += 1;
    if (source[at] === '}') depth -= 1;
  }
  return source.slice(found.index, at);
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/** Lower case, placeholders and punctuation gone: the words a person says. */
function words(text: string): string {
  return text
    .toLowerCase()
    .replace(/\{\w+\}/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
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

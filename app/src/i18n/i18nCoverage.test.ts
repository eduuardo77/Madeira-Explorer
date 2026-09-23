/**
 * No user-readable English may be written into a screen (T-160, 2026-08-18).
 *
 *     cd app && npm test
 *
 * ⚠⚠ **THIS TEST EXISTS BECAUSE T-160 LOOKED FINISHED AND WAS NOT.**
 * The app was translated into three languages, every screen was checked, and
 * the work was written up as done. Then a sweep found:
 *
 *   - **ten accessibility labels still in hardcoded English.** The screens spoke
 *     three languages and the *screen reader* spoke one, so a blind Portuguese
 *     user got an English app — the one class of user who cannot work around it.
 *   - **three visible headings never switched over** — the passport's own title,
 *     the place card's *Show on map* and *Close* — while
 *     `SettingsView` wrote *"Use the light map"* out longhand next to three keys
 *     that had existed since T-160 and were simply never called.
 *
 * That is the same shape as the five hardcoded copies of the app's name that
 * `brand.test.ts` was written for: **a catalogue most callers ignore is not a
 * catalogue, it is a suggestion.** So this is a rule the build enforces rather
 * than a habit somebody has to keep.
 *
 * It is deliberately blunt. A false positive costs one exemption line and a
 * moment's thought; a false negative ships an English word to somebody who
 * cannot read it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * Files whose strings never reach a user, with the reason.
 *
 * ⚠ Adding to this list is a decision, not a formality. The bar is *"no user
 * can ever read this"* — not *"this screen is unimportant"*.
 */
const EXEMPT: Record<string, string> = {
  // ⚠ This reason was FALSE until 2026-09-23: the review found the screen
  // reachable from Settings in the release build. T-189 made it true, and
  // `ui/releaseSurface.test.ts` keeps it true.
  'ui/DebugScreen.tsx':
    'developer-only: App.tsx routes to it only under __DEV__ (T-189, releaseSurface.test.ts)',
};

function screens(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...screens(full));
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** Two or more consecutive letters — a word, rather than a symbol or a number. */
const HAS_A_WORD = /[A-Za-z]{2,}/;

test('no accessibility label is hardcoded English', () => {
  const offenders: string[] = [];

  for (const file of screens(srcRoot)) {
    const relative = path.relative(srcRoot, file).replace(/\\/g, '/');
    if (relative in EXEMPT) {
      continue;
    }
    const source = readFileSync(file, 'utf8');

    // A plain string literal: accessibilityLabel="Back to the map"
    for (const match of source.matchAll(/accessibilityLabel="([^"]*)"/g)) {
      if (HAS_A_WORD.test(match[1])) {
        offenders.push(`${relative}: accessibilityLabel="${match[1]}"`);
      }
    }

    // A template literal carrying prose: `${name}, collected. Open to…`
    // Interpolations are stripped first, so `${a} ${b}` is fine and
    // `${a}, collected` is not.
    for (const match of source.matchAll(/accessibilityLabel=\{`([^`]*)`\}/g)) {
      const literal = match[1].replace(/\$\{[^}]*\}/g, '');
      if (HAS_A_WORD.test(literal)) {
        offenders.push(`${relative}: accessibilityLabel={\`${match[1]}\`}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Screen-reader text must come from i18n/strings.ts, in all three languages.\n` +
      `A blind Portuguese user is the one person who cannot work around this.\n\n` +
      offenders.join('\n')
  );
});

test('no visible text is hardcoded English', () => {
  const offenders: string[] = [];

  for (const file of screens(srcRoot)) {
    const relative = path.relative(srcRoot, file).replace(/\\/g, '/');
    if (relative in EXEMPT) {
      continue;
    }
    const source = readFileSync(file, 'utf8');

    // <Text …>Some words</Text> — only literal children. Anything with `{` in
    // it is an expression and is this test's blind spot by design; catching
    // those would mean parsing JSX, and the blunt version already found every
    // real offender in the app.
    for (const match of source.matchAll(/<Text[^>]*>([^<{}]+)<\/Text>/g)) {
      const literal = match[1].trim();
      if (HAS_A_WORD.test(literal)) {
        offenders.push(`${relative}: <Text>${literal}</Text>`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Visible text must come from i18n/strings.ts, in all three languages.\n\n` +
      offenders.join('\n')
  );
});

/**
 * Text props that a component renders to the screen.
 *
 * ⚠ Deliberately a short list of names, not "every prop". The blunt version —
 * any long quoted string — trips over `testID`, `resizeMode` and every style
 * token in the app; these are the props that this codebase actually paints.
 */
const TEXT_PROPS =
  /\b(?<!accessibility)(description|label|title|footnote|message|placeholder|caption|hint)="([^"]*)"/g;

test('no prose is hardcoded English in a text prop', () => {
  const offenders: string[] = [];

  for (const file of screens(srcRoot)) {
    const relative = path.relative(srcRoot, file).replace(/\\/g, '/');
    if (relative in EXEMPT) {
      continue;
    }
    const source = readFileSync(file, 'utf8');

    for (const match of source.matchAll(TEXT_PROPS)) {
      if (HAS_A_WORD.test(match[2])) {
        offenders.push(`${relative}: ${match[1]}="${match[2]}"`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Text handed to a component as a prop still reaches the screen.\n\n` +
      `⚠ THIS TEST EXISTS BECAUSE THE OTHER TWO MISSED IT. Until 2026-08-28 the\n` +
      `three tracking-quality descriptions were three paragraphs of English\n` +
      `written straight into SettingsView as description="…". They rendered\n` +
      `inside {curly braces}, which the visible-text test documents as its own\n` +
      `blind spot, and they were not accessibility labels — so both existing\n` +
      `tests passed while a Portuguese user read English in the one place the\n` +
      `app explains what recording costs them.\n\n` +
      offenders.join('\n')
  );
});

test('no English word is used to join two interpolations', () => {
  const offenders: string[] = [];

  for (const file of screens(srcRoot)) {
    const relative = path.relative(srcRoot, file).replace(/\\/g, '/');
    if (relative in EXEMPT) {
      continue;
    }
    const source = readFileSync(file, 'utf8');

    // `${collected} of ${total}` — prose sitting BETWEEN two interpolations.
    // Narrow on purpose: a word with an interpolation on each side is almost
    // always a preposition or a conjunction, and those are exactly what does
    // not survive translation. Anything looser trips over paths and URLs.
    for (const match of source.matchAll(/`[^`]*\}\s+([A-Za-z]{2,})\s+\$\{[^`]*`/g)) {
      offenders.push(`${relative}: ${match[0]} — "${match[1]}" is English`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `A word joining two values still has to be translated.\n\n` +
      `⚠ THE ONE THIS WAS WRITTEN FOR: the passport showed "0 of 16" on an\n` +
      `otherwise fully Portuguese screen until 2026-08-28. It sat inside a\n` +
      `template literal in JSX, which both other tests document as their blind\n` +
      `spot, so three passing i18n tests and a screen-by-screen review all missed\n` +
      `a word visible five times on the app's second screen. German wants "von",\n` +
      `Portuguese "de"; neither borrows "of".\n\n` +
      offenders.join('\n')
  );
});

test('the exemption list is documented and still real', () => {
  // An exemption for a file that has been deleted or renamed is an exemption
  // nobody notices has stopped applying — and the next file to take that path
  // would inherit it silently.
  for (const [relative, reason] of Object.entries(EXEMPT)) {
    assert.ok(
      reason.length > 20,
      `${relative} is exempt without a real reason given`
    );
    assert.doesNotThrow(
      () => statSync(path.join(srcRoot, relative)),
      `${relative} is exempt but no longer exists`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// T-190 — THE BLIND SPOT, CLOSED (2026-09-23)
//
// Every test above reads `.tsx` files, and only text written *directly* into
// JSX. The review of 2026-09-22 found English on a Portuguese phone in exactly
// the places that left out: the place card's category and distance were
// constants in `placeCard.ts`, the share card's "places collected" was in
// `shareCard.ts`, and "· Collected" sat inside `{}`. Checking the review found
// more of the same: the passport's "Did you walk the …?" prompt, the share
// sheet's title, the walk-report description, and every failure alert, which
// showed the diary's English `reason` under a translated title.
//
// So this reads every string literal in every module, `.ts` and `.tsx`, inside
// `{}` and template literals too. Two kinds of English are allowed, and each
// has a rule rather than an exemption:
//
//   - **The diary.** Text passed to a logger or an Error, or stored as a
//     `reason`, is for the recording diary, the debug screen and the award
//     rows. It is English on purpose: it is read by whoever fixes the app.
//   - **A `reason` is never shown.** The second test below fails if a screen
//     renders one, which is what makes the first rule safe.
//
// ⚠ ITS OWN BLIND SPOT: a single English word. `'Viewpoint'` is indistinguishable
// from an identifier like `'walking'`, so one word alone is not flagged — the
// place card's category names would have passed as single words, and were
// caught only because *"Levada walk"* is two. Verified 2026-09-23 by planting
// every leak from the review in a probe file: all but that class failed.
// ─────────────────────────────────────────────────────────────────────────────

/** Two words or more, or a word after a `·` separator: prose, not an identifier. */
const PROSE = /[A-Za-z]{2,}(?:[ ,]+[A-Za-z]{2,})+|^\s*·\s*[A-Za-z]{2,}/;

/**
 * A literal directly after one of these is diary, not something a user reads:
 * a logger (with or without its `kind` argument first), an Error, an assertion,
 * a `reason`, or a verdict helper named in capitals — `CONTINUES`, `SILENT`,
 * `NOT_AWARDED` — which is this codebase's convention for "a decision, and the
 * diary line that explains it".
 */
const DIARY_CONTEXT =
  /(?:\blog|\blogError|console\.\w+|Error|\bassert\w*|\b[A-Z][A-Z_]{2,})\(\s*(?:'[a-z_ ]+',\s*)?$|\breason\s*[:=]\s*$|\breason\s*:\s*\S*\?\s*$/;

/**
 * A line may say why its literal is not screen text: `// i18n-exempt: <why>`.
 * For the one-off — an SVG attribute, a stored reason built by a helper. The
 * *why* is required: the last test in this file fails a bare marker.
 */
const LINE_EXEMPT = /\/\/ i18n-exempt: (.*)$/;

/** Directories whose strings are not screen text, with the reason. */
const NOT_SCREEN_TEXT: Record<string, string> = {
  'i18n/': 'the catalogue itself — this is where the English is supposed to be',
  'storage/': 'SQL, migrations and diary lines; nothing here is rendered',
  'legal/':
    'the privacy policy is one whole document per language, checked by privacyPolicy.test.ts',
};

/**
 * Modules whose English is diary-only but not written as a `reason`, with why.
 *
 * ⚠ The same bar as `EXEMPT`: *"no user can ever read this"*. A module that
 * builds anything a screen shows does not belong here, however many diary
 * lines it also writes — convert its diary lines to `reason` instead.
 */
const DIARY_ONLY: Record<string, string> = {
  'content/contentPack.ts':
    'validation messages for a malformed content pack; validate-content.mjs refuses to ship one',
  'content/regionPack.ts':
    'validation messages for a malformed region pack; build-regions.mjs refuses to ship one',
  'map/mapAssets.ts': 'font family names and bundled asset paths, not prose',
  'recording/geofenceManager.ts': 'geofence diary lines, read on the debug screen only',
  'recording/tripRecording.ts': 'recorder diary lines, read on the debug screen only',
  'recording/recorderSilence.ts':
    'the silence verdict detail, whose only reader is the debug screen (recorderHealth)',
  'recording/movementPolicy.ts': 'sampling decisions, written to the diary only',
  'recording/locationProbe.ts': 'the location probe behind a debug-screen button',
  'recording/ExpoLocationProvider.ts': 'recorder warnings, written to the diary only',
  'recording/recordingSink.ts': 'batch diary lines, written to the diary only',
  'progress/stampRules.ts':
    'why a stamp was or was not awarded, stored on the award row; never rendered',
};

function allModules(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...allModules(full));
    } else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

/** Comments out, newlines kept, so a match can still name its line. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, (_whole, before: string) => before);
}

test('⚠ T-190 — no English prose is written into any module a user can read', () => {
  const offenders: string[] = [];

  // `App.tsx` sits beside `src/`, not in it, and it is the one module every
  // screen passes through (T-189 found English in it).
  for (const file of [...allModules(srcRoot), path.join(srcRoot, '..', 'App.tsx')]) {
    const relative = path.relative(srcRoot, file).replace(/\\/g, '/');
    if (
      relative in EXEMPT ||
      relative in DIARY_ONLY ||
      Object.keys(NOT_SCREEN_TEXT).some((dir) => relative.startsWith(dir))
    ) {
      continue;
    }
    const original = readFileSync(file, 'utf8').split('\n');
    const source = withoutComments(original.join('\n'));

    for (const match of source.matchAll(
      /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g
    )) {
      const literal = match[0].slice(1, -1).replace(/\$\{[^}]*\}/g, ' ');
      if (!PROSE.test(literal) || literal.trimStart().startsWith('<')) {
        continue;
      }
      const before = source.slice(Math.max(0, match.index - 60), match.index);
      if (DIARY_CONTEXT.test(before)) {
        continue;
      }
      const line = source.slice(0, match.index).split('\n').length;
      if (LINE_EXEMPT.test(original[line - 1])) {
        continue;
      }
      offenders.push(`${relative}:${line}: ${match[0].slice(0, 90)}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `English prose outside i18n/strings.ts. If a user can read it, it needs a key\n` +
      `in all three languages. If it is diary, pass it to a logger or store it as\n` +
      `a \`reason\` — and never render a reason.\n\n` +
      offenders.join('\n')
  );
});

test('⚠ T-190 — no screen shows a diary `reason`', () => {
  // Until 2026-09-23 the share and walk-donation alerts showed `built.reason`
  // under a translated title — "the trip could not be read" on a Portuguese
  // phone. A refusal now carries a code the screen translates.
  const offenders: string[] = [];
  for (const file of screens(srcRoot)) {
    const relative = path.relative(srcRoot, file).replace(/\\/g, '/');
    if (relative in EXEMPT) {
      continue;
    }
    const source = withoutComments(readFileSync(file, 'utf8'));
    source.split('\n').forEach((text, index) => {
      if (/\.reason\b/.test(text)) {
        offenders.push(`${relative}:${index + 1}: ${text.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('the diary-only list is documented and still real', () => {
  for (const [relative, reason] of Object.entries(DIARY_ONLY)) {
    assert.ok(reason.length > 20, `${relative} is diary-only without a real reason given`);
    assert.doesNotThrow(
      () => statSync(path.join(srcRoot, relative)),
      `${relative} is diary-only but no longer exists`
    );
  }
});

test('every i18n-exempt line says why', () => {
  const bare: string[] = [];
  for (const file of allModules(srcRoot)) {
    const relative = path.relative(srcRoot, file).replace(/\\/g, '/');
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((text, index) => {
        const marker = LINE_EXEMPT.exec(text);
        if (marker !== null && marker[1].trim().length < 15) {
          bare.push(`${relative}:${index + 1}`);
        }
      });
  }
  assert.deepEqual(bare, [], `An exemption without a reason is a habit, not a rule.\n${bare.join('\n')}`);
});

test('⚠ T-202 — no English inside a <Text> between {} expressions', () => {
  // The privacy screen's dateline was `{APP_NAME} · last changed {POLICY_VERSION}`:
  // plain JSX text between two expressions. The first test here reads only a
  // <Text> with no braces at all, and the literal scan above reads only quoted
  // strings, so "last changed" was English on every phone and nothing saw it.
  const offenders: string[] = [];
  for (const file of screens(srcRoot)) {
    const relative = path.relative(srcRoot, file).replace(/\\/g, '/');
    if (relative in EXEMPT) {
      continue;
    }
    const source = withoutComments(readFileSync(file, 'utf8'));
    for (const match of source.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/g)) {
      let inner = match[1];
      // Drop expressions (innermost first), then any nested elements.
      for (let i = 0; i < 5; i += 1) inner = inner.replace(/\{[^{}]*\}/g, ' ');
      inner = inner.replace(/<[^>]*>/g, ' ').trim();
      if (/[A-Za-z]{2,}/.test(inner)) {
        offenders.push(`${relative}: <Text>…${inner}…</Text>`);
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});


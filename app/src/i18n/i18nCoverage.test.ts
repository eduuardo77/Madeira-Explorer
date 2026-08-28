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
  'ui/DebugScreen.tsx':
    'developer-only, reachable solely from the dev menu and never shipped as a route',
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

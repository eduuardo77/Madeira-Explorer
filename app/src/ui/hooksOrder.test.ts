/**
 * No hook after an early return, in any component.
 *
 *     cd app && npm test
 *
 * ⚠ FOUND ON THE P30, 2026-09-24. `SettingsScreen` called `useCallback` below
 * four `if (…) return` screens (erased, licences, privacy, erase-confirm). The
 * first render ran every hook; tapping any of those rows rendered fewer, and
 * React threw *"Rendered fewer hooks than expected"*. In a release build that
 * is an uncaught error, so the process died, and the recorder, which shares
 * the process, died with it. It had been so since 2026-08-16. A dev build
 * shows a red box instead, and nothing here renders a component, so no test
 * saw it; the project has no ESLint to run `rules-of-hooks` either.
 *
 * This is that rule, cut down to the shape this codebase writes: function
 * components at the top level, early returns and hooks at two-space indent.
 * It errs towards false alarms, which a comment can argue with; a missed one
 * costs the recorder.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === 'node_modules' ? [] : sources(full);
    }
    return entry.endsWith('.tsx') ? [full] : [];
  });
}

/** `[component, line]` for each hook called after an early return. */
function hooksAfterEarlyReturn(source: string): [string, number][] {
  const lines = source.split(/\r?\n/);
  const found: [string, number][] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const start = /^(?:export (?:default )?)?function ([A-Z]\w*)\s*[(<]/.exec(lines[i]);
    if (start === null) continue;
    let returned = false;
    let lastTopLevel = '';
    for (let j = i + 1; j < lines.length && lines[j] !== '}'; j += 1) {
      const line = lines[j];
      if (/^  \S/.test(line)) {
        if (returned && /^  (?:(?:const|let|var)\s[^=]*=\s*)?use[A-Z]\w*\s*[(<]/.test(line)) {
          found.push([start[1], j + 1]);
        }
        if (/^  if\b.*\breturn\b/.test(line)) returned = true;
        lastTopLevel = line;
      } else if (/^    return\b/.test(line) && /^  if\b/.test(lastTopLevel)) {
        returned = true;
      }
    }
  }
  return found;
}

test('the scan finds the shape that crashed Settings (the probe works)', () => {
  const crashed = [
    'export default function Settings() {',
    '  const [open, setOpen] = useState(false);',
    '  if (open) {',
    '    return <Other />;',
    '  }',
    '  const donate = useCallback(() => {}, []);',
    '  return <View />;',
    '}',
  ].join('\n');
  assert.deepEqual(hooksAfterEarlyReturn(crashed), [['Settings', 6]]);
  const oneLine = crashed.replace('  if (open) {\n    return <Other />;\n  }', '  if (open) return <Other />;');
  assert.equal(hooksAfterEarlyReturn(oneLine).length, 1);
  // A return inside a callback is not an early return from the component.
  const fine = [
    'function Fine() {',
    '  const go = useCallback(() => {',
    '    if (x) {',
    '      return;',
    '    }',
    '  }, []);',
    '  const [a] = useState(0);',
    '  return <View />;',
    '}',
  ].join('\n');
  assert.deepEqual(hooksAfterEarlyReturn(fine), []);
});

test('⚠ no component calls a hook after an early return', () => {
  const offenders: string[] = [];
  for (const file of [...sources(path.join(appRoot, 'src')), path.join(appRoot, 'App.tsx')]) {
    for (const [component, line] of hooksAfterEarlyReturn(readFileSync(file, 'utf8'))) {
      offenders.push(`${path.relative(appRoot, file).replace(/\\/g, '/')}:${line} (${component})`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

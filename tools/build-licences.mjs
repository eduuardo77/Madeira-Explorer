#!/usr/bin/env node
/**
 * The open-source licences the app ships with, for Settings → Licences (T-202).
 *
 *     node tools/build-licences.mjs        # rewrites app/src/legal/licences.json
 *
 * WHY THIS EXISTS
 * ---------------
 * MIT, BSD, ISC and Apache all ask that their notice travel with the software,
 * and a store app with no licences screen is the review's P1-6 finding. This
 * walks the **production** dependency tree as npm installed it (`npm ls
 * --omit=dev --all`), and for each package records its name, version, declared
 * licence and the text of its LICENCE file, if it has one.
 *
 * ⚠ **JavaScript only.** The native Android libraries (Google Play services,
 * the Maps SDK, AndroidX, Kotlin) are not in npm's tree. The screen names
 * Google's terms for Maps and Play services; a generated native list would need
 * Google's oss-licenses Gradle plugin, which is a follow-up, not this.
 *
 * ⚠ **Rerun after any dependency change.** `licences.test.ts` fails the build
 * if a direct dependency in `app/package.json` is missing from the file, so a
 * new dependency cannot ship unlisted.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'app');

// One fixed command string, no user input in it; a shell is what finds npm on
// Windows (npm.cmd).
const tree = JSON.parse(
  execSync('npm ls --omit=dev --all --json', {
    cwd: app,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
);

const seen = new Map();
(function walk(node) {
  for (const [name, dep] of Object.entries(node.dependencies ?? {})) {
    const key = `${name}@${dep.version}`;
    if (seen.has(key) || dep.version === undefined) continue;
    seen.set(key, { name, version: dep.version });
    walk(dep);
  }
})(tree);

function licenceText(dir) {
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((entry) => /^(licen[cs]e|copying)(\.|$)/i.test(entry));
  return file === undefined ? null : readFileSync(path.join(dir, file), 'utf8').trim();
}

const entries = [...seen.values()]
  .map(({ name, version }) => {
    const dir = path.join(app, 'node_modules', name);
    let declared = 'UNKNOWN';
    try {
      const manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
      const licence = manifest.license ?? manifest.licenses;
      declared = typeof licence === 'string' ? licence : JSON.stringify(licence ?? 'UNKNOWN');
    } catch {
      // Keep the entry: an unreadable manifest is worth seeing, not hiding.
    }
    return { name, version, license: declared, text: licenceText(dir) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const out = path.join(app, 'src', 'legal', 'licences.json');
writeFileSync(out, `${JSON.stringify(entries, null, 1)}\n`, 'utf8');

const withoutText = entries.filter((entry) => entry.text === null).length;
console.log(
  `Wrote ${path.relative(root, out)}: ${entries.length} packages, ` +
    `${withoutText} without a licence file (their declared licence is still listed).`
);

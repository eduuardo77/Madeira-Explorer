#!/usr/bin/env node
/**
 * The open-source licences the app ships with, for Settings → Licences (T-202).
 *
 *     cd app/android && ./gradlew assembleRelease     # first: the list is read from it
 *     node tools/build-licences.mjs                   # rewrites app/src/legal/licences.json
 *
 * (With the environment block from HANDOFF: ANDROID_HOME, JAVA_HOME, and
 * ANDROID_SDK_ROOT unset. The script calls Gradle once.)
 *
 * WHAT SHIPS, NOT WHAT IS INSTALLED (T-221, review N5)
 * ----------------------------------------------------
 * The first version walked `npm ls --omit=dev`, and Expo declares its build
 * tooling as runtime dependencies, so the screen listed 119 packages of which
 * 77 never reach the phone (`@babel/core`, `typescript`, `react-dom`) and
 * missed 15 that do (`@babel/runtime`, `scheduler`, `promise`). It had no
 * Android libraries at all. Now the list is exactly what the release build
 * contains, from the two places that know:
 *
 *   1. **JavaScript:** the release bundle's source map. Every package with a
 *      file in the bundle, and nothing else. Licence and text from its folder.
 *   2. **Android:** Gradle's `releaseRuntimeClasspath`, through
 *      `tools/gradle/licences.init.gradle`, which asks Gradle for each module's
 *      POM and prints the licence it declares. npm packages built from source
 *      (react-native-svg, expo-modules-core) come through as projects and are
 *      read from their folders like the JavaScript ones.
 *
 * The Apache License 2.0 asks for its text to travel with the software; over
 * 170 Android modules use it, so the text is stored once and referenced. Other
 * Android licences are listed with the address their POM gives.
 *
 * ⚠ **It refuses rather than guesses.** A module whose POM names no licence, or
 * a release build older than `package-lock.json`, stops the script with the
 * reason. `licences.test.ts` fails if the lock file changes and this was not
 * rerun, and if a build-only package or the Android half goes missing.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'app');
const android = path.join(app, 'android');
const SOURCE_MAP = path.join(
  android,
  'app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map'
);
const LOCK = path.join(app, 'package-lock.json');

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!existsSync(SOURCE_MAP)) {
  fail('no release bundle source map. Build a release first (see the header).');
}
if (statSync(SOURCE_MAP).mtimeMs < statSync(LOCK).mtimeMs) {
  fail('the release build is older than package-lock.json. Rebuild it first.');
}

// ---------------------------------------------------------------------------
// Licence names and texts
// ---------------------------------------------------------------------------

/** One spelling per licence: POMs say "The Apache Software License, Version 2.0". */
function normalise(name) {
  if (/apache/i.test(name)) return 'Apache-2.0';
  if (/^(the )?mit( license)?$/i.test(name.trim())) return 'MIT';
  return name.trim();
}

function licenceFile(dir) {
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((entry) => /^(licen[cs]e|copying)(\.|$)/i.test(entry));
  return file === undefined ? null : readFileSync(path.join(dir, file), 'utf8').trim();
}

/** An npm package's entry, from its own folder. */
function npmEntry(dir, source) {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const declared = manifest.license ?? manifest.licenses;
  return {
    name: manifest.name,
    version: manifest.version,
    source,
    license: normalise(typeof declared === 'string' ? declared : JSON.stringify(declared ?? '')),
    text: licenceFile(dir),
    url: null,
  };
}

/** The Apache 2.0 terms, from the first full copy under node_modules. */
function apacheText() {
  const candidates = ['typescript/LICENSE.txt', 'fbjs/LICENSE', 'hermes-parser/LICENSE'];
  for (const candidate of candidates) {
    const file = path.join(app, 'node_modules', candidate);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    const start = text.indexOf('Apache License');
    const end = text.indexOf('END OF TERMS AND CONDITIONS');
    if (start !== -1 && end > start) {
      return text.slice(start, end + 'END OF TERMS AND CONDITIONS'.length).trim();
    }
  }
  fail('no copy of the Apache License 2.0 found under node_modules');
}

// ---------------------------------------------------------------------------
// 1. JavaScript: what the bundle contains
// ---------------------------------------------------------------------------

const entries = new Map();
const add = (entry) => {
  const key = `${entry.name}@${entry.version}`;
  const known = entries.get(key);
  entries.set(key, known === undefined ? entry : { ...known, source: 'both' });
};

const map = JSON.parse(readFileSync(SOURCE_MAP, 'utf8'));
const packageDirs = new Set();
for (const source of map.sources) {
  const at = source.lastIndexOf('node_modules/');
  if (at === -1) continue;
  const parts = source.slice(at + 'node_modules/'.length).split('/');
  const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
  packageDirs.add(path.join(app, source.slice(0, at), 'node_modules', name));
}
for (const dir of packageDirs) {
  add(npmEntry(dir, 'js'));
}

// ---------------------------------------------------------------------------
// 2. Android: what Gradle puts in the release APK
// ---------------------------------------------------------------------------

const gradleArgs = [
  '--init-script',
  path.join(root, 'tools/gradle/licences.init.gradle'),
  ':app:proaLicences',
  '-q',
  '--console=plain',
];
// On Windows the wrapper is a batch file, which only cmd.exe can run.
const [command, args] =
  process.platform === 'win32'
    ? ['cmd.exe', ['/c', path.join(android, 'gradlew.bat'), ...gradleArgs]]
    : [path.join(android, 'gradlew'), gradleArgs];
const printed = execFileSync(command, args, {
  cwd: android,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

const unnamed = [];
for (const line of printed.split(/\r?\n/)) {
  const [kind, ...fields] = line.trim().split('|');
  if (kind === 'PROJECT') {
    // `.../node_modules/react-native-svg/android` → the package folder.
    add(npmEntry(path.dirname(fields[1]), 'android'));
  } else if (kind === 'LICENCE') {
    const [group, artifact, version, name, url] = fields;
    if (!name) {
      unnamed.push(`${group}:${artifact}:${version}`);
      continue;
    }
    add({
      name: `${group}:${artifact}`,
      version,
      source: 'android',
      license: normalise(name),
      text: null,
      url: url || null,
    });
  }
}
if (unnamed.length > 0) {
  fail(`these declare no licence; decide each by hand before shipping:\n  ${unnamed.join('\n  ')}`);
}

// ---------------------------------------------------------------------------
// Out
// ---------------------------------------------------------------------------

/**
 * Google Play services and Firebase ship under Google's SDK terms, not an
 * open-source licence. They are listed, and the screen's count leaves them out.
 */
const GOOGLE_SDK_TERMS = 'Android Software Development Kit License';

const packages = [...entries.values()]
  .map((entry) => ({
    ...entry,
    openSource: entry.license !== GOOGLE_SDK_TERMS,
    // An Apache module without its own file points at the one shared copy.
    ...(entry.text === null && entry.license === 'Apache-2.0' ? { textRef: 'Apache-2.0' } : {}),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const out = path.join(app, 'src', 'legal', 'licences.json');
const document = {
  // What `licences.test.ts` compares against, so a dependency change without a
  // rerun fails the build.
  packageLock: createHash('sha256').update(readFileSync(LOCK)).digest('hex'),
  texts: { 'Apache-2.0': apacheText() },
  packages,
};
writeFileSync(out, `${JSON.stringify(document, null, 1)}\n`, 'utf8');

const count = (source) => packages.filter((entry) => entry.source === source).length;
console.log(
  `Wrote ${path.relative(root, out)}: ${packages.length} packages ` +
    `(${count('js')} JavaScript, ${count('android')} Android, ${count('both')} both).`
);

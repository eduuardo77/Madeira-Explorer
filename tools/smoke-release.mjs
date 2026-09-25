#!/usr/bin/env node
/**
 * Open every screen of an installed release build, on a real phone, before
 * anyone else does (T-222, review N11).
 *
 *     node tools/smoke-release.mjs                 # the one attached phone
 *     node tools/smoke-release.mjs --serial XPH…   # a chosen one
 *
 * WHY THIS EXISTS
 * ---------------
 * T-209: Settings crashed the app on *Privacidade*, *Apagar tudo* and
 * *Licenças* **for five weeks**, in every build, and 774 tests passed
 * throughout, because no test opens a screen. The second review (N11) put it
 * plainly: nothing taps every screen of a release build before it goes on a
 * phone. This does, in about a minute, and fails if the app crashes, restarts,
 * or a screen it expects never appears.
 *
 * WHAT IT PRESSES, AND WHAT IT NEVER PRESSES
 * ------------------------------------------
 * Only the controls in `STEPS` below: the screens, their *Done* and *Close*,
 * one stamp and its card, and the replay if it is offered. **Never** Erase, End
 * trip, Pause, the recording switch, *Send a recording*, a language row or
 * anything that opens another app. Everything it touches is a door, so a run
 * leaves the phone's data exactly as it found it. It reads the language rows,
 * to check that exactly one says it is checked (T-215).
 *
 * The labels are the app's own, from `app/src/i18n/strings.ts`, in the phone's
 * language: the script finds a control the way a screen reader does, which is
 * also the check that its label is still what the catalogue says.
 *
 * ⚠ It does not force-stop the app (the P30's EMUI starts killing an app that
 * is force-stopped in a loop; HANDOFF), and it never uses `am start -W`, which
 * hangs forever if the app does not come to the front.
 *
 * ⚠ Onboarding is not covered: finishing it needs permission dialogs, and on a
 * phone with a trip on it, onboarding means the data was wiped. The script
 * stops and says so if it lands there.
 */

import { device, pause } from './lib/device.mjs';
import { crashLines, findNode } from './lib/uiTree.mjs';
import { PLURALS, STRINGS } from '../app/src/i18n/strings.ts';
import { LANGUAGE_NAMES } from '../app/src/i18n/languages.ts';

const PKG = 'com.proa.madeira';

const serialAt = process.argv.indexOf('--serial');
const serial = serialAt === -1 ? null : process.argv[serialAt + 1];
const { adb, shell, screen, reach, tap } = device(serial);

// ---------------------------------------------------------------------------
// Labels, in the phone's language
// ---------------------------------------------------------------------------

const locale = shell('getprop persist.sys.locale') || shell('getprop ro.product.locale');
const language = ['pt', 'de'].find((code) => locale.startsWith(code)) ?? 'en';

/** A catalogue string, placeholders filled. */
function label(key, values = {}) {
  const phrase = STRINGS[key];
  const text = phrase[language] ?? phrase.en;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
}

/** A catalogue string as a pattern, each placeholder matching anything. */
function pattern(...keys) {
  const forms = keys.flatMap((key) => {
    // Counted phrases ("1 lugar", "3 lugares") live in their own catalogue.
    const plural = PLURALS[key];
    return plural !== undefined ? [plural.one, plural.other] : [STRINGS[key]];
  });
  const escaped = forms.map((phrase) =>
    (phrase[language] ?? phrase.en)
      .replace(/[.*+?^$()|[\]\\]/g, '\\$&')
      .replace(/\{\w+\}/g, '.+')
  );
  return new RegExp(`^(${escaped.join('|')})$`);
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

const MAP = label('map.a11y.settings');

const STEPS = [
  ['the map', async () => {
    // A launch, not a restart: an app already open comes to the front on
    // whatever screen it was, so Back is pressed until the map shows. Never
    // more than three times, because Back on the map leaves the app (T-211).
    shell(`am start -n ${PKG}/.MainActivity`);
    for (let backs = 0; backs < 3; backs += 1) {
      const nodes = await screen();
      if (findNode(nodes, MAP) !== null) return;
      if (findNode(nodes, pattern('onboarding.welcome.title')) !== null) {
        throw new Error('the app is on onboarding: this phone has no trip to protect, or was wiped');
      }
      await pause(1500);
      if (findNode(await screen(), MAP) === null) shell('input keyevent 4');
    }
    await reach(MAP);
  }],
  ['Settings', async () => {
    await tap(MAP);
    await reach(label('settings.title'));
  }],
  ['the language list says which one is chosen (T-215)', async () => {
    // One row that opens a list (2026-09-25); the list is closed with Cancel,
    // so nothing is chosen.
    await tap(new RegExp(`^${label('settings.section.language')}, `));
    await reach(label('common.cancel'));
    // ⚠ Only the rows named after a language: the first run counted the
    // recording switch and the quality options too ("8 rows, 3 checked").
    const names = new Set(Object.values(LANGUAGE_NAMES));
    const automatic = pattern('settings.language.auto');
    const rows = (await screen()).filter(
      (node) => node.checkable && (names.has(node.desc) || automatic.test(node.desc))
    );
    const checked = rows.filter((node) => node.checked);
    if (rows.length === 0 || checked.length !== 1) {
      throw new Error(`${rows.length} checkable rows, ${checked.length} checked`);
    }
    await tap(label('common.cancel'));
    return `${rows.length} radio rows, checked: ${checked[0].desc || checked[0].text}`;
  }],
  ['Privacy, and back', async () => {
    await tap(label('settings.about.privacy'), { scroll: true });
    await tap(label('common.done'));
    await reach(label('settings.title'));
  }],
  ['Licences, and back', async () => {
    await tap(label('settings.about.licences'), { scroll: true });
    await tap(label('common.done'));
    await reach(label('settings.title'));
  }],
  ['back to the map', () => tap(label('settings.a11y.backToMap')).then(() => reach(MAP))],
  ['the passport', () =>
    tap(pattern('passport.a11y.openWithCount', 'map.a11y.openPassport')).then(() =>
      reach(label('passport.title'))
    )],
  ['a stamp, its card, and Close', async () => {
    await tap(pattern('passport.a11y.stampCollected', 'passport.a11y.stampUncollected', 'passport.locked.a11y'));
    await reach(label('placeCard.showOnMap'));
    await tap(label('common.close'));
    await reach(label('passport.title'));
  }],
  ['the replay, if it is offered (T-217)', async () => {
    const watch = findNode(await screen(), label('replay.watch'));
    if (watch === null) return 'not offered: nothing drawable in the trip on show';
    await tap(label('replay.watch'));
    await reach(label('replay.close'), { timeoutMs: 20_000 });
    await tap(label('replay.close'));
    await reach(label('passport.title'));
    return 'opened and closed';
  }],
  ['back to the map', () => tap(label('passport.a11y.backToMap')).then(() => reach(MAP))],
];

const started = shell("date +'%m-%d %H:%M:%S.000'");
let pid = null;
let failed = false;

console.log(`Smoke test: ${PKG} on ${serial ?? 'the attached phone'}, labels in "${language}".\n`);

for (const [name, step] of STEPS) {
  let note = '';
  try {
    // A step may return a sentence worth printing; anything else is not a note.
    const result = await step();
    note = typeof result === 'string' ? result : '';
    const now = shell(`pidof ${PKG}`);
    if (pid !== null && now !== pid) {
      throw new Error(`the process changed from ${pid} to ${now || 'none'}: it died and restarted`);
    }
    pid = now;
    const crashes = crashLines(adb('logcat', '-b', 'crash', '-d', '-T', started), PKG);
    if (crashes.length > 0) {
      throw new Error(`crashed: ${crashes.join(' | ')}`);
    }
    console.log(`  ✔ ${name}${note ? `: ${note}` : ''}`);
  } catch (error) {
    failed = true;
    console.log(`  ✖ ${name}: ${error.message}`);
    break;
  }
}

console.log(failed ? '\nFAILED. Do not hand this build to anyone.' : '\nEvery screen opened, nothing crashed.');
process.exit(failed ? 1 : 0);

/**
 * Which language this phone is asking for (T-160).
 *
 * The impure half of `languages.ts`, and the only file here that imports Expo —
 * the same split as `stampRules`/`stampAwards` and `movementPolicy`/`samplingGate`
 * (CLAUDE.md). Everything about *choosing* a language is pure and tested; this
 * only fetches the tags and remembers the answer.
 *
 * ⚠ **Read once per launch, deliberately.** `expo-localization` documents that on
 * Android a user can change language without restarting the app, and suggests
 * re-reading on foreground. This app does not: a string set changing underneath a
 * screen the user is mid-way through is worse than a language that updates on
 * next launch, and D-011 caps how much this app is allowed to surprise anybody.
 * The OS restarts the process on a system language change often enough in
 * practice.
 *
 * ⚠ **Needs a native rebuild.** `expo-localization` is a config plugin, so it
 * only exists after `npx expo prebuild` — adding it to `package.json` alone gives
 * a module that throws at runtime.
 */

import { getLocales } from 'expo-localization';

import { FALLBACK_LANGUAGE, languageFor, type Language } from './languages.ts';

let cached: Language | null = null;

/**
 * The language to render in.
 *
 * Never throws: a device that cannot answer gets English rather than a crash on
 * the first frame, which is the one place a failure would be most visible and
 * least explicable.
 */
export function deviceLanguage(): Language {
  if (cached !== null) {
    return cached;
  }
  try {
    const tags = getLocales().map((locale) => locale.languageTag);
    cached = languageFor(tags);
  } catch {
    cached = FALLBACK_LANGUAGE;
  }
  return cached;
}

/** Tests and the workbench only — the app never changes language at runtime. */
export function overrideLanguageForTesting(language: Language | null): void {
  cached = language;
}

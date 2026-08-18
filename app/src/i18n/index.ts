/**
 * The one import a **screen** needs (T-160).
 *
 * `t('map.startWalk')` and `n('passport.collected', 3)` — the language comes from
 * the device and no screen passes it around, because a language that varies per
 * component is one that will eventually disagree with itself.
 *
 * ⚠⚠ **PURE MODULES MUST NOT IMPORT THIS FILE.**
 * ----------------------------------------------
 * `t()` reaches the device through `deviceLocale.ts`, which imports
 * `expo-localization`. Anything under Node's own test runner — `healthCheckPolicy`,
 * `stampConfirmation`, `placeCard`, `tripEnd` — would stop being runnable the
 * moment it imported this, and the failure arrives as a module-resolution error
 * in a test that has nothing to do with language.
 *
 * **Those modules take a `Language` parameter instead**, the same way they already
 * take `nowMs` rather than calling the clock. They import `translate` and `STRINGS`
 * directly and stay pure; the impure caller passes `deviceLanguage()` in. That is
 * the split CLAUDE.md describes for `stampRules`/`stampAwards` and
 * `movementPolicy`/`samplingGate`, applied to language.
 */

import { deviceLanguage } from './deviceLocale.ts';
import { PLURALS, STRINGS, type PluralKey, type StringKey } from './strings.ts';
import { plural, translate, type Values } from './translate.ts';

/** A translated string. */
export function t(key: StringKey, values?: Values): string {
  return translate(STRINGS[key], deviceLanguage(), values);
}

/** A translated string that depends on a count. `count` is passed in for you. */
export function n(key: PluralKey, count: number, values?: Values): string {
  return plural(PLURALS[key], count, deviceLanguage(), values);
}

export { deviceLanguage } from './deviceLocale.ts';
export { LANGUAGES, type Language } from './languages.ts';

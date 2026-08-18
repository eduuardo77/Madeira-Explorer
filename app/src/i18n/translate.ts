/**
 * Looking a string up, and the two things that make translations rot (T-160).
 *
 * THE CATALOGUE IS KEYED BY STRING, NOT BY LANGUAGE, AND THAT IS THE POINT
 * ------------------------------------------------------------------------
 * The obvious shape is one object per language:
 *
 *     { en: { greeting: 'Hello' }, pt: { greeting: 'Olá' } }
 *
 * ⚠ It rots silently. Somebody adds an English string, ships, and the Portuguese
 * object is simply missing a key nobody looks at — the failure is invisible in
 * the diff and invisible in the app until a Portuguese user sees English.
 *
 * So the catalogue is keyed the other way round (`strings.ts`):
 *
 *     { greeting: { en: 'Hello', pt: 'Olá', de: 'Hallo' } }
 *
 * **You cannot add a string without looking at the empty slots**, the diff shows
 * all three together, and `i18n.test.ts` fails the build if one is missing. Same
 * principle as `brand.test.ts`: a rule the build enforces rather than a habit.
 *
 * Pure: no Expo, no device, no React. `deviceLocale.ts` is the impure half.
 */

import { FALLBACK_LANGUAGE, type Language } from './languages.ts';

/** One string in every language the app speaks. */
export type Phrase = Record<Language, string>;

/** A phrase with separate singular and plural forms. */
export type PluralPhrase = { one: Phrase; other: Phrase };

/**
 * Values substituted into `{placeholders}`.
 *
 * Numbers are formatted by the caller, not here: this module has no locale-aware
 * number formatting and pretending otherwise would produce `1.234,5` in the wrong
 * places.
 */
export type Values = Readonly<Record<string, string | number>>;

/** `{name}` → the value. An unknown placeholder is left alone rather than blanked. */
export function interpolate(text: string, values: Values = {}): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole
  );
}

/**
 * The string for a language.
 *
 * ⚠ Falls back to English rather than to the key. A user seeing
 * `onboarding.welcome.title` has been failed twice — once by the missing
 * translation and once by the app admitting it in public. `i18n.test.ts` is what
 * stops the fallback ever being needed.
 */
export function translate(phrase: Phrase, language: Language, values?: Values): string {
  const text = phrase[language] ?? phrase[FALLBACK_LANGUAGE];
  return interpolate(text, values);
}

/**
 * Singular or plural.
 *
 * ⚠ **A simple one/other split, which is correct for English, Portuguese and
 * German and for nothing else.** Portuguese and German both treat exactly 1 as
 * singular; Russian, Polish and Arabic do not, and adding any of them means
 * replacing this function rather than adding a branch. `languages.ts` says the
 * same thing where the languages are listed.
 *
 * ⚠ **Zero takes the plural** in all three — "0 places", "0 lugares", "0 Orte".
 */
export function plural(
  phrase: PluralPhrase,
  count: number,
  language: Language,
  values?: Values
): string {
  const form = Math.abs(count) === 1 ? phrase.one : phrase.other;
  return translate(form, language, { count, ...values });
}

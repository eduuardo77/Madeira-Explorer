/**
 * The app's own labels, in the phone's language, for scripts that drive it by
 * what is on screen (T-222, T-263): a control is found by the catalogue string
 * a screen reader would read, so a reworded label cannot leave a script behind.
 */

import { PLURALS, STRINGS } from '../../app/src/i18n/strings.ts';

/** The catalogue language the phone shows, from its locale. */
export function phoneLanguage(shell) {
  const locale = shell('getprop persist.sys.locale') || shell('getprop ro.product.locale');
  return ['pt', 'de'].find((code) => locale.startsWith(code)) ?? 'en';
}

export function labels(language) {
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

  return { label, pattern };
}

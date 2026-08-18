/**
 * Which languages the app speaks, and why these three (T-160, D-073).
 *
 * WHY LOCALISE AT ALL — IT IS THE MARKETING PLAN'S BIGGEST FREE LEVER
 * -------------------------------------------------------------------
 * Madeira's visitors are **Portuguese 20.3%, British 14.9%, German 14.8%** of
 * overnight stays. Google Play localises a store listing per language for
 * nothing and runs five localised experiments at once — but `docs/marketing-plan.md`
 * §6 found the lever blocked: **a German listing pointing at an English-only app
 * is the mismatch that causes an uninstall**, which is Play's most heavily
 * weighted negative ranking signal. So the app comes first, the listing second.
 *
 * ⚠ **Portuguese is not optional here.** An app made in Madeira that cannot speak
 * Portuguese is a strange thing to hand a Portuguese visitor, and they are the
 * largest single group.
 *
 * WHY NOT MORE
 * ------------
 * French, Dutch and the Nordics are each a few percent. Every language added is a
 * permanent maintenance obligation on a solo project — every new string must be
 * written three, then six, then nine times — and an unmaintained translation
 * rots into something worse than English. Three is what the visitor numbers
 * actually justify.
 *
 * ⚠ **The plural rules below only hold for these three.** English, Portuguese and
 * German all use a simple one/other split. Adding Russian, Polish or Arabic means
 * replacing `plural()`, not extending this list.
 */

/** The languages the app ships. `en` is the base and the fallback. */
export const LANGUAGES = ['en', 'pt', 'de'] as const;

export type Language = (typeof LANGUAGES)[number];

/** The language used when the device asks for one we do not have. */
export const FALLBACK_LANGUAGE: Language = 'en';

/**
 * Which of our languages a device locale maps to.
 *
 * ⚠ **Matched on the language subtag only, never the full tag.** `pt-BR`,
 * `pt-PT` and plain `pt` all get Portuguese; `de-AT`, `de-CH` and `de` all get
 * German. Regional variants are a distinction this app has no content for, and
 * refusing `pt-BR` because the strings were written in European Portuguese would
 * hand a Brazilian visitor English instead — which is worse in every way.
 */
export function languageFor(
  deviceTags: readonly string[],
  available: readonly Language[] = LANGUAGES
): Language {
  for (const tag of deviceTags) {
    if (typeof tag !== 'string') {
      continue;
    }
    const subtag = tag.toLowerCase().split(/[-_]/)[0];
    const hit = available.find((language) => language === subtag);
    if (hit !== undefined) {
      return hit;
    }
  }
  return FALLBACK_LANGUAGE;
}

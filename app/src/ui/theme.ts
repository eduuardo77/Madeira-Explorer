/**
 * Visual constants.
 *
 * These encode the accessibility decisions from D-015 as values rather than
 * good intentions, because the dark aesthetic and the "an 80-year-old must be
 * able to use it" goal are in genuine tension and the aesthetic will win by
 * default unless the numbers say otherwise.
 *
 * The three rules that matter:
 *   1. Minimum tap target is 60dp, not the usual 44.
 *   2. Never differentiate meaning by hue alone — always brightness and/or
 *      weight as well. This covers colour vision deficiency for free.
 *   3. Recessive does not mean invisible. Unvisited roads and secondary text
 *      stay legible mid-grey, never near-black, and must survive being read in
 *      bright Madeiran sunlight.
 */

export const colors = {
  /** Page background. Dark, but not pure black — pure black flares in sunlight. */
  background: '#12191F',
  /** Cards and grouped rows. */
  surface: '#1B2A33',
  surfaceRaised: '#243743',

  /** Primary text. High contrast against `background`. */
  text: '#E8EEF2',
  /**
   * Secondary text. Deliberately mid-grey rather than the dim grey a designer
   * would reach for — see rule 3.
   */
  textMuted: '#A7B8C4',

  border: '#314856',

  /** Status colours. Always paired with a text label, never used alone. */
  good: '#7FD1A3',
  warn: '#E8C468',
  bad: '#F08C7A',

  action: '#5FA8D3',
  actionText: '#0C1318',
} as const;

/** Minimum tap target, in dp. D-015: 60, not 44. */
export const MIN_TAP_TARGET = 60;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * Base sizes. Every Text in the app should allow the system font scale to
 * multiply these — React Native does that by default, and nothing should set
 * `allowFontScaling={false}` (CONTEXT §6.5).
 */
export const fontSize = {
  small: 14,
  body: 17,
  title: 22,
  hero: 48,
} as const;

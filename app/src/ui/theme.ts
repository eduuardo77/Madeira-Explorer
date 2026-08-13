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
 *
 * IT FOLLOWS iOS CONVENTIONS, AND D-054 SAYS WHY
 * ----------------------------------------------
 * The project lead asked for *"the iOS look and feel"* (2026-08-13). The parts
 * of that which are actually portable are **structure, proportion and
 * restraint**, not Apple's assets: neutral greys rather than a tinted dark, a
 * 34 pt large title, grouped inset sections with the label *outside* the card,
 * sheets with generous corner radii, and plain tinted text for secondary
 * actions instead of outlined buttons.
 *
 * ⚠ **Where iOS and D-015 disagree, D-015 wins, and here is the one place they
 * do.** Apple's filled button in dark mode is white on systemBlue `#0A84FF`,
 * which measures **3.65:1** — under this project's 5:1 floor for text read
 * outdoors. So the primary button keeps the inverted construction: a light
 * blue with a near-black label. It is recognisably the same idea and it is
 * legible in sunlight, which the original is not.
 *
 * The typeface is deliberately **not** shipped. On iOS this is SF Pro because
 * that is the system font; on Android it is Roboto. Bundling one font for both
 * would replace the right typeface on the platform the project lead is asking
 * to imitate.
 */

export const colors = {
  /**
   * Page background.
   *
   * ⚠ Neutral, not blue-tinted, and that single change is most of what made
   * the old palette read as "a dark app somebody built" rather than as a
   * system. iOS's dark mode is grey on grey; the tint was ours.
   *
   * Near-black rather than iOS's true `#000000`: pure black flares under a
   * Madeiran midday sun and this app is read outdoors (D-015, CONTEXT §6.5).
   */
  background: '#0E0E10',
  /** Grouped cards and rows — iOS `secondarySystemBackground`, near enough. */
  surface: '#1C1C1E',
  surfaceRaised: '#2C2C2E',

  /** Primary text. iOS uses pure white in dark mode and so does this. */
  text: '#FFFFFF',
  /**
   * Secondary text. Deliberately mid-grey rather than the dim grey a designer
   * would reach for — see rule 3. Apple's `secondaryLabel` is white at 60%,
   * which lands close to this; this value is the one that clears 5:1 on
   * `surfaceRaised` as well, which theirs does not.
   */
  textMuted: '#A0A0A8',

  /**
   * Outlines and separators.
   *
   * ⚠ Was `#314856`, which measured **1.85:1** against `background` — below
   * even WCAG's 3:1 floor for a meaningful UI boundary, and this colour draws
   * the outline of the settings rows, which *are* the tap targets. D-015 says
   * accessibility beats aesthetics, so it was lightened until it passed
   * against both surfaces it is drawn on (T-113).
   */
  border: '#6E6E73',

  /** Status colours. Always paired with a text label, never used alone. */
  good: '#30D158',
  warn: '#FFD60A',
  bad: '#FF6961',

  /**
   * The primary button's fill, with a near-black label on it.
   *
   * ⚠ Inverted relative to iOS on purpose — see the header. White on
   * systemBlue is 3.65:1 and this project's floor for text is 5.
   */
  action: '#5AA9FF',
  actionText: '#0A0A0C',

  /**
   * Tinted text for a secondary action — iOS's plain button, which carries no
   * border and no fill.
   *
   * A separate value from `action` because it is read *as text on a dark
   * surface*, the opposite direction, and needs its own measurement: 7.86:1 on
   * the background, 6.93:1 on a card.
   */
  tint: '#5AA9FF',
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
  /** iOS's own body size, which this already was. */
  body: 17,
  title: 22,
  /** The iOS large title: the screen says its own name, once, in 34 pt bold. */
  largeTitle: 34,
  hero: 48,
} as const;

/**
 * Corner radii.
 *
 * Bigger than a designer's instinct on purpose: iOS rounds hard, and a 14 pt
 * card next to a 22 pt sheet is most of what makes the hierarchy read without
 * a single line of chrome.
 */
export const radius = {
  /** Buttons and controls. */
  control: 12,
  /** A grouped card in a list. */
  card: 14,
  /** Anything that behaves like a sheet — the place card. */
  sheet: 22,
  /** Fully round: the map's circular chrome, and pill buttons. */
  pill: 999,
} as const;

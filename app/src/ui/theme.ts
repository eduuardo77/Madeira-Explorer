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

/**
 * The floating controls that sit **on the map**, per map style (T-112).
 *
 * ⚠ WHY THE APP'S PALETTE CANNOT SERVE THIS, FOUND BY LOOKING 2026-08-17
 * ---------------------------------------------------------------------
 * Everything above is a **dark** palette — this is a dark app, and every screen
 * in it is dark. The map is the exception: the user picks its style, and on the
 * light map `colors.surface` (`#1C1C1E`) drew the settings control as a **solid
 * near-black disc** — the heaviest, darkest object on a pale map, and therefore
 * the first thing the eye lands on. Design brief §3.2 asks for the opposite in as
 * many words: *the least shouty thing on the screen*. Its 15.36:1 against
 * Google's light map was being read as a pass when it was actually the symptom.
 *
 * So map chrome follows the map, which is what every maps app on either platform
 * does: a white control on the light map, a dark one on the dark map. The glyph
 * inverts with it. Nothing here changes the app's own screens.
 *
 * ⚠ The dark map still needs the hairline (`border`) that T-112 added: the dark
 * circle measures 1.13:1 against the night ground, so its *edge* is what makes it
 * findable. The light map needs no border — a white disc on a pale map is found
 * by its shadowless contrast, and an outline there was the most Android thing on
 * the screen.
 *
 * Held to the contrast floors by `contrast.test.ts`.
 */
export const mapChrome = {
  light: {
    /** The circle or pill. White, like Apple Maps' floating controls. */
    surface: '#FFFFFF',
    /** The glyph or label on it. Near-black, so it reads at a glance. */
    content: '#1C1C1E',
    /**
     * ⚠ **No border, and therefore a shadow — this is not a style flourish.**
     *
     * White on Google's light land (~`#F2EFE9`) measures about **1.06:1**. The
     * disc is legible *inside* itself and nearly invisible *against the map*, so
     * something has to separate the two. An outline would do it and looks like
     * the Android control this screen already removed once (§3.2); elevation is
     * what every floating map control on either platform uses, and it is why
     * they read as sitting above the map rather than being drawn on it.
     *
     * ⚠ **A shadow's contrast cannot be measured**, so no test can hold this the
     * way the colour pairs are held. T-065 — outdoors, at arm's length — is the
     * judge of whether a white control is findable on a sunlit map.
     */
    border: null,
    elevation: 3,
  },
  dark: {
    surface: '#1C1C1E',
    content: '#FFFFFF',
    /** 1.13:1 against the night ground, so the *edge* is what finds it. */
    border: '#6E6E73',
    /** No shadow: a dark shadow under a dark control on dark ground is nothing. */
    elevation: 0,
  },
} as const;

/**
 * Settings, which is light while every other screen is dark (T-168, D-080).
 *
 * ⚠ **THIS IS THE PROJECT LEAD'S CALL, MADE WITH THE APP IN THEIR HAND**
 * (2026-08-22): *"I prefer light colour settings"*, against the reference app's
 * own settings screen. It is a deliberate exception, not a drift — the map
 * already inverts its chrome with the map style (`mapChrome` above), so this app
 * was never uniformly dark; what is new is a *screen* that is light.
 *
 * ⚠ **WHY A SECOND PALETTE RATHER THAN A `light` VARIANT OF `colors`.** Every
 * value above is measured against the dark surfaces it is drawn on, and the
 * contrast floors are asymmetric: `action` (`#5AA9FF`) is 7.86:1 on the dark
 * background and **2.6:1 on white**, so reusing it would have produced a blue
 * action row nobody could read outdoors — the exact failure `contrast.test.ts`
 * was written for, arriving through the door marked "reuse".
 *
 * ⚠ **AND WHY THESE BLUES AND REDS ARE NOT APPLE'S.** iOS system blue
 * (`#007AFF`) is **4.02:1** on white and system red (`#FF3B30`) is 3.55:1 —
 * both under this project's 5:1 floor for text read in Madeiran sun (D-015).
 * The values here are the same hues carried down until they pass. They will
 * look slightly darker than the reference app beside it; that is the trade
 * D-015 already decided.
 *
 * Held by `contrast.test.ts`, on both surfaces each colour is drawn on.
 */
export const settingsLight = {
  /** The page behind the cards — iOS `systemGroupedBackground`. */
  background: '#F2F2F7',
  /** A grouped card. White, so the rows read as raised out of the page. */
  surface: '#FFFFFF',
  /** Primary text. Near-black rather than black, matching the dark palette. */
  text: '#1C1C1E',
  /**
   * Section headers and the footnotes under each card.
   *
   * ⚠ Darker than the grey a designer reaches for: 5.94:1 on the page and
   * 6.63:1 on a card. D-015's third rule — recessive is not invisible — costs
   * about two shades here, and the footnotes are where this screen does its
   * explaining (design brief §5), so they are the last thing that may fade.
   */
  textMuted: '#5C5C63',
  /** Row separators and card outlines. 4.07:1 on the page — it bounds a tap target. */
  border: '#767676',
  /** A tinted action row: *Open phone settings*, *Privacy*. 5.78:1 on a card. */
  action: '#0B62CC',
  /** The destructive action, and only ever beside the word for it. 5.88:1 on a card. */
  danger: '#C8102E',
  /** The selected segment of a choice row — a tint, with the label carrying the meaning. */
  selected: '#E8F1FC',
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

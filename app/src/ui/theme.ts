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
   * ⚠ **LIGHT SINCE 2026-08-28**, on the project lead's instruction, taking the
   * reference app (WalkNYC) as the model. Everything below was a dark palette
   * and the header above still explains why the *structure* is what it is —
   * that part did not change. What changed is which end of the scale the app
   * sits at.
   *
   * Grey rather than white, so a white card has something to be a card
   * *against*. iOS calls this `systemGroupedBackground`, and the grouped-inset
   * list this screen family uses (D-054) only reads correctly on it.
   */
  background: '#F2F2F7',
  /** Grouped cards and rows. White, so the card is the figure and the page the ground. */
  surface: '#FFFFFF',
  /**
   * A control *inside* a card — a filled row, the segmented trough.
   *
   * ⚠ Darker than `surface`, where the dark palette had it lighter. "Raised"
   * described the dark theme's physics and is now the wrong word for the right
   * token: on a white card the only way to look like a distinct control is to
   * be slightly *recessed*. The name is kept because 165 call sites use it and
   * renaming it would be the change, not the fix.
   */
  surfaceRaised: '#E7E7EE',

  /**
   * Primary text. Near-black rather than pure `#000000`.
   *
   * The dark palette avoided pure black as a *background* because it flares in
   * Madeiran sun. As ink the reasoning is different and duller: pure black on
   * white is the one combination every phone's display pipeline sharpens
   * differently, and iOS's own label colour is not pure black either.
   */
  text: '#1C1C1E',
  /**
   * Secondary text.
   *
   * ⚠ Much darker than the grey a designer reaches for on white. Apple's
   * `secondaryLabel` lands near `#8E8E93`, which is **2.8:1** on a white card —
   * under WCAG's floor, let alone this project's. Rule 3 above says recessive
   * is not invisible, and this is the value that clears 5:1 on all three
   * surfaces, the white card included.
   */
  textMuted: '#5C5C63',

  /**
   * Outlines and separators.
   *
   * Held to 3:1 against both surfaces it is drawn on, because it outlines
   * settings rows and those rows *are* the tap targets — the same reasoning
   * that lightened it in the dark palette (T-113), pointed the other way.
   */
  border: '#84848A',

  /**
   * Status colours. Always paired with a text label, never used alone.
   *
   * ⚠ **All three had to be darkened well past their dark-palette values, and
   * `warn` had to stop being yellow.** On a light background a status colour is
   * read *as ink*, so the bright greens, yellows and reds that cleared 5:1
   * against near-black measure 1.3–2:1 against near-white. `#FFD60A` on this
   * page is 1.32:1 — invisible. There is no light-background yellow that
   * clears the floor, so the warning colour is a dark amber.
   */
  good: '#166934',
  warn: '#8A5A00',
  bad: '#C0271E',

  /**
   * The primary button's fill, with a white label on it.
   *
   * ⚠ **No longer inverted, and the reason it was inverted has gone.** The dark
   * palette used a light blue with a near-black label because white on iOS's
   * `#0A84FF` is 3.65:1, under this project's 5:1 floor. On a light page the
   * ordinary construction works — but only with a blue darker than Apple's:
   * white on `#007AFF` is 4.0:1 and still fails. This is 6.80:1.
   */
  action: '#0A5AAE',
  actionText: '#FFFFFF',

  /**
   * Tinted text for a secondary action — iOS's plain button, no border, no fill.
   *
   * The same blue as `action`, which the dark palette also did, and for the
   * same reason: it is the one hue the app uses for "you can press this". Held
   * to 5:1 as *text* on all three surfaces, which is what forced it darker than
   * the fill would have needed on its own.
   */
  tint: '#0A5AAE',

  /**
   * ⚠⚠ THE PASSPORT'S STAMP PAGE, AND IT IS STILL DARK. MEASURED, NOT CHOSEN.
   *
   * The thirty stamp colourways (D-046) are pale paper panels designed to sit
   * on a dark card. Measured against a light one, **all thirty fail** the 3:1
   * boundary floor — worst 1.07:1 on white. A sticker whose paper matches the
   * page behind it has no edge, and the passport is mostly stickers (D-058).
   *
   * The border cannot rescue it either: 8 of 30 borders fail on white. Only the
   * name band clears it (worst 6.08:1), and a band is not an edge.
   *
   * So the album page keeps the dark ground the artwork was drawn for, and the
   * rest of the app is light. That is a deliberate two-surface design, not an
   * oversight — and the alternative is re-deriving thirty colourways, which is
   * artwork and needs an eye (D-046, and nobody here can see).
   */
  stampPage: '#1C1C1E',
} as const;

/**
 * The floating controls that sit **on the map**, per map style (T-112).
 *
 * ⚠ WHY THE APP'S PALETTE CANNOT SERVE THIS, FOUND BY LOOKING 2026-08-17
 * ---------------------------------------------------------------------
 * ⚠ **THIS PARAGRAPH DESCRIBED A DARK APP UNTIL 2026-08-28.** Everything above
 * is now a **light** palette; only `stampPage` stayed dark, and only because the
 * measurement said so. The finding below still holds and is the reason this block
 * exists — it is just no longer the app's own palette that is the dark one.
 *
 * Map chrome does not follow the app's theme. It follows **the map**, which the
 * user picks (though the choice is hidden for now — `mapStylePreference.ts`). On the
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
    /**
     * Tinted text on a map control — the re-centre pill (2026-08-28).
     *
     * The page's `tint`, which is 5.69:1 on this white pill. ⚠ It is only
     * correct *here*: the same blue on the dark map's near-black pill is
     * 1.96:1, which is why this is a per-style value and not one constant.
     */
    link: '#0A5AAE',
  },
  dark: {
    surface: '#1C1C1E',
    content: '#FFFFFF',
    /**
     * 1.27:1 against the night ground, so the *edge* is what finds it.
     *
     * ⚠ **Was `#6E6E73`, which measured 2.63:1 — under the 3:1 floor for a
     * non-text control, and it shipped that way.** The test that was supposed to
     * catch it measured `colors.textMuted` instead of this value: while the app
     * was also dark the two greys were close enough to look like the same check,
     * and the real one was never made. It surfaced the day the app went light
     * (2026-08-28) and `textMuted` inverted — a failure in a control whose
     * colour had not changed at all. `googleNightStyle.test.ts` now measures
     * this token. 4.10:1 on the night land, 5.22:1 on the disc it outlines.
     */
    border: '#8E8E93',
    /** No shadow: a dark shadow under a dark control on dark ground is nothing. */
    elevation: 0,
    /**
     * ⚠ The light blue, not the page's tint. On this near-black pill the page's
     * `#0A5AAE` measures 1.96:1 and the label would be unreadable; this is
     * 6.93:1. Held by `contrast.test.ts` in both directions.
     */
    link: '#5AA9FF',
  },
} as const;

/**
 * The passport button, which is **on the map and therefore not page chrome**
 * (2026-08-28).
 *
 * ⚠ **This exists because the app went light and this button did not follow.**
 * It was filled with `colors.action`. That token is now a dark blue chosen to
 * carry white text on a white card — correct for a page, and 1.96:1 against the
 * night map, which is a primary action that disappears. The button never sat on
 * a page; `theme.ts` has said since 2026-08-17 that chrome follows the map, and
 * this control was the one place still reading from the app.
 *
 * ⚠ **One value for both map styles, not a pair.** The metals it is overpainted
 * with (`TIER_METAL`) are a single static table with no idea which map is
 * underneath, so a style-dependent blue would be the only part of the button
 * that changed — which is worse than either. This is the previous value,
 * unchanged, and it clears 3:1 on the night land at 5.44:1.
 *
 * ⚠⚠ **AND IT IS 2.14:1 ON GOOGLE'S LIGHT LAND, WHICH NO TEST HAS EVER
 * CHECKED.** That is pre-existing — this token did not change it — but it is
 * real, and the metals are worse (platinum is about 1.05:1). The button is large
 * and carries a shadow, which is how a filled control on a pale map is normally
 * found, and a shadow's contrast cannot be measured (see `mapChrome.light`). So
 * this is **T-065's** to settle: outdoors, at arm's length, in Funchal.
 */
export const mapButton = {
  fill: '#5AA9FF',
  /** Near-black, the same ink the metals take, and for the same reason. */
  ink: '#1C1C1E',
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

/**
 * The two icons on the settings rows (T-168).
 *
 * ⚠ **DRAWN, LIKE EVERY OTHER MARK IN THIS APP, AND FOR THE SAME REASON.**
 * `🛂` rendered as a blue rectangle and `⚙` read as a re-center button
 * (`SettingsMark`, `StampMark`, `RecenterMark`). A font glyph is a request that
 * somebody else's font make the design decision, and on this screen that
 * request has been refused twice already.
 *
 * ⚠ **AND NEITHER ONE EVER APPEARS ALONE.** D-015: an icon may reinforce a
 * word, never replace it. The pin sits beside *Record while the app is closed*;
 * the bin sits beside *Erase everything*, and the bin is also **not** what makes
 * that row destructive — the word is, the colour is second, and the
 * confirmation is what actually protects the data (T-125).
 *
 * Only two, deliberately. The reference app puts an icon on every row; this
 * screen puts one on the two rows that change something you cannot undo by
 * pressing again — which is the distinction worth drawing the eye to.
 */

import Svg, { Path, Rect } from 'react-native-svg';

/** The drawing grid for both marks. */
const CANVAS = 24;

/**
 * A map pin — the shape Android already uses for a location, so it needs no
 * explaining. Teardrop with a hole, drawn as one path with an even-odd fill so
 * the hole is genuinely transparent rather than painted in the card's colour
 * (which would smear the moment a row is pressed and the surface changes).
 */
export function PinMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M12 2.5c-3.6 0-6.5 2.9-6.5 6.5 0 4.9 6.5 12.5 6.5 12.5s6.5-7.6 6.5-12.5c0-3.6-2.9-6.5-6.5-6.5zM12 6.6a2.6 2.6 0 110 5.2 2.6 2.6 0 010-5.2z"
        fill={color}
        fillRule="evenodd"
      />
    </Svg>
  );
}

/**
 * A waste bin. Lid, body, two staves.
 *
 * ⚠ Straight-sided rather than tapered: at 20 dp a taper of two units reads as
 * a wobble, not as a bin.
 */
export function TrashMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* The lid, and the handle above it. */}
      <Path
        d="M4 6.4h16M9.5 6.4V4.6h5v1.8"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      {/* The body. */}
      <Path
        d="M6.2 8.2h11.6l-1 11.2a1.6 1.6 0 01-1.6 1.4H8.8a1.6 1.6 0 01-1.6-1.4z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Two staves, so the body is not an empty box. */}
      <Rect x={10} y={11} width={1.6} height={6} rx={0.8} fill={color} />
      <Rect x={12.6} y={11} width={1.6} height={6} rx={0.8} fill={color} />
    </Svg>
  );
}

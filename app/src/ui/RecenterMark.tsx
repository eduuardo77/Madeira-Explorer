/**
 * The re-center icon, drawn (T-167).
 *
 * ⚠ **A NAVIGATION ARROW, NOT A CROSSHAIR — AND THIS SCREEN HAS FORM.**
 * Twice now a control here has been misread as a re-center button: the `🛂`
 * passport glyph, and then the `⚙` gear, which `SettingsMark` was drawn to
 * fix. Both were mistaken for *this* control before this control existed —
 * which is a strong hint about what the eye expects on a map screen, and a
 * reason to make the real one unmistakable now that it is here.
 *
 * So: the filled arrow every maps app uses for "where I am", pointing
 * north-east, with a notch cut into its tail. Not a crosshair — Android's own
 * my-location button is a crosshair, and this app deliberately turns that
 * button off (`myLocationButtonEnabled: false`) to draw its own; two
 * crosshairs, one of them ours, would be the same confusion from the other
 * direction.
 *
 * ⚠ It is never alone: the pill beside it carries the word *Re-center* in the
 * user's language (D-015 — minimal is not unlabelled). If this drawing ever
 * ends up as the whole control, that is a bug.
 *
 * Geometry lives here rather than in a pure module for the same reason
 * `SettingsMark`'s does: no data drives it and no second renderer has to agree
 * with it.
 */

import Svg, { Path } from 'react-native-svg';

/** The drawing grid. Everything below is in these units. */
const CANVAS = 24;

/**
 * The arrow, as one closed path: tip at the top-right, a wide tail across the
 * bottom-left, and a notch pushed up into the middle of that tail.
 *
 * The notch is what stops it reading as a paper plane or a triangle at 20 dp —
 * it gives the shape the concave tail that says *cursor*.
 */
const ARROW = 'M20 4 L4.6 10.8 L11.2 13.4 L13.4 20 Z';

export default function RecenterMark({
  /** Drawn square, in dp. */
  size,
  /** The single ink. The surface underneath decides it, not this component. */
  color,
}: {
  size: number;
  color: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      // Decorative: the pill around it carries the accessible name, and a
      // second label here would make a screen reader say it twice.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d={ARROW}
        fill={color}
        // Rounded joins so the tip does not come to a needle point at small
        // sizes, where a sharp corner anti-aliases into a grey smear.
        strokeLinejoin="round"
        stroke={color}
        strokeWidth={1.2}
      />
    </Svg>
  );
}

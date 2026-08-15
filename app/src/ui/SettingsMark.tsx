/**
 * The settings icon, drawn (T-146).
 *
 * ⚠ THIS IS THE SECOND TIME A GLYPH HAS BEEN MISREAD ON THIS SCREEN
 * -----------------------------------------------------------------
 * The passport button used to be `🛂`, which rendered as a blue rectangle at
 * 36 dp, and the project lead asked what "the button to centre the map" did.
 * It was replaced by `StampMark`, a drawn path. The gear beside it stayed a
 * text `⚙` — and on 2026-08-15 the project lead said the settings icon *"looks
 * like a re-center button"*. The same failure, on the same screen, in the same
 * corner, reported in almost the same words.
 *
 * A font glyph is not a design decision, it is a request that somebody else's
 * font make one. At small sizes Android's gear is a dense ring of teeth that
 * anti-aliases into a circle with a dot in it — which is precisely what a
 * "centre on me" control looks like on every map app the user has.
 *
 * SO: SLIDERS, NOT A GEAR
 * ----------------------
 * Three horizontal rails with handles at different positions. It cannot be
 * confused with a crosshair, a target or a locate button, because it has no
 * radial symmetry at all — that is the property being bought, not the style.
 * It is also the icon iOS uses for adjustment controls, which is where the rest
 * of this interface takes its cues from (D-054).
 *
 * The geometry is here rather than in a pure module because there is nothing to
 * decide: no data drives it, and unlike the stamp artwork there is no second
 * renderer that has to agree with it. What it does share with `StampMark` is
 * that it is *drawn by us*, which is the actual lesson.
 */

import Svg, { Circle, Line } from 'react-native-svg';

/** The drawing grid. Everything below is in these units. */
const CANVAS = 24;

/** Where the three rails sit, and where each handle sits on its rail. */
const RAILS = [
  { y: 7, handleX: 15 },
  { y: 12, handleX: 9 },
  { y: 17, handleX: 16 },
] as const;

const INSET = 4;
const HANDLE_RADIUS = 2.4;

export default function SettingsMark({
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
      // Decorative: the control around it carries the accessible name, and a
      // second label here would make a screen reader say it twice.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {RAILS.map((rail) => (
        <Line
          key={rail.y}
          x1={INSET}
          y1={rail.y}
          x2={CANVAS - INSET}
          y2={rail.y}
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}

      {/* The handles are filled discs, drawn after the rails so they sit on
          top. A ring with a hole would let the rail show through the middle,
          which at 20 dp reads as a smudge rather than as a control. */}
      {RAILS.map((rail) => (
        <Circle
          key={`handle-${rail.y}`}
          cx={rail.handleX}
          cy={rail.y}
          r={HANDLE_RADIUS}
          fill={color}
        />
      ))}
    </Svg>
  );
}

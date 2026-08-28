/**
 * The glyph on the walk button (2026-08-28).
 *
 * ⚠ **Not artwork, and deliberately not given the pure-module-plus-second-
 * renderer treatment** that `StampMark` and the stamps get. That rule exists
 * because nobody here can see, and a mark that passed every geometry test still
 * rendered as a crosshair. A triangle and a square do not have that failure
 * mode: there is nothing to get subtly wrong, and no preview page would tell
 * anybody anything they cannot read from the two path strings below.
 *
 * ⚠ **The glyph never carries the meaning on its own** (D-015). The button says
 * *Start walk* or *Stop walk* in words beside it, in the user's language, and
 * the fill changes too. This is the third signal, not the first.
 */

import Svg, { Path, Rect } from 'react-native-svg';

export default function WalkMark({
  /** Drawn square, in dp. */
  size,
  /** Stop is a square; start is a triangle pointing the way you are going. */
  stopped,
  /** The single ink. The fill underneath decides it, not this component. */
  color,
}: {
  size: number;
  stopped: boolean;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {stopped ? (
        // Rounded rather than sharp: a hard square at this size reads as a
        // rendering artefact next to round type.
        <Rect x={6} y={6} width={12} height={12} rx={2.5} fill={color} />
      ) : (
        // A play triangle, nudged right so it looks centred — a triangle's
        // visual centre is not its bounding box's, and centring the box makes
        // it read as sitting too far left.
        <Path d="M9 5.5 L19 12 L9 18.5 Z" fill={color} />
      )}
    </Svg>
  );
}

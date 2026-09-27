/**
 * The warning sign on the map's notice (D-095, 2026-09-27).
 *
 * WalkNYC's shape, which the project lead chose: a filled triangle with the
 * exclamation cut out of it in the banner's own colour, so it reads as one
 * mark at 22 dp rather than a triangle with a line in it.
 *
 * ⚠ Like `RecentreMark`, not artwork: one path and no subtlety for a preview
 * page to reveal. It never carries the meaning alone (D-015): the notice's
 * words say what is wrong.
 */

import Svg, { Path, Rect } from 'react-native-svg';

export default function WarningMark({
  /** Drawn square, in dp. */
  size,
  /** The triangle. */
  color,
  /** The exclamation: the banner underneath, so it reads as cut out. */
  cutout,
}: {
  size: number;
  color: string;
  cutout: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5 L23 21.5 L1 21.5 Z" fill={color} />
      <Rect x={11} y={9} width={2} height={7} fill={cutout} />
      <Rect x={11} y={17.5} width={2} height={2} fill={cutout} />
    </Svg>
  );
}

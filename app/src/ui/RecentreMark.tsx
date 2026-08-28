/**
 * The arrow on the re-centre control (2026-08-28).
 *
 * The navigation arrow every maps app uses for "where I am" — a chevron-tailed
 * triangle rather than a plain one, which is what stops it reading as a *play*
 * button beside the walk control directly below it. Those two glyphs sit within
 * a thumb's width of each other, so the difference is not decoration.
 *
 * ⚠ Like `WalkMark`, not artwork and deliberately not given the pure-module
 * treatment: there is one path here and no subtlety for a preview page to
 * reveal. And it never carries the meaning alone (D-015) — the word *Re-center*
 * is beside it, in the user's language.
 */

import Svg, { Path } from 'react-native-svg';

export default function RecentreMark({
  /** Drawn square, in dp. */
  size,
  /** The single ink. The pill underneath decides it, not this component. */
  color,
}: {
  size: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Tip at the top-right, tail notched into the bottom-left, so it reads
          as pointing rather than as a solid wedge. */}
      <Path d="M21 3 L3 10.5 L10.6 13.4 L13.5 21 Z" fill={color} />
    </Svg>
  );
}

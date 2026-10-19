/**
 * The chevron on a row or button that leads somewhere (2026-10-19, review of
 * 16 Oct, desk C).
 *
 * It was the text character "›" (and "‹"), so its weight, size and height on
 * the line came from the font: thin and set low in the passport's trip rows,
 * different again in Settings, the trophy card, the trip viewer and the
 * privacy policy's sections. Drawn, it is the same mark everywhere and sits
 * centred on its row.
 *
 * ⚠ Like `RecentreMark`, one path and no subtlety for a preview page, so not
 * given the pure-module treatment. Never the meaning alone (D-015): the row or
 * the button's label says where it goes, and the mark is hidden from screen
 * readers wherever it sits.
 */

import Svg, { Path } from 'react-native-svg';

const PATHS = {
  right: 'M9 5 L16 12 L9 19',
  left: 'M15 5 L8 12 L15 19',
  down: 'M5 9 L12 16 L19 9',
  up: 'M5 15 L12 8 L19 15',
} as const;

export default function ChevronMark({
  /** Drawn square, in dp. */
  size,
  color,
  /** Which way it points: on (the default), back, or a section to open or close. */
  direction = 'right',
}: {
  size: number;
  color: string;
  direction?: 'left' | 'right' | 'up' | 'down';
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Path
        d={PATHS[direction]}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

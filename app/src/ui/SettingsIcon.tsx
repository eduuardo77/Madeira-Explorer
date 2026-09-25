/**
 * The small glyphs at the start of each Settings row (2026-09-25).
 *
 * The project lead found the compact Settings *"too bland, only text"*, and
 * pointed at WalkNYC again. Its rows each start with a small coloured glyph (a
 * blue pin for its recording, a red bin for erasing, a blue envelope for
 * contact), which is most of why its screen reads as a set of things rather
 * than a page of words. These are ours: drawn here, one path set each, so they
 * render the same on every phone and need no icon font.
 *
 * ⚠ **Decoration only** (D-015): every row says what it is in words, so the
 * glyph is hidden from screen readers and never the only signal.
 */

import type { ReactElement } from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type SettingsIconName =
  | 'language'
  | 'recording'
  | 'warning'
  | 'pause'
  | 'battery'
  | 'privacy'
  | 'licences'
  | 'contact'
  | 'send'
  | 'technical'
  | 'erase';

/** Drawn square, in dp. */
export const SETTINGS_ICON_SIZE = 24;

export default function SettingsIcon({ name, color }: { name: SettingsIconName; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  return (
    <Svg
      width={SETTINGS_ICON_SIZE}
      height={SETTINGS_ICON_SIZE}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {GLYPHS[name](color, stroke)}
    </Svg>
  );
}

type Stroke = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: 'none';
};

const GLYPHS: Record<SettingsIconName, (color: string, stroke: Stroke) => ReactElement> = {
  // A globe: the rim, one meridian, the equator.
  language: (_, s) => (
    <>
      <Circle cx={12} cy={12} r={9} {...s} />
      <Path d="M12 3c-2.8 3-2.8 15 0 18M12 3c2.8 3 2.8 15 0 18" {...s} />
      <Line x1={3} y1={12} x2={21} y2={12} {...s} />
    </>
  ),
  // A map pin, filled, as WalkNYC's recording row has.
  recording: (color) => (
    <>
      <Path d="M12 2.5c-3.9 0-7 3-7 6.8 0 5 7 12.2 7 12.2s7-7.2 7-12.2c0-3.8-3.1-6.8-7-6.8z" fill={color} />
      <Circle cx={12} cy={9.3} r={2.6} fill="#FFFFFF" />
    </>
  ),
  warning: (color, s) => (
    <>
      <Path d="M12 3.5L21.5 20h-19z" {...s} />
      <Line x1={12} y1={10} x2={12} y2={14} {...s} />
      <Circle cx={12} cy={17} r={1.1} fill={color} />
    </>
  ),
  pause: (color) => (
    <>
      <Rect x={6.5} y={5} width={3.8} height={14} rx={1.2} fill={color} />
      <Rect x={13.7} y={5} width={3.8} height={14} rx={1.2} fill={color} />
    </>
  ),
  battery: (color, s) => (
    <>
      <Rect x={3} y={7} width={16} height={10} rx={2} {...s} />
      <Rect x={20} y={10} width={1.6} height={4} rx={0.8} fill={color} />
      <Rect x={5.2} y={9.2} width={7.5} height={5.6} rx={1} fill={color} />
    </>
  ),
  privacy: (_, s) => (
    <>
      <Path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z" {...s} />
      <Path d="M8.8 12.2l2.2 2.2 4.2-4.4" {...s} />
    </>
  ),
  licences: (_, s) => (
    <>
      <Path d="M6 3h8l4 4v14H6z" {...s} />
      <Path d="M14 3v4h4M9 12h6M9 16h6" {...s} />
    </>
  ),
  contact: (_, s) => (
    <>
      <Rect x={3} y={5.5} width={18} height={13} rx={2} {...s} />
      <Path d="M3.5 7l8.5 6.5L20.5 7" {...s} />
    </>
  ),
  send: (_, s) => <Path d="M21 3L3 10.5l7.2 2.9L13 21zM10.2 13.4L21 3" {...s} />,
  technical: (_, s) => (
    <>
      <Path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5" {...s} />
    </>
  ),
  erase: (color) => (
    <>
      <Rect x={5} y={3.5} width={14} height={2.4} rx={1} fill={color} />
      <Rect x={9.5} y={2} width={5} height={2.4} rx={1} fill={color} />
      <Path d="M6.3 7.5h11.4l-1 12.2a1.8 1.8 0 0 1-1.8 1.6H9.1a1.8 1.8 0 0 1-1.8-1.6z" fill={color} />
    </>
  ),
};

/**
 * The drawing at the top of each first-run card (T-250, after the approved
 * sketches O1 to O3 in `tools/preview-unlock-options.mjs`).
 *
 * One frame for all of them, a soft disc, so the cards read as a set. The gold
 * line is the lit road (D-093), the thing the app is for, and it runs through
 * most of them on purpose.
 *
 * ⚠ Every gradient is defined inside the `<Svg>` that uses it: on Android a
 * fill naming another Svg's gradient draws black (HANDOFF, 2026-10-05).
 */

import type { ReactNode } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type ArtName = 'location' | 'always' | 'activity' | 'notifications' | 'keep-running' | 'ready' | 'warning';

const GOLD = '#F2A900';
const BLUE = '#0A5AAE';
const INK = '#1C1C1E';
const ROAD = '#C9CDD6';

/** Each disc's tint, light enough that the drawing on it keeps its contrast. */
const DISC: Record<ArtName, [string, string]> = {
  location: ['#EAF2FC', '#D5E5F8'],
  always: ['#FFF6DD', '#FDE7AE'],
  activity: ['#EAF6EC', '#D3EDD8'],
  notifications: ['#F3EEFB', '#E3D8F6'],
  'keep-running': ['#E8F6EC', '#CDEBD6'],
  ready: ['#E8F6EC', '#CDEBD6'],
  warning: ['#FFF1E0', '#FBDDB5'],
};

export default function OnboardingArt({ name, size }: { name: ArtName; size: number }) {
  const [from, to] = DISC[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={`disc-${name}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Circle cx={60} cy={60} r={58} fill={`url(#disc-${name})`} />
      {DRAWINGS[name]}
    </Svg>
  );
}

/** A map pin, its point at (x, y). */
function Pin({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Path d="M0 0c0 0-17-19-17-31a17 17 0 0 1 34 0C17-19 0 0 0 0z" fill={BLUE} />
      <Circle cx={0} cy={-31} r={6.5} fill="#FFFFFF" />
    </G>
  );
}

const DRAWINGS: Record<ArtName, ReactNode> = {
  // O1: a little street map, one road lit, and the pin where you stand.
  location: (
    <G>
      <Path d="M14 44h92M14 78h92M38 14v92M82 14v92" stroke={ROAD} strokeWidth={5} strokeLinecap="round" />
      <Path d="M20 96C34 90 36 78 50 78s22 0 32-10 10-24 22-30" stroke={GOLD} strokeWidth={7} fill="none" strokeLinecap="round" />
      <Pin x={60} y={70} scale={1.15} />
    </G>
  ),
  // O2: the phone in a pocket, the road still lighting up behind it.
  always: (
    <G>
      <Path d="M16 98C30 92 30 80 44 76" stroke={GOLD} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Path d="M16 98C30 92 30 80 44 76" stroke="#FFFFFF" strokeWidth={1.5} strokeDasharray="2 6" fill="none" strokeLinecap="round" />
      <Rect x={46} y={20} width={34} height={58} rx={6} fill={INK} />
      <Rect x={50} y={26} width={26} height={40} rx={2} fill="#B9D7EE" />
      <Path d="M52 58c6-5 10-1 14-8s6-6 8-5" stroke={GOLD} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M34 52h58l-5 44c-1 6-6 10-12 10H51c-6 0-11-4-12-10z" fill="#3B6EA5" />
      <Path d="M34 52h58" stroke="#2A5687" strokeWidth={3} />
      <Path d="M44 60h38" stroke="#F2D58A" strokeWidth={1.5} strokeDasharray="3 3" />
      <Circle cx={94} cy={30} r={13} fill={GOLD} />
      <Path d="M94 23v8l5 3" stroke="#FFFFFF" strokeWidth={2.6} fill="none" strokeLinecap="round" />
    </G>
  ),
  // Physical activity: a walker, a car, and one road between them.
  activity: (
    <G>
      <Path d="M18 86C40 86 44 64 64 64s28 4 40-6" stroke={GOLD} strokeWidth={6} fill="none" strokeLinecap="round" />
      <G transform="translate(22 30)">
        <Circle cx={12} cy={4} r={5} fill={INK} />
        <Path d="M12 11l-3 15 8 10M10 18l-8 6M13 16l9 6M9 26l-6 14" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>
      <G transform="translate(66 32)">
        <Path d="M2 20l5-11c1-3 3-4 6-4h16c3 0 5 1 6 4l5 11v10H2z" fill={BLUE} />
        <Path d="M10 9h22l3 9H7z" fill="#B9D7EE" />
        <Circle cx={11} cy={30} r={5} fill={INK} />
        <Circle cx={33} cy={30} r={5} fill={INK} />
      </G>
    </G>
  ),
  // Notifications: a bell, and the stamp it is announcing.
  notifications: (
    <G>
      <Path d="M50 30c-12 3-18 13-18 25v14l-6 9h56l-6-9V55c0-12-6-22-18-25a4 4 0 0 0-8 0z" fill="#6A4BB0" />
      <Path d="M48 82a8 8 0 0 0 16 0z" fill="#6A4BB0" />
      <G transform="translate(76 26) rotate(10)">
        <Rect x={-14} y={-14} width={28} height={28} rx={3} fill={GOLD} />
        <Rect x={-10} y={-10} width={20} height={20} rx={2} fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeDasharray="2 2" />
        <Path d="M-6 4l5-8 4 5 3-3 4 6z" fill="#FFFFFF" />
      </G>
    </G>
  ),
  // O3: a battery, charged, with the road still lit beside it.
  'keep-running': (
    <G>
      <Rect x={30} y={34} width={52} height={52} rx={9} fill="#FFFFFF" stroke="#2E7D32" strokeWidth={5} />
      <Rect x={82} y={50} width={7} height={20} rx={2.5} fill="#2E7D32" />
      <Rect x={37} y={41} width={38} height={38} rx={5} fill="#BFE6C8" />
      <Path d="M60 44l-12 18h10l-4 14 14-20H58z" fill={GOLD} stroke="#B97E00" strokeWidth={1} strokeLinejoin="round" />
      <Path d="M18 100c16-6 26-2 40-8s26-4 44-10" stroke={GOLD} strokeWidth={5} fill="none" strokeLinecap="round" />
    </G>
  ),
  // The last card: a tick over a lit road.
  ready: (
    <G>
      <Path d="M18 96c16-8 28-2 42-10s28-6 42-14" stroke={GOLD} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Circle cx={60} cy={50} r={26} fill="#2E7D32" />
      <Path d="M47 50l9 9 17-18" stroke="#FFFFFF" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </G>
  ),
  // The later prompts (downgrade): the road going dark.
  warning: (
    <G>
      <Path d="M18 92c14-8 24-4 36-10" stroke={GOLD} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Path d="M54 82c14-7 28-4 48-14" stroke={ROAD} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray="2 9" />
      <Pin x={60} y={64} scale={1} />
    </G>
  ),
};

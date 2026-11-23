/**
 * Draws `passport/islandMapArt.ts`: the main island's municipalities, lit
 * where the user has been, and a dot per place, gold where they have been.
 * The unlock sheet's island page (T-319).
 */

import Svg, { Circle, Path } from 'react-native-svg';
import type { IslandMap as IslandMapData } from '../passport/islandMapArt';
import { reward } from './theme';

const LAND = '#26232F';
const LAND_LIT = '#3A3020';
const COAST = '#4A4458';
const DOT = '#6E6880';

export default function IslandMap({ map }: { map: IslandMapData }) {
  return (
    <Svg width={map.width} height={map.height} viewBox={`0 0 ${map.width} ${map.height}`}>
      {map.regions.map((region) => (
        <Path key={region.id} d={region.d} fill={region.lit ? LAND_LIT : LAND} stroke={COAST} strokeWidth={0.6} />
      ))}
      {map.dots
        .filter((dot) => !dot.visited)
        .map((dot) => (
          <Circle key={dot.id} cx={dot.x} cy={dot.y} r={2.4} fill={DOT} />
        ))}
      {/* Gold last, so a visited place is never under a grey one. */}
      {map.dots
        .filter((dot) => dot.visited)
        .flatMap((dot) => [
          <Circle key={`${dot.id}-glow`} cx={dot.x} cy={dot.y} r={6.5} fill={reward.gold} opacity={0.25} />,
          <Circle key={dot.id} cx={dot.x} cy={dot.y} r={3.4} fill={reward.gold} />,
        ])}
    </Svg>
  );
}

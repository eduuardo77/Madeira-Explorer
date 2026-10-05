/**
 * An open padlock, drawn: an emoji would be a different picture on every
 * phone. Shared by the unlock sheet and a locked stamp's celebration (D-097).
 */

import Svg, { Path, Rect } from 'react-native-svg';
import { reward } from './theme';

export default function Padlock({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path d="M12 18V12a8 8 0 0 1 15.4-3" stroke={reward.gold} strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <Rect x={7} y={18} width={26} height={18} rx={4} fill={reward.gold} stroke={reward.goldDeep} strokeWidth={1.5} />
      <Rect x={18.6} y={23} width={2.8} height={7} rx={1.4} fill={reward.goldDeep} />
    </Svg>
  );
}

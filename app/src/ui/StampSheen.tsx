/**
 * The band of light over the trophy's stamp (T-236), on its own layer.
 *
 * A separate `Svg` over `StampArt`, so the stamp's drawing stays untouched. It
 * matches `StampArt`'s size, viewBox and hand-placed rotation exactly, and is
 * clipped to the stamp's cut outline, so the light never spills onto the card
 * behind. The stops are `stampSheen.ts`'s; the preview page draws the same
 * ones (`tools/lib/svg-render.mjs`).
 */

import Svg, { ClipPath, Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';
import { CANVAS, GLOW_PAD_UNITS, toPolygon, type StampDesign } from '../passport/stampArt';
import { sheenStops } from '../passport/stampSheen';

export default function StampSheen({
  id,
  design,
  size,
}: {
  /** Names the gradient and the clip; several stamps can be on one screen. */
  id: string;
  design: StampDesign;
  size: number;
}) {
  const pad = GLOW_PAD_UNITS;
  const gradientId = `sheen-${id}`;
  const clipId = `sheen-clip-${id}`;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`${-pad} ${-pad} ${CANVAS + 2 * pad} ${CANVAS + 2 * pad}`}
      style={{ position: 'absolute', transform: [{ rotate: `${design.tiltDeg}deg` }] }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={CANVAS} y2={CANVAS}>
          {sheenStops().map((stop, index) => (
            <Stop key={index} offset={stop.offset} stopColor="#FFFFFF" stopOpacity={stop.opacity} />
          ))}
        </LinearGradient>
        <ClipPath id={clipId}>
          <Polygon points={toPolygon(design.cutOutline)} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={CANVAS} height={CANVAS} fill={`url(#${gradientId})`} clipPath={`url(#${clipId})`} />
    </Svg>
  );
}

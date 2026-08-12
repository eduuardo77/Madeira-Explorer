/**
 * The passport mark, drawn (T-075).
 *
 * Like `StampArt.tsx`, this composes nothing: `passport/stampMark.ts` decides
 * the geometry and this turns it into one SVG path. The preview page draws the
 * same path, so what gets looked at is what ships.
 *
 * ⚠ `fillRule="evenodd"` is not decoration. The mark is one compound path —
 * outer ring, hole, centre impression — and without the even-odd rule it fills
 * as a solid blob with no hole, which is exactly the unreadable shape this
 * replaced.
 */

import Svg, { Path } from 'react-native-svg';
import { CANVAS, stampMarkPath, TILT_DEG } from '../passport/stampMark';

export default function StampMark({
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
      {/* Rotated on the path rather than on the `Svg`, so the tilt happens
          inside the viewBox and the corners cannot be clipped by it — the same
          trap `StampArt` documents, arrived at from the opposite direction. */}
      <Path
        d={stampMarkPath()}
        fill={color}
        fillRule="evenodd"
        transform={`rotate(${TILT_DEG} ${CANVAS / 2} ${CANVAS / 2})`}
      />
    </Svg>
  );
}

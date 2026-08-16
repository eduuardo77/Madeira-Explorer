/**
 * The share card, drawn (T-105d, D-063).
 *
 * `shareCard.ts` decides *what* is on the card; this puts it on screen through
 * `react-native-svg`, which was already a dependency. Presentational: a layout
 * in, pixels out, no database and no clock — so the workbench can mount it and
 * `tools/preview-souvenir.mjs` can draw the very same layout to a file.
 *
 * ⚠ **Rendered at full card size and scaled down for display.** `captureRef`
 * photographs the view as laid out, so a card laid out at phone width would be
 * shared at phone width — a 390 px image where a 1080 px one was intended. The
 * card is therefore always 1080 × 1920 and the *container* scales it, which
 * costs nothing: SVG has no resolution of its own.
 */

import { forwardRef } from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { CARD_HEIGHT, CARD_WIDTH, type ShareCard } from './shareCard';

export type ShareCardViewProps = {
  card: ShareCard;
  /**
   * How big to draw it on screen. The captured image is always full size —
   * see the note above — so this is presentation only.
   */
  displayWidth?: number;
};

/**
 * ⚠ A `View` wrapper with the ref on it, not the `Svg` itself: `captureRef`
 * wants a native view, and the SVG root is not one on every platform.
 */
const ShareCardView = forwardRef<View, ShareCardViewProps>(function ShareCardView(
  { card, displayWidth },
  ref
) {
  const scale = displayWidth === undefined ? 1 : displayWidth / CARD_WIDTH;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: CARD_WIDTH * scale,
        height: CARD_HEIGHT * scale,
        backgroundColor: card.background,
      }}
    >
      <Svg
        width={CARD_WIDTH * scale}
        height={CARD_HEIGHT * scale}
        viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
      >
        <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill={card.background} />

        {card.elements.map((element, index) =>
          element.kind === 'polyline' ? (
            <Polyline
              key={index}
              points={element.points.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none"
              stroke={element.colour}
              strokeWidth={element.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <SvgText
              key={index}
              x={element.x}
              y={element.y}
              fill={element.colour}
              fontSize={element.size}
              fontWeight={element.weight === 'bold' ? '700' : '400'}
              textAnchor={element.anchor}
            >
              {element.text}
            </SvgText>
          )
        )}
      </Svg>
    </View>
  );
});

export default ShareCardView;

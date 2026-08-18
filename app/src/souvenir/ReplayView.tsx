/**
 * One frame of the film, drawn (T-105e, OD-12).
 *
 * **This component decides nothing.** Where the camera points, what is drawn,
 * which stamps have landed and how long ago — all of it is `frame.ts`, which is
 * pure and tested. This walks that description and turns it into SVG, the same
 * way `StampArt` walks `stampArt.ts`.
 *
 * That split is what makes the replay and the video the same picture. When the
 * encoder lands (T-105b) it will sample the *same* `frameAt` and draw the same
 * elements; if this composed anything of its own, the film people watch in the
 * app and the film they post would quietly differ.
 *
 * PRESENTATIONAL ON PURPOSE
 * -------------------------
 * Props in, pixels out — no database, no clock, no playback state. That is what
 * lets the design workbench (`App.web.tsx`) scrub it frame by frame in a
 * browser and answer the question T-105b is stuck on: **is a 9:16 frame the
 * right shape for an east–west walk?** Nobody can answer that from a test.
 */

import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Category } from '../content/contentPack';
import type { Frame } from './frame';
import { projector } from './frame';
import { colors } from '../ui/theme';

/**
 * How long a stamp's arrival is animated for, in ms.
 *
 * ⚠ Unwatched. `composition.ts` spaces cues at least 350 ms apart, so a pop
 * longer than that would still be growing when the next one lands — which is
 * either a lively film or a mess, and only eyes can say which.
 */
const POP_MS = 400;

/** The trace, drawn over the ground. */
const TRACE_COLOUR = '#F1F7FF';

/**
 * A stamp's colour comes from its category, not from its place.
 *
 * The passport's artwork varies the colourway per place (`stampArt.ts`) because
 * there it is one sticker at 96 dp with its name underneath. Here it is a dot a
 * few pixels across with no room for a name, so the only thing it can usefully
 * encode is *what kind of place that was* — which is the same job D-015 gives
 * the emblem.
 */
const CATEGORY_COLOUR: Record<Category, string> = {
  viewpoint: '#5AA9FF',
  levada: '#30D158',
  village: '#FFD60A',
  beach: '#4CC9F0',
  landmark: '#B5179E',
};

export type ReplayViewProps = {
  frame: Frame;
  /** Drawn at this size, in dp. The film's own aspect is 9:16. */
  width: number;
  height: number;
  /**
   * The hero's caption, already formatted and translated.
   *
   * ⚠ Passed in rather than built here. Formatting a date needs a locale and a
   * calendar, and this file may not reach for either — it is drawn by the same
   * rule the rest of the souvenir follows, and `composition.ts` deliberately
   * hands on raw milliseconds for exactly this reason.
   */
  heroCaption?: string;
};

export default function ReplayView({
  frame,
  width,
  height,
  heroCaption,
}: ReplayViewProps) {
  const toPixel = projector(frame.bounds, width, height);

  const strokeWidth = Math.max(2, Math.round(width / 180));

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect width={width} height={height} fill={colors.background} />

      {/* ⚠ One path per stroke, never joined. The gap between two strokes is a
          recording blackout, and a line across it is a road nobody proved was
          taken (ARCHITECTURE §10). `frame.ts` keeps them apart; drawing them
          in one path here would undo that silently. */}
      {frame.strokes.map((stroke, index) => (
        <Path
          key={`stroke-${index}`}
          d={stroke
            .map(([lon, lat], i) => {
              const [x, y] = toPixel(lon, lat);
              return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(' ')}
          fill="none"
          stroke={TRACE_COLOUR}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {frame.stamps.map((stamp) => {
        const [x, y] = toPixel(stamp.lon, stamp.lat);
        // Grows from nothing and settles. The renderer owns this, which is why
        // `frame.ts` reports an age rather than a "just landed" flag.
        const grow = Math.max(0, 1 - stamp.ageMs / POP_MS);
        const radius = strokeWidth * 1.5 + grow * strokeWidth * 2;

        return (
          <Circle
            key={stamp.placeId}
            cx={x}
            cy={y}
            r={radius}
            fill={CATEGORY_COLOUR[stamp.category]}
          />
        );
      })}

      {/* The closing card. Only the finale carries a hero, so this is how the
          film ends rather than something drawn over the whole of it.

          ⚠ **One flat string, not a big number with a smaller denominator
          nested inside it.** The passport draws the hero that way with nested
          `Text`, which React Native turns into a `tspan` — but on the web
          workbench it emitted a `<text>` inside a `<text>`, which is not valid
          SVG, and the workbench is the only place this design gets looked at.
          `shareCard.ts` already settled on the flat string for the still
          souvenir and it has been approved by eye. */}
      {frame.hero === null ? null : (
        <>
          <SvgText
            x={width / 2}
            y={height - height * 0.14}
            textAnchor="middle"
            fill={colors.text}
            fontSize={Math.round(width / 7)}
            fontWeight="700"
          >
            {`${frame.hero.collected} / ${frame.hero.total}`}
          </SvgText>
          {heroCaption === undefined ? null : (
            <SvgText
              x={width / 2}
              y={height - height * 0.09}
              textAnchor="middle"
              fill={colors.textMuted}
              fontSize={Math.round(width / 22)}
            >
              {heroCaption}
            </SvgText>
          )}
        </>
      )}
    </Svg>
  );
}

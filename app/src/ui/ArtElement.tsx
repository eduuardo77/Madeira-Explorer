/**
 * One element of a drawing, as `react-native-svg` draws it.
 *
 * Both art modules describe a drawing as a list of `StampElement`s
 * (`passport/stampArt.ts`, `passport/medalArt.ts`), and the preview page
 * replays the same list (`tools/lib/svg-render.mjs`). This is the app's half,
 * shared by `StampArt` and `MedalArt` so neither composes anything of its own.
 */

import { Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import type { StampElement } from '../passport/stampArt';

export default function ArtElement({
  element,
  clipId,
}: {
  element: StampElement;
  /** The clip path an element with `clip: true` uses, or null when the drawing has none. */
  clipId: string | null;
}) {
  // Which elements clip is decided by the art module, not guessed from the kind
  // here: the band is drawn full width and clipped to the panel, which gives it
  // the sticker's own shape on a triangle or a diamond for free, and so is the
  // sunburst, whose rays deliberately overshoot the canvas.
  const clipPath = element.clip === true && clipId !== null ? `url(#${clipId})` : undefined;

  if (element.kind === 'polygon') {
    return (
      <Polygon
        clipPath={clipPath}
        points={element.points}
        fill={element.fill}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        strokeLinejoin={element.strokeLinejoin}
        opacity={element.opacity}
      />
    );
  }

  if (element.kind === 'path') {
    return (
      <Path
        clipPath={clipPath}
        d={element.d}
        fill={element.fill}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        transform={element.transform}
        opacity={element.opacity}
      />
    );
  }

  if (element.kind === 'rect') {
    return (
      <Rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        fill={element.fill}
        opacity={element.opacity}
        clipPath={clipPath}
      />
    );
  }

  return (
    <SvgText
      x={element.x}
      y={element.y}
      fill={element.fill}
      fontSize={element.fontSize}
      fontWeight="700"
      letterSpacing={0.6}
      textAnchor="middle"
      opacity={element.opacity}
      transform={element.transform}
      // Null means "draw at natural width": condensing every label would make
      // short names look wrong to fix a problem they do not have.
      {...(element.textLength === null
        ? {}
        : { textLength: element.textLength, lengthAdjust: 'spacingAndGlyphs' as const })}
    >
      {element.text}
    </SvgText>
  );
}

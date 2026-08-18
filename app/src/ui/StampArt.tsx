/**
 * Drawing a passport stamp (T-070).
 *
 * **This component decides nothing.** Every choice — the silhouette, the
 * colourway, the cut edge, where the icon and the name sit — is made by
 * `passport/stampArt.ts`, which is pure and tested. This walks the element
 * list and turns each entry into an SVG primitive.
 *
 * That split is not tidiness. There are **two** renderers: this one, and
 * `tools/preview-stamps.mjs`, which draws the same stamps to a standalone
 * page because there is no device on this project and artwork is the one thing
 * a test cannot judge. If the two composed independently, the page that gets
 * looked at and approved would not be the thing that ships.
 *
 * ⚠ Never rendered on a phone. `react-native-svg` is a native module, so what
 * has been seen is the browser's SVG, in the workbench and in the preview.
 */

import Svg, {
  ClipPath,
  Defs,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import {
  CANVAS,
  stampElements,
  toPolygon,
  type StampDesign,
} from '../passport/stampArt';

export default function StampArt({
  placeId,
  design,
  name,
  collected,
  label,
  size,
}: {
  /**
   * Only used to name the clip path, and that is not cosmetic: on the web
   * workbench every stamp renders into one document, so a shared id would
   * make every band take the first stamp's shape.
   */
  placeId: string;
  design: StampDesign;
  name: string;
  collected: boolean;
  /**
   * What a screen reader should say, when the derived label would be wrong.
   *
   * ⚠ Exists for exactly one caller: a stamp that is **earned but locked**
   * (T-155) is drawn with `collected={false}` so it gets the muted palette, and
   * the derived label would then announce *"not collected yet"* about a place
   * the user stood at. The passport passes the true sentence in.
   */
  label?: string;
  /** Drawn square, in dp. */
  size: number;
}) {
  const elements = stampElements(design, name, collected);
  const clipId = `stamp-panel-${placeId}`;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      // The tilt is applied here rather than inside the drawing, so the cut
      // edge is never clipped by its own viewBox.
      style={{ transform: [{ rotate: `${design.tiltDeg}deg` }] }}
      accessibilityLabel={label ?? `${name}${collected ? '' : ', not collected yet'}`}
    >
      <Defs>
        <ClipPath id={clipId}>
          <Polygon points={toPolygon(design.panel)} />
        </ClipPath>
      </Defs>
      {elements.map((element, index) => {
        const key = `${element.kind}-${index}`;

        if (element.kind === 'polygon') {
          return (
            <Polygon
              key={key}
              clipPath={element.clip === true ? `url(#${clipId})` : undefined}
              points={element.points}
              fill={element.fill}
              stroke={element.stroke}
              strokeWidth={element.strokeWidth}
              opacity={element.opacity}
            />
          );
        }

        if (element.kind === 'path') {
          return (
            <Path
              key={key}
              clipPath={element.clip === true ? `url(#${clipId})` : undefined}
              d={element.d}
              fill={element.fill}
              transform={element.transform}
              opacity={element.opacity}
            />
          );
        }

        if (element.kind === 'rect') {
          return (
            <Rect
              key={key}
              x={element.x}
              y={element.y}
              width={element.width}
              height={element.height}
              fill={element.fill}
              opacity={element.opacity}
              // Which elements clip is decided by `stampArt.ts`, not guessed
              // from the kind here: the band is drawn full width and clipped
              // to the panel — which gives it the sticker's own shape on a
              // triangle or a diamond for free — and so is the sunburst,
              // whose rays deliberately overshoot the canvas.
              clipPath={element.clip === true ? `url(#${clipId})` : undefined}
            />
          );
        }

        return (
          <SvgText
            key={key}
            x={element.x}
            y={element.y}
            fill={element.fill}
            fontSize={element.fontSize}
            fontWeight="700"
            letterSpacing={0.6}
            textAnchor="middle"
            opacity={element.opacity}
            // Null means "draw at natural width" — condensing every label
            // would make short names look wrong to fix a problem they do not
            // have. See `stampArt.ts`.
            {...(element.textLength === null
              ? {}
              : {
                  textLength: element.textLength,
                  lengthAdjust: 'spacingAndGlyphs' as const,
                })}
          >
            {element.text}
          </SvgText>
        );
      })}
    </Svg>
  );
}

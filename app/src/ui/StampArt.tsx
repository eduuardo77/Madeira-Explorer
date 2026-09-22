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
import { RIM_PAD_UNITS, rimElements, type Rim } from '../passport/stampRim';

export default function StampArt({
  placeId,
  design,
  name,
  collected,
  rim,
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
   * The rank rim, for the passport button only (D-083). The viewBox grows to
   * make room for it, so the stamp itself draws a little smaller in the same
   * `size`.
   */
  rim?: Rim | null;
  /** Drawn square, in dp. */
  size: number;
}) {
  const elements = [
    ...(rim === undefined || rim === null ? [] : rimElements(design, rim)),
    ...stampElements(design, name, collected),
  ];
  const pad = rim === undefined || rim === null ? 0 : RIM_PAD_UNITS;
  const clipId = `stamp-panel-${placeId}`;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`${-pad} ${-pad} ${CANVAS + 2 * pad} ${CANVAS + 2 * pad}`}
      // The tilt is applied here rather than inside the drawing, so the cut
      // edge is never clipped by its own viewBox.
      style={{ transform: [{ rotate: `${design.tiltDeg}deg` }] }}
      // ⚠ Decorative, always. Every caller wraps the stamp in a Pressable that
      // carries the translated sentence — the passport cell, the passport
      // button. This used to label itself too, in English only (*"…, not
      // collected yet"*), so TalkBack on the P30 read the button twice and
      // the second time in the wrong language (found 2026-09-22).
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
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
              strokeLinejoin={element.strokeLinejoin}
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

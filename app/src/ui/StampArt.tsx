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

import Svg, { ClipPath, Defs, FeGaussianBlur, Filter, G, Polygon } from 'react-native-svg';
import ArtElement from './ArtElement';
import {
  CANVAS,
  GLOW_PAD_UNITS,
  stampElements,
  toPolygon,
  type Postmark,
  type StampDesign,
} from '../passport/stampArt';
import { RIM_PAD_UNITS, rimElements, type Rim } from '../passport/stampRim';

export default function StampArt({
  placeId,
  design,
  name,
  collected,
  rim,
  postmark,
  size,
  blur,
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
  /** The day a collected stamp was earned, printed as a postmark (option E). */
  postmark?: Postmark | null;
  /** Drawn square, in dp. */
  size: number;
  /**
   * Frosted glass, in drawing units (D-097, sheet A): a stamp that is the
   * user's but not yet seen, drawn in colour and softened. Absent draws sharp.
   */
  blur?: number;
}) {
  const elements = [
    ...(rim === undefined || rim === null ? [] : rimElements(design, rim)),
    ...stampElements(design, name, collected, postmark ?? null),
  ];
  // The rim's room, or room for a collected stamp's glow; every stamp gets it
  // so a grid of them keeps one size (option E, 2026-10-04).
  const pad = rim === undefined || rim === null ? GLOW_PAD_UNITS : RIM_PAD_UNITS;
  const clipId = `stamp-panel-${placeId}`;
  const blurId = `stamp-blur-${placeId}`;

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
        {blur === undefined ? null : (
          <Filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
            <FeGaussianBlur stdDeviation={blur} />
          </Filter>
        )}
      </Defs>
      <G filter={blur === undefined ? undefined : `url(#${blurId})`}>
        {elements.map((element, index) => (
          <ArtElement key={`${element.kind}-${index}`} element={element} clipId={clipId} />
        ))}
      </G>
    </Svg>
  );
}

/**
 * The founder stamp (T-233) and the set medals (T-235), drawn.
 *
 * **This component decides nothing**, like `StampArt`: `passport/medalArt.ts`
 * composes the drawing, and `tools/preview-founder.mjs` and
 * `tools/preview-medals.mjs` replay the same elements for the pages the project
 * lead approves by eye (OQ-9).
 */

import Svg, { Defs, FeGaussianBlur, Filter, G } from 'react-native-svg';
import { CANVAS } from '../passport/stampArt';
import {
  founderElements,
  setMedalElements,
  type FounderWords,
  type SetMedalWords,
} from '../passport/medalArt';
import ArtElement from './ArtElement';

export type MedalDrawing =
  | { kind: 'founder'; words: FounderWords }
  | { kind: 'set'; words: SetMedalWords };

export default function MedalArt({
  id,
  drawing,
  size,
  blur,
}: {
  /** Names the blur filter: several medals render into one screen. */
  id: string;
  drawing: MedalDrawing;
  size: number;
  /**
   * Frosted glass, in drawing units, for a medal earned on a passport not yet
   * unlocked (D-089), as `StampArt` frosts a locked stamp. Absent draws sharp.
   */
  blur?: number;
}) {
  const elements = drawing.kind === 'founder' ? founderElements(drawing.words) : setMedalElements(drawing.words);
  const blurId = `medal-blur-${id}`;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      // Decorative: the tile around it carries the sentence a screen reader says.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {blur === undefined ? null : (
        <Defs>
          <Filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
            <FeGaussianBlur stdDeviation={blur} />
          </Filter>
        </Defs>
      )}
      <G filter={blur === undefined ? undefined : `url(#${blurId})`}>
        {elements.map((element, index) => (
          <ArtElement key={`${element.kind}-${index}`} element={element} clipId={null} />
        ))}
      </G>
    </Svg>
  );
}

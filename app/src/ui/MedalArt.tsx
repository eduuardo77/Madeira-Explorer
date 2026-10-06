/**
 * The founder stamp, drawn (T-233); the set medals join it in T-235.
 *
 * **This component decides nothing**, like `StampArt`: `passport/medalArt.ts`
 * composes the drawing and `tools/preview-founder-options.mjs` replays the same
 * elements for the page the project lead approves by eye (OQ-9).
 */

import Svg from 'react-native-svg';
import { CANVAS } from '../passport/stampArt';
import { founderElements, type FounderWords } from '../passport/medalArt';
import ArtElement from './ArtElement';

export default function MedalArt({ words, size }: { words: FounderWords; size: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      // Decorative: the card around it carries the sentence a screen reader says.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {founderElements(words).map((element, index) => (
        <ArtElement key={`${element.kind}-${index}`} element={element} clipId={null} />
      ))}
    </Svg>
  );
}

/**
 * Layout rules for the phone's text-size setting (N16, 2026-10-27), pure so
 * they are tested in Node. `fontScale` is `useWindowDimensions().fontScale`.
 *
 * At 130% German broke the passport's unlock card into *kostenl / ose*: the
 * stamps on the left and the *Ansehen* button on the right left the words a
 * column about 100 dp wide, narrower than one German word in bold.
 */

/** From this text size the unlock card puts its button under the words. */
export const NUDGE_STACK_SCALE = 1.15;

export function stacksNudgeButton(fontScale: number): boolean {
  return fontScale >= NUDGE_STACK_SCALE;
}

/**
 * When the drawing of Android's page goes dense (N18, 2026-10-27), pure so it
 * is tested in Node.
 *
 * On a 360 × 780 phone the background-location card, with Play's required
 * text, left the fourth option (*Don't allow*) 10 dp tall at the foot of the
 * scrolling area: it scrolled, but read as cut. The drawing above it had
 * already stepped aside (2026-10-05). When the words and the replica overflow
 * the room, the answers not to pick are drawn closer and shorter.
 */

/** `wordsHeight` and the content's vertical padding against the scrolling area's height. */
export function replicaOverflows(viewportHeight: number, wordsHeight: number, paddingVertical: number): boolean {
  if (viewportHeight <= 0 || wordsHeight <= 0) return false;
  return wordsHeight + 2 * paddingVertical > viewportHeight;
}

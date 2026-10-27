/**
 * The last line of an island's card in the main passport (D-109, amended
 * 2026-10-27), pure so it is tested in Node.
 *
 * *Incluído no teu passaporte* in link blue read as "free" to someone who had
 * not paid, right under the unlock banner (review N22). Before buying, the
 * line now says what is true in the card's grey: the island's free stamp, and
 * that the rest come with the purchase; once that stamp is used, only the
 * second half. After buying, *included* is true and stays.
 */

export type IslandCardLine =
  | { key: 'passport.island.included'; tone: 'link' }
  | { key: 'passport.island.freeLeft'; tone: 'muted'; count: number }
  | { key: 'passport.island.freeUsed'; tone: 'muted' };

/** `freeLeft` as the passport screen keeps it: null once bought. */
export function islandCardLine(freeLeft: number | null): IslandCardLine {
  if (freeLeft === null) return { key: 'passport.island.included', tone: 'link' };
  if (freeLeft > 0) return { key: 'passport.island.freeLeft', tone: 'muted', count: freeLeft };
  return { key: 'passport.island.freeUsed', tone: 'muted' };
}

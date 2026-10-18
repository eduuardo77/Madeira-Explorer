/**
 * The passport's trip line and its *Ver a tua viagem*, as last worked out,
 * kept so the page opens with them in place (2026-10-18).
 *
 * Both wait on slow work: the line on the stored roads, the film's offer on
 * reading and masking the whole trace. Drawn only once known, they arrived a
 * second or two after the stamps and pushed the page down under the finger,
 * so a tap meant for a stamp landed on another (seen on the P30). They rarely
 * change between two openings, so the last ones are shown at once and the
 * work replaces them only if they changed, as the map's snapshot does
 * (`map/mapSnapshot.ts`).
 *
 * Numbers, not words: the screen words them, so a change of language never
 * shows a stale sentence. Pure, tested on Node; `PassportScreen` reads and
 * writes it through `app_state`.
 */

export type PassportSummary = {
  /** The trip on show it describes: another trip's is never shown. */
  tripId: number;
  /** Road lit on that trip, and on all trips, in metres. */
  tripLitM: number;
  totalLitM: number;
  /** The trip viewer's days for that trip. */
  days: number;
  /** Whether the film has anything to play (T-217). */
  canWatch: boolean;
};

export function encodePassportSummary(summary: PassportSummary): string {
  return JSON.stringify(summary);
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * The summary for `tripId`, or null when there is none, it is another trip's,
 * or it does not parse. A bad one costs only the wait it was meant to save.
 */
export function decodePassportSummary(raw: string | null, tripId: number): PassportSummary | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const value = parsed as Record<string, unknown>;
  if (
    value.tripId !== tripId ||
    !isCount(value.tripLitM) ||
    !isCount(value.totalLitM) ||
    !isCount(value.days) ||
    typeof value.canWatch !== 'boolean'
  ) {
    return null;
  }
  return {
    tripId,
    tripLitM: value.tripLitM,
    totalLitM: value.totalLitM,
    days: value.days,
    canWatch: value.canWatch,
  };
}

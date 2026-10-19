/**
 * Assembling the souvenir's inputs from the database (T-105a).
 *
 * The film itself is planned in `composition.ts` and is pure. This is the part
 * that reads the trip: the masked trace, the stamps in the order they were
 * earned, the places they belong to, and the hero number's denominator.
 *
 * Same split as `stampRules` / `stampAwards`, and for the same reason — the
 * judgement is testable on Node and the plumbing is not.
 *
 * **The trace comes from `getExportableTrace` and nowhere else.** That is the
 * whole of D-040's enforcement: this module has no access to `rawFixDao` and
 * should never acquire one. If a future export needs something the exportable
 * trace does not carry, add it there, behind the masking.
 */

import { getContentPack } from '../content/poiCatalogue';
import { getCurrentProgress } from '../progress/currentProgress';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import { GAP_THRESHOLD_MS } from '../recording/recorderHealth';
import type { Composition, SouvenirStamp } from './composition';
import { composeSouvenir } from './composition';
import { exportRoadSegments } from '../matching/roadNetwork';
import { keepSimplified } from '../map/simplifyLine';
import { MASK_RADIUS_M } from './accommodation';
import { exportedTrip, getExportableTrace } from './exportTrace';

/**
 * Plan the souvenir for `tripId`, or for the trip that just ended.
 *
 * Never throws: this is called from the reveal (T-102), which the user reaches
 * at the airport with their phone at 4% — a failure here must degrade to an
 * honest "no video" rather than to a crash on the best moment in the product.
 *
 * `quiet`: plan without writing to the diary, for the passport's question
 * "is there a film to offer" (T-217), asked on every visit.
 */
export async function getSouvenirComposition({
  quiet = false,
  tripId,
  range,
}: {
  quiet?: boolean;
  tripId?: number;
  /** One day of the trip (the viewer's "this day", 17 Oct 2026); the whole trip when absent. */
  range?: { fromTs: number; toTs: number };
} = {}): Promise<Composition> {
  try {
    // One trip for the trace and the stamps alike (T-275).
    const trip = await exportedTrip(tripId);
    if (trip === null) {
      return { renderable: false, reason: 'no trip to show' };
    }

    const trace = await getExportableTrace({ quiet, tripId: trip.id });
    if (!trace.safeToShare) {
      // Already the right answer, and `composeSouvenir` would reach it too.
      // Returning early keeps the reason exactly as the export phrased it.
      return { renderable: false, reason: trace.reason, refusal: trace.refusal ?? undefined };
    }

    const progress = await getCurrentProgress();
    const inRange = (ts: number) => range === undefined || (ts >= range.fromTs && ts < range.toTs);
    const awards = (await stampAwardDao.getAwards(trip.id)).filter((award) => inRange(award.awarded_ts));
    const fixes = trace.fixes.filter((fix) => inRange(fix.ts));
    // The masked export of the whole trip, then cut to the range: the guard in
    // `traceDrawn.test.ts` holds this call to the masked trace. Drawn only, as
    // on the map: fewer points per frame (`simplifyLine`), times unchanged.
    const roads = (await exportRoadSegments(trace.fixes, trace.accommodation, MASK_RADIUS_M))
      .map((segment) => ({ ...segment, fixes: keepSimplified(segment.fixes.filter((fix) => inRange(fix.ts))) }))
      .filter((segment) => segment.fixes.length >= 2);

    const composition = composeSouvenir({
      trace: {
        fixes,
        safeToShare: trace.safeToShare,
        reason: trace.reason,
      },
      stamps: toSouvenirStamps(awards),
      totalPlaces: progress.total,
      // The same threshold the map and the health check use, so a gap the app
      // has already told the user about is the same gap the video shows.
      gapThresholdMs: GAP_THRESHOLD_MS,
      // The roads, as the map draws them (D-093): from the masked trace, cut
      // at the mask circle, because the film is made to be posted.
      roads,
    });

    if (quiet) {
      return composition;
    }
    await recordingEventDao.log(
      'export',
      composition.renderable
        ? `souvenir: ${composition.durationMs} ms, ${composition.reason}`
        : `souvenir declined: ${composition.reason}` // i18n-exempt: the second branch of a diary log line
    );

    return composition;
  } catch (error) {
    await recordingEventDao.logError('souvenir composition', error);
    return { renderable: false, reason: 'could not build the souvenir' };
  }
}

/**
 * The awards the finale counts: those whose place is still in the pack. One
 * whose place a re-curation removed is not counted, as the passport does not
 * show it either.
 */
function toSouvenirStamps(
  awards: { place_id: string; awarded_ts: number }[]
): SouvenirStamp[] {
  const known = new Set(getContentPack().places.map((place) => place.id));
  return awards
    .filter((award) => known.has(award.place_id))
    .map((award) => ({ placeId: award.place_id, awardedTs: award.awarded_ts }));
}

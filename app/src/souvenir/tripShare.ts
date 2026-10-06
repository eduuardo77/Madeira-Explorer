/**
 * What the trip viewer's Share draws, masked (T-253, D-099).
 *
 * WalkNYC's Share sends one picture of its walk viewer with the walk's figures
 * and a line about the app; the lead chose the same, drawn as the "Partilhar"
 * board of `tools/preview-trip-viewer-options.mjs`. The viewer itself shows
 * the unmasked trip, because it never leaves the phone. **This does**, so the
 * roads come through `getExportableTrace` and `exportRoadSegments`, the one
 * door D-040 allows: where the user slept is cut out, and a trace the app
 * cannot vouch for is refused rather than shared.
 */

import { exportRoadSegments } from '../matching/roadNetwork';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import { MASK_RADIUS_M } from './accommodation';
import { getExportableTrace } from './exportTrace';
import type { ShareRefusal } from './shareTrip';
import type { DayRun } from './tripDays';

export type ShareScene =
  { ok: true; runs: DayRun[] } | { ok: false; refusal: ShareRefusal; reason: string };

/** The whole trip's roads, masked, as runs for the map. */
export async function buildShareScene(): Promise<ShareScene> {
  try {
    const trace = await getExportableTrace();
    if (!trace.safeToShare) {
      return { ok: false, refusal: trace.refusal ?? 'failed', reason: trace.reason };
    }
    const roads = await exportRoadSegments(trace.fixes, trace.accommodation, MASK_RADIUS_M);
    if (roads.length === 0) {
      return { ok: false, refusal: 'nothing', reason: 'no lit roads after masking' };
    }
    return {
      ok: true,
      runs: roads.map((segment) => ({
        points: segment.fixes.map((fix): [number, number] => [fix.lat, fix.lon]),
        faded: segment.faded === true,
      })),
    };
  } catch (error) {
    await recordingEventDao.logError('trip share scene', error);
    return { ok: false, refusal: 'failed', reason: 'the trip could not be read' };
  }
}

/**
 * Gathering a walk report and handing it to the user to send (OD-11, D-069).
 *
 * The impure half of `walkReport.ts`: it reads the trip, the awards and the
 * thresholds in force, writes the file, and opens the share sheet. **It never
 * sends anything itself** — there is no endpoint in this file, and adding one
 * would change what the app is, not just what it does (D-001, D-031).
 *
 * ⚠ **The trace comes through `exportTrace.ts`**, the single door D-016 and
 * D-040 require, so a donated walk cannot contain where somebody sleeps.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getContentPack } from '../content/poiCatalogue';
import {
  CONFIRMABLE_ABSOLUTE_M,
  CONFIRMABLE_MINUTES,
  CORRIDOR_M,
  MAX_USABLE_ACCURACY_M,
  WALKED_ABSOLUTE_M,
  WALKED_FRACTION,
  WALKED_MINUTES,
} from '../progress/levadaCoverage';
import { MAX_ARRIVAL_SPEED_MPS, MIN_DWELL_SECONDS } from '../progress/stampRules';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import { getExportableTrace } from './exportTrace';
import {
  buildWalkReport,
  describeWalkReport,
  renderWalkReport,
  walkReportFilename,
  type ReportDecision,
  type WalkReport,
} from './walkReport';

/**
 * Every number a decision turned on, sent with the walk.
 *
 * ⚠ **Read from the modules themselves, never retyped.** A snapshot of
 * thresholds that has drifted from the thresholds actually applied is worse
 * than none: it would make a report look like evidence for a rule that was not
 * running.
 */
function thresholdsInForce(): Record<string, number> {
  return {
    corridorM: CORRIDOR_M,
    maxUsableAccuracyM: MAX_USABLE_ACCURACY_M,
    walkedFraction: WALKED_FRACTION,
    walkedAbsoluteM: WALKED_ABSOLUTE_M,
    walkedMinutes: WALKED_MINUTES,
    confirmableAbsoluteM: CONFIRMABLE_ABSOLUTE_M,
    confirmableMinutes: CONFIRMABLE_MINUTES,
    minDwellSeconds: MIN_DWELL_SECONDS,
    maxArrivalSpeedMps: MAX_ARRIVAL_SPEED_MPS,
  };
}

export type DonationResult =
  | { ok: true; report: WalkReport; description: string }
  | { ok: false; reason: string };

/**
 * Build the report for the most recent trip.
 *
 * The description comes back with it so the screen can show the user what they
 * are about to send, in the words `walkReport.ts` keeps beside the payload.
 */
export async function buildDonation(appVersion: string): Promise<DonationResult> {
  try {
    const trace = await getExportableTrace();
    if (!trace.safeToShare) {
      return { ok: false, reason: trace.reason };
    }

    const trip = (await tripDao.getActiveTrip()) ?? (await tripDao.getMostRecentTrip());
    if (trip === null) {
      return { ok: false, reason: 'no trip recorded yet' };
    }

    const pack = getContentPack();
    const awards = await stampAwardDao.getAwards(trip.id);

    // ⚠ Only places the app actually judged. A report listing every uncollected
    // place in the pack would be a list of where somebody did *not* go, which is
    // both useless and more revealing than it looks.
    const decisions: ReportDecision[] = awards.flatMap((award) => {
      const place = pack.places.find((candidate) => candidate.id === award.place_id);
      return place === undefined
        ? []
        : [
            {
              placeId: place.id,
              category: place.category,
              awarded: true,
              // An award row can carry a null reason from before the rules
              // explained themselves; the report says so rather than dropping
              // the decision, because the decision is the valuable part.
              reason: award.reason ?? 'no reason recorded',
              confidence: award.confidence,
              dwellSeconds: award.dwell_seconds,
              meanSpeedMps: award.mean_speed_mps,
            },
          ];
    });

    const report = buildWalkReport({
      fixes: trace.fixes.map((fix) => ({
        ts: fix.ts,
        lat: fix.lat,
        lon: fix.lon,
        accuracy_m: fix.accuracy_m,
      })),
      decisions,
      appVersion,
      thresholds: thresholdsInForce(),
    });

    return { ok: true, report, description: describeWalkReport(report) };
  } catch (error) {
    await recordingEventDao.logError('walk report', error);
    return { ok: false, reason: 'the trip could not be read' };
  }
}

/**
 * Write the report to a file and open the share sheet.
 *
 * ⚠ **The cache directory, not documents.** A donated report is disposable the
 * moment the user has sent it; leaving copies in the app's permanent storage
 * would accumulate their trips in a second place for no reason.
 */
export async function sendDonation(report: WalkReport): Promise<{ ok: boolean; reason?: string }> {
  try {
    // ⚠ SDK 57's `File`/`Paths` API, the one `mapAssets.ts` already uses —
    // not `FileSystem.cacheDirectory`, which belongs to the legacy surface and
    // does not exist here.
    const file = new File(Paths.cache, walkReportFilename(report));
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(renderWalkReport(report));

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: 'this device cannot share files' };
    }

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Send this walk',
      UTI: 'public.json',
    });
    return { ok: true };
  } catch (error) {
    await recordingEventDao.logError('send walk report', error);
    return { ok: false, reason: 'the file could not be shared' };
  }
}

/**
 * Turning a trip into a picture somebody can send (T-105d, T-107, T-108).
 *
 * The impure half of the share card: it reads the trip, hands the facts to
 * `shareCard.ts`, and — once a view has drawn it — captures a PNG and opens the
 * share sheet. The judgement is all in the pure module; this is plumbing.
 *
 * ⚠ **THE TRACE COMES THROUGH `exportTrace.ts` AND NOWHERE ELSE.** That module
 * is the single door D-016 and D-040 require every export to pass through, and
 * its own header says why: masking must not be a step somebody remembers to
 * apply. Reading `rawFixDao` here would publish where the user sleeps, and
 * there is no second safety net. If `safeToShare` is false, this refuses.
 *
 * ⚠ **Two new dependencies, both audited (D-043).** `react-native-view-shot`
 * photographs a view; `expo-sharing` opens the OS share sheet. Neither has a
 * network path — see `docs/dependency-audit.md`. The captured file is written
 * to the app's own cache directory and handed to the OS; nothing is uploaded,
 * which keeps D-001 true.
 */

import * as Sharing from 'expo-sharing';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { getContentPack } from '../content/poiCatalogue';
import { drawableSegments } from '../map/traceGeoJson';
import { getCurrentProgress } from '../progress/currentProgress';
import { GAP_THRESHOLD_MS } from '../recording/recorderHealth';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import { getExportableTrace } from './exportTrace';
import { buildShareCard, formatDateRange, type CardPoint, type ShareCard } from './shareCard';

export type ShareCardResult =
  | { ok: true; card: ShareCard }
  /** Refused, with a sentence the screen can show as it stands. */
  | { ok: false; reason: string };

/**
 * Everything the card needs, from the database.
 *
 * Returns a refusal rather than a half-card: a souvenir missing the trace is
 * not a souvenir, and an empty rectangle with somebody's holiday dates on it
 * would be worse than the honest sentence.
 */
export async function buildCardForTrip(
  nowMs: number = Date.now()
): Promise<ShareCardResult> {
  try {
    const trace = await getExportableTrace();
    if (!trace.safeToShare) {
      // ⚠ The refusal is the feature. ARCHITECTURE §10 forbids showing an
      // export the app cannot vouch for.
      return { ok: false, reason: trace.reason };
    }

    const trip = (await tripDao.getActiveTrip()) ?? (await tripDao.getMostRecentTrip());
    if (trip === null) {
      return { ok: false, reason: 'no trip to share yet' };
    }

    const progress = await getCurrentProgress();
    const pack = getContentPack();

    const awards = await stampAwardDao.getAwards(trip.id);
    // Newest first: the last places you collected are the ones you remember.
    const names = [...awards]
      .sort((a, b) => b.awarded_ts - a.awarded_ts)
      .flatMap((award) => {
        const place = pack.places.find((candidate) => candidate.id === award.place_id);
        return place === undefined ? [] : [place.name];
      });

    const strokes: CardPoint[][] = drawableSegments(trace.fixes, GAP_THRESHOLD_MS).map(
      (segment) => segment.fixes.map((fix): CardPoint => [fix.lon, fix.lat])
    );

    return {
      ok: true,
      card: buildShareCard({
        destination: pack.destination ?? 'Your trip',
        dateRange: formatDateRange(trip.started_ts, trip.ended_ts ?? nowMs),
        collected: progress.collected,
        total: progress.total,
        strokes,
        stampNames: names,
      }),
    };
  } catch (error) {
    await recordingEventDao.logError('share card', error);
    return { ok: false, reason: 'the trip could not be read' };
  }
}

/**
 * Photograph the drawn card and hand it to the OS share sheet.
 *
 * `viewRef` must point at a mounted `ShareCardView`. The capture is a file in
 * the app's cache directory; the OS copies what it needs and the file is
 * disposable — nothing is uploaded by this app, and neither library has a
 * network path (D-001, D-043).
 */
export async function shareCardImage(
  viewRef: React.RefObject<View | null>
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (viewRef.current === null) {
      return { ok: false, reason: 'the card is not on screen yet' };
    }

    const uri = await captureRef(viewRef, { format: 'png', quality: 1, result: 'tmpfile' });

    if (!(await Sharing.isAvailableAsync())) {
      // A device with no share sheet at all. Rare, and not worth a crash.
      return { ok: false, reason: 'this device cannot share files' };
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share your trip',
      UTI: 'public.png',
    });
    return { ok: true };
  } catch (error) {
    await recordingEventDao.logError('share card image', error);
    return { ok: false, reason: 'the image could not be shared' };
  }
}

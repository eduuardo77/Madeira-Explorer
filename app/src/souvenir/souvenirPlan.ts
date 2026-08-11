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
import type { Place } from '../content/contentPack';
import { getCurrentProgress } from '../progress/currentProgress';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import { GAP_THRESHOLD_MS } from '../recording/recorderHealth';
import type { Composition, SouvenirStamp } from './composition';
import { composeSouvenir } from './composition';
import { getExportableTrace } from './exportTrace';

/**
 * Plan the souvenir for the trip that just ended.
 *
 * Never throws: this is called from the reveal (T-102), which the user reaches
 * at the airport with their phone at 4% — a failure here must degrade to an
 * honest "no video" rather than to a crash on the best moment in the product.
 */
export async function getSouvenirComposition(): Promise<Composition> {
  try {
    const trace = await getExportableTrace();
    if (!trace.safeToShare) {
      // Already the right answer, and `composeSouvenir` would reach it too.
      // Returning early keeps the reason exactly as the export phrased it.
      return { renderable: false, reason: trace.reason };
    }

    const trip =
      (await tripDao.getActiveTrip()) ?? (await tripDao.getMostRecentTrip());
    if (trip === null) {
      return { renderable: false, reason: 'no trip to show' };
    }

    const progress = await getCurrentProgress();
    const awards = await stampAwardDao.getAwards(trip.id);

    const composition = composeSouvenir({
      trace: {
        fixes: trace.fixes,
        safeToShare: trace.safeToShare,
        reason: trace.reason,
      },
      stamps: toSouvenirStamps(awards),
      totalPlaces: progress.total,
      // The same threshold the map and the health check use, so a gap the app
      // has already told the user about is the same gap the video shows.
      gapThresholdMs: GAP_THRESHOLD_MS,
    });

    await recordingEventDao.log(
      'export',
      composition.renderable
        ? `souvenir: ${composition.durationMs} ms, ${composition.reason}`
        : `souvenir declined: ${composition.reason}`
    );

    return composition;
  } catch (error) {
    await recordingEventDao.logError('souvenir composition', error);
    return { renderable: false, reason: 'could not build the souvenir' };
  }
}

/**
 * Join awards to the places they were earned at.
 *
 * An award whose place is no longer in the pack is skipped rather than shown
 * nameless — a badge reading "unknown" in a video somebody is about to post is
 * worse than one fewer badge. It can only happen if the pack changed under an
 * old trip, which is exactly what a re-curation between releases does.
 */
function toSouvenirStamps(
  awards: { place_id: string; awarded_ts: number }[]
): SouvenirStamp[] {
  const places = new Map<string, Place>();
  for (const place of getContentPack().places) {
    places.set(place.id, place);
  }

  const stamps: SouvenirStamp[] = [];
  for (const award of awards) {
    const place = places.get(award.place_id);
    if (place === undefined) {
      continue;
    }
    const marker = stampMarker(place);
    if (marker === null) {
      continue;
    }
    stamps.push({
      placeId: place.id,
      name: place.name,
      category: place.category,
      awardedTs: award.awarded_ts,
      lat: marker.lat,
      lon: marker.lon,
    });
  }

  return stamps;
}

/**
 * Where the badge lands on the map.
 *
 * Most places have exactly one geofence and the question does not arise. A
 * levada has two (D-034), and the badge belongs at the **end** — that is where
 * the walker was when they earned it, and popping the badge back at the
 * trailhead would put it somewhere the line left an hour earlier.
 */
function stampMarker(place: Place): { lat: number; lon: number } | null {
  const main = place.geofences.find((geofence) => geofence.role === 'main');
  const end = place.geofences.find((geofence) => geofence.role === 'end');
  const chosen = main ?? end ?? place.geofences[0];
  return chosen === undefined ? null : { lat: chosen.lat, lon: chosen.lon };
}

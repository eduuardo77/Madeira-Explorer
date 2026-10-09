/**
 * What the trip viewer shows, read from the phone (T-253, D-099).
 *
 * The impure half of `tripDays.ts`: it reads the trip on show, its lit roads
 * and its stamps, and hands them to the pure module with the phone's own
 * midnight. Nothing here leaves the phone, so nothing here is masked; the
 * shared image is built from `exportRoadSegments` instead (`tripShare.ts`).
 */

import { getContentPack } from '../content/poiCatalogue';
import { representativeGeofence } from '../map/placeMarkers';
import { roadLinesFor, timedRunsFor } from '../matching/roadNetwork';
import type { VisitedLine } from '../matching/visitedRoads';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import { localStartOfDay, tripDays, type TripDay, type ViewerStamp } from './tripDays';

export type TripView = {
  tripId: number;
  startedTs: number;
  /** The trip's end, or now for a trip still open. */
  endTs: number;
  /** Every road the trip lit, once each: drawn pale behind the day on show. */
  lines: VisitedLine[];
  /**
   * Road lit over the whole trip, metres, each road once: the passport's
   * figure, from the same calculation (L6). A day's figure is the same measure
   * for that day, so it is never larger than the trip's.
   */
  litM: number;
  days: TripDay[];
  stampCount: number;
};

/**
 * A trip for the viewer: `tripId` from the passport's list (T-261), or the trip
 * on show when absent. Null when there is no such trip.
 */
export async function loadTripView(
  tripId?: number,
  nowMs: number = Date.now(),
): Promise<TripView | null> {
  const trip =
    tripId === undefined ? await tripDao.getTripOnShow() : await tripDao.getTrip(tripId);
  if (trip === null) {
    return null;
  }

  const fixes = await rawFixDao.getTraceFixes(trip.id);
  const roads = await roadLinesFor(trip.id, fixes);
  const runs = await timedRunsFor(trip.id);

  const places = new Map(getContentPack().places.map((place) => [place.id, place]));
  const stamps: ViewerStamp[] = [];
  for (const award of await stampAwardDao.getAwards(trip.id)) {
    const place = places.get(award.place_id);
    // A place dropped from the content since it was earned has nowhere to be drawn.
    const anchor = place === undefined ? undefined : representativeGeofence(place);
    if (place !== undefined && anchor !== undefined) {
      stamps.push({
        placeId: place.id,
        name: place.name,
        lat: anchor.lat,
        lon: anchor.lon,
        awardedTs: award.awarded_ts,
      });
    }
  }

  const days = tripDays(runs, stamps, localStartOfDay);
  return {
    tripId: trip.id,
    startedTs: trip.started_ts,
    endTs: trip.ended_ts ?? nowMs,
    lines: roads.lines,
    litM: roads.lengthM,
    days,
    stampCount: stamps.length,
  };
}

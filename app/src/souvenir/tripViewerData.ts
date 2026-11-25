/**
 * What the trip viewer shows, read from the phone (T-253, D-099).
 *
 * The impure half of `tripDays.ts`: it reads the trip on show, its lit roads
 * and its stamps, and hands them to the pure module with the phone's own
 * midnight. Nothing here leaves the phone, so nothing here is masked.
 */

import { getContentPack } from '../content/poiCatalogue';
import { representativeGeofence } from '../map/placeMarkers';
import { roadLinesFor, storedRoadsFor, timedRunsFor } from '../matching/roadNetwork';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import { localStartOfDay, tripDays, type TripDay, type ViewerStamp } from './tripDays';

export type TripView = {
  tripId: number;
  startedTs: number;
  /** The trip's end, or now for a trip still open. */
  endTs: number;
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
 *
 * `stored` reads the chains the map last matched and stored: at once, but
 * without anything recorded since the map last matched (positions arriving
 * while the app is open). `matched` matches those too, which took 0.8 to 1.2 s
 * on the P30 whenever any had arrived. The viewer shows the first and then
 * the second, if it differs (`sameDays`).
 */
export async function loadTripView(
  tripId: number | undefined,
  source: 'stored' | 'matched',
  nowMs: number = Date.now(),
): Promise<TripView | null> {
  const trip =
    tripId === undefined ? await tripDao.getTripOnShow() : await tripDao.getTrip(tripId);
  if (trip === null) {
    return null;
  }

  // Read before the roads: a fix arriving meanwhile then makes the next look stale, not this one fresh.
  const key = freshnessKey(trip.id);
  key.catch(() => undefined); // awaited at the end; a failure before then is not left unhandled

  // A trip with nothing stored under this matcher (the map has not shown it
  // since an update changed the matcher) is matched whichever was asked for.
  const stored = source === 'stored' ? await storedRoadsFor([trip.id]) : null;
  let runs = stored?.runs.get(trip.id) ?? [];
  let litM = stored?.litM.get(trip.id) ?? 0;
  if (runs.length === 0) {
    const roads = await roadLinesFor(trip.id, await rawFixDao.getTraceFixes(trip.id));
    runs = await timedRunsFor(trip.id);
    litM = roads.lengthM;
  }

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
  const view = {
    tripId: trip.id,
    startedTs: trip.started_ts,
    endTs: trip.ended_ts ?? nowMs,
    litM,
    days,
    stampCount: stamps.length,
  };
  remember(view, source, await key);
  return view;
}

/**
 * The view last made of this trip, while nothing it was made from has changed
 * (no fix recorded, no stamp earned since): the viewer opens on it at once.
 * `upToDate` when it was the matched one, so there is nothing to match again.
 *
 * Opening *Viagem* read the stored view (0.4 s on the P30, trip 31), showed
 * it, then matched the trip again behind it (0.4 s, seconds when anything new
 * had been recorded) and, on the lead's trip, found the same days every time.
 */
export async function rememberedTripView(tripId: number | undefined): Promise<{ view: TripView; upToDate: boolean } | null> {
  const trip = tripId === undefined ? await tripDao.getTripOnShow() : await tripDao.getTrip(tripId);
  if (trip === null) return null;
  const entry = remembered.get(trip.id);
  if (entry === undefined || entry.key !== (await freshnessKey(trip.id))) return null;
  return { view: entry.view, upToDate: entry.source === 'matched' };
}

/** Reads the trip's view ahead (the passport, before *Viagem* is tapped); nothing if it is remembered. */
export async function readTripViewAhead(tripId: number | undefined): Promise<void> {
  if ((await rememberedTripView(tripId)) === null) await loadTripView(tripId, 'stored');
}

/** What a view was made from: the trip's fixes and stamps, and the day (an open trip's days end today). */
async function freshnessKey(tripId: number): Promise<string> {
  const [count, last, awards] = await Promise.all([rawFixDao.countFixes(tripId), rawFixDao.getLastFix(tripId), stampAwardDao.getAwards(tripId)]);
  return [tripId, count, last?.ts ?? 0, awards.length, localStartOfDay(Date.now())].join(':');
}

const remembered = new Map<number, { key: string; source: 'stored' | 'matched'; view: TripView }>();

function remember(view: TripView, source: 'stored' | 'matched', key: string): void {
  const kept = remembered.get(view.tripId);
  // A stored view never replaces a matched one made from the same.
  if (kept !== undefined && kept.key === key && kept.source === 'matched' && source === 'stored') return;
  remembered.set(view.tripId, { key, source, view });
  // A few trips at most: the passport's list can open any of them.
  if (remembered.size > 4) remembered.delete(remembered.keys().next().value as number);
}

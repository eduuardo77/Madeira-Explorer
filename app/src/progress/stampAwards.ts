/**
 * Running the stamp rules over a trip (T-071).
 *
 * The judgement is in `stampRules.ts` and is pure. This is the part that reads
 * the crossings, asks the database about speed, and writes the awards.
 *
 * WHY IT IS A PASS AND NOT A LISTENER
 * -----------------------------------
 * The obvious design — award the stamp the instant a geofence exit arrives —
 * is wrong here for two reasons. A visit is only judgeable once it is over (or
 * has run long enough), and geofence events arrive in a headless process whose
 * only job should be writing them down as fast as possible (D-010). So the
 * recorder captures, and this recomputes on demand: when the app opens, and at
 * trip end (T-101).
 *
 * It is safe to run at any time, as often as you like. Every award is
 * idempotent on `(trip, place)` and the whole thing is derived data
 * (CONTEXT §6.2) — which is exactly what lets T-131 retune the thresholds
 * later and re-run this over holidays already recorded.
 */

import { getContentPack } from '../content/poiCatalogue';
import * as geofenceEventDao from '../storage/dao/geofenceEventDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import type { GeofenceCrossing, SpeedWindow } from './stampRules';
import { judgePlace, reconstructVisits, speedWindowFor } from './stampRules';

export type AwardPassResult = {
  /** Places judged — i.e. places with at least one crossing. */
  considered: number;
  /** Stamps that qualified, including ones already recorded. */
  qualified: number;
  /** Stamps written for the first time by this run. */
  newlyAwarded: string[];
};

const EMPTY: AwardPassResult = {
  considered: 0,
  qualified: 0,
  newlyAwarded: [],
};

/**
 * Judge every place the user has crossed, and record what they earned.
 *
 * Never throws — it is called from screen mount and will later be called from
 * trip-end finalisation, and neither should be able to fail because a stamp
 * could not be worked out.
 */
export async function runAwardPass(
  asOfTs: number = Date.now()
): Promise<AwardPassResult> {
  try {
    const trip = await tripDao.getActiveTrip();
    if (trip === null) {
      return EMPTY;
    }

    const pack = getContentPack();
    if (pack.places.length === 0) {
      // No content yet (T-066). Nothing to award, and not an error.
      return EMPTY;
    }

    const events = await geofenceEventDao.getAllEvents(trip.id);
    if (events.length === 0) {
      return EMPTY;
    }

    // Crossings arrive keyed by geofence id; the rules are applied per place,
    // and a levada owns two geofences (D-034). Group once rather than scanning
    // the event list per place.
    const crossingsByGeofence = new Map<string, GeofenceCrossing[]>();
    for (const event of events) {
      const list = crossingsByGeofence.get(event.poi_id);
      const crossing: GeofenceCrossing = {
        geofenceId: event.poi_id,
        ts: event.ts,
        eventType: event.event_type,
      };
      if (list === undefined) {
        crossingsByGeofence.set(event.poi_id, [crossing]);
      } else {
        list.push(crossing);
      }
    }

    // `judgePlace` is synchronous and pure, so it cannot await a database
    // query mid-judgement. The fix is to work out which windows it will ask
    // about *before* calling it: the visits are reconstructed here with the
    // same pure function the rules use, their speed is fetched, and the lookup
    // handed in is then a plain map read.
    const speedCache = new Map<string, SpeedWindow>();
    const cacheKey = (fromTs: number, toTs: number) => `${fromTs}-${toTs}`;

    const alreadyAwarded = await stampAwardDao.getAwardedPlaceIds(trip.id);
    const result: AwardPassResult = {
      considered: 0,
      qualified: 0,
      newlyAwarded: [],
    };

    for (const place of pack.places) {
      const crossings = place.geofences.flatMap(
        (geofence) => crossingsByGeofence.get(geofence.id) ?? []
      );
      if (crossings.length === 0) {
        continue;
      }
      result.considered += 1;

      for (const visit of reconstructVisits(crossings, asOfTs)) {
        const { fromTs, toTs } = speedWindowFor(visit);
        const key = cacheKey(fromTs, toTs);
        if (!speedCache.has(key)) {
          speedCache.set(
            key,
            await rawFixDao.getSpeedBetween(trip.id, fromTs, toTs)
          );
        }
      }

      const decision = judgePlace(
        place,
        crossings,
        (fromTs, toTs) =>
          // An absent entry can only mean a window the rules asked about but
          // the loop above did not anticipate. Reporting "no speed data" is
          // the safe reading: it costs confidence, never a false award.
          speedCache.get(cacheKey(fromTs, toTs)) ?? {
            meanSpeedMps: null,
            fixCount: 0,
          },
        asOfTs
      );

      if (!decision.awarded || decision.awardedTs === null) {
        continue;
      }
      result.qualified += 1;
      if (alreadyAwarded.has(place.id)) {
        continue;
      }

      const written = await stampAwardDao.award({
        trip_id: trip.id,
        place_id: place.id,
        awarded_ts: decision.awardedTs,
        dwell_seconds: decision.dwellSeconds,
        mean_speed_mps: decision.meanSpeedMps,
        confidence: decision.confidence,
        reason: decision.reason,
      });

      if (written) {
        result.newlyAwarded.push(place.id);
        await recordingEventDao.log(
          'stamp',
          `${place.name}: ${decision.reason} (confidence ${decision.confidence.toFixed(2)})`
        );
      }
    }

    return result;
  } catch (error) {
    await recordingEventDao.logError('stamp award pass', error);
    return EMPTY;
  }
}

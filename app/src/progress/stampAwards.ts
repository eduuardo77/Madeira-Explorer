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

import type { Place } from '../content/contentPack';
import { getContentPack } from '../content/poiCatalogue';
import { getLevadaCourse } from '../content/levadaCourses';
import * as geofenceEventDao from '../storage/dao/geofenceEventDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import { findArrivals, judgeArrivals } from './arrivalFromTrace';
import type { TraceFix } from './levadaCoverage';
import { computeCoverage, judgeCoverage } from './levadaCoverage';
import type { GeofenceCrossing, SpeedWindow } from './stampRules';
import { judgePlace, reconstructVisits, speedWindowFor } from './stampRules';

export type AwardPassResult = {
  /** Places judged — i.e. places with at least one crossing. */
  considered: number;
  /** Stamps that qualified, including ones already recorded. */
  qualified: number;
  /** Stamps written for the first time by this run. */
  newlyAwarded: string[];
  /**
   * Levadas with real evidence of a walk that fell short of the bar (D-065):
   * the user should be asked, not silently refused.
   *
   * ⚠ **Nothing shows these to anybody yet — T-149.** They are written to the
   * diary so the evidence exists, and returned here so the screen that will
   * ask has something to read. Until that screen exists this is a list nobody
   * sees, which is a state this project has been bitten by twice (T-145,
   * T-146); it is called out in TASKS rather than left to be discovered.
   */
  awaitingConfirmation: { placeId: string; evidence: string }[];
};

const EMPTY: AwardPassResult = {
  considered: 0,
  qualified: 0,
  newlyAwarded: [],
  awaitingConfirmation: [],
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
      awaitingConfirmation: [],
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

    // Both trace-based detectors read the same fixes, so they are read once.
    const traceCandidates = getContentPack().places.filter(
      (place) => !alreadyAwarded.has(place.id) && !result.newlyAwarded.includes(place.id)
    );
    if (traceCandidates.length > 0) {
      const fixes = await rawFixDao.getTraceFixes(trip.id);
      if (fixes.length > 0) {
        await creditLevadasByCoverage(traceCandidates, fixes, trip.id, result, asOfTs);
        await creditArrivalsFromTrace(traceCandidates, fixes, trip.id, result);
      }
    }

    return result;
  } catch (error) {
    await recordingEventDao.logError('stamp award pass', error);
    return EMPTY;
  }
}

/**
 * The second way to earn a levada: having walked it (D-065).
 *
 * ⚠ **This runs for levadas the loop above never even considered.** That loop
 * starts from geofence crossings, so a levada whose endpoint geofence never
 * fired — a lost crossing under canopy, an endpoint in the wrong place, an
 * out-and-back walk that only ever reaches one trailhead — is skipped before
 * any rule is applied to it. The trace knows perfectly well where the user
 * spent their afternoon; nothing was asking it.
 *
 * The two paths are deliberately independent. The geofence path is cheap,
 * works in the background and needs no trace; this one needs the whole trace
 * but no crossings at all. A stamp earned either way is the same stamp, and
 * the `reason` on the award row says which — so a retune (T-131) can tell them
 * apart afterwards.
 */
async function creditLevadasByCoverage(
  candidates: readonly Place[],
  fixes: readonly TraceFix[],
  tripId: number,
  result: AwardPassResult,
  asOfTs: number
): Promise<void> {
  for (const place of candidates.filter((place) => place.category === 'levada')) {
    const course = getLevadaCourse(place.id);
    if (course === null) {
      // No drawn course, so there is nothing to be beside. Normal for a levada
      // whose name did not match OSM — `validate-content.mjs` warns about it.
      continue;
    }

    const coverage = computeCoverage(course.features[0].geometry.coordinates, fixes);
    if (coverage.fixesOnCourse === 0) {
      continue;
    }

    const verdict = judgeCoverage(coverage);
    result.considered += 1;

    if (verdict.offerConfirmation) {
      // The evidence travels with the id: the screen that asks must not
      // recompute D-065's arithmetic, because a second implementation is free
      // to disagree with the first.
      result.awaitingConfirmation.push({ placeId: place.id, evidence: verdict.reason });
      await recordingEventDao.log(
        'stamp',
        `${place.name}: ${verdict.reason} — not awarded, worth asking (T-149)`
      );
      continue;
    }
    if (!verdict.credited) {
      continue;
    }

    result.qualified += 1;
    const written = await stampAwardDao.award({
      trip_id: tripId,
      place_id: place.id,
      awarded_ts: asOfTs,
      // Dwell and speed belong to the geofence path; this one measured neither,
      // and inventing a number to fill a column is what ARCHITECTURE §10 forbids.
      dwell_seconds: null,
      mean_speed_mps: coverage.paceMps,
      confidence: verdict.confidence,
      reason: `coverage: ${verdict.reason}`,
    });

    if (written) {
      result.newlyAwarded.push(place.id);
      await recordingEventDao.log(
        'stamp',
        `${place.name}: ${verdict.reason} (confidence ${verdict.confidence.toFixed(2)})`
      );
    }
  }
}

/**
 * The second way to earn any other place: the trace shows you stood there
 * (D-065).
 *
 * ⚠ **This is the redundancy for the single point of failure under everything
 * else.** Every stamp in the app depends on the OS delivering a geofence
 * crossing, and `arrivalFromTrace.ts` lists the ordinary ways that does not
 * happen — battery saver, Doze, an OEM process killer, a working set that had
 * not registered the place yet, or T-145's case where nothing was registered
 * at all. The recorder kept writing through every one of them.
 *
 * Levadas are excluded: they have their own, better answer in coverage, and
 * awarding one for standing at a trailhead is the exact failure D-009 wrote
 * the two-endpoint rule to prevent.
 */
async function creditArrivalsFromTrace(
  candidates: readonly Place[],
  fixes: readonly TraceFix[],
  tripId: number,
  result: AwardPassResult
): Promise<void> {
  for (const place of candidates) {
    if (place.category === 'levada' || result.newlyAwarded.includes(place.id)) {
      continue;
    }

    const arrivals = place.geofences.flatMap((geofence) => findArrivals(geofence, fixes));
    if (arrivals.length === 0) {
      continue;
    }

    const verdict = judgeArrivals(arrivals);
    result.considered += 1;
    if (!verdict.awarded || verdict.awardedTs === null) {
      continue;
    }

    result.qualified += 1;
    const written = await stampAwardDao.award({
      trip_id: tripId,
      place_id: place.id,
      awarded_ts: verdict.awardedTs,
      dwell_seconds: verdict.dwellSeconds,
      mean_speed_mps: verdict.meanSpeedMps,
      confidence: verdict.confidence,
      // Marked, so the two detectors can be told apart in the award rows when
      // T-131 retunes them.
      reason: `trace: ${verdict.reason}`,
    });

    if (written) {
      result.newlyAwarded.push(place.id);
      await recordingEventDao.log(
        'stamp',
        `${place.name}: ${verdict.reason} (confidence ${verdict.confidence.toFixed(2)})`
      );
    }
  }
}

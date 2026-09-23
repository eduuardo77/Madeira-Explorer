/**
 * Running trip-end detection, and firing the reveal (T-099, T-100, T-101, T-102).
 *
 * The judgement is in `tripEnd.ts` and is pure. This gathers the evidence,
 * asks it, and — once — closes the trip and sends the notification D-012 calls
 * the best moment in the entire product.
 *
 * WHEN IT RUNS
 * ------------
 * On every geofence crossing (so the departure lounge is caught within minutes
 * of arriving at the airport) and on app launch (so a trip that ended while
 * the app was closed is finalised the next time anybody looks).
 *
 * WHAT "FINALISE" MEANS (T-101)
 * -----------------------------
 * Run the stamp award pass one last time, then close the trip. After D-032
 * there is no matching left to finalise — the trace is drawn raw — so this is
 * a much smaller step than T-101 was written expecting. What matters is that
 * the reveal never shows a stamp the user earned but the app had not yet
 * judged.
 */

import { getContentPack } from '../content/poiCatalogue';
import * as geofenceEventDao from '../storage/dao/geofenceEventDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import { truncateWal } from '../storage/database';
import { deviceLanguage, n, t } from '../i18n';
import { sendTripNotification } from '../notify/sendTripNotification';
import { getCurrentProgress } from './currentProgress';
import { runAwardPass } from './stampAwards';
import type { GeofenceCrossing } from './stampRules';
import { reconstructVisits } from './stampRules';
import type { TripEndDecision } from './tripEnd';
import { revealTitle, detectTripEnd, isOutsideBounds } from './tripEnd';

/**
 * The archipelago's bounds. ⚠ Moved to `content/archipelagoBounds.ts` for
 * T-171: the recorder now asks the same question before it opens a trip, and
 * two copies of this box would let the rule that ENDS a trip disagree with the
 * rule that STARTS one — which is precisely the loop T-171 fixes.
 */
import { ARCHIPELAGO_BOUNDS as BOUNDS } from '../content/archipelagoBounds';

const NOT_ENDED: TripEndDecision = {
  ended: false,
  method: null,
  endedTs: null,
  reason: 'no active trip',
};

/**
 * Check whether the trip is over; if it is, finalise it and reveal.
 *
 * Never throws. Returns the decision so the debug screen can show what it
 * would do without anybody having to fly home.
 */
export async function checkTripEnd(
  now: number = Date.now()
): Promise<TripEndDecision> {
  try {
    const trip = await tripDao.getActiveTrip();
    if (trip === null) {
      return NOT_ENDED;
    }

    const pack = getContentPack();
    const departureIds = new Set(
      pack.departurePoints.map((point) => point.id)
    );

    const events = await geofenceEventDao.getAllEvents(trip.id);

    const departureCrossings: GeofenceCrossing[] = [];
    let hasTravelledElsewhere = false;
    for (const event of events) {
      if (departureIds.has(event.poi_id)) {
        departureCrossings.push({
          geofenceId: event.poi_id,
          ts: event.ts,
          eventType: event.event_type,
        });
      } else {
        // Any crossing of a curated place is proof the holiday happened —
        // which is what separates going home from having just landed.
        hasTravelledElsewhere = true;
      }
    }

    // The fallback that means they physically left. Scanning the trace is
    // affordable here because this runs on crossings and launches, not per
    // fix (CONTEXT §6.3).
    let leftBoundsTs: number | null = null;
    const fixes = await rawFixDao.getTraceFixes(trip.id);
    for (const fix of fixes) {
      // A wildly inaccurate fix must not end somebody's holiday.
      if (fix.accuracy_m !== null && fix.accuracy_m > 200) {
        continue;
      }
      if (isOutsideBounds(fix, BOUNDS)) {
        leftBoundsTs = fix.ts;
        break;
      }
      if (!hasTravelledElsewhere) {
        // No curated places crossed — fall back to "were they ever far from
        // the airports?", so a pack with no content still ends its trips.
        hasTravelledElsewhere = pack.departurePoints.every(
          (point) =>
            Math.abs(fix.lat - point.lat) > 0.05 ||
            Math.abs(fix.lon - point.lon) > 0.05
        );
      }
    }

    const lastFix = fixes.length > 0 ? fixes[fixes.length - 1] : null;

    const decision = detectTripEnd({
      tripStartedTs: trip.started_ts,
      now,
      departureVisits: reconstructVisits(departureCrossings, now),
      hasTravelledElsewhere,
      leftBoundsTs,
      lastFixTs: lastFix?.ts ?? null,
    });

    if (!decision.ended || decision.method === null) {
      return decision;
    }

    // T-101: judge everything before revealing anything. The reveal must never
    // show a stamp the user earned and the app had not got round to awarding.
    await runAwardPass(now);

    await tripDao.endTrip(trip.id, decision.method);
    await recordingEventDao.log(
      'trip_end',
      `${decision.method}: ${decision.reason}`
    );

    await sendReveal();

    // T-178: fold the trip into the database file and cut the WAL back, so the
    // copy auto-backup takes is small and complete. After the reveal, which is
    // the moment that matters and must not wait on disk I/O. Never throws.
    await truncateWal('trip_end');
    return decision;
  } catch (error) {
    await recordingEventDao.logError('trip end', error);
    return NOT_ENDED;
  }
}

/**
 * The reveal (T-102) — the second and last notification of the trip (D-011).
 *
 * The copy has one job: get somebody in a departure lounge to open the app.
 * It leads with the number they earned, because that is the thing they will
 * want to see and the thing they might share (D-013).
 */
async function sendReveal(): Promise<void> {
  const progress = await getCurrentProgress();

  // ⚠ T-190: this and the title were English on every phone until 2026-09-23.
  const body =
    progress.total === 0
      ? t('reveal.bodyNoPlaces')
      : n('reveal.body', progress.collected);

  // Through the one door, which owns the D-011 cap (T-116). The island's name
  // comes from the content pack, never from a literal here (D-017, T-116a).
  await sendTripNotification(
    'reveal',
    revealTitle(getContentPack().destination, deviceLanguage()),
    body
  );
}

/**
 * When does a place become a stamp? (T-071, implementing D-009)
 *
 * THIS IS THE REWARD
 * ------------------
 * Stamps are the score (D-002), and after the v1 scope cut they are very
 * nearly the whole product (D-032). Everything else — the recorder, the
 * geofence window, the map — exists so that this file can say "yes, you were
 * there". It is also the cheapest subsystem in the project, which is precisely
 * why the reward was hung on it.
 *
 * THE RULE, FROM D-009
 * --------------------
 *   > Be generous filling in gaps between things you are certain about.
 *   > Be strict about what you are certain about.
 *
 * Which splits cleanly into two questions, and this file only answers the
 * strict one: **were they actually there?** Two gates, both required:
 *
 *   1. **Dwell.** Long enough inside the geofence to have stopped. A car
 *      crossing a 200 m circle at 60 km/h is inside for twelve seconds.
 *   2. **Speed.** Slow enough, while inside, to have been on foot. This is the
 *      second line of defence for the case dwell cannot catch — sitting in
 *      traffic, or parked at a red light inside a generous radius.
 *
 * D-009's table states the outcome directly: *"In a POI geofence for N minutes
 * at walking pace → award"*, *"Passing a POI geofence at 60 km/h → do not"*.
 *
 * LEVADAS ARE A DIFFERENT SHAPE
 * -----------------------------
 * Every other category means *you arrived somewhere*. A levada stamp means
 * *you walked the whole thing*, so it needs **both** endpoint geofences
 * (D-009, design brief §4) — which the content pack models as `start` and
 * `end` roles (D-034).
 *
 * The naive version of that rule is dangerous: two trailheads are often
 * twenty minutes apart *by road*, so "entered both" would hand the stamp to
 * somebody who drove between them. The fix is D-009's own sentence, applied
 * literally — **credit the connection, verify the endpoints.** Each endpoint
 * must independently pass a dwell-and-speed gate. Drive past a trailhead and
 * you fail it there, before the connection is ever considered.
 *
 * Pure: no database, no clock, no Expo. Tested in `stampRules.test.ts`.
 */

import type { GeofenceRole, Place } from '../content/contentPack.ts';

/**
 * ⚠ NONE OF THESE NUMBERS IS TUNED. They are reasoned starting points; T-131
 * retunes them against real trip data, which is possible without re-collecting
 * anything because every award stores what it was judged on (T-072, D-009).
 */

/**
 * How long inside a place's geofence counts as having arrived.
 *
 * Three minutes is long enough to exclude every form of passing through and
 * short enough for the briefest real visit — pulling over at a miradouro,
 * photographing it, leaving.
 */
export const MIN_DWELL_SECONDS = 180;

/**
 * How long inside a *levada endpoint* counts. Shorter, because nobody lingers
 * at a trailhead: you park, faff with boots, and start walking. One minute
 * still comfortably excludes driving past — a 400 m trailhead radius at
 * 50 km/h is under thirty seconds.
 */
export const MIN_ENDPOINT_DWELL_SECONDS = 60;

/**
 * Mean speed while inside, above which this was not a visit.
 *
 * 2 m/s is 7.2 km/h — brisk walking. Deliberately above walking pace rather
 * than at it, because a generous geofence (D-032 wants generous radii at
 * trailheads) can include the approach road, and a few seconds of driving
 * inside the circle should not veto a genuine forty-minute visit.
 *
 * Note this is *not* the walking-vs-driving discrimination D-028 deferred as
 * unreliable. That asked "what is the user doing right now" from speed alone.
 * This asks the far easier question: "averaged over several minutes in one
 * small circle, did they stop?"
 */
export const MAX_ARRIVAL_SPEED_MPS = 2.0;

/**
 * The minimum plausible time to walk a levada, end to end.
 *
 * A second guard on the drive-between-trailheads case, and a cheap one. The
 * shortest levada worth curating is a good half hour on foot; twenty minutes
 * leaves margin for the shortest of them without admitting a road journey.
 */
export const MIN_LEVADA_SECONDS = 20 * 60;

/**
 * The maximum, beyond which the two endpoint visits are probably unrelated —
 * a trailhead seen on Tuesday and the far end on Friday is not one walk.
 */
export const MAX_LEVADA_SECONDS = 14 * 3600;

/**
 * How many times the dwell threshold counts as maximal evidence of presence.
 *
 * Confidence must keep discriminating well past the pass mark, or every
 * comfortable award saturates at 1.0 and the stored number stops carrying the
 * information T-131 needs to retune against. Three times the threshold — nine
 * minutes at a viewpoint — is "unambiguously stopped here".
 */
const FULL_CONFIDENCE_DWELL_MULTIPLE = 3;

/** One crossing of one geofence, as recorded (`geofence_event`). */
export type GeofenceCrossing = {
  geofenceId: string;
  ts: number;
  eventType: 'enter' | 'exit' | 'dwell';
};

/** A period spent inside one geofence, reconstructed from crossings. */
export type Visit = {
  geofenceId: string;
  enteredTs: number;
  /** null when the exit was never recorded — still inside, or the event was lost. */
  exitedTs: number | null;
  /** Seconds inside, measured to the exit or to `asOfTs` if still inside. */
  dwellSeconds: number;
};

/** What the caller must be able to answer about the recorded trace. */
export type SpeedWindow = {
  /** null when no fix in the window reported a speed. */
  meanSpeedMps: number | null;
  /** How many fixes backed that mean. Zero means we know nothing. */
  fixCount: number;
};

export type SpeedLookup = (fromTs: number, toTs: number) => SpeedWindow;

export type StampDecision = {
  placeId: string;
  awarded: boolean;
  /** Written to the diary and to the award row. Always explains itself. */
  reason: string;
  awardedTs: number | null;
  dwellSeconds: number | null;
  meanSpeedMps: number | null;
  /** 0–1, stored on the award, never shown to the user (D-009, T-072). */
  confidence: number;
};

/**
 * Turn a stream of crossings into visits.
 *
 * The OS is not tidy about this. Enters can repeat without an intervening
 * exit (a user loitering on the boundary), exits can arrive with no enter (the
 * app was installed inside the geofence), and the final exit is often missing
 * entirely. Each of those is handled rather than assumed away, because every
 * one of them will happen on somebody's holiday.
 */
export function reconstructVisits(
  crossings: GeofenceCrossing[],
  asOfTs: number
): Visit[] {
  const ordered = crossings
    .filter((crossing) => crossing.eventType !== 'dwell')
    .slice()
    .sort((a, b) => a.ts - b.ts);

  const visits: Visit[] = [];
  const openByGeofence = new Map<string, number>();

  for (const crossing of ordered) {
    const open = openByGeofence.get(crossing.geofenceId);

    if (crossing.eventType === 'enter') {
      // A repeated enter is not a new visit — the user never left as far as we
      // know. Keep the earlier timestamp, which is the generous reading.
      if (open === undefined) {
        openByGeofence.set(crossing.geofenceId, crossing.ts);
      }
      continue;
    }

    // An exit with no enter: the app was started inside, or the enter was
    // lost. Dropping it is right — we cannot say how long they had been there,
    // and inventing a duration is exactly the fabrication ARCHITECTURE §10
    // forbids.
    if (open === undefined) {
      continue;
    }

    visits.push({
      geofenceId: crossing.geofenceId,
      enteredTs: open,
      exitedTs: crossing.ts,
      dwellSeconds: Math.max(0, Math.round((crossing.ts - open) / 1000)),
    });
    openByGeofence.delete(crossing.geofenceId);
  }

  // Still inside. Measured to now, so a stamp can be awarded while the user is
  // standing there rather than only once they have walked away.
  for (const [geofenceId, enteredTs] of openByGeofence) {
    visits.push({
      geofenceId,
      enteredTs,
      exitedTs: null,
      dwellSeconds: Math.max(0, Math.round((asOfTs - enteredTs) / 1000)),
    });
  }

  return visits.sort((a, b) => a.enteredTs - b.enteredTs);
}

/**
 * The time window a visit's mean speed is judged over.
 *
 * Exported because the caller has to fetch that window from the database
 * before it can answer `SpeedLookup` — and if the two disagreed by a
 * millisecond, every cache lookup would miss and every stamp would be judged
 * as though speed were unknown. One definition, used by both.
 */
export function speedWindowFor(visit: Visit): { fromTs: number; toTs: number } {
  return { fromTs: visit.enteredTs, toTs: visit.exitedTs ?? visit.enteredTs };
}

type GateResult = {
  passed: boolean;
  reason: string;
  meanSpeedMps: number | null;
  confidence: number;
};

/**
 * Did this visit clear both gates?
 *
 * Confidence is deliberately crude and deliberately stored: it records *how
 * comfortably* rather than merely *whether*, so that when T-131 retunes the
 * thresholds against real data, a borderline award can be told apart from an
 * obvious one without re-collecting a single fix.
 */
function checkVisit(
  visit: Visit,
  minDwellSeconds: number,
  speedAt: SpeedLookup
): GateResult {
  if (visit.dwellSeconds < minDwellSeconds) {
    return {
      passed: false,
      reason: `only ${visit.dwellSeconds}s inside, needs ${minDwellSeconds}s`,
      meanSpeedMps: null,
      confidence: 0,
    };
  }

  const bounds = speedWindowFor(visit);
  const window = speedAt(bounds.fromTs, bounds.toTs);

  // 0 at the pass mark, 1 once the visit is several times longer than it
  // needed to be. Both halves of the score are normalised to 0–1 so their sum
  // never has to be clamped — a clamped score stops discriminating between a
  // marginal award and an obvious one, which is the whole point of storing it.
  const dwellScore = Math.min(
    1,
    visit.dwellSeconds / (minDwellSeconds * FULL_CONFIDENCE_DWELL_MULTIPLE)
  );

  if (window.meanSpeedMps === null || window.fixCount === 0) {
    // No speed to judge. Not a veto: several minutes stationary inside a small
    // circle is already strong evidence, and refusing here would deny stamps
    // exactly where GPS is worst — under canopy, at the levada trailheads that
    // matter most (D-032). Awarded, but capped below anything a clean
    // two-gate pass can reach, so the difference is legible later.
    return {
      passed: true,
      reason: `${visit.dwellSeconds}s inside, no speed data`,
      meanSpeedMps: null,
      confidence: 0.6 * dwellScore,
    };
  }

  if (window.meanSpeedMps > MAX_ARRIVAL_SPEED_MPS) {
    return {
      passed: false,
      reason: `moving at ${window.meanSpeedMps.toFixed(1)} m/s inside`,
      meanSpeedMps: window.meanSpeedMps,
      confidence: 0,
    };
  }

  const speedScore = 1 - window.meanSpeedMps / MAX_ARRIVAL_SPEED_MPS;
  return {
    passed: true,
    reason: `${visit.dwellSeconds}s inside at ${window.meanSpeedMps.toFixed(1)} m/s`,
    meanSpeedMps: window.meanSpeedMps,
    confidence: 0.5 * dwellScore + 0.5 * speedScore,
  };
}

const NOT_AWARDED = (placeId: string, reason: string): StampDecision => ({
  placeId,
  awarded: false,
  reason,
  awardedTs: null,
  dwellSeconds: null,
  meanSpeedMps: null,
  confidence: 0,
});

/**
 * Decide whether a place has been earned.
 *
 * `crossings` are the recorded crossings of *this place's* geofences, in any
 * order. Deterministic and total: no clock of its own, no throwing.
 */
export function judgePlace(
  place: Place,
  crossings: GeofenceCrossing[],
  speedAt: SpeedLookup,
  asOfTs: number
): StampDecision {
  const visits = reconstructVisits(crossings, asOfTs);
  if (visits.length === 0) {
    return NOT_AWARDED(place.id, 'never entered');
  }

  return place.category === 'levada'
    ? judgeLevada(place, visits, speedAt)
    : judgeArrival(place, visits, speedAt);
}

/** Every category except levada: one qualifying visit to any of its geofences. */
function judgeArrival(
  place: Place,
  visits: Visit[],
  speedAt: SpeedLookup
): StampDecision {
  let best: GateResult | null = null;
  let bestVisit: Visit | null = null;

  for (const visit of visits) {
    const result = checkVisit(visit, MIN_DWELL_SECONDS, speedAt);
    if (!result.passed) {
      continue;
    }
    // Most confident wins; equal confidence goes to the longer visit, because
    // more time inside is more evidence and the award records what it was
    // judged on. Without the tie-break, "best" would quietly mean "first".
    const better =
      best === null ||
      result.confidence > best.confidence ||
      (result.confidence === best.confidence &&
        bestVisit !== null &&
        visit.dwellSeconds > bestVisit.dwellSeconds);
    if (better) {
      best = result;
      bestVisit = visit;
    }
  }

  if (best === null || bestVisit === null) {
    // Report the longest attempt: "you were there for 40s" is a far more
    // useful diary line than "not awarded".
    const longest = visits.reduce((a, b) =>
      a.dwellSeconds >= b.dwellSeconds ? a : b
    );
    return NOT_AWARDED(
      place.id,
      checkVisit(longest, MIN_DWELL_SECONDS, speedAt).reason
    );
  }

  return {
    placeId: place.id,
    awarded: true,
    reason: best.reason,
    // Earned at the moment the gate was cleared, not at the exit — which is
    // both truer and lets the award fire while the user is still standing
    // there.
    awardedTs: bestVisit.enteredTs + MIN_DWELL_SECONDS * 1000,
    dwellSeconds: bestVisit.dwellSeconds,
    meanSpeedMps: best.meanSpeedMps,
    confidence: best.confidence,
  };
}

/** Levadas: both endpoints verified, then the walk between them credited. */
function judgeLevada(
  place: Place,
  visits: Visit[],
  speedAt: SpeedLookup
): StampDecision {
  const idsFor = (role: GeofenceRole) =>
    new Set(
      place.geofences
        .filter((geofence) => geofence.role === role)
        .map((geofence) => geofence.id)
    );

  const startIds = idsFor('start');
  const endIds = idsFor('end');

  if (startIds.size === 0 || endIds.size === 0) {
    // A curation mistake, not a user failure — `tools/validate-content.mjs`
    // warns about it. Refuse rather than award half a levada.
    return NOT_AWARDED(place.id, 'levada has no start/end pair in the pack');
  }

  const qualifying = (ids: Set<string>): { visit: Visit; gate: GateResult } | null => {
    let found: { visit: Visit; gate: GateResult } | null = null;
    for (const visit of visits) {
      if (!ids.has(visit.geofenceId)) {
        continue;
      }
      const gate = checkVisit(visit, MIN_ENDPOINT_DWELL_SECONDS, speedAt);
      if (gate.passed && (found === null || gate.confidence > found.gate.confidence)) {
        found = { visit, gate };
      }
    }
    return found;
  };

  const start = qualifying(startIds);
  const end = qualifying(endIds);

  if (start === null || end === null) {
    return NOT_AWARDED(
      place.id,
      start === null && end === null
        ? 'neither end of the levada verified'
        : `only the ${start === null ? 'far end' : 'trailhead'} verified`
    );
  }

  // Endpoints are certain; now judge the connection between them.
  const first = Math.min(start.visit.enteredTs, end.visit.enteredTs);
  const last = Math.max(start.visit.enteredTs, end.visit.enteredTs);
  const elapsedSeconds = Math.round((last - first) / 1000);

  if (elapsedSeconds < MIN_LEVADA_SECONDS) {
    return NOT_AWARDED(
      place.id,
      `both ends in ${Math.round(elapsedSeconds / 60)} min — too fast to have walked it`
    );
  }
  if (elapsedSeconds > MAX_LEVADA_SECONDS) {
    return NOT_AWARDED(
      place.id,
      `ends visited ${Math.round(elapsedSeconds / 3600)}h apart — not one walk`
    );
  }

  return {
    placeId: place.id,
    awarded: true,
    reason: `walked end to end in ${Math.round(elapsedSeconds / 60)} min`,
    awardedTs: last,
    dwellSeconds: elapsedSeconds,
    meanSpeedMps: end.gate.meanSpeedMps ?? start.gate.meanSpeedMps,
    // Both endpoints had to be verified, so the weakest one governs. This is
    // the "strict about what you are certain about" half of D-009 expressed as
    // a number.
    confidence: Math.min(start.gate.confidence, end.gate.confidence),
  };
}

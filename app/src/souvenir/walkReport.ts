/**
 * A walk the user chooses to send back, so the guesses can become measurements
 * (OD-11, D-069).
 *
 * WHY THIS EXISTS, AND WHY IT IS SHAPED LIKE THIS
 * -----------------------------------------------
 * Almost every threshold in this app is a guess: the corridor width, the
 * 45 minutes, the dwell, the accuracy cut, the simplification tolerance. Each
 * one is marked NOT TUNED and each one can only be settled by real walks. The
 * project lead cannot walk all eleven levadas — *"it would be way better than
 * going by myself test all levadas"* — so the walks have to come from whoever
 * is using it.
 *
 * ⚠ **AND THIS APP COLLECTS NOTHING (D-001, D-031), WHICH IS THE POINT OF IT.**
 * The store declaration says nothing is collected and nothing is shared
 * (T-120, T-122), and that is the one thing WalkMe cannot copy. So the only
 * shape this can take is the one that keeps all of it true:
 *
 *   - **The user sends it. The app never does.** No endpoint, no account, no
 *     background upload, no "anonymous telemetry" that is collected by default.
 *     The report is a file, handed to the ordinary share sheet — the same
 *     mechanism as the souvenir (T-108), and the same thing D-001 has always
 *     permitted: *the trip never leaves the phone unless the user sends it.*
 *   - **It is the masked trace, through the export door.** `exportTrace.ts` is
 *     the only way a trace leaves (D-016, D-040), so a donated walk cannot
 *     reveal where somebody slept even if this module forgot to think about it.
 *   - **It carries no identifier of any kind.** No install id, no device name,
 *     no account, nothing that links two reports from the same phone. That
 *     costs real analytical power — you cannot tell one walker's ten walks from
 *     ten walkers' — and it is the right trade for an app whose whole position
 *     is that it knows nothing about you.
 *
 * WHAT IS IN IT, AND WHY EACH PIECE
 * ---------------------------------
 * Exactly the things needed to re-judge a walk on a laptop and see whether the
 * app got it right:
 *
 *   - **The masked fixes** — the only way to measure real GPS: how far it
 *     wanders under canopy, how often it drops, what accuracy it claims.
 *   - **Every stamp decision, awarded or not**, with the reason and the numbers
 *     it turned on. A refused walk is more valuable than an awarded one: it is
 *     the case where somebody walked a levada and the app said nothing.
 *   - **The thresholds in force**, so a report from an old version can still be
 *     read years later without guessing what the rules were that day.
 *
 * Pure: no database, no clock, no Expo. Tested in `walkReport.test.ts`.
 */

/** The current shape. Bumped whenever a field changes meaning, never reused. */
export const WALK_REPORT_SCHEMA = 1;

export type ReportFix = {
  ts: number;
  lat: number;
  lon: number;
  accuracy_m: number | null;
};

/** What the app decided about one place, and what it decided on. */
export type ReportDecision = {
  placeId: string;
  category: string;
  awarded: boolean;
  /** The app's own words: `"walked 2.1 km of 5.0 km (42%) over 96 min"`. */
  reason: string;
  confidence: number;
  dwellSeconds: number | null;
  meanSpeedMps: number | null;
};

export type WalkReportInput = {
  fixes: readonly ReportFix[];
  decisions: readonly ReportDecision[];
  /** `1.0.0` — so a report can be matched to the rules that produced it. */
  appVersion: string;
  /** Every NOT TUNED number that took part in a decision. */
  thresholds: Record<string, number>;
  /**
   * What the user is saying about the walk, if anything — the one field they
   * fill in. Optional, and the report is worth sending without it.
   */
  note?: string;
};

export type WalkReport = {
  schema: number;
  appVersion: string;
  /** Milliseconds, from the trace itself — never a wall clock at send time. */
  startedTs: number | null;
  endedTs: number | null;
  fixCount: number;
  fixes: ReportFix[];
  decisions: ReportDecision[];
  thresholds: Record<string, number>;
  note: string | null;
};

/**
 * Assemble the report.
 *
 * ⚠ **Nothing is added that was not asked for.** It is worth being boring here:
 * every extra field is something a user has to be told about, and the sentence
 * that makes this acceptable — *"it contains your walk and what the app decided,
 * and nothing that identifies you"* — has to stay literally true.
 */
export function buildWalkReport(input: WalkReportInput): WalkReport {
  const ordered = [...input.fixes].sort((a, b) => a.ts - b.ts);

  return {
    schema: WALK_REPORT_SCHEMA,
    appVersion: input.appVersion,
    startedTs: ordered[0]?.ts ?? null,
    endedTs: ordered[ordered.length - 1]?.ts ?? null,
    fixCount: ordered.length,
    fixes: ordered,
    decisions: [...input.decisions],
    thresholds: input.thresholds,
    note: input.note !== undefined && input.note.trim() !== '' ? input.note.trim() : null,
  };
}

/**
 * What the user is told before they send it, in the words they are told it in.
 *
 * ⚠ **Kept here, beside the thing it describes.** A consent sentence that lives
 * in a screen file drifts from what the payload actually contains the first
 * time somebody adds a field. If this file changes, this sentence is in the
 * diff.
 */
export function describeWalkReport(report: WalkReport): string {
  const walks = report.decisions.length;
  const minutes =
    report.startedTs === null || report.endedTs === null
      ? 0
      : Math.round((report.endedTs - report.startedTs) / 60000);

  return (
    `This sends ${report.fixCount} location points from ${minutes} minutes of your trip, ` +
    `and what the app decided about ${walks} ${walks === 1 ? 'place' : 'places'}. ` +
    `Where you slept has been removed. It contains no name, no account and nothing ` +
    `that identifies you or your phone. You choose where it goes.`
  );
}

/** The file, as it is written and sent. Stable key order, so diffs are readable. */
export function renderWalkReport(report: WalkReport): string {
  return JSON.stringify(report, null, 2);
}

/** A filename somebody can recognise in a share sheet. */
export function walkReportFilename(report: WalkReport): string {
  if (report.startedTs === null) {
    return 'madeira-walk.json';
  }
  return `madeira-walk-${new Date(report.startedTs).toISOString().slice(0, 10)}.json`;
}

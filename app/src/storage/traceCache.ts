/**
 * The trip's trace, kept in memory between reads (T-254).
 *
 * The stamp pass reads the whole trip once a minute while recording, and the
 * map, the viewer and the trip-end check read it too: 17,824 rows on the P30's
 * trip of 2026-10-07, growing all holiday. Rows are only ever added (`insertFixes`);
 * they leave only by erase-all and a backup restore, which call
 * `forgetTraceRows`. So a read asks the database only for the trip's row count
 * and newest id, and for the rows added since, and anything else unexpected
 * reloads from scratch: a stale trace would be worse than a slow one.
 *
 * The merge and the read plan are pure, tested in `traceCache.test.ts`; the
 * cache itself is one variable.
 */

export type TraceRow = {
  id: number;
  ts: number;
  lat: number;
  lon: number;
  accuracy_m: number | null;
  speed_mps: number | null;
};

export type CachedTrace = { tripId: number; maxId: number; count: number; rows: TraceRow[] };

/** What the database says about the trip now: its newest row id and how many rows. */
export type TraceHead = { maxId: number | null; count: number };

export type ReadPlan =
  | { kind: 'cached' }
  | { kind: 'append'; afterId: number }
  | { kind: 'reload' };

/**
 * How to bring `cache` up to `head`. Only rows newer than the cache's newest
 * may be read on their own; the count then has to come out right, which the
 * caller checks after reading (`appendedCountMatches`).
 */
export function planRead(cache: CachedTrace | null, tripId: number, head: TraceHead): ReadPlan {
  if (cache === null || cache.tripId !== tripId || head.maxId === null) return { kind: 'reload' };
  if (head.maxId === cache.maxId) return head.count === cache.count ? { kind: 'cached' } : { kind: 'reload' };
  if (head.maxId > cache.maxId && head.count > cache.count) return { kind: 'append', afterId: cache.maxId };
  return { kind: 'reload' };
}

/** After an append: the rows read must be exactly the ones the count says were added. */
export function appendedCountMatches(cache: CachedTrace, added: number, head: TraceHead): boolean {
  return cache.count + added === head.count;
}

/**
 * `existing` and `added`, both in (ts, id) order, as one list in that order:
 * the order `ORDER BY ts, id` gives, so a cached read equals a fresh one even
 * when a late batch brings fixes older than ones already stored.
 */
export function mergeAppended(existing: readonly TraceRow[], added: readonly TraceRow[]): TraceRow[] {
  const merged: TraceRow[] = [];
  let i = 0;
  let j = 0;
  const before = (a: TraceRow, b: TraceRow) => a.ts < b.ts || (a.ts === b.ts && a.id < b.id);
  while (i < existing.length && j < added.length) {
    merged.push(before(added[j], existing[i]) ? added[j++] : existing[i++]);
  }
  while (i < existing.length) merged.push(existing[i++]);
  while (j < added.length) merged.push(added[j++]);
  return merged;
}

let cached: CachedTrace | null = null;

export function cachedTrace(): CachedTrace | null {
  return cached;
}

export function keepTrace(trace: CachedTrace): void {
  cached = trace;
}

/** Erase-all and a restore: the rows the cache holds may no longer exist. */
export function forgetTraceRows(): void {
  cached = null;
}

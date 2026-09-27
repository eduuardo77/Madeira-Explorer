/**
 * Keeping matched chains between visits to the map, and where to resume (D-093).
 *
 * WHY THEY ARE KEPT AT ALL
 * ------------------------
 * Matching costs about a millisecond a moving fix on the P30 (measured
 * 2026-09-27), and Android ends the app's process whenever it likes. Without
 * keeping chains, every cold open of the map would rematch the whole trip
 * before its first line appeared: seconds, for a week's holiday. With them,
 * only what the recorder added since the last visit is matched.
 *
 * WHERE MATCHING CAN RESUME, EXACTLY
 * ----------------------------------
 * ⚠ **The first rule written here was wrong, and a test caught it.** It kept
 * every chain but the last as final. But a chain can end *because* of the
 * fixes near the end of what has been recorded so far: the motion gate and
 * the speed bound look 30 s ahead, and at the edge there is nothing ahead yet,
 * so a chain broke early and was then frozen broken.
 *
 * The rule now: **wherever the matcher starts a new chain, its state is
 * exactly that of a fresh start** (no previous layer, nothing skipped). So
 * matching resumed from any chain start, with the minute before it as context
 * (`MOTION_CONTEXT_MS`), reproduces the whole-trip result from there on,
 * provided the start is at least that minute older than the newest fix, so
 * that nothing still to come can change the decisions that led to it. The
 * matcher reports the latest such start (`matchTrace`'s `resumeTs`); chains
 * before it are kept, everything from it is matched again.
 * `chainStore.test.ts` matches a day visit by visit and checks the roads are
 * the same as matching it at once.
 *
 * Derived and regenerable (CONTEXT §6.2): kept only under the version of the
 * network and matcher that made it (`chainVersion`).
 *
 * Pure. Tested in `chainStore.test.ts`.
 */

import { MATCHER_VERSION } from './mapMatch.ts';
import type { MatchedChain } from './mapMatch.ts';

/** The version kept chains must carry to be reused. */
export function chainVersion(graphVersion: string): string {
  return `${graphVersion}:${MATCHER_VERSION}`;
}

/** A chain as a row, and back. */
export type StoredChain = {
  firstTs: number;
  lastTs: number;
  confidence: number;
  /** `[[edge, from, to], ...]`, offsets to the centimetre. */
  pieces: string;
  /** `[[ts, atM], ...]`. */
  anchors: string;
};

/** Where a trip's matching may resume, under which version. */
export type MatchProgress = { version: string; resumeTs: number };

const round = (metres: number): number => Math.round(metres * 100) / 100;

export function toStored(chain: MatchedChain): StoredChain {
  return {
    firstTs: chain.anchors[0].ts,
    lastTs: chain.anchors[chain.anchors.length - 1].ts,
    confidence: chain.confidence,
    pieces: JSON.stringify(chain.pieces.map((p) => [p.edge, round(p.from), round(p.to)])),
    anchors: JSON.stringify(chain.anchors.map((a) => [a.ts, round(a.atM)])),
  };
}

export function fromStored(row: StoredChain): MatchedChain {
  const pieces = JSON.parse(row.pieces) as [number, number, number][];
  const anchors = JSON.parse(row.anchors) as [number, number][];
  return {
    pieces: pieces.map(([edge, from, to]) => ({ edge, from, to })),
    anchors: anchors.map(([ts, atM]) => ({ ts, atM })),
    confidence: row.confidence,
  };
}

/**
 * From when to match again: the kept resume point under this version, or the
 * beginning of the trip.
 */
export function resumeFrom(progress: MatchProgress | null, version: string): number {
  if (progress === null || progress.version !== version) {
    return Number.NEGATIVE_INFINITY;
  }
  return progress.resumeTs;
}

/** The kept chains that stand: those that began before the resume point. */
export function keptBefore(stored: readonly StoredChain[], fromTs: number): StoredChain[] {
  return stored.filter((chain) => chain.firstTs < fromTs);
}

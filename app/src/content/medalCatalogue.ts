/**
 * Where the app gets its set medals from (T-234).
 *
 * Another file in `app/` that reaches into `content/`, for the reason
 * `regionCatalogue.ts` gives: which sets exist is Madeira knowledge and lives
 * there (D-017). Read once, at runtime, never from a network (D-001).
 */

import rawMedals from '../../../content/medals.json';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import { parseMedalPack, type MedalDefinition } from './medalPack';

let medals: MedalDefinition[] | null = null;

/** The medal sets, in content order. A malformed file gives none, logged. */
export function getMedals(): MedalDefinition[] {
  if (medals !== null) {
    return medals;
  }
  const parsed = parseMedalPack(rawMedals as unknown);
  medals = parsed.medals;
  // Logged, never thrown: a broken medal costs a medal, not the passport.
  for (const problem of parsed.problems.slice(0, 10)) {
    void recordingEventDao.logError('medal pack', `${problem.where}: ${problem.problem}`);
  }
  return medals;
}

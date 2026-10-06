/**
 * How far each set medal has got (T-234, D-089 rule 6, OQ-2, OQ-3).
 *
 * A medal is earned by collecting every place its rule picks out
 * (`content/medals.json`): all of a municipality's places, or all of a
 * category's. Medals are a paid add, so a free user **sees the progress** and,
 * once a set is complete, the medal **locked**; the moment the passport is
 * unlocked it is shown, from the stamps already earned (D-075: buying in month
 * three receives months one and two).
 *
 * Medals are not places: they never enter the passport's count or the rank
 * (OQ-2), so nothing here is read by `tripProgress.ts`.
 *
 * The same rules as the headline number (`tripProgress.ts`):
 *  - places come from the pack as it is now, so an award for a place that has
 *    since been removed counts for nothing, as the passport drops it;
 *  - places in a locked region (Porto Santo, D-024) are left out of every set,
 *    and a medal whose places are all locked is not shown at all.
 *
 * Pure: the definitions, the places and the awards come in. Tested in
 * `medals.test.ts`.
 */

import { inSet, type MedalDefinition, type MedalPlace, type MedalRule } from '../content/medalPack.ts';

/** The parts of an award a medal reads. */
export type MedalAward = { place_id: string; awarded_ts: number };

/**
 * `progress`: not every place collected yet, shown to everybody.
 * `complete`: every place collected, on an unlocked passport.
 * `locked`: every place collected, on a passport not yet unlocked (paid, D-089).
 */
export type MedalState = 'progress' | 'complete' | 'locked';

export type MedalProgress = {
  id: string;
  rule: MedalRule;
  /** The set's places, in content order. */
  placeIds: string[];
  collected: number;
  total: number;
  /** When the stamp that completed the set was earned; null until it is complete. */
  completedTs: number | null;
  state: MedalState;
};

/** Every medal's progress, in content order, leaving out any with no visible place. */
export function medalProgress(
  medals: readonly MedalDefinition[],
  places: readonly MedalPlace[],
  awards: readonly MedalAward[],
  unlocked: boolean,
  lockedRegionIds: ReadonlySet<string> = new Set()
): MedalProgress[] {
  // The earliest award per place: a place is collected once, when first earned.
  const earned = new Map<string, number>();
  for (const award of awards) {
    const before = earned.get(award.place_id);
    if (before === undefined || award.awarded_ts < before) earned.set(award.place_id, award.awarded_ts);
  }
  const visible = places.filter((place) => !lockedRegionIds.has(place.regionId));

  return medals.flatMap((medal): MedalProgress[] => {
    const members = visible.filter((place) => inSet(medal.rule, place));
    if (members.length === 0) return [];
    const times = members.flatMap((place) => {
      const ts = earned.get(place.id);
      return ts === undefined ? [] : [ts];
    });
    const complete = times.length === members.length;
    return [
      {
        id: medal.id,
        rule: medal.rule,
        placeIds: members.map((place) => place.id),
        collected: times.length,
        total: members.length,
        completedTs: complete ? Math.max(...times) : null,
        state: !complete ? 'progress' : unlocked ? 'complete' : 'locked',
      },
    ];
  });
}

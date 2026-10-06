/**
 * The set medals, as content defines them (T-234, D-089 rule 6, OQ-3).
 *
 * `content/medals.json` lists the sets; this reads it. A medal is earned by
 * collecting every place its rule picks out: all of a municipality's places,
 * or all of a category's. Which sets exist is the project lead's content, not
 * code (D-017), and adding one later is never a rug pull (OQ-3).
 *
 *     { "formatVersion": 1,
 *       "medals": [ { "id": "region-santana", "rule": { "region": "santana" } },
 *                   { "id": "category-levada", "rule": { "category": "levada" } } ] }
 *
 * Whether each rule picks out enough real places is checked against the pack
 * by `medalContentProblems` below, which the validator runs; how far each set
 * has got is `progress/medals.ts`.
 *
 * ⚠ **Never throws**, like `regionPack.ts`: a broken medal costs a medal, never
 * the passport. A malformed entry is dropped and reported.
 *
 * Pure: no Expo, no import of the JSON itself. Tested in `medalPack.test.ts`.
 */

import { CATEGORIES, type Category } from './contentPack.ts';

export type MedalRule = { region: string } | { category: Category };

export type MedalDefinition = {
  /** Stable: an earned medal is keyed by it. Never change one after release. */
  id: string;
  rule: MedalRule;
};

export type MedalProblem = { where: string; problem: string };

/** OQ-3: a set of fewer places than this earns no medal; the validator enforces it. */
export const MEDAL_MINIMUM = 3;

/** The parts of a content place a medal rule reads. */
export type MedalPlace = { id: string; category: Category; regionId: string };

/** Whether a place belongs to a medal's set. */
export function inSet(rule: MedalRule, place: MedalPlace): boolean {
  return 'region' in rule ? place.regionId === rule.region : place.category === rule.category;
}

export type ParsedMedalPack = { medals: MedalDefinition[]; problems: MedalProblem[] };

const SUPPORTED_FORMAT_VERSION = 1;

export function parseMedalPack(raw: unknown): ParsedMedalPack {
  const medals: MedalDefinition[] = [];
  const problems: MedalProblem[] = [];

  const root = raw as { formatVersion?: unknown; medals?: unknown } | null;
  if (root === null || typeof root !== 'object' || root.formatVersion !== SUPPORTED_FORMAT_VERSION) {
    problems.push({ where: 'medals.json', problem: `formatVersion must be ${SUPPORTED_FORMAT_VERSION}` });
    return { medals, problems };
  }
  if (!Array.isArray(root.medals)) {
    problems.push({ where: 'medals.json', problem: 'no `medals` array' });
    return { medals, problems };
  }

  const seen = new Set<string>();
  root.medals.forEach((entry, index) => {
    const where = `medals[${index}]`;
    const { id, rule } = (entry ?? {}) as { id?: unknown; rule?: unknown };
    if (typeof id !== 'string' || id.length === 0) {
      problems.push({ where, problem: 'missing or empty `id`' });
      return;
    }
    if (seen.has(id)) {
      problems.push({ where: `${where} (${id})`, problem: 'duplicate medal id' });
      return;
    }
    const parsed = parseRule(rule);
    if (parsed === null) {
      problems.push({
        where: `${where} (${id})`,
        problem: '`rule` must be { "region": "<region id>" } or { "category": "<category>" }',
      });
      return;
    }
    seen.add(id);
    medals.push({ id, rule: parsed });
  });

  return { medals, problems };
}

function parseRule(raw: unknown): MedalRule | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length !== 1) return null;
  const { region, category } = raw as { region?: unknown; category?: unknown };
  if (typeof region === 'string' && region.length > 0) return { region };
  if (typeof category === 'string' && (CATEGORIES as readonly string[]).includes(category)) {
    return { category: category as Category };
  }
  return null;
}

/**
 * What is wrong with the medal sets against the pack, for the validator
 * (OQ-3): a region that does not exist, or a set of fewer than
 * `MEDAL_MINIMUM` places (a medal for one stop is not a set). Empty when
 * every medal is sound.
 */
export function medalContentProblems(
  medals: readonly MedalDefinition[],
  places: readonly MedalPlace[],
  regionIds: ReadonlySet<string>
): string[] {
  const problems: string[] = [];
  for (const medal of medals) {
    if ('region' in medal.rule && !regionIds.has(medal.rule.region)) {
      problems.push(`${medal.id}: no region "${medal.rule.region}" in regions.json`);
      continue;
    }
    const count = places.filter((place) => inSet(medal.rule, place)).length;
    if (count < MEDAL_MINIMUM) {
      problems.push(`${medal.id}: ${count} place(s), a set needs at least ${MEDAL_MINIMUM} (OQ-3)`);
    }
  }
  return problems;
}

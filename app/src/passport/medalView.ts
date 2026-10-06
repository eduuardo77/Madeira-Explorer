/**
 * A set medal as the screens show it (T-235): its name, its title and its
 * drawing's words, worked out once for the passport's shelf, the trophy card
 * and the new-stamp pop-up, so the three can never call one medal two things.
 *
 * Not pure: it reads the region catalogue (the outline, the name) and the
 * phone's language. The decisions are in `progress/medals.ts` and
 * `content/medalPack.ts`; this only looks them up.
 */

import type { MedalDefinition, MedalRule } from '../content/medalPack';
import { medalTitle } from '../content/medalPack';
import { getRegion } from '../content/regionCatalogue';
import { deviceLanguage, t } from '../i18n';
import type { StringKey } from '../i18n/strings';
import type { MedalProgress } from '../progress/medals';
import type { SetMedalWords } from './medalArt';

/** The set's own name: the municipality ("Funchal"), or the category's plural ("Levadas"). */
export function medalSetName(rule: MedalRule): string {
  return 'region' in rule
    ? getRegion(rule.region)?.name ?? rule.region
    : t(`passport.category.${rule.category}` as StringKey);
}

/** The medal's title in the phone's language: content's ("Medalha do Funchal"), or the generic one. */
export function medalTitleFor(medal: MedalDefinition): string {
  return medalTitle(medal, deviceLanguage(), medalSetName(medal.rule));
}

/** What `medalArt.ts` needs to draw a medal as it stands. */
export function setMedalWordsFor(progress: MedalProgress): SetMedalWords {
  const rule = progress.rule;
  return {
    emblem:
      'region' in rule
        ? { kind: 'outline', points: getRegion(rule.region)?.outline ?? [] }
        : { kind: 'category', category: rule.category },
    name: medalSetName(rule),
    collected: progress.collected,
    total: progress.total,
    look: progress.state === 'progress' ? 'silver' : 'gold',
  };
}

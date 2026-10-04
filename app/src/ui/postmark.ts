/**
 * The postmark on a collected stamp (option E, 2026-10-04): the day it was
 * earned, on the phone's own clock, with the month in the user's language.
 * Beside `stampArt.ts` rather than in it because that module is pure and may
 * not reach the translations (CONTEXT §6).
 */

import { t } from '../i18n';
import type { Postmark } from '../passport/stampArt';

export function postmarkFor(awardedTs: number | null | undefined): Postmark | null {
  if (awardedTs === null || awardedTs === undefined || !Number.isFinite(awardedTs)) {
    return null;
  }
  const day = new Date(awardedTs);
  const month = t('postmark.months').split(',')[day.getMonth()] ?? '';
  return { top: `${day.getDate()} ${month}`, bottom: String(day.getFullYear()) };
}

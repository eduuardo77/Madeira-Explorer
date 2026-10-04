/**
 * Telling the user about a stamp as soon as it is earned (D-096).
 *
 * Until 2026-10-04 stamps were judged only when the app opened, so a stamp
 * earned at 16:26 in Câmara de Lobos was found at 16:38, when the project lead
 * happened to look, and felt like a quarter of an hour's wait. Now the
 * recorder's batch runs the award pass too (at most once a minute), and a new
 * stamp is said once: a quiet notification while the app is closed, the map's
 * pop-up when it is next on screen.
 *
 * ⚠ **The award pass is unchanged and still never looks at the free tier.**
 * Only what is *said* does: a stamp the passport withholds is announced by
 * name, as kept, and its artwork is not shown (`freeTier.ts`).
 */

import { getContentPack } from '../content/poiCatalogue';
import type { Category } from '../content/contentPack';
import { isUnlocked } from '../entitlement/entitlementStore';
import { visibleStamps } from '../entitlement/freeTier';
import { t } from '../i18n';
import { sendStampNotification } from '../notify/sendTripNotification';
import * as appStateDao from '../storage/dao/appStateDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import { runAwardPass } from './stampAwards';
import { parseTold, stampNews } from './stampNews';

/**
 * How often a batch may run the award pass, ms. A visit qualifies after three
 * minutes inside (`MIN_DWELL_SECONDS`), so this adds at most a minute to it.
 * ⚠ The pass's cost on a phone has not been measured; this bounds it.
 */
const ANNOUNCE_EVERY_MS = 60_000;
let lastRunMs = -Infinity;

/** A stamp for the map's pop-up. */
export type StampPopup = {
  placeId: string;
  name: string;
  category: Category;
  /** Withheld by the free tier: name it, do not draw it. */
  locked: boolean;
  /** When it was earned, for its postmark. */
  awardedTs: number;
};

type Earned = { placeId: string; name: string; category: Category; awardedTs: number };

/**
 * The stamps of the trip on show, and which the free tier withholds. Also
 * what Settings counts for the unlock sheet (T-156e). Null with no trip.
 */
export async function earnedStamps(): Promise<{ earned: Earned[]; locked: Set<string> } | null> {
  const trip = await tripDao.getTripOnShow();
  if (trip === null) {
    return null;
  }
  const places = new Map(getContentPack().places.map((place) => [place.id, place]));
  const earned: Earned[] = [];
  for (const award of await stampAwardDao.getAwards(trip.id)) {
    const place = places.get(award.place_id);
    if (place !== undefined) {
      earned.push({
        placeId: place.id,
        name: place.name,
        category: place.category,
        awardedTs: award.awarded_ts,
      });
    }
  }
  const { locked } = visibleStamps(earned, await isUnlocked());
  return { earned, locked: new Set(locked) };
}

/**
 * From the recorder's batch: judge, and post a quiet notification for each new
 * stamp when the app is not on screen. Never throws; the batch must not fail.
 */
export async function announceNewStamps(nowMs: number, onScreen: boolean): Promise<void> {
  if (nowMs - lastRunMs < ANNOUNCE_EVERY_MS) {
    return;
  }
  lastRunMs = nowMs;
  try {
    await runAwardPass(nowMs);
    const stamps = await earnedStamps();
    if (stamps === null) {
      return;
    }
    const news = stampNews(
      stamps.earned.map((stamp) => stamp.placeId),
      parseTold(await appStateDao.get(appStateDao.AppStateKey.StampsNotified))
    );
    // Recorded before posting: a process killed between the two loses one
    // notice rather than repeating it (the same order as the trip's two).
    await appStateDao.setJson(appStateDao.AppStateKey.StampsNotified, news.record);
    if (onScreen) {
      return; // the map's pop-up says it
    }
    for (const placeId of news.announce) {
      const stamp = stamps.earned.find((each) => each.placeId === placeId);
      if (stamp !== undefined) {
        await sendStampNotification(
          t('notify.stamp.title', { place: stamp.name }),
          t(stamps.locked.has(placeId) ? 'notify.stamp.bodyLocked' : 'notify.stamp.body')
        );
      }
    }
  } catch (error) {
    await recordingEventDao.logError('stamp announcement', error);
  }
}

/** For the map: the stamps earned since it last showed one, oldest first. */
export async function pendingStampPopups(): Promise<StampPopup[]> {
  try {
    const stamps = await earnedStamps();
    if (stamps === null) {
      return [];
    }
    const news = stampNews(
      stamps.earned.map((stamp) => stamp.placeId),
      parseTold(await appStateDao.get(appStateDao.AppStateKey.StampsShown))
    );
    if (news.announce.length === 0) {
      // Seeds the record on the first run, so the backlog is never shown.
      await appStateDao.setJson(appStateDao.AppStateKey.StampsShown, news.record);
    }
    return news.announce.flatMap((placeId) => {
      const stamp = stamps.earned.find((each) => each.placeId === placeId);
      return stamp === undefined
        ? []
        : [
            {
              placeId,
              name: stamp.name,
              category: stamp.category,
              locked: stamps.locked.has(placeId),
              awardedTs: stamp.awardedTs,
            },
          ];
    });
  } catch (error) {
    await recordingEventDao.logError('stamp pop-up', error);
    return [];
  }
}

/** The pop-up for `placeId` was seen; it is not shown again. */
export async function markStampShown(placeId: string): Promise<void> {
  try {
    const told = parseTold(await appStateDao.get(appStateDao.AppStateKey.StampsShown)) ?? [];
    if (!told.includes(placeId)) {
      await appStateDao.setJson(appStateDao.AppStateKey.StampsShown, [...told, placeId]);
    }
  } catch (error) {
    await recordingEventDao.logError('stamp pop-up', error);
  }
}

/**
 * The only way this app posts a notification (T-116, D-011).
 *
 * **Everything user-facing must come through here.** The day-1 health check
 * (T-049) and the trip-end reveal (T-102) both call this, and nothing else may
 * call `Notifications.scheduleNotificationAsync` — `notificationPolicy.test.ts`
 * reads the source and fails if anything does.
 *
 * That enforcement exists because D-011's cap of two per trip currently lives
 * in a decision document, which is not a place code can be stopped from
 * violating. The privacy policy also promises it to the user in plain words
 * (D-044) — *"The app sends two, ever"* — and a promise in shipped copy needs
 * something stronger than everybody remembering.
 *
 * Same shape as `souvenir/exportTrace.ts`: one door, no parameter to bypass it.
 *
 * The budget arithmetic is in `notificationPolicy.ts` and is pure. This is the
 * part that reads and writes `app_state` and talks to Expo.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { t } from '../i18n';
import * as appStateDao from '../storage/dao/appStateDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import type { NotificationKind } from './notificationPolicy';
import { canNotify, parseSent, serialiseSent } from './notificationPolicy';

/** D-087 §5: the channel both trip messages are posted on (Android). Stable: renaming it orphans the user's own setting for it. */
export const TRIP_CHANNEL_ID = 'trip-messages';

export type SendResult = {
  sent: boolean;
  /** For the diary, never for the user. */
  reason: string;
};

/**
 * Post a notification, if the trip's budget allows it.
 *
 * Never throws. Both callers are on paths that must not fail — the health
 * check runs at launch and trip end runs inside a headless geofence handler —
 * and neither should be able to break because a notification could not be
 * posted.
 *
 * ⚠ **The budget is marked spent BEFORE the notification is posted.** If the
 * process dies between the two, the user misses one message. The other order
 * risks a loop on a device that keeps being killed mid-send, which would burn
 * the entire D-011 budget in an afternoon and teach the user to turn
 * notifications off — losing the reveal, which D-012 calls the best moment in
 * the product. Losing one message is the cheaper failure.
 */
export async function sendTripNotification(
  kind: NotificationKind,
  title: string,
  body: string
): Promise<SendResult> {
  try {
    const sentSoFar = parseSent(
      await appStateDao.get(appStateDao.AppStateKey.NotificationsSent)
    );

    const decision = canNotify(kind, sentSoFar);
    if (!decision.allowed) {
      await recordingEventDao.log('notification', decision.reason);
      return { sent: false, reason: decision.reason };
    }

    await appStateDao.set(
      appStateDao.AppStateKey.NotificationsSent,
      serialiseSent([...sentSoFar, kind])
    );

    // ⚠ D-087 §5 — the two trip messages get a channel of their own, one that
    // makes a sound. Without it they shared whatever Expo's default was, and
    // teardown item 3 found the risk: a health check that arrives silently is
    // the failure T-049 exists to prevent. The recorder's ongoing notification
    // stays on expo-location's quiet channel, so a user can silence that one
    // without silencing these.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(TRIP_CHANNEL_ID, {
        name: t('notify.channel.trip'),
        description: t('notify.channel.tripDescription'),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await Notifications.scheduleNotificationAsync({
      // Immediately. Both callers are reached only once their own moment has
      // arrived, so there is nothing left to wait for.
      content: { title, body },
      trigger: Platform.OS === 'android' ? { channelId: TRIP_CHANNEL_ID } : null,
    });

    await recordingEventDao.log('notification', decision.reason);
    return { sent: true, reason: decision.reason };
  } catch (error) {
    await recordingEventDao.logError('notification', error);
    return { sent: false, reason: 'notification failed' };
  }
}

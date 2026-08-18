/**
 * Sending the day-1 health check (T-049, D-011).
 *
 * The judgement is in `healthCheckPolicy.ts` and is pure. This gathers the
 * evidence, asks it, and — at most once per install — posts a notification.
 *
 * ONE OF EXACTLY TWO NOTIFICATIONS
 * --------------------------------
 * D-011 budgets the app two per trip: this, and the reveal at trip end
 * (T-102). That budget is the reason the "already sent" flag is persisted
 * rather than held in memory, and the reason nothing here retries.
 *
 * NO NETWORK
 * ----------
 * These are local notifications, scheduled and delivered on-device. Nothing is
 * registered with a push service, no token exists, and no server is told
 * anything (D-001). `expo-notifications` can do push; this app never asks it
 * to.
 */

import * as Notifications from 'expo-notifications';
import { sendTripNotification } from '../notify/sendTripNotification';
import * as appStateDao from '../storage/dao/appStateDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import { locationProvider } from './ExpoLocationProvider';
import type { HealthCheckDecision } from './healthCheckPolicy';
import { decideHealthCheck } from './healthCheckPolicy';
import { deviceLanguage } from '../i18n/deviceLocale';

/**
 * When the app first ran, which is as close to "installed" as the app can
 * honestly get. Written once, on the first launch that finds it missing.
 */
async function getOrSetInstalledTs(now: number): Promise<number> {
  const stored = await appStateDao.get(appStateDao.AppStateKey.InstalledTs);
  if (stored !== null) {
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  await appStateDao.set(appStateDao.AppStateKey.InstalledTs, String(now));
  return now;
}

/**
 * Run the check, and notify if it says so.
 *
 * Safe to call on every app launch: it is a no-op before the window, and once
 * per install after it. Never throws — a failure to reassure the user must not
 * be able to take the app down with it.
 *
 * Returns the decision so the debug screen can show what it would do without
 * anybody having to wait fourteen hours.
 */
export async function runHealthCheck(
  now: number = Date.now()
): Promise<HealthCheckDecision> {
  try {
    const installedTs = await getOrSetInstalledTs(now);
    const alreadySent =
      (await appStateDao.get(appStateDao.AppStateKey.HealthCheckSentTs)) !==
      null;

    const [permission, isRecording, trip] = await Promise.all([
      locationProvider.getPermissionLevel(),
      locationProvider.isRecording(),
      tripDao.getActiveTrip(),
    ]);

    const [fixCount, lastFix] =
      trip === null
        ? [0, null]
        : await Promise.all([
            rawFixDao.countFixes(trip.id),
            rawFixDao.getLastFix(trip.id),
          ]);

    const decision = decideHealthCheck({
      // The impure half is where the device is allowed to be asked (T-160).
      language: deviceLanguage(),
      installedTs,
      now,
      alreadySent,
      permission,
      isRecording,
      fixCount,
      lastFixTs: lastFix?.ts ?? null,
    });

    if (!decision.notify || decision.title === null) {
      return decision;
    }

    // The timestamp is still recorded — `decideHealthCheck` reads it, and it
    // answers "when", which the budget does not.
    await appStateDao.set(
      appStateDao.AppStateKey.HealthCheckSentTs,
      String(now)
    );

    // Posting goes through the one door, which owns the D-011 cap and the
    // mark-before-post ordering (T-116).
    await sendTripNotification(
      'health_check',
      decision.title,
      decision.body ?? ''
    );

    await recordingEventDao.log('health_check', decision.reason);
    return decision;
  } catch (error) {
    await recordingEventDao.logError('health check', error);
    return {
      notify: false,
      reason: 'health check failed',
      title: null,
      body: null,
    };
  }
}

/**
 * Ask the OS whether it will show notifications at all.
 *
 * Deliberately NOT requested here. On Android 13+ this is a runtime
 * permission, and asking for it at the same moment as location would stack two
 * dialogs on a user who has not yet seen the app do anything — the surest way
 * to have both refused. It belongs in the onboarding flow (T-114), timed
 * separately.
 */
export async function getNotificationPermission(): Promise<string> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.status;
}

/**
 * Driving the onboarding sequence, and the prompts that come days later
 * (T-042, T-043, T-044, T-114).
 *
 * The decisions are in `permissionPolicy.ts` and are pure. This is the part
 * that asks the OS, remembers what happened, and shows the right screen.
 *
 * THE ONE RULE
 * ------------
 * **Nothing here may block the user from reaching the app.** D-008 makes the
 * app fully functional on While-Using, and CONTEXT §4.3 warns the permission
 * alone could sink the product. Every screen's decline is a real button that
 * moves forward, and `onFinished` is always reached.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { locationProvider } from '../recording/ExpoLocationProvider';
import { batteryExempt, requestBatteryExemption } from '../recording/batteryOptimisation';
import * as appStateDao from '../storage/dao/appStateDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import OnboardingView, {
  needsAndroidDisclosure,
  type OnboardingScreen,
} from './OnboardingView';
import {
  firstRunPlan,
  nextOnboardingStep,
  notificationAnswer,
  stepPosition,
  type FirstRunAsk,
} from './permissionPolicy';
import { alwaysOpensSettings, systemAskFor } from './systemAsk';
import { deviceLanguage } from '../i18n';
import type { PermissionLevel } from '../recording/LocationProvider';
import {
  activityAvailable,
  activityPermitted,
  requestActivityPermission,
} from '../recording/activityRecognition';

/**
 * The "Physical activity" ask is due (D-094): Android, available, not granted,
 * never asked. Android cannot say whether a permission was asked, so the app
 * remembers that it asked.
 */
async function activityAskable(): Promise<boolean> {
  if (Platform.OS !== 'android' || !activityAvailable() || activityPermitted()) {
    return false;
  }
  return (await appStateDao.get(appStateDao.AppStateKey.ActivityAskedTs)) === null;
}

/** Android's API level, for the replica of its dialog; 0 elsewhere. */
const API_LEVEL = Platform.OS === 'android' && typeof Platform.Version === 'number' ? Platform.Version : 0;

export default function OnboardingFlow({
  initialScreen,
  onFinished,
}: {
  /**
   * Show exactly this screen instead of running the first-run sequence.
   *
   * Used by the later prompts (T-043, T-044), which are not onboarding: by
   * then `nextOnboardingStep` correctly reports `complete`, so without this
   * the flow would dismiss itself the instant it mounted and the prompt would
   * never be seen.
   */
  initialScreen?: OnboardingScreen;
  onFinished: () => void;
}) {
  const [screen, setScreen] = useState<OnboardingScreen | null>(
    initialScreen ?? null
  );
  /**
   * T-250: the asks this first run will make, for the step count, worked out
   * once from the state at its start (`firstRunPlan`).
   */
  const plan = useRef<FirstRunAsk[] | null>(null);
  /** A first-run card was shown, so it ends on the ready card rather than vanishing. */
  const showedFirstRun = useRef(false);
  /**
   * "Not now" on location leaves Android's answer undetermined; for the
   * sequence it is an answer, so the welcome is not shown again.
   */
  const locationSkipped = useRef(false);
  /** The ready card says what location ended up as. */
  const [finalLocation, setFinalLocation] = useState<PermissionLevel>('undetermined');

  const finish = useCallback(async () => {
    await appStateDao.setFlag(appStateDao.AppStateKey.OnboardingCompleted, true);
    onFinished();
  }, [onFinished]);

  /** Work out where the user is in the sequence and show that screen. */
  const advance = useCallback(async () => {
    const [actualLocation, notifications, notificationsAsked, completed, keepRunningSeen, askActivity, alwaysOfferedTs] =
      await Promise.all([
        locationProvider.getPermissionLevel(),
        Notifications.getPermissionsAsync(),
        appStateDao.get(appStateDao.AppStateKey.NotificationsAskedTs),
        appStateDao.getFlag(appStateDao.AppStateKey.OnboardingCompleted),
        appStateDao.getFlag(appStateDao.AppStateKey.KeepRunningSeen),
        activityAskable(),
        appStateDao.get(appStateDao.AppStateKey.AlwaysOfferedTs),
      ]);
    const location: PermissionLevel =
      actualLocation === 'undetermined' && locationSkipped.current ? 'denied' : actualLocation;

    const state = {
      location,
      notifications: notificationAnswer({
        status: notifications.status,
        canAskAgain: notifications.canAskAgain,
        askedBefore: notificationsAsked !== null,
      }),
      completed,
      // ⚠ Read here rather than in the policy: a pure module that imports
      // `Platform` breaks every Node test (CLAUDE.md).
      android: Platform.OS === 'android',
      keepRunningSeen,
      activityAskable: askActivity,
      alwaysOffered: alwaysOfferedTs !== null,
      batteryExempt: batteryExempt() === true,
    };
    if (plan.current === null) plan.current = firstRunPlan(state);
    const step = nextOnboardingStep(state);

    if (step === 'complete') {
      if (showedFirstRun.current) {
        // T-250: end on a card that says what is on, not on a sudden map.
        setFinalLocation(actualLocation);
        setScreen('ready');
        return;
      }
      await finish();
      return;
    }
    showedFirstRun.current = true;
    // `welcome` and `location` are two screens over one policy step: the
    // policy cares whether location has been answered, the user needs to be
    // told what the app is before being asked for anything.
    setScreen(step);
  }, [finish]);

  useEffect(() => {
    if (initialScreen !== undefined) {
      // A standalone prompt: nothing to work out.
      return;
    }
    void advance().catch(async (error) => {
      await recordingEventDao.logError('onboarding', error);
      // Never strand the user on a blank screen because a check failed.
      onFinished();
    });
  }, [advance, onFinished, initialScreen]);

  /**
   * ⚠ T-250: one answer at a time. A second tap while a system dialog is
   * opening asks Android again, and on older versions the second request
   * closes the first: the project lead saw an ask "pop off" before they could
   * answer it (2026-10-05, after the Play install). Not reproduced on the
   * Android 14 emulator, so this is the likeliest cause, guarded, not a proven one.
   */
  const working = useRef(false);

  const handleContinue = useCallback(() => {
    if (working.current) return;
    working.current = true;
    void (async () => {
      try {
        switch (screen) {
          case 'welcome':
            setScreen('location');
            return;
          case 'location':
            // While-Using first. "All the time" is its own card right after
            // (T-250), never the same dialog: asked cold, it gets denied.
            await locationProvider.requestWhileUsingPermission();
            break;
          case 'always':
            // Marked first: on Android 11+ the answer is on a settings page,
            // and leaving the app is a moment this component may not survive.
            await appStateDao.set(appStateDao.AppStateKey.AlwaysOfferedTs, String(Date.now()));
            await locationProvider.requestAlwaysPermission();
            break;
          case 'ready':
            await finish();
            return;
          case 'activity':
            // Marked asked first: the system dialog is a moment this
            // component may not survive, and asking twice is nagging.
            await appStateDao.set(appStateDao.AppStateKey.ActivityAskedTs, String(Date.now()));
            await requestActivityPermission();
            if (initialScreen === 'activity') {
              // The one-time ask for somebody past onboarding (below).
              onFinished();
              return;
            }
            break;
          case 'notifications':
            // Marked first, as for activity: Android 13+ cannot tell us later.
            await appStateDao.set(appStateDao.AppStateKey.NotificationsAskedTs, String(Date.now()));
            await Notifications.requestPermissionsAsync();
            break;
          case 'keep-running':
            // ⚠ Marked seen BEFORE opening the settings screen. Leaving the app
            // for an OS screen can mean this component never gets its turn
            // again, and a screen that reappears every launch because the user
            // did the thing it asked is the app nagging.
            await appStateDao.setFlag(
              appStateDao.AppStateKey.KeepRunningSeen,
              true
            );
            // T-250: Android's one-tap dialog, settled when answered. Either
            // answer moves on; a phone without it gets the settings list.
            await requestBatteryExemption();
            break;
          case 'android-disclosure':
            setScreen('always-upgrade');
            return;
          case 'always-upgrade':
          case 'downgrade':
            await locationProvider.requestAlwaysPermission();
            await appStateDao.set(
              appStateDao.AppStateKey.AlwaysOfferedTs,
              String(Date.now())
            );
            onFinished();
            return;
          default:
            break;
        }
        await advance();
      } catch (error) {
        await recordingEventDao.logError('onboarding continue', error);
        await advance();
      } finally {
        working.current = false;
      }
    })();
  }, [screen, advance, onFinished, initialScreen]);

  const handleSkip = useCallback(() => {
    if (working.current) return;
    working.current = true;
    void (async () => {
      try {
        await skip();
      } finally {
        working.current = false;
      }
    })();
    async function skip() {
      if (screen === 'activity') {
        // "Not now" is an answer: never asked again (D-008).
        await appStateDao.set(appStateDao.AppStateKey.ActivityAskedTs, String(Date.now()));
        if (initialScreen === 'activity') {
          onFinished();
          return;
        }
        await advance();
        return;
      }
      if (screen === 'always-upgrade' || screen === 'downgrade' || screen === 'android-disclosure') {
        // Declining the upgrade is recorded so it is never asked twice.
        await appStateDao.set(
          appStateDao.AppStateKey.AlwaysOfferedTs,
          String(Date.now())
        );
        onFinished();
        return;
      }
      if (screen === 'welcome') {
        setScreen('location');
        return;
      }
      // Skipping a system ask is the same as declining it, as far as the
      // sequence is concerned: move on, do not re-ask.
      if (screen === 'location') {
        locationSkipped.current = true;
        await advance();
        return;
      }
      if (screen === 'always') {
        // "I'll start it myself" is an answer: never asked again (D-008).
        await appStateDao.set(appStateDao.AppStateKey.AlwaysOfferedTs, String(Date.now()));
        await advance();
        return;
      }
      if (screen === 'notifications') {
        // Marked as asked, so the sequence reads it answered and goes on.
        await appStateDao.set(appStateDao.AppStateKey.NotificationsAskedTs, String(Date.now()));
        await advance();
        return;
      }
      // "Got it" is an answer, not an evasion: the advice has been read.
      if (screen === 'keep-running') {
        await appStateDao.setFlag(appStateDao.AppStateKey.KeepRunningSeen, true);
        await advance();
        return;
      }
      await finish();
    }
  }, [screen, finish, onFinished, initialScreen, advance]);

  if (screen === null) {
    return null;
  }

  // The step count belongs to first run only; a later prompt stands alone.
  const position =
    initialScreen === undefined && plan.current !== null ? stepPosition(plan.current, screen) : null;
  const android = Platform.OS === 'android';
  const ask =
    screen === 'location' || screen === 'always' || screen === 'activity' ||
    screen === 'notifications' || screen === 'keep-running' || screen === 'always-upgrade' ||
    screen === 'downgrade'
      ? systemAskFor(screen, { android, apiLevel: API_LEVEL, language: deviceLanguage() })
      : null;

  return (
    <OnboardingView
      screen={screen}
      onContinue={handleContinue}
      onSkip={handleSkip}
      position={position}
      systemAsk={ask}
      opensSettings={alwaysOpensSettings({ android, apiLevel: API_LEVEL })}
      location={finalLocation}
    />
  );
}

/**
 * The later prompts: the Always upgrade (T-043) and downgrade recovery
 * (T-044). Returns the screen to show, or null for the overwhelmingly common
 * case of "nothing to say".
 */
export async function pendingPermissionPrompt(
  now: number = Date.now()
): Promise<OnboardingScreen | null> {
  try {
    const { shouldOfferAlwaysUpgrade, detectDowngrade } = await import(
      './permissionPolicy'
    );

    const location = await locationProvider.getPermissionLevel();
    const previousRaw = await appStateDao.get(
      appStateDao.AppStateKey.LastPermissionState
    );
    const previous =
      previousRaw === 'always' || previousRaw === 'while_using' || previousRaw === 'denied'
        ? previousRaw
        : null;

    // Record what we see before acting on it, so a downgrade is only ever
    // reported once.
    await appStateDao.set(appStateDao.AppStateKey.LastPermissionState, location);

    if (detectDowngrade(previous, location)) {
      return 'downgrade';
    }

    // D-094: somebody who finished onboarding before the activity ask existed
    // is asked once, the same screen, the next time they open the app.
    if (await activityAskable()) {
      return 'activity';
    }

    const installedRaw = await appStateDao.get(appStateDao.AppStateKey.InstalledTs);
    const offeredRaw = await appStateDao.get(appStateDao.AppStateKey.AlwaysOfferedTs);
    const trip = await import('../storage/dao/tripDao').then((m) =>
      m.getActiveTrip()
    );

    const decision = shouldOfferAlwaysUpgrade({
      location,
      installedTs: installedRaw === null ? now : Number(installedRaw),
      now,
      offeredTs: offeredRaw === null ? null : Number(offeredRaw),
      hasRecordedAnything: trip !== null,
    });

    if (!decision.offer) {
      return null;
    }
    // Play requires the disclosure screen before the request (T-121).
    return needsAndroidDisclosure() ? 'android-disclosure' : 'always-upgrade';
  } catch (error) {
    await recordingEventDao.logError('permission prompt check', error);
    return null;
  }
}

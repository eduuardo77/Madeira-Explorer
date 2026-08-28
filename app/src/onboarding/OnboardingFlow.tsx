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

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { locationProvider } from '../recording/ExpoLocationProvider';
import { openBatteryOptimisationSettings } from '../recording/batteryOptimisation';
import * as appStateDao from '../storage/dao/appStateDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import OnboardingView, {
  needsAndroidDisclosure,
  type OnboardingScreen,
} from './OnboardingView';
import { nextOnboardingStep } from './permissionPolicy';

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

  const finish = useCallback(async () => {
    await appStateDao.setFlag(appStateDao.AppStateKey.OnboardingCompleted, true);
    onFinished();
  }, [onFinished]);

  /** Work out where the user is in the sequence and show that screen. */
  const advance = useCallback(async () => {
    const [location, notifications, completed, keepRunningSeen] =
      await Promise.all([
        locationProvider.getPermissionLevel(),
        Notifications.getPermissionsAsync().then((s) => s.status),
        appStateDao.getFlag(appStateDao.AppStateKey.OnboardingCompleted),
        appStateDao.getFlag(appStateDao.AppStateKey.KeepRunningSeen),
      ]);

    const step = nextOnboardingStep({
      location,
      notifications:
        notifications === 'granted'
          ? 'granted'
          : notifications === 'undetermined'
            ? 'undetermined'
            : 'denied',
      completed,
      // ⚠ Read here rather than in the policy: a pure module that imports
      // `Platform` breaks every Node test (CLAUDE.md).
      android: Platform.OS === 'android',
      keepRunningSeen,
    });

    if (step === 'complete') {
      await finish();
      return;
    }
    // `welcome` and `location` are two screens over one policy step: the
    // policy cares whether location has been answered, the user needs to be
    // told what the app is before being asked for anything.
    if (step === 'keep-running') {
      setScreen('keep-running');
      return;
    }
    setScreen(step === 'welcome' ? 'welcome' : 'notifications');
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

  const handleContinue = useCallback(() => {
    void (async () => {
      try {
        switch (screen) {
          case 'welcome':
            setScreen('location');
            return;
          case 'location':
            // While-Using only. Always is a later, separate conversation
            // (T-043) — asking for it now is what gets it denied (D-008).
            await locationProvider.requestWhileUsingPermission();
            break;
          case 'notifications':
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
            // The result is deliberately ignored: the app cannot read whether
            // the exemption was granted, and a failure to open is not worth
            // stopping onboarding for (`recording/batteryOptimisation.ts`).
            await openBatteryOptimisationSettings();
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
      }
    })();
  }, [screen, advance, onFinished]);

  const handleSkip = useCallback(() => {
    void (async () => {
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
        setScreen('notifications');
        return;
      }
      // "Got it" is an answer, not an evasion: the advice has been read.
      if (screen === 'keep-running') {
        await appStateDao.setFlag(appStateDao.AppStateKey.KeepRunningSeen, true);
        await finish();
        return;
      }
      await finish();
    })();
  }, [screen, finish, onFinished]);

  if (screen === null) {
    return null;
  }

  return (
    <OnboardingView
      screen={screen}
      onContinue={handleContinue}
      onSkip={handleSkip}
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

/**
 * Asking Android to stop pausing this app (T-046).
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * CONTEXT §7 and HANDOFF both say it plainly: **Android OEMs kill background
 * work regardless of the official APIs.** Xiaomi, Huawei, Samsung, Oppo and
 * OnePlus all ship battery managers that stop a foreground service anyway. The
 * exemption is the one official lever against that, and without it a recorder
 * that is correct in every other respect still dies on somebody's holiday.
 *
 * WHY IT OPENS A SETTINGS SCREEN RATHER THAN ASKING DIRECTLY
 * ----------------------------------------------------------
 * Android has two ways to do this and they are not equivalent:
 *
 *   1. `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` — a one-tap dialog. It
 *      requires the `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission, which
 *      **Google Play treats as restricted** and reviews against a list of
 *      qualifying uses.
 *   2. `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` — opens the system list
 *      of apps and their battery setting. **No permission, no review.** The
 *      user has to find this app in the list, which is worse for somebody who
 *      needs the setting most (D-015's reader).
 *
 * v1 uses (2). This app is already going through Play's manual
 * background-location review (T-123), which is slow and on the critical path,
 * and adding a second restricted permission to that submission is a risk taken
 * for a saving of two taps. (1) is the fallback if T-053 shows OEMs killing the
 * recorder in practice — see D-045, which records this as reversible.
 *
 * WHAT THIS CANNOT DO, AND THE HONEST CONSEQUENCE
 * -----------------------------------------------
 * **The app cannot read whether it is currently exempt.** That is
 * `PowerManager.isIgnoringBatteryOptimizations()`, and there is no Expo API
 * for it — reading it would mean writing a native module, which is a
 * disproportionate amount of new native surface for one boolean.
 *
 * So the settings row offers the action and **never claims a state**. Showing
 * "Off" when the app cannot actually tell would be an invented fact, which is
 * the thing this project keeps refusing to do (D-041). What catches the
 * failure instead is the day-1 health check (T-049): it does not know why
 * recording stopped, but it knows that it stopped, and telling the user that
 * is what actually protects their trip.
 *
 * No unit test, deliberately: there is nothing pure here to test. Everything
 * this module does is send an intent to an OS this project cannot run. T-053
 * is the verification, and it needs an aggressive-OEM Android device.
 */

import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * ⚠ **T-250 (2026-10-05): the two limits above are lifted where the native
 * module exists.** `app/modules/battery-exemption` reads the exemption and
 * shows the one-tap dialog (option 1), the project lead's choice for first run
 * (O3, after WalkNYC), which takes D-045's fallback now. A build without the
 * module, or iOS, gets null and the settings list as before.
 */
type NativeBatteryExemption = {
  isExempt(): boolean;
  request(): Promise<'exempt' | 'declined' | 'unavailable'>;
};

const native: NativeBatteryExemption | null =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<NativeBatteryExemption>('BatteryExemption')
    : null;

/** Whether Android leaves this app alone to save battery; null when it cannot say. */
export function batteryExempt(): boolean | null {
  try {
    return native === null ? null : native.isExempt();
  } catch {
    return null;
  }
}

/**
 * The one-tap dialog, settled when the user has answered. Falls back to the
 * settings list when the dialog cannot be shown. Never throws.
 */
export async function requestBatteryExemption(): Promise<'exempt' | 'declined' | 'settings'> {
  try {
    if (native !== null) {
      const answer = await native.request();
      if (answer !== 'unavailable') return answer;
    }
  } catch {
    // The list below is the fallback.
  }
  await openBatteryOptimisationSettings();
  return 'settings';
}

/**
 * The system screen listing every app's battery setting.
 *
 * String literal rather than a constant from a library, because pulling in a
 * dependency for one intent action would need a network-behaviour check
 * (CONTEXT §6.4) and `Linking.sendIntent` is already in React Native.
 */
export const BATTERY_SETTINGS_ACTION =
  'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS';

/** Whether to show the control at all. Android-only; iOS has no equivalent. */
export function isBatteryExemptionAvailable(): boolean {
  return Platform.OS === 'android';
}

export type BatterySettingsResult =
  | 'opened'
  | 'opened-app-details'
  | 'unavailable'
  | 'failed';

/**
 * Open the battery setting, falling back to this app's details page.
 *
 * Never throws. It is wired to a settings row, and a settings row that crashes
 * the app is a worse outcome than one that quietly does nothing.
 */
export async function openBatteryOptimisationSettings(): Promise<BatterySettingsResult> {
  if (!isBatteryExemptionAvailable()) {
    return 'unavailable';
  }

  try {
    await Linking.sendIntent(BATTERY_SETTINGS_ACTION);
    return 'opened';
  } catch {
    // Fall through to the app's own details page rather than giving up.
  }

  try {
    // Some skins remove that screen. This app's own details page always
    // exists and has the battery setting somewhere inside it — worse, but not
    // nothing. `openSettings` resolves the package URI for us.
    await Linking.openSettings();
    return 'opened-app-details';
  } catch {
    return 'failed';
  }
}

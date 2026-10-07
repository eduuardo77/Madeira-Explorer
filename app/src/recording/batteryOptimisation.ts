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
 * HOW IT ASKS
 * -----------
 * Android has two ways, and they are not equivalent:
 *
 *   1. `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`: a one-tap dialog. It
 *      needs the `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission, which
 *      Google Play restricts to qualifying uses.
 *   2. `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`: the system list of apps
 *      and their battery setting. No permission, but the user has to find this
 *      app in the list, which is worst for the reader who needs it most (D-015).
 *
 * **First run uses (1)**, through `app/modules/battery-exemption` (T-250, the
 * lead's choice after WalkNYC; the permission kept on the lead's L2, D-045
 * amended, T-266, with Google's text and the declaration in D-045). (2) is the
 * fallback when the dialog cannot be shown, and what a build without the
 * module, or iOS, gets. Until T-250, v1 used (2) only, to keep a second
 * restricted permission out of the background-location review (T-123).
 *
 * WHAT IT CAN AND CANNOT KNOW
 * ---------------------------
 * The module reads `PowerManager.isIgnoringBatteryOptimizations()`
 * (`batteryExempt`): first run uses it to skip the card for a phone already
 * exempt. Without the module the answer is null, and nothing claims a state it
 * cannot read (D-041). Neither reading sees an OEM's own battery manager, which
 * can stop a recorder anyway (T-053, and EMUI's launch manager, T-258): the
 * day-1 health check (T-049) is what notices that recording stopped, whatever
 * the reason.
 */

import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

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

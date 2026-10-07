/** `launchManager.hasLaunchManager` for this phone: Android reports its maker. */

import { Platform } from 'react-native';
import { hasLaunchManager } from './launchManager';

export function deviceHasLaunchManager(): boolean {
  return Platform.OS === 'android' && hasLaunchManager(Platform.constants.Manufacturer);
}

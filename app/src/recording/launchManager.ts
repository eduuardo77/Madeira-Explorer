/**
 * Whether this phone has a launch manager the battery exemption does not
 * reach (T-258).
 *
 * Measured on the P30 (EMUI 12), 2026-09-24: with Bruma under EMUI's
 * automatic app-launch management, Android's "app updated" broadcast never
 * started the app, so nothing it does after an update could run (T-210). Set
 * to manual, the broadcast arrives and the update notice is posted within
 * seconds (2026-10-07). The setting lives in the phone's own
 * screens, which EMUI 12 does not let another app open (its actions are
 * refused, by name and by action), so first run and Settings name the path.
 * Honor phones of the same years ship the same manager.
 *
 * Pure. Tested in `launchManager.test.ts`.
 */
export function hasLaunchManager(manufacturer: string | undefined): boolean {
  return manufacturer !== undefined && /^(huawei|honor)$/i.test(manufacturer.trim());
}

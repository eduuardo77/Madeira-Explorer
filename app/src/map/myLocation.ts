import type { PermissionLevel } from '../recording/LocationProvider.ts';

/**
 * N23 (P0, 2026-10-27): whether Google's blue dot may be switched on.
 *
 * Google's map throws `SecurityException` the moment `isMyLocationEnabled` is
 * true without a location permission, and it threw on every launch for anyone
 * who refused location in the first run, before the in-app *grant location*
 * button could ever be reached. `null` is "not read yet": off until we know.
 */
export function showsMyLocation(permission: PermissionLevel | null | undefined): boolean {
  return permission === 'while_using' || permission === 'always';
}

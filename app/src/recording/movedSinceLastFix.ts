/**
 * How far the phone is now from the last fix Bruma stored, by Android's own
 * last-known position: the evidence that tells a phone at rest from a recorder
 * that died while the phone travelled (`recorderSilence.MOVED_WITHOUT_RECORDING_M`).
 *
 * The position comes from the system's cache, filled by any app, at most an
 * hour old, and reading it never powers the GPS. Null when either position is
 * missing: no evidence either way.
 */

import { locationProvider } from './ExpoLocationProvider';
import { distanceM } from './distance';

const SYSTEM_FIX_MAX_AGE_MS = 60 * 60 * 1000;

export async function movedSinceLastFixM(
  lastFix: { lat: number; lon: number } | null
): Promise<number | null> {
  if (lastFix === null) return null;
  const systemFix = await locationProvider.getLastKnownPosition(SYSTEM_FIX_MAX_AGE_MS);
  return systemFix === null
    ? null
    : distanceM({ lat: lastFix.lat, lon: lastFix.lon }, { lat: systemFix.lat, lon: systemFix.lon });
}

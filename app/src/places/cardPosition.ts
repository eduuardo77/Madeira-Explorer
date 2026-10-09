/**
 * Where a place card measures from: the newer of Bruma's last fix on the trip
 * and Android's own last-known position (`placeCard.newerPosition` says why).
 * The system's is read from its cache and never powers the GPS.
 */

import { locationProvider } from '../recording/ExpoLocationProvider';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as tripDao from '../storage/dao/tripDao';
import { MAX_POSITION_AGE_MS, newerPosition, type LastKnownPosition } from './placeCard';

export async function cardPosition(): Promise<LastKnownPosition | null> {
  const trip = await tripDao.getActiveTrip();
  const [fix, system] = await Promise.all([
    trip === null ? null : rawFixDao.getLastFix(trip.id),
    locationProvider.getLastKnownPosition(MAX_POSITION_AGE_MS),
  ]);
  return newerPosition(
    fix,
    system === null ? null : { ts: system.ts, lat: system.lat, lon: system.lon, accuracy_m: system.accuracyM }
  );
}

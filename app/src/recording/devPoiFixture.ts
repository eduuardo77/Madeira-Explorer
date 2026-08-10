/**
 * A synthetic catalogue for exercising the geofence manager (T-039).
 *
 * WHY THIS EXISTS
 * ---------------
 * T-039 has to be finished and testable before T-066 (curating 150–250 real
 * places), and T-066 is work only the project lead can do. So the manager is
 * driven from a fixture, which also keeps it honest: if this file can stand in
 * for the content pack, then no Madeira knowledge has leaked into `app/`
 * (D-017, the rule CONTEXT §6.1 calls absolute).
 *
 * WHY THE PLACES ARE GENERATED RATHER THAN LISTED
 * ----------------------------------------------
 * Every place here is computed as an offset from wherever the phone happens to
 * be standing. There are no coordinates in this file. That is what makes it a
 * fixture rather than content — and it means a field test works from the
 * project lead's kitchen as well as from a trailhead.
 *
 * ⚠ DEVELOPMENT ONLY. T-040 replaces the one line in `index.ts` that registers
 * this with the real content pack, and this file goes away.
 */

import * as appStateDao from '../storage/dao/appStateDao';
import type { Coordinate } from './distance';
import { offsetByMetres } from './distance';
import type { GeofencePlace } from './geofenceSelection';
import type { PoiCatalogueSource } from './geofenceManager';

function ringPlace(
  origin: Coordinate,
  poiId: string,
  bearingIndex: number,
  ofCount: number,
  metres: number,
  radiusM: number
): GeofencePlace {
  const angle = (2 * Math.PI * bearingIndex) / ofCount;
  const at = offsetByMetres(
    origin,
    Math.cos(angle) * metres,
    Math.sin(angle) * metres
  );
  return { poiId, lat: at.lat, lon: at.lon, radiusM };
}

/**
 * Build a fixture sized so that the platform's region cap actually binds.
 *
 * `capacity` is `LocationProvider.maxSimultaneousRegions` — 20 on iOS, ~100 on
 * Android. Passing it in is what makes the same field test meaningful on both:
 * the near places always fill the cap exactly, so the far ring is always left
 * out, so the anchor always lands at roughly 850 m. That is a five-minute walk,
 * which is the point — the reshuffle (T-076) has to be observable on foot, not
 * only by driving across the island.
 */
export function generateFixture(
  origin: Coordinate,
  capacity: number
): GeofencePlace[] {
  const places: GeofencePlace[] = [];

  // One slot short of the cap, so the manager keeps exactly these and spends
  // its last slot on the anchor.
  const nearCount = Math.max(1, capacity - 1);
  const nearRadii = [80, 160, 240];

  for (let i = 0; i < nearCount; i += 1) {
    places.push(
      ringPlace(
        origin,
        `dev-near-${i}`,
        i,
        nearCount,
        nearRadii[i % nearRadii.length],
        50
      )
    );
  }

  // Far enough to be excluded, close enough to walk to. These are what the
  // anchor is protecting: reaching one without the set having been rebuilt
  // would be the bug.
  const farCount = 8;
  for (let i = 0; i < farCount; i += 1) {
    places.push(ringPlace(origin, `dev-far-${i}`, i, farCount, 1500, 150));
  }

  return places;
}

/**
 * Persisted, because the OS relaunches this app headless.
 *
 * A fixture that lived only in the screen that generated it would vanish the
 * moment the process was killed — which is precisely the situation the geofence
 * backbone exists to survive, and therefore precisely the situation the field
 * test needs to reproduce.
 */
export async function saveFixture(places: GeofencePlace[]): Promise<void> {
  await appStateDao.setJson(appStateDao.AppStateKey.DevPoiFixture, places);
}

export async function loadFixture(): Promise<GeofencePlace[]> {
  const places = await appStateDao.getJson<GeofencePlace[]>(
    appStateDao.AppStateKey.DevPoiFixture
  );
  return places ?? [];
}

/**
 * Use the real content pack, but fall back to the fixture while it is empty.
 *
 * T-066 is hand curation by one person and will be empty, then partial, then
 * finished, over weeks. Without this the geofence backbone is untestable for
 * that entire period — and it is the part most in need of field testing.
 *
 * ⚠ The caller decides whether to apply this at all — `index.ts` wraps the real
 * catalogue only when `__DEV__`. Keeping the condition at the wiring site means
 * the production behaviour can be read there, rather than inferred from a
 * branch buried in a file named "fixture". T-117a confirms it is absent from a
 * release build.
 */
export function withDevFixtureFallback(
  source: PoiCatalogueSource
): PoiCatalogueSource {
  return async () => {
    const places = await source();
    return places.length > 0 ? places : loadFixture();
  };
}

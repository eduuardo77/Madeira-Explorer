/**
 * One trip, gathered for the video you keep (T-329, D-112): the impure half of
 * `videoJob.ts`.
 *
 * ⚠ **The roads come from the masked export and nowhere else** (D-040): the
 * video leaves the phone, so it carries what the film would share, cut around
 * the place the trip slept, and it is refused when that place could not be
 * found. The same refusal, worded the same way, as the film (`REFUSAL_KEYS`).
 */

import { APP_NAME } from '../brand';
import { getContentPack } from '../content/poiCatalogue';
import { getRegions } from '../content/regionCatalogue';
import { isUnlocked } from '../entitlement/entitlementStore';
import type { Language } from '../i18n/languages';
import { prepareMapAssets } from '../map/mapAssets';
import { buildMapStyle } from '../map/mapStyle';
import { keepSimplified } from '../map/simplifyLine';
import { applyVideoPalette } from '../map/videoPalette';
import { exportRoadSegments } from '../matching/roadNetwork';
import { getIslandByRegion } from '../progress/islandGateStore';
import * as appStateDao from '../storage/dao/appStateDao';
import { AppStateKey } from '../storage/dao/appStateDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import { MASK_RADIUS_M } from './accommodation';
import type { ExportRefusal } from './exportTrace';
import { exportedTrip, getExportableTrace } from './exportTrace';
import type { Film } from './frame';
import { getSouvenirComposition } from './souvenirPlan';
import { loadTripView } from './tripViewerData';
import type { Tier } from './videoOverlay';
import type { VideoChoices, VideoJobInput } from './videoJob';

export type VideoSource =
  | { ok: true; tripId: number; input: Omit<VideoJobInput, 'choices'>; mapStyle: string }
  | { ok: false; refusal: ExportRefusal | null };

export const DEFAULT_CHOICES: VideoChoices = { info: 'discreet', camera: 'normal' };

export async function loadVideoSource(tripId: number | undefined, language: Language): Promise<VideoSource> {
  const trip = await exportedTrip(tripId);
  if (trip === null) return { ok: false, refusal: null };

  const trace = await getExportableTrace({ quiet: true, tripId: trip.id });
  if (!trace.safeToShare) return { ok: false, refusal: trace.refusal ?? null };
  const composition = await getSouvenirComposition({ quiet: true, tripId: trip.id });
  if (!composition.renderable) return { ok: false, refusal: composition.refusal ?? null };
  const film = composition as Film;

  const segments = await exportRoadSegments(trace.fixes, trace.accommodation, MASK_RADIUS_M);
  const pack = getContentPack();
  const places = new Map(pack.places.map((place) => [place.id, place.name]));
  const awards = (await stampAwardDao.getAwards(trip.id))
    .filter((award) => places.has(award.place_id))
    .map((award) => ({ placeId: award.place_id, awardedTs: award.awarded_ts }));
  const view = await loadTripView(trip.id, 'stored');
  const hidden = getIslandByRegion();

  const mapStyle = applyVideoPalette(JSON.parse(buildMapStyle('light', await prepareMapAssets())));

  return {
    ok: true,
    tripId: trip.id,
    mapStyle: JSON.stringify(mapStyle),
    input: {
      film,
      // Fewer points, the same line, as the film draws them (`souvenirPlan.ts`).
      roads: segments.map((segment) => ({ points: keepSimplified(segment.fixes) })),
      awards,
      placeNames: places,
      totalKm: (view?.litM ?? 0) / 1000,
      firstTs: trip.started_ts,
      lastTs: trip.ended_ts ?? Date.now(),
      dayKey: localDayKey,
      language,
      title: pack.destination ?? '',
      // The main island: each municipality's largest outline, the islands
      // shown on their own passports left out, as the unlock sheet draws it.
      islandOutlines: getRegions()
        .filter((region) => region.outline !== null && !hidden.has(region.id))
        .map((region) => region.outline ?? []),
      tier: await tier(),
    },
  };
}

export async function tier(): Promise<Tier> {
  return (await isUnlocked()) ? 'paid' : 'free';
}

/** The person's last choices, or the defaults. */
export async function loadChoices(): Promise<VideoChoices> {
  const stored = await appStateDao.getJson<Partial<VideoChoices>>(AppStateKey.VideoChoices);
  return {
    info: stored?.info === 'full' || stored?.info === 'none' || stored?.info === 'discreet' ? stored.info : DEFAULT_CHOICES.info,
    camera: stored?.camera === 'close' || stored?.camera === 'normal' ? stored.camera : DEFAULT_CHOICES.camera,
  };
}

export async function saveChoices(choices: VideoChoices): Promise<void> {
  await appStateDao.setJson(AppStateKey.VideoChoices, choices);
}

/** The trip's video saved before, if any: the next save writes over it. */
export async function savedVideoUri(tripId: number): Promise<string | null> {
  const uris = await appStateDao.getJson<Record<string, string>>(AppStateKey.VideoUris);
  return uris?.[String(tripId)] ?? null;
}

export async function rememberSavedVideo(tripId: number, uri: string): Promise<void> {
  const uris = (await appStateDao.getJson<Record<string, string>>(AppStateKey.VideoUris)) ?? {};
  await appStateDao.setJson(AppStateKey.VideoUris, { ...uris, [String(tripId)]: uri });
}

/** The file's name in the gallery: the app, the destination, the dates. */
export function videoFileName(destination: string, dates: string): string {
  return `${[APP_NAME, destination, dates].filter((part) => part !== '').join(' ')}.mp4`.replace(/[\\/:*?"<>|]/g, '');
}

/** A fix's local day, `YYYY-MM-DD`, as the trip viewer counts days. */
function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

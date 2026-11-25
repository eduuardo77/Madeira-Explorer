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
import { buildVideoJob, prepareVideo, type PreparedVideo, type VideoChoices, type VideoJobInput } from './videoJob';

export type VideoSource =
  | { ok: true; tripId: number; input: Omit<VideoJobInput, 'choices'>; mapStyle: string }
  | { ok: false; refusal: ExportRefusal | null };

export const DEFAULT_CHOICES: VideoChoices = { info: 'discreet', camera: 'normal' };

/** One day of a trip (the trip viewer's "this day"), or the whole trip when absent. */
export type VideoRange = { fromTs: number; toTs: number };

export async function loadVideoSource(tripId: number | undefined, language: Language, range?: VideoRange): Promise<VideoSource> {
  const trip = await exportedTrip(tripId);
  if (trip === null) return { ok: false, refusal: null };

  // The trace and the trip's figures read side by side; the trace is handed to
  // the film planner so it is not read twice (0.4 s on the P30, T-329).
  const [trace, view, allAwards, paid] = await Promise.all([
    getExportableTrace({ quiet: true, tripId: trip.id }),
    loadTripView(trip.id, 'stored'),
    stampAwardDao.getAwards(trip.id),
    tier(),
  ]);
  if (!trace.safeToShare) return { ok: false, refusal: trace.refusal ?? null };
  const composition = await getSouvenirComposition({ quiet: true, tripId: trip.id, range, trace });
  if (!composition.renderable) return { ok: false, refusal: composition.refusal ?? null };
  const film = composition as Film;

  // A day is cut out of the whole trip's masked roads, as its film is (`souvenirPlan.ts`).
  const inRange = (ts: number) => range === undefined || (ts >= range.fromTs && ts < range.toTs);
  const segments = (await exportRoadSegments(trace.fixes, trace.accommodation, MASK_RADIUS_M))
    .map((segment) => segment.fixes.filter((fix) => inRange(fix.ts)))
    .filter((fixes) => fixes.length >= 2);
  const pack = getContentPack();
  const places = new Map(pack.places.map((place) => [place.id, place.name]));
  const awards = allAwards
    .filter((award) => places.has(award.place_id) && inRange(award.awarded_ts))
    .map((award) => ({ placeId: award.place_id, awardedTs: award.awarded_ts }));
  const hidden = getIslandByRegion();
  // The figure the trip viewer shows: the trip's lit road, or the day's.
  const litM = range === undefined ? view?.litM : view?.days.find((day) => day.startTs === range.fromTs)?.litM;

  const mapStyle = applyVideoPalette(JSON.parse(buildMapStyle('light', await prepareMapAssets())));

  return {
    ok: true,
    tripId: trip.id,
    mapStyle: JSON.stringify(mapStyle),
    input: {
      film,
      // Fewer points, the same line, as the film draws them (`souvenirPlan.ts`).
      roads: segments.map((fixes) => ({ points: keepSimplified(fixes) })),
      awards,
      placeNames: places,
      totalKm: (litM ?? 0) / 1000,
      // A day's video is dated that day alone, as its film's caption is.
      firstTs: range?.fromTs ?? trip.started_ts,
      lastTs: range?.fromTs ?? trip.ended_ts ?? Date.now(),
      dayKey: localDayKey,
      language,
      title: pack.destination ?? '',
      // The main island: each municipality's largest outline, the islands
      // shown on their own passports left out, as the unlock sheet draws it.
      islandOutlines: getRegions()
        .filter((region) => region.outline !== null && !hidden.has(region.id))
        .map((region) => region.outline ?? []),
      tier: paid,
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

/** The trip's (or the day's) video saved before, if any: the next save writes over it. */
export async function savedVideoUri(tripId: number, range?: VideoRange): Promise<string | null> {
  const uris = await appStateDao.getJson<Record<string, string>>(AppStateKey.VideoUris);
  return uris?.[savedKey(tripId, range)] ?? null;
}

export async function rememberSavedVideo(tripId: number, uri: string, range?: VideoRange): Promise<void> {
  const uris = (await appStateDao.getJson<Record<string, string>>(AppStateKey.VideoUris)) ?? {};
  await appStateDao.setJson(AppStateKey.VideoUris, { ...uris, [savedKey(tripId, range)]: uri });
}

/** One video kept per trip, and one per day of it: "31", "31:2026-10-17". */
function savedKey(tripId: number, range?: VideoRange): string {
  return range === undefined ? String(tripId) : `${tripId}:${localDayKey(range.fromTs)}`;
}

/**
 * Everything the video screen needs before it can show anything: the trip,
 * the person's choices, the pacing (`prepareVideo`) and the job for those
 * choices. Asked for early, by the film once it stops playing, so that
 * opening the screen finds it made (it took 2.4 s on the P30); the screen asks
 * again and gets the same promise. Kept five minutes, for one trip or day.
 */
export function readyVideo(tripId: number | undefined, language: Language, range?: VideoRange): Promise<ReadyVideo> {
  const key = `${tripId ?? ''}|${language}|${range?.fromTs ?? ''}|${range?.toTs ?? ''}`;
  const now = Date.now();
  if (ready !== null && ready.key === key && now - ready.atMs < READY_FOR_MS) return ready.value;
  const value = (async (): Promise<ReadyVideo> => {
    const [source, choices] = await Promise.all([loadVideoSource(tripId, language, range), loadChoices()]);
    if (!source.ok) return { source, choices, prepared: null, job: null };
    const prepared = prepareVideo(source.input);
    return { source, choices, prepared, job: JSON.stringify(buildVideoJob({ ...source.input, choices }, prepared)) };
  })();
  ready = { key, atMs: now, value };
  // A failure is not kept: the screen asks again and reports it.
  value.catch(() => {
    if (ready?.value === value) ready = null;
  });
  return value;
}

export type ReadyVideo = { source: VideoSource; choices: VideoChoices; prepared: PreparedVideo | null; job: string | null };

const READY_FOR_MS = 5 * 60_000;
let ready: { key: string; atMs: number; value: Promise<ReadyVideo> } | null = null;

/** The file's name in the gallery: the app, the destination, the dates. */
export function videoFileName(destination: string, dates: string): string {
  return `${[APP_NAME, destination, dates].filter((part) => part !== '').join(' ')}.mp4`.replace(/[\\/:*?"<>|]/g, '');
}

/** A fix's local day, `YYYY-MM-DD`, as the trip viewer counts days. */
function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

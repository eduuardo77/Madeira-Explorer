/**
 * A trip, as the job the native video view plays and exports (T-329, D-112).
 *
 * Everything the phone needs to draw the video you keep, frame by frame:
 *   - the camera of each frame (`videoCamera.ts`, settled on the whole trip at
 *     the close and held through the end card), in MapLibre zoom;
 *   - what is drawn over the map on each frame (`videoOverlay.ts`);
 *   - the pen's strokes (`pacedFilm.ts`), in 1e-5 degrees, and their times;
 *   - the watermark's island and the app's name.
 *
 * The native side (`modules/video-export`) decides how things look and nothing
 * else: what shows and when is all here, tested, and the same output the
 * sketch in `tools/` draws and the spike measured on the P30.
 *
 * Pure: the trip's roads (already masked, D-040), awards and figures in.
 */

import { APP_NAME } from '../brand.ts';
import { fitBounds } from '../map/cameraFit.ts';
import type { Language } from '../i18n/languages.ts';
import type { Film } from './frame.ts';
import { headAt, planPacedFilm, type PacedAward, type TimedRoad } from './pacedFilm.ts';
import { CLOSE_CAMERA, DAY_CAMERA, settleCamera, videoCameraAt, videoCameraPath } from './videoCamera.ts';
import { overlayAt, planOverlay, videoDurationMs, type InfoMode, type OverlayFrame, type Tier } from './videoOverlay.ts';

/** The video's frame, in points: 9:16, as phones show stories and reels. */
export const VIDEO_WIDTH = 360;
export const VIDEO_HEIGHT = 640;
/** Points to pixels: 1080 x 1920. */
export const VIDEO_PIXEL_RATIO = 3;
export const VIDEO_FPS = 30;

export type CameraChoice = 'normal' | 'close';

export type VideoChoices = { info: InfoMode; camera: CameraChoice };

export type VideoJobInput = {
  film: Film;
  /** The trip's roads as the masked export gives them (`exportRoadSegments`). */
  roads: readonly TimedRoad[];
  awards: readonly PacedAward[];
  placeNames: ReadonlyMap<string, string>;
  /** The trip's lit road, km, each road once (the passport's figure, D-101). */
  totalKm: number;
  firstTs: number;
  lastTs: number;
  /** A fix's local day, `YYYY-MM-DD`. */
  dayKey: (ts: number) => string;
  language: Language;
  /** The destination's name, from content (D-017). */
  title: string;
  /** Each municipality's outline on the main island, [lon, lat], for the watermark. */
  islandOutlines: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  tier: Tier;
  choices: VideoChoices;
};

export type VideoJob = {
  width: number;
  height: number;
  pixelRatio: number;
  fps: number;
  appName: string;
  durationMs: number;
  /** [atMs, lon, lat, zoom (MapLibre, one less than Google's)] per frame. */
  frames: [number, number, number, number][];
  overlays: OverlayFrame[];
  /** The pen's strokes: points in 1e-5 degrees, [lon, lat], and when the pen reaches each. */
  strokes: { c: [number, number][]; t: number[] }[];
  /** The main island in a 100-wide box, as rings of [x, y]. */
  glyph: { width: number; height: number; rings: [number, number][][] };
};

const MS_PER_DAY = 86_400_000;

export function buildVideoJob(input: VideoJobInput): VideoJob {
  const { film, choices } = input;
  const draw = film.scenes.find((scene) => scene.kind === 'draw');
  const finale = film.scenes.find((scene) => scene.kind === 'finale');
  const drawStartMs = draw?.startMs ?? 0;
  const finaleAtMs = finale?.startMs ?? film.durationMs;

  const paced = planPacedFilm({
    roads: input.roads,
    awards: input.awards,
    drawFromMs: drawStartMs,
    drawMs: finaleAtMs - drawStartMs,
    dayKey: input.dayKey,
    tripStartKey: input.dayKey(input.firstTs),
    totalKm: input.totalKm,
  });

  const plan = planOverlay({
    language: input.language,
    title: input.title,
    firstTs: input.firstTs,
    lastTs: input.lastTs,
    tripDays: Math.round((Date.parse(`${input.dayKey(input.lastTs)}T00:00:00Z`) - Date.parse(`${input.dayKey(input.firstTs)}T00:00:00Z`)) / MS_PER_DAY) + 1,
    paced,
    placeNames: input.placeNames,
    collected: finale?.kind === 'finale' ? finale.collected : input.awards.length,
    total: finale?.kind === 'finale' ? finale.total : input.awards.length,
    drawStartMs,
    finaleAtMs,
    durationMs: film.durationMs,
    info: choices.info,
    tier: input.tier,
  });

  // The camera: the frame without the info card is the whole height but for the title.
  const bottom = choices.info === 'full' ? 230 : 130;
  const viewport = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, padding: { top: 120, bottom, left: 24, right: 24 } };
  const whole = boundsOf(paced.strokes.flatMap((stroke) => stroke.coordinates));
  const stepMs = 1000 / VIDEO_FPS;
  const path = videoCameraPath({
    whole,
    days: paced.days.map((day) => ({ startMs: day.startMs, bounds: day.bounds })),
    viewport,
    durationMs: film.durationMs,
    stepMs,
    options: choices.camera === 'close' ? CLOSE_CAMERA : DAY_CAMERA,
    follow: choices.camera === 'close' ? (t) => (t < finaleAtMs ? headAt(paced, t) : null) : undefined,
  });
  const rest = fitBounds(whole, { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, padding: { top: 120, bottom: bottom + 20, left: 24, right: 24 } });
  const camera = rest === null ? path : settleCamera(path, { lon: rest.coordinates.longitude, lat: rest.coordinates.latitude, zoom: rest.zoom }, finaleAtMs - 600, 1500);

  const durationMs = videoDurationMs(plan);
  const frames: VideoJob['frames'] = [];
  const overlays: OverlayFrame[] = [];
  for (let i = 0; i * stepMs <= durationMs; i += 1) {
    const t = i * stepMs;
    const cam = videoCameraAt(camera, Math.min(t, film.durationMs));
    if (cam === null) break;
    frames.push([Math.round(t), cam.lon, cam.lat, cam.zoom - 1]);
    overlays.push(overlayAt(plan, t));
  }

  return {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    pixelRatio: VIDEO_PIXEL_RATIO,
    fps: VIDEO_FPS,
    appName: APP_NAME,
    durationMs,
    frames,
    overlays,
    strokes: paced.strokes.map((stroke) => ({
      c: stroke.coordinates.map(([lon, lat]) => [Math.round(lon * 1e5), Math.round(lat * 1e5)]),
      t: stroke.timesMs.map(Math.round),
    })),
    glyph: islandGlyph(input.islandOutlines),
  };
}

/**
 * The main island in a 100-wide box: each outline thinned to every sixth
 * point, projected with longitude squeezed by the island's latitude.
 */
export function islandGlyph(outlines: VideoJobInput['islandOutlines']): VideoJob['glyph'] {
  const points = outlines.flat();
  if (points.length === 0) return { width: 100, height: 0, rings: [] };
  const midLat = (Math.min(...points.map((p) => p[1])) + Math.max(...points.map((p) => p[1]))) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const project = ([lon, lat]: readonly [number, number]): [number, number] => [lon * k, -lat];
  // The box from every point, before thinning: a thinned small outline can be one point.
  const all = points.map(project);
  const x0 = Math.min(...all.map((p) => p[0]));
  const x1 = Math.max(...all.map((p) => p[0]));
  const y0 = Math.min(...all.map((p) => p[1]));
  const y1 = Math.max(...all.map((p) => p[1]));
  if (!(x1 > x0)) return { width: 100, height: 0, rings: [] };
  const rings = outlines.map((ring) => ring.filter((_, i) => i % 6 === 0).map(project));
  const scale = 100 / (x1 - x0);
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    width: 100,
    height: round((y1 - y0) * scale),
    rings: rings.map((ring) => ring.map(([x, y]) => [round((x - x0) * scale), round((y - y0) * scale)])),
  };
}

function boundsOf(points: ReadonlyArray<readonly [number, number]>): [number, number, number, number] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of points) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}

/**
 * The exported video's camera (T-329, D-112).
 *
 * The first by-day camera cut to each day's framing in under a second; on the
 * lead's trip it zoomed at up to 8.2 levels a second and reversed five times
 * ("the zoom-ins and zoom-outs are quite aggressive"). Here a day's framing is
 * only a target:
 *
 *   - at most `zoomInMax` levels closer than the whole trip (framed, never dived into);
 *   - smoothed over time with a Gaussian `smoothMs` wide, both ways, so the
 *     camera starts moving before a day and never overshoots, and short days
 *     blur into their neighbours instead of being chased;
 *   - the zoom held to `zoomRateMax` levels a second, and, when asked, the pan
 *     to `panMaxKmPerS`.
 *
 * Measured on trip 31 in the sketch: zoom at most 0.4 levels/s, 1.6 levels of
 * zoom travel over the drawing (the app's own film camera: 1.5 and 2.2).
 *
 * The close camera (*Câmara mais perto*) is the same machine with the pen as
 * its target (`follow`), `followZoom` levels in, smoothed less, its pan held.
 *
 * Zoom is Google's (256 px tiles), as `cameraFit.fitBounds` gives it. A
 * renderer with 512 px tiles (MapLibre) subtracts one.
 *
 * Pure: numbers in, a path out.
 */

import { fitBounds, type Bounds, type Viewport } from '../map/cameraFit.ts';

type Padding = NonNullable<Viewport['padding']>;

export type VideoCamera = { lon: number; lat: number; zoom: number };
export type CameraSample = VideoCamera & { atMs: number };

export type CameraDay = { startMs: number; bounds: [number, number, number, number] };

export type VideoCameraOptions = {
  zoomInMax: number;
  smoothMs: number;
  zoomRateMax: number;
  /** Closing in is slower than pulling out: a push, not a pump. Levels a second. */
  zoomInRateMax: number;
  /** km/s; 0 leaves the pan free. */
  panMaxKmPerS: number;
};

/**
 * The calm by-day camera, as the lead approved it in the sketch on 24 Nov 2026,
 * then made to keep the day's road in view (`keep`): days framed 0.5 levels in
 * rather than 0.7 and closed in on slowly, which held the extra zoom travel
 * that keeping costs to 1.9 levels over the lead's trip, from 1.8 (3.6 without them).
 */
export const DAY_CAMERA: VideoCameraOptions = { zoomInMax: 0.5, smoothMs: 700, zoomRateMax: 0.45, zoomInRateMax: 0.12, panMaxKmPerS: 0 };
/** *Câmara mais perto*: it follows the pen, so it smooths less and holds its pan. */
export const CLOSE_CAMERA: VideoCameraOptions = { zoomInMax: 1.3, smoothMs: 350, zoomRateMax: 0.45, zoomInRateMax: 0.45, panMaxKmPerS: 26 };

const KM_PER_DEG = 111.32;

/**
 * The camera for every `stepMs` of a film `durationMs` long.
 *
 * `follow(t)` (close camera) returns where the pen is, or null when there is
 * none; then the target is the whole trip. Without it, the target is the
 * framing of the day under way.
 */
export function videoCameraPath(input: {
  whole: [number, number, number, number];
  days: readonly CameraDay[];
  viewport: Viewport;
  durationMs: number;
  stepMs: number;
  options: VideoCameraOptions;
  follow?: (atMs: number) => { lon: number; lat: number } | null;
  /**
   * What has to be on screen at each moment (the day's road drawn so far),
   * inside `padding`. Without it a smoothed camera cropped the day's own road
   * in 8% of frames on the lead's trip, a third of it at worst (T-329, 25 Nov 2026).
   */
  keep?: { boundsAt: (atMs: number) => Bounds | null; padding: Padding };
}): CameraSample[] {
  const { viewport, stepMs, options } = input;
  const wholeFit = fitBounds(input.whole, viewport);
  if (wholeFit === null) return [];
  const whole: VideoCamera = { lon: wholeFit.coordinates.longitude, lat: wholeFit.coordinates.latitude, zoom: wholeFit.zoom };
  const dayCams = input.days.map((day) => {
    const fit = fitBounds(day.bounds, {
      ...viewport,
      padding: {
        top: (viewport.padding?.top ?? 0) + 20,
        bottom: (viewport.padding?.bottom ?? 0) + 20,
        left: (viewport.padding?.left ?? 0) + 16,
        right: (viewport.padding?.right ?? 0) + 16,
      },
    });
    if (fit === null) return whole;
    return { lon: fit.coordinates.longitude, lat: fit.coordinates.latitude, zoom: clamp(fit.zoom, whole.zoom, whole.zoom + options.zoomInMax) };
  });

  // The targets, frame by frame.
  const count = Math.max(1, Math.ceil(input.durationMs / stepMs) + 1);
  const raw: VideoCamera[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i * stepMs;
    let day = -1;
    for (let d = 0; d < input.days.length; d += 1) if (input.days[d].startMs <= t) day = d;
    if (input.follow) {
      const pen = day < 0 ? null : input.follow(t);
      raw.push(pen === null ? whole : { lon: pen.lon, lat: pen.lat, zoom: whole.zoom + options.zoomInMax });
    } else {
      raw.push(day < 0 ? whole : dayCams[day]);
    }
  }

  // Smoothed both ways.
  const sigma = Math.max(1e-6, options.smoothMs / stepMs);
  const reach = Math.ceil(sigma * 3);
  const weights: number[] = [];
  for (let j = -reach; j <= reach; j += 1) weights.push(Math.exp(-(j * j) / (2 * sigma * sigma)));
  const out: VideoCamera[] = raw.map((_, i) => {
    let lon = 0;
    let lat = 0;
    let zoom = 0;
    let w = 0;
    for (let j = -reach; j <= reach; j += 1) {
      const r = raw[clamp(i + j, 0, count - 1)];
      const k = weights[j + reach];
      lon += r.lon * k;
      lat += r.lat * k;
      zoom += r.zoom * k;
      w += k;
    }
    return { lon: lon / w, lat: lat / w, zoom: zoom / w };
  });

  // Zoom speed held, forwards then backwards so neither end is favoured.
  const zoomStep = (options.zoomRateMax * stepMs) / 1000;
  holdBothWays(out, (prev, cur) => {
    cur.zoom = clamp(cur.zoom, prev.zoom - zoomStep, prev.zoom + zoomStep);
  });
  // What must stay in view: zoom out enough, never past the speed limit, so
  // the limit is met by starting earlier rather than by cropping.
  if (input.keep) {
    const { boundsAt, padding } = input.keep;
    const ceiling = out.map((camera, i) => zoomToHold(camera, boundsAt(i * stepMs), input.viewport, padding));
    for (let i = 1; i < count; i += 1) ceiling[i] = Math.min(ceiling[i], ceiling[i - 1] + zoomStep);
    for (let i = count - 2; i >= 0; i -= 1) ceiling[i] = Math.min(ceiling[i], ceiling[i + 1] + zoomStep);
    out.forEach((camera, i) => {
      camera.zoom = Math.min(camera.zoom, ceiling[i]);
    });
  }
  // Closing in held slower still; this only ever zooms out, so nothing kept leaves the frame.
  const inStep = (Math.min(options.zoomInRateMax, options.zoomRateMax) * stepMs) / 1000;
  for (let i = 1; i < count; i += 1) out[i].zoom = Math.min(out[i].zoom, out[i - 1].zoom + inStep);
  // Pan speed held, when asked.
  if (options.panMaxKmPerS > 0) {
    const panStepDeg = (options.panMaxKmPerS * stepMs) / 1000 / KM_PER_DEG;
    holdBothWays(out, (prev, cur) => {
      const k = Math.cos((cur.lat * Math.PI) / 180);
      const dx = (cur.lon - prev.lon) * k;
      const dy = cur.lat - prev.lat;
      const d = Math.hypot(dx, dy);
      if (d > panStepDeg) {
        cur.lon = prev.lon + ((dx / d) * panStepDeg) / k;
        cur.lat = prev.lat + (dy / d) * panStepDeg;
      }
    });
  }

  return out.map((camera, i) => ({ ...camera, atMs: i * stepMs }));
}

/**
 * The close: from `fromMs`, ease the path over `overMs` to rest on `target`
 * (the whole trip, centred), and hold it there to the end. The by-day path
 * parks the island where a card would leave room; without the card it should
 * sit in the middle (the lead saw it sink to the bottom edge, 24 Nov).
 */
export function settleCamera(path: readonly CameraSample[], target: VideoCamera, fromMs: number, overMs: number): CameraSample[] {
  return path.map((sample) => {
    const u = easeInOut((sample.atMs - fromMs) / overMs);
    if (u <= 0) return sample;
    return {
      atMs: sample.atMs,
      lon: sample.lon + (target.lon - sample.lon) * u,
      lat: sample.lat + (target.lat - sample.lat) * u,
      zoom: sample.zoom + (target.zoom - sample.zoom) * u,
    };
  });
}

/**
 * Zoom added to the camera at `atMs` so it is never still at either end: the
 * film opens a little wide and settles in while the title rises, and after the
 * close it keeps drifting in, slowly, to the last frame (the close sat frozen
 * for three seconds, 25 Nov). Levels, Google's; negative is wider.
 */
export function cameraBreath(atMs: number, at: { openMs: number; driftFromMs: number; endMs: number }): number {
  const opening = -OPEN_ZOOM * (1 - Math.sin((Math.PI / 2) * clamp(atMs / Math.max(1, at.openMs), 0, 1)));
  const u = clamp((atMs - at.driftFromMs) / Math.max(1, at.endMs - at.driftFromMs), 0, 1);
  return opening + DRIFT_ZOOM * u * u * (3 - 2 * u);
}

/** How wide the film opens, and how far the close drifts in, levels. */
export const OPEN_ZOOM = 0.25;
export const DRIFT_ZOOM = 0.12;

/**
 * The opening: held on `target` (the whole trip, centred) until `untilMs -
 * overMs`, then eased onto the path by `untilMs`. The mirror of `settleCamera`.
 */
export function openCamera(path: readonly CameraSample[], target: VideoCamera, untilMs: number, overMs: number): CameraSample[] {
  return path.map((sample) => {
    const u = easeInOut((sample.atMs - (untilMs - overMs)) / overMs);
    if (u >= 1) return sample;
    return {
      atMs: sample.atMs,
      lon: target.lon + (sample.lon - target.lon) * u,
      lat: target.lat + (sample.lat - target.lat) * u,
      zoom: target.zoom + (sample.zoom - target.zoom) * u,
    };
  });
}

/**
 * *Inclinada* (T-329, 25 Nov 2026): the map tilted `pitch` degrees and turned
 * so the island's length runs up the frame, the whole trip in view the whole
 * time, the camera turning slowly round it from `bearingFrom` to `bearingTo`.
 * A wide island in a tall frame left a third of the flat video empty sea; tilted
 * and turned it sits about 0.85 levels closer (the sketch, `tools/out/tilt-try.html`).
 */
export const TILT = { bearingFrom: 262, bearingTo: 278, pitch: 50 };

export type TiltedSample = CameraSample & { bearing: number; pitch: number };

export function tiltedCameraPath(input: {
  whole: Bounds;
  viewport: Viewport;
  durationMs: number;
  stepMs: number;
}): TiltedSample[] {
  const { whole, viewport, stepMs } = input;
  const [west, south, east, north] = whole;
  const cx = (mercX(west) + mercX(east)) / 2;
  const cy = (mercY(north) + mercY(south)) / 2;
  const zoom = Math.min(...[TILT.bearingFrom, (TILT.bearingFrom + TILT.bearingTo) / 2, TILT.bearingTo].map((b) => tiltedFitZoom(whole, viewport, b, TILT.pitch)));
  const lon = cx * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * cy))) * 180) / Math.PI;
  const count = Math.max(1, Math.ceil(input.durationMs / stepMs) + 1);
  return Array.from({ length: count }, (_, i) => {
    const u = easeInOut((i * stepMs) / Math.max(1, input.durationMs));
    return { atMs: i * stepMs, lon, lat, zoom, bearing: TILT.bearingFrom + (TILT.bearingTo - TILT.bearingFrom) * u, pitch: TILT.pitch };
  });
}

/**
 * The closest zoom (Google's) at which `bounds`, turned to `bearing` and
 * tilted to `pitch`, fits the padded frame: its depth foreshortened by the
 * tilt's cosine, with a margin for the near side, which perspective enlarges.
 */
export function tiltedFitZoom(bounds: Bounds, viewport: Viewport, bearing: number, pitch: number): number {
  const [west, south, east, north] = bounds;
  const b = (bearing * Math.PI) / 180;
  const corners = [[west, south], [west, north], [east, south], [east, north]].map(([lon, lat]) => {
    const dx = mercX(lon);
    const dy = -mercY(lat); // north up
    return { right: dx * Math.cos(b) - dy * Math.sin(b), up: dx * Math.sin(b) + dy * Math.cos(b) };
  });
  const span = (values: number[]) => Math.max(...values) - Math.min(...values);
  const width = span(corners.map((c) => c.right));
  const depth = span(corners.map((c) => c.up)) * Math.cos((pitch * Math.PI) / 180) * NEAR_MARGIN;
  const padding = viewport.padding ?? {};
  const usableW = viewport.width - (padding.left ?? 0) - (padding.right ?? 0);
  const usableH = viewport.height - (padding.top ?? 0) - (padding.bottom ?? 0);
  return Math.log2(Math.min(usableW / width, usableH / depth) / 256);
}

/** The near half of a tilted map is larger than the cosine says, the far half smaller; on the P30 they balanced (1.2 left the island a quarter level too far). */
const NEAR_MARGIN = 1.0;

/** The camera at `atMs`, between samples. */
export function videoCameraAt(path: readonly CameraSample[], atMs: number): VideoCamera | null {
  if (path.length === 0) return null;
  const step = path.length > 1 ? path[1].atMs - path[0].atMs : 1;
  const f = clamp(atMs / step, 0, path.length - 1);
  const i = Math.floor(f);
  const u = f - i;
  const a = path[i];
  const b = path[Math.min(path.length - 1, i + 1)];
  return { lon: a.lon + (b.lon - a.lon) * u, lat: a.lat + (b.lat - a.lat) * u, zoom: a.zoom + (b.zoom - a.zoom) * u };
}

/** The closest zoom (Google's) at which `bounds` sits inside the padded frame, the camera's centre unmoved. */
export function zoomToHold(camera: VideoCamera, bounds: Bounds | null, viewport: Viewport, padding: Padding): number {
  if (bounds === null) return Infinity;
  const [west, south, east, north] = bounds;
  const halfW = viewport.width / 2;
  const halfH = viewport.height / 2;
  const cx = mercX(camera.lon);
  const cy = mercY(camera.lat);
  // World width in points that each edge allows; the smallest wins.
  let world = Infinity;
  const allow = (offset: number, room: number) => {
    if (offset > 1e-12) world = Math.min(world, Math.max(1, room) / offset);
  };
  allow(mercX(east) - cx, halfW - (padding.right ?? 0));
  allow(cx - mercX(west), halfW - (padding.left ?? 0));
  allow(mercY(south) - cy, halfH - (padding.bottom ?? 0));
  allow(cy - mercY(north), halfH - (padding.top ?? 0));
  return world === Infinity ? Infinity : Math.log2(world / 256);
}

function mercX(lon: number): number {
  return (lon + 180) / 360;
}

function mercY(lat: number): number {
  return (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
}

function holdBothWays(path: VideoCamera[], hold: (prev: VideoCamera, cur: VideoCamera) => void): void {
  for (let i = 1; i < path.length; i += 1) hold(path[i - 1], path[i]);
  for (let i = path.length - 2; i >= 0; i -= 1) hold(path[i + 1], path[i]);
}

function easeInOut(u: number): number {
  const x = clamp(u, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

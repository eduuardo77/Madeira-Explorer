/**
 * The video you keep, on a 3D map (T-329, D-112; the lead, 25 Nov 2026: "do the
 * video on a 3d map with orographic/terrain features").
 *
 * MapLibre Android has no 3D terrain; MapLibre GL JS has, so the video is drawn
 * here, in a WebView the app hosts (`BrumaVideoView.kt`), and encoded here too:
 *
 *   - the map: Bruma's own tiles and relief (D-112), the relief raised as
 *     terrain, the trip's roads a layer draped over it, under the place names;
 *   - the overlay (title, figures, stamp names, the pen, the watermark, the end
 *     card) drawn on a canvas over it, as `videoOverlay.ts` plans each frame;
 *   - saving: frame by frame onto one canvas, encoded by the phone's video
 *     encoder (WebCodecs), muxed to MP4, and handed to the app in pieces.
 *
 * What shows and when is all in the job (`app/src/souvenir/videoJob.ts`); this
 * file decides how it looks. Measures are points of the 360 x 640 frame.
 *
 * The map is always north up (the lead, 25 Nov); the job tilts it.
 */
'use strict';

const W = 360;
const H = 640;
/** How far the relief is raised: Madeira's 1,862 m read at the whole island's distance. */
const EXAGGERATION = 1.8;
/** New road stays bright this long, ms, then settles to the deep red. */
const FRESH_MS = 900;
const SETTLED = [0xb3, 0x3a, 0x0a];
const LIT = [0xe8, 0x55, 0x14];
const FRESH = [0xff, 0x7a, 0x33];
const INK = '#14202B';
const SUB = '#4A5560';
const MUTED = '#5A646D';
const RED = '#B33A0A';
const FONT = 'Roboto, "Noto Sans", sans-serif';

let job = null;
let map = null;
let icon = null;
let playing = false;
let exporting = null;
let startedAt = 0;
const overlay = document.getElementById('overlay');
const stage = document.getElementById('stage');

/** Messages to the app (`BrumaVideoView.kt`), or the console in a browser. */
const app = window.BrumaNative ?? {
  ready() {}, progress() {}, chunk() {}, done(r) { console.log('done', r); }, failed(m) { console.error(m); }, log(m) { console.log(m); },
};

window.addEventListener('error', (e) => app.log(`error: ${e.message} at ${e.lineno}:${e.colno}`));
window.addEventListener('unhandledrejection', (e) => app.log(`rejection: ${e.reason && (e.reason.stack || e.reason.message) || e.reason}`));

// --- the page fills the view -------------------------------------------------

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H) || 1;
  stage.style.transform = `scale(${s})`;
  return s;
}
// The app lays the view out after the page has loaded, and may again: re-fit on every change of size.
new ResizeObserver(() => { fit(); if (map && !exporting) setPreviewRatio(); }).observe(document.documentElement);

function setPreviewRatio() {
  const r = window.devicePixelRatio * fit();
  map.setPixelRatio(r);
  overlay.width = Math.round(W * r);
  overlay.height = Math.round(H * r);
}

// --- loading -----------------------------------------------------------------

/** Called by the app with the job, the map style and the app's icon (a data URL). */
async function load(jobData, style, iconUrl) {
  try {
    job = jobData;
    icon = iconUrl ? await image(iconUrl) : null;
    buildRoads();
    if (map) { map.remove(); map = null; }
    map = await makeMap(style);
    setPreviewRatio();
    resetRoads();
    showFrame(0);
    startedAt = performance.now();
    app.ready();
    if (playing) loop();
  } catch (e) {
    app.failed(`load: ${e && e.message || e}`);
  }
}

function image(url) {
  return new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = url; });
}

/** Archives read whole into memory: the app's server answers whole files, not ranges. */
class WholeFile {
  constructor(url) { this.url = url; this.bytes = fetch(url).then((r) => r.arrayBuffer()); }
  getKey() { return this.url; }
  async getBytes(offset, length) { const b = await this.bytes; return { data: b.slice(offset, offset + length) }; }
}

let protocol = null;

async function makeMap(styleIn) {
  // The app's files, as its server here serves them (`BrumaVideoView.kt`).
  const style = JSON.parse(JSON.stringify(styleIn).replace(/file:\/\/[^"]*?\/cache\//g, `${location.origin}/cache/`));
  if (protocol === null) {
    protocol = new pmtiles.Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
  }
  for (const source of Object.values(style.sources)) {
    if (typeof source.url === 'string' && source.url.startsWith('pmtiles://')) {
      protocol.add(new pmtiles.PMTiles(new WholeFile(source.url.slice('pmtiles://'.length))));
    }
  }
  // The relief raised: its own source, as MapLibre asks, beside the hillshade's.
  const dem = Object.entries(style.sources).find(([, s]) => s.type === 'raster-dem');
  if (dem) {
    style.sources.relief = { ...dem[1] };
    style.terrain = { source: 'relief', exaggeration: EXAGGERATION };
  }
  // The trip's roads, under the names.
  style.sources.trip = { type: 'geojson', data: roadData };
  const firstLabel = style.layers.findIndex((l) => l.type === 'symbol');
  const at = firstLabel < 0 ? style.layers.length : firstLabel;
  const width = (k) => ['interpolate', ['linear'], ['zoom'], 8, 2.2 * k, 10, 3.2 * k, 12, 4.6 * k];
  const on = ['boolean', ['feature-state', 'on'], false];
  style.layers.splice(at, 0,
    { id: 'trip-glow', type: 'line', source: 'trip', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': rgb(LIT), 'line-width': width(3.4), 'line-blur': 4, 'line-opacity': 0 } },
    { id: 'trip-casing', type: 'line', source: 'trip', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': width(1.9), 'line-opacity': ['case', on, 0.85, 0] } },
    { id: 'trip', type: 'line', source: 'trip', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': coreColor(0), 'line-width': width(1), 'line-opacity': ['case', on, 1, 0] } },
  );
  const m = new maplibregl.Map({
    container: 'map', style, interactive: false, attributionControl: false, fadeDuration: 0,
    preserveDrawingBuffer: true, maxPitch: 85, center: [job.frames[0][1], job.frames[0][2]], zoom: job.frames[0][3],
  });
  await new Promise((resolve, reject) => { m.once('load', resolve); m.once('error', (e) => reject(e.error || e)); });
  await settled(m, 8000);
  return m;
}

/** Waits for the map to draw with its tiles in, `ms` at most. */
function settled(m, ms) {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(done, ms);
    if (m.loaded() && m.areTilesLoaded()) { m.once('render', done); m.triggerRepaint(); } else m.once('idle', done);
  });
}

// --- the roads: one feature per segment, shown by time -------------------------

let roadData = null;
/** [endMs, id] in the order the pen reaches them. */
let segments = [];

function buildRoads() {
  const features = [];
  segments = [];
  let id = 0;
  for (const stroke of job.strokes) {
    for (let k = 1; k < stroke.c.length; k += 1) {
      const a = stroke.c[k - 1];
      const b = stroke.c[k];
      features.push({ type: 'Feature', id, properties: {}, geometry: { type: 'LineString', coordinates: [[a[0] / 1e5, a[1] / 1e5], [b[0] / 1e5, b[1] / 1e5]] } });
      segments.push([stroke.t[k], id]);
      id += 1;
    }
  }
  segments.sort((p, q) => p[0] - q[0]);
  roadData = { type: 'FeatureCollection', features };
}

let shownTo = 0; // segments[0, shownTo) are on
let fresh = new Map(); // id -> endMs, while fresh
let lastT = -1;

function resetRoads() {
  if (map) map.removeFeatureState({ source: 'trip' });
  shownTo = 0;
  fresh = new Map();
  lastT = -1;
}

/** The roads as the pen has them at `t`: new ones switched on, fresh ones fading. */
function roadsAt(t) {
  if (t < lastT) resetRoads();
  lastT = t;
  while (shownTo < segments.length && segments[shownTo][0] <= t) {
    const [end, id] = segments[shownTo];
    fresh.set(id, end);
    shownTo += 1;
  }
  for (const [id, end] of fresh) {
    const age = Math.min(1, (t - end) / FRESH_MS);
    map.setFeatureState({ source: 'trip', id }, { on: true, age });
    if (age >= 1) fresh.delete(id);
  }
}

/** The road's colour: fresh orange settling to red; at the close, red warming toward lit. */
function coreColor(glow) {
  const settledNow = mix(SETTLED, LIT, glow);
  return ['interpolate', ['linear'], ['coalesce', ['feature-state', 'age'], 1], 0, rgb(FRESH), 1, rgb(settledNow)];
}

let shownGlow = -1;
function glowAt(g) {
  const q = Math.round(g * 50) / 50;
  if (q === shownGlow) return;
  shownGlow = q;
  map.setPaintProperty('trip', 'line-color', coreColor(q));
  map.setPaintProperty('trip-glow', 'line-opacity', ['case', ['boolean', ['feature-state', 'on'], false], 0.3 * q, 0]);
}

// --- one frame -----------------------------------------------------------------

function showFrame(i) {
  const f = job.frames[i];
  map.jumpTo({ center: [f[1], f[2]], zoom: f[3], bearing: f[4] || 0, pitch: f[5] || 0, padding: { top: f[6] || 0, bottom: 0, left: 0, right: 0 } });
  roadsAt(f[0]);
  glowAt(job.overlays[i].roadGlow || 0);
}

// --- preview -------------------------------------------------------------------

function play(value) {
  playing = value;
  if (value) { startedAt = performance.now() - (pausedAt || 0); loop(); } else pausedAt = performance.now() - startedAt;
}
let pausedAt = 0;
let looping = false;

function loop() {
  if (looping) return;
  looping = true;
  const tick = (now) => {
    if (!playing || exporting || !map) { looping = false; return; }
    // A frame's time can be a little before `startedAt` (it is when the frame began).
    const elapsed = Math.max(0, now - startedAt) % job.durationMs;
    const i = Math.min(job.frames.length - 1, Math.floor((elapsed * job.fps) / 1000));
    showFrame(i);
    const ctx = overlay.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.scale(overlay.width / W, overlay.height / H);
    paintOverlay(ctx, job.overlays[i]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// --- saving --------------------------------------------------------------------

async function exportVideo() {
  if (exporting) return;
  const run = { cancelled: false };
  exporting = run;
  const startedMs = performance.now();
  try {
    const ratio = job.pixelRatio;
    const outW = Math.round(W * ratio);
    const outH = Math.round(H * ratio);
    map.setPixelRatio(ratio);
    overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
    const frame = document.createElement('canvas');
    frame.width = outW;
    frame.height = outH;
    const ctx = frame.getContext('2d');

    const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: outW, height: outH, frameRate: job.fps }, fastStart: 'in-memory' });
    let failure = null;
    let told = false;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (!told && meta && meta.decoderConfig) { told = true; app.log(`encoder: ${JSON.stringify({ ...meta.decoderConfig, description: undefined })}`); }
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e) => { failure = e; },
    });
    encoder.configure(await encoderConfig(outW, outH, job.fps));

    resetRoads();
    await settled(map, 8000);
    const total = job.frames.length;
    for (let i = 0; i < total; i += 1) {
      if (run.cancelled) throw new Error('cancelled');
      if (failure) throw failure;
      showFrame(i);
      await settled(map, 3000);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(map.getCanvas(), 0, 0, outW, outH);
      ctx.scale(ratio, ratio);
      paintOverlay(ctx, job.overlays[i]);
      const vf = new VideoFrame(frame, { timestamp: Math.round((i * 1e6) / job.fps), duration: Math.round(1e6 / job.fps) });
      encoder.encode(vf, { keyFrame: i % job.fps === 0 });
      vf.close();
      while (encoder.encodeQueueSize > 3) await new Promise((r) => setTimeout(r, 2));
      if ((i + 1) % 6 === 0 || i + 1 === total) app.progress(i + 1, total);
    }
    await encoder.flush();
    encoder.close();
    muxer.finalize();
    const bytes = new Uint8Array(muxer.target.buffer);
    // Handed over in pieces: the bridge carries text.
    const piece = 384 * 1024;
    for (let at = 0; at < bytes.length; at += piece) app.chunk(base64(bytes.subarray(at, at + piece)));
    app.done(JSON.stringify({ frames: total, ms: Math.round(performance.now() - startedMs) }));
  } catch (e) {
    app.failed(run.cancelled ? 'cancelled' : `export: ${e && e.message || e}`);
  } finally {
    exporting = null;
    setPreviewRatio();
    resetRoads();
    startedAt = performance.now();
    if (playing) loop();
  }
}

function cancel() { if (exporting) exporting.cancelled = true; }

/** The best H.264 the phone's encoder takes at this size. */
async function encoderConfig(width, height, framerate) {
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42002a']) {
    const config = { codec, width, height, framerate, bitrate: 9_000_000, avc: { format: 'avc' }, hardwareAcceleration: 'prefer-hardware' };
    const { supported } = await VideoEncoder.isConfigSupported(config);
    if (supported) return config;
  }
  throw new Error('no H.264 encoder for this size');
}

function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// --- the overlay ---------------------------------------------------------------
// The sketch's measures, in points; the caller has scaled the context.

function paintOverlay(ctx, o) {
  head(ctx, o.head);
  titleBlock(ctx, o.title, o.line);
  if (o.day) day(ctx, o.day);
  if (o.pill) pill(ctx, o.pill, o.line !== null);
  if (o.card) card(ctx, o.card);
  if (o.finale) finale(ctx, o.finale);
  watermark(ctx, o.watermark);
  if (o.endCard) endCard(ctx, o.endCard);
  text(ctx, o.credit, 12, H - 7, 8.5, 'rgba(62,74,84,0.8)', 400);
}

/** Screen point of (lon, lat) on the map, the relief included. */
function project(lon, lat) {
  const p = map.project([lon, lat]);
  return [p.x, p.y];
}

function head(ctx, h) {
  if (!h || h.opacity <= 0.01) return;
  const o = h.opacity;
  if (h.tail.length >= 2) {
    const pts = h.tail.map(([lon, lat]) => project(lon, lat));
    const a = pts[0];
    const b = pts[pts.length - 1];
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, 'rgba(255,140,80,0)');
    g.addColorStop(1, `rgba(255,140,80,${0.85 * o})`);
    ctx.save();
    ctx.strokeStyle = g; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.restore();
  }
  const [x, y] = project(h.lon, h.lat);
  ctx.fillStyle = `rgba(255,154,92,${0.55 * o})`;
  ctx.beginPath(); ctx.arc(x, y, 11 * h.scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${o})`;
  ctx.beginPath(); ctx.arc(x, y, 3.6 * (0.6 + 0.4 * h.scale), 0, Math.PI * 2); ctx.fill();
}

function titleBlock(ctx, title, line) {
  const o = title.opacity;
  if (o > 0.01) {
    const g = ctx.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, `rgba(255,255,255,${0.9 * o})`);
    g.addColorStop(0.55, `rgba(255,255,255,${0.5 * o})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 120);
    text(ctx, title.text, 20, 48 + title.offsetY, 28, alpha(INK, o), 700);
    text(ctx, title.dates, 20, 66 + title.offsetY, 12.5, alpha(SUB, o), 500);
  }
  if (line && line.opacity > 0.01) text(ctx, line.text, 20, 84, 13, alpha(RED, line.opacity), 700);
}

function day(ctx, d) {
  if (d.opacity <= 0.01) return;
  text(ctx, d.text, W - 16, 46, 15, alpha(INK, d.opacity), 700, 'right');
  text(ctx, d.date, W - 16, 84, 12, alpha(SUB, d.opacity), 500, 'right');
}

function pill(ctx, p, underLine) {
  const o = p.opacity;
  if (o <= 0.01) return;
  const nameW = measure(ctx, p.name, 13, 700);
  const moreW = p.more ? 8 + measure(ctx, p.more, 12, 500) : 0;
  const w = 34 + nameW + moreW + 13;
  const left = 20 + p.offsetX;
  const top = underLine ? 96 : 84;
  const h = 30;
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${0.14 * o})`; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1;
  ctx.fillStyle = `rgba(255,255,255,${0.96 * o})`;
  roundRect(ctx, left, top, w, h, h / 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = alpha(RED, o);
  ctx.beginPath(); ctx.arc(left + 16, top + h / 2, 10, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${o})`; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(left + 11.5, top + h / 2); ctx.lineTo(left + 15, top + h / 2 + 3.5); ctx.lineTo(left + 21, top + h / 2 - 3.5); ctx.stroke();
  ctx.restore();
  const baseline = top + h / 2 + 4.5;
  text(ctx, p.name, left + 34, baseline, 13, alpha(INK, o), 700);
  if (p.more) text(ctx, p.more, left + 34 + nameW + 8, baseline, 12, alpha(MUTED, o), 500);
}

function card(ctx, c) {
  const o = c.opacity;
  if (o <= 0.01) return;
  const top = H - 26 - 84 + c.offsetY;
  const r = { left: 14, top, right: W - 14, bottom: top + 84 };
  panel(ctx, r, o);
  const half = (r.right - r.left - 36) / 2;
  const x1 = r.left + 18;
  const x2 = x1 + half + 18;
  text(ctx, c.km, x1, r.top + 42, 30, alpha(RED, o), 700);
  text(ctx, c.kmLabel, x1, r.top + 60, 12, alpha(MUTED, o), 500);
  text(ctx, c.stamps, x2, r.top + 42, 30, alpha(RED, o), 700);
  text(ctx, c.stampsLabel, x2, r.top + 60, 12, alpha(MUTED, o), 500);
  const barW = r.right - 18 - x1;
  ctx.fillStyle = `rgba(236,232,223,${o})`; roundRect(ctx, x1, r.bottom - 15, barW, 3, 2); ctx.fill();
  ctx.fillStyle = alpha(RED, o); roundRect(ctx, x1, r.bottom - 15, barW * c.progress, 3, 2); ctx.fill();
}

function finale(ctx, f) {
  const o = f.opacity;
  if (o <= 0.01) return;
  const top = H - 26 - 130 + f.offsetY;
  const r = { left: 14, top, right: W - 14, bottom: top + 130 };
  panel(ctx, r, o);
  const cx = W / 2;
  const countW = measure(ctx, f.count, 60, 700);
  const totalW = measure(ctx, f.total, 26, 500);
  const x = cx - (countW + totalW) / 2;
  text(ctx, f.count, x, r.top + 66, 60, alpha(INK, o), 700);
  text(ctx, f.total, x + countW, r.top + 66, 26, alpha(MUTED, o), 500);
  text(ctx, f.placesLabel, cx, r.top + 90, 14, alpha(INK, o), 700, 'center');
  text(ctx, f.km, cx, r.top + 110, 13, alpha(MUTED, o), 400, 'center');
}

function panel(ctx, r, o) {
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${0.12 * o})`; ctx.shadowBlur = 9; ctx.shadowOffsetY = 2;
  ctx.fillStyle = `rgba(255,255,255,${0.87 * o})`;
  roundRect(ctx, r.left, r.top, r.right - r.left, r.bottom - r.top, 20); ctx.fill();
  ctx.restore();
}

/** The white signature: the island, a hairline, the name. Free: large, low in the frame; paid: small, in a corner. */
function watermark(ctx, w) {
  const o = w.opacity;
  if (o <= 0.01) return;
  const free = w.tier === 'free';
  const size = free ? 42 : 10;
  const glyphW = free ? 78 : 17;
  const gap = free ? 18 : 5;
  const label = job.appName.toUpperCase();
  const strength = (free ? 0.93 : 0.85) * o;
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.letterSpacing = `${(free ? 0.12 : 0.08) * size}px`;
  const nameW = ctx.measureText(label).width;
  const glyphH = glyphW * (job.glyph.height / job.glyph.width);
  const total = glyphW + gap * 2 + 2 + nameW;
  const left = free ? (W - total) / 2 : W - 12 - total;
  const cy = free ? H * 0.66 : H - 11;
  ctx.shadowColor = 'rgba(0,0,0,0.47)'; ctx.shadowBlur = free ? 3 : 1.5; ctx.shadowOffsetY = 1;
  ctx.fillStyle = `rgba(255,255,255,${strength})`;
  const k = glyphW / job.glyph.width;
  ctx.beginPath();
  for (const ring of job.glyph.rings) {
    ring.forEach(([x, y], j) => (j ? ctx.lineTo(left + x * k, cy - glyphH / 2 + y * k) : ctx.moveTo(left + x * k, cy - glyphH / 2 + y * k)));
    ctx.closePath();
  }
  ctx.fill();
  if (free) ctx.fillRect(left + glyphW + gap, cy - 15, 2, 30);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, left + glyphW + (free ? gap * 2 + 2 : gap), cy + size * 0.36);
  ctx.restore();
}

function endCard(ctx, e) {
  const o = e.opacity;
  if (o <= 0.01) return;
  ctx.fillStyle = `rgba(250,248,243,${0.86 * o})`;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(e.scale, e.scale); ctx.translate(-W / 2, -H / 2);
  const cy = H / 2;
  if (icon) {
    const s = 72;
    ctx.save();
    ctx.globalAlpha = o;
    roundRect(ctx, W / 2 - s / 2, cy - 110, s, s, 18); ctx.clip();
    ctx.drawImage(icon, W / 2 - s / 2, cy - 110, s, s);
    ctx.restore();
  }
  text(ctx, job.appName, W / 2, cy + 12, 44, alpha(INK, o), 700, 'center');
  text(ctx, e.text, W / 2, cy + 40, 14, alpha(MUTED, o), 400, 'center');
  ctx.restore();
}

// --- drawing helpers -------------------------------------------------------------

function text(ctx, s, x, y, size, color, weight, align = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.letterSpacing = '0px';
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function measure(ctx, s, size, weight) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.letterSpacing = '0px';
  return ctx.measureText(s).width;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), h, Math.min(r, h / 2, Math.max(0, w) / 2));
}

function alpha(hex, o) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, o))})`;
}

function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function mix(a, b, u) { return a.map((v, i) => Math.round(v + (b[i] - v) * u)); }

window.bruma = { load, play, exportVideo, cancel };
fit();

/**
 * What the video you keep shows over the map, frame by frame (T-329, D-112).
 *
 * The sketch the lead approved (`tools/lib/video-natural-page.html`) decided
 * every word, fade and moment here; this module is that decision as code, so
 * the phone draws exactly what was approved. The renderer asks `overlayAt` for
 * a frame and draws what comes back; nothing about timing lives in it.
 *
 * What is on a frame:
 *   - the title (the destination) and the trip's dates, rising in at the start;
 *   - by `info`: *Discreta*, one line under the date ("152 km · 11 carimbos",
 *     at the close "32 de 84 lugares · 345 km de estradas acesas"); *Completa*,
 *     a card at the foot and at the close a card with the count rising; *Nenhuma*,
 *     nothing, and the title leaves after `TITLE_HOLD_MS`;
 *   - the day and its date, top right, while the pen draws (not with *Nenhuma*);
 *   - each stamp's name for `PILL_MS`, one at a time, "e mais 2" when several
 *     land together (not with *Nenhuma*);
 *   - the pen's head: a comet that grows in, fades in after a long move, and
 *     shrinks away as the camera pulls back;
 *   - how lit the roads are: at the close they all light up together;
 *   - the watermark (free: large; paid: small) and, free only, the end card.
 *
 * Pure: the plan, the strings and a language in; numbers and words out. Every
 * value is a function of the frame's time alone, so a video can be made frame
 * by frame in any order and comes out the same.
 */

import { APP_NAME } from '../brand.ts';
import { DATE_LOCALES, type Language } from '../i18n/languages.ts';
import { PLURALS, STRINGS } from '../i18n/strings.ts';
import { plural, translate } from '../i18n/translate.ts';
import { headAt, type PacedFilm } from './pacedFilm.ts';
import { formatDateRange } from './shareCard.ts';

export type InfoMode = 'full' | 'discreet' | 'none';
export type Tier = 'free' | 'paid';

/** A stamp's name stays this long; stamps landing meanwhile are counted into it. */
export const PILL_MS = 1100;
/** The closing count rises over this long. */
export const COUNT_UP_MS = 1100;
/** With *Nenhuma*, the title leaves after this long. */
export const TITLE_HOLD_MS = 2200;
/** The free version's closing card. */
export const END_CARD_MS = 2200;
/** The head's tail: the last this-many ms of the pen's stroke. */
export const TAIL_MS = 300;
/** A move of the head longer than this fades it in rather than leaping, metres. */
const LONG_MOVE_M = 1500;

export type OverlayInput = {
  language: Language;
  /** The destination's name, from content (D-017). */
  title: string;
  firstTs: number;
  lastTs: number;
  /** Days in the trip, for "Dia 17 de 62". */
  tripDays: number;
  paced: PacedFilm;
  /** Award place ids to their names. */
  placeNames: ReadonlyMap<string, string>;
  collected: number;
  total: number;
  drawStartMs: number;
  finaleAtMs: number;
  /** The film's own length; the free end card comes after it. */
  durationMs: number;
  info: InfoMode;
  tier: Tier;
};

export type OverlayPlan = OverlayInput & {
  pills: { startMs: number; endMs: number; name: string; more: number }[];
  /** For each stroke, whether the head arrives at it from far away. */
  arrivesFar: boolean[];
  dates: string;
};

export type OverlayFrame = {
  title: { text: string; dates: string; opacity: number; offsetY: number };
  line: { text: string; opacity: number } | null;
  card: { opacity: number; offsetY: number; km: string; kmLabel: string; stamps: string; stampsLabel: string; progress: number } | null;
  day: { text: string; date: string; opacity: number } | null;
  pill: { name: string; more: string; opacity: number; offsetX: number } | null;
  finale: { opacity: number; offsetY: number; count: string; total: string; placesLabel: string; km: string } | null;
  head: { lon: number; lat: number; opacity: number; scale: number; tail: [number, number][] } | null;
  /**
   * How lit the whole road network is, 0 to 1: nothing while drawing (the
   * fresh road glows on its own, in the painter), then at the close every
   * road lights up at once, peaks, and stays lit to the end.
   */
  roadGlow: number;
  watermark: { tier: Tier; opacity: number };
  endCard: { text: string; opacity: number; scale: number } | null;
  credit: string;
};

/** The whole video's length, the free end card included. */
export function videoDurationMs(plan: OverlayInput): number {
  return plan.durationMs + (plan.tier === 'free' ? END_CARD_MS : 0);
}

export function planOverlay(input: OverlayInput): OverlayPlan {
  // Stamp names, queued so each is read.
  const awards = [...input.paced.awards].sort((a, b) => a.atMs - b.atMs);
  const pills: OverlayPlan['pills'] = [];
  for (let i = 0; i < awards.length; ) {
    const startMs = Math.max(awards[i].atMs, pills.length > 0 ? pills[pills.length - 1].endMs : 0);
    if (startMs + PILL_MS > input.finaleAtMs - 200) break;
    let j = i + 1;
    while (j < awards.length && awards[j].atMs < startMs + PILL_MS) j += 1;
    pills.push({ startMs, endMs: startMs + PILL_MS, name: input.placeNames.get(awards[i].placeId) ?? '', more: j - i - 1 });
    i = j;
  }

  // Where the head would leap: a drawn stroke starting far from the last one's end.
  let previous: [number, number] | null = null;
  const arrivesFar = input.paced.strokes.map((stroke) => {
    if (stroke.quiet) return false;
    const first = stroke.coordinates[0];
    const far = previous === null || metresBetween(previous, first) > LONG_MOVE_M;
    previous = stroke.coordinates[stroke.coordinates.length - 1];
    return far;
  });

  return { ...input, pills, arrivesFar, dates: formatDateRange(input.firstTs, input.lastTs, input.language) };
}

export function overlayAt(plan: OverlayPlan, atMs: number): OverlayFrame {
  const { language, info, tier, drawStartMs, finaleAtMs, durationMs } = plan;
  const t = Math.max(0, Math.min(atMs, videoDurationMs(plan)));
  const finale = t >= finaleAtMs;
  const ending = tier === 'free' && t > durationMs;
  const drawTo = Math.min(t, finaleAtMs);
  // Gliding while drawn; at the close, the trip's own figure exactly (the
  // glide stopped a kilometre short on the P30: 374 against the viewer's 375).
  const finalKm = plan.paced.drawnKm.length > 0 ? plan.paced.drawnKm[plan.paced.drawnKm.length - 1][1] : 0;
  const km = Math.round(finale ? finalKm : smoothKmAt(plan.paced, drawTo));
  const stampsNow = plan.paced.awards.filter((award) => award.atMs <= drawTo).length;
  const countUp = Math.round(plan.collected * easeOut((t - finaleAtMs - 300) / COUNT_UP_MS));

  // Title: rises in; with *Nenhuma*, leaves after a beat; gone under the end card.
  const titleIn = fadeIn(t, 150, 600);
  const titleOut = info === 'none' ? 1 - fadeIn(t, TITLE_HOLD_MS, 500) : 1;
  const title = { text: plan.title, dates: plan.dates, opacity: ending ? 0 : titleIn * titleOut, offsetY: (1 - titleIn) * 10 };

  const line =
    info === 'discreet' && !ending
      ? {
          opacity: fadeIn(t, drawStartMs, 500),
          text: finale
            ? translate(STRINGS['video.line.close'], language, {
                places: plural(PLURALS['video.places'], plan.total, language, { collected: countUp }),
                km,
              })
            : translate(STRINGS['video.line.drawing'], language, {
                km,
                stamps: plural(PLURALS['video.stamps'], stampsNow, language),
              }),
        }
      : null;

  const cardIn = fadeIn(t, drawStartMs - 200, 500);
  const card =
    info === 'full' && !ending
      ? {
          opacity: cardIn * (1 - fadeIn(t, finaleAtMs - 250, 350)),
          offsetY: (1 - cardIn) * 14,
          km: String(km),
          kmLabel: translate(STRINGS['video.card.km'], language),
          stamps: String(stampsNow),
          stampsLabel: plural(PLURALS['video.card.stamps'], stampsNow, language),
          progress: clamp01((drawTo - drawStartMs) / (finaleAtMs - drawStartMs)),
        }
      : null;

  const heroIn = fadeIn(t, finaleAtMs + 150, 650);
  const finaleCard =
    info === 'full' && !ending
      ? {
          opacity: heroIn,
          offsetY: (1 - heroIn) * 22,
          count: String(countUp),
          total: ` / ${plan.total}`,
          placesLabel: plural(PLURALS['video.hero.places'], plan.total, language),
          km: translate(STRINGS['video.hero.km'], language, { km }),
        }
      : null;

  const dayNow = [...plan.paced.days].reverse().find((day) => day.startMs <= drawTo) ?? null;
  const day =
    dayNow !== null && info !== 'none' && !finale
      ? {
          text: translate(STRINGS['video.day'], language, { day: dayNow.dayNumber, days: plan.tripDays }),
          date: new Date(`${dayNow.key}T12:00:00Z`).toLocaleDateString(DATE_LOCALES[language], { day: 'numeric', month: 'long', timeZone: 'UTC' }),
          opacity: fadeIn(t, drawStartMs, 400) * (1 - fadeIn(t, finaleAtMs - 200, 300)),
        }
      : null;

  const current = info === 'none' ? undefined : plan.pills.find((p) => t >= p.startMs && t < p.endMs);
  const pill =
    current === undefined
      ? null
      : (() => {
          const u = (t - current.startMs) / PILL_MS;
          return {
            name: current.name,
            more: current.more > 0 ? translate(STRINGS['video.more'], language, { count: current.more }) : '',
            opacity: Math.min(easeOut(u / 0.2), 1 - easeOut((u - 0.8) / 0.2)),
            offsetX: (easeOut(u / 0.25) - 1) * 14,
          };
        })();

  return {
    title,
    line,
    card,
    day,
    pill,
    finale: finaleCard,
    head: finale ? null : headFrame(plan, t),
    roadGlow: roadGlowAt(t - finaleAtMs),
    watermark: { tier, opacity: ending ? 0 : 1 },
    endCard: ending
      ? { text: translate(STRINGS['video.endCard'], language, { app: APP_NAME }), opacity: fadeIn(t, durationMs, 450), scale: 0.96 + 0.04 * fadeIn(t, durationMs, 450) }
      : null,
    credit: translate(STRINGS['video.credit'], language),
  };
}

/** The pen's head: grows in as drawing starts, fades in after a long move, shrinks away before the close. */
function headFrame(plan: OverlayPlan, t: number): OverlayFrame['head'] {
  if (t <= plan.drawStartMs) return null;
  const head = headAt(plan.paced, t);
  if (head === null) return null;
  const stroke = plan.paced.strokes[head.strokeIndex];
  const scale = easeOut((t - plan.drawStartMs) / 400) * (1 - easeOut((t - (plan.finaleAtMs - 500)) / 500));
  const opacity = scale * (plan.arrivesFar[head.strokeIndex] ? easeOut((t - stroke.timesMs[0]) / 160) : 1);
  const tail: [number, number][] = [];
  stroke.timesMs.forEach((time, i) => {
    if (time >= t - TAIL_MS && time <= t) tail.push(stroke.coordinates[i]);
  });
  tail.push([head.lon, head.lat]);
  return { lon: head.lon, lat: head.lat, opacity, scale, tail };
}

/** The close's light: up in `GLOW_RISE_MS`, then down to `GLOW_REST` over `GLOW_SETTLE_MS`. */
export function roadGlowAt(sinceFinaleMs: number): number {
  if (sinceFinaleMs <= 0) return 0;
  if (sinceFinaleMs < GLOW_RISE_MS) return easeOut(sinceFinaleMs / GLOW_RISE_MS);
  return 1 - (1 - GLOW_REST) * easeOut((sinceFinaleMs - GLOW_RISE_MS) / GLOW_SETTLE_MS);
}

const GLOW_RISE_MS = 450;
const GLOW_SETTLE_MS = 1200;
export const GLOW_REST = 0.55;

/** Km drawn, averaged over the last 175 ms so the figure glides rather than ticks. */
function smoothKmAt(paced: PacedFilm, atMs: number): number {
  let sum = 0;
  for (let k = 0; k < 8; k += 1) sum += kmAt(paced, atMs - k * 25);
  return sum / 8;
}

function kmAt(paced: PacedFilm, atMs: number): number {
  const steps = paced.drawnKm;
  let lo = 0;
  let hi = steps.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (steps[mid][0] <= atMs) {
      best = steps[mid][1];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function metresBetween(a: readonly [number, number], b: readonly [number, number]): number {
  const k = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((b[0] - a[0]) * k, b[1] - a[1]) * 111_320;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOut(u: number): number {
  return 1 - Math.pow(1 - clamp01(u), 3);
}

function fadeIn(t: number, startMs: number, ms: number): number {
  return easeOut((t - startMs) / ms);
}

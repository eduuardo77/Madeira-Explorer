/**
 * The shareable still — one image of a whole trip (T-105d, T-107, D-063).
 *
 * WHY THIS BEFORE THE VIDEO
 * -------------------------
 * D-013 made the souvenir *video* the entire distribution strategy; D-051 cut
 * it; D-063 brought the souvenir back. The video still has one unproven piece —
 * encoding an MP4 on the device — and this has none: no native code, no new
 * dependency, both platforms, and it is judgeable before it ever reaches a
 * phone. It is most of the sharing value at a fraction of the risk.
 *
 * ⚠ **And it is the only part of the souvenir anybody has ever seen.**
 * `composition.ts` has produced a full storyboard since T-105a — scenes, camera
 * keyframes, stamp cues — and **not one frame of it has ever been rendered**,
 * which is why its timings are all marked NOT TUNED. This module is where the
 * souvenir stops being arithmetic.
 *
 * WHAT IT PRODUCES
 * ----------------
 * A **layout**, not a picture: positioned elements in card coordinates. Two
 * renderers consume it — `renderShareCardSvg` here, which is what the app draws
 * through `react-native-svg`, and `tools/preview-souvenir.mjs`, which writes the
 * same card to a file so it can be looked at without a device. Same reason the
 * stamps have a second renderer: geometry that passes every test can still come
 * out looking like a crosshair.
 *
 * THE RULES IT INHERITS
 * ---------------------
 *   - **Stamps are the score** (D-002). The hero is `23 / 60`, never a
 *     percentage and never kilometres.
 *   - **The trace is the picture** (D-032). It is drawn from the same cleaned
 *     strokes the map draws (D-066), so the souvenir cannot flatter the app.
 *   - **Nothing identifies where you slept** (D-016, T-104). This module takes
 *     the trace it is given; masking belongs to `exportTrace.ts`, which is the
 *     single door D-040 requires all exports to pass through.
 *   - **No account, no watermark of anybody else's** (D-001). The only mark is
 *     the app's own name.
 *
 * Pure: no Expo, no database, no clock. Tested in `shareCard.test.ts`.
 */

/** A point of the trace, in [lon, lat]. */
export type CardPoint = [lon: number, lat: number];

export type ShareCardInput = {
  /** "Madeira" — from the content pack, never written here (D-017). */
  destination: string;
  /** "12–19 August 2026", already formatted by the caller. */
  dateRange: string;
  collected: number;
  total: number;
  /** The cleaned strokes, exactly as the map draws them (D-066). */
  strokes: readonly (readonly CardPoint[])[];
  /** Up to `MAX_NAMED_STAMPS` place names to list; the rest become a count. */
  stampNames: readonly string[];
};

/** What the renderers draw. Card coordinates, origin top-left. */
export type ShareCardElement =
  | { kind: 'text'; x: number; y: number; text: string; size: number; weight: 'regular' | 'bold'; colour: string; anchor: 'start' | 'middle' }
  | { kind: 'polyline'; points: readonly (readonly [number, number])[]; colour: string; width: number };

export type ShareCard = {
  width: number;
  height: number;
  background: string;
  elements: ShareCardElement[];
};

/**
 * 9:16, because that is the shape every place this gets shared to expects
 * (D-042 chose it for the video and the still has no reason to differ).
 */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

/** Keeps the trace clear of the text above and below it. */
const TRACE_TOP = 620;
const TRACE_BOTTOM = 1500;
const SIDE_MARGIN = 96;

/**
 * How many places the card names before the rest become "…and 14 more".
 *
 * ⚠ **The first version put them on one line and shrank it to fit, and the
 * preview tool caught what that does.** A single line holds about 45 characters
 * at a readable size; four Madeira place names — *Levada das 25 Fontes*, *Praia
 * do Porto do Seixal* — are eighty. Shrinking made the most personal line on the
 * card the smallest thing on it, at 20 px on a 1080 px image.
 *
 * So the names **wrap** instead, up to `MAX_STAMP_LINES`. Six fits comfortably
 * in three lines, and the count carries the rest.
 */
export const MAX_NAMED_STAMPS = 6;

/** More than this and the list crowds the trace above it. */
export const MAX_STAMP_LINES = 3;

/** The size the names are set at — chosen to be read, not to fit. */
export const STAMP_TEXT_SIZE = 32;

/**
 * The souvenir's palette.
 *
 * Dark, because D-026 gave the souvenir the night style, and because a trace in
 * `traceStyle`'s blue is what the map draws (D-056) — a souvenir in different
 * colours from the app would be a souvenir of a different app.
 */
const INK = '#F5F5F7';
const MUTED = '#9A9AA2';
const TRACE = '#4A8BEF';
const BACKGROUND = '#101014';

/** Rough width of a string, in card units. Used only to keep text inside. */
export function approximateTextWidth(text: string, size: number): number {
  // 0.58 em is a fair average for a sans-serif at these weights. It is an
  // estimate on purpose: the exact figure depends on the font the platform
  // resolves, and this only ever needs to answer "does this overflow".
  return text.length * size * 0.58;
}

/**
 * The names, packed into lines that fit — never a name split across two.
 *
 * A place name broken in half reads as a bug, so the wrapping unit is the whole
 * name. If even one name is too long for a line it gets that line to itself and
 * is allowed to be the exception.
 */
export function wrapStampNames(
  names: readonly string[],
  maxWidth: number,
  size: number = STAMP_TEXT_SIZE
): string[] {
  if (names.length === 0) {
    return [];
  }

  const shown = names.slice(0, MAX_NAMED_STAMPS);
  const rest = names.length - shown.length;
  const parts = rest > 0 ? [...shown, `and ${rest} more`] : [...shown];

  const lines: string[] = [];
  let current = '';

  for (const part of parts) {
    const candidate = current === '' ? part : `${current} · ${part}`;
    if (current !== '' && approximateTextWidth(candidate, size) > maxWidth) {
      lines.push(current);
      current = part;
      if (lines.length === MAX_STAMP_LINES) {
        break;
      }
    } else {
      current = candidate;
    }
  }

  if (current !== '' && lines.length < MAX_STAMP_LINES) {
    lines.push(current);
  }
  return lines;
}

/**
 * Fit the strokes into the card, keeping their shape.
 *
 * ⚠ **One scale for both axes.** Stretching the trace to fill the frame would
 * make a walk along a coast look like a walk into the sea — the shape *is* the
 * souvenir, and a distorted shape is a different walk.
 */
function fitStrokes(
  strokes: readonly (readonly CardPoint[])[]
): { points: readonly [number, number][] }[] {
  const all = strokes.flat();
  if (all.length === 0) {
    return [];
  }

  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lon, lat] of all) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }

  // Longitude is compressed at this latitude; using degrees directly would
  // squash the drawing east-to-west by about a sixth.
  const latitudeScale = Math.cos(((north + south) / 2) * (Math.PI / 180));
  const spanX = Math.max((east - west) * latitudeScale, 1e-9);
  const spanY = Math.max(north - south, 1e-9);

  const frameWidth = CARD_WIDTH - SIDE_MARGIN * 2;
  const frameHeight = TRACE_BOTTOM - TRACE_TOP;
  const scale = Math.min(frameWidth / spanX, frameHeight / spanY);

  // Centred in what is left over, so a north-south walk does not sit against
  // one edge.
  const offsetX = SIDE_MARGIN + (frameWidth - spanX * scale) / 2;
  const offsetY = TRACE_TOP + (frameHeight - spanY * scale) / 2;

  return strokes
    .filter((stroke) => stroke.length >= 2)
    .map((stroke) => ({
      points: stroke.map(([lon, lat]): [number, number] => [
        offsetX + (lon - west) * latitudeScale * scale,
        // Latitude grows north and the card grows down.
        offsetY + (north - lat) * scale,
      ]),
    }));
}

/** Build the card. Deterministic: the same trip always produces the same image. */
export function buildShareCard(input: ShareCardInput): ShareCard {
  const elements: ShareCardElement[] = [];

  elements.push({
    kind: 'text',
    x: SIDE_MARGIN,
    y: 220,
    text: input.destination,
    size: 96,
    weight: 'bold',
    colour: INK,
    anchor: 'start',
  });

  elements.push({
    kind: 'text',
    x: SIDE_MARGIN,
    y: 300,
    text: input.dateRange,
    size: 40,
    weight: 'regular',
    colour: MUTED,
    anchor: 'start',
  });

  // The hero, and the only number on the card (T-075, D-002).
  elements.push({
    kind: 'text',
    x: SIDE_MARGIN,
    y: 470,
    text: `${input.collected} / ${input.total}`,
    size: 150,
    weight: 'bold',
    colour: INK,
    anchor: 'start',
  });

  elements.push({
    kind: 'text',
    x: SIDE_MARGIN,
    y: 540,
    text: input.collected === 1 ? 'place collected' : 'places collected',
    size: 40,
    weight: 'regular',
    colour: MUTED,
    anchor: 'start',
  });

  for (const stroke of fitStrokes(input.strokes)) {
    elements.push({ kind: 'polyline', points: stroke.points, colour: TRACE, width: 8 });
  }

  // The places themselves, under the trace. Wrapped rather than shrunk, and
  // laid out upwards from a fixed baseline so one line and three lines both
  // sit the same distance above the app's name.
  const lines = wrapStampNames(input.stampNames, CARD_WIDTH - SIDE_MARGIN * 2);
  const lineHeight = Math.round(STAMP_TEXT_SIZE * 1.45);
  lines.forEach((line, index) => {
    elements.push({
      kind: 'text',
      x: CARD_WIDTH / 2,
      y: 1700 - (lines.length - 1 - index) * lineHeight,
      text: line,
      // `fitSize` remains as the last resort for a single name longer than the
      // card, which no Madeira place is but a content pack could contain.
      size: fitSize(line, STAMP_TEXT_SIZE, CARD_WIDTH - SIDE_MARGIN * 2),
      weight: 'regular',
      colour: MUTED,
      anchor: 'middle',
    });
  });

  // The only branding, and the only thing here that is not the user's (T-106).
  elements.push({
    kind: 'text',
    x: CARD_WIDTH / 2,
    y: 1810,
    text: 'Madeira Explorer',
    size: 32,
    weight: 'regular',
    colour: MUTED,
    anchor: 'middle',
  });

  return { width: CARD_WIDTH, height: CARD_HEIGHT, background: BACKGROUND, elements };
}

/** The largest size at or below `preferred` that keeps the text inside `maxWidth`. */
export function fitSize(text: string, preferred: number, maxWidth: number): number {
  const needed = approximateTextWidth(text, preferred);
  if (needed <= maxWidth) {
    return preferred;
  }
  // Never below 20: past that it is not readable on a phone screen, and a card
  // nobody can read is not worth shrinking further to fit.
  return Math.max(20, Math.floor((preferred * maxWidth) / needed));
}

/**
 * The card as SVG — what the app renders through `react-native-svg`, and what
 * the preview tool writes to a file.
 *
 * One renderer, two consumers: the picture the project lead judges is the
 * picture the app draws.
 */
export function renderShareCardSvg(card: ShareCard): string {
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${card.width}" height="${card.height}" viewBox="0 0 ${card.width} ${card.height}">`,
    `<rect width="${card.width}" height="${card.height}" fill="${card.background}"/>`,
  ];

  for (const element of card.elements) {
    if (element.kind === 'polyline') {
      const points = element.points
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(' ');
      parts.push(
        `<polyline points="${points}" fill="none" stroke="${element.colour}" ` +
          `stroke-width="${element.width}" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    } else {
      parts.push(
        `<text x="${element.x}" y="${element.y}" fill="${element.colour}" ` +
          `font-size="${element.size}" font-weight="${element.weight === 'bold' ? '700' : '400'}" ` +
          `font-family="system-ui, -apple-system, Roboto, sans-serif" ` +
          `text-anchor="${element.anchor}">${escapeXml(element.text)}</text>`
      );
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

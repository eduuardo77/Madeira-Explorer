/**
 * The pin that marks a place on the map (N12, the project lead's option 2,
 * 2026-10-25): gold, the colour of a stamp earned, in place of Google's red.
 *
 * Pure: the drawing as an SVG string, so `tools/build-place-pin.mjs` can
 * render it to the PNG the map shows (`placePinPng.ts`, generated) and the
 * preview tool can draw the same thing. `placePin.test.ts` fails when this
 * drawing changes and the PNG was not rebuilt.
 *
 * Its tip is at the bottom centre, which is where Google anchors a marker by
 * default, so the point of the pin sits on the place.
 */
import { reward } from '../ui/theme.ts';

/** The pin's size on screen, in dp. */
export const PIN_WIDTH_DP = 34;
export const PIN_HEIGHT_DP = 44;

/**
 * The PNG is drawn at 3 pixels per dp (Android's xxhdpi, 480 dpi), and the
 * native side scales it to the phone's own density.
 */
export const PIN_PNG_SCALE = 3;

export function placePinSvg(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH_DP}" height="${PIN_HEIGHT_DP}" viewBox="0 0 34 44">`,
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">',
    `<stop offset="0" stop-color="${reward.gold}"/><stop offset="1" stop-color="${reward.goldDeep}"/>`,
    '</linearGradient></defs>',
    // A teardrop with its point at (17, 43); a dark edge so it reads on the
    // light map and on the sea.
    `<path d="M17 43 C17 43 3 27 3 17 A14 14 0 0 1 31 17 C31 27 17 43 17 43 Z" fill="url(#g)" stroke="${reward.stage}" stroke-opacity="0.5" stroke-width="1.5"/>`,
    `<circle cx="17" cy="17" r="5.5" fill="${reward.stage}"/>`,
    '</svg>',
  ].join('');
}

/**
 * The faint pin for every place, once the map is zoomed in to a town (A6, the
 * lead's Q1 c, 31 Oct 2026; D-070 amended). Smaller than the gold one and
 * see-through, so the island view stays quiet and a town shows what is there
 * without the pins outshouting the lit roads. Dark at a third, with a white
 * edge: grey on the light map, outlined on the dark one.
 */
export const FAINT_PIN_WIDTH_DP = 24;
export const FAINT_PIN_HEIGHT_DP = 31;

export function faintPinSvg(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FAINT_PIN_WIDTH_DP}" height="${FAINT_PIN_HEIGHT_DP}" viewBox="0 0 34 44">`,
    `<path d="M17 43 C17 43 3 27 3 17 A14 14 0 0 1 31 17 C31 27 17 43 17 43 Z" fill="${reward.stage}" fill-opacity="0.35" stroke="${reward.badgeEdge}" stroke-opacity="0.9" stroke-width="2"/>`,
    `<circle cx="17" cy="17" r="5" fill="${reward.badgeEdge}" fill-opacity="0.9"/>`,
    '</svg>',
  ].join('');
}

/** A short fingerprint of the drawing, stored beside the PNG it was rendered from. */
export function placePinFingerprint(svg: string = placePinSvg()): string {
  // FNV-1a, 32 bits: enough to notice an edit, no crypto module needed.
  let hash = 0x811c9dc5;
  for (let i = 0; i < svg.length; i += 1) {
    hash ^= svg.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

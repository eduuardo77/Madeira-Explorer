/**
 * The Play feature graphic (1024 × 500): the lead's pick, B, the flag (T-269,
 * 2026-10-07: "I'll keep B"). Shared by `build-icon.mjs`, which writes the file
 * Play takes, and `preview-feature-graphic.mjs`, which drew the options, so the
 * banner that ships is the one picked.
 *
 * Built from the icon's own art (`icon-art.mjs`, A2). Nothing here is a
 * person's trace (D-016): the island is the regions' outline and the road the
 * icon's stylised route.
 */

import { islandPaths, MADEIRA, orderOfChristCross, PALETTE } from './icon-art.mjs';

export const W = 1024;
export const H = 500;

/** The island `width` units wide in the 108 canvas, placed by `transform`, with its lit road along `route`. */
export function islandWithRoad(rings, route, width, transform, { edge = null } = {}) {
  const island = islandPaths(rings, width, 54);
  const road = curve(route.map(([lon, lat]) => island.project(lon, lat)));
  const outline =
    edge === null
      ? ''
      : `<path d="${island.d}" fill="${PALETTE.island}" stroke="${edge}" stroke-width="4.4" stroke-linejoin="round"/>`;
  return {
    island,
    svg: `<g transform="${transform}">
      ${outline}
      <!-- 3.2 wide in the island's own colour, a little more than the icon: the regions do not
           quite meet, and a thinner edge showed the gaps as slivers. -->
      <path d="${island.d}" fill="${PALETTE.island}" stroke="${PALETTE.island}" stroke-width="3.2" stroke-linejoin="round"/>
      <path d="${road}" fill="none" stroke="${PALETTE.roadGlow}" stroke-opacity="0.35" stroke-width="4.5" stroke-linecap="round"/>
      <path d="${road}" fill="none" stroke="${PALETTE.road}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="${road}" fill="none" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="0.6" stroke-linecap="round"/>
    </g>`,
  };
}

/** The same smooth curve the icon draws its road with. */
function curve(points) {
  const [first, ...rest] = points;
  let d = `M${first[0]},${first[1]}`;
  rest.forEach(([x, y], i) => {
    const [px, py] = i === 0 ? first : rest[i - 1];
    d += ` Q${px + (x - px) / 2},${py} ${x},${y}`;
  });
  return d;
}

/**
 * B: the flag across the whole banner, as in the icon: the bands, the cross,
 * the island and its road. `blue` and `gold` default to the flag's own.
 */
export function flagBanner(rings, route, { blue = MADEIRA.flagBlue, gold = MADEIRA.flagGold } = {}) {
  const { svg } = islandWithRoad(rings, route, 100, 'translate(242 10) scale(5.2)', { edge: '#FFFFFF' });
  const third = W / 3;
  return `<rect width="${W}" height="${H}" fill="${blue}"/>
    <rect x="${third}" width="${third}" height="${H}" fill="${gold}"/>
    <g transform="translate(512 70) scale(3.2) translate(-54 -38)">${orderOfChristCross(54, 38, 18)}</g>
    ${svg}`;
}

/** The banner as a whole SVG document, ready to rasterise. */
export function featureGraphicSvg(rings, route) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${flagBanner(rings, route)}</svg>`;
}

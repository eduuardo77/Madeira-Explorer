/**
 * The launcher icon, as pure SVG (T-257, T-188, D-086).
 *
 * Three options drawn for the project lead from the app's own language: the
 * lit road (the product, D-093), the postage stamp (the passport, D-086) and a
 * postmark. Pure: geometry in, SVG strings out, so the preview page and the
 * final PNG export draw the same thing.
 *
 * Every icon is drawn on Android's adaptive-icon canvas: 108 x 108, of which
 * the launcher shows a mask of about the middle 72 and guarantees only the
 * middle 66 (the "safe zone"). Art that matters stays inside the safe zone.
 *
 * ⚠ The island's outline comes in as rings of [lon, lat] from
 * `content/regions.json`, read by the caller. Nothing about Madeira is written
 * here, and none of it is in `app/` (D-017).
 */

export const CANVAS = 108;
export const SAFE = 66;

export const PALETTE = {
  slate: '#1B2A33', // the adaptive icon background already in app.json
  // Edges drawn in the fill colour too: the municipalities that make the outline
  // must not show as borders inside it.
  island: '#2F6B4F',
  road: '#64B5F6', // the dark map's lit road, TRACE_PAINT.dark.coreColor
  roadGlow: '#64B5F6',
  paper: '#F4EAD5',
  ink: '#1F3A4A',
  gold: '#E2B23A',
};

/**
 * Project the island's rings into a box centred on the canvas, `width` wide.
 * Equirectangular with the longitude scaled by cos(latitude): at this size
 * nobody can tell it from Mercator, and it keeps the island's real proportions.
 */
export function islandPaths(rings, width, centreY = CANVAS / 2) {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const scale = width / ((east - west) * k);
  const height = (north - south) * scale;
  const x0 = (CANVAS - width) / 2;
  const y0 = centreY - height / 2;
  const project = ([lon, lat]) => [x0 + (lon - west) * k * scale, y0 + (north - lat) * scale];
  const d = rings
    .map((ring) => {
      // Every fourth point: plenty at 108 units, and a tenth of the file.
      const points = ring.filter((_, i) => i % 4 === 0).map(project);
      return `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z`;
    })
    .join('');
  return { d, height, project: (lon, lat) => project([lon, lat]) };
}

/** A road across the island, as a smooth curve through points in canvas units. */
function roadPath(points) {
  const [first, ...rest] = points;
  let d = `M${first[0]},${first[1]}`;
  for (let i = 0; i < rest.length; i += 1) {
    const [x, y] = rest[i];
    const [px, py] = i === 0 ? first : rest[i - 1];
    d += ` Q${px + (x - px) / 2},${py} ${x},${y}`;
  }
  return d;
}

/**
 * A: the island on slate, a lit road across it.
 *
 * `route` is [lon, lat] points, passed in by the caller like the rings, and
 * projected with the island so the road lies on it rather than beside it.
 * 60 wide: at 70 the island ran past the circular mask at both ends.
 */
export function optionLitRoad(rings, route) {
  const island = islandPaths(rings, 60, 56);
  const road = roadPath(route.map(([lon, lat]) => island.project(lon, lat)));
  return {
    background: `<rect width="${CANVAS}" height="${CANVAS}" fill="${PALETTE.slate}"/>`,
    foreground: `
      <path d="${island.d}" fill="${PALETTE.island}" stroke="${PALETTE.island}" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="${road}" fill="none" stroke="${PALETTE.roadGlow}" stroke-opacity="0.35" stroke-width="7" stroke-linecap="round"/>
      <path d="${road}" fill="none" stroke="${PALETTE.road}" stroke-width="3" stroke-linecap="round"/>
      <path d="${road}" fill="none" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="1" stroke-linecap="round"/>`,
    monochrome: `
      <path d="${island.d}" fill="#FFFFFF" fill-opacity="0.45"/>
      <path d="${road}" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>`,
  };
}

/** The perforated edge of a postage stamp, as a path, w x h centred. */
function perforatedRect(cx, cy, w, h, bite = 2.2, step = 6) {
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const edge = (from, to, along) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const n = Math.max(1, Math.round(length / step));
    const ux = (to[0] - from[0]) / length;
    const uy = (to[1] - from[1]) / length;
    let d = '';
    for (let i = 0; i < n; i += 1) {
      const a = (i + 0.5) * (length / n);
      const sx = from[0] + ux * (a - bite);
      const sy = from[1] + uy * (a - bite);
      const ex = from[0] + ux * (a + bite);
      const ey = from[1] + uy * (a + bite);
      d += ` L${sx.toFixed(2)},${sy.toFixed(2)} A${bite},${bite} 0 0 ${along} ${ex.toFixed(2)},${ey.toFixed(2)}`;
    }
    return `${d} L${to[0]},${to[1]}`;
  };
  const tl = [x0, y0];
  const tr = [x0 + w, y0];
  const br = [x0 + w, y0 + h];
  const bl = [x0, y0 + h];
  return `M${tl[0]},${tl[1]}${edge(tl, tr, 0)}${edge(tr, br, 0)}${edge(br, bl, 0)}${edge(bl, tl, 0)}Z`;
}

/** B: a postage stamp, tilted as the passport tilts them, the island and its road inked on it. */
export function optionStamp(rings, route) {
  const island = islandPaths(rings, 46, 52);
  const road = roadPath(route.map(([lon, lat]) => island.project(lon, lat)));
  return {
    background: `<rect width="${CANVAS}" height="${CANVAS}" fill="${PALETTE.slate}"/>`,
    foreground: `
      <g transform="rotate(-6 54 54)">
        <path d="${perforatedRect(54, 54, 58, 62)}" fill="${PALETTE.paper}"/>
        <rect x="29" y="27" width="50" height="54" fill="none" stroke="${PALETTE.ink}" stroke-width="1"/>
        <path d="${island.d}" fill="${PALETTE.island}"/>
        <path d="${road}" fill="none" stroke="${PALETTE.road}" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="29" y="71" width="50" height="10" fill="${PALETTE.ink}"/>
        <text x="54" y="78.6" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="7" letter-spacing="1.2" fill="${PALETTE.paper}">BRUMA</text>
      </g>`,
    monochrome: `
      <g transform="rotate(-6 54 54)">
        <path d="${perforatedRect(54, 54, 58, 62)}" fill="#FFFFFF"/>
        <path d="${island.d}" fill="#000000" fill-opacity="0.6"/>
      </g>`,
  };
}

/** C: a postmark, a bold B and the road through it. */
export function optionPostmark() {
  const road = roadPath([
    [26, 70],
    [42, 66],
    [58, 70],
    [74, 64],
    [84, 60],
  ]);
  return {
    background: `<rect width="${CANVAS}" height="${CANVAS}" fill="${PALETTE.slate}"/>`,
    foreground: `
      <circle cx="54" cy="54" r="30" fill="none" stroke="${PALETTE.gold}" stroke-width="2.4"/>
      <circle cx="54" cy="54" r="25.5" fill="none" stroke="${PALETTE.gold}" stroke-width="1" stroke-dasharray="2 2.2"/>
      <text x="54" y="64" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="30" fill="${PALETTE.paper}">B</text>
      <path d="${road}" fill="none" stroke="${PALETTE.roadGlow}" stroke-opacity="0.35" stroke-width="6" stroke-linecap="round"/>
      <path d="${road}" fill="none" stroke="${PALETTE.road}" stroke-width="2.6" stroke-linecap="round"/>`,
    monochrome: `
      <circle cx="54" cy="54" r="30" fill="none" stroke="#FFFFFF" stroke-width="3"/>
      <text x="54" y="64" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="30" fill="#FFFFFF">B</text>`,
  };
}

/**
 * One icon as the launcher shows it: background and foreground in a 108 canvas,
 * clipped to `mask` ('circle' or 'squircle'), at `size` pixels.
 */
export function iconSvg(option, size, mask = 'circle', id = 'i') {
  const clip =
    mask === 'circle'
      ? `<circle cx="54" cy="54" r="36"/>`
      : `<rect x="18" y="18" width="72" height="72" rx="20"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="18 18 72 72">
    <defs><clipPath id="${id}">${clip}</clipPath></defs>
    <g clip-path="url(#${id})">${option.background}${option.foreground}</g></svg>`;
}

/** The themed (Android 13+) version: one colour on the wallpaper's tint. */
export function monochromeSvg(option, size, id = 'm') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="18 18 72 72">
    <defs><clipPath id="${id}"><circle cx="54" cy="54" r="36"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect width="108" height="108" fill="#3C4A3F"/>
    <g style="color:#DDE8D5" fill="currentColor">${option.monochrome}</g></g></svg>`;
}

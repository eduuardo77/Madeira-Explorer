/**
 * The launcher icon, as pure SVG (T-257, T-188, D-086).
 *
 * Drawn for the project lead in rounds: the lit road (the product, D-093) and
 * the postage stamp (the passport, D-086); then Madeira's own cues, the flag
 * and the Santana house. Kept here are the two the lead is choosing between,
 * A2 and B2, and A for comparison; the rest were dropped along the way. Pure: geometry in, SVG strings out, so the preview page and the
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

export const PALETTE = {
  slate: '#1B2A33', // the adaptive icon background already in app.json
  // Edges drawn in the fill colour too: the municipalities that make the outline
  // must not show as borders inside it.
  island: '#2F6B4F',
  road: '#64B5F6', // the dark map's lit road, TRACE_PAINT.dark.coreColor
  roadGlow: '#64B5F6',
  paper: '#F4EAD5',
  ink: '#1F3A4A',
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

/**
 * Madeira's own cues, asked for by the project lead (2026-10-07): the flag's
 * colours and the Santana house. Approximate colours, chosen to read at icon
 * size, not a heraldic specification.
 */
export const MADEIRA = {
  flagBlue: '#0A4FA3',
  flagGold: '#F7C21B',
  thatch: '#7A5A2E',
  thatchLight: '#A07A44',
  wall: '#F4F1EA',
  trimRed: '#C8262E',
  trimBlue: '#1F5AA6',
};

/** The flag's three bands, blue, gold, blue, across the whole canvas. */
function flagBands() {
  return `<rect width="${CANVAS}" height="${CANVAS}" fill="${MADEIRA.flagBlue}"/>
    <rect x="${CANVAS / 3}" width="${CANVAS / 3}" height="${CANVAS}" fill="${MADEIRA.flagGold}"/>`;
}

/**
 * A Santana house: a thatched A-frame down to the ground, a white gable with red
 * and blue trim, a red door in a blue frame, a small blue window. `cx` is its
 * centre, `base` its foot, `h` its height.
 *
 * Round three (2026-10-07): the thatch is drawn as layers running down each
 * slope, as thatch lies; round two's horizontal lines read as stripes.
 */
export function santanaHouse(cx, base, h) {
  const w = h * 1.1;
  const apex = base - h;
  const roof = `M${cx - w / 2},${base} L${cx},${apex} L${cx + w / 2},${base} Z`;
  const layers = [0.3, 0.5, 0.7, 0.9]
    .map((t) => {
      // A short stroke along each slope, part-way down it.
      const y = apex + h * t;
      const half = (w / 2) * t;
      const len = h * 0.16;
      const dx = (w / 2 / h) * len;
      return `<path d="M${cx - half + dx},${y - len} L${cx - half},${y} M${cx + half - dx},${y - len} L${cx + half},${y}" stroke="${MADEIRA.thatchLight}" stroke-width="${h * 0.05}" stroke-linecap="round"/>`;
    })
    .join('');
  const gw = w * 0.6;
  const gTop = apex + h * 0.32;
  const gable = `M${cx - gw / 2},${base} L${cx},${gTop} L${cx + gw / 2},${base} Z`;
  const inset = h * 0.06;
  const trim = `M${cx - gw / 2 + inset * 1.6},${base} L${cx},${gTop + inset * 2} L${cx + gw / 2 - inset * 1.6},${base}`;
  const dw = h * 0.2;
  const dh = h * 0.3;
  const win = h * 0.11;
  return `<path d="${roof}" fill="${MADEIRA.thatch}"/>${layers}
    <path d="${gable}" fill="${MADEIRA.wall}" stroke="${MADEIRA.trimRed}" stroke-width="${h * 0.06}" stroke-linejoin="round"/>
    <path d="${trim}" fill="none" stroke="${MADEIRA.trimBlue}" stroke-width="${h * 0.03}"/>
    <rect x="${cx - dw / 2}" y="${base - dh}" width="${dw}" height="${dh}" fill="${MADEIRA.trimRed}" stroke="${MADEIRA.trimBlue}" stroke-width="${h * 0.035}"/>
    <rect x="${cx - win / 2}" y="${base - dh - win * 1.8}" width="${win}" height="${win}" fill="${MADEIRA.trimBlue}"/>`;
}

/**
 * The Cross of the Order of Christ, the flag's emblem: a red cross with flared
 * arms and a white cross inside it. Without it, blue, gold and blue is just
 * some flag.
 */
export function orderOfChristCross(cx, cy, size) {
  const arm = size / 2;
  const inner = size * 0.14;
  const outer = size * 0.42;
  const arms = [0, 90, 180, 270]
    .map(
      (angle) =>
        `<path transform="rotate(${angle} ${cx} ${cy})" d="M${cx - inner / 2},${cy} L${cx - outer / 2},${cy - arm} L${cx + outer / 2},${cy - arm} L${cx + inner / 2},${cy} Z"/>`
    )
    .join('');
  const reach = arm * 0.78;
  return `<g fill="${MADEIRA.trimRed}">${arms}</g>
    <path d="M${cx},${cy - reach} L${cx},${cy + reach} M${cx - reach},${cy} L${cx + reach},${cy}" stroke="#FFFFFF" stroke-width="${size * 0.07}"/>`;
}

/**
 * A2: the island and its lit road over the flag: the bands, and the cross above
 * the island. Round three: the island green again with a white edge (dark
 * slate lost what made A attractive), and the road given a white glow so it
 * holds over the blue bands, where a blue glow vanished.
 */
export function optionFlag(rings, route) {
  const island = islandPaths(rings, 58, 66);
  const road = roadPath(route.map(([lon, lat]) => island.project(lon, lat)));
  return {
    background: flagBands(),
    foreground: `
      ${orderOfChristCross(54, 38, 18)}
      <path d="${island.d}" fill="${PALETTE.island}" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="${island.d}" fill="${PALETTE.island}"/>
      <path d="${road}" fill="none" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="5" stroke-linecap="round"/>
      <path d="${road}" fill="none" stroke="${PALETTE.road}" stroke-width="2.6" stroke-linecap="round"/>`,
    monochrome: optionLitRoad(rings, route).monochrome,
  };
}

/**
 * B2: the passport's stamp, a Santana house on it with the lit road to its
 * door, the flag's colours for its band. Round three: the road added (the
 * app's heart was missing), a smaller tilt and stamp so its corners clear the
 * circular mask, and a steadier perforation.
 */
export function optionStampHouse() {
  const stamp = perforatedRect(54, 54, 54, 58, 2.4, 6.5);
  const road = 'M31,69 Q40,68 46,65 T54,62';
  const band = (x, fill) => `<rect x="${x}" y="70" width="${48 / 3}" height="8" fill="${fill}"/>`;
  return {
    background: `<rect width="${CANVAS}" height="${CANVAS}" fill="${PALETTE.slate}"/>`,
    foreground: `
      <g transform="rotate(-4 54 54)">
        <path d="${stamp}" fill="${PALETTE.paper}"/>
        <rect x="30" y="28" width="48" height="50" fill="none" stroke="${PALETTE.ink}" stroke-width="0.9"/>
        <path d="${road}" fill="none" stroke="${PALETTE.road}" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round"/>
        <path d="${road}" fill="none" stroke="${PALETTE.road}" stroke-width="2.2" stroke-linecap="round"/>
        ${santanaHouse(54, 62, 28)}
        ${band(30, MADEIRA.flagBlue)}${band(30 + 48 / 3, MADEIRA.flagGold)}${band(30 + (2 * 48) / 3, MADEIRA.flagBlue)}
      </g>`,
    monochrome: `
      <g transform="rotate(-4 54 54)">
        <path d="${stamp}" fill="#FFFFFF"/>
        <path d="M38.6,62 L54,34 L69.4,62 Z" fill="#000000" fill-opacity="0.6"/>
      </g>`,
  };
}

/**
 * The launcher icon, as pure SVG (T-257, T-188, D-086).
 *
 * Drawn for the project lead in rounds: the lit road (the product, D-093) and
 * the postage stamp (the passport, D-086); then Madeira's own cues, the flag
 * and the Santana house. Kept here is what the lead is choosing between: A2
 * (the island and lit road on the flag) and leaner versions of it; A, the
 * first, supplies their monochrome. The rest were dropped along the way. Pure: geometry in, SVG strings out, so the preview page and the
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
 * colours and its cross. (A Santana house was drawn too, for the stamp
 * options, and dropped with them.) Approximate colours, chosen to read at icon
 * size, not a heraldic specification.
 */
export const MADEIRA = {
  flagBlue: '#0A4FA3',
  flagGold: '#F7C21B',
  trimRed: '#C8262E',
};

/** The flag's three bands, blue, gold, blue, across the whole canvas. */
function flagBands() {
  return `<rect width="${CANVAS}" height="${CANVAS}" fill="${MADEIRA.flagBlue}"/>
    <rect x="${CANVAS / 3}" width="${CANVAS / 3}" height="${CANVAS}" fill="${MADEIRA.flagGold}"/>`;
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
 * Round four (2026-10-07): the lead "really likes A2, but it has a lot of
 * information". Three leaner versions keep the flag's colours, the island and
 * the lit road, and drop the rest.
 */

/** A2a: the island itself in the flag's bands, on slate, with the lit road. */
export function optionIslandInFlag(rings, route) {
  const width = 60;
  const island = islandPaths(rings, width, 56);
  // The bands across the island's own width, a third each: across the whole
  // canvas the island showed almost only the gold one.
  const x0 = (CANVAS - width) / 2;
  const band = (i, fill) =>
    `<rect x="${x0 + (i * width) / 3}" width="${width / 3}" height="${CANVAS}" fill="${fill}"/>`;
  const road = roadPath(route.map(([lon, lat]) => island.project(lon, lat)));
  return {
    background: `<rect width="${CANVAS}" height="${CANVAS}" fill="${PALETTE.slate}"/>`,
    foreground: `
      <defs><clipPath id="island-a2a"><path d="${island.d}"/></clipPath></defs>
      <g clip-path="url(#island-a2a)">${band(0, MADEIRA.flagBlue)}${band(1, MADEIRA.flagGold)}${band(2, MADEIRA.flagBlue)}</g>
      <path d="${road}" fill="none" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="5" stroke-linecap="round"/>
      <path d="${road}" fill="none" stroke="${PALETTE.road}" stroke-width="2.6" stroke-linecap="round"/>`,
    monochrome: optionLitRoad(rings, route).monochrome,
  };
}

/** A2b: A2 without the cross and the white edge: the bands, the island, the road. */
export function optionFlagPlain(rings, route) {
  const island = islandPaths(rings, 60, 56);
  const road = roadPath(route.map(([lon, lat]) => island.project(lon, lat)));
  return {
    background: flagBands(),
    foreground: `
      <path d="${island.d}" fill="${PALETTE.island}" stroke="${PALETTE.island}" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="${road}" fill="none" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="5" stroke-linecap="round"/>
      <path d="${road}" fill="none" stroke="${PALETTE.road}" stroke-width="2.6" stroke-linecap="round"/>`,
    monochrome: optionLitRoad(rings, route).monochrome,
  };
}

/** A2c: two of the flag's colours: a gold island on its blue, and the lit road. */
export function optionGoldOnBlue(rings, route) {
  const island = islandPaths(rings, 60, 56);
  const road = roadPath(route.map(([lon, lat]) => island.project(lon, lat)));
  return {
    background: `<rect width="${CANVAS}" height="${CANVAS}" fill="${MADEIRA.flagBlue}"/>`,
    foreground: `
      <path d="${island.d}" fill="${MADEIRA.flagGold}" stroke="${MADEIRA.flagGold}" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="${road}" fill="none" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="5" stroke-linecap="round"/>
      <path d="${road}" fill="none" stroke="${PALETTE.road}" stroke-width="2.6" stroke-linecap="round"/>`,
    monochrome: optionLitRoad(rings, route).monochrome,
  };
}

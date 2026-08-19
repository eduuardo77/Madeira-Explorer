/**
 * Four directions for the rank medal, to choose between (T-158, D-078).
 *
 *     node tools/preview-rank.mjs
 *     → tools/out/rank.html
 *
 * ⚠⚠ **THIS IS A SKETCH PASS AND NOTHING HERE IS SHIPPING CODE.** The project
 * lead looked at the first attempt — five flat pills changing colour — and said
 * it *"não passa um feeling de premium ou de raridade"*, which was right, and
 * then asked for **visual reference before choosing a direction**. So four
 * directions are drawn here rather than argued about in prose. **Only the one
 * that gets chosen becomes a pure module in `app/`**; building production
 * architecture for three designs that will be thrown away is how a sketch pass
 * becomes a fortnight.
 *
 * WHY THE FLAT PILLS FAILED, WHICH IS THE WHOLE BRIEF
 * --------------------------------------------------
 * They changed **hue** and nothing else. What makes metal read as metal is not
 * its colour, it is **how it handles light**:
 *
 *   - **bronze**   — a broad, soft, warm highlight. Low contrast, almost matte.
 *   - **silver**   — a tight, cool highlight. High contrast between face and rim.
 *   - **gold**     — broad *and* saturated: the light itself stays yellow.
 *   - **platinum** — nearly a mirror. The highlight is a hard sliver, and cold.
 *
 * So every medal here gets a **radial face gradient**, a **rim lit from the
 * opposite side** (which is what reads as a bevel), and a **specular sweep**
 * whose tightness is a property of the metal.
 *
 * ⚠ **No SVG filters anywhere.** `feGaussianBlur` and friends are the obvious
 * way to fake depth and they are unreliable in `react-native-svg` on Android.
 * Everything here is gradients and paths, so what is judged in this page is
 * something the app can actually draw.
 *
 * ⚠ **The number is engraved, not printed** — the project lead's option 2. Done
 * the old way: the same text three times, dark below, light above, body colour
 * on top. No filter, and it reads as cut into the metal rather than sitting on
 * it.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.removeAllListeners('warning');

const { CANVAS } = await import('../app/src/passport/stampArt.ts');
const { stampMarkPath, TILT_DEG } = await import('../app/src/passport/stampMark.ts');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ colour */

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((c) => clamp(c).toString(16).padStart(2, '0')).join('');

/** Positive lightens towards white, negative darkens towards black. */
const shade = (hex, amount) => {
  const rgb = parse(hex);
  return toHex(rgb.map((c) => (amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
};

/**
 * The metals, as light behaviour rather than as colours.
 *
 * `spec` is how *tight* the specular highlight is — 0.9 is a hard sliver
 * (platinum), 0.35 is a broad soft sheen (bronze). `warm` shifts the highlight
 * towards the body's own hue instead of white, which is what stops gold's
 * highlight looking like a grey smear.
 *
 * ⚠ These are sketch values. If a direction is chosen they get promoted into
 * `stampTier.ts` beside `TIER_METAL`, with the contrast tests that already
 * guard it.
 */
const METALS = {
  none: { base: '#5AA9FF', spec: 0.25, warm: 0.0, label: 'no stamps yet' },
  bronze: { base: '#B4763C', spec: 0.35, warm: 0.55, label: '1+' },
  silver: { base: '#B9BEC6', spec: 0.7, warm: 0.1, label: '10+' },
  gold: { base: '#D6A833', spec: 0.55, warm: 0.6, label: '25+' },
  platinum: { base: '#CBD9E6', spec: 0.9, warm: 0.05, label: 'all of them' },
};

const TIERS = Object.keys(METALS);

/* ------------------------------------------------------------------ shared */

/**
 * The gradients one medal needs.
 *
 * ⚠ The rim is lit from the **opposite** side to the face. That single
 * opposition is most of what makes a flat circle read as a raised disc — a rim
 * lit the same way as the face just looks like a thicker outline.
 */
function defs(id, metal) {
  const { base, spec, warm } = metal;
  const light = shade(base, 0.42);
  const dark = shade(base, -0.42);
  const deep = shade(base, -0.62);
  // A warm metal keeps its hue in the highlight; a cold one goes towards white.
  const hot = warm > 0.3 ? shade(base, 0.72) : shade(base, 0.88);

  return `
    <radialGradient id="face-${id}" cx="33%" cy="26%" r="82%">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="0.52" stop-color="${base}"/>
      <stop offset="1" stop-color="${dark}"/>
    </radialGradient>
    <linearGradient id="rim-${id}" x1="0" y1="1" x2="0.35" y2="0">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="0.45" stop-color="${deep}"/>
      <stop offset="1" stop-color="${light}"/>
    </linearGradient>
    <linearGradient id="spec-${id}" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="${hot}" stop-opacity="${(0.15 + spec * 0.75).toFixed(2)}"/>
      <stop offset="${(0.10 + spec * 0.22).toFixed(2)}" stop-color="${hot}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="enamel-${id}" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="${shade(base, -0.30)}"/>
      <stop offset="1" stop-color="${shade(base, -0.68)}"/>
    </linearGradient>`;
}

/**
 * Text cut into metal.
 *
 * The oldest trick there is and still the right one here: the same glyphs three
 * times — a dark copy pushed down, a light copy pushed up, then the body colour
 * over both. No filter, and it survives being drawn at 24 px.
 */
function engraved(text, x, y, size, metal, weight = 700) {
  const dark = shade(metal.base, -0.55);
  const light = shade(metal.base, 0.55);
  const body = shade(metal.base, -0.14);
  const common = `x="${x}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="0.5"`;
  return `
    <text ${common} y="${y + 1.1}" fill="${dark}" opacity="0.85">${text}</text>
    <text ${common} y="${y - 0.7}" fill="${light}" opacity="0.55">${text}</text>
    <text ${common} y="${y}" fill="${body}">${text}</text>`;
}

/** The app's own mark, debossed into the face. Same path the button draws now. */
function debossedMark(cx, cy, size, metal) {
  const dark = shade(metal.base, -0.55);
  const light = shade(metal.base, 0.5);
  const body = shade(metal.base, -0.18);
  const scale = size / CANVAS;
  const at = (dx, dy, fill, opacity) => `
    <g transform="translate(${cx - size / 2 + dx} ${cy - size / 2 + dy}) scale(${scale})">
      <path d="${stampMarkPath()}" fill="${fill}" fill-opacity="${opacity}" fill-rule="evenodd"
            transform="rotate(${TILT_DEG} ${CANVAS / 2} ${CANVAS / 2})"/>
    </g>`;
  return at(0, 1.2, dark, 0.9) + at(0, -0.8, light, 0.5) + at(0, 0, body, 1);
}

/* -------------------------------------------------------------- directions */

const SIZE = 132;
const C = SIZE / 2;

/** A — the challenge coin. Circular, thick rim, everything concentric. */
function medallion(id, tier) {
  const metal = METALS[tier];
  return `
  <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
    <defs>${defs(id, metal)}</defs>
    <circle cx="${C}" cy="${C}" r="${C - 2}" fill="url(#rim-${id})"/>
    <circle cx="${C}" cy="${C}" r="${C - 11}" fill="url(#face-${id})"/>
    <circle cx="${C}" cy="${C}" r="${C - 11}" fill="none" stroke="${shade(metal.base, -0.5)}" stroke-width="1" stroke-opacity="0.55"/>
    ${debossedMark(C, C - 12, 46, metal)}
    ${engraved('23 / 60', C, C + 34, 17, metal)}
    <circle cx="${C}" cy="${C}" r="${C - 2}" fill="url(#spec-${id})"/>
  </svg>`;
}

/**
 * B — the wax seal. An irregular edge, a deep well, a matte face.
 *
 * The one that borrows from *travel* rather than from games: this app is a
 * passport, and a seal is the same family of object as a stamp.
 */
function waxSeal(id, tier) {
  const metal = METALS[tier];
  // A wobbly circle: eight arcs with alternating radii, so the edge reads as
  // poured rather than cut.
  const blob = (r1, r2) => {
    const pts = [];
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 === 0 ? r1 : r2;
      pts.push([C + Math.cos(a) * r, C + Math.sin(a) * r]);
    }
    return (
      `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} ` +
      pts
        .map((p, i) => {
          const n = pts[(i + 1) % pts.length];
          return `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + n[0]) / 2).toFixed(1)} ${((p[1] + n[1]) / 2).toFixed(1)}`;
        })
        .join(' ') +
      'Z'
    );
  };

  return `
  <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
    <defs>${defs(id, metal)}</defs>
    <path d="${blob(C - 2, C - 9)}" fill="url(#rim-${id})"/>
    <path d="${blob(C - 12, C - 17)}" fill="url(#face-${id})"/>
    ${debossedMark(C, C - 10, 50, metal)}
    ${engraved('23 / 60', C, C + 32, 16, metal)}
    <path d="${blob(C - 2, C - 9)}" fill="url(#spec-${id})"/>
  </svg>`;
}

/**
 * C — the enamel pin. A metal outline holding coloured enamel.
 *
 * The CS2 shape the project lead named. The specular lives **only on the metal
 * edge**; the enamel inside is flat and deep, which is exactly how real enamel
 * behaves and why these read as objects rather than as icons.
 */
function enamelPin(id, tier) {
  const metal = METALS[tier];
  const scale = (SIZE - 12) / CANVAS;
  const markAt = (grow, fill, extra = '') => `
    <g transform="translate(${SIZE / 2} ${SIZE / 2}) scale(${scale * grow}) translate(${-CANVAS / 2} ${-CANVAS / 2})">
      <path d="${stampMarkPath()}" fill="${fill}" fill-rule="evenodd" ${extra}
            transform="rotate(${TILT_DEG} ${CANVAS / 2} ${CANVAS / 2})"/>
    </g>`;

  return `
  <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
    <defs>${defs(id, metal)}</defs>
    ${markAt(1.0, `url(#rim-${id})`)}
    ${markAt(0.86, `url(#enamel-${id})`)}
    ${markAt(0.86, 'none', `stroke="${shade(metal.base, 0.5)}" stroke-width="2" stroke-opacity="0.35"`)}
    ${engraved('23 / 60', C, C + 6, 19, { ...metal, base: shade(metal.base, 0.35) })}
    ${markAt(1.0, `url(#spec-${id})`)}
  </svg>`;
}

/** D — the trophy plate. A shield with a raised border. The PlayStation register. */
function trophyPlate(id, tier) {
  const metal = METALS[tier];
  const shield = (inset) =>
    `M${20 + inset} ${8 + inset} L${SIZE - 20 - inset} ${8 + inset} ` +
    `L${SIZE - 20 - inset} ${SIZE * 0.55} Q${SIZE - 20 - inset} ${SIZE - 14 - inset} ${C} ${SIZE - 6 - inset} ` +
    `Q${20 + inset} ${SIZE - 14 - inset} ${20 + inset} ${SIZE * 0.55} Z`;

  return `
  <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
    <defs>${defs(id, metal)}</defs>
    <path d="${shield(0)}" fill="url(#rim-${id})"/>
    <path d="${shield(7)}" fill="url(#face-${id})"/>
    ${debossedMark(C, C - 14, 44, metal)}
    ${engraved('23 / 60', C, C + 30, 16, metal)}
    <path d="${shield(0)}" fill="url(#spec-${id})"/>
  </svg>`;
}

const DIRECTIONS = [
  ['A', 'Medallion — the challenge coin', 'Concentric, military, unmistakably an *achievement*. The most familiar shape and the least specific to this product.', medallion],
  ['B', 'Wax seal — the travel object', 'Borrows from **travel** rather than from games. This app is a passport and a seal is the same family of object as a stamp. ⚠ My recommendation, and the one nobody named.', waxSeal],
  ['C', 'Enamel pin — the CS2 shape', 'Metal outline, enamel inside, specular **only on the metal edge**. Uses the app’s own mark as the whole silhouette rather than putting it inside something else.', enamelPin],
  ['D', 'Trophy plate — the PlayStation register', 'A shield. The most explicitly *game*, and the closest to the reference the project lead actually named.', trophyPlate],
];

/* ------------------------------------------------------------------- page */

const rows = DIRECTIONS.map(
  ([letter, title, note, draw]) => `
<h2>${letter} — ${title}</h2>
<p class="note">${note}</p>
<div class="row">
  ${TIERS.map(
    (tier) => `
  <figure>
    ${draw(`${letter}-${tier}`, tier)}
    <figcaption>${tier}<br><span>${METALS[tier].label}</span></figcaption>
  </figure>`
  ).join('')}
</div>`
).join('\n');

const html = `<!doctype html>
<meta charset="utf-8">
<title>Rank medal — four directions</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 28px; background: #0E0E10; color: #E8EEF2;
         font: 15px/1.6 -apple-system, Segoe UI, Roboto, sans-serif; }
  h1 { font-size: 24px; margin: 0 0 6px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 1.2px;
       color: #A0A0A8; margin: 40px 0 2px; }
  p.note { color: #A0A0A8; max-width: 74ch; margin: 0 0 14px; }
  p.lede { max-width: 74ch; }
  .row { display: flex; flex-wrap: wrap; gap: 22px; align-items: flex-start;
         background: #1C1C1E; border-radius: 16px; padding: 22px; }
  figure { margin: 0; text-align: center; }
  figcaption { font-size: 12px; color: #E8EEF2; margin-top: 8px; }
  figcaption span { color: #A0A0A8; font-size: 11px; }
  .light .row { background: #EFEFF2; }
  .light figcaption { color: #1C1C1E; }
  .light figcaption span { color: #6E6E73; }
  b { color: #E8EEF2; }
  code { color: #5AA9FF; }
</style>

<h1>The rank medal — four directions</h1>
<p class="lede">
  The first attempt was five flat pills changing hue, and it read as a control
  rather than as a trophy. <b>What makes metal look like metal is not its colour,
  it is how it handles light</b> — bronze has a broad soft highlight, silver a
  tight cool one, gold a broad <i>saturated</i> one, platinum almost a mirror.
  Every medal below has a face gradient, a rim lit from the opposite side (that
  opposition is what reads as a bevel), and a specular sweep whose tightness is a
  property of the metal.
</p>
<p class="note">
  ⚠ <b>No SVG filters anywhere.</b> <code>feGaussianBlur</code> is the obvious way
  to fake depth and it is unreliable in <code>react-native-svg</code> on Android —
  so everything here is gradients and paths, and what you are judging is something
  the app can actually draw.
  <br>
  ⚠ <b>The number is engraved, not printed</b> — the same glyphs three times, dark
  below, light above, body colour over both.
  <br>
  ⚠ <b>Sketches, not shipping code.</b> Only the direction you choose becomes a
  pure module in <code>app/</code>.
</p>

${rows}

<h2>All four again, on a light ground</h2>
<p class="note">
  ⚠ <b>The map is the one surface whose brightness the user chooses (D-026)</b>, and
  this button floats on it. A medal that only works on the dark ground is a medal
  that half the users never see properly — which is exactly how the settings
  control vanished when the dark map arrived.
</p>
<div class="light">
${DIRECTIONS.map(
  ([letter, , , draw]) => `
<div class="row">
  ${TIERS.map((tier) => `<figure>${draw(`L-${letter}-${tier}`, tier)}<figcaption>${letter} · ${tier}</figcaption></figure>`).join('')}
</div>`
).join('\n')}
</div>
`;

const outDir = path.join(root, 'tools', 'out');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'rank.html'), html);

console.log(`${DIRECTIONS.length} directions × ${TIERS.length} ranks, on two grounds`);
console.log('Wrote tools/out/rank.html');

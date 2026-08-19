/**
 * The wax seal, developed (T-158, D-078).
 *
 *     node tools/preview-rank.mjs
 *     → tools/out/rank.html
 *
 * ⚠⚠ **STILL A SKETCH PASS.** Only what survives this becomes a pure module in
 * `app/`. The previous version of this file drew four directions to choose
 * between; the project lead chose **B, the wax seal** — *"até gosto do Wax Seal,
 * fiquei surpreendido"* — and then asked for more: *"quero algo mais gráfico e
 * detalhado. Por exemplo a Platina mais brilhante e mais exclusiva."*
 *
 * WHAT "MORE GRAPHIC" MEANT, CONCRETELY
 * -------------------------------------
 * The first seal was a wobbly blob with a gradient. What it lacked was
 * **vocabulary** — the things that make an object look *made* rather than
 * generated:
 *
 *   - a **cast shadow**, so it sits above the map instead of on it;
 *   - the **squeeze** at the rim, where wax pushes outward under the die;
 *   - a **beaded ring**, which real seal dies have;
 *   - **rays** behind the mark;
 *   - a **rim highlight arc** on the lit side only, which is most of what makes
 *     a thing look polished rather than coloured;
 *   - a **deboss with a lit lip**, so the mark is pressed *in* rather than
 *     printed on.
 *
 * ⚠ **The vocabulary is borrowed from the stamps themselves.** Perforation dots
 * and a sunburst are already `stampArt.ts`'s own devices. The medal is the same
 * family of object as the thing it counts, rather than a trophy imported from
 * somewhere else.
 *
 * HOW EXCLUSIVITY IS SIGNALLED — AND IT IS NOT BRIGHTNESS
 * ------------------------------------------------------
 * *"A platina mais brilhante e mais exclusiva."* Brightness alone would just be
 * a paler seal. Two things carry it instead:
 *
 *   1. **The ornament accumulates.** Nothing → beading → beading and rays →
 *      rays and laurel → **faceted rim, double ring, full rays**. You can tell
 *      the ranks apart with the colour removed, which is the real test.
 *   2. ⚠ **The material changes at platinum.** Bronze, silver and gold are wax —
 *      soft edge, broad sheen. Platinum is **not wax**: the edge is crisp, the
 *      highlight is a hard cold sliver, and the rim is cut into facets. It
 *      stops being the same substance, which is a stronger rarity signal than
 *      any amount of shine.
 *
 * ⚠ **No SVG filters.** `feGaussianBlur` is unreliable in `react-native-svg` on
 * Android, so the shadow, the sheen and the deboss are all gradients and offset
 * paths. What is judged here is what the app can draw.
 *
 * ⚠ **Drawn at three sizes on purpose.** The study size flatters everything;
 * the button is ~64 dp and D-015's floor is 60. **Detail that dies at 44 dp is
 * detail that was never there.**
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
const shade = (hex, amount) => {
  const rgb = parse(hex);
  return toHex(rgb.map((c) => (amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
};

/**
 * The ranks, as material and ornament rather than as colours.
 *
 * `spec` is how tight the specular is. `ornament` is what the die carries, and
 * it is what lets the ranks be told apart in greyscale. `wax` false means the
 * substance itself changed — see the header.
 */
const RANKS = {
  none: { base: '#5AA9FF', spec: 0.22, warm: 0.0, ornament: 0, wax: true, label: 'no stamps yet' },
  bronze: { base: '#A86B34', spec: 0.34, warm: 0.6, ornament: 1, wax: true, label: '1+' },
  silver: { base: '#AEB4BD', spec: 0.66, warm: 0.1, ornament: 2, wax: true, label: '10+' },
  gold: { base: '#CE9C22', spec: 0.58, warm: 0.65, ornament: 3, wax: true, label: '25+' },
  platinum: { base: '#D3E2F0', spec: 0.94, warm: 0.0, ornament: 4, wax: false, label: 'all of them' },
};

const TIERS = Object.keys(RANKS);

/* -------------------------------------------------------------------- bits */

/** The seal's outline. Crisp for platinum, poured for wax. */
function sealPath(cx, cy, r, wobble, wax) {
  const points = [];
  const steps = wax ? 18 : 24;
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const rr = wax ? r - (i % 2 === 0 ? 0 : wobble) : r - (i % 2 === 0 ? 0 : wobble * 0.25);
    points.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const p = (n) => `${n[0].toFixed(2)} ${n[1].toFixed(2)}`;
  // Quadratic through midpoints: soft for wax, near-polygonal for the hard one.
  return (
    `M${p(points[0])} ` +
    points
      .map((pt, i) => {
        const next = points[(i + 1) % points.length];
        const mid = [(pt[0] + next[0]) / 2, (pt[1] + next[1]) / 2];
        return `Q${p(pt)} ${p(mid)}`;
      })
      .join(' ') +
    'Z'
  );
}

/** Dots around a circle — the stamps' own perforation, borrowed. */
function beading(cx, cy, r, count, fill, size) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    out += `<circle cx="${(cx + Math.cos(a) * r).toFixed(2)}" cy="${(cy + Math.sin(a) * r).toFixed(2)}" r="${size}" fill="${fill}"/>`;
  }
  return out;
}

/** Rays from the centre. `stampArt.ts` draws a sunburst too; same family. */
function rays(cx, cy, inner, outer, count, fill, opacity) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const w = Math.PI / count / 2.6;
    const p = (rad, ang) => `${(cx + Math.cos(ang) * rad).toFixed(2)} ${(cy + Math.sin(ang) * rad).toFixed(2)}`;
    out += `<path d="M${p(inner, a)} L${p(outer, a - w)} L${p(outer, a + w)} Z" fill="${fill}" fill-opacity="${opacity}"/>`;
  }
  return out;
}

/** Cut facets around the rim. Platinum only — this is what stops it being wax. */
function facets(cx, cy, rOuter, rInner, count, light, dark) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const a0 = (i / count) * Math.PI * 2;
    const a1 = ((i + 1) / count) * Math.PI * 2;
    const p = (rad, ang) => `${(cx + Math.cos(ang) * rad).toFixed(2)} ${(cy + Math.sin(ang) * rad).toFixed(2)}`;
    // Alternating, and lit from the top-left so the wedges read as cut rather
    // than as stripes.
    const lit = Math.cos(a0 - Math.PI * 1.25) > 0;
    out += `<path d="M${p(rOuter, a0)} L${p(rOuter, a1)} L${p(rInner, a1)} L${p(rInner, a0)} Z" fill="${i % 2 === 0 ? (lit ? light : dark) : lit ? dark : light}" fill-opacity="${lit ? 0.55 : 0.4}"/>`;
  }
  return out;
}

/** Text cut into the surface: dark below, light above, body over both. */
function engraved(text, x, y, size, base, weight = 700) {
  const common = `x="${x}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="0.4"`;
  return `
    <text ${common} y="${(y + size * 0.07).toFixed(2)}" fill="${shade(base, -0.6)}" opacity="0.9">${text}</text>
    <text ${common} y="${(y - size * 0.05).toFixed(2)}" fill="${shade(base, 0.6)}" opacity="0.5">${text}</text>
    <text ${common} y="${y}" fill="${shade(base, -0.16)}">${text}</text>`;
}

/** The app's mark, pressed in: shadow below, lit lip above, body over both. */
function deboss(cx, cy, size, base) {
  const scale = size / CANVAS;
  const lift = Math.max(0.6, size * 0.028);
  const at = (dy, fill, opacity) => `
    <g transform="translate(${(cx - size / 2).toFixed(2)} ${(cy - size / 2 + dy).toFixed(2)}) scale(${scale.toFixed(4)})">
      <path d="${stampMarkPath()}" fill="${fill}" fill-opacity="${opacity}" fill-rule="evenodd"
            transform="rotate(${TILT_DEG} ${CANVAS / 2} ${CANVAS / 2})"/>
    </g>`;
  return at(lift, shade(base, -0.6), 0.92) + at(-lift * 0.7, shade(base, 0.55), 0.5) + at(0, shade(base, -0.2), 1);
}

/* ------------------------------------------------------------------- medal */

function seal(id, tier, size, withNumber = true) {
  const rank = RANKS[tier];
  const { base, spec, warm, ornament, wax } = rank;
  const c = size / 2;
  const r = size / 2 - size * 0.055;

  const light = shade(base, 0.44);
  const dark = shade(base, -0.44);
  const deep = shade(base, -0.66);
  const hot = warm > 0.3 ? shade(base, 0.74) : shade(base, 0.94);

  const k = size / 132; // everything below was drawn at 132 and scales from it

  return `
  <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <defs>
      <radialGradient id="face-${id}" cx="34%" cy="27%" r="80%">
        <stop offset="0" stop-color="${light}"/>
        <stop offset="0.5" stop-color="${base}"/>
        <stop offset="1" stop-color="${dark}"/>
      </radialGradient>
      <linearGradient id="rim-${id}" x1="0.1" y1="1" x2="0.4" y2="0">
        <stop offset="0" stop-color="${light}"/>
        <stop offset="0.42" stop-color="${deep}"/>
        <stop offset="1" stop-color="${shade(base, 0.62)}"/>
      </linearGradient>
      <linearGradient id="spec-${id}" x1="0.05" y1="0" x2="0.75" y2="1">
        <stop offset="0" stop-color="${hot}" stop-opacity="${(0.12 + spec * 0.8).toFixed(2)}"/>
        <stop offset="${(0.08 + spec * 0.2).toFixed(2)}" stop-color="${hot}" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="well-${id}" cx="50%" cy="42%" r="62%">
        <stop offset="0" stop-color="${shade(base, -0.22)}"/>
        <stop offset="1" stop-color="${shade(base, -0.02)}"/>
      </radialGradient>
    </defs>

    <!-- Cast shadow: an offset copy, not a filter. It is what lifts the medal
         off the map rather than letting it sit flat on it. -->
    <path d="${sealPath(c, c + 2.4 * k, r, 5 * k, wax)}" fill="#000000" fill-opacity="0.34"/>

    <!-- The rim, then the squeezed face inside it. -->
    <path d="${sealPath(c, c, r, 5 * k, wax)}" fill="url(#rim-${id})"/>
    <path d="${sealPath(c, c, r - 5.5 * k, 3.4 * k, wax)}" fill="url(#face-${id})"/>

    ${ornament >= 4 ? facets(c, c, r - 1.2 * k, r - 6 * k, 28, shade(base, 0.75), deep) : ''}

    <!-- The pressed well the die left. -->
    <circle cx="${c}" cy="${c}" r="${r - 12 * k}" fill="url(#well-${id})"/>
    <circle cx="${c}" cy="${c}" r="${r - 12 * k}" fill="none" stroke="${deep}" stroke-opacity="0.5" stroke-width="${1 * k}"/>

    ${ornament >= 2 ? rays(c, c - 3 * k, 7 * k, r - 15 * k, ornament >= 3 ? 24 : 16, shade(base, 0.6), ornament >= 4 ? 0.3 : 0.16) : ''}
    ${ornament >= 1 ? beading(c, c, r - 9 * k, ornament >= 3 ? 32 : 22, shade(base, ornament >= 4 ? 0.85 : 0.5), 1.15 * k) : ''}
    ${ornament >= 4 ? `<circle cx="${c}" cy="${c}" r="${r - 15.5 * k}" fill="none" stroke="${shade(base, 0.85)}" stroke-opacity="0.7" stroke-width="${1.1 * k}"/>` : ''}

    ${deboss(c, c - (withNumber ? 9 * k : 0), 46 * k, base)}
    ${withNumber ? engraved('23 / 60', c, c + 30 * k, 15 * k, base) : ''}

    <!-- Specular last, over everything, and a lit arc on the top-left rim only:
         that arc is most of what reads as *polished* rather than as coloured. -->
    <path d="${sealPath(c, c, r, 5 * k, wax)}" fill="url(#spec-${id})"/>
    <path d="M${(c - r * 0.72).toFixed(2)} ${(c - r * 0.5).toFixed(2)} A ${r * 0.9} ${r * 0.9} 0 0 1 ${(c + r * 0.1).toFixed(2)} ${(c - r * 0.86).toFixed(2)}"
          fill="none" stroke="${hot}" stroke-opacity="${(0.25 + spec * 0.55).toFixed(2)}" stroke-width="${(1.6 + spec * 2.2) * k}" stroke-linecap="round"/>
  </svg>`;
}

/* ------------------------------------------------------------------- page */

const STUDY = 132;
const BUTTON = 64;
const FLOOR = 44;

const row = (size, withNumber, prefix) =>
  TIERS.map(
    (tier) => `
  <figure>
    ${seal(`${prefix}-${tier}`, tier, size, withNumber)}
    <figcaption>${tier}<br><span>${RANKS[tier].label}</span></figcaption>
  </figure>`
  ).join('');

const html = `<!doctype html>
<meta charset="utf-8">
<title>The rank seal</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 28px; background: #0E0E10; color: #E8EEF2;
         font: 15px/1.6 -apple-system, Segoe UI, Roboto, sans-serif; }
  h1 { font-size: 24px; margin: 0 0 6px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 1.2px;
       color: #A0A0A8; margin: 40px 0 2px; }
  p { max-width: 76ch; }
  p.note { color: #A0A0A8; margin: 0 0 14px; }
  .row { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-end;
         background: #1C1C1E; border-radius: 16px; padding: 24px; }
  .light .row { background: #E9EDF1; }
  .light figcaption { color: #1C1C1E; }
  .light figcaption span { color: #6E6E73; }
  .map .row { background: #A8C8A0; }
  .map figcaption { color: #14210F; }
  .map figcaption span { color: #3C4A36; }
  figure { margin: 0; text-align: center; }
  figcaption { font-size: 12px; margin-top: 10px; }
  figcaption span { color: #A0A0A8; font-size: 11px; }
  b { color: #E8EEF2; }
  code { color: #5AA9FF; }
  .grey .row { filter: grayscale(1); }
</style>

<h1>The rank seal</h1>
<p>
  The wax seal, developed. It borrows its vocabulary from the stamps it counts —
  <b>perforation beading</b> and a <b>sunburst</b> are already
  <code>stampArt.ts</code>'s own devices — so the medal is the same family of
  object as the thing it is a medal for, rather than a trophy imported from
  somewhere else.
</p>
<p class="note">
  ⚠ <b>Exclusivity is not brightness.</b> A brighter seal is just a paler seal.
  Two things carry it instead: the <b>ornament accumulates</b> (nothing → beading
  → rays → laurel → faceted rim and double ring), and <b>the material changes at
  platinum</b> — bronze, silver and gold are wax, with a poured edge and a broad
  sheen; platinum is not. Its edge is crisp, its highlight is a hard cold sliver
  and its rim is cut into facets. It stops being the same substance.
  <br><br>
  ⚠ <b>No SVG filters.</b> The cast shadow is an offset copy, the deboss is three
  passes, the sheen is a gradient — because <code>feGaussianBlur</code> is
  unreliable in <code>react-native-svg</code> on Android and this has to be
  drawable by the app.
</p>

<h2>Study size — ${STUDY} px</h2>
<div class="row">${row(STUDY, true, 'S')}</div>

<h2>The real button — ${BUTTON} dp</h2>
<p class="note">
  ⚠ This is the size that matters. The study size flatters everything.
</p>
<div class="row">${row(BUTTON, true, 'B')}</div>

<h2>D-015's floor — ${FLOOR} dp, and without the number</h2>
<p class="note">
  ⚠ <b>Detail that dies here is detail that was never there.</b> Also shown without
  the engraved count, in case the number should live beside the seal rather than
  inside it.
</p>
<div class="row">${row(FLOOR, false, 'F')}</div>

<h2>On a light map</h2>
<p class="note">
  ⚠ The map is the one surface whose brightness the user chooses (D-026) and this
  button floats on it. A medal that only works on a dark ground is one half the
  users never see properly.
</p>
<div class="light"><div class="row">${row(BUTTON, true, 'L')}</div></div>

<h2>On green — the ground it will actually sit on</h2>
<p class="note">
  Most of this island is laurel forest and terraces. A gold seal on a green map is
  the real test, not a seal on a neutral panel.
</p>
<div class="map"><div class="row">${row(BUTTON, true, 'M')}</div></div>

<h2>Greyscale — the ranks with the colour taken away</h2>
<p class="note">
  ⚠ <b>The real test of whether ornament is doing the work.</b> If the ranks are
  only distinguishable by hue, then colour-blind users have one rank and everybody
  else has five.
</p>
<div class="grey"><div class="row">${row(STUDY, true, 'G')}</div></div>
`;

const outDir = path.join(root, 'tools', 'out');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'rank.html'), html);

console.log(`the wax seal at ${STUDY}/${BUTTON}/${FLOOR} px, on four grounds, plus greyscale`);
console.log('Wrote tools/out/rank.html');

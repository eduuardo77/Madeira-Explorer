/**
 * The rank seal — density without the casino (T-158, D-078).
 *
 *     node tools/preview-rank.mjs
 *     → tools/out/rank.html
 *
 * ⚠⚠ **STILL A SKETCH PASS.** Only what survives becomes a pure module in `app/`.
 *
 * THE FEEDBACK THAT REFRAMED THIS
 * -------------------------------
 * The project lead, after the five sparse vocabularies: *"prefiro a maquete que
 * parece uma ficha de poker. Não por parecer uma ficha de poker mas por parecer
 * mais exclusiva e detalhada. E por ter um feeling mais premium do que esta nova
 * maquete."*
 *
 * ⚠ **That is the most useful note in this whole thread, because it separates two
 * things I had collapsed into one.** I removed the chip's *density* along with
 * the chip's *grammar*, and only the grammar was the problem.
 *
 *   - **What made it feel premium:** many small repeated elements, concentric
 *     layering, radiance, cut facets. Richness.
 *   - **What made it a casino chip:** two specific devices — **evenly spaced
 *     dots at the rim**, and **uniform spokes crossing the whole face**.
 *
 * So this pass keeps the density and changes the rhythm. Repetition that is
 * *irregular* or *closed* stops reading as a token however dense it gets:
 *
 *   - the rim carries **guilloché or a lettered ring** — dense, and impossible to
 *     mistake for chip spots;
 *   - the **starburst is confined to the well behind the mark** and its rays
 *     **alternate long and short**, which is a sun, not a spoke pattern;
 *   - the cord is a **twisted rope**, overlapping, not discrete dots;
 *   - platinum gains **more** facets rather than fewer, because that was working.
 *
 * ⚠ **No SVG filters** — `feGaussianBlur` is unreliable in `react-native-svg` on
 * Android. Shadow is an offset copy, deboss is three passes, sheen is a gradient.
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

/**
 * A twisted cord around the rim.
 *
 * ⚠⚠ **This replaced evenly spaced dots, which were half of what made the last
 * one a casino chip.** The elements are tangential ovals that **overlap**, so
 * the eye reads one continuous rope rather than a ring of discrete spots. Same
 * density — and density is what the project lead wanted kept — with none of the
 * grammar that spelled *token*.
 */
function beading(cx, cy, r, count, fill, size) {
  const dark = shade(fill, -0.45);
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const deg = (a * 180) / Math.PI + 34;
    out += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${(size * 2.4).toFixed(2)}" ry="${size.toFixed(2)}" transform="rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${i % 2 ? fill : dark}" fill-opacity="0.85"/>`;
  }
  return out;
}

/**
 * A starburst behind the mark.
 *
 * ⚠⚠ **This replaced uniform spokes crossing the whole face** — the other half
 * of the casino chip. Two changes kill that reading while keeping the radiance:
 * the rays **alternate long and short**, which is a sun rather than a spoke
 * pattern, and they are **confined to the well** behind the mark instead of
 * running out to the rim.
 */
function rays(cx, cy, inner, outer, count, fill, opacity) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const w = Math.PI / count / 2.4;
    const reach = inner + (outer - inner) * (i % 2 === 0 ? 1 : 0.58);
    const p = (rad, ang) => `${(cx + Math.cos(ang) * rad).toFixed(2)} ${(cy + Math.sin(ang) * rad).toFixed(2)}`;
    out += `<path d="M${p(inner * 0.35, a)} L${p(reach, a - w)} L${p(reach, a + w)} Z" fill="${fill}" fill-opacity="${(opacity * (i % 2 === 0 ? 1 : 0.7)).toFixed(2)}"/>`;
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


/** A point on a circle, given the angle as a multiple of PI. */
const arcPt = (cx, cy, r, turns) =>
  `${(cx + Math.cos(Math.PI * turns) * r).toFixed(2)} ${(cy + Math.sin(Math.PI * turns) * r).toFixed(2)}`;

/**
 * The mark, pressed harder.
 *
 * ⚠ The same three passes as `deboss`, with the offsets scaled by how
 * reflective the metal is: a mirror shows a sharper lip than a matte surface,
 * which is the difference between a mark *cut into* platinum and one *stamped
 * into* bronze. Material, not ornament.
 */
function debossDeep(cx, cy, size, base, spec) {
  const scale = size / CANVAS;
  const lift = Math.max(0.8, size * (0.03 + spec * 0.018));
  const at = (dy, fill, opacity) => `
    <g transform="translate(${(cx - size / 2).toFixed(2)} ${(cy - size / 2 + dy).toFixed(2)}) scale(${scale.toFixed(4)})">
      <path d="${stampMarkPath()}" fill="${fill}" fill-opacity="${opacity}" fill-rule="evenodd"
            transform="rotate(${TILT_DEG} ${CANVAS / 2} ${CANVAS / 2})"/>
    </g>`;
  return (
    at(lift, shade(base, -0.7), 0.95) +
    at(-lift * 0.75, shade(base, 0.62), 0.55) +
    at(0, shade(base, -0.24), 1)
  );
}

/* ------------------------------------------------------------------- medal */

/**
 * The edition the project lead chose, kept verbatim so the refinement can be
 * judged against it side by side rather than described in prose.
 *
 * WHY ROUND 5 WAS A REGRESSION, AND IT IS WORTH BEING PRECISE
 * ----------------------------------------------------------
 * That pass mixed two different things: better **lighting** (a contact shadow,
 * a bounce arc, a per-rank falloff) and more **ornament** (stepped bevels, a
 * raised dome, a halo, sparkles).
 *
 * ⚠ **The ornament was the downgrade.** It read as loud rather than as
 * expensive — a medal wearing everything it owns at once. The lighting was
 * never the problem, and throwing it out with the ornament would be the same
 * mistake in the other direction.
 *
 * So the refinement below takes the lighting and the material, and adds
 * **no new shape at all**.
 */
function sealPrev(id, tier, size, withNumber = true) {
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


/**
 * The same seal, lit properly.
 *
 * ⚠⚠ **NOTHING HERE IS A NEW ORNAMENT.** Every change is light or material:
 *
 *   - **an occlusion ring where the well meets the face** — pressed metal is
 *     darkest exactly at that junction, and without it the well is a flat
 *     circle sitting on a gradient rather than a hollow;
 *   - **a machined lip** at the rim-to-face junction, one hairline, which is
 *     what a turned edge actually leaves behind;
 *   - **two shadows** rather than one — a wide drop and a tight contact,
 *     because that pair is what makes an object rest on something instead of
 *     hovering over it;
 *   - **a bounce arc** on the side away from the key light, since a real object
 *     picks up light reflected off whatever it sits on;
 *   - ⚠ **a per-rank falloff.** Platinum's face turns from light to dark almost
 *     immediately, the way a mirror does; bronze's turns slowly, the way a
 *     matte surface does. **That one number says which metal it is more
 *     convincingly than the hue does**, and it costs nothing.
 *   - **a deeper press** for the mark, scaled by the same reflectivity.
 */
function seal(id, tier, size, withNumber = true) {
  const rank = RANKS[tier];
  const { base, spec, warm, ornament, wax } = rank;
  const c = size / 2;
  const r = size / 2 - size * 0.055;
  const k = size / 132;

  const light = shade(base, 0.46);
  const dark = shade(base, -0.46);
  const deep = shade(base, -0.68);
  const hot = warm > 0.3 ? shade(base, 0.76) : shade(base, 0.95);

  // A mirror turns over fast; a matte surface turns over slowly.
  const turn = (0.62 - spec * 0.34).toFixed(2);

  return `
  <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <defs>
      <radialGradient id="rface-${id}" cx="33%" cy="25%" r="80%">
        <stop offset="0" stop-color="${shade(base, 0.5 + spec * 0.25)}"/>
        <stop offset="${turn}" stop-color="${base}"/>
        <stop offset="1" stop-color="${dark}"/>
      </radialGradient>
      <linearGradient id="rrim-${id}" x1="0.1" y1="1" x2="0.4" y2="0">
        <stop offset="0" stop-color="${light}"/>
        <stop offset="0.42" stop-color="${deep}"/>
        <stop offset="1" stop-color="${shade(base, 0.64)}"/>
      </linearGradient>
      <linearGradient id="rspec-${id}" x1="0.05" y1="0" x2="0.75" y2="1">
        <stop offset="0" stop-color="${hot}" stop-opacity="${(0.12 + spec * 0.82).toFixed(2)}"/>
        <stop offset="${(0.08 + spec * 0.2).toFixed(2)}" stop-color="${hot}" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="rwell-${id}" cx="50%" cy="40%" r="64%">
        <stop offset="0" stop-color="${shade(base, -0.04)}"/>
        <stop offset="0.72" stop-color="${shade(base, -0.2)}"/>
        <stop offset="1" stop-color="${shade(base, -0.52)}"/>
      </radialGradient>
    </defs>

    <path d="${sealPath(c, c + 4.2 * k, r * 1.008, 5 * k, wax)}" fill="#000" fill-opacity="0.18"/>
    <path d="${sealPath(c, c + 1.6 * k, r, 5 * k, wax)}" fill="#000" fill-opacity="0.42"/>

    <path d="${sealPath(c, c, r, 5 * k, wax)}" fill="url(#rrim-${id})"/>
    <path d="${sealPath(c, c, r - 5.5 * k, 3.4 * k, wax)}" fill="url(#rface-${id})"/>
    <path d="${sealPath(c, c, r - 5.5 * k, 3.4 * k, wax)}" fill="none" stroke="${shade(base, 0.7)}" stroke-opacity="0.35" stroke-width="${(0.7 * k).toFixed(2)}"/>

    ${ornament >= 4 ? facets(c, c, r - 1.2 * k, r - 6 * k, 28, shade(base, 0.75), deep) : ''}

    <circle cx="${c}" cy="${c}" r="${(r - 12 * k).toFixed(2)}" fill="url(#rwell-${id})"/>
    <circle cx="${c}" cy="${c}" r="${(r - 12.4 * k).toFixed(2)}" fill="none" stroke="${deep}" stroke-opacity="0.55" stroke-width="${(1.8 * k).toFixed(2)}"/>
    <circle cx="${c}" cy="${c}" r="${(r - 11.2 * k).toFixed(2)}" fill="none" stroke="${shade(base, 0.6)}" stroke-opacity="0.3" stroke-width="${(0.7 * k).toFixed(2)}"/>

    ${ornament >= 2 ? rays(c, c - 3 * k, 7 * k, r - 15 * k, ornament >= 3 ? 24 : 16, shade(base, 0.6), ornament >= 4 ? 0.3 : 0.16) : ''}
    ${ornament >= 1 ? beading(c, c, r - 9 * k, ornament >= 3 ? 32 : 22, shade(base, ornament >= 4 ? 0.85 : 0.5), 1.15 * k) : ''}
    ${ornament >= 4 ? `<circle cx="${c}" cy="${c}" r="${(r - 15.5 * k).toFixed(2)}" fill="none" stroke="${shade(base, 0.85)}" stroke-opacity="0.7" stroke-width="${(1.1 * k).toFixed(2)}"/>` : ''}

    ${debossDeep(c, c - (withNumber ? 9 * k : 0), 46 * k, base, spec)}
    ${withNumber ? engraved('23 / 60', c, c + 30 * k, 15 * k, base) : ''}

    <path d="${sealPath(c, c, r, 5 * k, wax)}" fill="url(#rspec-${id})"/>

    <path d="M${arcPt(c, c, r * 0.94, 0.2)} A ${(r * 0.94).toFixed(2)} ${(r * 0.94).toFixed(2)} 0 0 1 ${arcPt(c, c, r * 0.94, 0.6)}"
      fill="none" stroke="${shade(base, 0.5)}" stroke-opacity="${(0.16 + spec * 0.34).toFixed(2)}" stroke-width="${((1 + spec * 1.2) * k).toFixed(2)}" stroke-linecap="round"/>
    <path d="M${arcPt(c, c, r * 0.94, 1.18)} A ${(r * 0.94).toFixed(2)} ${(r * 0.94).toFixed(2)} 0 0 1 ${arcPt(c, c, r * 0.94, 1.62)}"
      fill="none" stroke="${hot}" stroke-opacity="${(0.26 + spec * 0.58).toFixed(2)}" stroke-width="${((1.7 + spec * 2.3) * k).toFixed(2)}" stroke-linecap="round"/>
  </svg>`;
}

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

<h2>Side by side — what changed</h2>
<p class="note">
  ⚠ <b>Top row is the edition you chose, untouched. Bottom row is the refinement.</b>
  Judging a change against a description is how round 5 slipped through; judging it
  against the thing it replaced is harder to fool.
  <br><br>
  Nothing was added. Every difference is <b>light or material</b>: an occlusion ring
  where the well meets the face, a machined lip at the rim, a second tighter shadow
  for contact, a bounce arc on the unlit side, a deeper press for the mark — and a
  <b>per-rank falloff</b>, so platinum's face turns over like a mirror and bronze's
  like something matte. <b>Same hues throughout.</b>
</p>
<div class="row">${TIERS.map((t) => `<figure>${sealPrev(`P-${t}`, t, STUDY)}<figcaption>${t}<br><span>chosen edition</span></figcaption></figure>`).join('')}</div>
<div class="row">${TIERS.map((t) => `<figure>${seal(`R-${t}`, t, STUDY)}<figcaption>${t}<br><span>refined</span></figcaption></figure>`).join('')}</div>

<h2>Side by side at the real button — 64 dp</h2>
<p class="note">⚠ The size that decides. Chosen edition above, refined below.</p>
<div class="row">${TIERS.map((t) => `<figure>${sealPrev(`PB-${t}`, t, BUTTON)}<figcaption>${t}</figcaption></figure>`).join('')}</div>
<div class="row">${TIERS.map((t) => `<figure>${seal(`RB-${t}`, t, BUTTON)}<figcaption>${t}</figcaption></figure>`).join('')}</div>

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

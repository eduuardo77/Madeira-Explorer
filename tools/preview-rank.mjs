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


/* ----------------------------------------------------- rings and centres */

/*
 * ⚠⚠ **ONE VARIABLE AT A TIME.** The body, the lighting and the material below
 * are exactly the refined seal — untouched. Only the **ring** or only the
 * **centre** changes in each row, because a study that moves two things at once
 * cannot tell you which one you liked. Round 5 moved five at once and had to be
 * thrown away whole.
 *
 * ⚠ Every ring here avoids the two devices that made a casino chip: **evenly
 * spaced discrete dots** and **uniform spokes**. Repetition that overlaps, or
 * that closes into a ring, does not read as a token however dense it gets.
 */

/** Chain links — interlocking ovals. Denser than cord, and unmistakably made. */
function ringChain(cx, cy, r, count, base, k) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const deg = (a * 180) / Math.PI + (i % 2 ? 90 : 0);
    out += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${(3.1 * k).toFixed(2)}" ry="${(1.9 * k).toFixed(2)}" transform="rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="none" stroke="${shade(base, i % 2 ? 0.6 : -0.45)}" stroke-opacity="0.85" stroke-width="${(1.1 * k).toFixed(2)}"/>`;
  }
  return out;
}

/** Engine-turned waves. Closed rings, so it can never read as spokes. */
function ringGuilloche(cx, cy, rMin, rMax, rings, lobes, base, k) {
  let out = '';
  for (let j = 0; j < rings; j += 1) {
    const mid = rMin + ((rMax - rMin) * j) / Math.max(1, rings - 1);
    const amp = (rMax - rMin) * 0.2;
    let d = '';
    for (let i = 0; i <= 120; i += 1) {
      const a = (i / 120) * Math.PI * 2;
      const rr = mid + Math.sin(a * lobes + j * 0.8) * amp;
      d += `${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)} `;
    }
    out += `<path d="${d}Z" fill="none" stroke="${shade(base, j % 2 ? 0.62 : -0.5)}" stroke-opacity="0.42" stroke-width="${(0.8 * k).toFixed(2)}"/>`;
  }
  return out;
}

/** A laurel wreath, closing at the top. */
function ringWreath(cx, cy, r, leaves, base, k) {
  let out = '';
  for (const side of [-1, 1]) {
    for (let i = 0; i < leaves; i += 1) {
      const t = 0.08 + (i / Math.max(1, leaves - 1)) * 0.72;
      const a = Math.PI / 2 + side * t * Math.PI;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const deg = (a * 180) / Math.PI + side * 58;
      const len = r * 0.15 * (1 - i * 0.04);
      out += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${len.toFixed(2)}" ry="${(len * 0.38).toFixed(2)}" transform="rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${shade(base, i % 2 ? 0.58 : 0.3)}" fill-opacity="0.82"/>`;
    }
  }
  return out;
}

/**
 * A milled edge — the fine vertical cuts on the rim of a real coin.
 *
 * ⚠ The one option here closest to the rejected chip, and it is included
 * deliberately so the difference can be *seen* rather than argued. Reeding sits
 * **on the outer edge**, is far finer, and is cut *across* the rim rather than
 * placed as spots on the face. If it still reads as a token, that settles it.
 */
function ringMilled(cx, cy, rOuter, rInner, count, base, k) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const p = (rad) => `${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`;
    out += `<path d="M${p(rOuter)} L${p(rInner)}" stroke="${shade(base, i % 2 ? 0.55 : -0.5)}" stroke-opacity="0.6" stroke-width="${(0.9 * k).toFixed(2)}"/>`;
  }
  return out;
}

/** Two hairlines with a plain channel between them. The quietest option. */
function ringHairline(cx, cy, r, base, k) {
  return `<circle cx="${cx}" cy="${cy}" r="${(r + 2.2 * k).toFixed(2)}" fill="none" stroke="${shade(base, 0.66)}" stroke-opacity="0.55" stroke-width="${(0.9 * k).toFixed(2)}"/>
    <circle cx="${cx}" cy="${cy}" r="${(r - 2.2 * k).toFixed(2)}" fill="none" stroke="${shade(base, -0.55)}" stroke-opacity="0.55" stroke-width="${(0.9 * k).toFixed(2)}"/>`;
}


/* ------------------------------------------------- centres, second pass */

/*
 * ⚠⚠ **THE FIRST SIX WERE ONE DRAWING WITH SIX SURFACE TREATMENTS.**
 * Pressed in, standing proud, cut through, on a cartouche, with a keyline —
 * every one of them was the app's mark with the light moved around. The project
 * lead asked for *different* centres, and they were right that those were not.
 * These are different **things to put there**.
 *
 * ⚠⚠ **THE OBVIOUS ONE IS FORBIDDEN AND IT IS WORTH SAYING SO.** The island's
 * silhouette is what a Madeira app would put in the middle of its medal. **D-017
 * is absolute: no Madeira knowledge in `app/`.** A coastline is island knowledge
 * of the purest kind, and it would have to live in `content/` and be handed in —
 * which for a *rank* medal, shown before you have collected anything, makes no
 * sense. So it is out by rule, not by taste.
 *
 * Everything below is generic: it would be as correct for the Azores.
 */

/** A raised plate to sit a device on, so it is not floating in the well. */
function plate(cx, cy, r, base, k) {
  return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${shade(base, -0.1)}"/>
    <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="${shade(base, 0.55)}" stroke-opacity="0.45" stroke-width="${(0.9 * k).toFixed(2)}"/>`;
}

/** Three passes: shadow below, lit lip above, body over both. */
function pressed(inner, cx, cy, base, spec, size) {
  const lift = Math.max(0.7, size * (0.028 + spec * 0.016));
  return (
    `<g transform="translate(0 ${lift.toFixed(2)})" fill="${shade(base, -0.68)}" fill-opacity="0.9">${inner}</g>` +
    `<g transform="translate(0 ${(-lift * 0.75).toFixed(2)})" fill="${shade(base, 0.62)}" fill-opacity="0.55">${inner}</g>` +
    `<g fill="${shade(base, -0.26)}">${inner}</g>`
  );
}

/**
 * A compass rose. Navigation, and generic to every sea on earth.
 *
 * ⚠ Four long points and four short, which is what a rose is; four equal points
 * would be a cross and eight equal ones would be the spoke pattern this whole
 * thread has been avoiding.
 */
function centreCompass(cx, cy, size, base, spec) {
  const R = size * 0.5;
  const pt = (r, a) => `${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const long = i % 2 === 0;
    const reach = long ? R : R * 0.52;
    const w = R * (long ? 0.13 : 0.1);
    d += `M${pt(reach, a)} L${pt(w, a + Math.PI / 8)} L${pt(w * 0.9, a - Math.PI / 8)} Z `;
  }
  const inner = `<path d="${d}" fill-rule="nonzero"/><circle cx="${cx.toFixed(2)}" cy="${(cy - R * 0.86).toFixed(2)}" r="${(R * 0.09).toFixed(2)}"/>`;
  return pressed(inner, cx, cy, base, spec, size);
}

/**
 * A prow, seen head on — the app's own name (`brand.ts`), not its geography.
 *
 * ⚠ This is the one centre that is *about the product* rather than about
 * travel in general, and it costs nothing under D-017: a name is ours, a
 * coastline is the island's.
 */
function centreProw(cx, cy, size, base, spec) {
  const w = size * 0.46;
  const h = size * 0.5;
  const inner =
    `<path d="M${cx.toFixed(2)} ${(cy - h).toFixed(2)} L${(cx + w).toFixed(2)} ${(cy + h * 0.62).toFixed(2)} L${(cx + w * 0.52).toFixed(2)} ${(cy + h * 0.86).toFixed(2)} L${cx.toFixed(2)} ${(cy - h * 0.1).toFixed(2)} L${(cx - w * 0.52).toFixed(2)} ${(cy + h * 0.86).toFixed(2)} L${(cx - w).toFixed(2)} ${(cy + h * 0.62).toFixed(2)} Z"/>` +
    `<path d="M${(cx - w * 0.86).toFixed(2)} ${(cy + h * 0.2).toFixed(2)} L${(cx + w * 0.86).toFixed(2)} ${(cy + h * 0.2).toFixed(2)} L${(cx + w * 0.78).toFixed(2)} ${(cy + h * 0.36).toFixed(2)} L${(cx - w * 0.78).toFixed(2)} ${(cy + h * 0.36).toFixed(2)} Z"/>`;
  return pressed(inner, cx, cy, base, spec, size);
}

/**
 * Contour rings — what a walking map is actually made of.
 *
 * ⚠ Irregular and nested, never concentric circles: contours are the one
 * repeated ring that cannot read as a token, because no two are the same shape.
 */
function centreContour(cx, cy, size, base, spec) {
  let inner = '';
  for (let j = 0; j < 4; j += 1) {
    const R = size * (0.5 - j * 0.11);
    let d = '';
    for (let i = 0; i <= 40; i += 1) {
      const a = (i / 40) * Math.PI * 2;
      const rr = R * (1 + Math.sin(a * 3 + j * 1.2) * 0.16 + Math.sin(a * 5 - j) * 0.07);
      d += `${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr * 0.86).toFixed(2)} `;
    }
    inner += `<path d="${d}Z" fill="none" stroke-width="${(size * 0.055).toFixed(2)}"/>`;
  }
  // Contours are strokes, so the three passes need stroke rather than fill.
  const lift = Math.max(0.7, size * 0.03);
  const layer = (dy, col, op) =>
    `<g transform="translate(0 ${dy.toFixed(2)})" stroke="${col}" stroke-opacity="${op}" fill="none">${inner}</g>`;
  return (
    layer(lift, shade(base, -0.68), 0.9) +
    layer(-lift * 0.75, shade(base, 0.62), 0.5) +
    layer(0, shade(base, -0.26), 1)
  );
}

/**
 * A walked path with its two ends marked — the product's own core object.
 *
 * ⚠ The one centre that is a picture of *what the app does* rather than of
 * where it does it.
 */
function centreTrace(cx, cy, size, base, spec) {
  const w = size * 0.52;
  const d = `M${(cx - w).toFixed(2)} ${(cy + size * 0.22).toFixed(2)} C${(cx - w * 0.4).toFixed(2)} ${(cy + size * 0.4).toFixed(2)} ${(cx - w * 0.5).toFixed(2)} ${(cy - size * 0.16).toFixed(2)} ${cx.toFixed(2)} ${(cy - size * 0.06).toFixed(2)} C${(cx + w * 0.5).toFixed(2)} ${(cy + size * 0.04).toFixed(2)} ${(cx + w * 0.3).toFixed(2)} ${(cy - size * 0.42).toFixed(2)} ${(cx + w).toFixed(2)} ${(cy - size * 0.3).toFixed(2)}`;
  const inner = `<path d="${d}" fill="none" stroke-width="${(size * 0.1).toFixed(2)}" stroke-linecap="round"/>`;
  const dots = `<circle cx="${(cx - w).toFixed(2)}" cy="${(cy + size * 0.22).toFixed(2)}" r="${(size * 0.1).toFixed(2)}"/><circle cx="${(cx + w).toFixed(2)}" cy="${(cy - size * 0.3).toFixed(2)}" r="${(size * 0.1).toFixed(2)}"/>`;
  const lift = Math.max(0.7, size * 0.03);
  const layer = (dy, col, op) =>
    `<g transform="translate(0 ${dy.toFixed(2)})" stroke="${col}" stroke-opacity="${op}" fill="${col}" fill-opacity="${op}">${inner}${dots}</g>`;
  return (
    layer(lift, shade(base, -0.68), 0.9) +
    layer(-lift * 0.75, shade(base, 0.62), 0.5) +
    layer(0, shade(base, -0.26), 1)
  );
}

/** A Roman numeral for the rank. The oldest medal convention there is. */
function centreNumeral(cx, cy, size, base, spec, tier) {
  const numerals = { none: '–', bronze: 'I', silver: 'II', gold: 'III', platinum: 'IV' };
  return engraved(numerals[tier] ?? 'I', cx, cy + size * 0.34, size * 0.95, base);
}

/**
 * One star per rank, up to four.
 *
 * ⚠ The most legible rank signal of all — you can count it — and the most
 * gamey. Included so the trade can be looked at rather than assumed.
 */
function centreStars(cx, cy, size, base, spec, tier) {
  const count = { none: 0, bronze: 1, silver: 2, gold: 3, platinum: 4 }[tier] ?? 1;
  if (count === 0) {
    return engraved('–', cx, cy + size * 0.3, size * 0.8, base);
  }
  const R = size * (count > 2 ? 0.2 : 0.26);
  const gap = R * 2.3;
  let inner = '';
  for (let n = 0; n < count; n += 1) {
    const sx = cx + (n - (count - 1) / 2) * gap;
    let d = '';
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? R : R * 0.42;
      d += `${i === 0 ? 'M' : 'L'}${(sx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)} `;
    }
    inner += `<path d="${d}Z"/>`;
  }
  return pressed(inner, cx, cy, base, spec, size);
}

/** The app's mark, but filling the well instead of sitting politely in it. */
function centreBigMark(cx, cy, size, base, spec) {
  return debossDeep(cx, cy, size * 1.5, base, spec);
}

/* ------------------------------------------------ centres, first pass */

/** The mark standing proud of the surface rather than pressed into it. */
function centreEmboss(cx, cy, size, base, spec) {
  const scale = size / CANVAS;
  const lift = Math.max(0.8, size * (0.03 + spec * 0.018));
  const at = (dy, fill, opacity) => `
    <g transform="translate(${(cx - size / 2).toFixed(2)} ${(cy - size / 2 + dy).toFixed(2)}) scale(${scale.toFixed(4)})">
      <path d="${stampMarkPath()}" fill="${fill}" fill-opacity="${opacity}" fill-rule="evenodd"
            transform="rotate(${TILT_DEG} ${CANVAS / 2} ${CANVAS / 2})"/>
    </g>`;
  // ⚠ The offsets are the deboss's, swapped. Light above becomes light below,
  // and the eye flips the surface — the whole of emboss versus deboss is which
  // side the shadow falls on.
  return (
    at(lift, shade(base, -0.6), 0.5) +
    at(-lift * 0.8, shade(base, 0.7), 0.9) +
    at(0, shade(base, 0.16), 1)
  );
}

/** The mark cut clean through, showing the dark behind the medal. */
function centreCutout(cx, cy, size, base) {
  const scale = size / CANVAS;
  const at = (dy, fill, opacity) => `
    <g transform="translate(${(cx - size / 2).toFixed(2)} ${(cy - size / 2 + dy).toFixed(2)}) scale(${scale.toFixed(4)})">
      <path d="${stampMarkPath()}" fill="${fill}" fill-opacity="${opacity}" fill-rule="evenodd"
            transform="rotate(${TILT_DEG} ${CANVAS / 2} ${CANVAS / 2})"/>
    </g>`;
  return at(-0.9, shade(base, 0.6), 0.55) + at(0, '#05070A', 0.92);
}

/** The mark inside a raised cartouche, the way a coat of arms sits on a shield. */
function centreCartouche(cx, cy, size, base, spec, k) {
  const w = size * 0.86;
  const h = size * 0.92;
  const shield = `M${(cx - w / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} L${(cx + w / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} L${(cx + w / 2).toFixed(2)} ${(cy + h * 0.16).toFixed(2)} Q${(cx + w / 2).toFixed(2)} ${(cy + h / 2).toFixed(2)} ${cx.toFixed(2)} ${(cy + h / 2).toFixed(2)} Q${(cx - w / 2).toFixed(2)} ${(cy + h / 2).toFixed(2)} ${(cx - w / 2).toFixed(2)} ${(cy + h * 0.16).toFixed(2)} Z`;
  return `<path d="${shield}" fill="${shade(base, -0.14)}"/>
    <path d="${shield}" fill="none" stroke="${shade(base, 0.6)}" stroke-opacity="0.6" stroke-width="${(1.1 * k).toFixed(2)}"/>
    ${debossDeep(cx, cy - size * 0.02, size * 0.66, shade(base, -0.14), spec)}`;
}

/** No mark at all: the count, large and cut in. */
function centreNumber(cx, cy, size, base) {
  return engraved('23', cx, cy + size * 0.3, size * 0.86, base) ;
}

/** The mark with a hairline keyline around it, like a die-struck outline. */
function centreKeyline(cx, cy, size, base, spec, k) {
  const scale = (size * 1.16) / CANVAS;
  return `<g transform="translate(${(cx - (size * 1.16) / 2).toFixed(2)} ${(cy - (size * 1.16) / 2).toFixed(2)}) scale(${scale.toFixed(4)})">
      <path d="${stampMarkPath()}" fill="none" stroke="${shade(base, 0.62)}" stroke-opacity="0.5" stroke-width="${(1.6 / scale).toFixed(2)}" fill-rule="evenodd"
            transform="rotate(${TILT_DEG} ${CANVAS / 2} ${CANVAS / 2})"/>
    </g>
    ${debossDeep(cx, cy, size, base, spec)}`;
}

/**
 * The refined seal, with the ring and the centre swappable.
 *
 * ⚠ Body, lighting, material and shadows are **identical to `seal`**. This
 * exists so a row can change exactly one thing.
 */
function sealParts(id, tier, size, ring, centre) {
  const rank = RANKS[tier];
  const { base, spec, warm, wax } = rank;
  const c = size / 2;
  const r = size / 2 - size * 0.055;
  const k = size / 132;

  const light = shade(base, 0.46);
  const dark = shade(base, -0.46);
  const deep = shade(base, -0.68);
  const hot = warm > 0.3 ? shade(base, 0.76) : shade(base, 0.95);
  const turn = (0.62 - spec * 0.34).toFixed(2);

  const rings = {
    cord: () => beading(c, c, r - 9 * k, 32, shade(base, 0.55), 1.15 * k),
    chain: () => ringChain(c, c, r - 9 * k, 20, base, k),
    guilloche: () => ringGuilloche(c, c, r - 13 * k, r - 7 * k, 4, 14, base, k),
    wreath: () => ringWreath(c, c, r - 10 * k, 9, base, k),
    milled: () => ringMilled(c, c, r - 1.5 * k, r - 6 * k, 72, base, k),
    hairline: () => ringHairline(c, c, r - 9 * k, base, k),
    bare: () => '',
  };

  const cy2 = c - 9 * k;
  const centres = {
    deboss: () => debossDeep(c, cy2, 46 * k, base, spec),
    emboss: () => centreEmboss(c, cy2, 46 * k, base, spec),
    cutout: () => centreCutout(c, cy2, 46 * k, base),
    cartouche: () => centreCartouche(c, cy2, 46 * k, base, spec, k),
    keyline: () => centreKeyline(c, cy2, 44 * k, base, spec, k),
    number: () => centreNumber(c, cy2, 46 * k, base),
    compass: () => centreCompass(c, cy2, 46 * k, base, spec),
    prow: () => centreProw(c, cy2, 46 * k, base, spec),
    contour: () => centreContour(c, cy2, 46 * k, base, spec),
    trace: () => centreTrace(c, cy2, 46 * k, base, spec),
    numeral: () => centreNumeral(c, cy2, 46 * k, base, spec, tier),
    stars: () => centreStars(c, cy2, 46 * k, base, spec, tier),
    bigmark: () => centreBigMark(c, cy2, 46 * k, base, spec),
  };

  return `
  <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <defs>
      <radialGradient id="pface-${id}" cx="33%" cy="25%" r="80%">
        <stop offset="0" stop-color="${shade(base, 0.5 + spec * 0.25)}"/>
        <stop offset="${turn}" stop-color="${base}"/>
        <stop offset="1" stop-color="${dark}"/>
      </radialGradient>
      <linearGradient id="prim-${id}" x1="0.1" y1="1" x2="0.4" y2="0">
        <stop offset="0" stop-color="${light}"/><stop offset="0.42" stop-color="${deep}"/><stop offset="1" stop-color="${shade(base, 0.64)}"/>
      </linearGradient>
      <linearGradient id="pspec-${id}" x1="0.05" y1="0" x2="0.75" y2="1">
        <stop offset="0" stop-color="${hot}" stop-opacity="${(0.12 + spec * 0.82).toFixed(2)}"/>
        <stop offset="${(0.08 + spec * 0.2).toFixed(2)}" stop-color="${hot}" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="pwell-${id}" cx="50%" cy="40%" r="64%">
        <stop offset="0" stop-color="${shade(base, -0.04)}"/><stop offset="0.72" stop-color="${shade(base, -0.2)}"/><stop offset="1" stop-color="${shade(base, -0.52)}"/>
      </radialGradient>
    </defs>

    <path d="${sealPath(c, c + 4.2 * k, r * 1.008, 5 * k, wax)}" fill="#000" fill-opacity="0.18"/>
    <path d="${sealPath(c, c + 1.6 * k, r, 5 * k, wax)}" fill="#000" fill-opacity="0.42"/>

    <path d="${sealPath(c, c, r, 5 * k, wax)}" fill="url(#prim-${id})"/>
    <path d="${sealPath(c, c, r - 5.5 * k, 3.4 * k, wax)}" fill="url(#pface-${id})"/>
    <path d="${sealPath(c, c, r - 5.5 * k, 3.4 * k, wax)}" fill="none" stroke="${shade(base, 0.7)}" stroke-opacity="0.35" stroke-width="${(0.7 * k).toFixed(2)}"/>

    <circle cx="${c}" cy="${c}" r="${(r - 12 * k).toFixed(2)}" fill="url(#pwell-${id})"/>
    <circle cx="${c}" cy="${c}" r="${(r - 12.4 * k).toFixed(2)}" fill="none" stroke="${deep}" stroke-opacity="0.55" stroke-width="${(1.8 * k).toFixed(2)}"/>
    <circle cx="${c}" cy="${c}" r="${(r - 11.2 * k).toFixed(2)}" fill="none" stroke="${shade(base, 0.6)}" stroke-opacity="0.3" stroke-width="${(0.7 * k).toFixed(2)}"/>

    ${(rings[ring] ?? rings.cord)()}
    ${(centres[centre] ?? centres.deboss)()}
    ${engraved('23 / 60', c, c + 30 * k, 15 * k, base)}

    <path d="${sealPath(c, c, r, 5 * k, wax)}" fill="url(#pspec-${id})"/>
    <path d="M${arcPt(c, c, r * 0.94, 0.2)} A ${(r * 0.94).toFixed(2)} ${(r * 0.94).toFixed(2)} 0 0 1 ${arcPt(c, c, r * 0.94, 0.6)}"
      fill="none" stroke="${shade(base, 0.5)}" stroke-opacity="${(0.16 + spec * 0.34).toFixed(2)}" stroke-width="${((1 + spec * 1.2) * k).toFixed(2)}" stroke-linecap="round"/>
    <path d="M${arcPt(c, c, r * 0.94, 1.18)} A ${(r * 0.94).toFixed(2)} ${(r * 0.94).toFixed(2)} 0 0 1 ${arcPt(c, c, r * 0.94, 1.62)}"
      fill="none" stroke="${hot}" stroke-opacity="${(0.26 + spec * 0.58).toFixed(2)}" stroke-width="${((1.7 + spec * 2.3) * k).toFixed(2)}" stroke-linecap="round"/>
  </svg>`;
}

const RING_OPTIONS = [
  ['cord', 'Twisted cord', 'The current one, as the control.'],
  ['chain', 'Chain links', 'Interlocking ovals, alternating light and dark. Denser than cord and unmistakably <i>made</i>.'],
  ['guilloche', 'Guilloché', 'Engine-turned waves from banknotes and watch dials. Closed rings, so it can never read as spokes.'],
  ['wreath', 'Laurel wreath', 'Two sprigs closing at the top. The most medal-like, and the least neutral.'],
  ['milled', 'Milled edge', '⚠ Deliberately the closest to the rejected chip, so the difference can be <i>seen</i>: reeding sits on the outer edge, is far finer, and is cut across the rim rather than dotted on the face.'],
  ['hairline', 'Two hairlines', 'A plain channel between two lines. The quietest option, and the one that lets the metal do all the talking.'],
  ['bare', 'Nothing', 'No ring at all. Worth seeing, because it is the only way to know how much the ring is contributing.'],
];

const CENTRE_OPTIONS = [
  ['deboss', 'The app mark (control)', 'What is there now, unchanged, so everything else has something to be judged against.'],
  ['compass', 'Compass rose', 'Four long points and four short — a rose. Four equal points would be a cross, eight equal ones the spoke pattern this whole thread has been avoiding. Navigation, and generic to every sea there is.'],
  ['prow', 'A prow', '⚠ The one option that is about <i>this product</i> rather than travel in general: the app is named for a ship’s bow. A name is ours; a coastline would be the island’s, and D-017 forbids that.'],
  ['contour', 'Contour rings', 'What a walking map is actually made of. ⚠ Irregular and nested, never concentric — contours are the one repeated ring that cannot read as a token, because no two are the same shape.'],
  ['trace', 'A walked path', 'A line with both ends marked. The only centre that is a picture of <i>what the app does</i> rather than of where it does it.'],
  ['numeral', 'Roman numeral', 'I, II, III, IV. The oldest medal convention there is, and it says the rank outright instead of implying it.'],
  ['stars', 'One star per rank', '⚠ The most legible rank signal of all — you can <i>count</i> it — and the most gamey. Here so the trade can be looked at rather than assumed.'],
  ['bigmark', 'The mark, filling the well', 'Not a new drawing: the existing mark at half again the size, so it owns the space instead of sitting politely in it. ⚠ Scale is a design decision that costs nothing.'],
];

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

<h2>The ring — seven options</h2>
<p class="note">
  ⚠ <b>One variable at a time.</b> The body, the lighting, the material and the
  centre are identical across this row — only the ring changes. A study that
  moves two things at once cannot tell you which one you liked, which is how
  round 5 had to be thrown away whole rather than partly.
  <br><br>
  Drawn on <b>gold</b>, because it carries ornament without the platinum facets
  competing, and again on <b>bronze</b>, because a ring that only works on the
  showy rank is not a ring.
</p>
${RING_OPTIONS.map(([id, title, note]) => `
<div class="row">
  <figure>${sealParts(`RG-${id}`, 'gold', STUDY, id, 'deboss')}<figcaption>${title}</figcaption></figure>
  <figure>${sealParts(`RB-${id}`, 'bronze', STUDY, id, 'deboss')}<figcaption>bronze</figcaption></figure>
  <figure>${sealParts(`RS-${id}`, 'gold', BUTTON, id, 'deboss')}<figcaption>64 dp</figcaption></figure>
  <div style="max-width:46ch;color:#A0A0A8;font-size:14px;align-self:center">${note}</div>
</div>`).join('')}

<h2>The centre — eight options, and this time they are different <i>things</i></h2>
<p class="note">
  ⚠⚠ <b>The first six were one drawing with six surface treatments</b> — the app's
  mark with the light moved around. These are different <i>things to put there</i>.
  <br><br>
  ⚠ <b>The obvious one is forbidden.</b> The island's silhouette is what a Madeira
  app would put in the middle of its medal, and <b>D-017 is absolute: no Madeira
  knowledge in <code>app/</code></b>. A coastline is island knowledge of the purest
  kind. Out by rule, not by taste — and everything below would be as correct for
  the Azores.
  <br><br>
  Same discipline as the rings: everything else frozen, including the cord. Gold,
  bronze, and the real 64 dp button. ⚠ Two of them — <b>numeral</b> and
  <b>stars</b> — change with the rank, so the bronze column shows a different
  glyph on purpose.
</p>
${CENTRE_OPTIONS.map(([id, title, note]) => `
<div class="row">
  <figure>${sealParts(`CG-${id}`, 'gold', STUDY, 'cord', id)}<figcaption>${title}</figcaption></figure>
  <figure>${sealParts(`CB-${id}`, 'bronze', STUDY, 'cord', id)}<figcaption>bronze</figcaption></figure>
  <figure>${sealParts(`CS-${id}`, 'gold', BUTTON, 'cord', id)}<figcaption>64 dp</figcaption></figure>
  <div style="max-width:46ch;color:#A0A0A8;font-size:14px;align-self:center">${note}</div>
</div>`).join('')}

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

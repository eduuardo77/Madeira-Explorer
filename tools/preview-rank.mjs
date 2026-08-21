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


/** Point on a circle, as an SVG coordinate pair. */
const pt2 = (cx, cy, r, a) => `${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;

/* ------------------------------------------------------------------- medal */

/**
 * How ostentatious each rank is allowed to be.
 *
 * ⚠⚠ **THIS TABLE IS THE ANSWER TO "MORE PREMIUM AS THE RANK RISES".** The
 * project lead: *"ensure the higher the rank, more premium looking and boogie
 * looking the stamp is."* Doing that with **colour** would be five hues again,
 * which already failed once. Doing it with **structure** means the ranks
 * separate in greyscale, at 44 dp, and for a colour-blind user.
 *
 * `bevels` is how many stepped rings the rim is cut into — the single biggest
 * contributor to reading as an *object* rather than a disc. The rest either
 * exists or does not, so the escalation is legible as *more things*, not as
 * *brighter*.
 */
const ESCALATION = {
  none: { bevels: 1, cord: false, burst: 0, laurel: 0, dome: false, facet: 0, halo: false, sparks: 0 },
  bronze: { bevels: 2, cord: false, burst: 0, laurel: 0, dome: false, facet: 0, halo: false, sparks: 0 },
  silver: { bevels: 3, cord: true, burst: 14, laurel: 0, dome: false, facet: 0, halo: false, sparks: 0 },
  gold: { bevels: 4, cord: true, burst: 20, laurel: 5, dome: true, facet: 0, halo: false, sparks: 2 },
  platinum: { bevels: 5, cord: true, burst: 28, laurel: 7, dome: true, facet: 36, halo: true, sparks: 4 },
};

/**
 * A stepped bevel: concentric rings, each catching light at its own angle.
 *
 * ⚠ **This is where the depth actually comes from.** One rim plus one face is a
 * disc with a gradient on it. Four or five rings, alternating which side they
 * catch, is a *turned edge* — the eye reads the steps as a surface curving
 * away, which no amount of shading on a single shape can fake.
 */
function bevelRing(id, cx, cy, rOuter, rInner, steps, wax) {
  let out = '';
  for (let i = 0; i < steps; i += 1) {
    const ro = rOuter - (rOuter - rInner) * (i / steps);
    out += `<path d="${sealPath(cx, cy, ro, (rOuter - rInner) * 0.18, wax)}" fill="url(#step${i % 2}-${id})" fill-opacity="${(0.92 - i * 0.05).toFixed(2)}"/>`;
  }
  out += `<path d="${sealPath(cx, cy, rInner, (rOuter - rInner) * 0.12, wax)}" fill="url(#face-${id})"/>`;
  return out;
}

/** A raised centre rather than a recessed well. Gold and above. */
function dome(id, cx, cy, r, base) {
  return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="url(#dome-${id})"/>
    <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="${shade(base, -0.62)}" stroke-opacity="0.5" stroke-width="${(r * 0.06).toFixed(2)}"/>`;
}

/** Laurel sprigs rising from the bottom. */
function laurel(cx, cy, r, leaves, fill) {
  let out = '';
  for (const side of [-1, 1]) {
    for (let i = 0; i < leaves; i += 1) {
      const t = 0.1 + (i / Math.max(1, leaves - 1)) * 0.6;
      const a = Math.PI / 2 + side * t * Math.PI;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const deg = (a * 180) / Math.PI + side * 60;
      const len = r * 0.17 * (1 - i * 0.05);
      out += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${len.toFixed(2)}" ry="${(len * 0.4).toFixed(2)}" transform="rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${fill}" fill-opacity="0.8"/>`;
    }
  }
  return out;
}

/** A four-point star — the oldest "this is shiny" signal there is. */
function sparkle(x, y, s, fill) {
  const q = `Q${x.toFixed(2)} ${y.toFixed(2)} `;
  return `<path d="M${x.toFixed(2)} ${(y - s).toFixed(2)} ${q}${(x + s).toFixed(2)} ${y.toFixed(2)} ${q}${x.toFixed(2)} ${(y + s).toFixed(2)} ${q}${(x - s).toFixed(2)} ${y.toFixed(2)} ${q}${x.toFixed(2)} ${(y - s).toFixed(2)} Z" fill="${fill}"/>`;
}

/** Concentric fading strokes outside the medal. Platinum only. */
function halo(cx, cy, r, fill, k) {
  let out = '';
  for (let i = 0; i < 3; i += 1) {
    out += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(r + (i + 1) * 2.4 * k).toFixed(2)}" fill="none" stroke="${fill}" stroke-opacity="${(0.24 - i * 0.07).toFixed(2)}" stroke-width="${(1.6 * k).toFixed(2)}"/>`;
  }
  return out;
}

function seal(id, tier, size, withNumber = true) {
  const rank = RANKS[tier];
  const { base, spec, warm, wax } = rank;
  const e = ESCALATION[tier];
  const c = size / 2;
  const k = size / 132;
  const r = c - size * (e.halo ? 0.105 : 0.06);

  const light = shade(base, 0.46);
  const dark = shade(base, -0.46);
  const deep = shade(base, -0.68);
  const hot = warm > 0.3 ? shade(base, 0.76) : shade(base, 0.95);

  return `
  <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <defs>
      <radialGradient id="face-${id}" cx="34%" cy="26%" r="78%">
        <stop offset="0" stop-color="${light}"/><stop offset="0.48" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/>
      </radialGradient>
      <linearGradient id="step0-${id}" x1="0.12" y1="1" x2="0.42" y2="0">
        <stop offset="0" stop-color="${shade(base, 0.5)}"/><stop offset="0.45" stop-color="${deep}"/><stop offset="1" stop-color="${shade(base, 0.66)}"/>
      </linearGradient>
      <linearGradient id="step1-${id}" x1="0.45" y1="0" x2="0.15" y2="1">
        <stop offset="0" stop-color="${shade(base, 0.34)}"/><stop offset="0.5" stop-color="${dark}"/><stop offset="1" stop-color="${shade(base, 0.2)}"/>
      </linearGradient>
      <radialGradient id="dome-${id}" cx="36%" cy="28%" r="72%">
        <stop offset="0" stop-color="${shade(base, 0.58)}"/><stop offset="0.6" stop-color="${base}"/><stop offset="1" stop-color="${shade(base, -0.52)}"/>
      </radialGradient>
      <linearGradient id="spec-${id}" x1="0.05" y1="0" x2="0.72" y2="1">
        <stop offset="0" stop-color="${hot}" stop-opacity="${(0.12 + spec * 0.82).toFixed(2)}"/>
        <stop offset="${(0.07 + spec * 0.2).toFixed(2)}" stop-color="${hot}" stop-opacity="0"/>
      </linearGradient>
    </defs>

    ${e.halo ? halo(c, c, r, hot, k) : ''}

    <!-- ⚠ Two shadows, not one. A wide soft one for the drop and a tight dark
         one for the contact: that pair is what makes an object look like it is
         RESTING on something rather than floating over it. Offset copies, not
         a filter. -->
    <path d="${sealPath(c, c + 4.5 * k, r * 1.01, 5 * k, wax)}" fill="#000" fill-opacity="0.2"/>
    <path d="${sealPath(c, c + 1.8 * k, r, 5 * k, wax)}" fill="#000" fill-opacity="0.45"/>

    ${bevelRing(id, c, c, r, r - (5 + e.bevels * 2.4) * k, e.bevels, wax)}

    ${e.facet ? facets(c, c, r - 1.5 * k, r - 7 * k, e.facet, shade(base, 0.8), deep) : ''}
    ${e.cord ? beading(c, c, r - (7 + e.bevels * 1.8) * k, 36, shade(base, 0.55), 1.25 * k) : ''}
    ${e.burst ? rays(c, c - 3 * k, 8 * k, r - 18 * k, e.burst, shade(base, 0.62), e.facet ? 0.32 : 0.18) : ''}
    ${e.laurel ? laurel(c, c - 2 * k, r - 17 * k, e.laurel, shade(base, 0.6)) : ''}
    ${e.dome ? dome(id, c, c - 8 * k, 25 * k, base) : ''}
    ${e.halo ? `<circle cx="${c}" cy="${c}" r="${(r - 16 * k).toFixed(2)}" fill="none" stroke="${shade(base, 0.9)}" stroke-opacity="0.75" stroke-width="${(1.2 * k).toFixed(2)}"/>` : ''}

    ${deboss(c, c - (withNumber ? 9 * k : 0), 42 * k, base)}
    ${withNumber ? engraved('23 / 60', c, c + 31 * k, 15 * k, base) : ''}

    <path d="${sealPath(c, c, r, 5 * k, wax)}" fill="url(#spec-${id})"/>

    <!-- ⚠ The bounce light, and it is the biggest single 3D tell here. A real
         object picks up light reflected off whatever it sits on, so a thin
         bright arc appears on the side AWAY from the key light. Without it a
         shaded circle stays a shaded circle however good the gradient is. -->
    <path d="M${pt2(c, c, r * 0.93, Math.PI * 0.18)} A ${(r * 0.93).toFixed(2)} ${(r * 0.93).toFixed(2)} 0 0 1 ${pt2(c, c, r * 0.93, Math.PI * 0.62)}"
      fill="none" stroke="${shade(base, 0.45)}" stroke-opacity="${(0.2 + spec * 0.4).toFixed(2)}" stroke-width="${((1.2 + spec * 1.4) * k).toFixed(2)}" stroke-linecap="round"/>
    <path d="M${pt2(c, c, r * 0.94, Math.PI * 1.16)} A ${(r * 0.94).toFixed(2)} ${(r * 0.94).toFixed(2)} 0 0 1 ${pt2(c, c, r * 0.94, Math.PI * 1.64)}"
      fill="none" stroke="${hot}" stroke-opacity="${(0.28 + spec * 0.58).toFixed(2)}" stroke-width="${((1.8 + spec * 2.4) * k).toFixed(2)}" stroke-linecap="round"/>

    ${Array.from({ length: e.sparks }, (_, i) => {
      const a = Math.PI * (1.28 + i * 0.42);
      return sparkle(c + Math.cos(a) * r * 0.8, c + Math.sin(a) * r * 0.8, (3.6 - i * 0.5) * k, hot);
    }).join('')}
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

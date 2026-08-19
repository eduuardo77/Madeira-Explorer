/**
 * The rank seal — five vocabularies, after the poker chip (T-158, D-078).
 *
 *     node tools/preview-rank.mjs
 *     → tools/out/rank.html
 *
 * ⚠⚠ **STILL A SKETCH PASS.** Only what survives becomes a pure module in `app/`.
 *
 * WHAT THE LAST ONE GOT WRONG, IN THE PROJECT LEAD'S WORDS
 * -------------------------------------------------------
 * *"Os pontos na volta e as linhas do centro para fora fazem parecer uma poker
 * coin."* — and that is exactly right. **Evenly spaced dots around a rim plus
 * radial spokes from the centre is a poker chip.** Not similar to one: it is the
 * definition of one. Both devices were mine, both are gone, and neither should
 * come back.
 *
 * ⚠ The devices were borrowed from `stampArt.ts` — perforation dots and a
 * sunburst — on the reasoning that the medal should share the stamps' own
 * vocabulary. **That reasoning was sound and the result was still wrong**, which
 * is worth remembering: a good rule applied without looking produces a casino
 * chip.
 *
 * FIVE VOCABULARIES, NONE OF THEM A CHIP
 * --------------------------------------
 *   1. **Cord and laurel** — a twisted rope border and sprigs that grow with
 *      rank. Medal, not chip: nothing is evenly spaced and nothing radiates.
 *   2. **Lettered rim** — the app's name set around the edge, engraved. What an
 *      actual seal or coin does, and text is the one thing a chip never has.
 *   3. **Guilloché** — the engine-turned wave pattern from banknotes and watch
 *      dials. Concentric and *wavy*, so it never reads as spokes.
 *   4. **Pure wax** — no geometry at all. A poured edge, a mottled surface, a
 *      drip. Rank carried entirely by material and by how rich the pour is.
 *   5. **The mark is the seal** — the outline *is* the app's stamp mark rather
 *      than a circle with the mark inside it, which is what removes the
 *      "disc containing a thing" reading at the root.
 *
 * ⚠ **No SVG filters** — `feGaussianBlur` is unreliable in `react-native-svg` on
 * Android. Shadow is an offset copy, deboss is three passes, sheen is a
 * gradient. What is judged here is what the app can draw.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.removeAllListeners('warning');

const { CANVAS } = await import('../app/src/passport/stampArt.ts');
const { stampMarkPath, TILT_DEG } = await import('../app/src/passport/stampMark.ts');
const { APP_NAME } = await import('../app/src/brand.ts');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ colour */

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((c) => clamp(c).toString(16).padStart(2, '0')).join('');
const shade = (hex, a) => toHex(parse(hex).map((c) => (a >= 0 ? c + (255 - c) * a : c * (1 + a))));

const RANKS = {
  none: { base: '#5AA9FF', spec: 0.22, warm: 0, orn: 0, wax: true, label: 'no stamps yet' },
  bronze: { base: '#A86B34', spec: 0.34, warm: 0.6, orn: 1, wax: true, label: '1+' },
  silver: { base: '#AEB4BD', spec: 0.66, warm: 0.1, orn: 2, wax: true, label: '10+' },
  gold: { base: '#CE9C22', spec: 0.58, warm: 0.65, orn: 3, wax: true, label: '25+' },
  platinum: { base: '#D3E2F0', spec: 0.94, warm: 0, orn: 4, wax: false, label: 'all of them' },
};
const TIERS = Object.keys(RANKS);

/* ------------------------------------------------------------------- parts */

const pt = (cx, cy, r, a) => `${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;

/** A poured edge. `hard` makes it crisp — platinum is not wax. */
function outline(cx, cy, r, wobble, hard) {
  const steps = hard ? 26 : 17;
  const p = [];
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    // ⚠ Irregular on purpose: a *regular* wobble is a cog, which is the other
    // shape that reads as a token rather than as poured wax.
    const noise = Math.sin(i * 2.7) * 0.6 + Math.sin(i * 1.3) * 0.4;
    const rr = r - (hard ? wobble * 0.2 : wobble) * (0.5 + noise * 0.5);
    p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const s = (n) => `${n[0].toFixed(2)} ${n[1].toFixed(2)}`;
  return (
    `M${s(p[0])} ` +
    p.map((q, i) => {
      const n = p[(i + 1) % p.length];
      return `Q${s(q)} ${s([(q[0] + n[0]) / 2, (q[1] + n[1]) / 2])}`;
    }).join(' ') + 'Z'
  );
}

/** Twisted cord: tangential ovals that overlap, so it reads as rope not dots. */
function cord(cx, cy, r, count, light, dark, w) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const deg = (a * 180) / Math.PI + 32;
    out += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${(w * 1.9).toFixed(2)}" ry="${w.toFixed(2)}" transform="rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${i % 2 ? light : dark}" fill-opacity="0.8"/>`;
  }
  return out;
}

/** Two sprigs rising from the bottom. Grows with rank. */
function laurel(cx, cy, r, leaves, fill) {
  let out = '';
  for (const side of [-1, 1]) {
    for (let i = 0; i < leaves; i += 1) {
      const t = 0.12 + (i / Math.max(1, leaves - 1)) * 0.62;
      const a = Math.PI / 2 + side * t * Math.PI;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const deg = (a * 180) / Math.PI + side * 62;
      const len = r * 0.16 * (1 - i * 0.05);
      out += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${len.toFixed(2)}" ry="${(len * 0.42).toFixed(2)}" transform="rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${fill}" fill-opacity="0.75"/>`;
    }
  }
  return out;
}

/** Engine-turning: concentric waves. Never spokes, because it is closed rings. */
function guilloche(cx, cy, rings, rMin, rMax, lobes, stroke, w) {
  let out = '';
  for (let k = 0; k < rings; k += 1) {
    const base = rMin + ((rMax - rMin) * k) / Math.max(1, rings - 1);
    const amp = (rMax - rMin) * 0.16;
    const phase = k * 0.7;
    let d = '';
    for (let i = 0; i <= 96; i += 1) {
      const a = (i / 96) * Math.PI * 2;
      const rr = base + Math.sin(a * lobes + phase) * amp;
      d += `${i === 0 ? 'M' : 'L'}${pt(cx, cy, rr, a)} `;
    }
    out += `<path d="${d}Z" fill="none" stroke="${stroke}" stroke-opacity="0.3" stroke-width="${w}"/>`;
  }
  return out;
}

/** Uneven patches, for wax that was poured rather than pressed out of a mould. */
function mottle(cx, cy, r, base, seedCount) {
  let out = '';
  for (let i = 0; i < seedCount; i += 1) {
    const a = i * 2.399;
    const d = r * (0.15 + ((i * 37) % 60) / 100);
    const rr = r * (0.16 + ((i * 53) % 40) / 200);
    out += `<circle cx="${(cx + Math.cos(a) * d).toFixed(2)}" cy="${(cy + Math.sin(a) * d).toFixed(2)}" r="${rr.toFixed(2)}" fill="${i % 2 ? shade(base, 0.12) : shade(base, -0.12)}" fill-opacity="0.22"/>`;
  }
  return out;
}

/** A drip, because wax runs. */
function tail(cx, cy, r, fill) {
  const y = cy + r * 0.86;
  return `<path d="M${(cx - r * 0.19).toFixed(2)} ${y.toFixed(2)} Q${cx.toFixed(2)} ${(y + r * 0.44).toFixed(2)} ${(cx + r * 0.17).toFixed(2)} ${y.toFixed(2)} Z" fill="${fill}"/>`;
}

function engraved(text, x, y, size, base, weight = 700) {
  const c = `x="${x}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="0.4"`;
  return `<text ${c} y="${(y + size * 0.07).toFixed(2)}" fill="${shade(base, -0.6)}" opacity="0.9">${text}</text>
    <text ${c} y="${(y - size * 0.05).toFixed(2)}" fill="${shade(base, 0.6)}" opacity="0.5">${text}</text>
    <text ${c} y="${y}" fill="${shade(base, -0.16)}">${text}</text>`;
}

function deboss(cx, cy, size, base) {
  const scale = size / CANVAS;
  const lift = Math.max(0.6, size * 0.028);
  const at = (dy, fill, op) => `<g transform="translate(${(cx - size / 2).toFixed(2)} ${(cy - size / 2 + dy).toFixed(2)}) scale(${scale.toFixed(4)})">
      <path d="${stampMarkPath()}" fill="${fill}" fill-opacity="${op}" fill-rule="evenodd" transform="rotate(${TILT_DEG} ${CANVAS / 2} ${CANVAS / 2})"/></g>`;
  return at(lift, shade(base, -0.6), 0.92) + at(-lift * 0.7, shade(base, 0.55), 0.5) + at(0, shade(base, -0.2), 1);
}

/* ------------------------------------------------------------------ medals */

function shell(id, rank, size) {
  const { base, spec, warm } = rank;
  const light = shade(base, 0.44), dark = shade(base, -0.44);
  const deep = shade(base, -0.66);
  const hot = warm > 0.3 ? shade(base, 0.74) : shade(base, 0.94);
  return { light, dark, deep, hot, defs: `
      <radialGradient id="face-${id}" cx="34%" cy="27%" r="80%">
        <stop offset="0" stop-color="${light}"/><stop offset="0.5" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/>
      </radialGradient>
      <linearGradient id="rim-${id}" x1="0.1" y1="1" x2="0.4" y2="0">
        <stop offset="0" stop-color="${light}"/><stop offset="0.42" stop-color="${deep}"/><stop offset="1" stop-color="${shade(base, 0.62)}"/>
      </linearGradient>
      <linearGradient id="spec-${id}" x1="0.05" y1="0" x2="0.75" y2="1">
        <stop offset="0" stop-color="${hot}" stop-opacity="${(0.12 + spec * 0.8).toFixed(2)}"/>
        <stop offset="${(0.08 + spec * 0.2).toFixed(2)}" stop-color="${hot}" stop-opacity="0"/>
      </linearGradient>` };
}

/** Shared closing pass: sheen over everything, plus the polished rim arc. */
function finish(id, cx, cy, r, rank, path, k) {
  const { hot } = shell(id, rank, 1);
  return `<path d="${path}" fill="url(#spec-${id})"/>
    <path d="M${pt(cx, cy, r * 0.92, Math.PI * 1.18)} A ${r * 0.92} ${r * 0.92} 0 0 1 ${pt(cx, cy, r * 0.92, Math.PI * 1.62)}"
      fill="none" stroke="${hot}" stroke-opacity="${(0.25 + rank.spec * 0.55).toFixed(2)}" stroke-width="${(1.6 + rank.spec * 2.2) * k}" stroke-linecap="round"/>`;
}

/** 1 — cord and laurel. */
function cordLaurel(id, tier, size) {
  const rank = RANKS[tier], c = size / 2, k = size / 132, r = c - size * 0.055;
  const s = shell(id, rank, size);
  const body = outline(c, c, r, 5 * k, !rank.wax);
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs>${s.defs}</defs>
    <path d="${outline(c, c + 2.4 * k, r, 5 * k, !rank.wax)}" fill="#000" fill-opacity="0.34"/>
    <path d="${body}" fill="url(#rim-${id})"/>
    <path d="${outline(c, c, r - 5.5 * k, 3.4 * k, !rank.wax)}" fill="url(#face-${id})"/>
    ${rank.orn >= 1 ? cord(c, c, r - 8 * k, 34, shade(rank.base, 0.5), s.deep, 1.5 * k) : ''}
    ${rank.orn >= 2 ? laurel(c, c - 2 * k, r - 15 * k, rank.orn >= 3 ? 6 : 4, shade(rank.base, 0.55)) : ''}
    ${rank.orn >= 4 ? `<circle cx="${c}" cy="${c}" r="${r - 12 * k}" fill="none" stroke="${shade(rank.base, 0.9)}" stroke-opacity="0.75" stroke-width="${1.2 * k}"/>` : ''}
    ${deboss(c, c - 9 * k, 44 * k, rank.base)}
    ${engraved('23 / 60', c, c + 30 * k, 15 * k, rank.base)}
    ${finish(id, c, c, r, rank, body, k)}</svg>`;
}

/** 2 — lettered rim. Text is the one thing a chip never has. */
function lettered(id, tier, size) {
  const rank = RANKS[tier], c = size / 2, k = size / 132, r = c - size * 0.055;
  const s = shell(id, rank, size);
  const body = outline(c, c, r, 5 * k, !rank.wax);
  const rr = r - 8.5 * k;
  const word = `${APP_NAME.toUpperCase()} · ${tier.toUpperCase()} · `;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs>${s.defs}
      <path id="ring-${id}" d="M${pt(c, c, rr, Math.PI)} A ${rr} ${rr} 0 1 1 ${pt(c, c, rr, Math.PI - 0.001)}"/>
    </defs>
    <path d="${outline(c, c + 2.4 * k, r, 5 * k, !rank.wax)}" fill="#000" fill-opacity="0.34"/>
    <path d="${body}" fill="url(#rim-${id})"/>
    <path d="${outline(c, c, r - 5.5 * k, 3.4 * k, !rank.wax)}" fill="url(#face-${id})"/>
    <circle cx="${c}" cy="${c}" r="${(rr - 5 * k).toFixed(2)}" fill="none" stroke="${s.deep}" stroke-opacity="0.45" stroke-width="${1 * k}"/>
    <text font-family="Helvetica, Arial, sans-serif" font-size="${8.5 * k}" font-weight="700" letter-spacing="${2.2 * k}" fill="${shade(rank.base, -0.55)}" opacity="0.9">
      <textPath href="#ring-${id}" startOffset="0">${word.repeat(2)}</textPath></text>
    <text font-family="Helvetica, Arial, sans-serif" font-size="${8.5 * k}" font-weight="700" letter-spacing="${2.2 * k}" fill="${shade(rank.base, 0.6)}" opacity="0.45" transform="translate(0 ${-0.7 * k})">
      <textPath href="#ring-${id}" startOffset="0">${word.repeat(2)}</textPath></text>
    ${deboss(c, c - 6 * k, 46 * k, rank.base)}
    ${engraved('23 / 60', c, c + 32 * k, 14 * k, rank.base)}
    ${finish(id, c, c, r, rank, body, k)}</svg>`;
}

/** 3 — guilloché. Closed waves, so it can never read as spokes. */
function guillocheSeal(id, tier, size) {
  const rank = RANKS[tier], c = size / 2, k = size / 132, r = c - size * 0.055;
  const s = shell(id, rank, size);
  const body = outline(c, c, r, 5 * k, !rank.wax);
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs>${s.defs}</defs>
    <path d="${outline(c, c + 2.4 * k, r, 5 * k, !rank.wax)}" fill="#000" fill-opacity="0.34"/>
    <path d="${body}" fill="url(#rim-${id})"/>
    <path d="${outline(c, c, r - 5.5 * k, 3.4 * k, !rank.wax)}" fill="url(#face-${id})"/>
    ${rank.orn >= 1 ? guilloche(c, c, 2 + rank.orn * 2, r * 0.34, r - 9 * k, 5 + rank.orn * 2, shade(rank.base, 0.75), 0.8 * k) : ''}
    ${rank.orn >= 4 ? `<circle cx="${c}" cy="${c}" r="${r - 7 * k}" fill="none" stroke="${shade(rank.base, 0.92)}" stroke-opacity="0.8" stroke-width="${1.3 * k}"/>` : ''}
    ${deboss(c, c - 9 * k, 42 * k, rank.base)}
    ${engraved('23 / 60', c, c + 30 * k, 15 * k, rank.base)}
    ${finish(id, c, c, r, rank, body, k)}</svg>`;
}

/** 4 — pure wax. No geometry at all; rank is material and pour. */
function pureWax(id, tier, size) {
  const rank = RANKS[tier], c = size / 2, k = size / 132, r = c - size * 0.075;
  const s = shell(id, rank, size);
  const body = outline(c, c, r, 8 * k, !rank.wax);
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs>${s.defs}</defs>
    ${rank.orn >= 2 ? tail(c, c, r, shade(rank.base, -0.35)) : ''}
    <path d="${outline(c, c + 2.6 * k, r, 8 * k, !rank.wax)}" fill="#000" fill-opacity="0.34"/>
    <path d="${body}" fill="url(#rim-${id})"/>
    <path d="${outline(c, c, r - 6 * k, 5 * k, !rank.wax)}" fill="url(#face-${id})"/>
    ${mottle(c, c, r - 8 * k, rank.base, 5 + rank.orn * 3)}
    ${deboss(c, c - 8 * k, 52 * k, rank.base)}
    ${engraved('23 / 60', c, c + 32 * k, 15 * k, rank.base)}
    ${finish(id, c, c, r, rank, body, k)}</svg>`;
}

/** 5 — the mark *is* the seal. No disc containing a thing. */
function markIsSeal(id, tier, size) {
  const rank = RANKS[tier], c = size / 2, k = size / 132;
  const s = shell(id, rank, size);
  const scale = (size * 0.94) / CANVAS;
  const shape = (grow, fill, extra = '') => `<g transform="translate(${c} ${c}) scale(${(scale * grow).toFixed(4)}) translate(${-CANVAS / 2} ${-CANVAS / 2})">
      <path d="${stampMarkPath()}" fill="${fill}" fill-rule="evenodd" ${extra} transform="rotate(${TILT_DEG} ${CANVAS / 2} ${CANVAS / 2})"/></g>`;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs>${s.defs}</defs>
    <g transform="translate(0 ${2.4 * k})">${shape(1, '#000', 'fill-opacity="0.34"')}</g>
    ${shape(1, `url(#rim-${id})`)}
    ${shape(0.84, `url(#face-${id})`)}
    ${rank.orn >= 2 ? shape(0.84, 'none', `stroke="${shade(rank.base, 0.7)}" stroke-opacity="0.5" stroke-width="${2.2 / (scale * 0.84)}"`) : ''}
    ${rank.orn >= 4 ? shape(0.66, 'none', `stroke="${shade(rank.base, 0.95)}" stroke-opacity="0.7" stroke-width="${2 / (scale * 0.66)}"`) : ''}
    ${engraved('23 / 60', c, c + 6 * k, 19 * k, rank.base)}
    ${shape(1, `url(#spec-${id})`)}</svg>`;
}

const VARIANTS = [
  ['1', 'Cord and laurel', 'A twisted rope border and sprigs that grow with rank. Nothing evenly spaced, nothing radiating — the two things that made a chip.', cordLaurel],
  ['2', 'Lettered rim', `The app's name and the rank set around the edge, engraved. What a real seal or coin does, and <b>text is the one thing a poker chip never has</b>.`, lettered],
  ['3', 'Guilloché', 'The engine-turned wave from banknotes and watch dials. Closed rings, so it cannot read as spokes however dense it gets.', guillocheSeal],
  ['4', 'Pure wax', 'No geometry at all. A poured edge, a mottled surface, a drip. Rank carried entirely by material and by how rich the pour is. ⚠ The furthest from a game and the closest to a passport.', pureWax],
  ['5', 'The mark is the seal', `The outline <i>is</i> the app's stamp mark rather than a disc containing it — which removes the "disc with a thing inside" reading at the root.`, markIsSeal],
];

/* -------------------------------------------------------------------- page */

const STUDY = 132;
const BUTTON = 64;

const row = (draw, size, prefix) =>
  TIERS.map((t) => `<figure>${draw(`${prefix}-${t}`, t, size)}<figcaption>${t}<br><span>${RANKS[t].label}</span></figcaption></figure>`).join('');

const sections = VARIANTS.map(([n, title, note, draw]) => `
<h2>${n} — ${title}</h2>
<p class="note">${note}</p>
<div class="row">${row(draw, STUDY, `S${n}`)}</div>
<div class="row tight">${row(draw, BUTTON, `B${n}`)}</div>`).join('\n');

const html = `<!doctype html>
<meta charset="utf-8">
<title>The rank seal — five vocabularies</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:28px; background:#0E0E10; color:#E8EEF2;
         font:15px/1.6 -apple-system, Segoe UI, Roboto, sans-serif; }
  h1 { font-size:24px; margin:0 0 6px; }
  h2 { font-size:15px; text-transform:uppercase; letter-spacing:1.2px; color:#A0A0A8; margin:40px 0 2px; }
  p { max-width:76ch; } p.note { color:#A0A0A8; margin:0 0 14px; }
  .row { display:flex; flex-wrap:wrap; gap:24px; align-items:flex-end;
         background:#1C1C1E; border-radius:16px; padding:22px; margin-bottom:10px; }
  .row.tight { background:#232326; padding:16px 22px; }
  figure { margin:0; text-align:center; }
  figcaption { font-size:12px; margin-top:9px; }
  figcaption span { color:#A0A0A8; font-size:11px; }
  .map .row { background:#A8C8A0; } .map figcaption { color:#14210F; } .map figcaption span { color:#3C4A36; }
  .grey .row { filter:grayscale(1); }
  b { color:#E8EEF2; } code { color:#5AA9FF; }
</style>

<h1>The rank seal — five vocabularies</h1>
<p>
  <b>The last one was a poker chip and the project lead named exactly why:</b>
  <i>"os pontos na volta e as linhas do centro para fora"</i>. Evenly spaced dots
  around a rim plus radial spokes from the centre is not <i>like</i> a casino
  chip, it <b>is</b> one. Both devices were mine and both are gone.
</p>
<p class="note">
  ⚠ Worth remembering how they got there: they were borrowed from
  <code>stampArt.ts</code>'s own perforation and sunburst, on the reasoning that
  the medal should share the stamps' vocabulary. <b>The reasoning was sound and
  the result was still wrong</b> — a good rule applied without looking produced a
  casino chip.
  <br><br>
  Each variant is shown at study size and then at the <b>real 64 dp button</b>.
  ⚠ The study size flatters everything.
</p>

${sections}

<h2>All five at button size, on green</h2>
<p class="note">
  ⚠ Most of this island is laurel forest. Gold on green is the real test, not gold
  on a neutral panel. Gold and platinum only, since those are the ones that have to
  carry the feeling.
</p>
<div class="map"><div class="row">
${VARIANTS.map(([n, title, , draw]) => `<figure>${draw(`Mg-${n}`, 'gold', BUTTON)}<figcaption>${n} · gold</figcaption></figure>`).join('')}
${VARIANTS.map(([n, title, , draw]) => `<figure>${draw(`Mp-${n}`, 'platinum', BUTTON)}<figcaption>${n} · platinum</figcaption></figure>`).join('')}
</div></div>

<h2>Greyscale — with the colour taken away</h2>
<p class="note">
  ⚠ <b>The test that matters most.</b> If a variant's ranks are only distinguishable
  by hue, then a colour-blind user has one rank and everybody else has five.
</p>
<div class="grey">
${VARIANTS.map(([n, , , draw]) => `<div class="row">${row(draw, 96, `G${n}`)}</div>`).join('')}
</div>
`;

const outDir = path.join(root, 'tools', 'out');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'rank.html'), html);

console.log(`${VARIANTS.length} vocabularies × ${TIERS.length} ranks, at ${STUDY} and ${BUTTON} px, plus green and greyscale`);
console.log('Wrote tools/out/rank.html');

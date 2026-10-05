/**
 * The paywall, the new-stamp moment and first run, drawn as options for the
 * project lead to choose from (D-097, 2026-10-05).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-unlock-options.mjs
 *     → tools/out/unlock-options.html
 *
 * The lead, after the first real purchase: the unlock pop-ups are "a bit
 * weak... too boring", the text should be "more aggressive", a reminder should
 * sit "on the main page or the passport page", the new-stamp pop-up "must be
 * more extravagant", and first run's permission pop-ups are "confusing" and
 * "pretty ugly", with WalkNYC as the model.
 *
 * Every stamp is the real drawing (`stampElements` via svg-render.mjs) of a real
 * place. The frames are phone-sized sketches in HTML and CSS; the animations
 * are CSS, and each has a button to play it again. What is chosen is then
 * built in React Native with its own `Animated`, which needs no new library.
 *
 * Copy is Portuguese in "tu", as the lead rewrote the unlock sheet. Nothing in
 * it is false (D-097's first line): the founder option says what the founder
 * window will be once it is set, and is marked as such.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampSvgWithDesign } from './lib/svg-render.mjs';
import { designFor } from '../app/src/passport/stampArt.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(path.join(here, '..', 'content', 'pois.json'), 'utf8'));
const byId = new Map(pack.places.map((place) => [place.id, place]));

/** The real stamp drawing for a place, collected or not. */
function stamp(id, collected = true) {
  const place = byId.get(id);
  if (place === undefined) throw new Error(`no place ${id}`);
  return stampSvgWithDesign(place.id, designFor(place.id, place.category, place.motif), place.name, collected);
}

const PRICE = '5,99 €';
/** Locked stamps on the lead's own probe: five viewpoints they "have" but cannot see. */
const LOCKED = ['bica-da-cana', 'chao-dos-terreiros', 'miradouro-da-rocha-do-navio', 'pico-dos-barcelos', 'pico-do-facho'];
const SHOWN = ['pico-do-areeiro', 'fanal', 'achada-do-teixeira', 'camara-de-lobos', 'praia-formosa'];
const NEW_STAMP = 'pico-do-areeiro';

/** A phone-shaped frame with a caption under it. */
function phone(caption, inner, { dark = true, id = '' } = {}) {
  return `<figure class="phone-wrap">
    <div class="phone ${dark ? 'dark' : 'light'}" ${id ? `id="${id}"` : ''}>${inner}</div>
    <figcaption>${caption}</figcaption>
  </figure>`;
}

/** A replay button that restarts every CSS animation inside the frame. */
const replay = (id) => `<button class="replay" onclick="replay('${id}')">Repetir animação</button>`;

/** A quiet sketch of the map behind a pop-up: land, sea, and lit roads. */
const MAP_BG = `<svg class="map" viewBox="0 0 360 760" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <rect width="360" height="760" fill="#B9D7EE"/>
  <path d="M-20 260 C60 200 140 230 220 190 S340 170 400 210 L400 640 C320 690 230 650 150 690 S20 700 -20 650 Z" fill="#EEF0E8"/>
  <path d="M30 520 C90 470 130 480 170 420 S260 360 330 330" stroke="#D9D9D2" stroke-width="10" fill="none"/>
  <path d="M60 330 C120 360 160 420 230 450 S300 520 340 560" stroke="#D9D9D2" stroke-width="8" fill="none"/>
  <path d="M30 520 C90 470 130 480 170 420" stroke="#F2A900" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M170 420 C200 400 230 380 262 368" stroke="#F2A900" stroke-width="7" fill="none" stroke-linecap="round"/>
</svg>`;

/** The map screen's controls, drawn at the app's sizes. */
function mapChrome({ badge = null, pulse = false } = {}) {
  return `${MAP_BG}
  <div class="map-top"><div class="chip">A registar automaticamente</div><div class="gear">⚙</div></div>
  <div class="map-progress">60 km hoje</div>
  <div class="map-bottom">
    <div class="passport-btn ${pulse ? 'pulse' : ''}">${stamp('camara-de-lobos')}
      ${badge === null ? '' : `<span class="badge">${badge}</span>`}
    </div>
    <div class="walk-btn">Começar passeio</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// 1. The unlock sheet
// ---------------------------------------------------------------------------

const sheetA = phone(
  '<b>A. Os teus carimbos à espera.</b> Os cinco carimbos que já ganhaste, a cores mas atrás de vidro fosco, com o cadeado a abrir-se em loop. O texto fala de algo que já é teu, não de uma compra.',
  `<div class="scrim"></div>
  <div class="sheet sheet-a">
    <div class="eyebrow">O TEU PASSAPORTE</div>
    <h3>Tens 5 carimbos<br>à tua espera</h3>
    <div class="frost-row">
      ${LOCKED.slice(0, 5).map((id, i) => `<div class="frost" style="--i:${i}">${stamp(id)}</div>`).join('')}
      <div class="lock-open">🔓</div>
    </div>
    <p class="lead">Já lá estiveste. Só falta vê-los.</p>
    <ul class="ticks">
      <li>Todos os carimbos da ilha, para sempre</li>
      <li>Uma medalha por cada conjunto completo</li>
      <li>Pagamento único. Sem subscrição.</li>
    </ul>
    <div class="cta glow-cta">Ver os meus carimbos · ${PRICE}</div>
    <div class="link">Recuperar compra</div>
    <div class="link dim">Agora não</div>
  </div>`,
  { id: 'sheet-a' }
);

const sheetB = phone(
  '<b>B. O passaporte completo.</b> Uma página do passaporte cheia, com os carimbos que faltam a acender um a um, e o preço como etiqueta. Vende a coleção inteira, não os cinco que já tens.',
  `<div class="scrim"></div>
  <div class="sheet sheet-b">
    <div class="price-tag">${PRICE}<small>uma vez</small></div>
    <h3>O teu passaporte,<br>completo</h3>
    <div class="grid-b">
      ${[...SHOWN, ...LOCKED, 'fanal', 'bica-da-cana'].slice(0, 12).map((id, i) => `<div class="cell-b ${i < 5 ? 'on' : 'lights'}" style="--i:${i}">${stamp(id, true)}</div>`).join('')}
    </div>
    <p class="lead">80 lugares da Madeira. Os que já visitaste e todos os que vais visitar.</p>
    <div class="cta">Desbloquear tudo</div>
    <div class="row-links"><span class="link">Recuperar compra</span><span class="link dim">Agora não</span></div>
  </div>`,
  { id: 'sheet-b' }
);

const sheetC = phone(
  '<b>C. Fundador.</b> Abre com o carimbo de fundador, que só existe nos primeiros três meses. Urgência verdadeira: a janela fecha mesmo (D-089). <i>Só pode ser usado quando a data de lançamento estiver definida, e o carimbo de fundador ainda não está desenhado (T-233): aqui é um esboço.</i>',
  `<div class="scrim"></div>
  <div class="sheet sheet-c">
    <div class="founder">
      <div class="founder-rays"></div>
      <div class="founder-seal"><span>FUNDADOR</span><b>2026</b></div>
    </div>
    <h3>Sê fundador</h3>
    <p class="lead">Quem desbloquear até <b>5 de janeiro</b> fica com o carimbo de fundador. Depois disso, nunca mais.</p>
    <ul class="ticks">
      <li>Os teus 5 carimbos à espera, já</li>
      <li>Todos os outros, para sempre</li>
      <li>O carimbo de fundador, só agora</li>
    </ul>
    <div class="cta gold">Quero ser fundador · ${PRICE}</div>
    <div class="row-links"><span class="link">Recuperar compra</span><span class="link dim">Agora não</span></div>
  </div>`,
  { id: 'sheet-c' }
);

// ---------------------------------------------------------------------------
// 2. Reminders outside Settings
// ---------------------------------------------------------------------------

const reminderPassport = phone(
  '<b>R1. No passaporte.</b> Um cartão no topo, por cima dos carimbos, enquanto houver carimbos bloqueados. Sempre lá, nunca a tapar nada. Tocar abre o pop-up escolhido acima.',
  `<div class="pp">
    <div class="pp-top"><span class="back">‹ Mapa</span><span class="share">Partilhar</span></div>
    <div class="pp-title">Passaporte</div>
    <div class="pp-hero"><b>10</b> / 80<br><small>lugares visitados</small></div>
    <div class="nudge">
      <div class="nudge-stack">${LOCKED.slice(0, 3).map((id, i) => `<div class="ns" style="--i:${i}">${stamp(id)}</div>`).join('')}</div>
      <div class="nudge-text"><b>5 carimbos teus à espera</b><span>Desbloqueia e vê-os a cores</span></div>
      <div class="nudge-btn">Ver</div>
    </div>
    <div class="pp-row">MIRADOUROS <span>8 de 19</span></div>
    <div class="pp-stamps">${SHOWN.slice(0, 3).map((id) => `<div class="pps">${stamp(id)}</div>`).join('')}${LOCKED.slice(0, 2).map((id) => `<div class="pps locked">${stamp(id, false)}<span class="lk">🔒</span></div>`).join('')}</div>
  </div>`
);

const reminderMap = phone(
  '<b>R2. No mapa.</b> O botão do passaporte ganha um número dourado com os carimbos à espera, e brilha uma vez quando o número sobe. As estradas ficam limpas. Tocar no número abre o pop-up.',
  mapChrome({ badge: '5', pulse: true }),
  { dark: false, id: 'reminder-map' }
);

// ---------------------------------------------------------------------------
// 3. The new-stamp moment
// ---------------------------------------------------------------------------

const confetti = Array.from({ length: 28 }, (_, i) => {
  const hue = ['#F2A900', '#5AA9FF', '#FF6B6B', '#7ED957', '#FFFFFF'][i % 5];
  const x = (i * 37) % 100;
  const delay = (i % 7) * 0.05;
  const drift = ((i * 53) % 60) - 30;
  return `<i class="cf" style="left:${x}%;background:${hue};--d:${delay}s;--x:${drift}px;--r:${(i * 47) % 360}deg"></i>`;
}).join('');

const earnSlam = phone(
  '<b>E1. Carimbada.</b> O carimbo cai do alto e bate no ecrã com tremor, um anel de tinta a espalhar-se e confetti. Vibração curta no momento do impacto. Por baixo, o progresso: <i>4 de 19 miradouros</i>.',
  `<div class="scrim strong"></div>
  <div class="celebrate">
    <div class="confetti">${confetti}</div>
    <div class="burst-title">NOVO CARIMBO!</div>
    <div class="ink-ring"></div>
    <div class="slam">${stamp(NEW_STAMP)}</div>
    <div class="place">Pico do Areeiro</div>
    <div class="progress"><div class="bar"><i style="--to:21%"></i></div><span>4 de 19 miradouros</span></div>
    <div class="cta">Ver no passaporte</div>
    <div class="link dim">Fechar</div>
  </div>`,
  { id: 'earn-slam' }
);

const earnRays = phone(
  '<b>E2. Raios dourados.</b> Raios a rodar atrás do carimbo, que entra a girar e assenta com brilho. O número do passaporte sobe à frente dos olhos (9 → 10). Mais solene que E1.',
  `<div class="scrim strong"></div>
  <div class="celebrate">
    <div class="rays"></div>
    <div class="burst-title gold-text">NOVO CARIMBO!</div>
    <div class="spin-in">${stamp(NEW_STAMP)}</div>
    <div class="place">Pico do Areeiro</div>
    <div class="counter"><span class="old">9</span><span class="new">10</span> / 80</div>
    <div class="cta gold">Ver no passaporte</div>
    <div class="link dim">Fechar</div>
  </div>`,
  { id: 'earn-rays' }
);

const earnLocked = phone(
  '<b>E3. Um carimbo bloqueado, no mesmo momento.</b> A mesma festa (aqui com E1), mas o carimbo chega a cores e fica atrás de vidro fosco com um cadeado. É o momento em que mais vale a pena oferecer: acabaste de lá estar.',
  `<div class="scrim strong"></div>
  <div class="celebrate">
    <div class="confetti">${confetti}</div>
    <div class="burst-title">NOVO CARIMBO!</div>
    <div class="ink-ring"></div>
    <div class="slam frosted">${stamp('bica-da-cana')}<span class="lock-big">🔒</span></div>
    <div class="place">Bica da Cana</div>
    <p class="lead">É teu. Desbloqueia para o ver a cores, a ele e aos outros 4 à espera.</p>
    <div class="cta glow-cta">Desbloquear · ${PRICE}</div>
    <div class="link dim">Agora não</div>
  </div>`,
  { id: 'earn-locked' }
);

// ---------------------------------------------------------------------------
// 4. First run, after WalkNYC
// ---------------------------------------------------------------------------

/** One onboarding card: a big drawing, a step count, one button. */
function onboard(step, art, title, body, next, button, secondary) {
  return `<div class="ob">
    <div class="ob-steps">${[1, 2, 3].map((n) => `<i class="${n <= step ? 'on' : ''}"></i>`).join('')}<span>${step} de 3</span></div>
    <div class="ob-art">${art}</div>
    <h3>${title}</h3>
    <p>${body}</p>
    ${next === null ? '' : `<div class="ob-next"><div class="ob-next-label">A seguir, o Android pergunta:</div>${next}</div>`}
    <div class="cta">${button}</div>
    ${secondary === null ? '' : `<div class="link dim">${secondary}</div>`}
  </div>`;
}

/** A small replica of Android's own dialog, with the right answer marked. */
const androidAsk = (question, options, pick) => `<div class="os">
  <div class="os-q">${question}</div>
  ${options.map((o) => `<div class="os-o ${o === pick ? 'pick' : ''}">${o}${o === pick ? '<b>← escolhe este</b>' : ''}</div>`).join('')}
</div>`;

const ARTS = {
  location: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="#E8F1FB"/><path d="M60 26c-13 0-23 10-23 23 0 17 23 43 23 43s23-26 23-43c0-13-10-23-23-23z" fill="#0A5AAE"/><circle cx="60" cy="49" r="9" fill="#fff"/><path d="M22 86c14-10 26-6 38-14s26-10 38-4" stroke="#F2A900" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
  always: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="#FFF4D6"/><rect x="38" y="22" width="44" height="76" rx="8" fill="#1C1C1E"/><rect x="42" y="30" width="36" height="58" rx="3" fill="#B9D7EE"/><path d="M46 78c8-6 14-2 20-10s10-8 12-6" stroke="#F2A900" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="86" cy="34" r="12" fill="#F2A900"/><path d="M86 28v7l4 3" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
  battery: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="#E7F6EA"/><rect x="36" y="38" width="44" height="44" rx="6" fill="none" stroke="#2E7D32" stroke-width="5"/><rect x="80" y="52" width="6" height="16" rx="2" fill="#2E7D32"/><path d="M60 46l-9 16h9l-4 14 13-19h-9z" fill="#F2A900"/></svg>`,
};

const ob1 = phone(
  '<b>O1. Localização.</b> Um ecrã por pedido, sempre com o mesmo desenho: desenho grande, uma frase, um botão. Mostra antes o que o Android vai perguntar e qual a resposta certa.',
  onboard(1, ARTS.location, 'O teu mapa enche-se sozinho', 'O Bruma acende as estradas por onde passas. Para isso precisa de saber onde estás.', androidAsk('Permitir que o Bruma aceda à localização deste dispositivo?', ['Durante a utilização da app', 'Apenas desta vez', 'Não permitir'], 'Durante a utilização da app'), 'Continuar', 'Agora não'),
  { dark: false }
);

const ob2 = phone(
  '<b>O2. Sempre.</b> O pedido que mais importa, com o aviso que a Play exige já incluído (para que serve, que nunca sai do telemóvel). Mostra o ecrã do Android onde se escolhe <i>Permitir sempre</i>.',
  onboard(2, ARTS.always, 'Mesmo com o telemóvel no bolso', 'Para registar sem teres de abrir a app, o Bruma usa a localização em segundo plano. Fica só neste telemóvel. Nunca é enviada nem vendida.', androidAsk('Permitir que o Bruma aceda à localização deste dispositivo?', ['Permitir sempre', 'Permitir apenas durante a utilização da app', 'Não permitir'], 'Permitir sempre'), 'Abrir definições', 'Prefiro iniciar eu'),
  { dark: false }
);

const ob3 = phone(
  '<b>O3. Bateria.</b> O pedido para o Android não parar a app, com o diálogo de um toque em vez da lista de definições (como a WalkNYC). Termina com um ecrã de "tudo pronto".',
  onboard(3, ARTS.battery, 'Não deixes o Android parar o registo', 'Alguns telemóveis fecham apps para poupar bateria, e o teu mapa deixa de se encher. Um toque resolve.', androidAsk('Ignorar as otimizações da bateria?', ['Permitir', 'Recusar'], 'Permitir'), 'Continuar', null),
  { dark: false }
);

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; background: #111113; color: #F2F2F7; }
header, section { padding: 20px; max-width: 1240px; margin: 0 auto; }
section { border-top: 1px solid #2C2C2E; }
h1 { font-size: 22px; margin: 0 0 8px; } h2 { font-size: 19px; margin: 0 0 6px; }
.note { color: #AEAEB2; max-width: 820px; margin: 0 0 14px; }
.lines { color: #FFD479; }
.row { display: flex; flex-wrap: wrap; gap: 26px; align-items: flex-start; }
.phone-wrap { margin: 0; width: 300px; }
.phone-wrap figcaption { color: #C7C7CC; font-size: 13.5px; margin-top: 10px; }
.phone { position: relative; width: 300px; height: 634px; border-radius: 34px; overflow: hidden; border: 8px solid #2C2C2E; background: #1C1C1E; font-size: 13px; }
.phone.light { background: #F7F7F5; color: #1C1C1E; }
.phone svg { display: block; }
.replay { margin-top: 8px; background: #2C2C2E; color: #F2F2F7; border: 0; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
.map { position: absolute; inset: 0; width: 100%; height: 100%; }
.map-top { position: absolute; top: 16px; left: 12px; right: 12px; display: flex; justify-content: space-between; align-items: center; }
.chip { background: #fff; color: #1C1C1E; border-radius: 20px; padding: 6px 10px; font-size: 11px; box-shadow: 0 1px 4px #0003; }
.gear { background: #fff; color: #1C1C1E; border-radius: 50%; width: 34px; height: 34px; display: grid; place-items: center; box-shadow: 0 1px 4px #0003; }
.map-progress { position: absolute; top: 60px; left: 12px; background: #fff; color: #1C1C1E; border-radius: 14px; padding: 4px 10px; font-size: 11px; font-weight: 600; box-shadow: 0 1px 4px #0003; }
.map-bottom { position: absolute; bottom: 18px; left: 12px; right: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
.passport-btn { position: relative; width: 74px; height: 74px; }
.passport-btn svg { width: 100%; height: 100%; }
.passport-btn .badge { position: absolute; top: -6px; right: -6px; background: linear-gradient(#FFD45C, #E59A00); color: #1C1C1E; font-weight: 800; border-radius: 14px; min-width: 28px; height: 28px; display: grid; place-items: center; border: 2px solid #fff; box-shadow: 0 2px 6px #0005; font-size: 14px; }
.pulse .badge { animation: badge 1.6s ease-in-out 0.4s 2; }
@keyframes badge { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 #F2A90099; } 50% { transform: scale(1.25); box-shadow: 0 0 0 12px #F2A90000; } }
.walk-btn { background: #0A5AAE; color: #fff; border-radius: 26px; padding: 14px 18px; font-weight: 700; font-size: 13px; }
.scrim { position: absolute; inset: 0; background: linear-gradient(#0008, #000c); }
.scrim.strong { background: radial-gradient(circle at 50% 38%, #2a2a2ecc, #000000ee); }
.sheet { position: absolute; left: 10px; right: 10px; bottom: 10px; border-radius: 26px; padding: 18px 18px 12px; text-align: center; }
.sheet h3 { font-size: 24px; line-height: 1.12; margin: 6px 0 10px; font-weight: 800; letter-spacing: -0.3px; }
.eyebrow { font-size: 11px; letter-spacing: 1.6px; color: #FFD479; font-weight: 700; }
.lead { margin: 8px 0; color: #E5E5EA; font-size: 14px; }
.ticks { list-style: none; padding: 0; margin: 10px 0 12px; text-align: left; font-size: 13px; }
.ticks li { padding: 4px 0 4px 26px; position: relative; }
.ticks li::before { content: "✓"; position: absolute; left: 4px; color: #7ED957; font-weight: 800; }
.cta { background: #5AA9FF; color: #111; font-weight: 800; border-radius: 16px; padding: 15px 10px; font-size: 15px; margin-top: 8px; }
.cta.gold { background: linear-gradient(#FFD45C, #E59A00); }
.glow-cta { animation: ctaglow 2.2s ease-in-out infinite; }
@keyframes ctaglow { 0%,100% { box-shadow: 0 0 0 0 #5AA9FF00; } 50% { box-shadow: 0 0 22px 2px #5AA9FFaa; } }
.link { color: #5AA9FF; padding: 10px 0 2px; font-size: 14px; }
.link.dim { color: #8E8E93; }
.row-links { display: flex; justify-content: space-around; }
.sheet-a { background: linear-gradient(170deg, #2b2340, #17171b 55%); border: 1px solid #ffffff1a; }
.frost-row { position: relative; display: flex; justify-content: center; margin: 8px 0 4px; height: 96px; }
.frost { width: 70px; height: 70px; margin: 0 -10px; transform: rotate(calc((var(--i) - 2) * 9deg)) translateY(calc(var(--i) * 3px % 9px)); filter: blur(2.6px) saturate(1.2); opacity: 0.95; animation: tease 3s ease-in-out infinite; animation-delay: calc(var(--i) * 0.25s); }
.frost svg { width: 100%; height: 100%; }
@keyframes tease { 0%,100% { filter: blur(2.6px) saturate(1.2); } 50% { filter: blur(1.2px) saturate(1.4); } }
.lock-open { position: absolute; top: 24px; font-size: 34px; animation: lock 3s ease-in-out infinite; text-shadow: 0 2px 10px #000; }
@keyframes lock { 0%,60%,100% { transform: scale(1) rotate(0); } 70% { transform: scale(1.2) rotate(-12deg); } 80% { transform: scale(1.15) rotate(10deg); } }
.sheet-b { background: #1C1C1E; border: 1px solid #ffffff14; }
.price-tag { position: absolute; top: -14px; right: 18px; background: linear-gradient(#FFD45C, #E59A00); color: #1C1C1E; font-weight: 900; font-size: 20px; padding: 8px 12px 6px; border-radius: 10px; transform: rotate(6deg); box-shadow: 0 6px 14px #0007; line-height: 1; }
.price-tag small { display: block; font-size: 10px; font-weight: 700; }
.grid-b { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; margin: 6px 0; }
.cell-b { aspect-ratio: 1; }
.cell-b svg { width: 100%; height: 100%; }
.cell-b.lights { filter: grayscale(1) brightness(0.5); animation: light 4s ease-in-out infinite; animation-delay: calc((var(--i) - 5) * 0.35s); }
@keyframes light { 0%,15% { filter: grayscale(1) brightness(0.5); } 30%,80% { filter: none; } 100% { filter: grayscale(1) brightness(0.5); } }
.sheet-c { background: linear-gradient(175deg, #3a2a08, #17171b 60%); border: 1px solid #F2A90055; }
.founder { position: relative; height: 128px; display: grid; place-items: center; }
.founder-rays { position: absolute; width: 230px; height: 230px; background: repeating-conic-gradient(#F2A90033 0 8deg, transparent 8deg 20deg); border-radius: 50%; animation: spin 18s linear infinite; mask: radial-gradient(circle, #000 30%, transparent 70%); }
.founder-seal { position: relative; width: 104px; height: 104px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #FFE08A, #D08A00 70%); border: 4px double #7A4A00; display: grid; place-items: center; align-content: center; color: #3a2200; box-shadow: 0 6px 20px #F2A90066; }
.founder-seal span { font-size: 11px; letter-spacing: 1.5px; font-weight: 800; } .founder-seal b { font-size: 22px; }
@keyframes spin { to { transform: rotate(360deg); } }
.pp { position: absolute; inset: 0; background: #1C1C1E; padding: 14px; }
.pp-top { display: flex; justify-content: space-between; color: #5AA9FF; font-size: 13px; }
.pp-title { font-size: 26px; font-weight: 800; margin: 8px 0 4px; }
.pp-hero { text-align: center; font-size: 15px; color: #AEAEB2; margin-bottom: 10px; } .pp-hero b { font-size: 40px; color: #F2F2F7; }
.nudge { display: flex; align-items: center; gap: 10px; background: linear-gradient(120deg, #3a2a08, #2b2340); border: 1px solid #F2A90066; border-radius: 18px; padding: 10px 12px; margin: 6px 0 14px; box-shadow: 0 6px 18px #0006; }
.nudge-stack { position: relative; width: 62px; height: 52px; flex: none; }
.ns { position: absolute; width: 44px; height: 44px; left: calc(var(--i) * 9px); top: calc(var(--i) * 2px); transform: rotate(calc((var(--i) - 1) * 10deg)); filter: blur(1.4px); }
.ns svg { width: 100%; height: 100%; }
.nudge-text { flex: 1; text-align: left; display: flex; flex-direction: column; } .nudge-text b { font-size: 14px; } .nudge-text span { font-size: 12px; color: #D1D1D6; }
.nudge-btn { background: linear-gradient(#FFD45C, #E59A00); color: #1C1C1E; font-weight: 800; border-radius: 12px; padding: 9px 12px; }
.pp-row { display: flex; justify-content: space-between; font-size: 12px; letter-spacing: 1px; color: #AEAEB2; font-weight: 700; margin: 4px 0; }
.pp-stamps { display: flex; flex-wrap: wrap; gap: 4px; } .pps { width: 82px; height: 82px; position: relative; } .pps svg { width: 100%; height: 100%; }
.pps.locked .lk { position: absolute; right: 6px; bottom: 6px; font-size: 15px; }
.celebrate { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: 34px 18px 16px; text-align: center; }
.burst-title { font-size: 26px; font-weight: 900; letter-spacing: 1px; animation: pop 0.5s cubic-bezier(.2,1.6,.4,1) 0.55s both; }
.gold-text { background: linear-gradient(#FFE08A, #E59A00); -webkit-background-clip: text; background-clip: text; color: transparent; }
@keyframes pop { from { transform: scale(0.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.slam { width: 190px; height: 190px; margin-top: 18px; position: relative; animation: slam 0.55s cubic-bezier(.5,0,.75,0) both, shake 0.35s 0.55s both; }
.slam svg { width: 100%; height: 100%; }
@keyframes slam { from { transform: scale(3) rotate(-25deg); opacity: 0; } to { transform: scale(1) rotate(-4deg); opacity: 1; } }
@keyframes shake { 0%,100% { translate: 0 0; } 20% { translate: -6px 3px; } 40% { translate: 5px -4px; } 60% { translate: -4px 2px; } 80% { translate: 3px -1px; } }
.ink-ring { position: absolute; top: 120px; width: 200px; height: 200px; border-radius: 50%; border: 6px solid #F2A900; opacity: 0; animation: ring 0.9s ease-out 0.55s both; }
@keyframes ring { 0% { transform: scale(0.6); opacity: 0; } 1% { opacity: 0.9; } 100% { transform: scale(1.8); opacity: 0; } }
.confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.cf { position: absolute; top: 34%; width: 8px; height: 13px; border-radius: 2px; opacity: 0; animation: cf 1.6s cubic-bezier(.2,.7,.4,1) calc(0.55s + var(--d)) both; }
@keyframes cf { 0% { opacity: 0; transform: translate(0, 0) rotate(0); } 1% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--x), 360px) rotate(calc(var(--r) + 540deg)); } }
.place { font-size: 22px; font-weight: 800; margin-top: 12px; animation: pop 0.4s ease-out 0.8s both; }
.progress { width: 100%; margin: 12px 0 4px; font-size: 13px; color: #D1D1D6; animation: pop 0.4s ease-out 0.95s both; }
.bar { height: 8px; background: #3A3A3C; border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
.bar i { display: block; height: 100%; width: var(--to); background: linear-gradient(90deg, #F2A900, #FFD45C); animation: fill 0.9s ease-out 1.1s both; }
@keyframes fill { from { width: 16%; } }
.celebrate .cta, .celebrate .link { width: 100%; animation: pop 0.4s ease-out 1.1s both; }
.rays { position: absolute; top: 40px; width: 420px; height: 420px; background: repeating-conic-gradient(#F2A90040 0 9deg, transparent 9deg 22deg); border-radius: 50%; mask: radial-gradient(circle, #000 25%, transparent 65%); animation: spin 14s linear infinite, pop 0.6s ease-out both; }
.spin-in { width: 190px; height: 190px; margin-top: 18px; position: relative; animation: spinin 1s cubic-bezier(.2,1.3,.4,1) 0.2s both; filter: drop-shadow(0 0 18px #F2A90088); }
.spin-in svg { width: 100%; height: 100%; }
@keyframes spinin { from { transform: scale(0) rotate(-540deg); } to { transform: scale(1) rotate(-4deg); } }
.counter { font-size: 18px; color: #D1D1D6; margin: 10px 0; position: relative; height: 32px; animation: pop 0.4s ease-out 1s both; }
.counter .old, .counter .new { display: inline-block; font-size: 28px; font-weight: 900; color: #F2F2F7; }
.counter .old { position: absolute; margin-left: -4px; animation: out 0.4s ease-in 1.5s both; } .counter .new { animation: in 0.4s ease-out 1.7s both; }
@keyframes out { to { transform: translateY(-20px); opacity: 0; } } @keyframes in { from { transform: translateY(20px); opacity: 0; } }
.frosted svg { filter: blur(3px) saturate(1.3); }
.lock-big { position: absolute; inset: 0; display: grid; place-items: center; font-size: 46px; text-shadow: 0 4px 14px #000; animation: lock 2.4s ease-in-out 1.4s infinite; }
.ob { position: absolute; inset: 0; padding: 18px 18px 14px; display: flex; flex-direction: column; text-align: center; background: #F7F7F5; color: #1C1C1E; }
.ob-steps { display: flex; gap: 6px; align-items: center; justify-content: center; font-size: 11px; color: #636366; }
.ob-steps i { width: 26px; height: 5px; border-radius: 3px; background: #D1D1D6; } .ob-steps i.on { background: #0A5AAE; } .ob-steps span { margin-left: 6px; }
.ob-art { width: 132px; height: 132px; margin: 18px auto 8px; } .ob-art svg { width: 100%; height: 100%; }
.ob h3 { font-size: 22px; line-height: 1.15; margin: 4px 0 8px; font-weight: 800; }
.ob p { margin: 0 0 10px; color: #3A3A3C; font-size: 14px; }
.ob-next { margin-top: auto; margin-bottom: 8px; } .ob-next-label { font-size: 11px; color: #636366; margin-bottom: 4px; }
.os { background: #fff; border-radius: 14px; padding: 10px 12px; box-shadow: 0 2px 10px #0002; text-align: left; font-size: 11.5px; }
.os-q { font-weight: 700; margin-bottom: 6px; }
.os-o { padding: 5px 6px; border-radius: 8px; color: #0A5AAE; }
.os-o.pick { background: #E8F1FB; font-weight: 700; } .os-o b { float: right; color: #E59A00; font-size: 10.5px; }
.ob .cta { background: #0A5AAE; color: #fff; }
.ob .link.dim { color: #636366; }
.bug { background: #3a1d1d; border: 1px solid #ff6b6b55; border-radius: 12px; padding: 10px 14px; color: #FFD0D0; max-width: 820px; }
`;

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bruma: opções para o paywall, o novo carimbo e a primeira utilização</title><style>${CSS}</style></head><body>
<header>
  <h1>Opções: paywall, lembretes, novo carimbo e primeira utilização (D-097)</h1>
  <p class="note">Desenhos para escolher e vetar, como nas outras páginas de opções. Carimbos e lugares reais; preço como a Google o mostra. Os pop-ups em cima de cada telefone são esboços: o escolhido é depois construído na app com animações do próprio React Native, sem bibliotecas novas.</p>
  <p class="note lines">Linhas que ficam (D-097): nada falso (sem contagens decrescentes inventadas), sem notificações a pedir compras, nada por cima das estradas do mapa.</p>
</header>

<section>
  <h2>1. O pop-up para desbloquear</h2>
  <p class="note">Hoje: fundo escuro, um carimbo apagado, quatro linhas cinzentas. As três direções abaixo usam cor, movimento e texto mais forte. Escolhe uma, ou mistura (por exemplo o vidro fosco de A com o preço de B).</p>
  <div class="row">${sheetA}${sheetB}${sheetC}</div>
</section>

<section>
  <h2>2. Lembretes fora das Definições</h2>
  <p class="note">Depois de um primeiro "Agora não", o pedido fica visível em dois sítios, sem tapar o mapa. Podem ser os dois.</p>
  <div class="row">${reminderPassport}<div>${reminderMap}${replay('reminder-map')}</div></div>
</section>

<section>
  <h2>3. Novo carimbo: mais extravagante</h2>
  <p class="note">Hoje: um cartão escuro com "Novo selo", o carimbo e dois botões. Abaixo, duas festas (E1, E2) e a versão para um carimbo bloqueado (E3), que é também o terceiro lembrete. Carrega em "Repetir animação" para ver o movimento outra vez.</p>
  <div class="row">
    <div>${earnSlam}${replay('earn-slam')}</div>
    <div>${earnRays}${replay('earn-rays')}</div>
    <div>${earnLocked}${replay('earn-locked')}</div>
  </div>
</section>

<section>
  <h2>4. Primeira utilização, à maneira da WalkNYC</h2>
  <p class="note">Hoje: ecrãs com desenhos diferentes, e pedidos do Android que aparecem sem aviso. Proposta: três ecrãs iguais na forma, com o passo (1 de 3), um desenho grande, uma frase, um botão, e uma réplica do diálogo do Android com a resposta certa marcada. O pedido "Sempre" passa a ser feito logo na primeira utilização, como na WalkNYC (hoje espera 12 horas, D-008).</p>
  <p class="bug">Registado à parte: um dos pedidos desapareceu sozinho antes de o poderes aceitar. Vou investigar a causa na app (provavelmente dois ecrãs a competir no arranque) antes de mexer no desenho.</p>
  <div class="row" style="margin-top:14px">${ob1}${ob2}${ob3}</div>
</section>
<script>
function replay(id) {
  const el = document.getElementById(id);
  const clone = el.cloneNode(true);
  el.parentNode.replaceChild(clone, el);
}
</script>
</body></html>`;

const out = path.join(here, 'out');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'unlock-options.html'), html);
console.log(`Wrote ${path.join('tools', 'out', 'unlock-options.html')} (${Math.round(html.length / 1024)} kB)`);

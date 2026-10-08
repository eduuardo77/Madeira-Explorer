/**
 * Every screen of the installed app, captured from a real phone onto one page
 * for the project lead to mark what grates (T-263).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/capture-visual-pass.mjs [--serial XPH…]
 *     → tools/out/visual-pass/*.png and tools/out/visual-pass.html
 *
 * It walks the app the way `smoke-release.mjs` does, by label, and presses
 * nothing that changes anything: no buy button, no share, no erase. WalkNYC's
 * equivalent sits beside a screen where one was captured (`tools/out/walknyc/`).
 *
 * ⚠ The captures are the phone's real screens, so the map shows the lead's own
 * movements (D-016). The page stays in `tools/out/`, which is never committed;
 * do not publish it.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { device, pause } from './lib/device.mjs';
import { findNode } from './lib/uiTree.mjs';
import { labels, phoneLanguage } from './lib/labels.mjs';

const PKG = 'com.proa.madeira';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out', 'visual-pass');
const walknyc = path.join(here, 'out', 'walknyc');

const serialAt = process.argv.indexOf('--serial');
const serial = serialAt === -1 ? null : process.argv[serialAt + 1];
const { shell, screen, reach, tap, size, screenshot, fingerprint, readable } = device(serial);
const { label, pattern } = labels(phoneLanguage(shell));

const MAP = label('map.a11y.settings');
const PASSPORT = label('passport.title');
const SETTINGS = label('settings.title');

/** What to look at on each screen, from the plan's T-263 and the lead's past remarks. */
const shots = [];

function shoot(id, title, look, pair = null) {
  const file = path.join(out, `${id}.png`);
  screenshot(file);
  shots.push({ id, title, look, pair });
  console.log(`  ${id}: ${title}`);
}

/** Screenshots down a scrolling page until it stops moving, at most `max`. */
async function shootPage(id, title, look, max = 5) {
  shoot(`${id}-1`, title, look);
  const [, height] = size();
  for (let page = 2; page <= max; page += 1) {
    const before = fingerprint();
    // Down the left margin, where no control is (as `device.reach` does).
    shell(`input swipe 20 ${Math.round(height * 0.8)} 20 ${Math.round(height * 0.3)} 400`);
    await pause(900);
    if (fingerprint() === before) return;
    shoot(`${id}-${page}`, `${title}, further down`, '');
  }
}

/** Back to the top of a page: leave it and come back. */
async function reopen(leave, back, open, arrive) {
  await tap(leave);
  await reach(back);
  await tap(open);
  await reach(arrive);
}

mkdirSync(out, { recursive: true });
console.log(`Visual pass: ${PKG} on ${serial ?? 'the attached phone'}.\n`);

// The map, as a launch lands on it; a stamp pop-up is closed with Back while
// nothing can be read (as the smoke test does; Back on the map leaves the app).
shell(`am start -n ${PKG}/.MainActivity`);
await pause(2500);
for (let popUps = 0; !readable() && popUps < 3; popUps += 1) {
  shell('input keyevent 4');
  await pause(1200);
}
await reach(MAP, { timeoutMs: 20_000 });
await pause(2500); // the roads draw after the map shows
shoot('map', 'The map, the home', 'The lit roads, the controls, the count of places. Does anything compete with the roads?');

// Settings and what opens from it.
await tap(MAP);
await reach(SETTINGS);
await shootPage('settings', 'Settings', 'Type sizes, the light surface, the order of sections.');
await reopen(label('settings.a11y.backToMap'), MAP, MAP, SETTINGS);
await tap(label('settings.about.privacy'), { scroll: true });
await pause(800);
shoot('privacy', 'The privacy policy', 'Long text: is it readable at this size?');
await tap(label('privacy.a11y.back'));
await reach(SETTINGS);
try {
  await reach(label('settings.passport.unlock'), { scroll: true });
  await tap(label('settings.passport.unlock'));
  await pause(1800);
  shoot('unlock', 'The unlock sheet', 'What is offered and for how much; the animation caught mid-way.');
  shell('input keyevent 4');
  await pause(1200);
} catch {
  console.log('  unlock: not offered on this build');
}
await tap(label('settings.about.licences'), { scroll: true });
await pause(800);
shoot('licences', 'Licences', 'Only needs to be tidy.');
await tap(label('licences.a11y.back'));
await reach(SETTINGS);
await tap(label('settings.a11y.backToMap'));
await reach(MAP);

// The passport and everything in it.
const OPEN_PASSPORT = pattern('passport.a11y.openWithCount', 'map.a11y.openPassport');
await tap(OPEN_PASSPORT);
await reach(PASSPORT);
await pause(1200);
await shootPage('passport', 'The passport', 'The dark album: stamps, medals, the trips list, the stats line.', 8);
await reopen(label('passport.a11y.backToMap'), MAP, OPEN_PASSPORT, PASSPORT);

const collected = pattern('passport.a11y.stampCollected');
const uncollected = pattern('passport.a11y.stampUncollected', 'passport.locked.a11y');
try {
  await tap(collected, { scroll: true });
  await pause(1500);
  shoot('trophy', 'A collected stamp, its trophy', 'Is the shine visible enough? (the plan asks this one by name)');
  shell('input keyevent 4');
  await reach(collected);
} catch {
  console.log('  trophy: no stamp collected on this phone');
}
await reopen(label('passport.a11y.backToMap'), MAP, OPEN_PASSPORT, PASSPORT);
await tap(uncollected, { scroll: true });
await reach(label('placeCard.showOnMap'));
await pause(600);
shoot('card', 'A place card, not yet collected', 'The why-go line, the municipality, the dark sheet over the album.');
await tap(label('common.close'));
await reach(PASSPORT);
await reopen(label('passport.a11y.backToMap'), MAP, OPEN_PASSPORT, PASSPORT);

// The trip: the viewer, a second day, the timelapse.
if (findNode(await screen(), label('replay.watch')) !== null) {
  await tap(label('replay.watch'));
  await reach(label('trip.a11y.back'), { timeoutMs: 20_000 });
  await pause(2500);
  const viewerPair = existsSync(path.join(walknyc, 'viewer-long-walk.png')) ? 'viewer-long-walk.png' : null;
  shoot('viewer', 'The trip viewer, a day page', 'The day’s roads bright, the others dim; the arrows; the stamps of the day.', viewerPair);
  if (findNode(await screen(), label('trip.a11y.previous')) !== null) {
    await tap(label('trip.a11y.previous'));
    await pause(2500);
    shoot('viewer-day', 'The trip viewer, another day', '', existsSync(path.join(walknyc, 'viewer-short-walk.png')) ? 'viewer-short-walk.png' : null);
  }
  await tap(label('trip.a11y.replay'));
  await pause(5000);
  shoot('timelapse-mid', 'The timelapse, playing', 'The line as it draws; the date and the counter.');
  await reach(label('replay.close'), { timeoutMs: 25_000 });
  await pause(1500);
  shoot('timelapse-end', 'The timelapse, at its end', 'Framed on the whole trip? (T-253)');
  await tap(label('replay.close'));
  await tap(label('trip.a11y.back'), { timeoutMs: 20_000 });
  await reach(PASSPORT);
}
await tap(label('passport.a11y.backToMap'));
await reach(MAP);

// The page: each capture scaled to 360 px wide, embedded so it opens on its own.
function small(file) {
  const png = readFileSync(file);
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}"><image width="${w}" height="${h}" xlink:href="data:image/png;base64,${png.toString('base64')}"/></svg>`;
  const scaled = new Resvg(svg, { fitTo: { mode: 'width', value: 360 } }).render().asPng();
  return `data:image/png;base64,${Buffer.from(scaled).toString('base64')}`;
}

const extras = ['share-sheet.png', 'shared-image.png'].filter((name) => existsSync(path.join(walknyc, name)));
const figure = (src, caption) => `<figure><img src="${src}" alt=""><figcaption>${caption}</figcaption></figure>`;
const rows = shots.map(({ id, title, look, pair }, index) => `
<section><h3>${index + 1}. ${title}</h3>${look ? `<p>${look}</p>` : ''}<div class="row">
${figure(small(path.join(out, `${id}.png`)), 'Bruma')}
${pair ? figure(small(path.join(walknyc, pair)), 'WalkNYC') : ''}
</div></section>`);
writeFileSync(
  path.join(here, 'out', 'visual-pass.html'),
  `<!doctype html><meta charset="utf-8"><title>Visual pass</title>
<style>body{margin:0;padding:24px;background:#16191d;color:#e8e8e8;font-family:system-ui,sans-serif;line-height:1.45}
h2{margin-top:0}section{margin:0 0 36px}h3{margin:0 0 4px}p{margin:0 0 10px;color:#b8bec6;max-width:760px}
.row{display:flex;gap:20px;flex-wrap:wrap}figure{margin:0}img{width:360px;max-width:100%;border-radius:12px;display:block}
figcaption{margin-top:6px;color:#8a929c;font-size:14px}</style>
<h2>T-263: every screen, from the P30 (${new Date().toISOString().slice(0, 10)})</h2>
<p>Say what grates by number, for example “7: the stats line is too small”. Each mark becomes a small
fix. Not on this page: the first-run screens and the empty states, which need a phone with no trip.</p>
${rows.join('')}
${extras.length ? `<section><h3>WalkNYC’s sharing, for reference</h3><div class="row">${extras.map((name) => figure(small(path.join(walknyc, name)), `WalkNYC, ${name.replace('.png', '').replace('-', ' ')}`)).join('')}</div></section>` : ''}`
);
console.log('\ntools/out/visual-pass.html');

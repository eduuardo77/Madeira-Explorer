/**
 * The whole product, on one page, so it can be looked at (2026-08-18).
 *
 *     node tools/preview-tour.mjs
 *     → tools/out/tour.html
 *
 * ⚠ **Written because the project lead said the thing that matters most:**
 * *"It's hard to imagine it without a visual reference of what is becoming."*
 * Everything in this repository that can be *seen* is scattered across three
 * preview tools, a workbench that needs a dev server, and a folder of emulator
 * screenshots nobody has an index of. This gathers them.
 *
 * WHAT MAKES IT HONEST
 * --------------------
 * Every artefact is the **real output**, never a mock-up:
 *
 *   - the stamps come from `stampArt.ts` through the shared second renderer;
 *   - the souvenir card is `renderShareCardSvg`, the same function that draws
 *     the picture the app shares;
 *   - the film frames are `composeSouvenir` → `frameAt` → `projector`;
 *   - the screenshots are the emulator, unretouched.
 *
 * And every exhibit is labelled with what is actually true of it — **built**,
 * **built but unverified**, or **not built**. A tour that showed only the good
 * half would be the thing this project's honesty rules exist to prevent.
 *
 * ⚠ The page is emitted as `<title>` + `<style>` + body content, with no
 * `<html>`/`<head>`/`<body>` wrapper. That renders fine opened locally *and*
 * is exactly the shape the Artifact publisher wants, so one output serves both
 * and there is no second copy to drift.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.removeAllListeners('warning');

const { composeSouvenir } = await import('../app/src/souvenir/composition.ts');
const { frameAt, frameTimes } = await import('../app/src/souvenir/frame.ts');
const { buildShareCard, renderShareCardSvg } = await import(
  '../app/src/souvenir/shareCard.ts'
);
const { cleanTrace } = await import('../app/src/map/traceCleanup.ts');
const { stampSvg, escapeXml } = await import('./lib/svg-render.mjs');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'tools', 'out', 'shots');

/** A screenshot, inlined. The page has to survive being sent to somebody. */
function shot(file) {
  const data = readFileSync(path.join(shots, file)).toString('base64');
  return `data:image/png;base64,${data}`;
}

// --- the trace everything is drawn from -------------------------------------

const points = [];
for (const line of readFileSync(
  path.join(root, 'tools/routes/funchal-seafront.txt'),
  'utf8'
).split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) continue;
  const [lat, lon] = trimmed.split(/\s+/).map(Number);
  if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon });
}

const T0 = 1_800_000_000_000;
const fixes = cleanTrace(
  points.map((p, i) => ({ ts: T0 + i * 20_000, lat: p.lat, lon: p.lon, accuracy_m: 10 }))
).fixes;

const stampAt = (fraction, id, name, category) => {
  const fix = fixes[Math.min(fixes.length - 1, Math.floor(fixes.length * fraction))];
  return { placeId: id, name, category, awardedTs: fix.ts, lat: fix.lat, lon: fix.lon };
};

const film = composeSouvenir({
  trace: { fixes, safeToShare: true, reason: 'tour fixture' },
  stamps: [
    stampAt(0.15, 'a', 'First Lookout', 'viewpoint'),
    stampAt(0.4, 'b', 'The Water Walk', 'levada'),
    stampAt(0.62, 'c', 'Old Harbour', 'landmark'),
    stampAt(0.88, 'd', 'Black Beach', 'beach'),
  ],
  totalPlaces: 60,
  gapThresholdMs: 30 * 60 * 1000,
});

if (!film.renderable) {
  console.error(`The film refused to exist: ${film.reason}`);
  process.exit(1);
}

// --- the souvenir still, from the app's own renderer ------------------------

const card = renderShareCardSvg(
  buildShareCard({
    destination: 'Madeira',
    dateRange: '12–19 August 2026',
    collected: 23,
    total: 60,
    strokes: [fixes.map((fix) => [fix.lon, fix.lat])],
    stampNames: [
      'Pico do Areeiro',
      'Levada das 25 Fontes',
      'Câmara de Lobos',
      'Cabo Girão',
      'Fanal',
      'Praia do Porto do Seixal',
      'Pico Ruivo',
      'Monte',
    ],
  })
);

// --- the film, as a strip ---------------------------------------------------

const schedule = frameTimes(film);
const FRAMES = 9;
const { filmFrameSvg } = await import('./lib/svg-render.mjs');
const strip = Array.from({ length: FRAMES }, (_, i) => {
  const at = schedule[Math.round((i * (schedule.length - 1)) / (FRAMES - 1))];
  const frame = frameAt(film, at);
  return `<figure class="cell">
    ${filmFrameSvg(frame, 150, 267)}
    <figcaption>${(at / 1000).toFixed(1)}s · ${frame.kind}${frame.stamps.length > 0 ? ` · ${frame.stamps.length}` : ''}</figcaption>
  </figure>`;
}).join('\n');

// --- the stamps -------------------------------------------------------------

const SHOWCASE = [
  ['viewpoint', 'Pico do Areeiro', true],
  ['levada', 'Levada das 25 Fontes', true],
  ['village', 'Câmara de Lobos', true],
  ['beach', 'Praia Formosa', true],
  ['landmark', 'Forte de São Tiago', true],
  ['viewpoint', 'Cabo Girão', false],
  ['levada', 'Levada do Furado', false],
  ['village', 'Porto Moniz', false],
  ['beach', 'Seixal', false],
  ['landmark', 'Monte', false],
];

const stamps = SHOWCASE.map(
  ([category, name, collected], i) => `<figure class="stamp">
    ${stampSvg(`tour-${i}`, name, category, collected)}
    <figcaption>${escapeXml(name)}</figcaption>
  </figure>`
).join('\n');

// --- the page ---------------------------------------------------------------

const state = (kind, text) => `<span class="state ${kind}">${text}</span>`;

const html = `<title>Proa</title>
<style>
  /* ⚠ The palette is the app's own (app/src/ui/theme.ts), not a scheme invented
     for this page. A visual reference that wears different colours from the
     product it describes is describing something else. Deliberately single
     theme: the app is dark, and the souvenir is dark whatever the user picks. */
  :root {
    --ground: #0E0E10;
    --surface: #1C1C1E;
    --raised: #2C2C2E;
    --line: #3A3A3C;
    --ink: #FFFFFF;
    --muted: #A0A0A8;
    --tint: #5AA9FF;
    --levada: #30D158;
    --village: #FFD60A;
    --landmark: #B5179E;

    --ui: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    /* A logbook register for the page's own voice — Proa is a ship's prow.
       System faces only: the publisher blocks font CDNs, and a silent fallback
       would be worse than choosing the fallback deliberately. */
    --prose: ui-serif, "Iowan Old Style", "Palatino Linotype", Georgia, serif;
    --mono: ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace;
  }

  * { box-sizing: border-box; }

  body {
    background: var(--ground);
    color: var(--ink);
    font-family: var(--ui);
    line-height: 1.55;
    margin: 0;
    padding: clamp(24px, 5vw, 64px) clamp(20px, 5vw, 56px) 96px;
  }

  .wrap { max-width: 1080px; margin: 0 auto; }

  header { border-bottom: 1px solid var(--line); padding-bottom: 32px; }
  h1 {
    font-family: var(--prose);
    font-size: clamp(40px, 7vw, 68px);
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0;
    text-wrap: balance;
  }
  .standfirst {
    font-family: var(--prose);
    font-size: clamp(17px, 2.2vw, 21px);
    color: var(--muted);
    max-width: 60ch;
    margin: 12px 0 0;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 28px;
    margin-top: 28px;
    font-family: var(--mono);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .facts b { color: var(--ink); font-weight: 600; }

  section { border-bottom: 1px solid var(--line); padding: 48px 0; }
  section:last-of-type { border-bottom: 0; }

  .head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px; }
  h2 {
    font-family: var(--prose);
    font-size: clamp(24px, 3.4vw, 32px);
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
  }
  h3 { font-size: 15px; margin: 28px 0 10px; letter-spacing: 0.01em; }

  /* The one structural device, and it encodes the only thing that matters
     about this project: which half of it is real. Not decoration. */
  .state {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .built { background: rgba(48, 209, 88, 0.14); color: var(--levada); }
  .unverified { background: rgba(255, 214, 10, 0.14); color: var(--village); }
  .absent { background: rgba(160, 160, 168, 0.14); color: var(--muted); }

  p { max-width: 64ch; }
  p, li { font-size: 16px; }
  .lede { font-family: var(--prose); font-size: 18px; }
  .muted { color: var(--muted); }

  .exhibit {
    display: grid;
    grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
    gap: clamp(24px, 4vw, 48px);
    align-items: start;
    margin-top: 28px;
  }
  @media (max-width: 760px) { .exhibit { grid-template-columns: 1fr; } }

  /* A phone-shaped frame, so a screenshot is read at the size it is lived at. */
  .phone {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 26px;
    overflow: hidden;
    line-height: 0;
  }
  .phone img { width: 100%; height: auto; display: block; }

  .strip { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; margin-top: 24px; }
  .cell { margin: 0; flex: 0 0 auto; }
  .cell svg { width: 150px; height: 267px; border-radius: 10px; border: 1px solid var(--line); display: block; }

  .stamps { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 24px; }
  .stamp { margin: 0; width: 116px; }
  .stamp svg { width: 116px; height: 116px; display: block; }

  figcaption {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    line-height: 1.4;
    margin-top: 6px;
    text-align: center;
  }

  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; }
  .card svg { width: 100%; height: auto; display: block; }

  .note {
    background: var(--surface);
    border-left: 2px solid var(--tint);
    padding: 14px 18px;
    margin-top: 22px;
    max-width: 66ch;
  }
  .note p { margin: 0; font-size: 15px; }
  .note p + p { margin-top: 8px; }

  ul { max-width: 66ch; padding-left: 20px; }
  li { margin: 8px 0; }
  li b { font-weight: 600; }

  code { font-family: var(--mono); font-size: 0.9em; color: var(--tint); }
  a { color: var(--tint); }
</style>

<div class="wrap">
<header>
  <h1>Proa</h1>
  <p class="standfirst">
    A recorder for a Madeira holiday. You give it permission on day one and put
    the phone in your pocket; on the way home it shows you everywhere you went.
    This page is everything in the project that can currently be looked at.
  </p>
  <div class="facts">
    <span><b>577</b> tests</span>
    <span><b>60</b> curated places</span>
    <span><b>3</b> languages</span>
    <span><b>1</b> emulator</span>
    <span><b>0</b> real devices</span>
    <span><b>0</b> trips ever recorded</span>
  </div>
</header>

<section>
  <div class="head"><h2>The map is the product</h2>${state('built', 'built · seen on an emulator')}</div>
  <div class="exhibit">
    <div class="phone"><img src="${shot('proa-final.png')}" alt="Proa's map screen showing Madeira, with a passport pill reading 0 of 60"></div>
    <div>
      <p class="lede">
        The island, the platform's own cartography, and one pill in the corner
        holding the only number that matters.
      </p>
      <p>
        Google's own points of interest are switched off, so the only marks on
        the map are places <em>you</em> earned. It is deliberately not a
        navigator: there is no <em>Directions</em> button, and there was one for
        a day.
      </p>
      <div class="note">
        <p><b>The trap behind this screen.</b> A grey map with the Google
        wordmark means the API key is wrong. A <em>pure black</em> map means the
        emulator's GPU. They look like the same bug and are not.</p>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="head"><h2>The passport fills in by itself</h2>${state('built', 'built · seen on an emulator')}</div>
  <div class="exhibit">
    <div class="phone"><img src="${shot('first-stamp3.png')}" alt="The passport: five rows of grey stamps with one earned stamp in colour">
    </div>
    <div>
      <p class="lede">
        Five rows that never change — viewpoints, levadas, villages, beaches,
        landmarks — and one stamp in colour.
      </p>
      <p>
        The empty ones are the point as much as the full ones: an uncollected
        stamp is a recommendation. Nothing here was tapped to earn. The app
        noticed, and the sticker appeared.
      </p>
      <div class="note">
        <p><b>This shot predates the curation.</b> It says <code>0 of 15</code>
        levadas and <code>1 of 18</code> landmarks; the pack is now 60 places —
        16 viewpoints, 11 levadas, 16 villages, 7 beaches, 10 landmarks.</p>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="head"><h2>The artwork</h2>${state('built', 'built · drawn by the app itself')}</div>
  <p>
    Every stamp is generated, not drawn by hand: the silhouette, the colourway
    and the emblem all come from the place's own id, so sixty places are sixty
    different stickers and adding a place never means commissioning art. The
    top row is earned; the bottom row is what you have not been to yet.
  </p>
  <div class="stamps">
${stamps}
  </div>
  <div class="note">
    <p><b>What you cannot see here.</b> A stamp you earned but have not paid to
    unlock keeps this same muted drawing and gains a small padlock, with the
    words <em>collected — unlock to see this stamp</em>. It is drawn by the app
    rather than by the artwork module, on purpose: it should vanish the moment
    the purchase works, and that should be a deletion, not a redesign.</p>
  </div>
</section>

<section>
  <div class="head"><h2>The souvenir</h2>${state('built', 'built · shared from an emulator')}</div>
  <div class="exhibit">
    <div class="card">${card}</div>
    <div>
      <p class="lede">
        One image, 9:16, made to be posted. This is the real renderer's output,
        not a mock-up.
      </p>
      <p>
        The trace is the walk as the app cleaned it, so the souvenir cannot
        flatter the map. Where the recording dropped, the line stops — a gap is
        a visible break rather than a straight line across a road nobody proved
        was taken.
      </p>
      <p class="muted">
        Anything within a few hundred metres of where you slept is masked out
        before this is drawn, and there is no way to switch that off.
      </p>
    </div>
  </div>
  <div class="exhibit" style="margin-top:40px">
    <div class="phone"><img src="${shot('share2.png')}" alt="The Android share sheet holding the generated souvenir card"></div>
    <div>
      <p>
        Handed to the ordinary share sheet. Nothing is uploaded — the app has no
        account, no server and no analytics, and the picture goes wherever you
        send it.
      </p>
      <p class="muted">This shot still carries the app's old name.</p>
    </div>
  </div>
</section>

<section>
  <div class="head"><h2>The film</h2>${state('unverified', 'built · never seen moving')}</div>
  <p class="lede">
    The walk draws itself on, the camera follows, and stamps land where you
    earned them. ${(film.durationMs / 1000).toFixed(1)} seconds, ${film.frameRate} frames a second.
  </p>
  <p>
    Nine of ${schedule.length} frames, from the same function the app plays and the
    encoder will one day record. It advances one recorded position at a time
    rather than one minute at a time, so the film spends its length on movement
    instead of on an hour parked outside a restaurant.
  </p>
  <div class="strip">
${strip}
  </div>
  <div class="note">
    <p><b>Two honest problems, both visible above.</b></p>
    <p><b>1 — Nobody has seen it move.</b> Every frame here is correct standing
    still. Whether the pan reads as smooth, whether a stamp pops too fast, and
    whether ten seconds is too long are all unanswered, and only a running app
    answers them.</p>
    <p><b>2 — A portrait frame is the wrong shape for this island.</b> Look at
    the last frames: the walk is a thin band across the middle with the rest
    empty. Most of Madeira's coast roads and levadas run east–west. Either the
    camera turns to follow the route's own axis, or the empty space earns its
    keep, or it stays as it is.</p>
  </div>
</section>

<section>
  <div class="head"><h2>What is not built</h2>${state('absent', 'not built')}</div>
  <p>Named plainly, because a tour of the good half would be a sales pitch.</p>
  <ul>
    <li><b>Nobody can pay.</b> The free tier works — ten stamps, plus your first
      levada whenever you walk it — and there is no purchase behind it yet.</li>
    <li><b>The film is not a file.</b> It plays in the app; it cannot be
      exported. That needs a native encoder and an Android phone.</li>
    <li><b>Nothing has run on real hardware.</b> Battery, surviving in your
      pocket overnight, and whether the geofences fire on a real walk are all
      unknown. An emulator cannot answer any of them.</li>
    <li><b>No one has completed a trip with it.</b> Not one. Every route this
      project has ever drawn was replayed into an emulator.</li>
    <li><b>The German is unreviewed.</b> The app speaks three languages and
      nobody here speaks the third.</li>
  </ul>
</section>
</div>
`;

const outDir = path.join(root, 'tools', 'out');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'tour.html');
writeFileSync(out, html);

console.log(
  `${(html.length / 1024 / 1024).toFixed(2)} MB · ${SHOWCASE.length} stamps · ${FRAMES} of ${schedule.length} frames · 3 screenshots`
);
console.log('Wrote tools/out/tour.html');

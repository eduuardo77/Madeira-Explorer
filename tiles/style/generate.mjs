/**
 * Generate the app's map styles from the official Protomaps basemap theme
 * (T-058 light, T-139 dark).
 *
 *     node tiles/style/generate.mjs
 *
 * Writes `light.json` and `dark.json` next to itself. THOSE FILES ARE
 * GENERATED — never hand-edit them. Every deliberate styling decision lives in
 * this file, as either a flavor override or an entry in the subtraction list,
 * so the "why" survives regeneration and package upgrades.
 *
 * THE METHOD (T-058, D-026, design brief §2)
 * ------------------------------------------
 * Start from an existing permissively-licensed style and SUBTRACT. Authoring
 * cartography from a blank file is the mistake that stalled the design phase
 * once already. `@protomaps/basemaps` (BSD-3-Clause — licence verified
 * 2026-08-10) generates the full 70-layer style for the exact schema our pack
 * is built from (D-030), parameterised by a "flavor": a flat table of colours.
 * We override colours to quiet the map, and delete the layers that compete
 * with the one thing this map exists to show — the user's own trace.
 *
 * WHAT IS DELIBERATELY QUIET, AND WHY
 * -----------------------------------
 * The quality bar (design brief §2.3): the visited trace must be unambiguously
 * the brightest thing on screen, and label load must stay low enough that the
 * island's shape carries the composition. So:
 *
 *   - No buildings. Figure-ground comes from terrain (D-026); OSM building
 *     coverage outside Funchal is patchy anyway. (Terrain itself is T-058a.)
 *   - No basemap POIs. Our POIs are the reward content (T-066) and will be
 *     drawn by the app; two competing sets of pins would be noise.
 *   - No road labels, no shields, no one-way arrows, no addresses. This is not
 *     a navigation app (D-018).
 *   - Labels are city/town/village names and island names only. Place names
 *     render in Portuguese — owning the tiles means Câmara de Lobos is not
 *     "localised" away (design brief §6.5). The app's UI is English; place
 *     names are not UI.
 *   - No administrative boundaries. One island; parish lines are noise.
 *   - Saturation lives with the trace. Nothing in the basemap gets to be
 *     saturated; Madeira's greens are present but muted.
 *
 * GLYPHS — A SHIPPING CONSTRAINT, NOT A STYLE CHOICE
 * --------------------------------------------------
 * The `glyphs` URL below points at Protomaps' hosted font PBFs, which is fine
 * for this repo's viewer but must NOT ship: the app makes zero network
 * requests (D-001). T-056/T-057 must bundle the four Noto ranges this style
 * uses and point `glyphs` at the app's local assets. No sprite is needed —
 * every layer that used one (POIs, shields, one-way arrows) is subtracted.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { layers, LIGHT, DARK } from '@protomaps/basemaps';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Layers deleted from the generated style, with the reason each is gone.
 * Deleting beats `visibility: none` — the style the app parses should not
 * carry seventy layers of dead weight.
 */
const SUBTRACT = {
  buildings: 'figure-ground is terrain, not buildings (D-026)',
  landuse_hospital: 'urban tint noise; not a tourist feature',
  landuse_school: 'urban tint noise; not a tourist feature',
  landuse_industrial: 'urban tint noise; not a tourist feature',
  landuse_zoo: 'tint noise; if it matters it will be a POI (T-066)',
  boundaries: 'admin boundaries are noise on a single island',
  boundaries_country: 'no land borders exist in the bbox',
  address_label: 'not a navigation app (D-018)',
  roads_oneway: 'not a navigation app (D-018); also needs a sprite',
  roads_shields: 'not a navigation app (D-018); also needs a sprite',
  roads_labels_minor: 'label load: road names off (design brief §2.3)',
  roads_labels_major: 'label load: road names off (design brief §2.3)',
  water_waterway_label: 'label load: river names off',
  water_label_lakes: 'no lakes worth labelling in the bbox',
  water_label_ocean: 'label load: the ocean does not need naming',
  pois: 'our POIs are content (T-066); two pin sets would be noise',
  places_region: 'the whole map is one region',
  places_country: 'the whole map is one country',
  places_subplace: 'suburb labels; localities already cover the villages',
};

/**
 * Label layers whose `text-field` is replaced with a plain Portuguese name
 * (T-063a). The reason each is here doubles as the reason it is safe.
 *
 * WHY THIS EXISTS — AND WHY THE ALTERNATIVE WAS TO SHIP MEGABYTES
 * ---------------------------------------------------------------
 * Protomaps builds `text-field` with `get_multiline_name`, which coalesces
 * `name` / `name2` / `name3` and their `pgf:` variants and tests
 * `is-supported-script`. That is exactly right for a world basemap and wrong
 * for a single Portuguese island: the renderer ends up asking for glyph ranges
 * for scripts the pack contains no text in. The first device render requested
 * **1024-1279, 1536-1791, 11520-11775 and 65024-65279** — Cyrillic, Arabic,
 * Georgian and variation selectors — and logged four errors per render,
 * because the app bundles 0-511 only and **can never fetch the rest** (D-001
 * forbids the network).
 *
 * The other way to silence it was to bundle those ranges: four ranges across
 * three font stacks, roughly twelve more PBFs of alphabets Madeira does not
 * use, against a 19.1 MB pack. T-063a's own note says not to bundle megabytes
 * by reflex, and this is why.
 *
 * ⚠ **What is given up.** Bilingual and transliterated labels — a place whose
 * name is rendered in two scripts on the world basemap shows only the
 * Portuguese here. On a pack whose bbox is Madeira and Porto Santo that is not
 * a loss, and if the bounds ever leave Portugal this is the first thing to
 * revisit.
 *
 * Only two label layers survive `SUBTRACT`, which is what makes this cheap; a
 * check below fails the build if that stops being true.
 */
const SIMPLIFY_LABELS = {
  places_locality:
    'village and town names — Portuguese, single script (T-063a)',
  earth_label_islands:
    'island names — Portuguese, single script (T-063a)',
};

/**
 * The replacement: the Portuguese name if the pack carries one, otherwise the
 * default. No `name2`/`name3`, no `pgf:` fallbacks, no script test — those are
 * what summon the glyph ranges we cannot serve.
 */
const PLAIN_NAME = ['coalesce', ['get', 'name:pt'], ['get', 'name']];

/**
 * The light flavor (T-058): warm paper ground, calm Atlantic, muted greens,
 * roads that whisper. Values not listed fall through to Protomaps LIGHT.
 *
 * Tuned in the repo viewer against the real pack (`bash tiles/viewer/serve.sh`)
 * — see docs/map-style.md for the screenshots each choice was judged on. The
 * real acceptance test is outdoors in Funchal sun (T-065), not any screen.
 */
const MADEIRA_LIGHT = {
  ...LIGHT,

  // The sea. One value visually, two keys: `background` shows at low zoom
  // before water polygons load, so they must match or the ocean flickers.
  background: '#b0c8d3',
  water: '#b0c8d3',

  // The land: warm paper, a touch lighter than Protomaps' default so the
  // coastline edge stays crisp at arm's length in sunlight.
  earth: '#eeebe4',

  // Madeira is largely forest and the default greens are minty and loud.
  // Present but quiet — the island should read green without any single
  // polygon competing with the trace.
  park_a: '#dde4d8',
  park_b: '#cfdcc8',
  wood_a: '#d9e1d2',
  wood_b: '#c8d6c0',
  scrub_a: '#dee3d4',
  scrub_b: '#d2dcc6',
  glacier: '#eeebe4', // none in Madeira; keyed to earth in case of mistags
  sand: '#e9e4d4',
  beach: '#ece7d3',
  pedestrian: '#e9e6dd',
  pier: '#e2dfd6',
  aerodrome: '#e3e2e0', // kept: the airport is the trip-end landmark (D-012)
  runway: '#d6d5d3',
  military: '#e6e3dc',
  zoo: '#e6e3dc',
  hospital: '#eeebe4',
  industrial: '#eeebe4',
  school: '#eeebe4',

  // Low-zoom landcover, same idea: believable, not vivid.
  landcover: {
    grassland: 'rgba(222, 230, 214, 1)',
    barren: 'rgba(235, 229, 214, 1)',
    urban_area: 'rgba(226, 223, 216, 1)',
    farmland: 'rgba(224, 231, 214, 1)',
    glacier: 'rgba(238, 235, 228, 1)',
    scrub: 'rgba(219, 227, 209, 1)',
    forest: 'rgba(208, 219, 200, 1)',
  },

  // Roads: light strokes with warm-grey casings. The casing carries the edge,
  // which keeps unvisited roads legible (D-015) without letting them shout.
  other: '#f4f2ee',
  minor_service: '#f4f2ee',
  minor_a: '#f4f2ee',
  minor_b: '#faf9f6',
  link: '#faf9f6',
  major: '#faf9f6',
  highway: '#fcfbf8',
  minor_service_casing: '#dcd7cd',
  minor_casing: '#dcd7cd',
  link_casing: '#d6d0c5',
  major_casing_early: '#d6d0c5',
  major_casing_late: '#d6d0c5',
  highway_casing_early: '#cfc8bc',
  highway_casing_late: '#cfc8bc',
  // Tunnels: GPS dies inside them and the trace will visibly gap there
  // (D-032 draws the honest raw trace). A distinctly dashed-out road colour
  // under the honest gap reads as "the road goes through the mountain".
  tunnel_other: '#e7e4dd',
  tunnel_minor: '#e7e4dd',
  tunnel_link: '#e7e4dd',
  tunnel_major: '#e7e4dd',
  tunnel_highway: '#e7e4dd',
  tunnel_other_casing: '#dedacf',
  tunnel_minor_casing: '#dedacf',
  tunnel_link_casing: '#dedacf',
  tunnel_major_casing: '#dedacf',
  tunnel_highway_casing: '#dedacf',
  bridges_other: '#f4f2ee',
  bridges_minor: '#faf9f6',
  bridges_link: '#faf9f6',
  bridges_major: '#faf9f6',
  bridges_highway: '#fcfbf8',
  bridges_other_casing: '#dcd7cd',
  bridges_minor_casing: '#dcd7cd',
  bridges_link_casing: '#d6d0c5',
  bridges_major_casing: '#d6d0c5',
  bridges_highway_casing: '#cfc8bc',
  railway: '#d0ccc4', // no rail on the island; harmless if mistagged

  // Rivers and the levada channels that survive in the water layer: visible,
  // calm, same family as the sea.
  // (Stream/river line colour comes from `water` in the generator.)

  // Labels: dark enough for sunlight, haloed in the ground colour.
  city_label: '#3f3f3d',
  city_label_halo: '#eeebe4',
  subplace_label: '#6f6d68',
  subplace_label_halo: '#eeebe4',
};

/**
 * The dark flavor (T-139): the souvenir's fog-of-war ground.
 *
 * TUNED 2026-08-11, AND TUNED BY MEASURING
 * ----------------------------------------
 * The previous version was a three-line draft. Every value below was chosen
 * against `app/src/ui/contrast.ts`, because D-015's rules are the binding
 * constraint on a dark style and "looks about right" is not available to
 * somebody who cannot see it. Three properties were solved for, and
 * `app/src/map/darkStyle.test.ts` holds them:
 *
 *   1. **Unvisited roads stay legible.** D-015 forbids near-black roads
 *      outright. The road greys sit at **3.2:1 to 5:1** against the ground —
 *      genuinely readable, not merely present. This is the constraint that
 *      makes a dark style hard: everything wants to be dark and the roads
 *      cannot be.
 *   2. **The island's shape carries the composition** (`docs/map-style.md`).
 *      Sea and land are only **1.53:1** apart, and that is deliberate: two
 *      large adjacent fills read apart at far less than text contrast, and
 *      **D-026 puts figure-ground in the shaded terrain, not in the fills.**
 *      An earlier attempt demanded 2:1 here and there was *no* palette that
 *      also kept the roads legible — the constraint was mine, not the design's.
 *   3. **Labels are unambiguous** — better than 11:1 on both sea and land.
 *
 * WHAT IS LEFT FOR THE TRACE
 * --------------------------
 * The whole point of the dark style is that the user's own trace is the
 * brightest thing on it (design brief §2.3). Nothing here goes above about
 * 5:1, which leaves the top of the range free. The trace's own colour and
 * weight are set by the map layer (T-059), not by this flavor.
 *
 * ⚠ **Never seen.** No device, and no human eye until the project lead opens
 * the viewer. Contrast is a floor, not a verdict — T-065 outdoors is the
 * verdict, and D-026 stays Provisional until then.
 */
const MADEIRA_DARK = {
  ...DARK,

  // The Atlantic at night. Near-black, and blue rather than grey so the sea
  // still reads as water rather than as absence.
  background: '#070B10',
  water: '#070B10',

  // Unexplored land. The fog-of-war ground, and the value everything else was
  // measured against.
  earth: '#232D37',

  // Madeira is largely forest. Green-shifted just enough to be believable,
  // close enough to `earth` that the island does not read as striped.
  park_a: '#26332C',
  park_b: '#2A3830',
  wood_a: '#24312B',
  wood_b: '#28362F',
  scrub_a: '#28332C',
  scrub_b: '#2C3830',
  glacier: '#232D37', // none in Madeira; keyed to earth in case of mistags

  // Beaches are one of the five stamp categories, so they earn a warm note.
  sand: '#35382E',
  beach: '#3A3D31',

  pedestrian: '#2A343E',
  // ⚠ A pier is WALKABLE, so D-015's legibility floor applies to it exactly as
  // it does to a road — caught by `darkStyle.test.ts`, which found it at
  // 1.07:1, effectively invisible. Funchal and Câmara de Lobos both have one.
  pier: '#76838E',
  aerodrome: '#262E36', // kept: the airport is the trip-end landmark (D-012)
  // Brighter than the draft so the airport is *identifiable* — it is where the
  // trip ends (D-012) and the reveal fires. Not held to the road floor: a
  // runway is a landmark, not somewhere the user walked.
  runway: '#5F6B76',
  military: '#242D34',
  zoo: '#242D34',
  hospital: '#232D37',
  industrial: '#232D37',
  school: '#232D37',

  // Low-zoom landcover, same family. At z<6 this is most of what is drawn.
  landcover: {
    grassland: 'rgba(38, 51, 44, 1)',
    barren: 'rgba(48, 52, 44, 1)',
    urban_area: 'rgba(41, 50, 60, 1)',
    farmland: 'rgba(40, 54, 46, 1)',
    glacier: 'rgba(35, 45, 55, 1)',
    scrub: 'rgba(40, 51, 44, 1)',
    forest: 'rgba(36, 49, 43, 1)',
  },

  // ⚠ THE LOAD-BEARING BLOCK. Roads brighten as they get more major, exactly
  // as in the light style — but here the floor matters: D-015 says unvisited
  // roads stay legible mid-grey and never near-black, so the dimmest road on
  // the map still clears 3:1 against the ground. Casings go *darker* than the
  // ground, which is what makes a road read as a drawn line rather than a
  // smear.
  other: '#6E7B85',
  minor_service: '#6E7B85',
  minor_a: '#76838E',
  minor_b: '#7F8C97',
  link: '#8794A0',
  major: '#8F9CA7',
  highway: '#9AA7B2',
  minor_service_casing: '#10161C',
  minor_casing: '#10161C',
  link_casing: '#0C1116',
  major_casing_early: '#0C1116',
  major_casing_late: '#0C1116',
  highway_casing_early: '#080D12',
  highway_casing_late: '#080D12',

  // Tunnels: deliberately dimmer than the surface roads and NOT held to the
  // legibility floor. GPS dies inside them and the trace gaps honestly there
  // (D-032); a faint road continuing under the mountain reads as "the road
  // goes through", which is a hint rather than information the user acts on.
  tunnel_other: '#47535D',
  tunnel_minor: '#47535D',
  tunnel_link: '#4C5862',
  tunnel_major: '#4C5862',
  tunnel_highway: '#515D67',
  tunnel_other_casing: '#141A20',
  tunnel_minor_casing: '#141A20',
  tunnel_link_casing: '#141A20',
  tunnel_major_casing: '#141A20',
  tunnel_highway_casing: '#141A20',

  bridges_other: '#6E7B85',
  bridges_minor: '#7F8C97',
  bridges_link: '#8794A0',
  bridges_major: '#8F9CA7',
  bridges_highway: '#9AA7B2',
  bridges_other_casing: '#10161C',
  bridges_minor_casing: '#10161C',
  bridges_link_casing: '#0C1116',
  bridges_major_casing: '#0C1116',
  bridges_highway_casing: '#080D12',

  railway: '#3A444D', // no rail on the island; harmless if mistagged

  // Labels: light on dark, haloed in the sea colour so they hold over both
  // the water and the land without a box.
  city_label: '#E8EEF2',
  city_label_halo: '#070B10',
  // Also carries the island names. Brightened from #A8B4BE, which measured
  // 6.62:1 on land — under the label floor, on the largest labels on the map.
  subplace_label: '#BCC7D0',
  subplace_label_halo: '#070B10',
};

/**
 * Shaded terrain (T-058a) — the figure-ground element (D-026).
 *
 * The `terrain` source is raw elevation (terrarium PNGs, built by
 * tiles/pipeline/build-terrain.py); this layer is MapLibre computing the
 * shading from it at render time. One elevation pack therefore serves both
 * styles — each shades the same mountains its own way.
 *
 * Inserted immediately BEFORE the water fill: the sea must stay flat and
 * clean, and everything above water (roads, labels, the trace) must not be
 * darkened by hillshading under it.
 */
function hillshadeLayer(paint) {
  return {
    id: 'terrain_hillshade',
    type: 'hillshade',
    source: 'terrain',
    paint: {
      // Subtlety is the point: the relief should give the land solidity, not
      // turn the basemap into a relief poster the trace has to fight.
      'hillshade-exaggeration': 0.35,
      ...paint,
    },
  };
}

/** Light style: warm shadows, faint highlights, on the paper ground. */
const HILLSHADE_LIGHT = {
  'hillshade-shadow-color': '#8b8071',
  'hillshade-highlight-color': '#ffffff',
  'hillshade-accent-color': '#8b8071',
};

/**
 * Dark style: moonlit ridges (T-139).
 *
 * ⚠ **Exaggerated more than the light style, and that is the figure-ground
 * mechanism, not a flourish.** D-026 puts figure-ground in the shaded terrain
 * rather than in buildings — and on a dark ground the relief is what separates
 * the island from the sea, because the fills themselves are only 1.53:1 apart.
 * The light style can afford 0.35 because paper shows shading readily; a dark
 * ground swallows it.
 */
const HILLSHADE_DARK = {
  'hillshade-exaggeration': 0.45,
  'hillshade-shadow-color': '#01040A',
  'hillshade-highlight-color': '#55677A',
  'hillshade-accent-color': '#01040A',
};

function buildStyle(name, flavor, hillshadePaint, purpose) {
  const generated = layers('madeira', flavor, { lang: 'pt' }).filter(
    (layer) => !(layer.id in SUBTRACT)
  );

  // Simplify the surviving label layers (T-063a). Done here rather than in the
  // flavor because it is a *text* decision, not a colour one.
  const simplified = [];
  for (const layer of generated) {
    if (layer.id in SIMPLIFY_LABELS) {
      layer.layout = { ...layer.layout, 'text-field': PLAIN_NAME };
      simplified.push(layer.id);
    }
  }

  // The saving depends on there being almost no label layers left. If a future
  // change stops subtracting one, this must be reconsidered rather than
  // silently leaving a world-basemap expression in the style.
  const remainingLabels = generated
    .filter((layer) => layer.type === 'symbol')
    .map((layer) => layer.id);
  const unsimplified = remainingLabels.filter(
    (id) => !(id in SIMPLIFY_LABELS)
  );
  if (unsimplified.length > 0) {
    throw new Error(
      `label layer(s) ${unsimplified.join(', ')} keep Protomaps' multi-script ` +
        'text-field, which requests glyph ranges the app cannot serve (T-063a). ' +
        'Add them to SIMPLIFY_LABELS or to SUBTRACT.'
    );
  }
  if (simplified.length !== Object.keys(SIMPLIFY_LABELS).length) {
    throw new Error(
      `SIMPLIFY_LABELS names ${Object.keys(SIMPLIFY_LABELS).join(', ')} but only ` +
        `${simplified.join(', ') || 'none'} were found — the base style's layer ids moved.`
    );
  }

  const waterIndex = generated.findIndex((layer) => layer.id === 'water');
  if (waterIndex === -1) {
    throw new Error(
      'no `water` layer in the generated style — the hillshade insertion point moved'
    );
  }
  generated.splice(waterIndex, 0, hillshadeLayer(hillshadePaint));

  return {
    version: 8,
    name,
    metadata: {
      'madeira:purpose': purpose,
      'madeira:generated':
        'by tiles/style/generate.mjs — DO NOT HAND-EDIT, edit the generator',
      'madeira:base': '@protomaps/basemaps 5.7.2 (BSD-3-Clause)',
      'madeira:subtracted': SUBTRACT,
      'madeira:simplified-labels': SIMPLIFY_LABELS,
    },
    // ⚠ Viewer-only. The app must bundle glyphs before shipping (D-001) —
    // see the header comment.
    glyphs:
      'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: {
      madeira: {
        type: 'vector',
        tiles: ['http://localhost:8080/madeira/{z}/{x}/{y}.mvt'],
        minzoom: 0,
        maxzoom: 15,
        // The pack's bbox (build.sh). Declaring it means the renderer never
        // requests tiles it knows do not exist.
        bounds: [-17.32, 32.4, -16.2, 33.2],
        attribution:
          '<a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a>',
      },
      terrain: {
        type: 'raster-dem',
        encoding: 'terrarium',
        tiles: ['http://localhost:8080/madeira-terrain/{z}/{x}/{y}.png'],
        minzoom: 0,
        maxzoom: 12,
        tileSize: 256,
        // ⚠ Load-bearing for raster-dem, not just an optimisation: without it
        // the renderer requests DEM tiles past the archive edge, receives
        // empty responses, and fails neighbour reconciliation with a "dem
        // dimension mismatch" error. With bounds declared, no such request is
        // ever made.
        bounds: [-17.32, 32.4, -16.2, 33.2],
        attribution: 'Elevation: Mapzen Terrain Tiles, NASA SRTM',
      },
    },
    layers: generated,
  };
}

/**
 * The same style, re-plumbed for the app (T-056).
 *
 * Identical layers and colours; only the wiring differs, because the app
 * reads everything from files on the device (D-001):
 *
 *   - Sources become `url: "{{TILES_PMTILES}}"` / `"{{TERRAIN_PMTILES}}"`
 *     placeholders. At runtime `app/src/map/mapAssets.ts` substitutes
 *     `pmtiles://file://<path>` once the packs are copied to device storage
 *     — MapLibre Native requires the inner URL fully specified, and Android
 *     cannot byte-range-read bundled assets, hence the copy.
 *   - Tile metadata (bounds, zoom range) is NOT restated inline: with a
 *     `url` source the renderer reads it from the PMTiles header itself,
 *     which also keeps it honest against the archive. `encoding`/`tileSize`
 *     stay inline — they describe interpretation, not extent, and are not in
 *     the header.
 *   - Glyphs become a `{{GLYPHS}}` placeholder for the on-device fonts
 *     directory (populated by fetch-glyphs.mjs, copied by mapAssets.ts).
 */
/**
 * The camera's opening shot (T-062).
 *
 * ⚠ **Not the same as the pack's bounds, and that difference is the whole
 * point.** The pack covers the whole archipelago — Madeira, Porto Santo and the
 * Desertas — which spans 1.12° of longitude. Fitting *that* on a tall phone is
 * what the first device screenshot showed: the island small and adrift in a
 * screen of empty ocean, because the width constrains the fit and the height
 * fills with sea.
 *
 * So the opening view is the **main island only**. Two reasons beyond framing:
 * the user is on Madeira, not looking at an archipelago from orbit; and D-024
 * hides Porto Santo until they actually go there, so putting it on screen at
 * launch would leak the thing that decision exists to withhold.
 *
 * The full pack bounds stay in `madeira:bounds` and become the camera's pan
 * limit — the user can reach everything the pack holds, they just do not start
 * there.
 */
const HOME_BOUNDS = [-17.28, 32.61, -16.65, 32.9];

function toAppStyle(style) {
  return {
    ...style,
    metadata: {
      ...style.metadata,
      // The camera's limits and its opening shot. Both live here rather than in
      // app code because island coordinates in `app/` would violate the content
      // rule (D-017) — the app reads them from the style it was shipped with.
      'madeira:bounds': style.sources.madeira.bounds,
      'madeira:home': HOME_BOUNDS,
    },
    glyphs: '{{GLYPHS}}/{fontstack}/{range}.pbf',
    sources: {
      madeira: {
        type: 'vector',
        url: '{{TILES_PMTILES}}',
        attribution: style.sources.madeira.attribution,
      },
      terrain: {
        type: 'raster-dem',
        url: '{{TERRAIN_PMTILES}}',
        encoding: 'terrarium',
        tileSize: 256,
        attribution: style.sources.terrain.attribution,
      },
    },
  };
}

const light = buildStyle(
  'Madeira light',
  MADEIRA_LIGHT,
  HILLSHADE_LIGHT,
  'T-058 — the everyday in-app map (D-026). Judged against T-065.'
);
const dark = buildStyle(
  'Madeira dark',
  MADEIRA_DARK,
  HILLSHADE_DARK,
  'T-139 — the souvenir ground (D-026). Tuned by contrast; never seen outdoors (T-065).'
);

writeFileSync(path.join(here, 'light.json'), JSON.stringify(light, null, 1));
writeFileSync(path.join(here, 'dark.json'), JSON.stringify(dark, null, 1));

const appDir = path.resolve(here, '..', '..', 'app', 'assets', 'map');
mkdirSync(appDir, { recursive: true });
writeFileSync(
  path.join(appDir, 'light.json'),
  JSON.stringify(toAppStyle(light), null, 1)
);
writeFileSync(
  path.join(appDir, 'dark.json'),
  JSON.stringify(toAppStyle(dark), null, 1)
);

console.log(`light.json: ${light.layers.length} layers (+ app template)`);
console.log(`dark.json:  ${dark.layers.length} layers (+ app template)`);
console.log('Preview: bash tiles/viewer/serve.sh → http://localhost:8081/viewer/');

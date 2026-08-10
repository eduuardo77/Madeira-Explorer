# The map styles

How the app's cartography is made, and why it looks the way it does.
(T-058 light, T-058a terrain, T-139 dark. Decisions: D-026, D-030, D-015.)

**Status 2026-08-10:** light style generated and iterated on-screen against the real pack;
terrain **built and rendering** (232 tiles, 6.5 MB — total pack 19.1 MB); dark style is an
untuned draft. **None of it has passed the real test — T-065, outdoors, in Funchal, at
midday.**

---

## The one rule

**Nothing is hand-edited.** `tiles/style/light.json` and `dark.json` are build artifacts.
Every deliberate choice — a colour, a deleted layer, the hillshade weight — lives in
**`tiles/style/generate.mjs`**, with its reason next to it. Regenerating is:

```bash
node tiles/style/generate.mjs
```

This is what "start from an existing style and subtract" (T-058) means in practice: the
`@protomaps/basemaps` package (BSD-3-Clause, licence verified 2026-08-10) generates the full
~70-layer style for the exact schema our pack uses (D-030), and the generator applies two kinds
of edit on top:

1. **The subtraction list** — layers deleted outright, each with a recorded reason. Buildings
   (figure-ground is terrain, D-026), basemap POIs (ours are the content, T-066), road
   labels/shields/one-way arrows (not a navigation app, D-018), admin boundaries, most labels.
2. **The flavor override** — a flat table of colours. Warm paper ground, calm Atlantic, muted
   Laurissilva greens, roads that whisper. The principle: **saturation belongs to the trace.**
   The basemap never gets to be the loudest thing on screen.

## Terrain (T-058a)

The elevation pack is **raw height data**, not a picture of shading:

```bash
python tiles/pipeline/build-terrain.py    # → tiles/out/madeira-terrain.pmtiles
```

Terrarium-encoded PNGs (AWS Open Data Terrain Tiles; DEM: NASA SRTM, public domain) for the
same bbox as the basemap, z0–12 — the ceiling where the ~30 m DEM runs out of real detail;
MapLibre overzooms it beyond that. The `hillshade` layer in each style computes the shading on
the GPU at render time, which is why **one elevation pack serves both styles**: light shades
with warm shadows on paper, dark with moonlit ridges (draft).

The hillshade sits immediately **below the water fill**: the sea stays flat, and roads, labels
and the trace are never darkened by relief under them.

Like the basemap, this is a build-time fetch. The app ships the file and never makes a network
request (D-001).

## Previewing

```bash
bash tiles/viewer/serve.sh
# → http://localhost:8081/viewer/?style=light   (also: dark, spike-t025)
```

Places worth judging, chosen because they stress different things:

| Where | URL hash | What it tests |
|---|---|---|
| Whole island | `#9.6/32.72/-16.96` | Does the island's shape carry the composition? |
| Funchal | `#13.2/32.648/-16.913` | Urban density without buildings; label load |
| Rabaçal | `#14/32.762/-17.130` | Levada country — was flat and formless before terrain |
| São Vicente valley | `#13/32.79/-17.05` | North-coast relief, the dramatic case |

## What still gates shipping this

- ~~Glyphs~~ **Handled 2026-08-10:** `fetch-glyphs.mjs` bundles the six Noto PBF ranges into
  `app/assets/map/fonts/`, and the app serves them from device storage. Only the *viewer*
  styles still use hosted fonts, which is fine — the viewer is a dev tool.
- ~~Source URLs~~ **Handled 2026-08-10:** the generator also emits app templates
  (`app/assets/map/{light,dark}.json`) with placeholders; `app/src/map/mapStyle.ts`
  substitutes real `pmtiles://file://` URIs at runtime.
- **Hillshade on `maplibre-react-native` must be verified on-device** — still the case; the
  layer type exists in the native renderer, but that it renders our terrarium pack correctly
  is an assumption until the first dev build runs.
- **T-065.** Sunlight, arm's length, Funchal. The only judge whose verdict counts (D-026 is
  Provisional until then).

## A lesson that cost twenty minutes

A `raster-dem` source over a partial-world archive **must declare `bounds`**. Without it the
renderer requests elevation tiles past the archive edge, receives empty responses, and fails
with `dem dimension mismatch`. The generator sets bounds on both sources; if the bbox ever
changes in `build.sh`, change it in `generate.mjs` too (D-035).

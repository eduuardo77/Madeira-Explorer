# Tile Pipeline — Phase 0.2 Results

**T-022, T-023, T-026.** Can we build an offline vector tile pack of Madeira and Porto Santo,
reproducibly, and is it small enough to ship?

**Short answer: yes, and it is much smaller than expected — 12 MB for the whole archipelago.**

> ### ⚠ Superseded in part, 2026-08-08 — schema changed to Protomaps (D-030)
> This document was written against **planetiler + the OpenMapTiles schema**, which was
> planetiler's *default* and was never actually chosen. On review it failed on two counts: a
> **CC-BY** licence forcing "© OpenMapTiles" into the souvenir video, and **names stripped from
> path features**, making levadas unidentifiable. It was also incompatible with the styles D-026
> had already chosen.
>
> **The pipeline now extracts the Protomaps basemap schema** (CC0, names preserved, `is_tunnel`,
> cliffs and peak elevations) in 8.5 seconds with no toolchain. §1–§3 below are retained as the
> measurement record of the rejected route; §2's toolchain remains valid as the documented
> fallback. Current numbers: **12 MB, zoom 0–15, 8.5s**.

**Built:** 2026-08-08. Reproduce with `bash tools/fetch-toolchain.sh` then
`bash tiles/pipeline/build.sh`.

---

## 1. What was built

| | |
|---|---|
| **Tile pack** | ~~8.9 MB~~ → **12 MB** (Protomaps, z0–15). 8.9 MB was the rejected OpenMapTiles build. |
| Coverage | bbox `-17.32,32.40,-16.20,33.20` — Madeira, Porto Santo, Desertas (D-021) |
| Zoom | 0–14 |
| Schema | OpenMapTiles (planetiler's default profile), 16 vector layers |
| Build time | **3m 37s**, 12 threads |
| Source | `portugal-latest.osm.pbf`, 400 MB, replication ts 2026-08-06 |

### T-026 is answered, decisively

The concern was whether the pack was small enough for a hotel-WiFi download. **8.9 MB** is not a
close call — it is smaller than a single photo from a modern phone. This removes any argument for
a tile *server*, and it makes bundling the pack directly in the app (rather than a first-run
download, T-057) a genuine option worth reconsidering.

**Caveat: this does not include terrain.** D-026 wants shaded relief for figure-ground, which
comes from elevation data — a separate source and a separate pipeline. Expect the real number to
be substantially higher. 8.9 MB is the floor, not the answer.

### No Madeira extract exists upstream

Geofabrik publishes an **Azores** extract but **no Madeira** one, so the pipeline takes all of
Portugal (400 MB) and clips to the bbox. That is why `build.sh` downloads a country to produce an
island.

---

## 2. The toolchain, and why it is what it is

The dev machine has Node and Python but **no Docker, no Java, no Go, no WSL**. That rules out
most of the standard tile-building routes:

| Tool | Verdict |
|---|---|
| Planetiler | Needs Java. **Chosen** — with a *portable* JDK in `tools/jdk/`, nothing installed system-wide. |
| Tilemaker | **No Windows build exists** (v3.1.0 ships no release assets). Would mean compiling C++ on Windows. |
| Docker pipelines | Docker not installed; a heavy dependency for one build step. |
| Protomaps planet extract | Works, but yields someone else's schema and is not a *pipeline* — T-023 asks for a reproducible script, not a downloaded rectangle that silently goes stale. |

`tools/fetch-toolchain.sh` fetches everything and **verifies published checksums** rather than
trusting the download. Deleting `tools/jdk/`, `tools/bin/` and `tiles/src/` removes every byte.

### The build pulls 1.4 GB of global reference data

Planetiler's stock profile needs water polygons (928 MB), Natural Earth (434 MB) and lake
centrelines (81 MB). It caches them, so this is one-time.

That is a lot of *planet* data to render 740 km². The water polygons are not optional — they are
what makes the coastline a coastline, which for an island is most of the map. Natural Earth and
lake centrelines are near-pure dead weight here. Avoiding them means writing a custom planetiler
profile **in Java**, which is a poor trade for this project (CONTEXT §6.7) unless the terrain
work pushes the pack past a size that matters.

---

## 3. The finding that matters: levadas are half-visible in the stock schema

Verified by decoding a z13 tile directly with `tools/mvt-inspect.py` (no browser, no GPU, no
style — just the protobuf).

| Layer | Levadas | Verdict |
|---|---|---|
| `waterway` | **Names preserved.** 29 named `Levada *` features in one tile, all `class=drain` — *Levada dos Tornos*, *Levada do Caldeirão do Inferno*, *Levada do Pico Ruivo* | ✅ |
| `transportation` | 72 `class=path` features, **0 with a name.** OpenMapTiles strips names from this layer by design | ❌ |
| `transportation_name` | Only **4 features** total, 1 of them a levada. This is a *label-placement* layer carrying a filtered subset, not full geometry | ❌ |

**So: the channel is identifiable, the walkable path is not.**

In the basemap, a levada footpath renders identically to any other footpath. On an island whose
entire product is levadas, that is a real limitation — you want unvisited levadas to *look* like
levadas, since the uncollected ones are the recommendation (D-002).

### Why this is not a blocker, and what it suggests

D-022 already draws visited segments from **our own** local geometry rather than from tile
features. So visited levadas will look however we choose regardless of the schema.

For **unvisited** levadas, the same trick applies — and this yields a genuinely useful narrowing
of T-025a:

> **T-025a does not have to be all-or-nothing.** Drawing *all* roads from our own overlay means
> ~51,000 ways (T-028). Drawing *just levada paths* from our own overlay is **~1,386 ways** — a
> fraction of the cost, aimed exactly at the feature that matters most.

A cheaper fallback also exists: the named `waterway` channel runs parallel to the path, within a
few metres. Rendering the named channel may read as "the levada" at most zooms with no overlay at
all. Worth eyeballing before building anything.

---

## 4. Attribution obligation — resolved by D-030

~~Planetiler's OpenMapTiles profile output requires a visible credit:~~

> ~~**© OpenMapTiles © OpenStreetMap contributors**~~

**No longer applies.** The Protomaps schema is **CC0**; attribution to Protomaps is requested but
not required. What remains is **© OpenStreetMap**, required under ODbL by every possible option
including a fully custom pipeline. The paragraphs below stand as the reasoning for why this
mattered enough to change schema.

Original note, retained:

This must appear in the app **and in the souvenir export** (T-105/T-106), since the video is a
public artefact. Worth designing into the watermark rather than bolting on later — it sits next
to our own name in the one frame that carries the whole distribution strategy (D-013).

If that becomes unwelcome, a custom planetiler profile drops the OpenMapTiles half and leaves
only the OSM attribution, which is required regardless.

---

## 5. Still open

- [ ] **T-025 proper** — confirm our own overlay geometry aligns with the basemap's road
      rendering. The viewer (`tiles/viewer/`) is built and serving; it needs a visible browser
      window to render, and real road geometry to draw over.
- [ ] **Terrain** — not in the pack. D-026 depends on it, and it will move the size number.
- [ ] **Style** — `tiles/style/light.json` is a *diagnostic* style, deliberately hand-written and
      deliberately loud about levadas. The shipping style (T-058) starts from an existing
      permissively-licensed style and subtracts, per D-026.
- [ ] Whether to bundle the pack or download it on first run (T-057) — 8.9 MB reopens this.

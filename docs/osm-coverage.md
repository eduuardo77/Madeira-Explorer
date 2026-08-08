# OSM Coverage Assessment — Madeira and Porto Santo

**T-028.** Is OpenStreetMap good enough to build this app on, or must external data be
licensed and reconciled in?

**Short answer: OSM is sufficient. No external data licensing is required.** The risk is not
coverage — it is **tagging heterogeneity**, and one assumption in the planning docs was wrong.

**Surveyed:** 2026-08-08, via Overpass, bbox `32.40,-17.32,33.20,-16.20` (Madeira, Porto Santo
and the Desertas). Reproduce with `python tools/osm-survey.py`. Counts are **ways and nodes, not
kilometres** — a single levada is many ways. OSM changes continuously; re-run before relying on
these.

---

## 1. The road and path network

| Count | Feature |
|---:|---|
| **50,946** | `highway=*` ways, all |
| 7,432 | major — motorway, trunk, primary, secondary, tertiary |
| 7,196 | residential |
| 16,066 | footway |
| 6,158 | path |
| 2,569 | track |
| **604** | with `tunnel=*` |

### Two things here change existing tasks

**T-064's performance target is an order of magnitude low.** It asks for "recolour 5,000+
segments without dropping frames." The island has **~51,000 highway ways** before any splitting
at intersections, so the real graph is larger still.

This matters most for **T-025a** — the option of suppressing basemap roads and drawing *all*
roads from our own overlay. D-022 named that as the mitigation for the overlay-alignment risk,
and it is worth knowing up front that it means rendering **~51,000 ways, not ~5,000**. It may
still be the right call; it is not the cheap escape hatch it reads as.

**16,066 footways is a decision waiting to happen.** These are overwhelmingly Funchal pavements.
Including them in the road graph would make the city a mass of pavement fragments, inflate any
denominator they touch, and add matching ambiguity in the one place GPS is already multipathed by
buildings. Excluding them is probably right, but it is a real choice and it belongs in T-082, not
in an implementer's head.

**604 tunnel ways** is consistent with CONTEXT §5's "well over a hundred road tunnels" — ways are
not tunnels, and one tunnel is often several ways. Note this figure includes levada tunnels
(§2 below).

---

## 2. Levadas — coverage is good, tagging is not what the docs assume

| Count | Feature |
|---:|---|
| **3,981** | ways named `Levada*` |
| **1,386** | …tagged `highway=*` — **the walkable part** |
| 922 | `highway=path` |
| 160 | `highway=footway` |
| 52 | `highway=track` |
| **2,552** | …tagged `waterway=*` — **the channel itself** |
| 2,357 | `waterway=drain` |
| 122 | `waterway=canal` |
| **108** | `highway=*` **and** `tunnel=*` — **levada tunnels** |
| 31 | none of highway / waterway / man_made |

### The structural fact that matters

**OSM maps a levada as two parallel ways sharing one name:** the water channel, and the footpath
beside it. They carry different tags. Any query that assumes a single tag gets a fraction of the
network.

### Correction to CONTEXT §5

> *"They are `highway=path` in OSM, not roads"*

True of **922 of 3,981 named ways — 23%.** The statement is directionally right about what you
*walk on* but wrong as a selector. The dominant tagging is `waterway=drain` (2,357), which is
semantically odd — a drain removes water, a levada delivers it — but it is *consistent*, and
consistency matters more here than correctness. Anyone reaching for `waterway=canal`, the
semantically right tag, gets **3%** of the network.

**Consequence for T-068 (levada corridors):** select by **name and route-relation membership**,
never by a single tag. Use the `highway=*` ways for matching — the user walks the path, not the
channel — and fall back to the `waterway=*` geometry where a levada has a channel mapped but no
path.

### 108 levada tunnel ways

CONTEXT §5 says "several levadas run through their own tunnels." It is **108 ways**, which is a
different order of thing. These are walkable tunnels with no GPS at all, and they are exactly the
case T-089 and T-090 exist to credit. It also means levada tunnels are a meaningful share of the
604 total, so T-069's portal extraction must cover walkable tunnels, not just road tunnels.

---

## 3. Official trail data — OD-7's actual question

| Count | Feature |
|---:|---|
| 118 | `route=hiking` relations |
| **44** | …with `ref=PR*` — the official signed trails |

OD-7 asked whether official PR-route data must be reconciled in, and whether that data could be
licensed. **The PR route structure is already in OSM** — 44 relations carrying official refs. So
the question is moot: no external source, no licensing negotiation, no reconciliation pipeline.
Everything stays ODbL, which the project already accepts.

This resolves OD-7. See **D-029**.

---

## 4. Content candidates (T-066)

| Count | Feature |
|---:|---|
| 569 | `tourism=viewpoint` — miradouros |
| 180 | `natural=peak` |
| 79 | `place=city/town/village` |

**T-066 is selection, not research.** The target is 150–250 curated places across five categories
(D-027), and OSM already offers far more candidates than that in the two hardest categories. The
work is hand-verification and editorial judgement — which is exactly the local knowledge the
project lead has and a competitor cannot buy (CONTEXT §5a).

Beaches were not surveyed; the waterfall query in the first run was malformed (queried ways, not
nodes) and has been fixed in the tool but not re-run.

---

## 5. What this does not tell us

Counts are not quality. This survey says the data **exists**; it does not say it is **accurate**.
Still unknown, and only answerable in the field:

- Whether levada paths are geometrically accurate enough for a 50–75 m matching corridor (T-085)
- Whether tunnel portal nodes are positioned precisely enough for portal-pair inference (T-087)
- Whether the 44 PR relations are complete and current, or partly stale
- Whether named levada ways are correctly *connected* — a corridor with a gap in the middle
  breaks trailhead-to-exit crediting (T-089)

The project lead lives in Madeira (CONTEXT §5a), so the honest next step for any of these is to
go and compare a known levada against what OSM claims.

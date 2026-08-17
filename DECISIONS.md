# Decision Log

Design decisions, the alternatives considered, and the reasoning. Each entry stands alone so
it can be revisited without re-deriving the argument.

**Document date:** 2026-08-06

Status values: **Accepted** · **Provisional** (leaning strongly, not final) · **Open** ·
**Deferred** · **Superseded**

**Maintenance:** this log is updated as decisions are made, not retrospectively. Take the next
free `D-0xx` for new entries; IDs are stable and are never renumbered or reused. Supersede
rather than delete. Always record the alternatives rejected and why — that is the part that
stops settled questions being reopened. Full protocol in [CONTEXT.md §9](CONTEXT.md).

---

## The index

**This file is the index. The full reasoning — and every rejected alternative,
which CONTEXT §9 calls the most valuable part — lives in
[`docs/decisions-full.md`](docs/decisions-full.md).**

Read a decision in full before contradicting it:

```bash
grep -A40 "^## D-032" docs/decisions-full.md
```

| ID | Decision | Status |
|---|---|---|
| **D-001** | No backend. Fully on-device architecture. | Accepted |
| **D-002** | Curate the canvas. Stamps are the score, not island-wide road coverage. | **Accepted** |
| **D-003** | "Passport stamps," not "stars." | Accepted |
| **D-004** | MapLibre GL Native with offline vector tiles carrying stable OSM way IDs. | Accepted (with a defined fallback) |
| **D-005** | Geofences as the system backbone. | Accepted |
| **D-006** | Buy the background-geolocation library rather than build it. | **Superseded in part by D-025** |
| **D-007** | React Native or Flutter, not fully native. | Accepted |
| **D-008** | The app must be fully usable with "While Using" permission only. | Accepted |
| **D-009** | Bias matching toward false positives. | Accepted |
| **D-010** | Retain raw traces; treat matching as a replaceable layer. | **Accepted** |
| **D-011** | Exactly two notifications per trip. | Accepted |
| **D-012** | Airport geofence as the trip-end trigger. | Accepted |
| **D-013** | The souvenir video is the distribution strategy. | Accepted |
| **D-014** | Printed poster / physical souvenir monetisation deferred. | Deferred (see OD-4) |
| **D-015** | Accessibility beats aesthetics where they conflict. | Accepted |
| **D-016** | Mask the user's accommodation in exports by default. | Accepted |
| **D-017** | All Madeira-specific content lives as data, not code. | Accepted |
| **D-018** | Never build navigation. | Accepted |
| **D-019** | Build the recorder before the visualisation. | Accepted |
| **D-020** | Validate physical assumptions before committing to street-level matching. | Accepted |
| **D-021** | Porto Santo is in scope for v1. | Accepted |
| **D-022** | Draw visited segments as our own overlay, not by recolouring basemap features. | **Accepted** |
| **D-023** | React Native. | **Accepted** |
| **D-024** | Porto Santo stays hidden until the user goes there. | Accepted |
| **D-025** | Start on the free location stack. Treat the paid SDK as a contingency. | Accepted |
| **D-026** | Two map styles: light for use, dark for the souvenir. Terrain, not buildings. | Provisional |
| **D-027** | The passport is organised by category, not by region. | Provisional |
| **D-028** | Gate sampling on stationary-vs-moving. The pedometer classifies; it never gates. | Provisional |
| **D-029** | OSM alone is sufficient for levadas. Select by name and relation, never by tag. | Provisional |
| **D-030** | Protomaps basemap schema, extracted from their hosted planet build. | Provisional |
| **D-031** | No backend. Re-examined against the competition, and reaffirmed. | Accepted |
| **D-032** | v1 ships without map matching. Draw the raw trace. Spend the effort on the UI. | Accepted |
| **D-033** | The dynamic geofence window: nearest-by-edge-distance, plus an exit-only anchor. | Provisional |
| **D-034** | The content pack: one JSON file, compiled in, validated twice. | Provisional |
| **D-035** | Terrain ships as raw elevation, shaded at render time. AWS Terrain Tiles, z12 ceiling. | Provisional |
| **D-036** | The map ships inside the app binary, not as a first-run download. | Provisional |
| **D-037** | Stamp awards: two gates, and levadas verify their endpoints. | Provisional |
| **D-038** | A web design workbench, for looking at screens. Web is not a target. | Provisional |
| **D-039** | Trip end: the arrival crossing must not end the trip, and silence takes three days. | Provisional |
| **D-040** | Masking is enforced by a single export door, and an unverifiable trace is withheld. | Provisional |
| **D-041** | Onboarding: three screens, no gate, and no battery figure until one is measured. | Provisional |
| **D-042** | The souvenir is planned as a storyboard, paced by movement, and never partial. | Provisional |
| **D-043** | Firebase Cloud Messaging ships in the Android build, and stays. | Provisional |
| **D-044** | The privacy policy is shown offline in the app, and the web copy is generated from it. | Provisional |
| **D-045** | The battery exemption opens a settings screen; it does not ask for the restricted permission. | Provisional |
| **D-046** | Stamp artwork is generated per place. The emblem carries the category; shape and colour do not. | Provisional |
| **D-047** | The emulator cannot serve a `balanced`-accuracy location request. The recorder was never broken. | Provisional |
| **D-048** | The recording sink is serialised. The OS delivers concurrently and our writes assumed it did not. | Provisional |
| **D-049** | The canvas is ~80 places, not 150–250. The denominator stays, and that is why. | Accepted |
| **D-050** | v1 stops recording barometer and pedometer data. | Accepted |
| **D-051** | The souvenir video is cut from v1. v1 therefore ships with no distribution strategy. | Accepted |
| **D-052** | A place is reached through the passport, and Directions hands off with a fallback. | Provisional |
| **D-053** | The camera frames what you walked, not the island. | Provisional |
| **D-054** | The app follows iOS conventions, on both platforms. | Provisional |
| **D-055** | No Directions button. *Show on map* draws the levada's course. | Provisional |
| **D-056** | The trace is blue, not red. | Provisional |
| **D-057** | The app uses the platform's map. Google on Android, Apple on iOS later. | **Accepted** |
| **D-058** | The passport shows every place. Uncollected ones are shaded, and still open. | **Accepted** |
| **D-059** | The trace breaks where the movement was impossible, not only where time passed. | Provisional |
| **D-060** | Battery tiers are named by what they do. No percentage until one is measured. | Provisional |
| **D-061** | A region is a municipality, taken from OSM's boundaries — not a cluster of places. | Provisional |
| **D-062** | v1 ships region progress computed and unshown. The passport already answers "where next". | **Accepted** |
| **D-063** | The souvenir returns to v1 — but **last**. Foundations first. | **Accepted** |
| **D-064** | The canvas is greatest hits, not coverage. Thin regions are allowed to stay thin. | **Accepted** |
| **D-065** | Two ways to earn every stamp. A levada is credited by how much of it you walked. | Provisional |
| **D-066** | The drawn trace is cleaned before it is drawn, and cleaning never moves a point. | Provisional |
| **D-067** | The accuracy cut is a preference, not a veto. A canopy stretch still draws. | Provisional |
| **D-068** | A levada is credited by time as well as distance. You cannot always finish one. | Provisional |
| **D-069** | A walk the user sends, never a walk the app collects. | Provisional |
| **D-070** | The map shows the places you earned, and nothing else. Chrome follows the map. | Provisional |
| **D-071** | The map is the product; the stamp system is not top priority. Sequencing, not scope. | **Provisional — needs confirming** |
| **D-072** | **Free on Play. Trace always free; 10 stamps + your first levada free; €4.99 unlocks the rest.** | **Accepted** |

**IDs are stable and never reused.** Supersede rather than delete: mark the old
entry Superseded in the full text and link forward (CONTEXT §9).

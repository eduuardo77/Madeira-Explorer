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
| **D-008** | The app must be fully usable with "While Using" permission only. Android asks Always in first run since T-250, never as a gate. | Accepted, amended 2026-10-05 |
| **D-009** | Bias matching toward false positives. | Accepted |
| **D-010** | Retain raw traces; treat matching as a replaceable layer. | **Accepted** |
| **D-011** | Exactly two notifications per trip. **Amended by D-096:** stamps have a quiet one of their own. | Accepted |
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
| **D-032** | v1 ships without map matching. Draw the raw trace. Spend the effort on the UI. | Accepted; ⚠ **matching is back in since D-093** |
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
| **D-045** | The battery exemption opens a settings screen; it does not ask for the restricted permission. **First run uses the one-tap dialog since T-250** (restricted permission taken). | Provisional, reversed in first run 2026-10-05; **kept 2026-10-06** (L2: as WalkNYC does), justified in T-266 |
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
| **D-056** | The trace is blue, not red. | **Superseded** by D-104 |
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
| **D-070** | ~~The map shows the places you earned~~ ⚠ **Since 2026-10-04 the home map draws no place** (the lead removed the circles); places open from the passport. Chrome follows the map. | Provisional |
| **D-071** | The map is the product. ⚠ **Partly reversed 2026-08-17: stamps are a priority again** (D-072 made them the revenue). | **Superseded in part** |
| **D-072** | **Free on Play. Trace always free; ~~10~~ stamps + your first levada free; ~~€4.99~~ unlocks the rest.** ⚠ *Allowance and price superseded by D-089.* | **Superseded in part** |
| **D-073** | Marketing is ASO on one free listing. Rank honestly; never claim offline. | **Provisional** |
| **D-074** | ~~The app is **Proa**; the listing is **Proa - Madeira**. Package `com.proa.madeira`.~~ ⚠ **Superseded 2026-09-25 by D-092 (Bruma).** | **Superseded** |
| **D-075** | A stamp you earned but have not paid to see is **locked, never "not collected"**. | **Accepted** (2026-09-25, with D-089) |
| **D-076** | The souvenir film **is the map, played back** — not a bespoke drawing of the route. | **Accepted** |
| **D-077** | Real-device verification comes from **Play's pre-launch report and Firebase Test Lab**, not from owning a phone. | **Provisional** |
| **D-078** | Stamps are **collectibles with a rank** — bronze/silver/gold/platinum by *how many* you have, shown on the passport button. | **Accepted** |
| **D-079** | A stamp is a picture **of its place**, not of its category. Glyphs in `app/`, the assignment in `content/`. | **Provisional** |
| **D-080** | The app is **light**; the passport's album page stays **dark**, because all thirty colourways fail on a light card. | **Accepted** |
| **D-081** | The **pedometer waits for v2** — expo-sensors cannot read Android step history — and `ACTIVITY_RECOGNITION` is stripped meanwhile. | **Accepted** |
| **D-082** | The drawn trace gets **cleanup wired in, an honest line weight, and snapping only to shipped levada courses** — general matching stays deferred. | **Superseded** by D-093 |
| **D-083** | The passport button **is your latest visible stamp**, with the rank as a **metal rim and dark hairline**; the count leaves the button. | **Accepted** |
| **D-084** | **Public v1 ships with Play Billing working**; ~~the closed beta runs unlocked~~ the closed test runs the normal build (amended 2026-10-09). | **Accepted** |
| **D-085** | ~~The home map shows every place faintly~~ ⚠ **Rings removed 2026-09-24** by the project lead: only collected places are drawn, as D-070 said. | **Reversed** |
| **D-086** | The icon and brand mark are **drawn in-house from the stamp artwork**, after the trademark search. | **Accepted** |
| **D-087** | A **walk** is started from the main button and **changes the recorder**; background recording is **automatic recording**, in Settings. After WalkNYC. Pause, and a summary at the end. | **Accepted** |
| **D-088** | A trip ends at the **airport**, after **three days of silence**, or by the user's **End trip** (passport), which also turns automatic recording off (⚠ that part Provisional). | **Accepted** |
| **D-089** | **The free tier:** the map of where you have been **free and unlimited**; **5 stamps + your first levada** free; **one purchase of €5.99** unlocks all of Madeira forever, with **set medals** and a **founder stamp** (first 3 months). **Tilt and shine** on every stamp. The video waits for its export (v1.1): free gets a medium mark and an end card. No subscription. Supersedes T-159. | **Accepted** 2026-09-25 |
| **D-090** | A **quiet progress line** above the outing button, *3 de 80 lugares* and a 3 dp bar, after WalkNYC's. Shown at zero; not tappable; said once to screen readers (by the passport button). Amends D-083/D-085. | **Accepted** (the drawing Provisional) |
| **D-091** | **Billing is `expo-iap`**, straight to Google Play Billing from the phone; no server, **no account**. RevenueCat rejected: it contacts a third party at every launch and holds every purchase. We must prove acknowledgement, pending, offline and restore ourselves. | **Accepted** 2026-09-25 |
| **D-092** | The app is **Bruma**; the Play title is **Bruma: Madeira Walk Tracker**. Same sound in Portuguese and English; the descriptor carries the meaning and must be understood alone. Lifts §7.2's ban on *Track*. Package stays `com.proa.madeira`. Supersedes D-074. | **Accepted** 2026-09-25 (renamed in code 2026-09-25, T-240). ✅ **Kept after the same day's trademark search** (a near-abandoned app named *Bruma*; EU word mark BRUMA in software and travel, probably unused there). An attorney's view on that mark before the first upload (T-187). |
| **D-093** | **The map lights the roads and paths travelled**, matched on the phone against OSM's network shipped as `content/roads.json`; nothing where the phone lay still or no road matched. Motion gate from the receiver's speed; exports clipped at the mask circle. Supersedes D-082; reverses D-032's deferral of matching. | **Accepted** 2026-09-27 (the direction; every threshold Provisional until the field outing, T-246) |
| **D-094** | **The phone's motion sensors are a second witness** (Activity Transition API, optional, asked after location): still vetoes drift, the mode makes the wrong kind of way dear, a vehicle switches recording to the driving rate. Weights, never filters. **Cable cars are in the network**, drawn faded. Reverses D-050 for activity. | **Accepted** 2026-09-27 (the direction; numbers Provisional until T-246) |
| **D-095** | The map **says when automatic recording works** (a status line in the progress line's place) and **warns in WalkNYC's amber banner** when it does not; the banner's tap goes through the disclosure to *Permitir sempre*. Controls drawn at WalkNYC's size (walk button 52 dp, 16 sp), **targets still 60 dp**, type still ≥ 14. Amends D-087 §4, D-090. | **Accepted** 2026-09-27 |
| **D-096** | **A new stamp is said when it is earned:** the recorder's batch runs the award pass (at most once a minute), a **quiet notification** (own channel, low importance, no sound) goes out once per stamp while the app is closed, and the map shows a **pop-up** with the stamp when next on screen. Outside D-011's budget of two; locked stamps are named, not drawn. Amends D-011. | **Accepted** 2026-10-04 (the project lead's instruction) |
| **D-097** | **The paywall asks, and keeps asking where it is useful.** Supersedes T-157's "said once, quietly, never a repeating banner": the unlock sheet is made appealing and its copy stronger; a standing reminder sits **on the passport and the map**, not only in Settings; the new-stamp pop-up becomes a celebration and offers the unlock at that moment. **Lines kept:** nothing false (no invented countdown or scarcity), no purchase notifications, nothing covering the map's roads. Design chosen from drawn options (`tools/out/unlock-options.html`). | **Accepted** 2026-10-05 (the project lead's instruction); design picked the same day: sheet A, reminders R1 + R2, new stamp E2 + E3 (T-249), first run as drawn (T-250) |
| **D-100** | **The developer collects no data from users, for now (option A).** Feedback comes from Play Console's Android vitals, ratings and reviews, the opt-in *Enviar um registo*, and *Enviar opinião* (the user's own email, the build in the subject). Usage analytics (option B) waits for a concrete question and a few hundred users, and would come as an opt-in, off by default, with the policy and store forms changed first. Data safety: shared **No**, deletion **No**. | **Accepted** 2026-10-07 (the project lead: "A, at least for now") |
| **D-101** | **One distance: road lit, each road once** (*km de estradas acesas*), on the home, the passport and the trip viewer. Travelled distance, which counted a road driven twice twice, is gone. | **Accepted** 2026-10-09 (the project lead, L6) |
| **D-102** | **Google's map pins: businesses off, attractions kept** (`GOOGLE_POIS = 'attractions'`), on light and dark alike. WalkNYC keeps every pin; shops and cafés covered the streets walked at street zoom. | **Accepted** 2026-10-09 (the project lead, F6 option B) |
| **D-103** | **Buttons stay three colours, each with a reason:** green starts an outing (red ends it), blue for every other main button, gold where a stamp is celebrated. | **Accepted** 2026-10-09 (the project lead, review E, after blue-only and green-only were drawn on the P30) |
| **D-105** | **The offer from the first day.** The passport card shows until the passport is bought, counting the free five down ("Faltam 3 carimbos grátis") over three places in colour; the pop-ups of the 3rd and 5th stamps offer the unlock, once each; the unlock sheet with nothing waiting shows three random places. **Rejected:** an offer at the end of the first run, and the sheet opening by itself with the passport each day. D-097's lines hold. | **Accepted** 2026-10-10 (the project lead, from drawn options, `tools/out/paywall-options.html`) |
| **D-104** | **The lit roads are deep orange and thinner as the camera zooms out** (4 dp at street zoom, down to 2 dp at the island view, in steps). Blue sat on Google's location dot and route colour, and a fixed width turned a walked town into one blot. | **Accepted** 2026-10-10 (the project lead: "Go ahead with step 1"); colour and widths Provisional until seen outdoors |
| **D-099** | **Watching a trip, WalkNYC's way:** a still trip viewer, one page per **day**, roads of the day bright over the trip pale, time tags on stamps (no S and E: the hotel is never shown), arrows between days; ▶ the timelapse on the dark map (WalkNYC's Replay); Partilhar one PNG of the whole masked trip with a card. | **Accepted** 2026-10-07 (the project lead: option B, share as drawn, keep the film); T-253, T-253b |
| **D-098** | **The Portuguese speaks to the user as *tu*** everywhere: strings, notifications, privacy policy, listing. German stays *Sie*. Ends the *tu*/*você* split (third review F1). | **Accepted** 2026-10-06 (the project lead, L1); built in T-255 |

**IDs are stable and never reused.** Supersede rather than delete: mark the old
entry Superseded in the full text and link forward (CONTEXT §9).

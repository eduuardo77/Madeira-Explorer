# Project Plan

Implementation roadmap for the Madeira Explorer app.

**Document date:** 2026-08-06
**Updated:** 2026-08-08 — D-026/D-027/D-028 folded in; status corrected.
**Status:** **Phase 0 not started.** Phase 1 is partly implemented and entirely unverified —
a recorder skeleton exists in `app/` that has never been run. See TASKS.md for task-level
status and HANDOFF.md for what that skeleton actually contains.

---

## v1 scope — read this before anything else (D-032)

**v1 is:** record location → award stamps by geofence → **draw the raw GPS trace** → passport
screen → souvenir at trip end.

**Phase 4 (map matching) is deferred to v2.** It is the largest body of work in the project and
it produces what D-002 already calls *decoration*. The reward — stamps — comes from geofences,
which need almost no accuracy. Raw traces are retained (D-010), so matching can be added later
and run retroactively over trips already recorded.

**The saved effort goes into the interface and the map's appearance.** Against a fourteen-year
incumbent, "does less, beautifully" is the position where being new is an advantage.

**Phases in v1:** 0 (partly), 1, 2, 3, 5, 6, 7. **Not in v1:** 4.

---

## Guiding sequencing principle

Build the **recorder** before the **visualisation**, and validate the **hard physical
assumptions** before either.

The raw GPS/sensor trace is the only irreplaceable asset. Visualisation, scoring, matching
algorithms and UI can all be rewritten later and retroactively improved against traces
already collected. A missed week of recording can never be recovered. Therefore:

1. Prove the island's terrain does not break our assumptions (Phase 0).
2. Capture data reliably and durably (Phase 1).
3. Everything else (Phases 2–7).

---

## Phase 0 — Validation before commitment

**Goal:** Answer, cheaply, the three questions that would be expensive to discover later.
**Duration estimate:** 1–2 weeks, mostly non-coding.
**Cost if skipped:** Potentially a full architectural rewrite in Phase 4.

### 0.1 Field GPS reality check

Walk one full levada under Laurissilva canopy and drive one tunnel-heavy route (VR1/VE1)
with a raw GPS logger recording at high fidelity, capturing:

- Raw fixes with timestamp, lat/lon, accuracy, speed, bearing
- Barometric pressure / relative altitude
- Pedometer step counts
- Platform-reported activity type

**Deliverable:** a set of real traces committed to `tools/fixtures/` that every later
matching change is tested against.

**What we are looking for:**
- How long are the signal blackouts under canopy, in seconds and metres?
- How large is the horizontal error when signal returns?
- Do the VR1 and the coastal ER101 below it become distinguishable using altitude?
- Does the barometer stay usable through tunnels?
- Does the pedometer keep counting when GPS is dead?

### 0.2 Tile pipeline spike

Produce a vector tile pack of Madeira **and Porto Santo** (D-021) from an OSM extract, and
confirm that a **locally-drawn overlay aligns cleanly with the basemap's own road rendering**
(D-022). Stable OSM way IDs remain useful as an internal join key but are no longer
architecturally load-bearing.

**Deliverable:** a `.pmtiles` or `.mbtiles` file, its size on disk, and a working MapLibre
demo that draws a highlighted road segment from local geometry over the basemap.

**This is also the unblock for all visual design work.** The map is a MapLibre style, not UI, and
it cannot be designed against an imaginary map — invented road density and fictional label load
produce mockups that look convincing and are wrong. See `docs/design-brief.md` §1.

**Revised 2026-08-06 (D-022):** this spike is no longer a kill criterion. Because visited
segments are drawn from our own local geometry rather than by recolouring tile features,
preserving OSM IDs in the tiles is a convenience, not a requirement. The new thing to prove is
**visual alignment** between the overlay and the basemap's road rendering.

### 0.2a Content feasibility — **done 2026-08-08**

Surveyed OSM coverage for the whole archipelago via Overpass (T-028). **No extract was needed**,
so this ran ahead of 0.2 rather than after it. Result: **OSM alone is sufficient and no external
data licensing arises** (D-029) — the 44 official PR routes are already in OSM. It also corrected
a factual error about levada tagging and produced hard scale numbers for the road graph.

Reproduce with `python tools/osm-survey.py`. Findings in `docs/osm-coverage.md`.

### 0.3 Distribution sanity check

Confirmed as out of scope for validation — the distribution strategy is organic sharing of
the end-of-trip video. No partner conversations required before building. This item is
recorded as **closed by decision**, not as completed work.

### Phase 0 success criteria

- [ ] Real traces from at least one levada and one tunnel route exist in the repo
- [ ] Blackout durations and error magnitudes documented in `docs/field-notes.md`
- [ ] Tile pack builds reproducibly from a script, with size recorded
- [ ] A locally-drawn overlay segment aligns cleanly with the basemap's road rendering (D-022)
- [x] Framework decision made and recorded — **React Native + Expo, TypeScript** (D-023)
- [x] OSM levada coverage assessed and the data source settled — **OSM alone** (D-029, T-028)

---

## Phase 1 — The recorder

**Goal:** A durable, battery-cheap, OS-survival-hardened location recorder. No map, no UI
beyond a debug screen.
**Depends on:** Phase 0.1 (informs sampling strategy), framework decision.

### Scope

- Integrate `expo-location` (free) behind a swappable `LocationProvider` interface (D-025).
  The paid Transistor Soft SDK is a contingency, purchased only if T-051–T-054 fail.
- Batched location delivery: iOS deferred updates, Android `setMaxWaitTime`
- Activity-recognition gating: stationary → near-zero, walking → coarse, driving → higher rate
- Barometer and pedometer capture alongside GPS
- SQLite schema with WAL, incremental flush on every batch — never hold a day in memory
- Permission flow: While-Using first, fully functional; Always requested later as an upgrade
- Android foreground service + battery optimisation exemption request
- iOS region monitoring + significant-location-change as the termination-survival backbone
- Self-check: 12–24h after install, verify recording is actually happening
- Debug screen showing raw fix count, last fix time, gaps, permission state, service health

### Success criteria

- [ ] A phone left untouched for 72 hours in a bag still has a continuous trace
- [ ] Force-quitting the app on iOS does not permanently stop recording
- [ ] Recording survives on at least one aggressive Android OEM device (Xiaomi/Samsung/Oppo)
- [ ] Measured battery cost is ≤5% per 12-hour day of normal tourist activity
- [ ] Zero bytes of network traffic attributable to the app during recording
- [ ] A crash mid-day loses seconds of data, not hours

### Milestone M1 — "It remembers"

A test device carried around Madeira for a full day produces a complete, gap-annotated trace
in the local database, with no user interaction after install.

---

## Phase 2 — Offline map rendering

**Goal:** The Madeira map renders beautifully, offline, at 60fps.
**Depends on:** Phase 0.2. **Visual direction:** `docs/design-brief.md` (D-026).

### Scope

- Bundle or first-run-download the tile pack (WiFi-gated)
- MapLibre GL Native integration
- **Two styles over one tile pack** (D-026): **light** for everyday in-app use, **dark** for the
  souvenir renderer and as a user preference
- **Both derived by subtracting from an existing permissively-licensed style** — Protomaps
  basemap themes, or CARTO Positron / Dark Matter over an OpenMapTiles-schema build. Not
  authored from a blank file. Verify licences.
- **Shaded terrain as the figure-ground element**, not building footprints — Madeira's relief is
  the island's defining feature and OSM building coverage is patchy outside Funchal
- Roads legible but recessive; minimal labels — city names and major cultural landmarks only
- Visited/unvisited styling via an overlay layer drawn from local `road_graph` geometry (D-022),
  using data-driven expressions. **Not** feature state — unavailable on MapLibre Native mobile.
- Accessibility pass **in both styles**: unvisited stays readable mid-grey; visited
  differentiated by **weight plus brightness/darkness**, never hue alone
- Respect system font scaling for labels
- Camera defaults: sensible island-wide framing, gentle constraints on pan/zoom bounds.
  Madeira-only until Porto Santo unlocks (D-024).

### Success criteria

- [ ] Map renders with the device in airplane mode from a cold start
- [ ] Recolouring 5,000+ segments does not drop frames
- [ ] Contrast between visited and unvisited passes a legibility check with an older tester
- [ ] **Both styles readable in Funchal midday sun, held at arm's length** — this is the test
      that decides whether D-026's light-for-use choice was right
- [ ] The visited trace is unambiguously the brightest thing on screen
- [ ] Tile pack size documented and acceptable for a hotel-WiFi download, terrain included

### Milestone M2 — "It looks like Madeira"

The island renders offline and clean in both styles, with a hand-set list of segments
highlighted.

---

## Phase 3 — Stamps, geofences and regions

**Goal:** The scoring system that carries the product. This is the hero mechanic.
**Depends on:** Phase 1, Phase 2, curated content.

### Scope

- Curate the POI list: **150–250 places**, hand-verified. Every place is assigned exactly one of
  **five categories — Viewpoints · Levadas · Villages · Beaches · Landmarks** (D-027). There is
  deliberately no "Other": a place that fits nowhere is a signal about the place.
- Region boundaries for per-region progress. **Regions serve the map screen** ("where should I go
  next"); **the passport is organised by category** (D-027).
- Dynamic geofence management: register the nearest ~18 regions (iOS hard cap is 20
  simultaneous), plus one large "you have left this area" trigger that reshuffles the set
- Stamp award rules: **dwell time + plausible speed**. In-geofence for N minutes at walking
  pace = awarded. Driving past at 60km/h = not awarded.
- Stamp artwork and the "passport" collection screen — **five category rows.** The levada row is
  different in kind: every other category means "you arrived somewhere", a levada stamp means
  "you walked the whole thing" (trailhead + exit geofence, D-009). Hardest to earn, most
  valuable, and it should look like it.
- Per-region progress display on the **map screen** (e.g. Funchal 60%, São Vicente 15%, Porto
  Moniz 0%). Denominator counts **unlocked regions only** (D-024).
- Confidence value stored alongside every award

### Success criteria

- [ ] Geofence set correctly reshuffles as the user moves across the island
- [ ] A stamp fires reliably on arrival at a miradouro
- [ ] Driving past a levada trailhead does **not** award the levada
- [ ] Stamp awards work with GPS accuracy degraded to 100m
- [ ] Battery cost of geofencing alone is negligible (target: not measurable above baseline)
- [ ] The passport screen is legible and pleasing with 3 stamps and with 200

### Milestone M3 — "It rewards you"

A day out produces stamps, a visible bump in regional progress, and no false awards.

---

## Phase 4 — Map matching and road highlighting — ⛔ **DEFERRED TO v2 (D-032)**

**Goal:** Travelled roads and levadas light up. Explicitly allowed to be imperfect.
**Depends on:** Phase 1 (traces), Phase 2 (rendering), Phase 0.1 (real fixtures).

### Scope

- Road/path graph in SQLite with R-tree spatial index
- Snap-to-segment matching with heading, speed and **altitude** in the cost function, plus
  hysteresis to stop flickering between vertically stacked roads (VR1 vs ER101 below it)
- Wide match corridor for paths: 50–75m, versus 15–25m for roads
- **Tunnel inference:** a fix at portal A and a fix at portal B within plausible travel time
  credits the entire tunnel. This is a certainty, not a guess.
- **Gap bridging:** shortest path across the graph between the last good fix and the next.
  Credit the route if length is consistent with elapsed time at plausible speed. Starting
  thresholds: gaps under ~30 minutes and ~15km. Tune against real fixtures.
- **Levada corridor crediting:** entry point + exit point credits the whole walk. Levadas are
  linear with no mid-route exits, so this is safe and needs no per-point matching.
- **Sensor fallback:** confident credit from trailhead + step count + elevation profile even
  with no usable GPS for the middle of a walk.
- Confidence score per credited segment, stored, never displayed
- Raw traces retained — matching must be re-runnable against history

### The governing rule

> **Be generous filling in gaps between things you are certain about.
> Be strict about what you are certain about.**

Credit the connection; verify the endpoints.

### Success criteria

- [ ] Every Phase 0 fixture trace produces a plausible, contiguous match
- [ ] A tunnel drive credits the tunnel with no fixes inside it
- [ ] A canopy-blackout levada is credited end-to-end
- [ ] The VR1 and the coastal road below it are not confused
- [ ] Re-running matching over stored raw traces reproduces or improves prior results
- [ ] Matching a full day of traces completes in a burst without noticeable battery cost

### Milestone M4 — "The map fills in"

A real day of driving and walking, including a tunnel and a levada, lights up correctly.

---

## Phase 5 — The souvenir

**Goal:** The end-of-trip video and image. This is the growth channel, not a nice-to-have.
**Depends on:** Phases 2–4.

### Scope

- **Trip-end detection:** geofence the airport (plus Porto Santo airport and the Funchal
  cruise terminal), with fallbacks — leaving the island bounding box, or 24h+ of no data
- The reveal notification at the departure lounge moment
- **Vertical 9:16 video**: animated trace drawing itself across the island, stamps popping in
  in the order collected, camera flyover, subtle watermark
- Still image export for those who prefer a screenshot
- Rendered entirely on-device, no server
- **Accommodation masking by default**: detect the most-frequent overnight location and mask
  a radius around it in all exports, or trim the first and last stretch of each day
- Share sheet integration

### Success criteria

- [ ] Video renders on-device in under ~30 seconds
- [ ] Output is vertical, watermarked, and visually good enough to post unprompted
- [ ] The user's accommodation is not identifiable in the default export
- [ ] Trip-end fires at the airport, not before
- [ ] The reveal works even if the user has not opened the app since install day

### Milestone M5 — "It hands you a souvenir"

A simulated week-long trip produces a video the team would actually post.

---

## Phase 6 — Simplicity, accessibility and compliance

**Goal:** Make it usable by an 80-year-old and shippable through both stores.
**Depends on:** Phases 1–5.

### Scope

- Ruthless UI reduction: one primary screen, one hero number
- Tap targets 60dp minimum, high contrast, large type, system font scaling respected
- Onboarding: minimal, plain-English, no jargon, and the app must be **fully functional with
  While-Using permission only**
- Prominent-disclosure screen before requesting background location (Android requirement)
- Exactly two notifications in a normal week: the day-1 health confirmation and the reveal
- Landmark tap → minimal card (name, photo, distance, one "Directions" button that hands off
  to Apple/Google Maps). No in-app navigation.
- Permission-downgrade detection (iOS can silently drop Always → While-Using) with a gentle
  recovery prompt
- **Dependency network audit**: confirm zero SDKs transmit anything. This is where these apps
  actually leak.
- iOS: `PrivacyInfo.xcprivacy` manifest, purpose strings, Data Protection class
  `CompleteUntilFirstUserAuthentication`
- iOS Privacy Nutrition Label: *Location → App Functionality → Not Linked to You → Not Used
  for Tracking*
- Android: Data Safety form declaring no collection, no sharing;
  `FOREGROUND_SERVICE_LOCATION` type; background-location review submission with
  demonstration video and written justification
- Privacy policy (short, because there is genuinely nothing to disclose)

### Success criteria

- [ ] An untrained older tester completes install → first stamp with no help
- [ ] Network traffic monitor shows zero outbound requests over a full simulated trip
- [ ] Both store privacy declarations are truthful and maximally clean
- [ ] Google Play background-location review passes

### Milestone M6 — "It is honest and easy"

Store-ready, privacy-clean, and usable without instruction.

---

## Phase 7 — Beta and launch

**Goal:** Real trips, real traces, real feedback.

### Scope

- Closed beta with actual visitors on actual trips
- Collect **voluntarily submitted** traces only, via explicit export — never automatic upload
- Tune matching thresholds and geofence radii against real-world data
- Store submission, screenshots, listing copy
- Launch

### Success criteria

- [ ] ≥10 real week-long trips recorded end to end without a tracking failure
- [ ] No beta tester reports a missing levada or a false stamp
- [ ] At least half of beta testers share their souvenir video unprompted

---

## Milestone summary

| ID | Milestone | Phase | Meaning |
|---|---|---|---|
| M0 | Assumptions validated | 0 | The terrain and the tiles will not surprise us |
| M1 | It remembers | 1 | Durable, cheap, ghost-mode recording |
| M2 | It looks like Madeira | 2 | Offline map renders beautifully in both styles (D-026) |
| M3 | It rewards you | 3 | Stamps and regional progress work |
| M4 | The map fills in | 4 | Roads and levadas highlight correctly |
| M5 | It hands you a souvenir | 5 | The shareable video exists |
| M6 | It is honest and easy | 6 | Accessible, private, store-compliant |
| M7 | Launched | 7 | Live, with real trips behind it |

---

## Outstanding decisions

These are open and must be resolved. Owner is the project lead unless noted.

### OD-4 — Monetisation
**Deferred, not blocking.**
The printed poster/map idea is explicitly parked. For now: free, no IAP, no ads (ads would
also destroy the privacy position). Revisit after launch data.

### OD-5 — Cruise-ship day-trippers as a target segment
**Not blocking, affects content curation.**
An 8-hour Funchal visit is a very different app from a 7-day island trip. Current plan is to
design for the multi-day visitor and let day-trippers be a happy accident. If pursued later,
it would argue for a much tighter Funchal-centric POI set.

### ~~OD-7 — Levada data source and licensing~~ → **Resolved 2026-08-08**
Moved to Resolved below. Recorded as **D-029**.

---

## Resolved decisions

### OD-1 — Framework → **React Native** (2026-08-06)
Recorded as D-023. With `@maplibre/maplibre-react-native` v11 and Expo tooling. Decided on
technical merit: the map view is the entire app and React Native embeds native views as
first-class components; the v11 API mirrors the MapLibre GL JS style spec, so the web
documentation corpus transfers to our styling work; and `expo-location` is a single
first-party package covering the geofence backbone. **The project lead has no JavaScript
background** and will be learning alongside — see CONTEXT.md §6.7. **This unblocks Phase 1.**

### OD-2 — Is Porto Santo in scope? → **Yes, included** (2026-08-06)
Recorded as D-021. Adds Porto Santo to the tile extract, POI curation, region list and
trip-end detection. Two consequences to watch: the "left the island bounding box" trip-end
fallback must treat both islands as one region, or a day trip would falsely end the trip; and
the ferry crossing produces a marine gap that gap-bridging must not try to credit as a road
route.

### OD-3 — The hero number: roads or places? → **Stamps/places** (2026-08-06)
Recorded as D-002, now Accepted. Road coverage % and per-region progress remain as supporting
detail, never as the headline. This is what makes the system degrade gracefully: the user's
reward does not depend on map matching succeeding.

### OD-7 — Levada data source and licensing → **OSM alone** (2026-08-08)
Recorded as D-029, measured by T-028. The concern was that official PR-route data might have to
be licensed and reconciled in. **Moot — the 44 official PR routes are already in OSM** as
ref-carrying hiking relations. No second source, no licensing negotiation, no reconciliation
pipeline; everything stays ODbL. The survey also corrected a factual error: levadas are *not*
simply `highway=path` (that captures 23%), because OSM maps a levada as two parallel ways sharing
one name — the channel and the footpath. Select by **name + relation, never by tag**. Full
measurements in `docs/osm-coverage.md`. **The risk moved from coverage to accuracy**, which only
fieldwork can settle.

### OD-6 — Raw trace retention policy → **Retain** (2026-08-06)
Recorded as D-010, now Accepted. Raw fixes and sensor samples are immutable and kept for the
life of the trip, enabling improved matching to be re-run over history. Counterweighted by a
single obvious "delete all my data" control (T-125). Nothing leaves the device, so exposure is
low.

---

## Recently closed, previously untracked

- ~~**Who does the Phase 0 fieldwork, and are they on the island?**~~ **Resolved 2026-08-06 — the
  project lead lives in Madeira.** The "validate before building" sequencing stands unchanged and
  field validation is a continuous capability rather than a one-off trip. See CONTEXT.md §5a.
- ~~**Transistor Soft licence spend.**~~ **Resolved 2026-08-06 by D-025** — not purchased. Build
  on free `expo-location` behind a swappable interface; buy only if T-051–T-054 fail. Dependency
  cost is currently **$0**.
- ~~**Doc-maintenance latitude.**~~ **Resolved 2026-08-08** — three-tier protocol recorded in
  CONTEXT.md §9. Default for anything new is Provisional.

### Still open

**The app has no name and no domain** (as of 2026-08-08). The bundle identifier
`com.madeiraexplorer.app` is a working placeholder — permanent only after store publication, so
it must not block the dev build.

**Deliberately deferred, not merely outstanding.** Nothing before Phase 5 depends on it, and
naming now would mean naming a product nobody has seen. Revisit once the tile spike renders the
real style (T-025) and a souvenir exists (T-105); **decide before the Google Play demo video
(T-123), not before the store listing.** A five-name shortlist with reasoning is recorded in
`docs/design-brief.md` §7.4 — **none of them checked.** Search INPI and EUIPO plus both app
stores before committing, and avoid anything reading as an official regional-tourism asset; §7
records why that is not a hypothetical risk.

---

## Known risks

| Risk | Severity | Mitigation |
|---|---|---|
| Google Play rejects background location | High | Prominent disclosure, demo video, strong justification. Budget time for slow re-review cycles. |
| Android OEM battery killers silently stop recording | High | Foreground service, battery-optimisation exemption, day-1 health check, honest gap reporting. |
| GPS blackouts make levadas unmatchable | Medium | Corridor crediting, barometer, pedometer. Stamps as the safety net so the reward survives total matching failure. |
| ~~Tile pack with stable OSM IDs proves infeasible~~ | ~~Medium~~ | **Retired 2026-08-06 by D-022** — no longer a dependency. |
| Overlay roads misalign with basemap roads (doubled/offset lines) | Medium | Same OSM source for both, so geometry matches; if line-width matching across zooms is troublesome, suppress basemap roads and draw all roads from the overlay. |
| MapLibre mobile API churn (feature state parity is actively in flux upstream) | Low | D-022 removes our dependency on the unstable surface. Avoid depending on newly-landed upstream APIs generally. |
| Users never find the app | High | The souvenir video is the entire distribution strategy. It must be genuinely good. |
| Slow-fill demotivation over a 7-day trip | Medium | Curated canvas + per-region progress + stamps, rather than island-wide road %. |
| A third-party SDK quietly transmits data | Medium | Explicit dependency network audit in Phase 6; target zero networked dependencies. |
| Custom cartography does not reach an acceptable standard — the map is the most-viewed surface in the app | Medium | Start from an existing professionally-made style and subtract, rather than authoring from scratch (D-026). Judge against a testable bar, outdoors in Funchal sun (T-065), not against Apple Maps' general-purpose polish — different job, different target. |
| The app's name collides with a government or tourism-board trademark | Low | Search INPI and EUIPO before committing; avoid names implying official endorsement. A directly comparable app is currently subject to a cease and desist for exactly this. |

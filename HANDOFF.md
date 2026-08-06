# Session Handoff

**Written:** 2026-08-06, at the end of the planning conversation.
**For:** a fresh Claude Code session picking this project up cold to begin implementation.
**Repository state:** documentation only. No code, no dependencies, no `package.json`, not a
git repository.

---

## Read this in order

1. **`CONTEXT.md`** — the cold-start briefing. Written specifically for you. Read it fully
   before doing anything, especially §2 (the five load-bearing ideas), §3 (hard constraints)
   and §6 (coding conventions).
2. **`DECISIONS.md`** — 25 numbered decisions with alternatives and reasoning. Read before
   proposing anything that contradicts one.
3. **`TASKS.md`** — the ordered checklist. Start here for what to actually do.
4. `ARCHITECTURE.md`, `PROJECT_PLAN.md`, `README.md` — reference as needed.

**These six documents are the source of truth, not this handoff and not any chat history.**
If this file and those disagree, they win.

---

## Where the project stands

Planning is complete. **Every blocking decision is closed.** Phase 0 can begin immediately.

| | |
|---|---|
| Framework | React Native + Expo, **TypeScript** |
| Map | `@maplibre/maplibre-react-native` v11, offline PMTiles/MBTiles |
| Location | `expo-location` (free) behind a swappable `LocationProvider` |
| Storage | SQLite, WAL, R-tree spatial index |
| Backend | **None.** Zero servers, zero accounts, zero analytics. |
| Dependency cost | **$0** |
| Unavoidable spend | Apple $99/yr, Google Play $25 once — at launch, not now |

### The one thing still marked Provisional

**D-022** — drawing visited roads as our own overlay rather than recolouring basemap features.
It is a technically-forced change (the `setFeatureState` API is not reliably available on
MapLibre Native mobile) and the project lead has not explicitly confirmed it. It does not block
Phase 0. Raise it when the tile spike produces something concrete to look at.

---

## What the app is, in four sentences

A tourist installs it on arrival in Madeira, grants location permission, and forgets it exists.
It passively records where they go, lighting up roads and levada trails they travel and
awarding collectible "passport stamps" for reaching curated notable places. When they reach the
airport to fly home, their phone buzzes and hands them a map of their whole trip plus a vertical
video good enough to post. That video is the entire marketing strategy.

---

## The five things that explain most of the design

Restated from `CONTEXT.md` §2 because misunderstanding any of them will produce wrong work.

1. **Stamps are the score; highlighted roads are decoration.** Map matching is the fragile part,
   so the user's reward deliberately does not depend on it. Never let road coverage % become the
   headline metric.
2. **Geofences are the backbone.** Cheapest on battery, survive app termination and force-quit
   on iOS, tolerate poor GPS. Everything important rides on them.
3. **The souvenir video is the only distribution channel.** Not a polish item — load-bearing.
4. **Raw traces are the only irreplaceable asset.** Everything derived is regenerable. Build the
   recorder first.
5. **The bounded scope is what makes it all simple.** Madeira is ~740 km², so the whole island
   ships offline. No tile server, no network, no data cost, no position leaking to third parties.

---

## Start here

Phase 0 has **two independent tracks** that can run in either order or in parallel. Neither
requires writing app code, and neither costs money.

### Track A — Field GPS validation (T-017 → T-021a)

The project lead **lives in Madeira**, so this is an afternoon, not an expedition. **No code is
required** — use an off-the-shelf logger.

#### Tooling: Sensor Logger

**Sensor Logger** by Kelvin Choi (iOS + Android) —
`https://apps.apple.com/us/app/sensor-logger/id1531582925`

Chosen because it captures GPS, barometer and pedometer **in one time-aligned session**,
exports CSV/JSON/SQLite, has companion parsing tooling at
`github.com/tszheichoi/awesome-sensor-logger`, and is cross-platform so the same procedure
works for the Android comparison run (T-021a).

The **paid tier is required** — it unlocks combined CSV export plus the barometric-altitude and
pedometer channels, which are the whole point of the exercise.

#### Setup

1. Install Sensor Logger; buy the paid tier.
2. Enable **Location**, **Barometer** and **Pedometer**.
3. Set location to the **highest sample rate available.** These runs characterise the terrain —
   they are deliberately not a simulation of how the finished app samples. Maximum fidelity.
4. Bring a power bank. High-rate logging for a three-hour walk drains the battery, and that is
   expected.

#### Run 1 — the levada (T-018)

- Pick one with genuine Laurissilva canopy, ideally including a tunnel section.
- Start recording at the trailhead, stop at the exit.
- **Carry the phone as a tourist would** — pocket or daypack, *not* held up to the sky.
  Hand-held data looks better than reality and would produce falsely optimistic thresholds.

#### Run 2 — the tunnel drive (T-019)

- Any substantial VR1/VE1 stretch.
- Prioritise a section where the expressway runs **above or below the old ER101 coastal road**
  — that is the case where altitude has to do the work of telling them apart.

#### Ground truth (T-017a)

**Take a photo at every key waypoint** — trailhead, each tunnel portal, the exit. EXIF supplies
timestamp and location for free. Without ground truth a trace is an ungradeable squiggle; the
entire exercise is comparing what the sensors *recorded* against what actually *happened*.

#### Afterwards

- Document blackout durations and error magnitudes in `docs/field-notes.md` (T-020).
- Commit exports and photos to `tools/fixtures/` — **these become the permanent matching
  regression suite** (T-021). Every future matching change is tested against them.
- **Repeat at least one run on a mid-range Android** before finalising any Phase 4 threshold
  (T-021a) — see the warning below.

#### Questions these runs must answer

- Does the barometer stay usable inside tunnels and under canopy?
- Does altitude reliably separate the VR1 from the coastal ER101 below it?
- Does the pedometer keep counting through GPS blackouts?
- How long are the blackouts, in seconds and metres, and how large is the error on recovery?

#### ⚠ Sampling bias warning

The project lead's **iPhone 15 has better GNSS than much of what tourists actually carry.**
iPhone-only fixtures are best-case. Tuning corridor widths and gap thresholds against them
risks shipping an app that quietly **under-credits users on mid-range Android hardware** —
precisely the failure mode identified as an uninstall trigger (D-009). Do not finalise Phase 4
thresholds on iPhone data alone.

### Track B — Tile pipeline spike (T-022 → T-026)

1. OSM extract of **Madeira and Porto Santo** (T-022).
2. Reproducible tile build script — Tilemaker or Protomaps — producing PMTiles or MBTiles
   (T-023).
3. Prove overlay rendering: a MapLibre demo drawing a highlighted road from *local* geometry
   over the basemap, and confirm it **aligns** with the basemap's own road rendering (T-025).
4. Evaluate suppressing basemap roads entirely and drawing all roads from the overlay, which
   makes alignment a non-issue by construction (T-025a).
5. Record tile pack size (T-026).

Note T-024 (stable OSM way IDs in tiles) was downgraded from "critical decision gate" to
nice-to-have by D-022. Do not treat it as a blocker.

### Then Phase 1 — the recorder (T-029 onward)

Scaffold Expo + React Native **in TypeScript**. Background location requires a development
build, not Expo Go. Define the `LocationProvider` interface (T-030a) *before* integrating
`expo-location` (T-031), so the paid SDK stays a cheap swap.

---

## Working agreement with the project lead

**Keep the docs current, unprompted.** This was an explicit instruction. When an architectural
or planning decision is made, update the affected documents in the same piece of work — not
later. The full protocol, including which document to update for which kind of change, is in
`CONTEXT.md` §9. Key conventions: `D-0xx` and `T-xxx` IDs are stable and never renumbered;
supersede rather than delete; always record rejected alternatives; and mark anything the
project lead has not explicitly confirmed as **Provisional**, not Accepted.

**They have no JavaScript, TypeScript or web background.** They chose React Native on technical
merit anyway and are learning as they go. Don't assume web idiom — no DOM, no CSS quirks, no
bundler folklore. Prefer explicit, boring code over idiomatic cleverness. When something is
JavaScript-ecosystem weirdness rather than a real concept, say so plainly instead of letting
them think they've misunderstood something fundamental. Full guidance in `CONTEXT.md` §6.7.

**They are not a beginner in general.** They reason carefully about architecture, push back well
on cost and scope, and improved several designs during planning — the Porto Santo unlock
mechanic (D-024) was theirs and is better than what was proposed. Explain the language, not the
thinking.

**They live in Madeira.** Never treat field verification as expensive or something to batch up.
When a matching threshold, geofence radius or battery figure is in doubt, the right advice is
"go and measure it."

---

## Things that are easy to get wrong

Collected because each one was reasoned about carefully and would be expensive to rediscover.

**`setFeatureState` does not work reliably on MapLibre Native mobile.** It is a GL JS (web) API.
Do not design around it. Data-driven style *expressions* are fine; only runtime per-feature
state mutation is the problem. See D-022.

**iOS: region monitoring and significant-location-change relaunch a terminated app even after
force-quit. Standard background location updates do not.** This single fact is why geofences
are the backbone. Re-verify against current Apple docs before implementing.

**iOS caps simultaneous monitored regions at 20.** With 150–250 POIs the geofence set must be
swapped dynamically — nearest ~18 plus one large "you left this area" trigger. Painful to
retrofit; build it in from the start.

**iOS Data Protection must be `CompleteUntilFirstUserAuthentication`.** Full `Complete` fails,
because the app writes while the device is locked.

**Android OEMs kill background work regardless of the official APIs.** Foreground service plus
battery-optimisation exemption. Also: `expo-location` does not auto-restart a terminated app on
Android — that is the known gap in the free stack (D-025), and the day-1 health check exists
partly to catch it.

**Google Play manually reviews background-location apps and rejects many.** Demo video and
written justification required. Slow re-review cycles. It sits on the critical path — start it
early.

**Porto Santo stays hidden until the user goes there** (D-024). But two things apply regardless
of unlock state: both islands count as one region for trip-end detection, or a ferry day trip
falsely ends the holiday; and gap-bridging must not credit a road route across the ocean. Those
are Madeira bugs, not Porto Santo features.

**The stamp denominator must count unlocked regions only**, or the headline number breaks in
exactly the way D-024 exists to prevent.

**Accessibility beats aesthetics.** Unvisited roads stay legible mid-grey, never near-black.
Differentiate visited by brightness *and* line weight, never hue alone. The dark aesthetic and
the "usable by an 80-year-old" goal genuinely conflict; accessibility wins (D-015).

**The souvenir video is an export of location history.** Mask the user's accommodation by
default (D-016). It is the one real privacy hole in an otherwise airtight design.

**Backup policy: include the database, exclude the tile pack** (ARCHITECTURE.md §4a). Android's
auto-backup cap can be exceeded by the tile pack alone, and exceeding it can silently fail the
entire backup — taking the user's trip history with it.

**Audit every dependency's network behaviour.** This is where these apps actually leak — not
through carelessness with the database, but through an analytics or crash-reporting SDK that
phones home by default. Target zero networked dependencies. Adding any network call requires a
recorded decision.

---

## Open questions, none blocking

| ID | Question | Status |
|---|---|---|
| OD-4 | Monetisation | Deferred. Free for v1, no ads ever (would break the privacy position). |
| OD-5 | Cruise day-trippers as a segment | Open, affects content curation only. |
| OD-7 | Levada data source and licensing | Not yet decidable — needs the OSM coverage assessment in T-028 first. |
| — | Confirm D-022 | Provisional, does not block Phase 0. |

Also unresolved, cheap to settle: whether Transistor Soft debug builds run unlicensed. Only
matters if the free stack fails its soak tests (T-051–T-054), which is when the $399 purchase
decision arises at all.

---

## Decision trail from the planning conversation

For context on how the design arrived where it did. Full reasoning for each is in
`DECISIONS.md`.

- **D-001** No backend, fully on-device — every constraint pointed the same way
- **D-002** Curated canvas; stamps are the score, not island-wide road coverage
- **D-003** Passport stamps, not stars
- **D-004** MapLibre GL Native + offline vector tiles *(feature-state half revised — see D-022)*
- **D-005** Geofences as the system backbone
- **D-006** Transistor Soft assessed *(superseded in part by D-025 — now a contingency)*
- **D-007** Cross-platform, not fully native
- **D-008** Fully usable with While-Using permission; Always is an upgrade, never a gate
- **D-009** Bias matching toward false positives — *be generous filling gaps between things you
  are certain about; be strict about what you are certain about*
- **D-010** Retain raw traces; matching is a replaceable layer
- **D-011** Exactly two notifications per trip
- **D-012** Airport geofence as the trip-end trigger
- **D-013** The souvenir video is the distribution strategy
- **D-014** Printed poster monetisation deferred
- **D-015** Accessibility beats aesthetics
- **D-016** Mask accommodation in exports by default
- **D-017** All Madeira content is data, not code
- **D-018** Never build navigation — hand off to Apple/Google Maps
- **D-019** Build the recorder before the visualisation
- **D-020** Validate physical assumptions before committing to street-level matching
- **D-021** Porto Santo included structurally
- **D-022** Overlay rendering, not feature state *(Provisional)*
- **D-023** React Native
- **D-024** Porto Santo hidden until the user goes there
- **D-025** Free location stack; paid SDK only on evidence

---

## Suggested opening message for the new session

> This is the Madeira Explorer project. Read `CONTEXT.md`, `DECISIONS.md` and `TASKS.md` first —
> they are the source of truth and planning is complete. I want to start Phase 0. Begin with
> [Track A: the field GPS validation / Track B: the tile pipeline spike].

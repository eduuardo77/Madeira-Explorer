# Session Handoff

**Written:** 2026-08-06, at the end of the planning conversation.
**Updated:** 2026-08-06 after the first implementation session; 2026-08-08 after the design
session (D-026, D-027, D-028; D-022 confirmed; `docs/design-brief.md` added); 2026-08-10 after
building the geofence manager, the content pack, the sampling gate (T-039/D-033, T-040/D-034,
T-034, `docs/dev-build.md`) and then the map itself — light style and shaded terrain
(T-058/T-058a, D-035, `docs/map-style.md`) and its integration into the app — MapLibre, bundled
packs, the trace layer (T-056/T-057/T-059, D-036).
**For:** a fresh Claude Code session picking this project up cold.
**Mode: EXECUTION.** Planning is over. The project lead said, plainly: *"Tired of planning."*
Do not open new research threads. Do not propose new decisions unless something is actually
blocked. Build the things in "Start here" below.
**Repository state:** git repository. Planning docs plus a Phase 1 recorder in `app/` — 27
source files, ~4,400 lines. **None of it has ever run on a phone.** The pure logic — geofence
selection, content-pack parsing and the sampling gate — is the only part that has ever run at
all: 47 unit tests, `cd app && npm test`. Phase 0 has produced its first result: the OSM coverage survey
(T-028, D-029).

---

## Read this in order

1. **`CONTEXT.md`** — the cold-start briefing. Written specifically for you. Read it fully
   before doing anything, especially §2 (the five load-bearing ideas), §3 (hard constraints),
   §6 (coding conventions) and **§9 (the doc-maintenance protocol you are expected to follow)**.
2. **`DECISIONS.md`** — 34 numbered decisions. **Read D-032 first** — it defines v1 scope and
   deletes a large amount of work you might otherwise start.
3. **`TASKS.md`** — the ordered checklist. Start here for what to actually do.
4. `ARCHITECTURE.md`, `PROJECT_PLAN.md`, `README.md` — reference as needed.
5. `docs/design-brief.md` — visual direction and screen structure. Read before touching anything
   that renders. Its §1 explains why the "UI work" on this app is mostly cartography.

**These seven documents are the source of truth, not this handoff and not any chat history.**
If this file and those disagree about a *decision*, they win.

The exception is **implementation status**: what is built, what is unverified, and what is
waiting on the project lead is recorded here and in `TASKS.md`. Read both before writing code —
this file explains the shape of what exists, `TASKS.md` tracks it task by task.

---

## Where the project stands

Planning is complete, **scope has been cut (D-032)**, and the project is moving to execution.
Phase 0 is half done. Phase 1 is implemented but entirely unproven.

**v1 = record → stamps by geofence → draw the raw trace → passport → souvenir.**
Phase 4 map matching is **v2**. The effort saved goes into the interface and the map.

| | |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, **TypeScript strict** |
| Map | `@maplibre/maplibre-react-native` 11.3.6, **installed and wired** (T-056): offline PMTiles + bundled glyphs, trace drawn from `raw_fix` (T-059). Never rendered on a device. |
| Location | `expo-location` (free) behind a swappable `LocationProvider` |
| Storage | SQLite, WAL. *(R-tree and road graph are v2 — D-032)* |
| Tiles | **Built.** 12.6 MB basemap (D-030) + 6.5 MB terrain (D-035) = 19.1 MB. Styles generated: `tiles/style/generate.mjs` |
| Backend | **None.** Zero servers, zero accounts, zero analytics. |
| Dependency cost | **$0** for the app. Track A needs Sensor Logger's paid tier (tooling, not a dependency). |
| Unavoidable spend | Apple $99/yr, Google Play $25 once — at launch, not now |

### ⚠ The single most important thing to know

**No line of this app has ever executed on a phone.** What has been verified is that it is
*well-formed*: `tsc --noEmit` clean under strict, Metro bundles 664 modules, `expo-doctor`
20/20, and config introspection confirms the entitlements and manifest attributes reach the
native config. Since 2026-08-10, the pure logic is also unit-tested — 47 tests, on Node.

None of that proves a GPS fix would land in the database. No permission dialog has been seen,
no battery figure measured, no OEM survival tested. Treat every Phase 1 claim as a hypothesis
until a development build exists — which is the first blocker below.

### What is Provisional

**D-022 is now Accepted** (confirmed 2026-08-08, T-016a closed).

Three new decisions from the 2026-08-08 design session are **Provisional** — agreed by the
project lead, but not yet validated against anything real:

- **D-026** — two map styles, light for use and dark for the souvenir; figure-ground from shaded
  terrain, not buildings. Confirm after T-025, and after looking at both styles outdoors in
  Funchal midday sun.
- **D-027** — the passport is organised by category (five named rows), not by region. Region
  moves to the map screen.
- **D-028** — sampling gates on stationary-vs-moving; walking-vs-driving deferred; the pedometer
  classifies but never gates recording.
- **D-033** *(2026-08-10)* — the geofence window: rank by edge distance, spend one region slot
  on an exit-only anchor sized from a stated safety property, and back it up with recorded
  fixes. Unit-tested but built on three guessed constants; **T-076 is what confirms or kills
  it**, and it is a five-minute walk.
- **D-034** *(2026-08-10)* — the content pack: one JSON file outside `app/`, compiled in,
  validated by the same parser at runtime and in `tools/validate-content.mjs`. A place owns one
  or more geofences, so a levada can carry a start and an end. **T-066 is what will find its
  gaps** — the format has never met a real list.
- **D-035** *(2026-08-10)* — terrain ships as raw elevation (6.5 MB, z≤12), shaded at render
  time so one pack serves both styles. Confirmed or killed by hillshade rendering on
  `maplibre-react-native` (T-056) and the outdoor look test (T-065).
- **D-038** *(2026-08-10)* — a **web design workbench** (`cd app && npx expo start --web`),
  because there is no device on this project and an interface nobody can look at cannot be
  judged. It is not a product target and must never become one. It paid for itself on the
  first run: it measured T-081 and caught a 38 px control overlap on a 320 dp phone.
- **D-037** *(2026-08-10)* — stamp awards: dwell **and** speed gates, and levadas verify both
  endpoints independently so driving between two trailheads cannot earn one. Missing speed
  lowers confidence rather than vetoing. Every threshold is a guess; T-131 retunes them over
  holidays already recorded, which is what storing the judgement inputs buys.
- **D-036** *(2026-08-10)* — the map is bundled in the binary, not downloaded on first run.
  19.1 MB rides along; first launch copies it into the **cache** directory, which both
  platforms keep out of backups by construction — so regenerable tiles can never crowd out the
  irreplaceable trip history (ARCHITECTURE §4a).

Full visual direction and primary-screen structure: **`docs/design-brief.md`**.

### The scope cut — read this before starting anything (D-032)

The engineering ambition had grown far past the original brief. The project lead reset it:
*an app that records where you walked and gives you a badge for levadas and notable places* —
and set the priority: **a good interface matters more than GPS accuracy.**

- **Phase 4 (T-082–T-098) is deferred to v2 in full.** No road graph, no R-tree, no snapping, no
  tunnel inference, no gap bridging, no corridor crediting, no sensor fallback.
- **v1 draws the raw GPS trace** instead. Honest, personal, and it needs no matching at all.
- **Deferring costs nothing permanent** — D-010 retains raw traces, so matching can be added in
  v2 and run *retroactively over every trip already recorded*.
- **Stamps need almost no accuracy.** A generous radius plus a dwell-and-speed gate works under
  canopy on cheap hardware. That is the whole reward, and it is the cheapest subsystem here.

This was a return, not a pivot: D-002 always said stamps are the score and roads are decoration.

### What the 2026-08-08 session settled

A design session, no code. Six planning docs updated plus one new file.

- **The visual direction exists now**, where before there was none. Two styles over one tile
  pack, terrain rather than buildings, a three-control primary screen, and a passport organised
  by category. All of it in `docs/design-brief.md`.
- **The doc-maintenance latitude question is answered** — three tiers, in CONTEXT §9. Follow it.
  The default for anything new is **Provisional**; the burden is on confirmation, not objection.
- **The activity-gating trigger is decided** (D-028), so T-034 is no longer blocked.
- **D-022 was confirmed**, closing the last Provisional entry from planning.
- **Four stale statements were corrected** under the tier-1 rule: the ARCHITECTURE §2 diagram,
  a PROJECT_PLAN Phase 0 success criterion, PROJECT_PLAN's "newly raised" section, and README's
  claim that no code had been written.
- **The app still has no name.** Deliberately deferred — see below.

### First Phase 0 result — T-028, the OSM survey

Also 2026-08-08, after the design work. **`docs/osm-coverage.md`**, reproducible via
`python tools/osm-survey.py` (counts only, no geometry, safe to re-run).

- **OD-7 is closed** (D-029). No external levada data needs licensing — the 44 official PR
  routes are already in OSM. Dependency cost stays $0.
- **A factual error was corrected.** Levadas are *not* simply `highway=path` — that captures 23%.
  OSM maps a levada as two parallel ways sharing one name: the channel (usually
  `waterway=drain`) and the path beside it. **Select by name plus relation, never by tag.**
- **108 levada tunnel ways**, where the docs said "several." Walkable, zero GPS — the T-089/T-090
  case, and T-069 must now cover walkable tunnels.
- **~51,000 highway ways.** T-064's "5,000+ segments" target was an order of magnitude low, and
  T-025a — drawing *all* roads from the overlay — means rendering all 51,000, not 5,000.
- **16,066 footways**, nearly all Funchal pavements. Whether they belong in the road graph is now
  an explicit open question on T-082.
- **T-066 is selection, not research** — 569 viewpoints and 180 peaks already in OSM.

The risk on levadas moved from *coverage* to *accuracy*, which counts cannot settle. **T-028a**
folds that check into a Track A field walk.

The design session's most useful artefact may be the competitor teardown in
`docs/design-brief.md` §6.
Three of this project's decisions turn out to be visible in a shipped competitor as observed
failures: a `0.00%` hero number (what D-002 rejected), a modal begging users not to force-quit
(what D-005 avoids architecturally), and a 22-minute walk credited zero (the D-009 uninstall
case). Concrete evidence, worth keeping.

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

## What is already built

Six commits: planning docs and the repository skeleton, the Phase 1 recorder skeleton, a
TASKS.md status update, a HANDOFF.md rewrite, the 2026-08-08 design session, then the first
Phase 0 result (T-028 OSM survey).

```
app/
├── app.json                          purpose strings, permissions, iOS data-protection
│                                     entitlement, plugin list
├── plugins/withAndroidBackupRules.js writes the §4a backup rules + manifest attributes
├── index.ts                          imports backgroundTasks for its side effects — see below
└── src/
    ├── ui/                           the interface (D-032 says this is where effort goes)
    │   ├── PassportView.tsx          T-074, presentational — five rows (D-027)
    │   ├── PassportScreen.tsx        the container that loads it
    │   ├── PrimaryOverlay.tsx        T-075, the three controls over the map
    │   ├── DebugScreen.tsx           T-050, the instrument panel
    │   └── theme.ts                  D-015 encoded as values
    ├── progress/                     T-071/T-072a/T-073. The reward (D-037).
    │   ├── stampRules.ts             pure: does this place become a stamp?
    │   ├── stampRules.test.ts        23 tests, incl. the named T-078 drive-by case
    │   ├── stampAwards.ts            the re-runnable pass that writes stamp_award
    │   ├── tripProgress.ts           pure: the hero number and its breakdown
    │   ├── tripProgress.test.ts      13 tests, mostly on D-024's denominator trap
    │   └── currentProgress.ts        the same, from the database
    ├── content/                      T-040. The pack's only entry point (D-034).
    │   ├── contentPack.ts            parse + validate; pure, unit-tested
    │   ├── contentPack.test.ts       16 tests
    │   └── poiCatalogue.ts           the one module that reads ../../../content/
    ├── storage/                      ~550 lines. COMPLETE.
    │   ├── migrations.ts             6 tables, numbered migration runner
    │   ├── database.ts               WAL, foreign keys, deleteAllUserData()
    │   ├── types.ts                  row shapes, narrow string unions
    │   └── dao/                      rawFix, sensorSample, geofenceEvent,
    │                                 recordingEvent, trip, appState
    ├── recording/                    ~1,400 lines. COMPLETE BUT INERT.
    │   ├── LocationProvider.ts       the D-025 seam — read this first
    │   ├── ExpoLocationProvider.ts   the only file allowed to import expo-location
    │   ├── backgroundTasks.ts        TaskManager.defineTask, module scope
    │   ├── taskNames.ts              the two task-name strings, alone, to break a cycle
    │   ├── recordingSink.ts          writes batches to SQLite; never throws
    │   ├── sensors.ts                barometer + pedometer, with two honest limitations
    │   ├── samplingPolicy.ts         profiles — ⚠ NUMBERS ARE NOT TUNED
    │   ├── movementPolicy.ts         T-034, pure: stationary or moving? (D-028)
    │   ├── movementPolicy.test.ts    13 tests
    │   ├── samplingGate.ts           T-034, applies the decision to the provider
    │   ├── distance.ts               haversine; the only geometry in v1
    │   ├── geofenceSelection.ts      T-039, pure and unit-tested (D-033)
    │   ├── geofenceSelection.test.ts 18 tests — `cd app && npm test`
    │   ├── geofenceManager.ts        T-039, the half that talks to the OS and SQLite
    │   ├── devPoiFixture.ts          synthetic places for a field test; deleted at T-040
    │   └── recorderHealth.ts         feeds the debug screen, T-048 and T-049
    └── ui/                           ~520 lines
        ├── DebugScreen.tsx           the only screen that exists
        └── theme.ts                  D-015 encoded as values, not intentions
```

**Tables beyond the documented schema:** `recording_event` (the recorder's own diary — a
silence in `raw_fix` cannot otherwise be told apart from a dead service, and ARCHITECTURE §10
demands honest gaps) and `app_state` (small key/value: Porto Santo unlock flag, health-check
timestamp, last permission state).

**Append-only is enforced, not assumed.** SQLite triggers abort any `UPDATE` on `raw_fix` and
`sensor_sample`. `DELETE` is left open because T-125 has to be able to wipe.

**The sink is a statically imported module, not a runtime callback.** This looks inflexible and
is deliberate: when the OS relaunches the app headless there is no React tree to hand a callback
to. Expo's docs are explicit that `defineTask` must run in the global scope of the bundle, which
is why `index.ts` imports `backgroundTasks` for side effects. Do not "tidy" that import away.

### What would happen if you ran it

App opens → database migrates → debug screen. *Request While-Using* shows a real permission
dialog. *Start recording* registers the background task. Batches arrive → sink writes `raw_fix`
rows plus one `sensor_sample` → counts and last-fix age update on screen. That is the whole
loop, and it *should* work.

### ~~The largest hole in Phase 1~~ — closed 2026-08-10 (T-039)

**The geofence manager is built.** It was the biggest gap in the phase: `startGeofencing()`
existed but nothing ever called it with regions, so `geofence_event` could only stay empty.

- `src/recording/geofenceSelection.ts` — pure arithmetic: rank the catalogue by *edge* distance,
  keep the nearest `cap − 1`, and size an exit-only anchor region so that **while you are inside
  it you cannot have reached anything unmonitored**. The rule and its three guessed constants
  are **D-033**.
- `src/recording/geofenceManager.ts` — the impure half: the OS, SQLite, the clock. Rebuilds on
  the anchor's exit event, and again from recorded fixes as a backstop against a missed event.
  Never throws, and never clears the monitored set on failure.
- `src/recording/devPoiFixture.ts` — synthetic places generated around wherever the phone is
  standing, so all of this can be exercised before T-066 exists and without any Madeira
  knowledge entering `app/` (D-017).
- **The content seam is one line**, and T-040 filled it the same day. `index.ts` calls
  `setPoiCatalogue(withDevFixtureFallback(contentPoiCatalogue))` — the real pack, with the
  synthetic fixture standing in while `content/pois.json` is empty, in development builds only.
  Format, loading and validation are **D-034**; `app/src/content/` holds the reader and
  `content/README.md` is the curator's guide.

**The project now has unit tests** — 18 of them, over the selection logic, on Node's own test
runner with no new dependencies (`cd app && npm test`). This is the only executable evidence
in the repository, and it will stay that way until a development build exists. It does not
prove a geofence ever fires on a phone: that is T-076, and the debug screen has a
*Start geofence field test* button that makes it a five-minute walk.

**Sampling gating is done too** (T-034, 2026-08-10). `movementPolicy.ts` decides
stationary-vs-moving from distance over time (D-028), `samplingGate.ts` applies it, and the
location task runs it once per batch. The rule is asymmetric on purpose — one fix flips to
moving, ten minutes of evidence are needed to go stationary. ⚠ **It can put the recorder to
sleep and cannot wake it**: the stationary profile pauses updates, and if iOS stops delivering,
no fix arrives and the gate never runs again. That is the single most important thing to watch
in T-051.

**The day-1 health check is done too** (T-049, 2026-08-10) — the third of the three things
D-032 says must not be cut. Deliberately asymmetric: an alarm needs positive evidence, a quiet
evening in a hotel is not a fault, and the case it exists for is *running, permitted, and no
fixes* — the OEM battery killer nothing else would notice. A healthy check still notifies,
because D-011 promises reassurance.

Still missing from Phase 1: the Always upgrade and downgrade detection (T-043/T-044), and the
battery-optimisation exemption (T-046).

Nothing at all exists from Phases 2–7.

---

## Start here

**v1 is small on purpose (D-032):** record → stamps by geofence → **draw the raw trace** →
passport → souvenir. **Phase 4 map matching is deferred to v2.** Do not build a road graph, an
R-tree, tunnel inference or corridor crediting. If a task feels enormous, check whether D-032
already deleted it.

### The order to actually work in

**1. A development build.** ⚠ **The only true blocker, and it needs the project lead.**
Background location cannot run in Expo Go, so nothing in Phase 1 can be verified without one.
No JDK-based local Android build and no Mac, so EAS Build is the realistic path for both
platforms. **Nothing below this line can be tested until this exists.**

`app/eas.json` is written and committed. **The runbook is `docs/dev-build.md`.**

⚠ **Corrected 2026-08-10, and the correction matters.** An earlier version of that document
assumed an Android phone. There is none: the project lead has an **iPhone 15**, a Windows PC and
no Mac. An iPhone development build therefore requires the **Apple Developer Program at
$99/year** — a free Apple ID can only sign through Xcode, which needs a Mac.

Three paths, in the order they should happen:

- **A. The emulator, free, today.** Installed 2026-08-10 — SDK, Android 14 system image and
  the `madeira` AVD, all portable inside gitignored `tools/android-sdk/`. EAS builds the APK in
  the cloud; the emulator runs it.
  ⚠ **Blocked on one BIOS toggle**: CPU virtualization is disabled in this machine's firmware,
  which no program can change. `docs/emulator-setup.md` has the exact menu path (~5 minutes)
  and the driver step after it. **This clears the largest block of
  unverified work** — the map rendering offline, migrations, permission dialogs, and, via GPX
  route replay, the whole recorder including the sampling gate and geofence reshuffles.
  It cannot touch battery, OEM killers, force-quit relaunch or anything iOS.
- **B. A cheap used Android, ~€50–100 once.** Already required by T-021a — iPhone-only fixtures
  are best-case and risk under-crediting exactly the hardware most tourists carry. Cheaper than
  the Apple fee, and the only source of real battery and background-survival numbers
  (T-051–T-055).
- **C. The iPhone, $99/year.** Needed for release anyway (T-137), and the only way to test the
  platform D-005 and D-033 actually depend on. Not urgent.

**2. ~~T-039 — the dynamic geofence manager.~~ Done 2026-08-10 (D-033).** Content-agnostic and
unit-tested, exactly as intended. Unproven on hardware, like everything else here.

**3. T-066 — curate the POIs.** ⚠ **Only the project lead can do this, and nothing is now
blocking it.** 150–250 places, each assigned one of the five categories (D-027). T-028
established this is *selection, not research* — OSM already offers 569 viewpoints and 180 peaks.
Without it, geofences have nothing to fire on and the app has no reward.

The tooling was finished 2026-08-10 (T-040, D-034), so the task is now mechanical:

- **`content/pois.json`** is the file. It exists and is empty.
- **`content/README.md`** is the guide — the format, the levada two-geofence rule, and how to
  choose a radius. *Read the radius section*: that one number is the difference between a stamp
  firing and a walked levada going uncredited.
- **`node tools/validate-content.mjs`** checks the work. It uses the app's own parser, so
  anything it rejects is exactly what the app would drop, and it reports progress toward 150.

**This is on the critical path and it is not code.**

**4. ~~T-058 / T-058a — the map's appearance.~~ Done 2026-08-10 (D-035).** The styles are
*generated* — `tiles/style/generate.mjs` derives both from the official Protomaps theme
(BSD-3-Clause) and every choice lives in the generator with its reason. Terrain is a second
6.5 MB elevation pack (`python tiles/pipeline/build-terrain.py`), shaded at render time so one
pack serves both styles. Iterated on screen against the real island; Rabaçal finally has its
ravines. **What remains is where it always was: T-065, outdoors, in the sun** — plus bundling
glyphs locally (T-056/T-057; the generated styles use hosted fonts, which must not ship, D-001)
and verifying hillshade renders on `maplibre-react-native` (T-056). Method:
`docs/map-style.md`.

**5. T-042 / T-114 — permission flow and onboarding.** Sits on the critical path via the slow,
external Google Play review (T-123). Start it early.

**6. T-051–T-055 — the soak tests.** What turns Phase 1 from plausible into proven, and the
trigger for the D-025 purchase decision.

### Where the effort should go, and where it should not

| Spend it on | Do not spend it on |
|---|---|
| The interface — one screen, three controls, one number | GPS or trace accuracy |
| The map's style and terrain | Map matching (deferred, D-032) |
| Battery, and not failing silently | Perfect road highlighting |
| Generous geofence radii at trailheads | Corridor widths, hysteresis, portal inference |

Nobody uninstalls because a drawn line was twenty metres off. They uninstall because the battery
died, because recording stopped silently, or because they walked a famous levada and got nothing
— and that last one is a **geofence radius** problem, not a matching problem.

### Phase 0 — what is left

**Done:** T-022, T-023, T-026 (12 MB pack), T-028 (OSM survey, OD-7 closed).
**Left, and no longer blocking v1:** Track A field runs (T-017–T-021). Their output tunes
*matching* thresholds, and matching is now v2. Still worth an afternoon — fold in T-028a
(verify levada corridor connectivity) and T-028b (WalkMe in airplane mode) on the same walk.

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
5. Record tile pack size (T-026) — **including shaded terrain**, which D-026 adds and which is
   not free.

Note T-024 (stable OSM way IDs in tiles) was downgraded from "critical decision gate" to
nice-to-have by D-022. Do not treat it as a blocker.

**Track B is now also the design unblock.** Once tiles render, the next step is T-058: take an
existing permissively-licensed style — a Protomaps basemap theme, or CARTO Positron over an
OpenMapTiles-schema build — and **subtract** from it. Do not author cartography from a blank
file; that assumption is a large part of why the design phase previously stalled. Then look at
it outdoors, in Funchal, at midday. That is the test that confirms or kills D-026.

### Finishing Phase 1

The scaffold, storage, provider interface, `expo-location` integration, data protection, the
debug screen, the geofence backbone (T-039), the content pack (T-040) and sampling gating
(T-034) are all done — see "What is already built".

**Phase 1's remaining code is small:** the day-1 health check (T-049), the Always upgrade and
downgrade detection (T-043/T-044), and the Android battery-optimisation exemption (T-046).
Everything else left in the phase is **verification, and verification needs the development
build**:

- **T-051–T-055, the soak tests.** These are what turn Phase 1 from plausible into proven, and
  they are the trigger for the Transistor purchase decision (D-025). T-051 in particular is now
  carrying two known hazards at once: `pausesUpdatesAutomatically`, and the fact that the
  sampling gate can select the stationary profile and then never hear from the OS again.

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

### Learned while implementing Phase 1

**`app/AGENTS.md` tells you to read the versioned SDK 57 docs before writing code. Do it.**
Expo moves fast enough that writing from memory produces plausible, wrong code. Checking
`https://docs.expo.dev/versions/v57.0.0/` caught two real errors in this session.

**`newArchEnabled` no longer exists in SDK 57.** The new architecture is the default and the
flag was removed from the config schema; leaving it in fails `expo-doctor`.

**The `expo-location` config plugin injects a generic `NSLocationAlwaysUsageDescription`** —
literally "Allow $(PRODUCT_NAME) to access your location". That is exactly the weak purpose
string Apple pushes back on (D-008, T-119). It is overridden explicitly in `app.json`; if you
regenerate that file, put the override back.

**`Pedometer.getStepCountAsync` is iOS-only** and stores only the past seven days. `expo-sensors`
has no historical step query on Android, and its live watcher does not deliver in the
background. Android therefore stores `null` for steps — which the sensor fallback (T-090) must
treat as "unknown", never as zero. Fabricating a zero would be exactly the invented continuity
ARCHITECTURE §10 forbids.

**`Barometer.relativeAltitude` is iOS-only** too. Android gets `pressure` in hPa only, so
altitude has to be derived later against a reference.

**`pausesUpdatesAutomatically` is a live risk, not a settled choice.** iOS may pause location
updates when it thinks the user has stopped and historically does not reliably resume until a
significant location change. That is both the largest battery saving available and a plausible
cause of silent recording death. It is currently enabled for the stationary and walking
profiles. **Watch it specifically in the 72-hour soak (T-051).**

**`expo-dev-client` drags in permissions that must not ship**: `SYSTEM_ALERT_WINDOW`,
`READ/WRITE_EXTERNAL_STORAGE`, and `NSAllowsArbitraryLoads`. Harmless in development, but T-117
must confirm they are absent from the production build. A reviewer seeing those on a
"no data leaves the device" app is a bad conversation to have.

**Windows dev-environment quirk:** PowerShell 5.1 mangles native-command arguments containing
double quotes, so multi-line `git commit -m` messages get word-split. Write the message to a
file and use `git commit -F` instead.

### Learned in the 2026-08-08 design session

**Apple Maps is settled, and the answer is no.** It will come up again, because it looks good and
the reference app uses it. Four hard stops, recorded in D-026: no offline tile API is exposed to
third-party apps; every pan and zoom leaks position to a tile server; the basemap cannot be
dimmed, so there is no fog of war; and there is no Apple Maps SDK for Android at all. Their
choice is correct *for New York*, which has connectivity everywhere. Madeira's north and interior
do not. The counter-argument that Apple Maps carries useful familiarity is real and is answered
in D-026 — familiarity comes from map *conventions* and *gestures*, both of which MapLibre keeps.

**Never gate recording on the pedometer.** It is tempting, the reference app does exactly it, and
it is wrong here: they are a walking-only app, and Madeira tourism is rental-car dominated.
Gating on steps would blind the app to the tunnel drives and the VR1. The pedometer classifies;
it never gates (D-028). Note also their own settings admit **20%/day** battery at the setting
that reliably catches walks — pedometer gating is not the battery win it appears to be.

**Most "UI work" on this app is cartography.** The primary screen is a map plus three controls.
Asking a UI design tool for "the screen" produces generic dashboard chrome because that is all it
can do with the space. This cost the project lead real time before it was diagnosed. See
`docs/design-brief.md` §1, and do not repeat it.

**Do not author a map style from a blank file.** Start from Protomaps' basemap themes or CARTO
Positron/Dark Matter and subtract. Verify the licence of whichever is chosen.

**Do not name the app after anything official.** The reference app is currently subject to a
cease and desist from NYC DOT for using the name of the city's own wayfinding programme. Madeira
has equivalents — *Visit Madeira* and similar. Search INPI and EUIPO before committing. The
shortlist in `docs/design-brief.md` §7.4 is **unchecked candidates**, not cleared names.

---

## Decisions waiting on the project lead

Three of the four questions raised after the first implementation session were **answered
2026-08-08.** One remains.

| Question | Status |
|---|---|
| **Bundle identifier.** | **Still open.** The project lead has no app name and no domain yet. `com.madeiraexplorer.app` stays as a working placeholder — permanent only *after* store publication, so it must not block the dev build. Decide before T-137. **Search INPI and EUIPO first**, and avoid anything reading as an official regional-tourism asset — see `docs/design-brief.md` §7 for the cautionary case. |
| ~~T-034 activity gating trigger~~ | **Answered — D-028.** Stationary-vs-moving from distance over time; walking-vs-driving deferred to T-034a; pedometer classifies, never gates. |
| ~~Doc-maintenance latitude~~ | **Answered.** Three-tier protocol now in CONTEXT.md §9. Default for anything new is **Provisional**. |
| ~~Save the UI design brief to `docs/`?~~ | **Answered — yes.** Written as `docs/design-brief.md`. |

### Older open questions, none blocking

| ID | Question | Status |
|---|---|---|
| OD-4 | Monetisation | Deferred. Free for v1, no ads ever (would break the privacy position). |
| OD-5 | Cruise day-trippers as a segment | Open, affects content curation only. |
| OD-7 | Levada data source and licensing | **Resolved 2026-08-08 — OSM alone** (D-029, T-028). The 44 official PR routes are already in OSM, so no licensing arises. See `docs/osm-coverage.md`. |
| — | ~~Confirm D-022~~ | **Accepted 2026-08-08.** T-016a closed. |
| — | Confirm D-026 / D-027 / D-028 | Provisional. D-026 needs T-025 plus an outdoor look; D-028 needs T-020 data. Neither blocks Phase 0. |

Also unresolved, cheap to settle: whether Transistor Soft debug builds run unlicensed. Only
matters if the free stack fails its soak tests (T-051–T-054), which is when the $399 purchase
decision arises at all.

### Known documentation inconsistencies

~~`ARCHITECTURE.md` §2 component diagram still lists feature-state recolouring.~~ **Fixed
2026-08-08** under the tier-1 rule now recorded in CONTEXT.md §9.

Note that `DECISIONS.md` D-004 still discusses feature state at length. That is **correct and
deliberate** — the entry carries its own dated revision notice and is superseded by D-022 rather
than rewritten. Superseding rather than deleting is the convention (CONTEXT §9); do not "tidy"
those passages away.

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
- **D-026** Two map styles — light for use, dark for the souvenir; terrain, not buildings *(Provisional)*
- **D-027** Passport organised by category, not region *(Provisional)*
- **D-028** Gate on stationary-vs-moving; pedometer classifies but never gates *(Provisional)*

*(D-029 onwards were decided after the planning conversation and are not listed here. The most
recent is D-033, the geofence window — see "What is Provisional" above.)*

---

## Suggested opening message for the new session

> This is the Madeira Explorer project (`C:\Users\eduar\Desktop\Madeira`).
>
> Read `HANDOFF.md` first — it is in **EXECUTION mode**. Then `CONTEXT.md` (especially §9, the
> doc-maintenance protocol you must follow) and **`DECISIONS.md` D-032**, which defines v1 scope
> and deletes a lot of work you might otherwise start. `TASKS.md` tracks everything task by task.
> Those are the source of truth, not chat history.
>
> **v1 = record → stamps by geofence → draw the raw GPS trace → passport → souvenir.**
> Phase 4 map matching is deferred to v2. No road graph, no R-tree, no tunnel inference. Spend
> effort on the interface and the map's appearance, not on GPS accuracy.
>
> **State:** tile pack is built (12 MB, Protomaps — `bash tiles/pipeline/build.sh`). The Phase 1
> recorder exists in `app/` (~3,900 lines) and **has never run on a phone** — there is no
> development build yet, which is the one real blocker. The geofence backbone (T-039) and the
> content pack (T-040) are done and unit-tested (`cd app && npm test`). Phase 0:
> T-022/T-023/T-026/T-028 done; field runs outstanding but no longer blocking v1.
>
> I am done planning and want to build. Do not open new research threads or propose new
> decisions unless something is genuinely blocked.
>
> I want to work on [pick one]:
> - **Getting a development build onto my phone** (I will create the Expo account) — this is
>   the one real blocker, and everything built so far is unproven until it exists
> - **T-058/T-058a, the map style and terrain** — start from a Protomaps theme and subtract
> - **T-042/T-114, the permission flow and onboarding** — slow external Play review downstream
> - **T-034, stationary-vs-moving sampling gating** — decided in D-028, never written
>
> **T-066 (curating `content/pois.json`) is mine to do** — the tooling is finished, see
> `content/README.md`. Do not offer to do it for me.

Keep the docs current as you go, per CONTEXT §9: tier 1 just do it, tier 2 record as
**Provisional**, tier 3 ask first.

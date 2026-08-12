# Session Handoff

**Written:** 2026-08-06, at the end of the planning conversation.
**Updated:** 2026-08-11 — the souvenir **composition** (T-105a, D-042), the dependency network
audit (T-117, D-043), the privacy policy (T-124, D-044), the battery exemption (T-046, D-045)
and the stamp artwork (T-070, D-046). **The small-remainder list is down to T-139**, and what
is left of T-105 is the encoder, which needs a device. Earlier updates: 2026-08-10 (**v1
feature-complete in code**), 2026-08-08 (design session, D-026/D-027/D-028), 2026-08-06 (first
implementation session).
**For:** a fresh Claude Code session picking this project up cold.
**Mode: EXECUTION.** Planning is over. The project lead said, plainly: *"Tired of planning."*
Do not open new research threads. Do not propose new decisions unless something is actually
blocked. Build the things in "Start here" below.

**Repository state:** git repository, ~20 commits. **The whole v1 chain is written**: record →
stamps by geofence → hero number → trace on a map → passport → trip end → reveal, with the
user's accommodation masked out of anything shareable. 58 source files and 14 test files in
`app/`, ~14,900 lines.

**It runs on an emulator now** (2026-08-11, T-029b — the project lead enabled CPU
virtualization). **The map renders**: offline PMTiles, bundled glyphs, hillshaded terrain, on a
GPU. Screens, permissions and the debug view all work. 270 unit tests still cover the logic.

⚠ **But the recorder does not work.** Recording starts, the foreground service runs, and **no fix
has ever reached the database** — see **T-052a**, the blocker to start from. The honest statement
is now narrower, not broader: *the app runs and draws; it has never successfully recorded
anything.* And the emulator still cannot speak to **battery, background survival or GPS realism**
(CONTEXT §6.6) — those need T-021a's real Android.

---

## Read this in order

1. **`CONTEXT.md`** — the cold-start briefing. Written specifically for you. Read it fully
   before doing anything, especially §2 (the five load-bearing ideas), §3 (hard constraints),
   §6 (coding conventions) and **§9 (the doc-maintenance protocol you are expected to follow)**.
2. **`DECISIONS.md`** — 40 numbered decisions. **Read D-032 first** — it defines v1 scope and
   deletes a large amount of work you might otherwise start.
3. **`TASKS.md`** — the ordered checklist. Start here for what to actually do.
4. `ARCHITECTURE.md`, `PROJECT_PLAN.md`, `README.md` — reference as needed.
5. `docs/design-brief.md` — visual direction and screen structure. Read before touching anything
   that renders. Its §1 explains why the "UI work" on this app is mostly cartography.

`CLAUDE.md` at the repository root is loaded automatically and points here. It holds routing
and invariants only — if it disagrees with a decision, the decision wins.

**Reference, read when relevant:** `docs/dev-build.md` (getting it onto hardware),
`docs/map-style.md` (how the cartography is generated), `docs/field-testing.md` (Track A),
`content/README.md` (the curation guide), `docs/osm-coverage.md`, `docs/tile-pipeline.md`,
`docs/dependency-audit.md` (T-117 — what ships and what it can reach),
`docs/store-privacy-answers.md` (T-120/T-122 — the exact answers for both store forms).

**These seven documents are the source of truth, not this handoff and not any chat history.**
If this file and those disagree about a *decision*, they win.

The exception is **implementation status**: what is built, what is unverified, and what is
waiting on the project lead is recorded here and in `TASKS.md`. Read both before writing code —
this file explains the shape of what exists, `TASKS.md` tracks it task by task.

---

## Where the project stands

Planning is complete, **scope has been cut (D-032)**, and **the v1 chain is written end to
end**. Phase 0 is half done. All of it is unproven on hardware.

### What is left of v1, in three buckets

**1. Code nobody has written yet** — and it is a short list:

| | |
|---|---|
| **T-105b** the souvenir encoder | 9:16 video. D-013 calls it the entire distribution strategy. **T-105a, the composition, is now written** (D-042): the storyboard — three scenes, camera path, strokes, and the moment each stamp lands — is pure and has 23 tests. What is left is turning that into an MP4, which needs native video encoding nobody can verify without a device. **Nobody has watched anything**; every duration in the composition is a guess. |
| ~~**T-070** stamp artwork~~ | **Done 2026-08-11 (D-046).** Generated per place from the category and a hash of the id — eight silhouettes, six colourways, two-tone emblems. The **emblem** carries the category, not the shape or the colour (D-015). `node tools/preview-stamps.mjs` draws them all to a page, which is the only way to judge them here. |
| ~~**T-124** privacy policy~~ | **Written 2026-08-11 (D-044).** Shown offline in the app; `docs/privacy-policy.md` is generated from the same source. ⚠ Not lawyer-reviewed, and `CONTACT_EMAIL` is null — both block T-123. |
| ~~**T-046** Android battery exemption~~ | **Done 2026-08-11 (D-045).** Opens the system battery screen rather than requesting the restricted permission, because T-123's review is already on the critical path. The app cannot read the exemption state, so the row claims none. |
| ~~**T-139** tune the dark style~~ | **Done 2026-08-11.** Tuned by contrast measurement, not by eye — `map/darkStyle.test.ts` holds D-015 against the shipped style. **T-140's toggle is now wired to the map** and persists. ⚠ Never seen; T-065 outdoors is the verdict. |

**2. Verification that needs a device.** ⚠ **START WITH T-052a.** The first device run found
that **recording starts and no fix ever reaches the database** — the foreground service runs,
`dumpsys location` shows our uid registering no location request at all, and `raw_fix` stays
empty. Permission, batching, silent errors and the task definition are all ruled out by
experiment. Nothing downstream of the recorder can be verified until it is fixed, and D-010
calls raw traces the only irreplaceable asset.

The rest: T-051–T-055, T-063, T-076, T-077–T-080, T-110. **No threshold anywhere in this app has
met real data** — every number in D-033, D-037, D-039 and D-041 is a reasoned guess.

**3. Content, which only the project lead can produce.** `content/pois.json` is valid and
**empty**. Until it has places, the stamp system has nothing to award and the trip cannot end
at an airport. See `content/README.md`.

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

**The app executes, and the recorder has never worked.** Both halves matter.

*What the emulator proved* (2026-08-11): the app builds, installs, launches and draws the real
map from the offline pack; permission state is read correctly; the debug view reports honestly;
tap targets measure 60 dp at 420 dpi, confirming T-113's browser figures.

*What it disproved:* that recording works. **`raw_fix` is empty after 41 replayed positions**
(T-052a). It also found a **D-008 violation** — `isGeofencing()` threw on While-Using and took
the whole debug screen down with it — and a camera fitting the wrong rectangle (T-062). Three
real defects in the first twenty minutes of owning a device, none of which 270 unit tests and a
browser workbench had caught.

*What no emulator can tell us:* battery, background survival, OEM killers, GPS realism
(CONTEXT §6.6). No battery figure has been measured and `MEASURED_BATTERY_PERCENT_PER_DAY` stays
`null` (D-041). Treat every Phase 1 *reliability* claim as a hypothesis until T-021a exists.

### What is Provisional

**D-022 is now Accepted** (confirmed 2026-08-08, T-016a closed).

**Nineteen decisions are Provisional** — `awk '/^## D-0/{id=$2} /^\*\*Status/{if (/Provisional/) print id}' DECISIONS.md`
is the authoritative count. ⚠ *This line said "nine" until 2026-08-11 while listing twelve
entries; the number had simply stopped being maintained. Count it, do not trust it.* Three came
from the 2026-08-08 design session; most of the rest were made while building on 2026-08-10 and
2026-08-11 and have never met real data or a real device. The default for anything new is
Provisional and the burden is on confirmation, not objection (CONTEXT §9). The ones with
something specific still outstanding:

- **D-042** *(2026-08-11)* — the souvenir is planned as a storyboard before it is rendered,
  paced by recorded movement rather than by elapsed time, never drops a stamp, and produces
  **no film at all** from a trace masking could not verify. Unit-tested and **never watched** —
  every duration in it is a guess. T-105b and a pair of eyes are what confirm or kill it.
- **D-043** *(2026-08-11)* — `expo-notifications` puts Firebase Cloud Messaging in the Android
  build, and it stays, because removing it takes the day-1 health check with it. No Firebase
  configuration ships, so it has nothing to register against — **a static argument about a
  runtime behaviour. T-117b owes the packet capture.**
- **D-044** *(2026-08-11)* — the privacy policy is shown offline in the app rather than linked,
  and `docs/privacy-policy.md` is generated from the same source so the two cannot drift.
  **Not lawyer-reviewed**, and `CONTACT_EMAIL` is null — both block T-123.
- **D-045** *(2026-08-11)* — the battery exemption opens the system settings screen instead of
  requesting the restricted permission, to keep a second reviewed permission off T-123's
  submission. **Held in reserve, not rejected:** adopt the one-tap dialog if T-053 shows OEMs
  killing the recorder anyway.
- **D-046** *(2026-08-11)* — stamp artwork is generated per place from its category and a hash
  of its id; the **emblem** carries the category, shape and colour are decoration. Seen twice
  in a browser by one person, never on a device, never outdoors (T-065).

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
- **D-041** *(2026-08-10)* — onboarding: three screens, every decline a real button, nothing
  gates on a grant (D-008), and **no battery figure until T-054 measures one** — the constant
  is null and a test keeps it that way. The Always upgrade is offered once on day 2 and never
  again.
- **D-040** *(2026-08-10)* — accommodation masking: one export door, no opt-out parameter, and
  a trace the app could not verify is **withheld rather than shipped unmasked**. The thresholds
  err toward hiding — the opposite of D-009's generosity, because masking too much costs a
  little trace and masking too little publishes an address.
- **D-039** *(2026-08-10)* — trip end: an airport crossing only counts if the user has been
  somewhere else first, because **everyone crosses the airport geofence on the way in** and the
  naive rule ends every holiday forty minutes after it starts. Silence takes three days, not
  D-012's 24 hours, because a dead recorder and a departed user look identical.
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

## What is already built

Everything below exists and is committed. **Nothing below has run on a phone.**

```
app/
├── app.json, eas.json, metro.config.js   config; metro.config.js exists only
│                                         so the bundler can see content/
├── plugins/withAndroidBackupRules.js     backup rules + manifest attributes
├── index.ts                              module-scope side effects — read it
├── App.tsx / App.web.tsx                 the app / the design workbench (D-038)
└── src/
    ├── recording/     ~2,000 lines. COMPLETE, NEVER RUN ON A PHONE.
    │   LocationProvider.ts (the D-025 seam — read first), ExpoLocationProvider,
    │   backgroundTasks (+ .web no-op), taskNames, recordingSink, sensors,
    │   samplingPolicy, distance, geofenceSelection(+test), geofenceManager,
    │   devPoiFixture, movementPolicy(+test), samplingGate, healthCheckPolicy
    │   (+test), healthCheck, recorderHealth
    ├── content/       T-040, the pack's only entry point (D-034)
    │   contentPack(+test), poiCatalogue
    ├── progress/      the reward (D-037) and the numbers
    │   stampRules(+test), stampAwards, tripProgress(+test), currentProgress,
    │   tripEnd(+test), tripEndDetection
    ├── souvenir/      T-103/T-104, the privacy hole closed (D-040); T-105a (D-042)
    │   accommodation(+test), exportTrace  ← THE ONLY DOOR A TRACE LEAVES BY
    │   composition(+test), souvenirPlan   ← the film, planned but never rendered
    ├── onboarding/    T-042/T-114/T-121, the hardest permission (D-041)
    │   permissionPolicy(+test), OnboardingView, OnboardingFlow
    ├── map/           T-056/T-059
    │   mapAssets, mapStyle, traceGeoJson(+test), MapScreen
    ├── storage/       migrations (2), database, types, dao/*,
    │   deleteAllUserData.test.ts ← guards a bug that already happened once
    └── ui/            theme (D-015 as values), DebugScreen, PassportView,
        PassportScreen, PrimaryOverlay, SettingsView, SettingsScreen
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

## Start here

**v1 is small on purpose (D-032):** record → stamps by geofence → **draw the raw trace** →
passport → souvenir. **Phase 4 map matching is deferred to v2.** Do not build a road graph, an
R-tree, tunnel inference or corridor crediting. If a task feels enormous, check whether D-032
already deleted it.

### The order to actually work in

Two of these are the project lead's and cannot be done for them. The rest is a short list.

**1. ⚠ T-052a — THE RECORDER HAS NEVER RECORDED. Start here.**

Recording starts, the foreground service runs, and **no fix ever reaches `raw_fix`.** Found
2026-08-11, the first time the recorder ran on a device. Nothing downstream of the recorder can
be verified until it is fixed, and D-010 calls raw traces the only irreplaceable asset.

Permission, batching, silent errors and the task definition are **all ruled out by experiment** —
read T-052a before touching anything, because the reasoning there is what stops you repeating
four dead ends. `dumpsys location` shows every provider `OFF` and **our uid registering no
location request at all**.

Two suspects remain and the task names the cheap experiment that separates them. **Do not change
location options or reach for the Transistor SDK (T-031a) until it is settled** — it is still
possible the emulator, not the app, is what cannot deliver a position.

**2. ⚠ THE TWO THINGS ONLY THE PROJECT LEAD CAN DO.**

- **A *physical* device.** The **emulator now works** (T-029b — CPU virtualization was enabled
  2026-08-11): `bash tools/run-emulator.sh`, then `cd app && npm run android`. It renders the
  map, runs the screens and answers permissions, and it is **worthless for battery, background
  survival and GPS realism** (CONTEXT §6.6). So a **used mid-range Android, ~€50–100** is still
  required — T-021a needs it anyway, and it is the only source of real battery and
  background-survival numbers. iOS still needs a Mac and $99/year.
- **The content.** `content/pois.json` is valid and empty. `content/README.md` is the guide;
  `node tools/validate-content.mjs` checks the work and reports progress toward 150. Without it
  the stamp system has nothing to award and the trip cannot end at an airport. **Do not offer
  to curate it** — T-028 established it is selection and editorial judgement, which is the one
  thing a competitor cannot buy.

**3. T-105b — the souvenir encoder.** The largest remaining piece of code and the one D-013
calls the entire distribution strategy: a 9:16 video good enough that people post it.
**T-105a split the testable half off and it is done** (D-042) — `souvenir/composition.ts` plans
the film as a storyboard and `souvenirPlan.ts` feeds it from the database. What remains needs
native video encoding and therefore a device. It also needs *eyes*: the composition's timings
are guesses by somebody who has never seen the result.

**4. The small remainder is empty.** Every v1 item that does not need a device is done —
T-046, T-070, T-105a, T-113, T-116/T-116a, T-117, T-118, T-120, T-122, T-124, T-139, T-140.
**What is left of v1 is a device, the content, and the Play submission**, and none of the three
is code.

**5. Once T-052a is fixed, in this order**, because each is cheap and each can invalidate the
next: replay a route and see the trace draw (`tools/replay-route.sh`) → the tunnel route, which
must draw as **two** segments not one (ARCHITECTURE §10) → airplane-mode cold start (T-063, still
open — the render so far had Metro attached) → permission dialogs on a fresh install → then, on
real hardware only: the geofence field test (T-076, ~850 m on foot) → an overnight soak (T-051) →
battery over 12 hours (T-054).
`docs/dev-build.md` has the full list and says which check settles which open question.

### How to see things

**On the emulator** (T-029b — this is now the default):

```bash
bash tools/run-emulator.sh                                      # Android 14 AVD
cd app && npm run android                                       # build + install
bash tools/replay-route.sh tools/routes/funchal-seafront.txt     # feed it positions
bash tools/screenshot.sh <name>                                 # → tools/out/shots/
```

⚠ Two traps, both learned the hard way and written into the scripts: `adb emu geo fix` takes
**longitude first**, and `adb shell screencap > file` corrupts the PNG on Windows — use
`adb exec-out`. A third: Windows reports `VirtualizationFirmwareEnabled: False` even when
virtualization is on, because a running hypervisor hides the firmware flag. **Ask
`emulator-check accel`, not Windows.**

Reading the app's own state is often faster than tapping through it. `adb root` works on this
AVD, and the database is at
`/data/data/com.madeiraexplorer.app/files/SQLite/madeira.db` — `sqlite3` is on the device, and
the `recording_event` diary is where the app records what it actually did.

**Without a device at all.** Two workbenches exist, and both were load-bearing rather than
nice-to-have:

```bash
cd app && npx expo start --web     # the screens (D-038)
bash tiles/viewer/serve.sh          # the map styles, over the real tile pack
```

The web workbench (`App.web.tsx`) mounts every screen against fixture data. **It is not a
product target and must never become one** — the app needs background location, OS geofences
and a native renderer, none of which a browser has. It has already caught two defects invisible
in code review: a passport that scrolled on day one, and two primary-screen controls that
overlapped by 38 px on a 320 dp phone.

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

**Done:** the tile pipeline (T-022, T-023, T-026 — 19.1 MB with terrain) and the OSM coverage
survey (T-028, closing OD-7).

**Left, and no longer blocking v1:** the Track A field runs (T-017–T-021). Their output tunes
*matching* thresholds and matching is now v2 (D-032), so they are worth an afternoon rather
than a delay. Full procedure — logger, the two runs, ground truth, the sampling-bias warning —
is **`docs/field-testing.md`**.

### Phase 1 is finished, and unproven

Every line of the recorder is written: scaffold, storage, the provider seam, `expo-location`,
data protection, the debug screen, the geofence backbone (T-039), the content pack (T-040),
sampling gating (T-034), the day-1 health check (T-049), the permission flow (T-042/T-043/T-044)
and settings (T-141). Only T-046, the Android battery-optimisation exemption, remains.

**What is left in the phase is verification, and verification needs a device.** T-051–T-055 are
what turn Phase 1 from plausible into proven, and they are the trigger for the Transistor
purchase decision (D-025). T-051 now carries **two** known hazards at once:

1. `pausesUpdatesAutomatically` — iOS may stop location updates and not resume.
2. The sampling gate can select the stationary profile and then never hear from the OS again —
   it can put the recorder to sleep and cannot wake it (D-028's implementation note).

Both fail the same way: silently, on somebody's holiday. The day-1 health check (T-049) exists
to catch exactly this, and it too has never run.

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

**`deleteAllUserData` must list every table that references `trip`.** With `foreign_keys = ON`
and no `ON DELETE CASCADE`, a missing child table does not leave stray rows — it aborts the
whole transaction, so *nothing* is deleted. `stamp_award` was missed when migration 2 added it
and erase-all was broken for every user with a stamp until 2026-08-10.
`deleteAllUserData.test.ts` now derives the list from the migrations and fails if one is
missing. Add new child tables to both in the same commit.

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
recorded decision. **T-117 ran this on 2026-08-11 — `docs/dependency-audit.md`.** No analytics,
no crash reporting, no telemetry, and no network call in the app's own code.

**`expo-notifications` puts Firebase Cloud Messaging in the Android build** (D-043). Found by
T-117 and the one thing in the audit likely to surface in the Play review. The app uses local
notifications only and ships no Firebase configuration, so it has nothing to register against —
but that is a *static* argument about a *runtime* behaviour, and **T-117b still owes the packet
capture**. Do not repeat the claim as if it were measured. Removing the dependency was
considered and rejected: it would take the day-1 health check with it, and a recorder that dies
silently is the failure CONTEXT §4.5 calls worse than never installing the app.

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

### Landmines from the design session

**Apple Maps is settled, and the answer is no.** It will come up again. Four hard stops in
D-026: no offline tile API for third parties, every pan leaks position to a tile server, the
basemap cannot be dimmed so there is no fog of war, and there is no Apple Maps SDK for Android.
Familiarity comes from map *conventions* and *gestures*, both of which MapLibre keeps.

**Never gate recording on the pedometer.** Tempting, and the reference app does it, but they are
a walking-only app and Madeira tourism is rental-car dominated — gating on steps would blind us
to every tunnel drive and the VR1. The pedometer classifies; it never gates (D-028). Their own
settings admit 20%/day at the setting that reliably catches walks, so it is not even the battery
win it appears to be.

**Most "UI work" on this app is cartography.** Asking a UI design tool for "the screen" produces
generic dashboard chrome, because a map plus three controls is all the space there is. This cost
the project lead real time before it was diagnosed (`docs/design-brief.md` §1).

**Do not name the app after anything official.** The reference app is under a cease and desist
from NYC DOT for using the name of the city's own wayfinding programme. Madeira has equivalents
— *Visit Madeira* and similar. Search INPI and EUIPO first. The shortlist in
`docs/design-brief.md` §7.4 is **unchecked candidates**, not cleared names.

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

## Suggested opening message for the new session

> This is the Madeira Explorer project (`C:\Users\eduar\Desktop\Madeira`).
>
> Read `HANDOFF.md` first — it is in **EXECUTION mode**. Then `CONTEXT.md` (especially §9, the
> doc-maintenance protocol you must follow) and **`DECISIONS.md` D-032**, which defines v1 scope
> and deletes a lot of work you might otherwise start. `TASKS.md` tracks everything task by
> task. Those are the source of truth, not chat history.
>
> **v1 = record → stamps by geofence → draw the raw GPS trace → passport → souvenir.**
> Phase 4 map matching is deferred to v2. No road graph, no R-tree, no tunnel inference.
>
> **State:** the whole v1 chain is written, and **it now runs on an Android emulator** — the map
> renders from the offline pack, the screens work. 270 unit tests cover the logic. The tile pack
> is built (19.1 MB with terrain). `content/pois.json` is valid and empty.
>
> ⚠ **But the recorder has never recorded.** `T-052a` is the blocker and the first thing to read:
> recording starts, the foreground service runs, and no fix ever reaches the database. Four
> candidate causes are already ruled out by experiment — read the task before touching anything,
> and do not change location options or reach for the Transistor SDK until the two remaining
> suspects have been separated.
>
> **To see anything:** `bash tools/run-emulator.sh`, then `cd app && npm run android`. Feed it
> positions with `bash tools/replay-route.sh tools/routes/funchal-seafront.txt` and grab the
> screen with `bash tools/screenshot.sh <name>`. `adb root` works, and reading
> `/data/data/com.madeiraexplorer.app/files/SQLite/madeira.db` is usually faster than tapping
> through the UI.
>
> **Two things are mine, not yours:** getting a *physical* Android — the emulator works but
> cannot answer battery, background survival or GPS realism — and curating
> `content/pois.json`. Do not offer to do either for me.
>
> I am done planning and want to build. Do not open new research threads or propose new
> decisions unless something is genuinely blocked.
>
> Start with **T-052a**. After that: **T-105b, the souvenir encoder** (the whole distribution
> strategy, D-013 — the composition is written, this is the encoding), or **T-063a**, the glyph
> ranges, which needs a decision rather than a reflex.

Keep the docs current as you go, per CONTEXT §9: tier 1 just do it, tier 2 record as
**Provisional**, tier 3 ask first.

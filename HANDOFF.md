# Session Handoff

**Written:** 2026-08-06, at the end of the planning conversation.
**Updated:** 2026-08-06, after the first implementation session.
**For:** a fresh Claude Code session picking this project up cold.
**Repository state:** git repository with three commits. Planning docs plus a Phase 1 recorder
skeleton in `app/` — 21 source files, ~2,200 lines, **none of which has ever been run.**

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
If this file and those disagree about a *decision*, they win.

The exception is **implementation status**: what is built, what is unverified, and what is
waiting on the project lead is recorded here and in `TASKS.md`. Read both before writing code —
this file explains the shape of what exists, `TASKS.md` tracks it task by task.

---

## Where the project stands

Planning is complete and every blocking decision is closed. **Phase 0 has not started.**
Phase 1 is implemented but entirely unproven.

| | |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, **TypeScript strict** |
| Map | `@maplibre/maplibre-react-native` v11, offline PMTiles/MBTiles — *not yet installed* |
| Location | `expo-location` (free) behind a swappable `LocationProvider` |
| Storage | SQLite, WAL — R-tree comes with the road graph in Phase 4 |
| Backend | **None.** Zero servers, zero accounts, zero analytics. |
| Dependency cost | **$0** for the app. Track A needs Sensor Logger's paid tier (tooling, not a dependency). |
| Unavoidable spend | Apple $99/yr, Google Play $25 once — at launch, not now |

### ⚠ The single most important thing to know

**No line of this app has ever executed.** What has been verified is that it is *well-formed*:
`tsc --noEmit` clean under strict, Metro bundles 653 modules, `expo-doctor` 20/20, and config
introspection confirms the entitlements and manifest attributes reach the native config.

None of that proves a GPS fix would land in the database. No permission dialog has been seen,
no battery figure measured, no OEM survival tested. Treat every Phase 1 claim as a hypothesis
until a development build exists — which is the first blocker below.

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

## What is already built

Three commits: planning docs, the Phase 1 recorder skeleton, then a TASKS.md status update.

```
app/
├── app.json                          purpose strings, permissions, iOS data-protection
│                                     entitlement, plugin list
├── plugins/withAndroidBackupRules.js writes the §4a backup rules + manifest attributes
├── index.ts                          imports backgroundTasks for its side effects — see below
└── src/
    ├── storage/                      ~550 lines. COMPLETE.
    │   ├── migrations.ts             6 tables, numbered migration runner
    │   ├── database.ts               WAL, foreign keys, deleteAllUserData()
    │   ├── types.ts                  row shapes, narrow string unions
    │   └── dao/                      rawFix, sensorSample, geofenceEvent,
    │                                 recordingEvent, trip, appState
    ├── recording/                    ~730 lines. COMPLETE BUT INERT.
    │   ├── LocationProvider.ts       the D-025 seam — read this first
    │   ├── ExpoLocationProvider.ts   the only file allowed to import expo-location
    │   ├── backgroundTasks.ts        TaskManager.defineTask, module scope
    │   ├── recordingSink.ts          writes batches to SQLite; never throws
    │   ├── sensors.ts                barometer + pedometer, with two honest limitations
    │   ├── samplingPolicy.ts         profiles — ⚠ NUMBERS ARE NOT TUNED
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

### The largest hole in Phase 1

**Geofencing is wired but never fires.** `startGeofencing()` exists on the provider and the task
handler is written, but nothing calls it with regions, because there are no POIs yet (T-039 the
manager, T-066 the content). So `geofence_event` stays empty. Since geofences are the reward
backbone (D-005), this is the biggest gap in the phase.

Also missing from Phase 1: activity switching (T-034 — profiles exist, nothing selects between
them), notifications and the day-1 health check (T-049), the Always upgrade and downgrade
detection (T-043/T-044), and the battery-optimisation exemption (T-046).

Nothing at all exists from Phases 2–7.

---

## Start here

**The first blocker is a development build.** Background location cannot run in Expo Go, so
nothing in Phase 1 can be verified until one exists. That needs an Expo account (the project
lead's to create) and `eas.json`. No JDK on the dev machine and no Mac, so EAS Build is the
realistic path for both platforms.

Phase 0 has **two independent tracks** that can run in either order or in parallel, and neither
is blocked by the above. Neither requires writing app code.

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

### Finishing Phase 1

The scaffold, storage, provider interface, `expo-location` integration, data protection and
debug screen are done (see "What is already built"). What remains, in the order I would take it:

1. **A dev build** — nothing below can be verified without one.
2. **T-039, the dynamic geofence manager.** The reward backbone, needs no hardware, and the docs
   twice warn it is painful to retrofit. Drive it from a test fixture so it stays
   content-agnostic (D-017). This is the recommended next piece of code.
3. **T-042/T-114, the permission flow and onboarding.** Sits on the critical path via the slow,
   external Google Play review (T-123).
4. **T-034, activity gating** — needs a decision first, see below.
5. **T-051–T-055, the soak tests.** These are what turn Phase 1 from plausible into proven, and
   they are the trigger for the Transistor purchase decision (D-025).

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

---

## Decisions waiting on the project lead

These were raised at the end of the first implementation session and are **not yet answered.**
Ask before assuming any of them.

| Question | Why it matters |
|---|---|
| **Bundle identifier.** Currently the placeholder `com.madeiraexplorer.app`. | Free to change now, permanent after store submission, and it is the unit a Transistor licence is sold against. Use a reverse-DNS form of a domain the lead controls if there is one. |
| **T-034 activity gating trigger.** Infer from speed, add a dependency, or leave a fixed profile until Phase 0 data exists. | `expo-location` does not surface platform activity recognition, so the profiles currently never switch. Directly sets the battery number. Inferring from speed adds no dependency, which matters given the §6.4 zero-networked-dependency target. |
| **How much latitude on the six planning documents.** | The standing instruction is to keep them current unprompted; the lead also said not to change the plan without approval. The line between "fix a factual error" and "change the plan" has not been drawn. |
| **Save the UI design brief to `docs/`?** | A prompt for sketching the product screens was drafted in chat and deliberately not committed. |

### Older open questions, none blocking

| ID | Question | Status |
|---|---|---|
| OD-4 | Monetisation | Deferred. Free for v1, no ads ever (would break the privacy position). |
| OD-5 | Cruise day-trippers as a segment | Open, affects content curation only. |
| OD-7 | Levada data source and licensing | Not yet decidable — needs the OSM coverage assessment in T-028 first. |
| — | Confirm D-022 | Provisional, does not block Phase 0. |

Also unresolved, cheap to settle: whether Transistor Soft debug builds run unlicensed. Only
matters if the free stack fails its soak tests (T-051–T-054), which is when the $399 purchase
decision arises at all.

### Known documentation inconsistency

`ARCHITECTURE.md` §2, in the component diagram, still lists "Feature-state recolouring by OSM
way ID" in the presentation layer. D-022 retired that approach and §5 of the same document
already reflects the change. One-line fix, left alone pending the doc-latitude question above.

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

> This is the Madeira Explorer project. Read `HANDOFF.md`, then `CONTEXT.md`, `DECISIONS.md`
> and `TASKS.md` — those four are the source of truth, not chat history. Planning is complete
> and a Phase 1 recorder skeleton exists in `app/`, but it has never been run. Do not change
> the plan without asking me.
>
> I want to work on [pick one]:
> - getting a development build onto my phone, so the recorder can actually be tested
> - T-039, the dynamic geofence manager
> - Phase 0 Track A — the field GPS runs with Sensor Logger
> - Phase 0 Track B — the tile pipeline spike

Whichever is chosen, read the "Decisions waiting on the project lead" table above first — four
questions are outstanding and one of them (activity gating) blocks a Phase 1 task.

# Tasks

Ordered implementation checklist with explicit dependencies.

**Document date:** 2026-08-06
**Last updated:** 2026-08-11 — T-105 split into **T-105a** (the souvenir *composition*, done,
D-042) and **T-105b** (the encoder, which needs a device); **T-117** the dependency network
audit done statically (`docs/dependency-audit.md`, D-043), adding **T-117b** for the on-device
half; **T-124** the privacy policy (D-044); **T-046** the battery exemption (D-045); **T-070**
the stamp artwork (D-046); **T-113**'s contrast half, which found three shipped failures;
**T-118** the Apple privacy manifest; **T-116**/**T-116a** the notification budget and the
island's name out of `app/`; **T-120**/**T-122** the store privacy answers; **T-113** closed by measuring every screen.
Previously 2026-08-10 — **v1 is
feature-complete in code.** That day closed T-034,
T-039/T-040 (D-033/D-034), T-049, T-056–T-059 (D-035/D-036), T-071–T-075, T-081, T-099–T-104
(D-039/D-040), T-114/T-121 and T-125/T-140/T-141, and added a web design workbench (D-038).
It also found that **erase-all had been silently broken since migration 2**.
Previously 2026-08-08 — v1 scope cut (D-032); tile schema (D-030); visual direction and
passport structure (D-026, D-027); activity gating (D-028); D-022 confirmed.

> **v1 = record → stamps by geofence → draw the trace → passport → souvenir.**
> Phases 1, 2, 3, 5, 6, 7. **Phase 4 is v2.** See D-032.
**Overall progress:** the whole v1 chain is written and **nothing has run on real hardware.**
What remains: T-105b (the souvenir *encoder* — its composition is now written), a short tail of
small items, verification that needs a device, and the curated content. See `HANDOFF.md`.

⚠ **Everything marked done below is verified by typecheck, bundle, 256 unit tests over the
pure logic, and — for the screens — measurement in a browser (D-038).** No fix has ever been
recorded, no permission dialog seen, no battery figure measured, and no map rendered on a GPU.
Real-device testing is mandatory for anything touching recording (CONTEXT §6.6) and is what
T-051–T-055 exist for.

Task IDs are stable — reference them in commits and never renumber. Dependencies are listed
as `⇠ T-xxx`. A task must not start until all its dependencies are done.

This list is kept current as work happens and as decisions change the plan — see the
maintenance protocol in [CONTEXT.md §9](CONTEXT.md). A decision that changes the architecture
almost always changes tasks and dependencies here too.

Legend: `[x]` done · `[ ]` not started · `[~]` in progress · `[!]` blocked

---

## Phase P — Planning and definition

- [x] **T-001** Define product concept, audience and core loop
- [x] **T-002** Critique the concept; identify the slow-fill / dark-map retention risk
- [x] **T-003** Survey prior art (Wandrer, CityStrides, Fog of World, Polarsteps, AllTrails,
      Wikiloc) and confirm technical feasibility
- [x] **T-004** Decide the canvas model — curated places over island-wide road coverage
      ⇠ T-002
- [x] **T-005** Decide the reward metaphor — passport stamps over stars ⇠ T-004
- [x] **T-006** Settle the battery strategy (batching, activity gating, geofences, burst
      matching)
- [x] **T-007** Settle the mobile-data strategy (bundle the island offline)
- [x] **T-008** Settle the privacy architecture (no backend, zero networked dependencies)
      ⇠ T-007
- [x] **T-009** Design the "ghost app" resilience model (OS-survival, day-1 health check, two
      notifications)
- [x] **T-010** Design the low-signal matching strategy (tunnels, levada corridors, barometer,
      pedometer, generosity rule) ⇠ T-006
- [x] **T-011** Decide the distribution strategy — organic sharing of the souvenir video
- [x] **T-012** Write project documentation (README, PROJECT_PLAN, ARCHITECTURE, TASKS,
      DECISIONS, CONTEXT) ⇠ T-001…T-011

### Still open in this phase

- [x] **T-013** Decide framework (OD-1) — **resolved 2026-08-06: React Native** with
      `@maplibre/maplibre-react-native` v11 and Expo tooling (D-023). **Phase 1 unblocked.**
      ⇠ T-013a
- [x] **T-013a** Research MapLibre and geolocation plugin maturity in RN vs Flutter —
      **done 2026-08-06.** Surfaced the `setFeatureState` finding (D-004 revision, D-022),
      which mattered more than the framework question itself.
- [x] **T-014** Decide whether Porto Santo is in scope (OD-2) — **resolved 2026-08-06:
      included structurally, deliberately deprioritised editorially** (D-021)
- [x] **T-015** Confirm the hero number (OD-3) — **resolved 2026-08-06: places/stamps**
      (D-002 Accepted)
- [x] **T-016** Decide raw-trace retention policy (OD-6) — **resolved 2026-08-06: retain**
      (D-010 Accepted)
- [x] **T-016b** Confirm whether Phase 0 fieldwork is locally available — **resolved
      2026-08-06: project lead lives in Madeira.** Sequencing unchanged; see CONTEXT.md §5a
- [x] **T-016a** Confirm D-022 (overlay rendering rather than feature state) — **confirmed by
      the project lead 2026-08-08. D-022 is Accepted.**
- [x] **T-016d** Settle the visual direction and primary-screen structure — **resolved
      2026-08-08:** two styles, light for use and dark for the souvenir (D-026); passport by
      category (D-027); three-control layout. Written up in `docs/design-brief.md`.
      **All three decisions are Provisional** until validated against real tiles (T-025).
- [x] **T-016c** Decide on the Transistor Soft licence — **resolved 2026-08-06: not purchased.**
      Start free on `expo-location`; buy only if T-051–T-054 fail (D-025)

---

## Phase 0 — Validation

Cheap answers to expensive questions. Nothing here requires the app to exist.

### Field GPS reality check

> **Track A procedure — logger, both runs, ground truth, the sampling-bias warning — is in
> [`docs/field-testing.md`](docs/field-testing.md).** The tasks below track it; that document
> says how to actually do it.

- [ ] **T-017** Obtain a raw sensor logger — **do not build one.** Use **Sensor Logger**
      (Kelvin Choi, iOS + Android): records GPS fix/accuracy/speed/heading/altitude, barometer
      and pedometer in one time-aligned session, exports CSV/JSON/SQLite. Paid tier is needed
      for combined CSV export and the barometric-altitude/pedometer channels. Tooling and
      sample parsing code at github.com/tszheichoi/awesome-sensor-logger.
- [ ] **T-017a** Capture ground truth alongside each run: take a **photo** at each key waypoint
      (trailhead, tunnel portals, exit). EXIF gives timestamp + location for free, which is what
      the recorded trace gets compared against.
- [ ] **T-018** Walk one full levada under Laurissilva canopy with the logger ⇠ T-017
- [ ] **T-019** Drive one tunnel-heavy VR1/VE1 route with the logger ⇠ T-017
- [ ] **T-020** Analyse and document blackout durations, error magnitudes, whether the
      barometer survives tunnels and canopy, whether altitude separates the VR1 from the
      coastal ER101, and whether the pedometer keeps counting through blackouts. Write to
      `docs/field-notes.md`. ⇠ T-018, T-019
- [ ] **T-021** Commit the traces to `tools/fixtures/` as the permanent matching regression
      suite ⇠ T-018, T-019
- [ ] **T-021a** **Repeat at least one run on a mid-range Android device.** The project lead's
      iPhone 15 has better GNSS than much of what tourists actually carry, so iPhone-only
      fixtures are best-case. Tuning corridor widths and gap thresholds against them risks an
      app that under-credits on cheaper hardware. Sensor Logger is cross-platform, so the same
      procedure applies. ⇠ T-018, T-019

### Tile pipeline spike

- [x] **T-022** Obtain an OSM extract of Madeira **and Porto Santo** (D-021)
      — **Done 2026-08-08.** Geofabrik publishes an *Azores* extract but **no Madeira** one, so
      the pipeline takes all of Portugal (400 MB, MD5 verified) and clips to
      `-17.32,32.40,-16.20,33.20`. Fetched by `tiles/pipeline/build.sh`; gitignored.
- [x] **T-023** Build a reproducible tile generation script producing PMTiles or MBTiles ⇠ T-022
      — **Done 2026-08-08**, then **reworked the same day (D-030).** `tiles/pipeline/build.sh`
      now extracts the **Protomaps** schema from a *pinned* planet build — 12 MB, z0–15, 8.5s,
      no toolchain. Findings in `docs/tile-pipeline.md`.
      — The first version used planetiler's **default** OpenMapTiles profile, which was never
      actually chosen. It forced a CC-BY "© OpenMapTiles" credit into the souvenir video and
      stripped names from paths. **A default is not a decision.**
      — The planetiler toolchain (`tools/fetch-toolchain.sh`) is retained and proven as the
      documented self-build fallback; it is no longer needed for a normal build.
      — **Planetiler, not Tilemaker.** Tilemaker ships no Windows build at all; Docker, Java, Go
      and WSL are all absent from the dev machine. Java is supplied as a **portable JDK** in
      `tools/jdk/` — nothing installed system-wide, nothing on PATH, deletable.
      — First run pulls ~1.4 GB of global reference data (water polygons, Natural Earth, lake
      centrelines). Cached, gitignored, one-time.
- [ ] **T-024** Verify stable OSM way IDs survive into the rendered tiles. **Downgraded from
      "critical" by D-022** — useful as an internal join key, no longer architecturally
      load-bearing. ⇠ T-023
- [ ] **T-025** Prove overlay rendering: a MapLibre demo drawing a highlighted road segment
      from *local* geometry on top of the basemap, and confirm it aligns with the basemap's own
      road rendering (D-022) ⇠ T-023
- [ ] **T-025a** Evaluate suppressing basemap road rendering entirely and drawing all roads —
      visited and unvisited — from the local overlay, which makes alignment a non-issue by
      construction ⇠ T-025
      — ⚠ **Measured 2026-08-08 (T-028): this means rendering ~51,000 highway ways**, before any
      splitting at intersections — not the ~5,000 implied elsewhere. D-022 names this as the
      escape hatch for the alignment risk; it is not the cheap one it reads as. Measure before
      committing.
      — **But it need not be all-or-nothing.** T-026a found the basemap cannot distinguish a
      levada path from any other footpath (names are stripped from `transportation`). Drawing
      **only levada paths** from our own overlay is **~1,386 ways** — ~3% of the full cost, aimed
      at the one feature the product is about. Evaluate this scoped version first.
      — Cheaper still, worth eyeballing before building anything: the *named* `waterway` channel
      runs parallel to the path within a few metres, so rendering it may read as "the levada" at
      most zooms with no overlay at all.
- [~] **T-026** Record tile pack size and judge it acceptable for a hotel-WiFi download ⇠ T-023
      — **12 MB** for the whole archipelago, zoom 0–15, extracted in 8.5s (D-030). Not a close
      call. (The rejected OpenMapTiles build was 8.9 MB at z0–14 — one fewer zoom level.) **This reopens T-057:** bundling the pack in the app
      rather than downloading it on first run is now a genuine option.
      — **Not done, because this excludes terrain.** D-026 wants shaded relief, which is a
      separate elevation source and pipeline. 8.9 MB is the floor, not the answer. Re-measure
      after T-058a.
- [x] **T-026a** Verify the tile schema actually carries Madeira's defining features
      — **Done 2026-08-08** via `tools/mvt-inspect.py` (decodes MVT directly — no browser, no
      GPU, no style). **Levada channels survive with names intact** (`waterway`, `class=drain`).
      **Levada paths did not** under OpenMapTiles — names stripped from `transportation` by
      design. **Fixed by D-030:** the Protomaps `roads` layer carries `name` at z13+, verified by
      decoding a real tile. Also gains `is_tunnel` as a boolean (useful to T-069/T-087), plus
      cliffs and peak elevations. See `docs/tile-pipeline.md` §3 and T-025a.
- [ ] **T-027** ~~Decision gate on T-024~~ **Removed by D-022.** The fog-of-war fallback is no
      longer contingent on the tile pipeline preserving OSM IDs.

### Content feasibility

- [x] **T-028** Assess OSM levada coverage and quality; decide whether official PR-route data
      must be reconciled in, and confirm licensing (OD-7)
      — **Done 2026-08-08 without needing T-022.** Surveyed via Overpass, so no extract was
      required; the dependency was wrong. Reproduce with `python tools/osm-survey.py`; findings
      in `docs/osm-coverage.md`; decision recorded as **D-029**. **OD-7 closed.**
      — Headline: OSM alone is sufficient and no external licensing arises — the 44 official PR
      routes are already in OSM. **Select levadas by name + relation, never by tag** — a levada
      is two parallel ways sharing one name, and `highway=path` captures only 23% of them.
- [ ] **T-028b** Install WalkMe and look at it — the direct competitor (`docs/competitors.md`).
      Its map is app-only, so cartography, trail rendering and the offline download flow could
      not be inspected from the web. One afternoon, on the island. ⇠ nothing
- [ ] **T-028a** Field-verify the OSM levada data. Counts prove the data exists, not that it is
      accurate. Walk one known levada and compare against OSM: corridor **connectivity** (a gap
      mid-corridor breaks trailhead-to-exit crediting), tunnel **portal-node precision**, and
      whether the PR relations are current. Fold into a Track A run — same afternoon, same
      device. ⇠ T-018

**Milestone M0** — assumptions validated ⇠ T-020, T-025, T-026, T-028

---

## Phase 1 — The recorder

**Blocked until T-013 (framework decision).**

### Foundations

- [~] **T-029** Scaffold an Expo + React Native project **in TypeScript** (CONTEXT.md §6.7);
      set up iOS and Android dev builds. Note background location requires a development build,
      not Expo Go. ⇠ T-013
      — **Project scaffolded 2026-08-06** (Expo SDK 57, RN 0.86, TS strict, `blank-typescript`
      template). **Dev builds not yet created** — needs an EAS account, or a local toolchain
      (no JDK on the dev machine, and iOS needs a Mac). This is what still blocks the task.
      — **`app/eas.json` written 2026-08-10**, with a development profile that produces an
      installable APK. Runbook: **`docs/dev-build.md`**.
      — ⚠ **Corrected 2026-08-10: there is no Android device.** iPhone 15, Windows, no Mac. An
      iPhone dev build needs the Apple Developer Program ($99/yr); a free Apple ID requires
      Xcode, which requires a Mac. Three paths in `docs/dev-build.md`: the free emulator
      (T-029b) now, a cheap used Android (already required by T-021a) next, the Apple
      membership when approaching release.
- [!] **T-029b** Stand up the portable Android emulator so the app can be *seen*
      — **Parked 2026-08-10: the project lead has declined to change the BIOS setting**, which
      is their call and ends this route. The SDK stays installed (`tools/android-sdk`, 2.1 GB,
      gitignored) and works the moment virtualization is ever enabled; `rm -rf
      tools/android-sdk` reclaims the space.
      — **Superseded for interface work by D-038**, the web design workbench, which needs no
      device at all. For the map and anything native the answer is a cloud device farm or real
      hardware — see `docs/dev-build.md`.
      — `bash tools/fetch-android-emulator.sh` (~2.5 GB into gitignored `tools/android-sdk/`),
      then `run-emulator.sh` and `install-apk.sh` with an EAS-built APK. Deliberately no local
      native toolchain: EAS compiles in the cloud, the emulator only runs the result.
      — **SDK, system image and the `madeira` AVD installed 2026-08-10.**
      — [!] **Blocked on a BIOS setting.** `Virtualization Enabled In Firmware: No` on this
      machine (i5-10400F / ASUS PRIME H410M-R); the CPU supports it, the firmware disables it.
      No program can change that. Exact steps in **`docs/emulator-setup.md`** — ~5 minutes,
      then a one-command driver install. Google's hypervisor driver is already downloaded.
      — Settles T-063 (offline cold start), the migrations, the permission dialogs, and — via
      GPX route replay — the recorder end-to-end including T-034 and T-076's reshuffle.
      — ⚠ Settles **nothing** about battery, OEM killers, force-quit relaunch or iOS.
      CONTEXT §6.6 is unchanged. ⇠ T-029
- [x] **T-030** Implement the SQLite schema (raw_fix, sensor_sample, geofence_event, trip)
      with WAL mode ⇠ T-029, T-016
      — Also `recording_event` (gap honesty) and `app_state`. Migration runner; UPDATE-blocking
      triggers make the append-only rule (CONTEXT §6.2) a property of the database.
- [x] **T-030a** Define a `LocationProvider` interface so the recording backend can be swapped
      without touching matching, storage or presentation (D-025) ⇠ T-029
- [x] **T-031** Integrate **`expo-location`** (free) behind `LocationProvider` (D-025)
      ⇠ T-030a — code complete, never yet run on hardware.
- [ ] **T-031a** *Contingency only:* swap in the Transistor Soft SDK if any of T-051–T-054
      fail. Do not purchase before that evidence exists. ⇠ T-051, T-052, T-053, T-054
- [x] **T-032** Set iOS Data Protection class to `CompleteUntilFirstUserAuthentication` and
      configure Android app-private storage ⇠ T-030
- [~] **T-032a** Backup policy (ARCHITECTURE.md §4a): **include** the SQLite database,
      **exclude** the tile pack. iOS `isExcludedFromBackup`; Android manifest backup rules.
      Exceeding Android's auto-backup cap can silently fail the *whole* backup, losing the
      user's trip history. ⇠ T-032, T-057
      — **Android half done**: `plugins/withAndroidBackupRules.js` writes both rule files and
      sets the manifest attributes. **iOS half still open** — `isExcludedFromBackup` is a
      runtime flag set when the tile pack is written, so it lands with T-057.

### Capture

- [~] **T-033** Implement batched location delivery — iOS deferred updates, Android
      `setMaxWaitTime` ⇠ T-031
      — Configured via `deferredUpdatesInterval` / `deferredUpdatesDistance`, which is the only
      batching knob `expo-location` exposes; it does not surface `setMaxWaitTime` by name.
      **Whether Android actually batches rather than delivering per-fix is unverified** and is
      a direct input to the battery target (T-054).
- [x] **T-034** Implement **stationary-vs-moving** sampling gating (D-028) ⇠ T-031
      — **Trigger decided 2026-08-08.** Derive from distance over time — starting point: moved
      less than ~100 m in ~10 min → stationary profile. No new sensor, no new dependency, no new
      permission, identical on both platforms. The ~100 m / ~10 min figures are **guesses**,
      tuned by T-038.
      — Built 2026-08-10. `movementPolicy.ts` decides (pure, 13 tests), `samplingGate.ts`
      applies, and the location task calls it once per batch. **The rule is asymmetric on
      purpose:** one fix flips to moving, ten minutes of evidence are needed to go stationary —
      being slow to notice a stop costs battery, being slow to notice a start costs trace.
      — Fixes less accurate than 100 m are ignored, so canopy noise cannot fake movement. A
      *stale* window keeps the current profile: silence is not stillness (ARCHITECTURE §10).
      — ⚠ **The gate can put the recorder to sleep and cannot wake it.** The stationary profile
      sets `pausesUpdatesAutomatically`; if iOS stops delivering, no fix arrives, so the gate
      never runs again. Recovery is region monitoring and significant-location-change (T-047)
      plus the day-1 check (T-049) — all untested. **This is the thing to watch in T-051.**
      — Walking-vs-driving is **deferred** to a single "moving" profile (see T-034a). Speed alone
      cannot separate them in Madeira: steep gradients and Funchal traffic compress driving
      speeds into walking range.
      — The pedometer may be consulted as a **classifier** on iOS where speed is ambiguous. It
      must **never** gate recording on or off — that would blind us to the tunnel drives and the
      VR1 on a rental-car-dominated island (D-028).
- [ ] **T-034a** *Deferred:* revisit walking-vs-driving gating once T-020 shows whether the
      distinction pays for itself. If it does, the Android answer is a dedicated step-counter or
      activity-recognition dependency — costing a new dependency (§6.4) **and** an
      `ACTIVITY_RECOGNITION` runtime permission. Do not spend either on a guess. ⇠ T-020, T-034
- [x] **T-035** Capture barometer / relative altitude alongside GPS ⇠ T-030
      — Sampled once per location batch, so the profile is only as dense as the batches.
      `relativeAltitude` is iOS-only; Android stores pressure and derives altitude later.
- [~] **T-036** Capture pedometer step counts alongside GPS ⇠ T-030
      — **iOS only.** `expo-sensors` has no historical step query on Android, and its live
      watcher does not deliver in the background. Android currently stores null, which the
      sensor fallback (T-090) must treat as "unknown", never as zero.
- [x] **T-037** Immediate incremental flush on every batch — never hold a day in memory
      ⇠ T-030, T-033
      — One transaction per batch: one disk sync per OS wake-up, not one per fix.
- [ ] **T-038** Sampling policy tuned against Phase 0 field data ⇠ T-020, T-033, T-034

### Geofence backbone

- [x] **T-039** Implement the dynamic geofence manager — nearest ~18 registered plus one large
      "left this area" trigger that reshuffles the set (iOS 20-region cap) ⇠ T-031
      — Built 2026-08-10. Selection rule and its unmeasured constants: **D-033**.
      `geofenceSelection.ts` is pure and unit-tested (18 tests, `npm test`); `geofenceManager.ts`
      is the part that talks to the OS and SQLite. Rebuilds are triggered by the anchor's exit
      event and, as a backstop against a missed event, by recorded fixes.
      — ⚠ **Verified only on a laptop.** No device has run this. T-076 is the real test.
- [x] **T-040** Load geofence definitions from the content pack, not from code ⇠ T-039, T-014
      — Built 2026-08-10. Format and loading rules: **D-034**. `content/pois.json` is the file;
      `content/README.md` is the guide for filling it in; `node tools/validate-content.mjs`
      checks it using the app's own parser.
      — A broken file stops the app; a broken row is dropped, counted and logged. Ids starting
      with `__` are rejected (reserved for mechanism regions, D-033).
      — ⚠ **The pack is empty.** Everything below the content curation heading in Phase 3 is now
      the only thing standing between the app and a working reward loop.
- [x] **T-041** Persist geofence enter/exit/dwell events ⇠ T-039, T-030
      — Enter/exit persisted. Note `dwell` is **not** an OS event on either platform: the
      dwell + speed gate (D-009) is computed later over the enter/exit log, which is what keeps
      the award thresholds retunable without re-collecting anything.

### Permissions and survival

- [x] **T-042** Permission flow: While-Using first and **fully functional**, with explicit
      start/end recording mode ⇠ T-031
      — Done 2026-08-10: **D-041**. `onboarding/permissionPolicy.ts` decides (pure, 17 tests),
      `OnboardingView` + `OnboardingFlow` present and drive it. The start/stop control already
      lives on the primary screen for non-Always users (T-075).
      — **The battery sentence is omitted, not estimated.**
      `MEASURED_BATTERY_PERCENT_PER_DAY` is null until T-054 measures one, and a test asserts
      it. A guessed percentage is a promise the app has not earned.
      — The start/stop control is a **primary-screen action shown only to users without Always**,
      not a settings item (`docs/design-brief.md` §3.3).
      — **State the battery cost in the copy**, next to the control that turns tracking on:
      "uses about N% of your battery per day." Use the **measured** figure from T-054, never an
      invented one. ⇠ T-054 for the number, not for the work.
- [x] **T-043** Deferred "Always" upgrade request, timed for ~day 2 ⇠ T-042
      — Same honest-battery-figure treatment as T-042.
      — Done 2026-08-10. Offered at 40h — after the day-1 check at 14h, because two prompts in
      one morning loses both — and **exactly once, ever**. A second ask is pressure, and
      pressure is what gets permissions revoked (D-008). It also waits until something has been
      recorded, so the pitch can be made in terms of the map they already have.
- [x] **T-044** Detect iOS Always → While-Using downgrade and prompt gently for recovery
      ⇠ T-043
      — Done 2026-08-10. Compares the observed permission against the last one recorded, and
      records before acting so a downgrade is reported once. Losing location entirely is
      deliberately *not* reported here — the day-1 check already covers it, and doubling up
      would nag.
- [ ] **T-045** Android foreground service with the `FOREGROUND_SERVICE_LOCATION` type
      ⇠ T-031
- [x] **T-046** Android battery-optimisation exemption request ⇠ T-045
      — Done 2026-08-11. **D-045.** `recording/batteryOptimisation.ts`, and a settings section
      headed "If recording keeps stopping". Android only; absent on iOS.
      — **Opens the system battery-settings screen rather than requesting the restricted
      permission.** The one-tap dialog needs `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, which Play
      reviews — and T-123's background-location review is already slow and on the critical path.
      Two taps is a cheaper price than a rejected submission. **Held in reserve** if T-053 shows
      OEMs killing the recorder anyway.
      — ⚠ **The app cannot read whether it is exempt** (no Expo API for
      `isIgnoringBatteryOptimizations`), so the row offers the action and **claims no state** —
      an invented "Off" is exactly what D-041 forbids. T-049's health check catches the symptom
      instead.
      — No unit test, deliberately: nothing here is pure. Verified in the workbench (section
      present, in order, 60 dp, no jargon). **T-053 is the real test and it needs a device.**
- [ ] **T-047** iOS region monitoring + significant-location-change as the
      termination-survival backbone (survives force-quit) ⇠ T-039
- [~] **T-048** Service health monitor and gap annotation ⇠ T-037
      — `recording_event` diary plus `getRecorderHealth()` and SQL gap detection are in.
      Still missing: the gap **threshold** is a guess (30 min) pending T-020/T-051, and gaps
      are detected on demand rather than annotated onto the trace.
- [x] **T-049** Day-1 self-check (12–24h after install) verifying recording actually happened
      ⇠ T-048
      — Done 2026-08-10. `healthCheckPolicy.ts` decides (pure, 12 tests), `healthCheck.ts`
      sends. Fires once per install, 14h in, on app launch — a no-op before the window.
      — **Deliberately asymmetric.** An alarm needs positive evidence; anything ambiguous
      stays quiet. A quiet evening in a hotel is not a fault, and While-Using is not a fault
      (D-008). The case it exists for is *running, permitted, and no fixes* — the OEM battery
      killer, which nothing else in the system would notice.
      — A **healthy** check still notifies, because D-011 promises reassurance and a check
      that only appears when something is broken teaches people to dread it.
      — Local notifications only: no push token, no server, nothing registered (D-001). The
      Android 13+ notification permission is **not** requested here — stacking it on the
      location dialog is the surest way to have both refused. It belongs in T-114.
- [x] **T-072a** Per-category progress computation (D-027) — the passport's primary axis
      ⇠ T-066, T-071
      — Done 2026-08-10 with T-073, in `progress/tripProgress.ts` (pure, 13 tests). All five
      rows always exist, including empty ones: a passport whose pages appear and disappear as
      you travel is not a passport.
- [x] **T-073** Per-region progress computation ⇠ T-067, T-071
      — Done 2026-08-10. Also `suggestNextRegion()` — the nudge points at the region *nearest
      to finishing*, not the emptiest, because that is the one most likely to be acted on
      (D-002: the uncollected places are the recommendation).
      — ⚠ **The denominator excludes locked regions from both halves** (D-024). Getting this
      wrong is the named trap: a tourist who never takes the ferry must never see a total they
      cannot reach. The locked set is threaded through and empty until **T-067a** fills it.
- [x] **T-050** Debug screen: raw fix count, last fix time, gaps, permission state, service
      health ⇠ T-048
      — Also sensor counts, last barometer/step reading, live-ticking last-fix age, the event
      diary, and the delete-all control. Built to D-015 (60dp targets, no colour-only status)
      because it gets read outdoors in sunlight during field tests.

### Verification

- [ ] **T-051** 72-hour untouched-device soak test producing a continuous trace ⇠ T-047, T-048
- [ ] **T-052** iOS force-quit test — recording must resume ⇠ T-047
- [ ] **T-053** Aggressive-OEM Android test (Xiaomi / Samsung / Oppo) ⇠ T-045, T-046
- [ ] **T-054** Measure battery cost over a 12-hour day; target ≤5% ⇠ T-038
- [ ] **T-055** Verify zero network traffic attributable to recording ⇠ T-051
      — **Overlaps T-117b** (added 2026-08-11), which watches the *whole app* including FCM
      (D-043). Run them as one capture; this task is the recording-specific reading of it.

**Milestone M1 — "It remembers"** ⇠ T-051, T-052, T-053, T-054, T-055

---

## Phase 2 — Offline map rendering

- [x] **T-056** Integrate MapLibre GL Native ⇠ T-029, T-025
      — Done 2026-08-10: `@maplibre/maplibre-react-native` 11.3.6 + config plugin.
      `src/map/mapAssets.ts` copies packs and glyphs from the binary to device storage
      (PMTiles needs byte-range reads Android's asset reader cannot do) and
      `src/map/mapStyle.ts` fills the generated style templates with real `pmtiles://file://`
      URIs. Camera bounds come from the style's metadata, not from coordinates in code (D-017).
      — ⚠ **Has never rendered on a device.** Typecheck, tests and bundle only. First dev-build
      run must verify: hillshade renders, PMTiles resolve, glyphs load offline (T-063).
- [x] **T-057** Bundle or WiFi-gated first-run download of the tile pack ⇠ T-026, T-056
      — **Resolved 2026-08-10: bundled (D-036).** 19.1 MB rides in the binary; first launch
      copies it out. The download path is not built; the decision names the revisit trigger.
      — The copies live in the **cache directory**, which both platforms exclude from backup by
      construction, so no per-platform exclusion rule is needed and none can rot (D-036
      amendment). Purging is self-healing — the source is the binary.
- [x] **T-058** Author the **light** base style — the everyday in-app map (D-026). Start from an
      existing permissively-licensed style (Protomaps basemap theme, or CARTO Positron over an
      OpenMapTiles-schema build) and **subtract**: strip labels, mute roads, quiet the water and
      landcover so the trace can dominate. **Do not author from a blank file.** Verify the
      starting style's licence. Minimal labels — city names and major cultural landmarks only.
      ⇠ T-056
      — Done 2026-08-10, as a **generator**: `tiles/style/generate.mjs` derives `light.json`
      (and a draft `dark.json`, T-139) from `@protomaps/basemaps` (BSD-3-Clause, licence
      verified). Every choice is either a flavor colour override or an entry in the
      subtraction list, each with its reason. **Never hand-edit the JSON.** Method and preview
      instructions: `docs/map-style.md`.
      — Iterated on screen against the real pack at four test locations. ⚠ **Not the real
      test** — that is T-065, outdoors. Glyphs are still remote (viewer-only); bundling them is
      T-056/T-057 and gates shipping.
- [x] **T-058a** Add **shaded terrain** as the figure-ground element instead of building
      footprints (D-026). Madeira's relief is the island's defining feature and OSM building
      coverage is patchy outside Funchal. Record the tile-size cost against T-026. ⇠ T-058, T-023
      — Done 2026-08-10: **D-035** — raw terrarium elevation (z0–12, **6.5 MB**; total pack now
      **19.1 MB**), shaded at render time so one pack serves both styles.
      `python tiles/pipeline/build-terrain.py` rebuilds it. ⚠ Hillshade on
      `maplibre-react-native` is unverified on-device (T-056).
- [x] **T-059** **v1: draw the recorded raw trace** as a line layer from `raw_fix` (D-032) —
      not matched segments. Simplify for rendering; keep the stored fixes untouched (D-010).
      ⇠ T-058, T-030
      — Done 2026-08-10. `src/map/traceGeoJson.ts` (pure, 9 tests): a silence longer than the
      recorder's own gap threshold breaks the line rather than bridging it (ARCHITECTURE §10),
      and fixes worse than 120 m accuracy are not drawn — the stored rows are untouched.
      Rendered as casing + core so the trace stays legible over terrain shadow (D-015).
      — No simplification yet: a week of batched fixes is small. T-064 measures; simplify only
      if it says so.
      — **Amended 2026-08-11 (T-105a):** the segmentation is now `splitIntoSegments`, exported,
      and `buildTrace` is built on it. The souvenir needs the same strokes with timestamps
      attached, and two callers deciding independently where a line breaks would be two chances
      to bridge a blackout.
      — D-022's overlay-alignment risk **does not apply in v1**: there is no road geometry being
      drawn over the basemap's own roads, so nothing can be misaligned. D-022 governs v2.
      — *v2:* visited/unvisited styling via data-driven expressions over local `road_graph`
      geometry keyed on OSM way ID. Not feature state (D-022). ⇠ T-082
- [ ] **T-060** Accessibility styling pass **in both styles** (D-015, D-026): unvisited stays
      legible mid-grey, never near-black and never near-invisible. Visited differentiated by
      **weight plus brightness/darkness**, never hue alone — brighter and heavier in the dark
      style, darker and heavier in the light style. ⇠ T-059, T-139
- [ ] **T-061** Respect system font scaling for all map labels ⇠ T-058
- [ ] **T-062** Camera defaults and sensible pan/zoom bounds ⇠ T-056
- [ ] **T-063** Verify cold start renders fully in airplane mode ⇠ T-057
- [ ] **T-064** Performance test: recolour **the real graph**, not a sample ⇠ T-059
      — **Target corrected 2026-08-08 (T-028).** The old "5,000+ segments" figure was an order of
      magnitude low: Madeira has **~51,000 highway ways** before splitting at intersections. Test
      against the actual island. If T-025a is adopted, all of them render every frame.
- [ ] **T-065** Outdoor sunlight legibility test — **in Funchal, at midday, held at arm's
      length.** This is the test that decides whether D-026's light-for-use choice was right.
      Run it against both styles. ⇠ T-060
- [ ] **T-139** Author the **dark** style variant for the souvenir renderer (D-026) — the
      fog-of-war look: dark ground, unvisited legible mid-grey, visited bright and heavy. Shares
      the same tile pack as T-058. Also offered as a user preference (T-140). ⇠ T-058
      — An untuned draft already exists (`dark.json`, generated alongside light). The task is
      now tuning its flavor and hillshade in `generate.mjs`, not starting one.
- [x] **T-140** Light/dark preference in settings (D-026). Defaults to light for in-app use;
      the souvenir always renders dark regardless of this setting. ⇠ T-139, T-141
      — Done 2026-08-10 as part of T-141. The control exists and holds its choice; **wiring it
      to the map's style is still open** — `MapScreen` hardcodes `light` until the dark style
      is tuned (T-139).

**Milestone M2 — "It looks like Madeira"** ⇠ T-063, T-064, T-065

---

## Phase 3 — Stamps, geofences and regions

### Content curation

- [ ] **T-066** Curate 150–250 POIs on **Madeira only** — hand-verified. Porto Santo POI
      curation is explicitly deferred (D-021) — do not spend effort on it. ⇠ T-015, T-016d
      — **Every place must be assigned exactly one of the five categories** (D-027):
      **Viewpoints · Levadas · Villages · Beaches · Landmarks**. There is deliberately no
      "Other" — if a place fits nowhere, that is a signal about the place, not a missing row.
      — Each place also carries a `region_id`, used by the map screen rather than the passport.
      — Categories live in the content pack, never in `app/` (D-017).
      — **This is selection, not research** (T-028): OSM already offers 569 `tourism=viewpoint`
      nodes, 180 peaks and 79 settlements in the bbox — far more candidates than the 150–250
      target. The work is hand-verification and editorial judgement, which is the one thing a
      global competitor cannot buy (CONTEXT §5a).
      — **Unblocked 2026-08-10 (T-040).** The file to fill in is `content/pois.json`; the format,
      the levada two-geofence rule and the guidance on choosing radii are in
      `content/README.md`; `node tools/validate-content.mjs` checks the work and reports
      progress against the target. Nothing else is waiting on anything.
- [ ] **T-067** Define region boundaries as `content/regions.geojson` ⇠ T-014
- [ ] **T-067a** Porto Santo lock/unlock gate (D-024): hidden from map, region list and UI
      until an island-level geofence fires; unlock is permanent. **The stamp denominator must
      count unlocked regions only**, or the headline number breaks. ⇠ T-039, T-067, T-073
- [ ] **T-068** Define levada corridors with entry/exit nodes ⇠ T-028, T-028a
      — **Select by name (`Levada*`) plus hiking-relation membership, never by a single tag**
      (D-029). A levada is two parallel ways sharing one name: the channel (usually
      `waterway=drain`, 2,357 ways) and the footpath beside it (usually `highway=path`, 922).
      Use the `highway=*` ways for matching — the user walks the path, not the channel — and fall
      back to `waterway=*` geometry where a channel is mapped but no path is.
      — **Verify corridor connectivity.** A gap mid-corridor silently breaks trailhead-to-exit
      crediting, which is the mechanic levadas depend on (D-009).
- [ ] **T-069** Extract tunnel portal pairs from OSM into `content/tunnels.geojson` ⇠ T-022
      — **Must cover walkable tunnels, not just road tunnels.** 108 of the 604 tunnel ways are
      levada tunnels (T-028) — zero GPS, on foot, which is exactly the T-089/T-090 case.
- [x] **T-070** Commission or produce stamp artwork ⇠ T-066
      — Done 2026-08-11. **D-046.** `passport/stampArt.ts` (pure, 32 tests) + `ui/StampArt.tsx`.
      **Generated per place**, not commissioned: 150–250 places (D-002) cannot each have an
      illustration, and a place added next month must arrive with artwork already or curation
      acquires a second job. Vintage die-cut luggage labels, from the project lead's reference.
      — **The emblem carries the category; shape and colour do not.** First version made the
      silhouette carry it; the project lead asked for varied shapes, so the accessibility
      requirement (D-015: never hue alone) moved to the emblem. **Eight** silhouettes, six
      colourways per category, spread by a hash of the place id — never a clock or an index, so
      a stamp cannot change appearance between launches.
      — **Layout is searched, not tabulated** (`bestBandY`, `bestEmblem`): the band goes as low
      as the shape allows while leaving the emblem room, and the emblem is fitted to what is
      left. That is what makes **the place name fit** a property of the system rather than of
      the examples. Long names wrap to two lines rather than being cut with an ellipsis.
      — ⚠ **Three defects found by measuring the output, not by looking:** the sunburst painted
      straight over both borders and outside the sticker; the emblem escaped upward on a shield
      because the band took the whole panel top; and the emblem overhung a diamond's sloped
      sides while passing a containment test that only checked its middle. Each has a test now.
      — ⚠ **Seen twice, in a browser, by one person. No device has drawn it**, and the colours
      have never been outdoors (T-065).
      — Adds `react-native-svg`. Audited the same day per CONTEXT §6.4 — see
      `docs/dependency-audit.md`; it drags in Fresco's OkHttp image pipeline, unused here.

### Mechanics

- [x] **T-071** Stamp award rules: dwell time **and** plausible speed gates (D-009) ⇠ T-041,
      T-066
      — Done 2026-08-10: **D-037**. `progress/stampRules.ts` is pure and judges (23 tests);
      `progress/stampAwards.ts` runs the pass and writes `stamp_award` (migration 2).
      — Two gates: 3 min dwell and ≤2 m/s mean speed while inside. **Levadas verify both
      endpoints independently** — the naive "entered both ends" rule would award the stamp to
      somebody who drove between two trailheads, which on this island is often faster than
      walking. T-078 is covered by a test that says so in its name.
      — Missing speed lowers confidence rather than vetoing: refusing would deny stamps under
      canopy, which is the D-032 uninstall trigger.
      — A **pass**, not a listener: idempotent, re-runnable, derived. Runs when the app opens
      and at trip end (T-101). That is what lets T-131 retune thresholds over holidays already
      recorded.
      — ⚠ Every threshold is a guess and nothing has been judged on real data.
- [x] **T-072** Store a confidence value on every stamp award ⇠ T-071
      — Done with T-071. 0–1, from how comfortably each gate was cleared, deliberately
      non-saturating so a marginal award stays distinguishable from an obvious one. Stored
      alongside dwell, mean speed and a written reason; never shown to the user.

      — **Consumed by the map screen, not the passport** (D-027). It does the "where should I go
      next" job that D-002 needs it for. Denominator counts **unlocked regions only** (D-024).
- [x] **T-074** Passport (stamp collection) screen ⇠ T-070, T-071, T-072a
      — Done 2026-08-10. `ui/PassportView.tsx` is presentational (props in, pixels out) and
      `ui/PassportScreen.tsx` is the container. Five category rows always, including empty
      ones (D-027). The levada stamp is heavier and differently coloured — never hue alone
      (D-015) — because it is the one that means "you walked the whole thing".
      — ⚠ **Stamp artwork is a placeholder** (a disc with an initial). T-070 designs the real
      thing; the placeholder still shows the density and rhythm T-081 asks about.
      — Organised by **category**, five named rows, no catch-all (D-027).
      — **The levada row is different in kind:** every other category means "you arrived
      somewhere"; a levada stamp means "you walked the whole thing" (trailhead + exit geofence,
      D-009). Hardest to earn, most valuable, and it should look like it.
- [x] **T-075** Primary screen: map, plus **three controls only** ⇠ T-015, T-073, T-074
      — Done 2026-08-10. `ui/PrimaryOverlay.tsx` over `MapScreen`: gear top-left, stamp button
      bottom-right carrying the hero number `23 / 180`, and the conditional start/stop shown
      only to users without Always (D-008).
      — **A real bug the workbench caught:** side by side, the two bottom controls overlapped
      by 38 px on a 320 dp phone at `180 / 180` with the recording control visible. They now
      stack; verified zero overlap at 320/360/390/430, all controls 60 dp (D-015).
      — Layout per `docs/design-brief.md` §3: gear top-left, stamp button bottom-right,
      conditional start/stop for While-Using users.
      — **The stamp button carries the hero number** (icon + `23 / 180`). One element, two jobs —
      this is how the one-hero-number requirement is met without a fourth element on screen.
      — Never show a coverage percentage as the headline (D-002).

### Verification

- [ ] **T-076** Verify the geofence set reshuffles correctly while crossing the island
      ⇠ T-039, T-066
      — **Does not need T-066 to start.** The debug screen's *Start geofence field test*
      button generates a synthetic catalogue around wherever you are standing, sized so the
      platform's region cap binds and the anchor lands at roughly 850 m — a five-minute walk.
      Walk that far and the diary should show a `geofence` rebuild with a different set.
      — This is what sets the three guessed constants in **D-033**. Note the delivery *lateness*
      of the anchor exit at driving speed, not just that it arrived.
- [ ] **T-077** Verify a stamp fires reliably on arrival at a miradouro ⇠ T-071
- [ ] **T-078** Verify driving past a levada trailhead does **not** award it ⇠ T-071
- [ ] **T-079** Verify stamps still award with GPS accuracy degraded to 100m ⇠ T-071
- [ ] **T-080** Verify geofencing battery cost is not measurable above baseline ⇠ T-076
- [x] **T-081** Verify the passport screen is legible with 3 stamps and with 200 ⇠ T-074
      — **Measured 2026-08-10** in the web workbench (D-038), not eyeballed. Day one and 3
      stamps each fit **exactly one screen**; 23 stamps 1.05; 180 stamps 2.66 screens, all
      rendered. The first attempt scrolled to 1.1 screens at 3 stamps — five "No X yet" lines
      — which is what the measurement caught and one invitation fixed.
      — ⚠ Still unverified on hardware: real font scaling and sunlight (T-065).

**Milestone M3 — "It rewards you"** ⇠ T-077, T-078, T-079, T-080, T-081

---

## Phase 4 — Map matching and road highlighting

> ## ⛔ DEFERRED TO v2 — D-032 (2026-08-08)
>
> **Do not build any of this for v1.** v1 draws the **raw GPS trace** instead of matching it to
> road segments. This is the single largest body of work in the project, in service of something
> D-002 already calls *decoration* — while the actual reward (stamps) comes from geofences, which
> need almost no accuracy.
>
> **Deferring costs nothing permanent.** D-010 retains raw traces immutably, so matching can be
> added in v2 and run **retroactively over every trip already recorded**. That is precisely the
> property D-010 was written to buy.
>
> Everything from T-082 to T-098 below is v2. Left in place, unrenumbered, with dependencies
> intact.

### Graph and core matching

- [ ] **T-082** Import the road/path graph into SQLite with an R-tree spatial index ⇠ T-022,
      T-030
      — Scale, measured 2026-08-08 (T-028): **~51,000 highway ways** before splitting at
      intersections.
      — **Open question to settle here, not in an implementer's head: do footways belong in the
      graph?** There are **16,066**, overwhelmingly Funchal pavements. Including them makes the
      city a mass of pavement fragments, inflates any denominator they touch, and adds matching
      ambiguity exactly where GPS is already multipathed by buildings. Excluding them is probably
      right. Decide explicitly and record it.
- [ ] **T-083** Snap-to-segment matching using heading, speed and **altitude** ⇠ T-082, T-035
- [ ] **T-084** Hysteresis to prevent flicker between vertically stacked roads (VR1 vs ER101)
      ⇠ T-083
- [ ] **T-085** Wide match corridor for paths — 50–75m vs 15–25m for roads ⇠ T-083
- [ ] **T-086** Movement-bout segmentation using activity type and speed ⇠ T-034, T-083

### Generous crediting (D-009)

- [ ] **T-087** Tunnel portal inference — portal A then portal B credits the whole tunnel
      ⇠ T-069, T-083
- [ ] **T-088** Shortest-path gap bridging with plausibility checks (starting thresholds:
      <~30 min, <~15 km). Must **not** attempt to credit a road route across the Porto Santo
      ferry crossing (D-021). ⇠ T-082, T-083
- [ ] **T-089** Levada corridor crediting — trailhead + exit credits the whole walk ⇠ T-068
- [ ] **T-090** Sensor-only fallback — trailhead + step count + elevation profile ⇠ T-036,
      T-035, T-089
- [ ] **T-091** Store `confidence` and `credit_method` on every visited_segment ⇠ T-083

### Execution and verification

- [ ] **T-092** Burst matching scheduler — runs on idle or charge, never per-fix ⇠ T-086
- [ ] **T-093** Re-runnable matching over stored raw traces ⇠ T-092, T-016
- [ ] **T-094** Matching regression harness running against the Phase 0 fixtures ⇠ T-021,
      T-083
- [ ] **T-095** Verify a tunnel drive is credited with zero fixes inside it ⇠ T-087, T-094
- [ ] **T-096** Verify a canopy-blackout levada is credited end to end ⇠ T-089, T-090, T-094
- [ ] **T-097** Verify the VR1 and the coastal road are never confused ⇠ T-084, T-094
- [ ] **T-098** Verify burst matching over a full day has no noticeable battery cost ⇠ T-092

**Milestone M4 — "The map fills in"** ⇠ T-095, T-096, T-097, T-098 — **v2 milestone (D-032)**

---

## Phase 5 — The souvenir

- [x] **T-099** Trip-end detection via airport geofence, plus Porto Santo airport and the
      Funchal cruise terminal ⇠ T-039, T-014
      — Done 2026-08-10: **D-039**. `progress/tripEnd.ts` decides (pure, 16 tests),
      `progress/tripEndDetection.ts` runs it on every geofence crossing and on app launch.
      — **The trap D-012 does not mention: the user crosses the airport geofence on the way
      IN.** Naively, every holiday ends forty minutes after it starts and the reveal is spent
      in arrivals. An airport crossing only ends a trip if the user has been somewhere else
      first *and* the trip is 20h+ old *and* they dwelled 45 min.
      — The content pack gains `departurePoints` — monitored so the trip can end, excluded
      from the stamp rules so nobody collects an airport.
- [x] **T-100** Fallback trip-end detection — left island bounding box, or 24h+ no data.
      **Must treat Madeira and Porto Santo as a single region (D-021)**, otherwise a day trip
      to Porto Santo falsely ends the trip. ⇠ T-099
      — Done 2026-08-10. The bounds cover both islands, so a ferry day trip stays inside them;
      there is a test asserting Porto Santo reads as *inside*. Inaccurate fixes (>200 m) are
      ignored so one wild reading cannot end a holiday.
      — **Silence takes three days, not 24h** (D-039). Silence means "the user left" *or* "an
      OEM killed the recorder", and ending a live trip on the second would fire the reveal over
      a half-recorded holiday. D-012 said "24h+", so this is within its latitude.
- [x] **T-101** Finalisation pass — run any pending matching before the reveal ⇠ T-092, T-099
      — Done 2026-08-10, and **much smaller than this task was written expecting**: after
      D-032 there is no matching to finalise, the trace is drawn raw. What remains is running
      the stamp award pass once more before revealing, so the reveal can never show a total
      that omits a stamp the user earned.
- [x] **T-102** Reveal notification at the departure-lounge moment ⇠ T-099
      — Done 2026-08-10. The second and last notification of the trip (D-011). Leads with the
      number collected, because that is what they will want to see and might share (D-013).
      — Fired from the geofence crossing rather than the next app launch, which is what puts
      it in the departure lounge — D-012 calls that the best moment in the product.
- [x] **T-103** Accommodation detection — identify the most frequent overnight location
      ⇠ T-030
      — Done 2026-08-10: **D-040**. `souvenir/accommodation.ts`, pure, 15 tests. Clusters
      overnight fixes (01:00–05:00 local) within 150 m; needs 3 before it believes anything, so
      one stray night or one wild fix cannot become "home". Reports nights as well as fixes,
      because one restless night at 02:00 and 03:00 is not a pattern.
- [x] **T-104** Accommodation masking applied by default to all exports (D-016) ⇠ T-103
      — Done 2026-08-10. **`souvenir/exportTrace.ts` is the only door a trace leaves by** —
      the renderer (T-105) and every future export read from it, never from `rawFixDao`. That
      is the enforcement: masking is not a step somebody remembers, it is the only way out.
      There is deliberately **no opt-out parameter**.
      — **An unverifiable trace is withheld, not exported.** If overnight fixes exist but no
      accommodation resolves, the export returns nothing and says why. A null accommodation
      must never read as "nothing to hide" — that inversion is how this fails silently, in the
      direction that publishes an address.
      — Mask radius 300 m against a 150 m cluster radius: the goal is making the building
      unidentifiable, not merely covering GPS error.
      — ⚠ **T-110 still has to confirm it on a real export.**
- [ ] **T-105** On-device 9:16 vertical video renderer — animated trace draw-on, stamps
      popping in collection order, camera flyover ⇠ T-059, T-074
      — **Split 2026-08-11 into T-105a and T-105b (D-042).** The composition is arithmetic and
      testable today; the encoder is not verifiable without a device. Same split as
      `stampRules`/`stampAwards`. T-105 stays open as the parent until T-105b closes.
- [x] **T-105a** The **composition** — what appears when, in what order, and where the camera
      is pointing ⇠ T-059, T-104
      — Done 2026-08-11. **D-042.** `souvenir/composition.ts` is pure and turns a trip into a
      storyboard: absolute times from the start of the video, three scenes, a camera path, the
      strokes, and the moment each stamp lands. 23 tests. `souvenir/souvenirPlan.ts` is the
      impure half that reads the trip.
      — **Paced by movement, not by hours.** One recorded fix per step, so the film is not a
      third stationary dot, and a blackout is a visible beat rather than a bridged line.
      — **No stamp is ever dropped**, however crowded. **An unsafe trace produces no film at
      all** — the input demands `safeToShare` from `getExportableTrace` (D-040) and the return
      type is a union, so a caller cannot reach the scenes of a refusal.
      — ⚠ **Nobody has watched anything.** Every duration is a guess; `MIN_CUE_GAP_MS` is a
      legibility figure and legibility is measured by watching. T-105b is what confirms them.
- [ ] **T-105b** Encode the storyboard to an MP4 on the device ⇠ T-105a
      — Needs native video encoding, which is the part that cannot be verified without a
      device. It consumes `Composition` and needs no judgement of its own.
      — Also where the *look* is decided: whether the finale shows a denominator (D-042 carries
      both numbers deliberately), and whether the guessed durations survive being watched.
- [ ] **T-106** Watermark ⇠ T-105b
- [ ] **T-107** Still-image export ⇠ T-105b
- [ ] **T-108** Share sheet integration ⇠ T-105b, T-107
- [ ] **T-109** Verify render completes on-device in under ~30 seconds ⇠ T-105b
- [ ] **T-110** Verify the accommodation is not identifiable in a default export ⇠ T-104
- [ ] **T-111** Verify the reveal works when the app has not been opened since install day
      ⇠ T-102

**Milestone M5 — "It hands you a souvenir"** ⇠ T-109, T-110, T-111

---

## Phase 6 — Simplicity, accessibility and compliance

### UX reduction

- [ ] **T-112** Ruthless UI reduction pass — one primary screen, one hero number ⇠ T-075
      — Target is already set by `docs/design-brief.md` §3: map plus three controls. Watch
      specifically for banner/promo cards accumulating over the map; the reference app loses the
      top third of its map to two stacked dismissible banners.
- [x] **T-113** Tap targets 60dp minimum, high contrast, large type throughout ⇠ T-112
      — **Contrast done 2026-08-11, and made mechanical.** `ui/contrast.ts` (WCAG 2.1
      luminance and ratio, pure) + `contrast.test.ts` (13 tests) check **every** text pair in
      `theme.ts` and **all thirty stamp colourways**. Body text is held at **5:1, above WCAG's
      4.5**, because CONTEXT §6.5 requires reading in Funchal sun at arm's length, not indoors.
      — ⚠ **It found three real failures that had already been written, reviewed and shipped:**
      a teal stamp name on dark slate at **3.03:1**, cream on bright red at **3.90:1**, and
      `colors.border` at **1.85:1** — the last one draws the outline of every settings row,
      which is what tells the user where the 60 dp tap target is. All three are fixed.
      — ⚠ **And one assertion of mine was simply wrong**, in the direction that would have done
      damage: it measured each sticker's *outer border* against the page, failed ten colourways,
      and would have forced ten approved colours lighter. What delineates a sticker is the bright
      paper panel, not the border, and the stamps sit on `surface` rather than `background`. The
      reasoning is written into the test rather than left in a commit message.
      — **Tap targets and type done 2026-08-11, by measuring.** Every screen the workbench
      mounts was walked in the DOM and every control's height read: **10 screens, 26 controls,
      none under 60 dp**, at normal size and again at **2× text scaling**. On the longest
      onboarding copy at 2× — where the body text grows from 102 px to 309 px — both buttons
      stay 60 dp, stay outside the scrolling copy and stay reachable, which is D-041's property
      under the stress it was written for.
      — ⚠ **The 2× simulation was itself verified before its results were believed.** RN Web
      writes inline styles, so a re-render could have silently undone the doubling and every
      "no problems" would have been a measurement of the unscaled screen. Confirmed by A/B on
      one screen: body copy 17 px → 34 px, its height 102 → 309.
      — `ui/accessibility.test.ts` holds the mechanically checkable half: font scaling is never
      switched off, type sizes always come from the theme, and any file rendering a control
      references `MIN_TAP_TARGET`. **Both source rules verified by deliberately breaking a
      screen.** They do not prove accessibility — they close three ways of losing it.
      — ⚠ **Two surfaces are unmeasured** because the workbench cannot mount them: the passport's
      back button (`PassportScreen`, needs the database) and the whole debug screen. Both use
      `MIN_TAP_TARGET` in their styles, which is an argument, not a measurement.
      — ⚠ **Nothing has been touched by a finger.** Real tap targets, the text size an
      80-year-old actually has set, and sunlight (T-065) are all still untested.
- [x] **T-114** Minimal plain-English onboarding, no jargon ⇠ T-042
      — Done 2026-08-10. Three screens, every decline a real button the same size as the
      accept. **No-jargon verified by a check over the rendered DOM**, not by eye:
      "permission", "background", "geofence", "GPS" and "enable" appear nowhere.
      — Measured at 2x text scaling: copy scrolls, buttons stay reachable (D-015).
      — ⚠ The copy has never been read by anybody outside this project. T-112 and T-129.
- [ ] **T-115** Landmark tap → minimal card (name, photo, distance, one Directions button
      handing off to Apple/Google Maps). No in-app navigation. (D-018) ⇠ T-066
- [x] **T-116** Cap notifications at two per trip (D-011) ⇠ T-049, T-102
      — Done 2026-08-11. `notify/notificationPolicy.ts` (pure, 11 tests) +
      `notify/sendTripNotification.ts`, **the only place this app posts a notification**. Same
      shape as `exportTrace` being the only door a trace leaves by (D-040).
      — **Nothing was broken.** Both call sites already guarded themselves; what was missing was
      anything that would notice a *third*. The cap lived in a decision document, which is not
      somewhere code can be stopped from violating — and the privacy policy now promises it to
      the user in words (D-044), so it needed enforcing rather than remembering.
      — **The test that will actually catch something reads the source** of every module in
      `app/` and fails if anything but the door calls `scheduleNotificationAsync`. Same technique
      as `deleteAllUserData.test.ts` deriving its table list from the migrations. **Verified by
      deliberately breaking it** — a stray call in `MapScreen.tsx` was caught and named.
      — Budget is **per trip, not per install**: a repeat visitor (CONTEXT §4.10) must get their
      day-1 check again. Cleared in `getOrCreateActiveTrip`.
      — Marked spent **before** posting: losing one message beats a send loop on a device that
      keeps being killed, which would burn the budget in an afternoon and teach the user to
      turn notifications off — losing the reveal, which D-012 calls the best moment in the app.
      — ⚠ **Found and not fixed:** `tripEndDetection.ts` hardcodes the reveal title *"Your
      Madeira map is ready"*. D-017 forbids Madeira knowledge in `app/` and CONTEXT §6.1 calls
      it absolute. It is user-facing copy at the moment D-012 calls the best in the product, so
      changing it is the project lead's call, not a silent edit. **New: T-116a.**
- [x] **T-116a** Move the island's name out of the reveal notification (D-017) ⇠ T-102
      — Done 2026-08-11, on the project lead's instruction to take the recommendation.
      **The warmth was kept rather than traded away.** The content pack gained an optional
      `destination` field, and `revealTitle(destination)` builds the sentence — so the reveal
      still says *"Your Madeira map is ready"*, and the island's name now lives in `content/`
      where D-017 requires it. Falling back to *"Your map is ready"* only when a pack does not
      name itself.
      — **This is the field D-042 already reserved** and declined to invent a literal for: the
      souvenir's title card can now name the destination too, from the same place.
      — A test reads `tripEndDetection.ts` and fails if the word appears in `app/` again, which
      is what stops it returning the next time somebody wants warmer copy.
      — `tools/validate-content.mjs` warns when the field is missing and errors when it is
      present but malformed. **Both verified by breaking the file**, not by reading the code.

### Privacy and compliance

- [x] **T-117** **Dependency network audit** — confirm zero SDKs transmit anything. This is
      where these apps actually leak. ⇠ T-029
      — Done 2026-08-11, **statically**. `docs/dependency-audit.md` is the artefact and the
      thing to hand a reviewer. No analytics, no crash reporting, no telemetry: seventeen vendor
      strings, zero hits in the emitted bundle, **with the probe verified against strings known
      to be present** — an unverified zero looks exactly like a pass. `expo-updates` is not
      installed, so there is no OTA check on launch. iOS podspecs depend on `ExpoModulesCore`
      and nothing else. `app/src` contains no `fetch`, no `XMLHttpRequest`, no HTTP client.
      — ⚠ **Found: `expo-notifications` puts `firebase-messaging` in the APK.** The app uses
      local notifications only and no Firebase configuration ships, so it cannot register — but
      that is a static argument about runtime behaviour. **D-043**, and **T-117b** owes the
      confirmation.
      — Two Expo URLs (`exp.host` push, `eascdn.net` assets) are dead strings in the bundle.
      Written down so the answer exists before a reviewer greps for them.
      — ⚠ **Static only. Nothing was observed on a device, because there is no device.**
- [ ] **T-117b** **Confirm zero outbound connections on a real device** — packet capture during
      the T-051 soak, where it costs nothing extra to watch. Specifically: no FCM registration
      (D-043), no `exp.host`, no asset CDN, no tile requests. ⇠ T-117, T-051
- [ ] **T-117a** **Confirm the development scaffolding is inert in a release build.** Distinct
      from T-117, which is about network behaviour and would not look at this. Two things to
      check: the `expo-dev-client` permissions (`SYSTEM_ALERT_WINDOW`,
      `READ/WRITE_EXTERNAL_STORAGE`, `NSAllowsArbitraryLoads`) are absent, and the synthetic POI
      fixture cannot run — `app/index.ts` only wraps the catalogue in
      `withDevFixtureFallback` when `__DEV__`, and shipping a ring of invented geofences around
      the user would be absurd. ⇠ T-029
- [x] **T-118** iOS `PrivacyInfo.xcprivacy` manifest, including third-party SDK declarations
      ⇠ T-117
      — Done 2026-08-11. In `ios.privacyManifests` in `app.json` — Expo's config key, so there
      is no hand-maintained plist to drift. Verified to reach the native config by
      `expo config --type introspect`; `expo-doctor` still 20/20. Reasoning and the full table
      are in `docs/dependency-audit.md`.
      — **Nothing tracked, nothing collected, stated explicitly rather than by omission.** The
      trip's presence in the user's *own* iCloud backup is not collection — we cannot reach it.
      This must stay consistent with T-120 and the privacy policy (D-044).
      — **The required-reason APIs were read off what the dependencies declare**, not guessed:
      six shipped packages carry their own manifest, and the union is FileTimestamp,
      UserDefaults, DiskSpace, SystemBootTime. Declared at app level because Expo's docs warn
      Apple does not reliably parse manifests inside static CocoaPods, **and** because
      `expo-sqlite`, `expo-asset`, MapLibre and `react-native-svg` ship none at all.
      — ⚠ `E174.1` (display disk space) is declared for a settings row whose display code ships
      but is fed `null` until **T-057**. `3B52.1` and `0A2A.1` are deliberately *not* declared —
      they would be false. Both calls are recorded in the audit.
- [ ] **T-119** iOS purpose strings for While-Using and Always ⇠ T-042, T-043
- [x] **T-120** iOS Privacy Nutrition Label ⇠ T-117
      — Done 2026-08-11. Answers in `docs/store-privacy-answers.md`, alongside T-122's.
      — ⚠ **This task's own wording was wrong and is corrected.** It read *"Location / App
      Functionality / Not Linked to You / Not Used for Tracking"* — which is the answer for an
      app that **does** collect location. Apple's own definition exempts data processed only on
      the device, so the correct answer is **Data Not Collected**. The old wording would have
      put "Location" on the store listing of the one app whose entire differentiator is that
      location never leaves the phone (CONTEXT §4.7).
      — Must stay consistent with the privacy manifest (T-118), which already says the same
      thing in Apple's vocabulary.
- [x] **T-121** Android prominent-disclosure screen before requesting background location
      ⇠ T-043
      — Done 2026-08-10. Uses Play's required phrasing ("collects location data even when it
      is closed or not in use"), states the purpose and that nothing is uploaded or shared,
      and says plainly that declining still leaves a working app. Shown on Android only, before
      the Always request. **T-123's reviewer reads this screen** — do not reword it casually.
- [x] **T-122** Android Data Safety form — no data collected, no data shared ⇠ T-117
      — Done 2026-08-11. Answers in `docs/store-privacy-answers.md`. Google's definition
      matches Apple's: data processed only on the device is not collected.
      — Answer **yes** to the deletion question: there is nothing held anywhere to request
      deletion of, and Settings erases everything on the device immediately (T-125).
      — ⚠ **Play also requires a privacy-policy URL, and there is no domain to host one on.**
      That and the null `CONTACT_EMAIL` (D-044) block T-123.
      — ⚠ **A background-location app declaring "no data collected" is the combination a
      reviewer stops on.** It is true, and the evidence to hand over is listed in the doc. The
      permission is justified separately in T-123.
- [ ] **T-123** Google Play background-location review submission with demonstration video and
      written justification ⇠ T-121, T-122
- [x] **T-124** Privacy policy (short, because there is genuinely nothing to disclose) ⇠ T-117
      — Done 2026-08-11. **D-044.** `app/src/legal/privacyPolicy.ts` is the source;
      `docs/privacy-policy.md` is **generated** from it by
      `tools/generate-privacy-policy.mjs`, so the in-app copy and the store-listing copy cannot
      drift. 8 sections, ~740 words, 10 tests.
      — **Shown in the app, not linked to a browser.** The app makes no network requests at all
      (D-001), so a linked policy would be the only thing in it that does — and the reader most
      likely to want it is a tourist with no signal.
      — **It states the two exceptions to "nothing leaves your phone", because both are true:**
      the phone's own encrypted backup (ARCHITECTURE §4a puts the database there on purpose),
      and anything the user shares. A policy written from the marketing line omits both.
      — ⚠ **`CONTACT_EMAIL` is null and the contact section is omitted rather than faked**
      (the D-041 stance, test-enforced). **This blocks T-123**, as does the hosting URL, which
      needs the domain question settled.
      — ⚠ **Not lawyer-reviewed.** Verified for readability instead: no jargon, no sentence over
      45 words, and measured in the workbench — 8 sections render, the Done button stays outside
      the scrolling text at 60 dp **and still does at 2× text scaling** (the D-041 property).
      — ⚠ Nobody outside this project has read it. T-129.
- [x] **T-125** "Delete all my data" control ⇠ T-030, T-141
      — **Last item in settings, in its own section, red, with an icon.** Findable, not
      fat-fingerable. Requires a second confirmation step.
      — Done 2026-08-10. Last section, red, with an icon, and **two deliberate steps**: the
      settings row opens a full screen that states the consequence, and the destructive button
      lives there. An alert was rejected — too small to explain that there is genuinely no
      restore, and too easy to dismiss by reflex.
      — ⚠ **Fixed a real bug while wiring this: erase-all was broken.** `deleteAllUserData`
      never learned about `stamp_award` (migration 2). With `foreign_keys = ON` and no cascade,
      `DELETE FROM trip` aborts the whole transaction on a foreign-key violation — so nothing
      was deleted at all, for exactly the users who had something to erase.
      `deleteAllUserData.test.ts` now derives the child tables from the migrations and fails if
      any is missing or ordered after `trip`. Verified by reintroducing the bug.
      — Copy must be honest about consequences: there is no cloud, no account and no restore
      (D-001). Deleting is permanent and takes the whole trip with it. **Do not use developer
      idiom** such as "Danger Zone" for the section header — name it for what it does.
- [x] **T-141** Settings screen (`docs/design-brief.md` §5) ⇠ T-042
      — Done 2026-08-10. Five sections in §5's order — Recording, Appearance, Map, About,
      Erase — each with a header and a plain-English footnote, which is what §5 says lets the
      screen grow without becoming hostile. The gear on the primary screen now opens it.
      — Light/dark is two labelled buttons rather than a switch (**T-140** done with it): a
      switch needs the user to know which state is which, and D-015 forbids meaning carried by
      anything but words.
      — Reached by the **gear, top-left** — not a hamburger. Three lines promises a drawer of
      destinations; a gear reads as "settings" to someone not fluent in app idiom (D-015,
      CONTEXT §6.5).
      — Sections with headers and **plain-English footnotes** explaining what each does and what
      it costs. This is what lets settings grow without becoming hostile.
      — Contents: permission status + route to system settings (T-044, T-121); Android
      battery-optimisation exemption (T-046); light/dark preference (T-140); tile pack status
      (T-057); privacy policy (T-124); a hidden debug/trace-export entry (T-050, T-130); and
      erase-all last (T-125).

### Verification

- [ ] **T-126** Untrained older tester completes install → first stamp with no help ⇠ T-114,
      T-113
- [ ] **T-127** Network monitor shows zero outbound requests over a full simulated trip
      ⇠ T-117
- [ ] **T-128** Both store privacy declarations verified truthful ⇠ T-120, T-122

**Milestone M6 — "It is honest and easy"** ⇠ T-123, T-126, T-127, T-128

---

## Phase 7 — Beta and launch

- [ ] **T-129** Recruit closed beta testers taking real Madeira trips ⇠ M6
- [ ] **T-130** Voluntary trace export mechanism — explicit user action only, never automatic
      upload ⇠ T-125
- [ ] **T-131** Tune matching thresholds and geofence radii against real trip data ⇠ T-130,
      T-094
- [ ] **T-132** Collect and act on beta feedback ⇠ T-129
- [ ] **T-133** Store listing — screenshots, copy, preview video ⇠ M6
- [ ] **T-134** Verify ≥10 real week-long trips recorded end to end with no tracking failure
      ⇠ T-129
- [ ] **T-135** Verify no beta tester reports a missing levada or a false stamp ⇠ T-132
- [ ] **T-136** Verify at least half of beta testers share their souvenir unprompted (this is
      the distribution hypothesis under test — D-013) ⇠ T-132
- [ ] **T-137** Submit to both stores ⇠ T-133, T-134
- [ ] **T-138** Launch ⇠ T-137

**Milestone M7 — Launched** ⇠ T-138

---

## Critical path

The longest dependency chain, and therefore the schedule driver:

```
T-013 (framework) ✅ RESOLVED — React Native
  → T-029 (scaffold) → T-031 (expo-location) → T-039 (geofence manager)
  → T-071 (stamp rules) → T-075 (primary screen) → T-112 (UI reduction)
  → T-123 (Play background-location review)  ← slow, external, budget generously
  → T-129 (beta) → T-137 (submit) → T-138 (launch)
```

Two items sit on the critical path and are **outside our control**: the Google Play
background-location review (T-123) and the real-world beta (T-129), which requires people to
actually go to Madeira for a week. Start both as early as possible.

**No longer a gate:** `T-024` (stable OSM way IDs in tiles) was previously the project's
critical decision gate. **D-022 retired it** — visited segments are drawn from our own local
geometry, so nothing depends on addressing tile features at runtime.

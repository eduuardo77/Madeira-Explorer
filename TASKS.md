# Tasks

Ordered implementation checklist with explicit dependencies.

**Document date:** 2026-08-06
**Last updated:** 2026-08-10 — **trip end and the reveal** (T-099–T-102, D-039) close the
loop: the app now knows when the holiday is over and says so at the airport. Earlier the same
day, **the interface**: the passport (T-074) and the primary
screen (T-075), built against a web design workbench (D-038) that measured T-081 and caught a
control overlap no amount of reading would have found. Earlier: progress computation
(T-072a/T-073) and the day-1 health check (T-049).
Earlier the same day, **the reward mechanic** (T-071/T-072, D-037): geofence
crossings become stamps, with levadas verifying both endpoints so a drive-by cannot earn one.
Earlier the same day, the map exists: T-058 light style (generated, D-030 schema) and
T-058a shaded terrain (D-035, 6.5 MB elevation pack — total pack 19.1 MB) are built and
iterated on screen in the repo viewer; a draft dark style rides along for T-139. Earlier the
same day: T-039 the dynamic geofence manager (D-033), T-040 the content pack (D-034) and T-034
the sampling gate. **T-066 is unblocked**:
`content/pois.json` is the file to fill in and `node tools/validate-content.mjs` checks it.
`app/eas.json` and `docs/dev-build.md` reduce the development-build blocker to steps only the
project lead can take. The project also has a unit-test runner for the first time
(`cd app && npm test`, Node's own, no new dependencies).
Previously 2026-08-08 — **v1 scope cut (D-032): Phase 4 map matching deferred to v2.**
Tile schema settled (D-030). Visual direction and passport structure settled (D-026, D-027);
activity gating settled (D-028); D-022 confirmed.

> **v1 = record → stamps by geofence → draw the trace → passport → souvenir.**
> Phases 1, 2, 3, 5, 6, 7. **Phase 4 is v2.** See D-032.
**Overall progress:** Planning complete. Phase 1 recorder implemented; **nothing has
run on real hardware yet.** Phase 0 validation not started.

⚠ **Everything marked done in Phase 1 below is verified by typecheck, bundle and config
introspection only** — plus, since 2026-08-10, unit tests over the pure geofence selection
logic. No fix has ever been recorded, no permission dialog has been seen, and no battery
figure has been measured. Real-device testing is mandatory for anything touching recording
(CONTEXT §6.6) and is what T-051–T-055 exist for.

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

- [ ] **T-042** Permission flow: While-Using first and **fully functional**, with explicit
      start/end recording mode ⇠ T-031
      — The start/stop control is a **primary-screen action shown only to users without Always**,
      not a settings item (`docs/design-brief.md` §3.3).
      — **State the battery cost in the copy**, next to the control that turns tracking on:
      "uses about N% of your battery per day." Use the **measured** figure from T-054, never an
      invented one. ⇠ T-054 for the number, not for the work.
- [ ] **T-043** Deferred "Always" upgrade request, timed for ~day 2 ⇠ T-042
      — Same honest-battery-figure treatment as T-042.
- [ ] **T-044** Detect iOS Always → While-Using downgrade and prompt gently for recovery
      ⇠ T-043
- [ ] **T-045** Android foreground service with the `FOREGROUND_SERVICE_LOCATION` type
      ⇠ T-031
- [ ] **T-046** Android battery-optimisation exemption request ⇠ T-045
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
- [ ] **T-140** Light/dark preference in settings (D-026). Defaults to light for in-app use;
      the souvenir always renders dark regardless of this setting. ⇠ T-139, T-141

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
- [ ] **T-070** Commission or produce stamp artwork ⇠ T-066

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
- [ ] **T-103** Accommodation detection — identify the most frequent overnight location
      ⇠ T-030
- [ ] **T-104** Accommodation masking applied by default to all exports (D-016) ⇠ T-103
- [ ] **T-105** On-device 9:16 vertical video renderer — animated trace draw-on, stamps
      popping in collection order, camera flyover ⇠ T-059, T-074
- [ ] **T-106** Watermark ⇠ T-105
- [ ] **T-107** Still-image export ⇠ T-105
- [ ] **T-108** Share sheet integration ⇠ T-105, T-107
- [ ] **T-109** Verify render completes on-device in under ~30 seconds ⇠ T-105
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
- [ ] **T-113** Tap targets 60dp minimum, high contrast, large type throughout ⇠ T-112
- [ ] **T-114** Minimal plain-English onboarding, no jargon ⇠ T-042
- [ ] **T-115** Landmark tap → minimal card (name, photo, distance, one Directions button
      handing off to Apple/Google Maps). No in-app navigation. (D-018) ⇠ T-066
- [ ] **T-116** Cap notifications at two per trip (D-011) ⇠ T-049, T-102

### Privacy and compliance

- [ ] **T-117** **Dependency network audit** — confirm zero SDKs transmit anything. This is
      where these apps actually leak. ⇠ T-029
- [ ] **T-117a** **Confirm the development scaffolding is inert in a release build.** Distinct
      from T-117, which is about network behaviour and would not look at this. Two things to
      check: the `expo-dev-client` permissions (`SYSTEM_ALERT_WINDOW`,
      `READ/WRITE_EXTERNAL_STORAGE`, `NSAllowsArbitraryLoads`) are absent, and the synthetic POI
      fixture cannot run — `app/index.ts` only wraps the catalogue in
      `withDevFixtureFallback` when `__DEV__`, and shipping a ring of invented geofences around
      the user would be absurd. ⇠ T-029
- [ ] **T-118** iOS `PrivacyInfo.xcprivacy` manifest, including third-party SDK declarations
      ⇠ T-117
- [ ] **T-119** iOS purpose strings for While-Using and Always ⇠ T-042, T-043
- [ ] **T-120** iOS Privacy Nutrition Label — Location / App Functionality / Not Linked to You
      / Not Used for Tracking ⇠ T-117
- [ ] **T-121** Android prominent-disclosure screen before requesting background location
      ⇠ T-043
- [ ] **T-122** Android Data Safety form — no data collected, no data shared ⇠ T-117
- [ ] **T-123** Google Play background-location review submission with demonstration video and
      written justification ⇠ T-121, T-122
- [ ] **T-124** Privacy policy (short, because there is genuinely nothing to disclose) ⇠ T-117
- [ ] **T-125** "Delete all my data" control ⇠ T-030, T-141
      — **Last item in settings, in its own section, red, with an icon.** Findable, not
      fat-fingerable. Requires a second confirmation step.
      — Copy must be honest about consequences: there is no cloud, no account and no restore
      (D-001). Deleting is permanent and takes the whole trip with it. **Do not use developer
      idiom** such as "Danger Zone" for the section header — name it for what it does.
- [ ] **T-141** Settings screen (`docs/design-brief.md` §5) ⇠ T-042
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

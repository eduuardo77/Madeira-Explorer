# Task notes — what was found, and what broke

The post-mortems from **completed** tasks: the defects found along the way, the
wrong turns, and the constraints discovered. Split out of `TASKS.md` on
2026-08-12 so a session can read the checklist for ~10k tokens instead of ~33k.

Nothing was cut. Open tasks keep their notes inline in `TASKS.md`, because those
are the working set.

```bash
grep -A30 "^### T-052a" docs/task-notes.md
```

---

### T-022

- [x] **T-022** Obtain an OSM extract of Madeira **and Porto Santo** (D-021)
      — **Done 2026-08-08.** Geofabrik publishes an *Azores* extract but **no Madeira** one, so
      the pipeline takes all of Portugal (400 MB, MD5 verified) and clips to
      `-17.32,32.40,-16.20,33.20`. Fetched by `tiles/pipeline/build.sh`; gitignored.

### T-023

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

### T-026

- [~] **T-026** Record tile pack size and judge it acceptable for a hotel-WiFi download ⇠ T-023
      — **12 MB** for the whole archipelago, zoom 0–15, extracted in 8.5s (D-030). Not a close
      call. (The rejected OpenMapTiles build was 8.9 MB at z0–14 — one fewer zoom level.) **This reopens T-057:** bundling the pack in the app
      rather than downloading it on first run is now a genuine option.
      — **Not done, because this excludes terrain.** D-026 wants shaded relief, which is a
      separate elevation source and pipeline. 8.9 MB is the floor, not the answer. Re-measure
      after T-058a.

### T-026a

- [x] **T-026a** Verify the tile schema actually carries Madeira's defining features
      — **Done 2026-08-08** via `tools/mvt-inspect.py` (decodes MVT directly — no browser, no
      GPU, no style). **Levada channels survive with names intact** (`waterway`, `class=drain`).
      **Levada paths did not** under OpenMapTiles — names stripped from `transportation` by
      design. **Fixed by D-030:** the Protomaps `roads` layer carries `name` at z13+, verified by
      decoding a real tile. Also gains `is_tunnel` as a boolean (useful to T-069/T-087), plus
      cliffs and peak elevations. See `docs/tile-pipeline.md` §3 and T-025a.

### T-028

- [x] **T-028** Assess OSM levada coverage and quality; decide whether official PR-route data
      — **Done 2026-08-08 without needing T-022.** Surveyed via Overpass, so no extract was
      required; the dependency was wrong. Reproduce with `python tools/osm-survey.py`; findings
      in `docs/osm-coverage.md`; decision recorded as **D-029**. **OD-7 closed.**
      — Headline: OSM alone is sufficient and no external licensing arises — the 44 official PR
      routes are already in OSM. **Select levadas by name + relation, never by tag** — a levada
      is two parallel ways sharing one name, and `highway=path` captures only 23% of them.

### T-029

- [~] **T-029** Scaffold an Expo + React Native project **in TypeScript** (CONTEXT.md §6.7);
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

### T-029b

- [x] **T-029b** Stand up the portable Android emulator so the app can be *seen*
      — **UNPARKED AND DONE 2026-08-11.** The project lead enabled CPU virtualization in
      firmware, and the route the SDK had been waiting on since 2026-08-10 opened immediately:
      `emulator-check accel` → `0`, *"WHPX is installed and usable"*, and the `madeira` AVD boots
      to **Android 14 on `emulator-5554` in about 55 seconds**.
      — ⚠ **Read the reporting quirk before you believe a check.** `VirtualizationFirmwareEnabled`
      still reports **False** after the BIOS change, because Windows cannot see the raw firmware
      flag once a hypervisor is running. The signal that actually moved is `HyperVisorPresent`,
      False → True, and the authority is `emulator-check accel` — ask the emulator, not Windows.
      — **What it is worth, and what it is not** (CONTEXT §6.6, unchanged): legitimate for
      rendering, storage, UI, permissions and replayed routes; **worthless for battery,
      background survival and GPS realism.** A green result here must never close a task that
      names a battery figure or a survival claim. T-021a's used Android is still required.
      — Tooling added the same day, because an emulator with no location fixes draws an empty
      island: **`tools/replay-route.sh`** feeds a route in (two routes in `tools/routes/`, one a
      continuous seafront walk, one a drive with a **deliberate 3.5 km blackout** standing in for
      a VR1 tunnel — which is what checks that the trace *breaks* rather than bridging it), and
      **`tools/screenshot.sh`** grabs the screen.
      — ⚠ Two traps found immediately and written into the scripts: `adb emu geo fix` takes
      **longitude first**, and `adb shell screencap > file` corrupts the PNG on Windows because
      the shell transport rewrites newlines — `adb exec-out` is the fix.
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

### T-030

- [x] **T-030** Implement the SQLite schema (raw_fix, sensor_sample, geofence_event, trip)
      — Also `recording_event` (gap honesty) and `app_state`. Migration runner; UPDATE-blocking
      triggers make the append-only rule (CONTEXT §6.2) a property of the database.

### T-032a

- [~] **T-032a** Backup policy (ARCHITECTURE.md §4a): **include** the SQLite database,
      — **Android half done**: `plugins/withAndroidBackupRules.js` writes both rule files and
      sets the manifest attributes. **iOS half still open** — `isExcludedFromBackup` is a
      runtime flag set when the tile pack is written, so it lands with T-057.

### T-033

- [~] **T-033** Implement batched location delivery — iOS deferred updates, Android
      — Configured via `deferredUpdatesInterval` / `deferredUpdatesDistance`, which is the only
      batching knob `expo-location` exposes; it does not surface `setMaxWaitTime` by name.
      **Whether Android actually batches rather than delivering per-fix is unverified** and is
      a direct input to the battery target (T-054).

### T-034

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

### T-035

- [x] **T-035** Capture barometer / relative altitude alongside GPS ⇠ T-030
      — Sampled once per location batch, so the profile is only as dense as the batches.
      `relativeAltitude` is iOS-only; Android stores pressure and derives altitude later.

### T-036

- [~] **T-036** Capture pedometer step counts alongside GPS ⇠ T-030
      — **iOS only.** `expo-sensors` has no historical step query on Android, and its live
      watcher does not deliver in the background. Android currently stores null, which the
      sensor fallback (T-090) must treat as "unknown", never as zero.

### T-037

- [x] **T-037** Immediate incremental flush on every batch — never hold a day in memory
      — One transaction per batch: one disk sync per OS wake-up, not one per fix.

### T-039

- [x] **T-039** Implement the dynamic geofence manager — nearest ~18 registered plus one large
      — Built 2026-08-10. Selection rule and its unmeasured constants: **D-033**.
      `geofenceSelection.ts` is pure and unit-tested (18 tests, `npm test`); `geofenceManager.ts`
      is the part that talks to the OS and SQLite. Rebuilds are triggered by the anchor's exit
      event and, as a backstop against a missed event, by recorded fixes.
      — ⚠ **Verified only on a laptop.** No device has run this. T-076 is the real test.

### T-040

- [x] **T-040** Load geofence definitions from the content pack, not from code ⇠ T-039, T-014
      — Built 2026-08-10. Format and loading rules: **D-034**. `content/pois.json` is the file;
      `content/README.md` is the guide for filling it in; `node tools/validate-content.mjs`
      checks it using the app's own parser.
      — A broken file stops the app; a broken row is dropped, counted and logged. Ids starting
      with `__` are rejected (reserved for mechanism regions, D-033).
      — ⚠ **The pack is empty.** Everything below the content curation heading in Phase 3 is now
      the only thing standing between the app and a working reward loop.

### T-041

- [x] **T-041** Persist geofence enter/exit/dwell events ⇠ T-039, T-030
      — Enter/exit persisted. Note `dwell` is **not** an OS event on either platform: the
      dwell + speed gate (D-009) is computed later over the enter/exit log, which is what keeps
      the award thresholds retunable without re-collecting anything.

### T-042

- [x] **T-042** Permission flow: While-Using first and **fully functional**, with explicit
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

### T-043

- [x] **T-043** Deferred "Always" upgrade request, timed for ~day 2 ⇠ T-042
      — Same honest-battery-figure treatment as T-042.
      — Done 2026-08-10. Offered at 40h — after the day-1 check at 14h, because two prompts in
      one morning loses both — and **exactly once, ever**. A second ask is pressure, and
      pressure is what gets permissions revoked (D-008). It also waits until something has been
      recorded, so the pitch can be made in terms of the map they already have.

### T-044

- [x] **T-044** Detect iOS Always → While-Using downgrade and prompt gently for recovery
      — Done 2026-08-10. Compares the observed permission against the last one recorded, and
      records before acting so a downgrade is reported once. Losing location entirely is
      deliberately *not* reported here — the day-1 check already covers it, and doubling up
      would nag.

### T-046

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

### T-048

- [~] **T-048** Service health monitor and gap annotation ⇠ T-037
      — `recording_event` diary plus `getRecorderHealth()` and SQL gap detection are in.
      Still missing: the gap **threshold** is a guess (30 min) pending T-020/T-051, and gaps
      are detected on demand rather than annotated onto the trace.

### T-049

- [x] **T-049** Day-1 self-check (12–24h after install) verifying recording actually happened
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

### T-072a

- [x] **T-072a** Per-category progress computation (D-027) — the passport's primary axis
      — Done 2026-08-10 with T-073, in `progress/tripProgress.ts` (pure, 13 tests). All five
      rows always exist, including empty ones: a passport whose pages appear and disappear as
      you travel is not a passport.

### T-073

- [x] **T-073** Per-region progress computation ⇠ T-067, T-071
      — Done 2026-08-10. Also `suggestNextRegion()` — the nudge points at the region *nearest
      to finishing*, not the emptiest, because that is the one most likely to be acted on
      (D-002: the uncollected places are the recommendation).
      — ⚠ **The denominator excludes locked regions from both halves** (D-024). Getting this
      wrong is the named trap: a tourist who never takes the ferry must never see a total they
      cannot reach. The locked set is threaded through and empty until **T-067a** fills it.

### T-050

- [x] **T-050** Debug screen: raw fix count, last fix time, gaps, permission state, service
      — Also sensor counts, last barometer/step reading, live-ticking last-fix age, the event
      diary, and the delete-all control. Built to D-015 (60dp targets, no colour-only status)
      because it gets read outdoors in sunlight during field tests.
      — ⚠ **Two defects found 2026-08-12 while verifying T-052b, both making this screen lie in
      exactly the direction it exists to catch:**
        · **It never re-read the database.** `health` was fetched once on mount while a 1-second
          timer ticked the *displayed* age — so `lastFixTs` froze and its age climbed forever, and
          a perfectly healthy recorder looked deader the longer you watched it. Caught because the
          screen read `2h 5m` while fixes were landing in `raw_fix` seconds earlier. It now
          re-reads every 5 s; not 1 s, because `getRecorderHealth` runs a gap scan over every fix
          in the trip.
        · **A long value broke the label mid-word**, rendering `Receiving` as `Receivi/ng`. Both
          sides had `flexShrink: 1`; the label now never shrinks and the value wraps instead.

### T-052a

- [x] **T-052a** ✅ **RESOLVED 2026-08-12 — the recorder records. It was never broken (D-047).**
      — **The answer:** the `walking` and `stationary` profiles ask for `balanced`/`coarse`
      accuracy, which `expo-location` maps to `PRIORITY_BALANCED_POWER_ACCURACY` — served by the
      **network** provider (wifi/cell geolocation). An emulator has none, so the request produces
      nothing and registers nothing. `adb emu geo fix` drives **GPS**, which only a
      `PRIORITY_HIGH_ACCURACY` request turns on. `driving` is the one profile that asks for it.
      — **Proof, both directions.** Driving profile: `dumpsys location` shows
      `gps provider: ProviderRequest[@+15s0ms, HIGH_ACCURACY, WorkSource{10192
      com.madeiraexplorer.app}]`, and the same 41-point replay that produced nothing now produces
      **12 fixes, 15 s apart** — matching the profile's `minTimeMs` exactly — which draw as a
      trace on the map. Switch back to walking and the request vanishes; switch again and it
      returns.
      — **The suspect list was right to stop where it did, and its second entry was mis-framed.**
      It said *GPS provider vs fused provider*. The provider family was never the axis: a
      `HIGH_ACCURACY` request through the same fused client works. **The axis is priority.**
      — **Nothing was changed to make it work.** `samplingPolicy.ts` is untouched — the tuned
      constants are a battery decision (D-028) and there is no battery here to spend.
      — The instrument that settled it is `app/src/recording/locationProbe.ts`, reachable from the
      debug screen. Keep it: it is what asks the same question again on real hardware.
      — ⚠ **What this does not settle:** whether `balanced` produces fixes on a *real* phone. It
      should; that is an argument, not a measurement. **T-051 owes the reading.**
      —
      — ▼ **THE ORIGINAL REPORT (2026-08-11), SUPERSEDED BY EVERYTHING ABOVE.** Kept verbatim
      because its reasoning is what stopped four dead ends from being repeated, and because its
      four exclusions were all correct — the answer was simply outside the space it searched.
      **Nothing below is still open.**
      — *What happened:* starting recording logs `start profile=walking`, Android grants the
      foreground service (`LocationTaskService`, confirmed in logcat), 41 positions were replayed
      along a 2.2 km route, and `raw_fix` stayed **empty**. No trip was created either, because a
      trip is opened lazily on the first fix.
      — **Ruled out, each by experiment rather than by reading:**
        · **Not the permission.** Granting `ACCESS_BACKGROUND_LOCATION` changed nothing.
        · **Not the batching.** `walking` defers 5 minutes (D-028, a deliberate battery win) — but
          a temporary patch to **1 s / 0 m / no deferral** also produced zero fixes. Patch
          reverted; the tuned constants are untouched.
        · **Not a silent failure.** `recording_event` holds no `error` row and logcat no rejection.
        · **Not the task definition.** `defineTask` runs at module scope via `app/index.ts`,
          exactly as Expo requires for a headless relaunch.
      — **The sharpest clue, from `dumpsys location`:** every provider reads `ProviderRequest[OFF]`
      and **our uid registers no location request at all.** The service is up; nothing is asking.
      — **Two suspects left, and they need separating before anything is changed:**
        1. `expo-location`'s Android task path never registers the request. Logcat warns
           *"Introspectable data is missing for LocationTaskServiceOptions, falling back to
           reflection-based conversion"*, which is at least adjacent.
        2. `adb emu geo fix` drives the **GPS** provider while `expo-location` listens to the
           **fused** provider — in which case this is an emulator limitation, not an app defect.
      — **Cheapest experiment that distinguishes them:** put a plain foreground
      `watchPositionAsync` behind a debug button and see whether it receives injected positions.
      — ▲ **END OF THE SUPERSEDED REPORT.** That last experiment is exactly the one that was run,
      and it worked: the probe took 11 positions in 15 s, which killed suspect 2 as written and
      sent the search to the priority the request was asking for. Suspect 1 was wrong too — the
      task path registers fine. **Neither suspect was the answer, and the experiment that was
      supposed to choose between them found it anyway.**

### T-052b

- [~] **T-052b** Detect a recorder that is running but receiving nothing ⇠ T-052a, T-049
      — Raised by D-047. With the walking profile the app's location request was invisible and
      produced nothing while the debug screen reported `Recording: yes` and the foreground-service
      notification sat in the shade — the silent failure CONTEXT §4.5 calls worse than never
      installing the app. There is no Android API for *"did my request register"*, but
      *"recording has been on N minutes and no fix has arrived"* is answerable, and the day-1
      health check (D-011, T-049) already exists to carry it.
      — A tourist on a levada with no SIM and wifi off is not an exotic state.
      — **Detection done 2026-08-12.** `recording/recorderSilence.ts` (pure, 12 tests) answers
      `not_recording | warming_up | receiving | silent`, and `RecorderHealth` carries it so the
      debug screen states it in words — a `Receiving` row directly under `Recording`, because
      those two rows once read `yes` and `0` for a day and left a human to notice they
      contradicted each other.
      — **The threshold is derived, not guessed.** Each profile already declares
      `deferredIntervalMs` + `minTimeMs` — D-028's battery decisions and the only honest statement
      anywhere of how long silence is normal — so the tolerance is `(deferred + minTime) ×
      SILENCE_TOLERANCE`, floored at 2 minutes. Retuning the battery constants retunes this, and
      a test asserts the derivation so nobody hardcodes a number beside them. In practice:
      stationary 60 m, walking 17 m, driving 10 m.
      — ⚠ `SILENCE_TOLERANCE = 3` **is** a guess and is flagged as one. **T-051's soak produces
      the distribution of real inter-fix gaps, which is what should set it.**
      — Verified on the emulator in both directions: red *"recording, but nothing for 2h 2m — over
      the 17m expected on the walking profile"*, then green *"last fix 9s ago"* once positions were
      injected.
      — ✅ **Settled 2026-08-12 by the project lead: it does not notify, and the budget stays at
      two** (D-011, amended). Its threshold is provisional, and spending a permanent interruption
      on a guessed number is how a false alarm becomes a habit. The day-1 check already reaches a
      user who is not looking; this one's value is that it answers in minutes and costs nothing.
      **T-051 is the revisit trigger** — and if it comes back, probably by sharpening the day-1
      check rather than adding a third message.
      — Also unaddressed: the recorder does not log the transition into silence to
      `recording_event`, which would need persisted state to avoid a diary full of duplicates.
      Worth doing when the threshold is real.

### T-052c

- [x] **T-052c** ✅ **RESOLVED 2026-08-12 — and it was not what it looked like (D-048).**
      — The reported symptom was `checkTripEnd` throwing *"Cannot use shared object that was
      already released"*, guessed to be a Fast Refresh artefact. **A reload does not reproduce it.**
      A **cold start** does, reliably: the dev fixture delivers **99 geofence transitions inside
      100 ms** and the sink processes them all at once.
      — **The chase found a worse bug than the one being chased.**
        · **Two trips instead of one.** `getOrCreateActiveTrip` reads, finds nothing, and inserts —
          with an `await` between. Concurrent callers all read "none" first, so each creates a
          trip. Everything downstream assumes a trip is singular: the trace (T-059), progress
          (T-073), the passport, trip-end (T-099). Both callers are the sink, and the OS delivering
          a location batch *and* a crossing in one wake-up is the **normal** case.
        · **The reported error**, which is `expo-sqlite`'s own prepare/finalize racing itself under
          concurrent statements. Our DAOs do nothing exotic — plain `runAsync(sql, ...params)`.
      — **Fix:** `storage/serialQueue.ts` (pure, 9 tests), applied at `recordingSink` — the one
      boundary the OS delivers to. Not at the database: `insertFixes` and the migration runner work
      inside `withTransactionAsync`, so a global lock would deadlock against itself.
      — **Measured, same input both ways.** Before: 99 jobs → an error row. After: 99 jobs → 99
      `geofence_event` rows, 99 diary entries, **zero errors**.
      — Also fixed alongside: `getDatabase` cached a *rejected* open forever, so one transient
      failure disabled the database for the life of the process. On iOS that is a real sequence —
      data protection is `CompleteUntilFirstUserAuthentication` (CONTEXT §7), so after a reboot the
      file is unreadable until first unlock and the OS wakes the recorder in exactly that window.
      `storage/onceOrRetry.ts` (pure, 8 tests) shares one in-flight open and retries a failed one.
      — ⚠ **Left undone deliberately:** a unique constraint on the active trip. The sink is now the
      only caller so the race cannot happen, and adding a constraint to a shipped schema needs a
      migration. **A second caller of `getOrCreateActiveTrip` is the trigger to revisit** (D-048).

### T-056

- [x] **T-056** Integrate MapLibre GL Native ⇠ T-029, T-025
      — Done 2026-08-10: `@maplibre/maplibre-react-native` 11.3.6 + config plugin.
      `src/map/mapAssets.ts` copies packs and glyphs from the binary to device storage
      (PMTiles needs byte-range reads Android's asset reader cannot do) and
      `src/map/mapStyle.ts` fills the generated style templates with real `pmtiles://file://`
      URIs. Camera bounds come from the style's metadata, not from coordinates in code (D-017).
      — ⚠ **Has never rendered on a device.** Typecheck, tests and bundle only. First dev-build
      run must verify: hillshade renders, PMTiles resolve, glyphs load offline (T-063).

### T-057

- [x] **T-057** Bundle or WiFi-gated first-run download of the tile pack ⇠ T-026, T-056
      — **Resolved 2026-08-10: bundled (D-036).** 19.1 MB rides in the binary; first launch
      copies it out. The download path is not built; the decision names the revisit trigger.
      — The copies live in the **cache directory**, which both platforms exclude from backup by
      construction, so no per-platform exclusion rule is needed and none can rot (D-036
      amendment). Purging is self-healing — the source is the binary.

### T-058

- [x] **T-058** Author the **light** base style — the everyday in-app map (D-026). Start from an
      — Done 2026-08-10, as a **generator**: `tiles/style/generate.mjs` derives `light.json`
      (and a draft `dark.json`, T-139) from `@protomaps/basemaps` (BSD-3-Clause, licence
      verified). Every choice is either a flavor colour override or an entry in the
      subtraction list, each with its reason. **Never hand-edit the JSON.** Method and preview
      instructions: `docs/map-style.md`.
      — Iterated on screen against the real pack at four test locations. ⚠ **Not the real
      test** — that is T-065, outdoors. Glyphs are still remote (viewer-only); bundling them is
      T-056/T-057 and gates shipping.

### T-058a

- [x] **T-058a** Add **shaded terrain** as the figure-ground element instead of building
      — Done 2026-08-10: **D-035** — raw terrarium elevation (z0–12, **6.5 MB**; total pack now
      **19.1 MB**), shaded at render time so one pack serves both styles.
      `python tiles/pipeline/build-terrain.py` rebuilds it. ⚠ Hillshade on
      `maplibre-react-native` is unverified on-device (T-056).

### T-059

- [x] **T-059** **v1: draw the recorded raw trace** as a line layer from `raw_fix` (D-032) —
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

### T-060

- [x] **T-060** Accessibility styling pass **in both styles** (D-015, D-026) ⇠ T-059, T-139
      — Done 2026-08-12. In v1 there are no visited/unvisited *roads* (D-032 cut matching), so
      this is about the **trace** against each ground, plus the basemap staying legible under it.
      `map/lightStyle.test.ts` (12 tests) is the half that did not exist.
      — ⚠ **The light style had no contrast tests and the dark style had ten** — and the light
      one matters more, because D-026 chose it as the everyday map precisely on sunlight
      legibility. The souvenir look was held to a standard the working map was not.
      — **Two real defects, both found by measuring rather than looking:**
        · **The trace was one hardcoded colour for both styles.** On the dark ground `#c2402a`
          measured **2.70:1** — under the floor, on the single most important mark in the product
          — and its white casing measured **13.98:1**, so the halo was five times brighter than
          the line it outlined. The eye follows the brightest thing, and that was the outline.
          D-026 had predicted exactly this: *"visited is brighter"* holds **only** in the dark
          style. One colour cannot serve both grounds because the requirements are opposite.
        · **Over water the light trace measured 2.97:1**, under 3:1. Not hypothetical — a coastal
          road puts the trace on the sea and the Porto Santo ferry (D-021, in scope) puts a whole
          crossing there.
      — **Fix:** `map/traceStyle.ts` — one palette per style. Light: `#b83a26`, 4.80:1 on land and
      **3.28:1 over water**. Dark: `#ff6b4a` at 4.96:1, with a casing *darker* than the ground
      rather than lighter, which is the opposite construction for the opposite reason.
      — The load-bearing assertion is **"the trace is the most contrasty thing on the map"** —
      measured against every flat line colour in the basemap, so muting cannot drift as
      `generate.mjs` evolves. Verified in both styles on the emulator.
      — ⚠ **Contrast is a floor, not a verdict. T-065 outdoors is the only judge that counts.**

### T-061

- [x] **T-061** Respect system font scaling for all map labels ⇠ T-058
      — Done 2026-08-12. `map/mapTextScale.ts` (pure, 12 tests) scales every symbol layer's
      `text-size`; `MapScreen` supplies `PixelRatio.getFontScale()`. This was the one screen
      React Native does not scale for us — MapLibre draws its own labels from the style, which
      knows nothing about the phone's settings (CONTEXT §6.5).
      — ⚠ **The obvious fix is invalid and the comment explains why.** Wrapping the size as
      `["*", scale, …]` breaks the style: a `["zoom"]` expression may only be the input to a
      *top-level* `interpolate` or `step`, and the shipped `text-size` is exactly that — a zoom
      interpolate whose outputs are `case` expressions on `population_rank`. The scale has to be
      pushed down to the output leaves, leaving zoom stops and conditions alone. **Multiplying a
      zoom stop would move the zoom at which a label changes size, which is not a font change.**
      — The load-bearing test runs over the **real shipped styles** and asserts every size moved
      and nothing else did, so a regenerated style with a new expression shape fails the build
      rather than silently ignoring an accessibility setting.
      — **Verified on the emulator** at `font_scale` 1.0 and 1.6: labels visibly grow.
      — ⚠ **And it exposed the cost, which is now measured rather than predicted: at 1.6 the
      island label "Ilha da Madeira" is DROPPED.** Bigger labels collide sooner and MapLibre
      resolves a collision by removing one. So a large accessibility setting produces fewer,
      larger names — more legible per label and arguably less legible overall. No cap is applied,
      because the rule is to respect the setting and a ceiling would be an unmeasured threshold.
      **T-065 outdoors is where this gets judged**, at the largest scale a phone offers. If it
      reads badly, a cap belongs here.

### T-062

- [x] **T-062** Camera defaults and sensible pan/zoom bounds ⇠ T-056
      — Done 2026-08-11, **and it was a real defect the first device screenshot found.** The
      camera fitted `madeira:bounds` — the whole tile pack, 1.12° of longitude including Porto
      Santo and the Desertas — so on a tall phone the width constrained the fit and the island
      sat small in a screen of empty ocean.
      — The style now carries **two** rectangles: `madeira:bounds` (the pack, and the camera's
      pan limit) and **`madeira:home`** (the main island, the opening shot). Both in the style's
      metadata, never as literals in `app/` (D-017).
      — Framing was not the only reason. **D-024 hides Porto Santo until the user goes there**,
      so opening on the archipelago would have put on screen the exact thing that decision
      exists to withhold.
      — ⚠ **Found while editing: the file already had `maxBounds` and zoom limits I had not
      seen**, and my change duplicated them. Merged rather than overwritten — the existing
      0.4°/0.3° slack outside the pack is deliberate, so the coastline is never flush to the
      viewport edge. `minZoom` 7, `maxZoom` 16 (the basemap stops at z15, terrain at z12).

### T-063

- [~] **T-063** Verify cold start renders fully in airplane mode ⇠ T-057
      — **Partly done 2026-08-11: the map renders on a device.** Offline PMTiles + bundled
      glyphs, hillshaded terrain, Portuguese labels, on the emulator's GPU.
      — ⚠ **Airplane mode itself is NOT tested, which is the actual point of this task.** The
      render happened with Metro attached over the network, so it proves the *tile pack* draws,
      not that a cold start works offline. Still open.
      — ⚠ **Measured 2026-08-12, and it is sharper than "Metro was attached":** the debug APK
      contains **zero** tile bytes. `unzip -l app-debug.apk | grep -ci 'pmtiles|glyph'` returns
      **0**, and its whole `assets/` folder is 0.8 MB — of which 0.78 MB is ML Kit barcode models
      belonging to `expo-dev-launcher`. The 19.1 MB reached the emulator over the dev server,
      because a debug build serves `require`d assets from Metro rather than packaging them.
      **So D-036's "19.1 MB rides in the binary" has never actually been observed**; the `require`
      calls in `mapAssets.ts` make it true of a *release* build, but that build has not been made.
      **This task needs a release APK, not just airplane mode** — testing offline against a debug
      build tests the wrong binary.
      — ⚠ MapLibre logs four `Failed to load glyph range` errors. See **T-063a**.

### T-063a

- [~] **T-063a** Decide what to do about the four unbundled glyph ranges ⇠ T-063
      — **Decided and mostly done 2026-08-12: simplify the label expression, do not bundle.**
      Only **two** label layers survive `SUBTRACT` — `places_locality` and `earth_label_islands` —
      so their `text-field` is now `["coalesce",["get","name:pt"],["get","name"]]` instead of
      Protomaps' `get_multiline_name`. `SIMPLIFY_LABELS` in `tiles/style/generate.mjs` records the
      reason per layer, and the generator now **throws** if a symbol layer appears that is in
      neither list, so this cannot silently regress.
      — **Measured: four failing ranges → one.** Ranges 1024-1279, 1536-1791 and 11520-11775 are
      gone. All labels still render (Funchal, Machico, Porto da Cruz, Ilha da Madeira), in
      Portuguese. As a side effect the shipped style dropped from **4184 to 2470 lines** — that
      expression was 873 lines per layer, and the app parses it at every launch.
      — **The root cause, proved rather than guessed.** Decoding the pack's `places` layer shows it
      carries the full multilingual name set: `name:ru`, `name:ar`, `name:he`, `name:el`,
      `name:uk`, `name:hi`, `name:zh-Hans/Hant`, `pgf:name:hi`, `pgf:name:mr` — *Фуншал*,
      *Φουνσάλ*, *פונשל*, *فونشال*. Protomaps' expression was **correctly** asking for Cyrillic,
      Arabic and Georgian, because the data really contains them.
      — **Bundling was the wrong answer and now there is a number for it:** range 65024-65279 alone
      is 68.7 KB (Regular) + 69.7 KB (Medium) + 2.6 KB (Italic) ≈ **141 KB** for alphabets Madeira
      does not use, and that is one range of four.

### T-063a

- [x] ~~**T-063a** original framing~~ — kept below because the reasoning is what stopped the
      — Found 2026-08-11 by the first device render. `fetch-glyphs.mjs` bundles ranges **0–511
      only**, and its own header records that as an accepted risk: a label needing an unbundled
      range simply would not render. The device has now proved it happens — ranges 1024-1279,
      1536-1791, 11520-11775 and 65024-65279 are requested and missing.
      — **Root cause:** Protomaps' `text-field` uses `get_multiline_name`, which coalesces
      `pgf:name`/`name`/`name2`/`name3` and tests `is-supported-script`. That makes the renderer
      ask for Cyrillic, Arabic, Georgian and variation-selector ranges the island never uses.
      — **No visible label is broken** — every label on screen rendered — so this is log noise
      *so far*. But D-001 forbids network, so they can never be fetched at runtime.
      — **Two options, and bundling is probably the wrong one:** four ranges × three font stacks
      is ~12 more PBFs of scripts Madeira does not use, against a 19.1 MB pack budget.
      Simplifying `text-field` to plain `name` would stop the requests instead. **Decide before
      shipping; do not bundle megabytes by reflex.**
      — ▲ That call was right, and the measurement above confirms it.

### T-139

- [x] **T-139** Author the **dark** style variant for the souvenir renderer (D-026) — the
      — Done 2026-08-11. The three-line draft is now a full flavor, **tuned by measuring**
      against `ui/contrast.ts` rather than by eye, because D-015 is the binding constraint on a
      dark style and nobody on this project can see. `map/darkStyle.test.ts` (9 tests) holds the
      properties against the **app's shipped copy** of the style, so a regenerated style that
      loses an override fails the build.
      — Sea `#070B10`, land `#232D37`, roads `#6E7B85`–`#9AA7B2` at **3.2:1 to 5:1** against the
      ground — D-015 forbids near-black roads and that floor is what made the palette hard.
      Nothing in the basemap exceeds 6:1, leaving the top of the range for the trace.
      — **Sea and land are only 1.53:1 apart, deliberately.** An earlier attempt demanded 2:1
      and there was *no* palette that also kept roads legible — the constraint was mine, not the
      design's. D-026 puts figure-ground in the **shaded terrain**, so the dark hillshade is
      exaggerated more than the light one (0.45 vs 0.35): a dark ground swallows relief.
      — ⚠ **Three defects found by the test, not by looking:** `pier` at **1.07:1** — and a pier
      is *walkable*, so the road floor applies to it; the runway at 1.43:1, which made the
      airport unfindable when it is where the trip ends (D-012); and the island-name label at
      6.62:1, under the label floor, on the largest labels on the map.
      — ⚠ **Never seen.** Contrast is a floor, not a verdict. **T-065 outdoors is the verdict**
      and D-026 stays Provisional until then.
      — Preview: `bash tiles/viewer/serve.sh` → `http://localhost:8081/viewer/?style=dark`

### T-140

- [x] **T-140** Light/dark preference in settings (D-026). Defaults to light for in-app use;
      — Done 2026-08-10 as part of T-141. **Wiring completed 2026-08-11** now T-139 has tuned
      the dark style: the choice persists in `app_state` (`map_style`) and `MapScreen` reads it
      instead of hardcoding `light`. `map/mapStylePreference.ts` parses it — the value is a text
      column read on the path that draws the map, so anything unrecognised falls back to light
      rather than producing a style name that cannot resolve (4 tests).
      — Light stays the default deliberately: the everyday map is read outdoors in sunlight and
      is the style tuned for it. **The souvenir renders dark regardless of this setting.**

### T-070

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

### T-071

- [x] **T-071** Stamp award rules: dwell time **and** plausible speed gates (D-009) ⇠ T-041,
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

### T-072

- [x] **T-072** Store a confidence value on every stamp award ⇠ T-071
      — Done with T-071. 0–1, from how comfortably each gate was cleared, deliberately
      non-saturating so a marginal award stays distinguishable from an obvious one. Stored
      alongside dwell, mean speed and a written reason; never shown to the user.

### T-074

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

### T-075

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
      — **Amended 2026-08-12, on the project lead's instruction, after looking at the running
      app.** The stamp button moved to **bottom-left** and the start/stop control to bottom-right;
      what matters is that they stay on opposite sides, because that is what stops a mis-tap. The
      old thumb-reach argument for bottom-right is kept in design brief §3.1 rather than deleted —
      it is still true, and a one-handed outdoor test (T-065) is what would settle it.
      — **The `🛂` emoji is gone.** At 36 dp it rendered as a plain blue rectangle, and the project
      lead asked what "the button to centre the map" was — on a screen that has no such control.
      `passport/stampMark.ts` now draws a tilted die-cut octagonal seal from the same `cutEdge`
      geometry the real stamps use, so the icon cannot drift from the things it stands for.
      11 tests, and it is in `tools/preview-stamps.mjs` at four sizes on the real button colour.
      — ✅ **No text label — decided by the project lead 2026-08-12.** The mark and the number,
      nothing else. The screen is allowed three things and this element already does two jobs; the
      fix for an unidentifiable icon was to draw a real one, not to caption it. The *accessible*
      label is unchanged and still reads "Open your passport, 23 of 180 places collected".
      **T-065 outdoors is what could overrule this** (design brief §3.1).
      — ⚠ **The first mark was a 20-gon, passed every test, and rendered as a crosshair** — which
      on this screen of all screens was the wrong thing to draw. At 34 dp a 20-gon is a circle and
      a 1.6-unit scallop does not exist. **Corners and tilt are what survive being small**; the
      tests now pin both, but looking at it is what found it. CLAUDE.md's rule about artwork
      earning a second renderer is the reason the preview page existed to check it in.

### T-081

- [x] **T-081** Verify the passport screen is legible with 3 stamps and with 200 ⇠ T-074
      — **Measured 2026-08-10** in the web workbench (D-038), not eyeballed. Day one and 3
      stamps each fit **exactly one screen**; 23 stamps 1.05; 180 stamps 2.66 screens, all
      rendered. The first attempt scrolled to 1.1 screens at 3 stamps — five "No X yet" lines
      — which is what the measurement caught and one invitation fixed.
      — ⚠ Still unverified on hardware: real font scaling and sunlight (T-065).

### T-099

- [x] **T-099** Trip-end detection via airport geofence, plus Porto Santo airport and the
      — Done 2026-08-10: **D-039**. `progress/tripEnd.ts` decides (pure, 16 tests),
      `progress/tripEndDetection.ts` runs it on every geofence crossing and on app launch.
      — **The trap D-012 does not mention: the user crosses the airport geofence on the way
      IN.** Naively, every holiday ends forty minutes after it starts and the reveal is spent
      in arrivals. An airport crossing only ends a trip if the user has been somewhere else
      first *and* the trip is 20h+ old *and* they dwelled 45 min.
      — The content pack gains `departurePoints` — monitored so the trip can end, excluded
      from the stamp rules so nobody collects an airport.

### T-100

- [x] **T-100** Fallback trip-end detection — left island bounding box, or 24h+ no data.
      — Done 2026-08-10. The bounds cover both islands, so a ferry day trip stays inside them;
      there is a test asserting Porto Santo reads as *inside*. Inaccurate fixes (>200 m) are
      ignored so one wild reading cannot end a holiday.
      — **Silence takes three days, not 24h** (D-039). Silence means "the user left" *or* "an
      OEM killed the recorder", and ending a live trip on the second would fire the reveal over
      a half-recorded holiday. D-012 said "24h+", so this is within its latitude.

### T-101

- [x] **T-101** Finalisation pass — run any pending matching before the reveal ⇠ T-092, T-099
      — Done 2026-08-10, and **much smaller than this task was written expecting**: after
      D-032 there is no matching to finalise, the trace is drawn raw. What remains is running
      the stamp award pass once more before revealing, so the reveal can never show a total
      that omits a stamp the user earned.

### T-102

- [x] **T-102** Reveal notification at the departure-lounge moment ⇠ T-099
      — Done 2026-08-10. The second and last notification of the trip (D-011). Leads with the
      number collected, because that is what they will want to see and might share (D-013).
      — Fired from the geofence crossing rather than the next app launch, which is what puts
      it in the departure lounge — D-012 calls that the best moment in the product.

### T-103

- [x] **T-103** Accommodation detection — identify the most frequent overnight location
      — Done 2026-08-10: **D-040**. `souvenir/accommodation.ts`, pure, 15 tests. Clusters
      overnight fixes (01:00–05:00 local) within 150 m; needs 3 before it believes anything, so
      one stray night or one wild fix cannot become "home". Reports nights as well as fixes,
      because one restless night at 02:00 and 03:00 is not a pattern.

### T-104

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

### T-105a

- [x] **T-105a** The **composition** — what appears when, in what order, and where the camera
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

### T-105b

- [~] **T-105b** **MOVED TO v2 2026-08-12 (D-051).** Encode the storyboard to an MP4 ⇠ T-105a
      — Cut because it needs a new native dependency (D-043 forbids adding one without a network
      audit) **and cannot be verified at all without a device this project does not have.** It was
      simultaneously the riskiest remaining item and the least testable.
      — ⚠ **This removes v1's only distribution mechanism.** CONTEXT §2.3 and D-013 called the
      video *the entire distribution strategy*. Read D-051 before treating v1 as launchable.
      — T-105a's composition stays: it is written, tested, and is what v2 starts from.

### T-105d

- [x] ~~**T-105d** Make the passport worth screenshotting~~ **DROPPED 2026-08-12 by the project
      — ⚠ **The consequence is not neutral and should not be softened: v1 now has no sharing
      mechanism at all**, designed or accidental. D-051 already removed the souvenir video, which
      CONTEXT §2.3 calls *the entire distribution strategy*; this was the fallback, and it is gone
      too. **OD-10 is no longer partly mitigated — it is wide open.**
      — Nothing is lost technically: the passport screen exists and a user can still take a
      screenshot by hand. What does not exist is any reason for them to, or any design that makes
      the result worth posting.
      — Original framing, kept because it is what to restore if OD-10 is answered by "organic
      sharing after all":
      — With the video cut, this is the nearest thing v1 has to a way anybody discovers the app,
      and CONTEXT §4.2 already claimed *"a filled passport page is also a second shareable
      screen"*. Nobody has designed an export, and **"they will screenshot it" is a hope, not a
      mechanism.** D-049's smaller canvas helps: a passport at 31/80 is worth posting.

### T-113

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

### T-114

- [x] **T-114** Minimal plain-English onboarding, no jargon ⇠ T-042
      — Done 2026-08-10. Three screens, every decline a real button the same size as the
      accept. **No-jargon verified by a check over the rendered DOM**, not by eye:
      "permission", "background", "geofence", "GPS" and "enable" appear nowhere.
      — Measured at 2x text scaling: copy scrolls, buttons stay reachable (D-015).
      — ⚠ The copy has never been read by anybody outside this project. T-112 and T-129.

### T-115

- [x] **T-115** Landmark tap → minimal card, one Directions button (D-018) ⇠ T-066
      — Done 2026-08-13. Decision recorded as **D-052** (Provisional). Six new modules: the pure
      half is `map/placeMarkers.ts`, `map/placeStyle.ts`, `places/directionsLink.ts` and
      `places/placeCard.ts`; the impure half is `places/openDirections.ts` and the wiring in
      `map/MapScreen.tsx`; `ui/PlaceCardView.tsx` is presentational and mounts in the workbench.
      35 new tests.
      — **The blocker was not the card, it was that nothing was drawn to tap.** The map had the
      trace and nothing else; the basemap's own labels are the wrong set (T-058 strips most of
      them) and matching one back to a place id would put Madeira knowledge in `app/` (D-017).
      So the content pack became a point layer, and that layer is both what you see and what you
      press.
      — ⚠ **`canOpenURL` is a trap on Android 11+**, and picking it would have shipped a dead
      button. It answers about package visibility, not about whether an app exists, and returns
      false for `geo:` and `google.navigation:` unless the manifest declares a `<queries>` entry.
      `openURL`-and-catch asks the question we actually have.
      — ⚠ **`encodeURIComponent` does not escape parentheses**, and `geo:` uses them as the
      label's delimiters. `Miradouro (novo)` would have closed the label early. Escaped
      explicitly, with a test.
      — **The first layout was wrong and the workbench found it.** The card was anchored to the
      bottom corner and the controls were pushed up by its `onLayout`-measured height; the
      measurement never arrived, and the card rendered **on top of the passport button** — a
      mis-tap between two primary controls, the exact failure design brief §3.1 exists to
      prevent. Replaced with a `bottomSlot` on `PrimaryOverlay`: one flex column, so the overlap
      is impossible at any text size and there is nothing to measure or keep in sync.
      — **Measured in the workbench** (D-038), both card states: 60 dp buttons, no overlap with
      either bottom control, and the distance line correctly absent when there is no recent fix.
      ⚠ It was measured, **not looked at** — the browser pane could not render a screenshot in
      this session, so nobody has seen this card. It uses only theme colours that
      `contrast.test.ts` already holds, but "reads as a card" is not something a rectangle
      measurement can tell you.
      — **The markers are held below the trace's contrast by the style tests** — D-032 makes the
      trace the visual product of v1, and eighty markers can drown one line. That ceiling plus
      D-015's 3:1 floor leaves a narrow band, which is why collected differs from uncollected by
      shape, size and weight rather than by colour.
      — **Verified on the emulator** with a temporary two-place fixture pack, since
      `content/pois.json` is empty and this feature draws nothing without it. The fixture was
      reverted; `git status` is clean on `content/`. What it showed:
        · both markers drew, and the levada drew **once**, at its trailhead;
        · a tap opened the card — `0 / 2` on the passport button, `LEVADA WALK`, the name, and
          `9.1 km away, in a straight line`, so the distance path works against a real recorded
          fix rather than a fixture one;
        · the accessible label reads *"Directions to Fixture Levada Walk in your maps app"*;
        · **tapping Directions launched Google Maps.** The emulator image has it, which was not
          expected — the handoff is real, not just well-formed.
      — ⚠ **Still unverified:** the `geo:` fallback branch (nothing forced it), the whole iOS
      branch, and every question about a real phone.
      —
      — **REVISED THE SAME DAY, AND THIS IS THE INTERESTING PART.** The project lead looked at the
      dots and deleted them: *"I prefer if the user wants to know the levada on the map to click on
      the badge/stamp and have an option Show on map."* The route is now passport → stamp → card →
      *Show on map*, and the map draws one marker only while that card is open (D-052 revised).
      The all-places layer and its tests are gone rather than kept warm.
      — **Two bugs the emulator found that the logic could not**, both about the camera:
        · the trace framing (D-053) overrode the focus, because it guarded on *"is a focus
          pending"* — and the focus is cleared the instant it is consumed, a beat before the
          fixes finish loading. It is a latch now;
        · `camera.current.flyTo` **throws** *"NativeCameraComponent ref is null, wait for the map
          being initialized"* when the native view has not attached — which is exactly the case
          when arriving from the passport — and inside an async handler that throw is swallowed
          into an unhandled rejection. No crash, no log, a camera that ignores you. The camera is
          driven by props now.
      — **And the card has now been looked at**, which is what found both. See the T-112 note.

### T-116

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

### T-116a

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

### T-117

- [x] **T-117** **Dependency network audit** — confirm zero SDKs transmit anything. This is
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

### T-118

- [x] **T-118** iOS `PrivacyInfo.xcprivacy` manifest, including third-party SDK declarations
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

### T-120

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

### T-121

- [x] **T-121** Android prominent-disclosure screen before requesting background location
      — Done 2026-08-10. Uses Play's required phrasing ("collects location data even when it
      is closed or not in use"), states the purpose and that nothing is uploaded or shared,
      and says plainly that declining still leaves a working app. Shown on Android only, before
      the Always request. **T-123's reviewer reads this screen** — do not reword it casually.

### T-122

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

### T-124

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

### T-125

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

### T-141

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

### T-112 (in progress)

- [~] **T-112** Ruthless UI reduction pass ⇠ T-075
      — Started 2026-08-13. **The method is the finding: `bash tools/screenshot.sh <name>` and then
      actually open the PNG.** Every problem below had been in front of the project since the
      screens were written, passed 369 tests, and was invisible in the workbench.
      — **1. The app's front door was a red error page.** MapLibre logs the known T-063b glyph
      failure as an *error*, so in a development build LogBox drew a toast across the bottom of the
      map — **over the passport button**. Tapping the passport opened a full-screen *Console Error*
      instead. Silenced in `App.tsx` by the message's exact text, so a different glyph failure
      still shows and `adb logcat` still has it. Never `ignoreAllLogs`.
      — **2. The stamps were postage stamps.** 62 dp in a card 270 px tall: the artwork (D-046) is
      the entire reward and it read as an icon, with its name illegible. Now 96 dp — still three
      across on a 360 dp phone, which is what the old number was protecting, and D-049's cut to
      ~80 places shortened the scroll it was protecting against.
      — **3. Empty categories were full-height grey slabs.** Five of them made a nearly-empty
      passport look emptier than it is. An empty row is now a slim outline.
      — **4. The floating *Map* button sat on top of the last category row.** The scroll's bottom
      padding did not know about a button the *screen* draws, not the view.
      — ⚠ **Still open and visible in the screenshots:** the `Debug` switcher collides with the
      dev-client's own floating bubble in the top-right corner (development only, T-117a), and the
      sea is a flat slab with no coastal treatment — real cartography, judged outdoors (T-065).
      — **2026-08-13, second pass: the iOS look (D-054).** The project lead asked for *"the iOS app
      look and feel"*. What was portable turned out to be structure, not assets: neutral greys
      instead of a blue-tinted dark, a 34 pt large title, grouped-inset sections with the label
      outside the card, a real sheet for the place card (raised surface + shadow — painted the same
      colour as the cards behind it, it looked like it was *inside* one), one filled button with
      tinted-text secondaries, pills and circles on the map, and `‹ Map` at the top left instead of
      a floating pill that sat on the last row.
      — Settings was rebuilt on the same grouped-list rule, so the two list screens now match.
      — The floating `Debug` chip is gone from the product screens; it appears only on the debug
      screen, as the way back. Settings was always the way in.
      — ⚠ **Still not iOS, deliberately:** the map's floating chrome is dark-on-light where Apple
      Maps is white-on-light. Ours is higher contrast outdoors (D-015) and the same chrome has to
      survive the dark map style (D-026). And `expo-blur` — the most recognisable iOS material of
      all — is untried: it is a new native dependency and a blur composited over a MapLibre GL
      surface is exactly the combination that goes wrong on Android.

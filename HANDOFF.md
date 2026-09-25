# Session Handoff

**For:** a session picking this project up cold. **Updated:** 2026-09-24 (end of the session that
worked the release-readiness plan).
**Mode: EXECUTION.** Don't open research threads or propose decisions unless something is
genuinely blocked. Grep the reference docs; do not read them whole.

## State, in one paragraph

The app is **Proa** (`com.proa.madeira`). The whole v1 chain is written and **runs on a real phone**
(the project lead's Huawei P30, Android 10, EMUI): record → stamps → trace on Google Maps → passport
→ place card → trip end → souvenir still image. **774 tests** (counted 2026-09-24, after the rings went), `tsc` strict
clean. The **free tier is in** (T-155): stamps 11+ are drawn locked. **A closed-beta build unlocks
everything** (`EXPO_PUBLIC_PROA_BETA=1`, D-084; `docs/dev-build.md`). **Nothing lets a store user
pay yet**, and ⚠ **the free tier itself is under study: D-089 (Provisional),
`docs/monetization-study-plan.md`.** Nothing in `app/` changes for monetisation until it is Accepted. `content/pois.json` holds **80 curated places**. The UI speaks
**English, Portuguese and German**, and **no user-facing text may contain a dash** (— or –): the
project lead finds it reads as AI-written, and `i18n.test.ts` plus `privacyPolicy.test.ts` enforce
it. ⚠ **Battery, overnight survival and GPS under canopy are still unmeasured**, and **nobody has
completed a real trip** (T-205).

## Where the release plan stands — `TASKS.md`, top section (T-182 to T-212)

The review (`docs/app-review-2026-09-22.md`, scored 7/20) became the plan. Status on 2026-09-24:

**Decided:** T-182 (D-084: billing in public v1, beta unlocked, now built), T-183 (D-087: the
WalkNYC-style outing, pause and summary; all three of its Provisional choices accepted), T-184
(D-085: faint rings for places to collect; the chip and then **the rings themselves were removed
2026-09-24** on the project lead's word, so the map draws only collected places again), T-185 (D-088: a trip ends at the airport, after 3 days of silence, or by
*End trip*), T-186 (D-086: icon in-house from the stamp art).

**Done and seen on the P30:** T-189 (no debug route in release), T-190/T-191/T-193/T-194
(Portuguese everywhere, honest permission texts, 12 permissions), T-198 (the outing), T-200
(onboarding), T-202 (Settings: version, language, licences), T-204 (*Terminar viagem* in the
passport), T-209 (Settings crashed on Privacy, Erase and Licences since 2026-08-16; fixed), T-210
(after an update a native receiver posts *"Abra o Proa para continuar a registar"*), T-211
(Android Back goes back instead of exiting), T-212 (opening the app now restarts a recorder that
was deferred because the process started in the background), T-203 option D (the passport is one
dark album and unvisited stamps keep a muted hue of their own).

**Fixed, not yet proven on the device:** **T-177, the blank map at startup.** Cause: a maps-compose
6.10.0 bug (googlemaps/android-maps-compose#776) that expo-maps pins; it strikes when the app's
process was pre-started in the background (22 of 22 blank launches). Fixed by forcing 6.12.1
(`plugins/withMapsComposeFix.js`), binary-checked against expo-maps' precompiled AAR. It cannot be
induced on the P30, so the proof is a natural pre-started launch with a map. Look in `adb logcat`
for a launch without a `createClassLoader … com.proa` line.

**Waiting on the project lead:**
1. **T-201:** veto `docs/why-go-draft.md` (80 English "why go" lines, about 20 marked ⚠, 4
   blank). Then translate to pt/de and fill `why` in `content/pois.json`.
2. **T-122:** three calls in `docs/store-privacy-answers.md` (shared or not; deletion "No"; one
   sentence for the privacy policy in three languages).
3. **T-187:** trademark search (blocks the icon, T-188), a domain plus `CONTACT_EMAIL` (blocks
   T-206/T-123), and the Play upload key (blocks T-207 and any real billing test).
4. **T-203 P2-8:** whether the grey "Passport" placeholder button (D-083) should change. Asked,
   not decided.
5. **D-089 study:** N (Q2), the watermark A/B (Q5), the price (Q6), and people for Q3/Q4.

**The second review (`docs/app-review-2026-09-24.md`, 6.7/20) is now tasks T-214 to T-224**, a
section of its own in `TASKS.md` with the project lead's answers. Done in code 2026-09-24/25:
T-215 (accessibility, and 7 more label-in-name failures than the review saw), T-216 (the policy's
seven untrue claims), T-217 (replay without a stamp), T-218 (stamp on its card, album palette),
T-219 (row peek, 84 dp on the P30), T-221 (licences from what ships: 286, Android included),
T-222 (`tools/smoke-release.mjs`), T-223 (zoom floor, *Centrar* from the ocean), T-224.
✅ **All of it is on the P30 since 2026-09-25** (beta release, data kept), with T-225 (card
distance only within 2 km), T-226 (compact Settings; language first, no jump), the project lead's
picks from `tools/out/screen-options.html` (card B, passport top A, map A with a flat WalkNYC-style
progress line) and a fix found on the phone (*Ver a sua viagem* now asks the film planner).
**Before handing any build to anyone:** `node tools/smoke-release.mjs` (every screen, crash check).
Drive the phone with `tools/lib/device.mjs`; the screen must be on (*Manter ativo* is on).
**Waiting on the project lead:** round 2, `tools/out/screen-options-2.html` (what the progress line
says; a quieter *Centrar*), and whether Settings rows may drop below D-015's 60 dp.
Memory (N9) measured: no leak; the gap to WalkNYC is the map view and the React Native baseline.

**Next for the assistant:** ⚠ **not T-156 yet.** D-089 (written in a parallel session on
2026-09-24) puts billing *after* the monetisation study. ✅ **The study's desk half is done (2026-09-24)**: Q1, Q4, Q6, Q8 are written into
`docs/monetization-study-plan.md`. The rest waits on the project lead (N, A/B, price, people). Outside monetisation: T-197
(memory after sharing: needs a stamp on the phone) and T-196 (the DB-versus-delivered measure needs a
field build). T-205, one real trip, is the MVP gate, confirms the study's Q1, and needs the project
lead outdoors.

## Traps found in this session (read before touching the P30)

- **Never run force-stop loops on the P30.** After a few hundred, EMUI's iAware began force-stopping
  Proa 2 ms after launch (`iAwareF[CrashClean]`). Keep device loops short and spaced.
- **`TaskStop` does not kill a background bash script here.** Two probe loops once drove the phone at
  the same time. The probe scripts take a pid lock; kill leftovers by pid (`ps -ef | grep loop`).
- **`am start -W` hangs forever** if the app never comes to the front. A hung probe looks like
  silence.
- **EMUI setting, done by the project lead:** *Definições → Bateria → Iniciar aplicações → Proa*
  set to manual with all three switches on. Without it, an update never wakes the app.
- **Gradle does not re-bundle when only an environment variable changes** (beta versus store) or
  when only `content/` changes. Delete the bundle outputs first (`docs/dev-build.md`).
- **`run-as` works only on the field build** (debuggable). The P30 now runs a beta *release* build.
- **Shell heredocs collapse backslashes** in regexes and escapes (`\b`, `—`). Write scripts to a
  file with the Write tool.
- **Play Protect prompts on every install**, and only the project lead can tap them.

⚠ **The P30 runs a BETA release build (unlocked, D-084), reinstalled 2026-09-24 20:52 with the rings removed and the passport row (stamp 101 dp, *Centrar* centred beside it)**, with option D, End
trip, the update notice, T-212 and maps-compose 6.12.1 (`pkgFlags` has no `DEBUGGABLE`, so
performance readings are valid). Its old trip was closed by the *End trip* test and automatic
recording was switched back on, so a new trip opens at the next fix. The next install also brings
`dismissUpdateNotice` (committed, not yet on the phone). To pull the database, swap in the field
build first. Backups: `Madeira-fieldwork/p30-2026-09-23/` and `p30-2026-09-23b/` (5712 fixes,
integrity ok).

## What was settled 2026-08-17 — read these before touching related code

| | |
|---|---|
| **D-070** | The map shows **only collected places**, tappable, drawn as the app's own ring-and-disc marks. Map chrome inverts with the map style. ⚠ **Amended 2026-08-19: Google's POI pins are back ON** — the project lead settled the question the switch was left open for. Safe now only because T-153 gave the app its own marks; **watch a collected mark against Google's pins at street zoom.** |
| **D-071** | ⚠ **Reversed twice in one day.** The map is the product — but **stamps are a priority again**, because D-072 makes them the revenue. |
| **D-072** | **Free on Play.** Trace and recorder free forever; **10 stamps + your first levada free**; **€4.99** unlocks the rest; earned stamps always kept. Break-even is **$25**. ⚠ **One-way: Play forbids free→paid.** |
| **D-073** | Marketing is **ASO on one free listing**. ⚠ Never claim *"works offline"* or *"nothing leaves your phone"* — both false since D-057. |
| **D-074** | The app is **Proa**, the listing is **Proa - Madeira**, the package is **permanent**. |
| **D-077** | ⚠ **Provisional, 2026-08-18.** Real-device verification is **Play's pre-launch report + Firebase Test Lab**, not owning a phone. Free, real hardware, **nothing added to the app**. The *"buy an Android"* line in this file was never checked. |
| **D-076** | **The souvenir film IS the map, played back** — Google's own basemap, camera following the walk, trace growing behind it. ⚠ Recording it means recording Google's map: allowed for a user's own holiday, attribution must stay visible. |
| **D-075** | ⚠ **Provisional, 2026-08-18.** A stamp you earned but have not paid to see is **locked** — padlock, muted drawing, *"collected — unlock to see this stamp"* — and **never** "not collected". The hero and the row counts keep counting what was earned. One boolean overrules it. |

**Research written today:** [`docs/monetization-options.md`](docs/monetization-options.md) (three
parts, 14 options costed) and [`docs/marketing-plan.md`](docs/marketing-plan.md) (the store listing
is drafted and ready to paste).

## What blocks v1

0. ✅ **THE APP HAS RUN ON REAL HARDWARE — 2026-08-19.** Firebase Test Lab, Robo test, **Pixel 5,
   Android 11: passed, zero crashes**, one device stable. First time in this project's life.
   ⚠⚠ **AND THE MAP RENDERS ON REAL HARDWARE.** The crawl graph shows a state with Google's own
   terrain in colour, a marker, and a place card open on *Achada do Teixeira*. **The single most
   fragile unknown in this product is answered** — it had only ever been seen on a swiftshader
   emulator whose surface was known to break across restarts.
   ⚠ **A useful accident made that test valid:** the release APK is signed with the *debug* key,
   whose SHA-1 is already on the Maps API key restriction. **The moment a real upload key exists
   that stops being true** — and then Google's own re-signing SHA-1 must be added or the map is
   grey for every real user (T-117e).
   ⚠ **The run was `en_US`.** Portuguese and German were never on screen. Test Lab takes a locale,
   so seeing them on real hardware is another free run away.


1. ⚠⚠ **A $25 Play registration — NOT a phone (D-077, 2026-08-18).** This list said *"a physical
   Android, ~€50–100"* for weeks and **nobody had checked.** Uploading to a Play test track makes
   Google run the app **on real devices, free**, returning crashes, screenshots **per language**,
   **accessibility findings including touch targets**, and **frame rates**. Firebase Test Lab adds
   five free physical-device runs a day and **puts nothing in the app** — you upload an APK, there
   is no SDK. Working: `docs/testing-without-a-device.md`.
   ⚠ **Point it first at: does the Google map render on a real GPU?** It has only ever been seen on
   a swiftshader emulator with a surface known to be fragile, and `-gpu host` paints it black here.
   It is the most fragile unknown in the product.
   — Still needs a phone *in a pocket*: battery (T-054), overnight survival and OEM killers
   (T-051/T-053), GPS under canopy (T-076–T-080), one real trip (OD-10). **That is a closed beta
   (T-129), not a purchase** — and a purchase answers them for one handset.
2. **Nobody has completed a single trip with this app.** OD-10 says use it yourself for one real
   trip before launching, and it is also how the store screenshots stop being a replayed route.
3. **The curated 80 are one person's judgement.** *Achada do Marques* and *Chão da Ribeira* are
   flagged as most likely wrong.

## ✅✅ THE PROJECT HAS REAL RECORDED DATA — found 2026-09-22

**A Huawei P30 (ELE-L29, Android 10, Play Services current) was still plugged into the dev
machine**, with the app's database from the August loan intact: **831 real fused fixes**, 30 trips,
2,699 geofence events, 3,627 recording events, 22–28 August. `run-as` works on EMUI, so it came
off cleanly. **Backed up outside the repo** at `Madeira-fieldwork/p30-2026-09-22/` with SHA-256
sums — ⚠ **it must never be committed**: unmasked real movement, which is what D-016/D-040 exist
for, and `tools/fixtures/` is deliberately *not* gitignored.

**Everything measured from it is in `docs/field-notes.md`.** The three that change decisions:

1. ⚠⚠ **The modelled noise is far more pessimistic than the island.** Cleanup cuts **43%** of drawn
   length on `preview-trace.mjs`'s invented error and **2%** on real fixes. Every judgement about
   the trace was made against the model. **Stop quoting the sweep as if it described Madeira.**
2. ✅ **T-171/T-172/T-173 — three bugs it found, all fixed 2026-09-22.** Flying home put the
   recorder in a trip-creation loop and defeated D-011's per-trip notification cap (**26 "your
   trip has ended" notifications**); every geofence registration wrote an EXIT for all 74 regions;
   the foreground service was started from the background and **the recorder did not start**.
   Verified by replaying the phone's own 831 fixes — **226 trip creations → 1, 2,706 geofence
   events → 0** — and then on the phone itself. `recording/recordingAdmission.ts` is the new pure
   module and its header is the story.
   ⚠⚠ **And T-174, found while setting up the soak and blocking it: the recorder was DEAD and
   the app said it was recording.** Switch on, screen saying *"A registar a sua viagem"*, no
   foreground service, no OS location request, no database write since **28 August**.
   `isRecording()` reports that the *task is registered*, not that anything runs — so once the
   service died it was never restarted. **Check `dumpsys activity services` before believing any
   recording state the app reports.**
3. **Reported accuracy: p50 5.2 m, p90 20 m, p99 109 m, max 154 m** — bimodal, with almost nothing
   between 20 m and 90 m. `MAX_DRAWN_ACCURACY_M = 120` rejects 0.6%; `NEVER_DRAWN = 500` never
   fired. ⚠ All open-sky — canopy (T-018) is still unmeasured.

4. ✅ **T-178 — the WAL was 27 MB, over the ~25 MB auto-backup cap.** 615 live frames in a
   27 MB file: SQLite never shrinks it, and one August generation was pinned for six days by
   what looks like a leaked statement. Fixed with `journal_size_limit` plus a `TRUNCATE`
   checkpoint at open, trip end and erase-all — **verified on the P30 (field build): first launch
   took the WAL from 27 MB to 78 KB, nothing lost.** **T-179** found the pin: an expo-sqlite GC race (expo/expo#49799)
   that leaks a stepped statement; every statement is now held until finalized. ⚠ It did not
   reproduce on the P30 under stress — the fix is from source and upstream.

⚠ **Portuguese has now been seen on real hardware** (the map screen, 2026-09-22) — the line below
about it never having been on a device is retired.

⚠ ~~**The P30 runs a plain RELEASE build since 2026-09-22 evening (T-176)**~~ **Superseded 2026-09-23: a field build is installed, see the top of this file.** No Metro needed either way. To
pull its database, swap in the **field build** (release, but `run-as` allowed) with `install -r`
and swap back — tested, data kept both ways. Recipe in `docs/dev-build.md`. Current: built from
`e1b1af1` (T-178/T-179/T-180 in, **80 places**), installed 21:23; last pull before it is `Madeira-fieldwork/p30-2026-09-22d/`.
⚠⚠ **T-177: on that phone the map sometimes never appears** (2 of 9 launches) — blank grey, no
wordmark, recorder unaffected. Not reproducible on demand; the signature is in the task. ⚠ `adb backup` does **not** work on that
phone — it writes an empty file. The phone has **no SIM**: recording needs no internet, the map
does.

## The cheapest thing that would change the most

⚠ **The project lead has an iPhone 15 and can run Sensor Logger.** That answers the *physics* half
— how far GPS wanders under canopy, how often it drops (T-018/T-019/T-020) — **which is what every
threshold in the trace chapter is guessing at.** The importer is built:

```bash
node tools/import-sensor-logger.mjs <unzipped-export-dir> --name levada-do-rei
node tools/preview-trace.mjs --fixes tools/fixtures/levada-do-rei.json --sweep
```

⚠ The parser has **never seen a real export** — columns are matched from plausible names, and a
failure prints the headers it saw. ⚠ `--fixes` prints **no deviation number**: a real walk has no
ground truth.

## Open, and waiting on the project lead

- **T-160a** ⚠⚠ **A German speaker must read `app/src/i18n/strings.ts`** before the German store
  listing. The translations were drafted by the assistant; nobody here speaks German. **English and
  Portuguese can ship first.**
- **T-160b** the Portuguese privacy policy wants the project lead's eye — they are the only person
  here who can judge it.
- **D-074** needs a **TMview / INPI** conflict search on "Proa". The store-and-web screen was done;
  the trademark registers were not.
- **T-159** whether the timelapse video sits behind the paywall.
- **OD-12** ✅ **Decided: build the replay first, keep the video.** **The replay ships (T-105e)**
  — passport → *Watch your trip* — and since **D-076 it is the real Google map**, not a drawing.
  ⚠⚠ **Nobody has seen it move, and now nobody can without a device**: the workbench has no map,
  so its replay stage was deleted rather than left showing a picture the app does not draw.
  **Smoothness, the stamp pop and the 10-second length are all unjudged.** *(The camera is no
  longer among them: there is no threshold any more — the map eases itself between the
  storyboard's keyframes — and the camera used to travel **zero metres**, measured, because its
  window was counted in vertices on an already-simplified trace. Both fixed 2026-08-18.)*
- **T-105b** ⚠ **the exported video got harder, not easier (D-076).** Encoding the film now means
  encoding **Google's map**, which renders on its own surface — `captureRef` over it is unreliable
  and `expo-maps` may not expose `snapshot()` at all. **Treat it as an open spike.** ⚠ And the
  attribution must survive: the wordmark may not be cropped or covered, and **nobody has checked
  whether the replay's hero number collides with it.** *(The old 9:16 empty-frame problem is gone
  — with a map under the trace there is no empty ground to fill.)*
  `node tools/preview-film.mjs` → geometry only, **no basemap** — that is the preview, not the app
- **T-164** the **import** request (Health / Strava / Timeline / GPX). ⚠ Recommended v1 subset is
  **a file the user hands us and nothing else** — Strava is OAuth, an API and a third party.
  ⚠⚠ And the decision that comes first is **whether an imported track may earn a stamp at all**.
- **D-075** ⚠ **Somebody has to look at the padlock.** Its geometry and colours are measured; its
  *appearance* is not, and the question a test cannot answer is whether a **locked** sticker is
  obviously different from one that was **never collected**. If they read the same at arm's
  length, the app is quietly denying visits. Workbench scenario **"23 stamps — free tier
  (T-155)"** — `npm --prefix app run web`.

## ⚠ Mid-flight when the last session ended — read before touching stamps

**T-158, the rank medal, is mid-design.** The rank *logic* is done and shipped
(`passport/stampTier.ts`, 13 tests; the passport button wears it). **The artwork is not**, and
`TIER_METAL`'s five flat fills in that file are the **superseded** answer.

Four rounds of sketches live in `tools/preview-rank.mjs` → `node tools/preview-rank.mjs` →
`tools/out/rank.html`. **Nothing has been promoted into `app/`.**

⚠⚠ **The one insight worth not re-deriving.** The project lead rejected a dense design for looking
like a poker chip, then rejected the sparse replacements for not feeling premium — and named why:
*"não por parecer uma ficha de poker mas por parecer mais exclusiva e detalhada"*. **Density is
what feels premium; only the grammar was the chip.** The two devices that spelled *casino* were
**evenly spaced dots at the rim** and **uniform spokes crossing the whole face**. Both are gone —
replaced by an overlapping twisted cord and a starburst confined to the well with alternating ray
lengths — and the density is kept.

⚠ **Next action is not code: somebody opens `tools/out/rank.html` and says what survives.** Then
promote the chosen seal into a pure module with a second renderer.

⚠ **No SVG filters in whatever gets promoted.** `feGaussianBlur` is unreliable in
`react-native-svg` on Android; shadow is an offset copy, deboss is three passes, sheen is a
gradient.

## Next tasks, in the order that makes sense

⚠⚠ **Superseded 2026-09-23 by *Release readiness* at the top of `TASKS.md`** (T-182–T-208),
the plan from `docs/app-review-2026-09-22.md` (7/20). **The six decisions T-182–T-187 are the
project lead's and gate most of it.** The list below still stands, placed inside that plan:
T-156 waits on T-182, and T-158 is parked until Gate R1.

1. **T-156** — Play Billing. `entitlementStore.setUnlocked` is the seam and nothing calls it, so
   **today no user can pay.** ⚠ It is also the first network call the app makes on its own
   account: T-156's own notes list the privacy copy that has to be reworded before it ships.
2. **T-158** — make the stamps worth buying. All the revenue rests on them now (D-072). ⚠ It is
   *deferred by the project lead* — **do not start it without asking**, whatever this list said
   before.
3. **T-161/T-162** — ship the listing; screenshots from a **real** trip.

## Traps. Each cost a session, and none was visible from the tests

- ⚠⚠ **The map drew the UNCLEANED trace for a month — T-167, ✅ fixed 2026-09-22.**
  `NativeMapScreen` called `splitIntoSegments` (raw) while `traceCleanup.ts` reached the souvenir
  card and every preview tool — **so everything anybody previewed was clean and the phone never
  was.** The Google screen (Aug 14) predates the cleanup (Aug 16), which was wired into
  `buildTrace`, whose only caller is now `app/attic/`. **Same shape as T-145**: nothing tests a
  screen, so 644 tests could not see it; the project lead found it by looking at the app.
  **`map/traceDrawn.test.ts` is now the guard**, and it was verified by reintroducing the bug.
  ⚠ **The lesson outlives the fix:** when a pure module is replaced by a different renderer,
  check what the *new* screen calls — the old one keeps the correct call and keeps passing.
  ⚠ **Three causes remain and are NOT fixed** — miter joints, the hairline's false precision,
  and no snapping: `docs/trace-fidelity.md`, **D-082 (Provisional)**, T-168/T-169/T-170.
- ⚠ **`expo-maps` polylines take four properties and no more** — `points`, `color`, `geodesic`,
  `width` (`GoogleMapsView.kt:158`). **No dash pattern** (so the dashed-bridge idea in
  `traceGeoJson.ts:112` is not buildable), no joint type (miter, which turns a 1.3° corner into a
  ~480 px spike), no caps, no zIndex. Alpha *does* work. Check this file before designing anything
  that draws a line.
- ⚠⚠ **T-145 — nothing started geofence monitoring, so no stamp could ever be awarded.** 399
  passing tests could not see it. **If you are about to trust a subsystem because its tests pass,
  read this one first.** ⚠ **T-155 was the same shape**, and is now guarded: `freeTier.test.ts`
  fails the build if the recorder or the award pass so much as imports `entitlement/`. **The free
  tier gates a display and nothing else** — the app monitors all sixty geofences and writes every
  award while unpaid, because that is the only thing that makes D-072's "buy later, get
  everything" true.
- ⚠⚠ **A second Android SDK on this machine breaks every Gradle build.** `ANDROID_SDK_ROOT` was set
  **persistently, at the Windows User level**, to `%LOCALAPPDATA%\Android\Sdk` — a real second SDK,
  not a stale path. Gradle sees two different SDK locations, refuses to choose, and **fails during
  configuration** with *"Several environment variables and/or system properties contain different
  paths to the SDK"*. The env block below did not clear it, so the documented commands failed here.
  ⚠ **The message does not name the cause:** it aborts while evaluating the root project, so it
  blames `android/build.gradle` line 24 and `com.facebook.react.rootproject`. Removed from the User
  environment 2026-08-28; `unset ANDROID_SDK_ROOT` added to the env block so a machine that still
  has one set is not blocked.
- ⚠⚠ **`-gpu host` renders the Google map as PURE BLACK.** No error, no wordmark. It reads as a
  broken app. `tools/run-emulator.sh` defaults to swiftshader; `MADEIRA_COLD=1` forces a cold boot.
  ⚠ **If the map is black, cold-boot before debugging the app.**
- ⚠ **Grey map ≠ black map.** Grey grid **with** the Google wordmark = the **API key** (restricted
  by package name **and** SHA-1 — see `docs/dev-build.md`). Pure black = the GPU.
- ⚠ **Before publishing:** Google re-signs uploads, so a second SHA-1 entry is needed on the Maps
  key or **the map is grey for every real user** while working perfectly in your builds.
- ⚠ **T-147 — Google's own dark map needs the *latest* renderer.** The emulator only ever loads
  LEGACY. `adb logcat -s Proa` says which.
- ⚠ **A constant most callers ignore is not a constant.** Renaming the app found **five** hardcoded
  copies of the name, and the first version of `brand.test.ts` missed the **permission dialogs in
  `app.json`** — the most user-visible text in the app. `brand.test.ts` now covers both.
- ⚠ **`app/attic/` is kept, not compiled.** The MapLibre map lives there since 2026-08-18
  (D-057 amended): nothing deleted, excluded from `tsconfig`, dependency gone. It was **a fifth of
  the download for a screen no code path could reach**. ⚠ It is **not type-checked** and will rot —
  `app/attic/README.md` says what reviving it would take.
- ⚠ **A catalogue most callers ignore is not a catalogue.** T-160 was written up as done with
  **ten accessibility labels still in English** and `SettingsView` spelling out *"Use the light
  map"* beside three keys that already existed. `i18nCoverage.test.ts` now fails the build for
  both. ⚠ Its blind spot is text inside `{}` — that is where the passport's hero label hid.
- ⚠ **Pure modules may not import `i18n/index.ts`** — it reaches `expo-localization` and would
  break every Node test. They take a `Language` parameter, like they take `nowMs`.
- ⚠ **The workbench cannot see `hitSlop`.** A measured tap target may be a lie.
- ⚠ **Hermes lacks `Intl.DateTimeFormat.formatRange`**, and stores accented strings as UTF-16 —
  grepping the bundle for a Portuguese name says it is missing when it is not.
- **On the emulator, record on the `driving` profile** (D-047). **`adb root` drops `adb reverse`.**
- **Never state a measured-sounding number that was not measured.** The battery figure is `null` on
  purpose and a test keeps it that way (D-041).
- **Check the measurement ran.** If a result does not move when the input changes, suspect the probe.

## Building and verifying

```bash
cd app && npm test          # 774 tests
cd app && npx tsc --noEmit  # strict

export ANDROID_HOME=$(pwd)/tools/android-sdk
unset ANDROID_SDK_ROOT      # ⚠ see below -- without this, gradle refuses to configure
export JAVA_HOME=$(pwd)/tools/jdk/jdk-21.0.12+8
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
bash tools/run-emulator.sh          # then, in another shell:
cd app && npm run android           # ~4 min cold; rebuild after any native dep
bash tools/screenshot.sh <name>
bash tools/replay-route.sh tools/routes/funchal-seafront.txt
```

⚠ **A Google Maps API key is needed to see a map at all** — `app/.env.example` → `app/.env`, and
it must be restricted to `com.proa.madeira`. `docs/dev-build.md` has the click path.

⚠ **`expo-localization` is a config plugin**, so the i18n work needs `npx expo prebuild` and a
rebuild before any of it exists on the device. **That build was still running when this session
ended — Portuguese has NOT been seen on a device.** The emulator's locale is already set to
`pt-PT`, so launching the new build should show it.

## Content and preview tools

```bash
node tools/validate-content.mjs        # run after any content edit
node tools/build-regions.mjs --assign  # boundaries → regions.json
node tools/build-levadas.mjs           # levada courses
node tools/levada-routes.mjs           # PR numbers and derived durations
node tools/preview-trace.mjs --sweep   # trace cleanup, drawn to a PNG
node tools/preview-souvenir.mjs        # the share card to an SVG
node tools/preview-film.mjs            # the film, as a contact sheet of frames
node tools/preview-tour.mjs            # ⭐ THE WHOLE PRODUCT ON ONE PAGE — start here
```

## Where things are written down

**The documents are the source of truth, not this file and not chat history.**

| | |
|---|---|
| `CONTEXT.md` | The *why*. §6 conventions, **§9 the doc protocol you must follow** |
| `DECISIONS.md` | Index of 74 decisions. Full text in `docs/decisions-full.md` |
| `TASKS.md` | The checklist. Post-mortems in `docs/task-notes.md` |
| `PROJECT_PLAN.md` | Phases, and the open questions **OD-5/8/9/10/11** (OD-4 is resolved) |
| `docs/field-notes.md` | ⚠ What real walks taught. The only measured facts in the project |
| `docs/design-brief.md` | Read before touching anything that renders. §7 is the name |
| `docs/monetization-options.md` | OD-4's research, three parts |
| `docs/marketing-plan.md` | ASO, and the drafted store listing |

**Read D-032 before starting anything large** — it cuts map matching from v1.

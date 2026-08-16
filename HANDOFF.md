# Session Handoff

**For:** a session picking this project up cold. **Updated:** 2026-08-14.
**Mode: EXECUTION.** Don't open research threads or propose decisions unless something is
genuinely blocked.

## State

The whole v1 chain is written and **runs on an Android emulator**: record → stamps by geofence →
trace on a map → passport → trip end → reveal. 86 source files and 33 test files under `app/src`
— roughly 16,800 lines of source and 7,000 of tests.

On 2026-08-13 a place became reachable: **passport → tap a stamp → card → Show on map** (T-115,
D-052, D-055). For a levada that draws **its real course** from `content/levadas.json`, built by
`tools/build-levadas.mjs`. There is **no Directions button** — the project lead removed it: *"we
arent a navigator."*

The map also now **opens on your walk rather than on the island** (D-053), the interface follows
**iOS conventions** (D-054), and the trace is **blue rather than red** (D-056).

On 2026-08-14 the passport's five categories became **swipeable strips with a *See all*** that
expands one into the old grid (T-144) — 80 places would not fit as five grids. **428 tests.**

On 2026-08-16 regions became real (T-067, D-061): the place card names the municipality under
the place, and `tools/validate-content.mjs` now checks every place against the boundaries.
⚠ **It found two stamps nobody could ever have earned** — Cabo Girão was curated 525 m out to sea
and the Rocha do Navio reserve 1.4 km. **Both fixed the same day on the project lead's
instruction**, to the coordinates OSM gives for the places a visitor actually stands: the Cabo
Girão skywalk and the Rocha do Navio clifftop viewpoint. The validator now passes clean.

⚠ **THE MAP CHANGED ON 2026-08-14 (D-057).** The app now draws **Google Maps on Android** via
`expo-maps`, and will draw **Apple Maps on iOS** when an iOS build exists. The project lead decided
this deliberately, against a recommendation to keep our own map.

**Our MapLibre map is kept, not deleted** — `app/src/map/MapLibreScreen.tsx`, complete and working.
Swapping back is one import in `App.tsx`.

⚠ **You need a Google Maps API key to see a map at all.** Copy `app/.env.example` to `app/.env` and
paste one — `docs/dev-build.md` has the click path, the restriction to apply, and why none of it
costs money. Without a key the map is blank and everything else still works.

**The chain is verified on Google Maps** (2026-08-14): passport → stamp → card → *Show on map* →
the camera frames the levada's whole course and draws it. Screenshots in `tools/out/shots/`.

⚠ **D-001 is partially superseded.** The app is no longer zero-network: the map streams tiles. The
trip still never leaves the phone. `legal/privacyPolicy.ts` is rewritten to match;
`docs/store-privacy-answers.md` is **flagged and not rewritten** — it is a compliance artefact and
needs the project lead to read it.

Verified on the emulator: build, install, launch, the map drawing from the offline pack, screens,
permissions, 60 dp tap targets, and **a replayed route reaching `raw_fix` and drawing as a trace**.
Re-verified 2026-08-16 after T-067: the app bundles with `content/regions.json` (1044 modules),
the hero number reads `1 / 79`, and the card reads **VIEWPOINT · Pico do Areeiro · Santana** —
the municipality, from the boundaries, on a device.

⚠ **THE STAMP RULES CHANGED ON 2026-08-16 (D-065).** Every place now has **two independent
detectors** — the OS geofence, and a sweep of the raw trace for when the OS never fired — and a
levada is credited by **how much of its course you walked** (60%, or 3 km) rather than by touching
both endpoints. Out-and-back walks, skipped sections and lost crossings all earn the stamp now.
A walk that *nearly* qualified now raises one question on the passport (T-149) — *"Walked 2.1 km
of 5.0 km (42%) — did you walk it?"* — and a refusal is remembered. ⚠ **A confirmation, never a
claim: there is no "mark as collected" control anywhere, deliberately.**

⚠ **Never verified, because no emulator can answer it:** battery, background survival, GPS
realism (CONTEXT §6.6). Those need a real Android. **No threshold in this app has met real data.**

## What actually blocks v1

⚠ **The content is no longer the blocker; the two below are.** What changed on 2026-08-14 is that
the app became usable — there are places to collect, the passport lists all of them, and every
finished feature turned on at once.

**1. ~~`content/pois.json` is empty~~ ~~a STARTER SET~~ — **CURATED 2026-08-16 (D-064, T-066a).**
It holds **60 places**: 16 viewpoints · 11 levadas · 16 villages · 7 beaches · 10 landmarks. The
assistant drafted, the project lead vetoed, and their one correction was a name (*Prainha*). Every
name is verified against OSM, every place sits inside the region it claims, nothing is offshore and
nothing duplicates another. ⚠ **The weakest entries are the two kept on no evidence at all** —
*Achada do Marques* and *Chão da Ribeira* — and *Parque Ecológico do Funchal*, cut because I believe
it burned. Those three are where this pack is most likely to be wrong.
⚠ **Three editorial edits have been made since, each on the project lead's explicit instruction**
(2026-08-16, T-066): two coordinates that were curated in the sea, one place renamed
*Miradouro da Rocha do Navio* and recategorised, and one duplicate deleted — *Monumento Natural
do Cabo Girão* was the same cliff as *Cabo Girão*, 745 m away. `node tools/check-names.mjs` and
`node tools/validate-content.mjs` are what found all three.

**Selection was by prominence and coverage, not by merit.** Nobody has asked of any single place
*is this worth a stamp*, which is the whole of T-066. `content/README.md` says so at the top and
says how to redo it. **Deleting the lot and starting again from the candidate list loses nothing.**

```bash
node tools/poi-candidates.mjs         # ~200 ranked candidates → content/pois.candidates.json
node tools/build-levadas.mjs          # levada courses → content/levadas.json (re-run after any edit)
node tools/build-regions.mjs --assign # boundaries → content/regions.json, and each place's region
node tools/validate-content.mjs       # checks the work, targets 60–100 places (D-049)
```

⚠ **Two traps that cost something here, both now caught by tools:**

- **The tile pack names viewpoints in fragments.** `pois.candidates.json` gives `Barcelos`,
  `Bodes`, `Escalvado`; OSM's own nodes at those places say **Pico dos Barcelos**, **Pico dos
  Bodes**. A stamp reading "GATO" means nothing. Check a name against OSM before trusting it.
- **A levada name can match two different levadas.** `Levada do Moinho` came out 21.4 km across
  from 11.9 km of ways — impossible for one path, so it was two. `build-levadas.mjs` now checks
  span against length and says so.

**2. No physical device.** The emulator settles rendering, storage, UI, permissions and replayed
routes. A used mid-range Android (~€50–100) is the only source of battery and background-survival
numbers. **The project lead's.**

**3. OD-10 — nothing makes anyone discover this app. ⚠ Options written 2026-08-16 —
[`docs/distribution-options.md`](docs/distribution-options.md), awaiting the project lead.**
The recommendation is **not to launch publicly yet**: nobody has completed a single trip with this
app, so a launch would spend the first impression on a version that cannot be measured. ⚠ **And a
consequence worth its own line: a privacy-first app cannot run a growth loop.** After a launch you
will know installs and nothing else — not trips recorded, not stamps earned.
The souvenir is back in v1: a **shareable still first** (T-105d, no unknowns), and the **video as
a spike** (T-105c → T-105b) once the physical Android exists. ⚠ **The video is not a commitment
until one five-second MP4 exists on a real phone.** The channel question below is untouched. D-051 cut the souvenir video, which
CONTEXT §2.3 called *the entire distribution strategy*; T-105d, a shareable passport, was dropped
the next day. This is a question about whether v1 should launch publicly, not which channel to
use. **The largest open item in the project.**

## What the project lead asked for next, 2026-08-16

1. ~~**Their corrections to two review sheets**~~ — **both closed 2026-08-16.** The place list is
   applied (T-066a); the trailhead sheet was answered by rejecting its premise — parking is not
   where a levada starts on this island, and after D-065 the endpoints barely matter.
   ⚠ **One question is open and deliberately parked: dashed bridges** (T-151, D-067). The project
   lead wants to *see* it before deciding, and it cannot be seen without the phone.
2. ~~**T-149**, the confirmation prompt~~ — **done 2026-08-16.**
3. ~~⚠ **Then: the accuracy and reliability of the drawn trace**~~ — **first pass done
   2026-08-16 (D-066, T-150).** Outliers, standing-still scribble and redundant vertices are
   removed before drawing; nothing is moved. On a modelled walk the drawn line went from 4.49 km
   to 2.55 km for a 2.23 km route, worst excursion 151 m → 20 m. ⚠ **Modelled, not measured** —
   the thresholds are guesses until T-018. `node tools/preview-trace.mjs` draws it.
   — *(original note)* ⚠ **Then: the accuracy and reliability of the drawn trace** — *"the highlighted path of where
   you've been shown on the map"*. **Do not start a new subject before this one.** It is the only
   thing the user actually looks at after the stamps (D-032 spent the whole map-matching budget on
   making this half good), and nothing about it has been examined since T-059: not the accuracy
   filter, not the breaking rule (D-059), not what a canopy-degraded walk looks like drawn.
4. ⚠ **The souvenir is LAST (D-063, amended 2026-08-16).** It is in scope and it is not a
   priority: *"we still need stronger foundations before focusing on that"*. **Do not start it —
   not even the shareable still — while a foundation item is open.**

## The code tail, in rough order of value

- **T-063b** — ~~one glyph range still requested~~ **moot while the platform map ships** (D-057).
  It was a MapLibre glyph fetch; nothing requests it now. It returns if the MapLibre path does.
- ⚠ **`byRegion` is computed and shown nowhere, and that is now a decision (D-062), not a gap.**
  The passport already answers "where next" (D-058), and the map screen is allowed three controls.
  Do not "finish" it by adding a region row without reopening D-062.
- ~~**T-067** region boundaries~~ — **done 2026-08-16 (D-061).** `content/regions.json` holds the
  eleven municipalities, `regionId` is now derived from the polygon a place stands in, and the
  card names it. It found that **46 of the 80 places were filed under the wrong region**, 27 of
  them under the island itself, because `byRegion` has been computed since T-073 and displayed
  nowhere. **T-067a** (the Porto Santo gate) now has its data half.
- **T-112** UI reduction pass.
- ~~Directions handoff~~ — **deleted 2026-08-13, and do not bring it back.** It was built, then
  removed the same day on the project lead's instruction: *"we arent a navigator."* The dots over
  every curated place went with it. The route to a place is passport → stamp → card → *Show on
  map*, which draws its course.

## The four traps found on 2026-08-14/15

Each cost a session to find and none was visible from the tests. Full write-ups are in
`docs/task-notes.md` under the task id — this list is here to stop you rediscovering them.

- ⚠⚠ **T-145 — nothing started geofence monitoring, so no stamp could ever be awarded.**
  `refreshGeofences` had one caller: the debug screen. 399 passing tests could not see it, and
  neither could months of emulator sessions, because the debug screen registers a **synthetic
  fixture** — every crossing anybody ever watched carried a `dev-near-*` id. **If you are about
  to trust a subsystem because its tests pass, read this one first.**
- ⚠ **T-146 — nothing auto-started recording for an Always user either.** Same shape, one screen
  along: onboarding set a flag and stopped, and those users are shown no start button by design.
- ⚠ **T-147 — the dark map is Google's own only where the renderer allows it.** `colorScheme:
  DARK` needs the **latest** Maps renderer; on the legacy one it is ignored in silence and the
  user gets a white map. **This emulator is handed LEGACY**, so it always shows our fallback and
  can never show what most users see. `adb logcat -s MadeiraExplorer` says which is in play.
- ⚠ **The dark map takes the floating chrome with it.** The settings control measures 15.36:1 on
  Google's light map and **1.13:1** on the night one. Anything that floats over the map has to be
  checked against both.

## Traps that each cost something here

- **On the emulator, record on the `driving` profile.** `walking` and `stationary` ask for
  `balanced` accuracy, which an emulator cannot serve at all, and they produce a perfect
  impersonation of a dead recorder (D-047). One-line check: `adb shell dumpsys location` should
  show `gps provider: ProviderRequest[…HIGH_ACCURACY, WorkSource{… com.madeiraexplorer.app}]`.
  Its absence is what a silent recorder looks like.
- **`adb root` drops `adb reverse`.** The dev client then cannot reach Metro and shows a stack
  trace that looks like Metro died. Re-run `adb reverse tcp:8081 tcp:8081`.
- **Never state a measured-sounding number that was not measured.** The battery figure is `null`
  on purpose and a test keeps it that way (D-041).
- **Check the measurement ran.** If a result does not move when the input changes, suspect the
  probe. A regex over raw tile bytes once "found" a character that was not there.
- ⚠ **Grepping the Android bundle for a Portuguese name will tell you it is missing.** Hermes
  stores an ASCII-only string as 8-bit and anything with an accent as **UTF-16**, so
  `grep -a "Câmara de Lobos" index.hbc` finds nothing while `Machico` is found — and the obvious
  conclusion, that half the content did not ship, is wrong. Search both encodings. Found
  2026-08-16 while verifying T-067; it is the same class of mistake as the tile-byte regex above,
  and it took a second probe to see it.
- ⚠ **The workbench cannot see `hitSlop`, so a measured tap target may be a lie.** react-native-web
  does not render the prop: the DOM gives you the *word*, not the target. T-113 measured every
  control and passed; T-144's *See all* still shipped at 57 × 35 against the 60 dp floor, found on
  2026-08-16. Measure with `tools/ui-audit.js`, then **read the code for a `hitSlop`** on anything
  it reports as small. A test now refuses a `hitSlop` written as a single number.
- **Artwork is judged by eye — and there IS an eye now, so use it.**
  `bash tools/screenshot.sh <name>` writes a PNG, and a session can open that PNG and look at it.
  On 2026-08-13 that loop found, in ten minutes and after 369 passing tests: a dev-build error
  toast sitting **on top of the passport button** (so tapping the passport opened a red error
  page), stamps drawn at a third of the size the artwork deserves, and a map opening on 60% flat
  sea. **None of these were findable any other way**, and the second renderer
  (`tools/preview-stamps.mjs`) is still worth having for the artwork itself.
  ⚠ Screenshots are still expensive — take the one that answers the question, not five.

## Verifying work

```bash
cd app && npm test          # 420 tests, Node's own runner
cd app && npx tsc --noEmit  # strict
bash tools/run-emulator.sh && cd app && npm run android
bash tools/replay-route.sh tools/routes/funchal-seafront.txt
bash tools/screenshot.sh <name>
```

Reading `/data/data/com.madeiraexplorer.app/files/SQLite/madeira.db` with `adb root` + `sqlite3`
is usually faster than tapping through the UI.

## Where things are written down

**The documents are the source of truth, not this file and not chat history.** If this disagrees
with a decision, the decision wins.

| | |
|---|---|
| `CONTEXT.md` | The *why*. §6 conventions, **§9 the doc protocol you must follow** |
| `DECISIONS.md` | Index of 60 decisions. Full text in `docs/decisions-full.md` |
| `TASKS.md` | The checklist. Post-mortems on finished tasks in `docs/task-notes.md` |
| `PROJECT_PLAN.md` | Phases, and the open questions **OD-4/5/8/9/10** |
| `docs/design-brief.md` | Read before touching anything that renders |

**Read D-032 before starting anything large** — it cuts map matching from v1 and deletes work you
might otherwise begin: `grep -A40 "^## D-032" docs/decisions-full.md`.

Reference: `docs/dev-build.md`, `docs/map-style.md`, `docs/field-testing.md`,
`content/README.md`, `docs/osm-coverage.md`, `docs/dependency-audit.md`,
`docs/store-privacy-answers.md`.

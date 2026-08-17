# Session Handoff

**For:** a session picking this project up cold. **Updated:** 2026-08-16.
**Mode: EXECUTION.** Don't open research threads or propose decisions unless something is
genuinely blocked. Grep the reference docs; do not read them whole.

## State, in one paragraph

The whole v1 chain is written and **runs on an Android emulator**: record → stamps → trace on
Google Maps → passport → place card → trip end. **500 tests**, `tsc` strict clean. `content/pois.json`
holds **60 curated places** (16 viewpoints · 11 levadas · 16 villages · 7 beaches · 10 landmarks),
all names verified against OSM, all inside the region they claim, none offshore, no duplicates.
The souvenir **still image works end to end on a device** — Share on the passport produces a PNG
through the OS share sheet. ⚠ **Nothing has ever run on real hardware**, and no threshold in the app
has met real GPS.

## What blocks v1 — three things, none of them code

1. **A physical Android.** ~€50–100 used. The only source of battery (T-054), background survival
   (T-051), OEM-killer behaviour (T-053) and whether OS geofences fire in the field (T-076–T-080).
   ⚠ **Read the Sensor Logger note below before assuming this is the whole blocker** — it is not.
2. **OD-10, discovery.** Options and a recommendation are in
   [`docs/distribution-options.md`](docs/distribution-options.md), awaiting the project lead. The
   recommendation is *not to launch yet*: nobody has completed a single trip with this app.
3. **The curated 60 are one person's judgement.** Three entries are flagged as most likely wrong:
   *Achada do Marques* and *Chão da Ribeira* (kept on no evidence at all) and *Parque Ecológico do
   Funchal* (cut because it is believed to have burned).

## The one thing that would change the most, cheaply

⚠ **The project lead has an iPhone 15 and can run Sensor Logger.** That answers the *physics* half
of what is blocked — how far GPS wanders under laurel canopy, how often it drops, what accuracy it
claims (T-018/T-019/T-020) — **which is what every threshold written on 2026-08-16 is guessing at**:
the 60 m corridor, the 45 minutes, the 16 m simplification tolerance, the accuracy cut.

**The agreed next step, not yet built:** an importer so a Sensor Logger export lands in
`tools/fixtures/` and `node tools/preview-trace.mjs --fixes <file>` runs the app's own cleanup
against **real** fixes instead of modelled noise. Roughly an hour of work, and it turns the whole
trace chapter from *plausible* into *measured*.

An Android is still needed for what the app itself does in the background — Sensor Logger surviving
Doze says nothing about whether our recorder does.

## What changed on 2026-08-16 (nine decisions — read these before touching related code)

| | |
|---|---|
| **D-061** | A region is a **municipality**, from OSM boundaries. Found **46 of 80 places filed wrongly**, 27 under the island itself. `regionId` is now derived by tool, never typed. |
| **D-062** | `byRegion` is computed and **shown nowhere** in v1, deliberately. Do not "finish" it without reopening this. |
| **D-063** | The souvenir is back in v1. Still image first (**done**), video as a spike (needs the phone). |
| **D-064** | The canvas is **greatest hits, not coverage**; thin regions stay thin. And the assistant **drafts** the place list, the project lead **vetoes**. |
| **D-065** | **Two independent detectors for every stamp** — the OS geofence, and a sweep of the raw trace for when it never fired. A levada is credited by **how much of its course you walked**. |
| **D-066** | The drawn trace is **cleaned before drawing** — outliers, standing-still scribble, redundant vertices — and **cleaning never moves a point**. |
| **D-067** | The 120 m accuracy cut is a **preference, not a veto**: a canopy stretch where every fix is poor still draws. |
| **D-068** | A levada is credited by **time** too — 45 min at walking pace, 800 m covered. From the first field walk (PR18). |
| **D-069** | **A walk the user sends, never a walk the app collects.** Settings → *Send a walk*. No endpoint, no identifier. |

⚠ **D-068 came from the project lead walking PR18 Levada do Rei** — the only field data this
project has. `docs/field-notes.md` has it in their words. The lesson that matters: **a levada has no
finish line**, most are walked there-and-back, and *"I prefer to mistakenly give the levada stamp
than doing the levada and not earning it."*

## Traps. Each cost a session, and none was visible from the tests

- ⚠⚠ **T-145 — nothing started geofence monitoring, so no stamp could ever be awarded.**
  `refreshGeofences` had one caller: the debug screen, which registers a **synthetic fixture**. 399
  passing tests could not see it. **If you are about to trust a subsystem because its tests pass,
  read this one first.**
- ⚠ **T-146 — nothing auto-started recording for an Always user either.** Same shape, one screen on.
- ⚠ **T-147 — the dark map is Google's own only on the *latest* Maps renderer.** The emulator is
  handed LEGACY, so it can never show what most users see. `adb logcat -s MadeiraExplorer` says which.
- ⚠ **Anything floating over the map must be checked on both styles.** The settings control measures
  15.36:1 on the light map and **1.13:1** on the night one.
- ⚠ **The workbench cannot see `hitSlop`.** react-native-web does not render it, so a measured tap
  target may be a lie — T-144's *See all* shipped at 57 × 35 against the 60 dp floor. Measure with
  `tools/ui-audit.js`, then read the code. A test now refuses a `hitSlop` written as one number.
- ⚠ **Grepping the Android bundle for a Portuguese name says it is missing.** Hermes stores accented
  strings as **UTF-16**; search both encodings before concluding content did not ship.
- ⚠ **Hermes has no `Intl.DateTimeFormat.formatRange`.** Measured on the device: the share card takes
  the spelled-out fallback. Feature detection there is the live path, not a precaution.
- **On the emulator, record on the `driving` profile.** `walking`/`stationary` ask for `balanced`
  accuracy, which an emulator cannot serve — a perfect impersonation of a dead recorder (D-047).
- **`adb root` drops `adb reverse`.** Re-run `adb reverse tcp:8081 tcp:8081`.
- **Never state a measured-sounding number that was not measured.** The battery figure is `null` on
  purpose and a test keeps it that way (D-041).
- **Check the measurement ran.** If a result does not move when the input changes, suspect the probe.
- **Judge anything drawn by eye, not only by test.** `bash tools/screenshot.sh <name>` writes a PNG a
  session can open. That loop once found a dev-build toast sitting on top of the passport button.
  ⚠ Screenshots are expensive — take the one that answers the question.

## Building and verifying

```bash
cd app && npm test          # 500 tests, Node's own runner
cd app && npx tsc --noEmit  # strict

# ⚠ The emulator build needs both paths exported; npm run android alone fails.
export ANDROID_HOME=$(pwd)/tools/android-sdk
export JAVA_HOME=$(pwd)/tools/jdk/jdk-21.0.12+8
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
bash tools/run-emulator.sh          # then, in another shell:
cd app && npm run android           # ~4 min cold; rebuild needed after any native dep
bash tools/screenshot.sh <name>
bash tools/replay-route.sh tools/routes/funchal-seafront.txt
```

⚠ **A Google Maps API key is needed to see a map at all** — `app/.env.example` → `app/.env`.
`docs/dev-build.md` has the click path and why it costs nothing.

Reading `/data/data/com.madeiraexplorer.app/files/SQLite/madeira.db` with `adb root` + `sqlite3` is
usually faster than tapping through the UI.

## Content and preview tools

```bash
node tools/validate-content.mjs        # names, regions, offshore, duplicates. Run after any edit
node tools/build-regions.mjs --assign  # boundaries → regions.json, and each place's region
node tools/build-levadas.mjs           # levada courses → levadas.json. Re-run after any rename
node tools/check-names.mjs             # every curated name against OSM
node tools/preview-trace.mjs --sweep   # draws trace cleanup to a PNG, and sweeps its tolerance
node tools/preview-souvenir.mjs        # the share card to an SVG
node tools/curation-evidence.mjs       # wiki/PR/elevation evidence per place
```

`tools/lib/` holds the shared geometry, the Overpass client with its backoff, and a **hand-written
PNG writer** — there is no image library here, and geometry has to be looked at.

## Where things are written down

**The documents are the source of truth, not this file and not chat history.** If this disagrees
with a decision, the decision wins.

| | |
|---|---|
| `CONTEXT.md` | The *why*. §6 conventions, **§9 the doc protocol you must follow** |
| `DECISIONS.md` | Index of 69 decisions. Full text in `docs/decisions-full.md` |
| `TASKS.md` | The checklist. Post-mortems on finished tasks in `docs/task-notes.md` |
| `PROJECT_PLAN.md` | Phases, and the open questions **OD-4/5/8/9/10/11** |
| `docs/field-notes.md` | ⚠ What real walks taught. The only measured facts in the project |
| `docs/design-brief.md` | Read before touching anything that renders |

**Read D-032 before starting anything large** — it cuts map matching from v1:
`grep -A40 "^## D-032" docs/decisions-full.md`.

Reference: `docs/dev-build.md`, `docs/distribution-options.md`, `docs/curation-draft.md`,
`docs/dependency-audit.md`, `docs/map-style.md`, `content/README.md`, `docs/osm-coverage.md`,
`docs/store-privacy-answers.md` (⚠ a compliance artefact, still needs the project lead to read it).

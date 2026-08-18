# Session Handoff

**For:** a session picking this project up cold. **Updated:** 2026-08-18.
**Mode: EXECUTION.** Don't open research threads or propose decisions unless something is
genuinely blocked. Grep the reference docs; do not read them whole.

## State, in one paragraph

The app is **Proa** (`com.proa.madeira`). The whole v1 chain is written and **runs on an Android
emulator**: record → stamps → trace on Google Maps → passport → place card → trip end → souvenir
still image. **551 tests**, `tsc` strict clean. The **free tier is in** (T-155): the passport shows
ten stamps plus your first levada, and everything beyond that is drawn locked. **Nothing sets the
unlock flag yet — T-156 is the money.** `content/pois.json` holds **60 curated places**
(16 viewpoints · 11 levadas · 16 villages · 7 beaches · 10 landmarks). The UI speaks **English,
Portuguese and German**. ⚠ **Nothing has ever run on real hardware**, and no threshold in the app
has met real GPS.

## What was settled 2026-08-17 — read these before touching related code

| | |
|---|---|
| **D-070** | The map shows **only collected places**, tappable. Google's POI pins are off. Map chrome inverts with the map style. |
| **D-071** | ⚠ **Reversed twice in one day.** The map is the product — but **stamps are a priority again**, because D-072 makes them the revenue. |
| **D-072** | **Free on Play.** Trace and recorder free forever; **10 stamps + your first levada free**; **€4.99** unlocks the rest; earned stamps always kept. Break-even is **$25**. ⚠ **One-way: Play forbids free→paid.** |
| **D-073** | Marketing is **ASO on one free listing**. ⚠ Never claim *"works offline"* or *"nothing leaves your phone"* — both false since D-057. |
| **D-074** | The app is **Proa**, the listing is **Proa - Madeira**, the package is **permanent**. |
| **D-075** | ⚠ **Provisional, 2026-08-18.** A stamp you earned but have not paid to see is **locked** — padlock, muted drawing, *"collected — unlock to see this stamp"* — and **never** "not collected". The hero and the row counts keep counting what was earned. One boolean overrules it. |

**Research written today:** [`docs/monetization-options.md`](docs/monetization-options.md) (three
parts, 14 options costed) and [`docs/marketing-plan.md`](docs/marketing-plan.md) (the store listing
is drafted and ready to paste).

## What blocks v1

1. **A physical Android.** ~€50–100 used. The only source of battery (T-054), background survival
   (T-051), OEM-killer behaviour (T-053) and whether OS geofences fire in the field (T-076–T-080).
2. **Nobody has completed a single trip with this app.** OD-10 says use it yourself for one real
   trip before launching, and it is also how the store screenshots stop being a replayed route.
3. **The curated 60 are one person's judgement.** *Achada do Marques* and *Chão da Ribeira* are
   flagged as most likely wrong.

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
- **D-075** ⚠ **Somebody has to look at the padlock.** Its geometry and colours are measured; its
  *appearance* is not, and the question a test cannot answer is whether a **locked** sticker is
  obviously different from one that was **never collected**. If they read the same at arm's
  length, the app is quietly denying visits. Workbench scenario **"23 stamps — free tier
  (T-155)"** — `npm --prefix app run web`.

## Next tasks, in the order that makes sense

1. **T-156** — Play Billing. `entitlementStore.setUnlocked` is the seam and nothing calls it, so
   **today no user can pay.** ⚠ It is also the first network call the app makes on its own
   account: T-156's own notes list the privacy copy that has to be reworded before it ships.
2. **T-158** — make the stamps worth buying. All the revenue rests on them now (D-072). ⚠ It is
   *deferred by the project lead* — **do not start it without asking**, whatever this list said
   before.
3. **T-161/T-162** — ship the listing; screenshots from a **real** trip.

## Traps. Each cost a session, and none was visible from the tests

- ⚠⚠ **T-145 — nothing started geofence monitoring, so no stamp could ever be awarded.** 399
  passing tests could not see it. **If you are about to trust a subsystem because its tests pass,
  read this one first.** ⚠ **T-155 was the same shape**, and is now guarded: `freeTier.test.ts`
  fails the build if the recorder or the award pass so much as imports `entitlement/`. **The free
  tier gates a display and nothing else** — the app monitors all sixty geofences and writes every
  award while unpaid, because that is the only thing that makes D-072's "buy later, get
  everything" true.
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
cd app && npm test          # 551 tests
cd app && npx tsc --noEmit  # strict

export ANDROID_HOME=$(pwd)/tools/android-sdk
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

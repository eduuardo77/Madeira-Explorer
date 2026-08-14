# Session Handoff

**For:** a session picking this project up cold. **Updated:** 2026-08-14.
**Mode: EXECUTION.** Don't open research threads or propose decisions unless something is
genuinely blocked.

## State

The whole v1 chain is written and **runs on an Android emulator**: record → stamps by geofence →
trace on a map → passport → trip end → reveal. 76 source files and 28 test files under `app/src`
— roughly 14,000 lines of source and 6,300 of tests.

On 2026-08-13 a place became reachable: **passport → tap a stamp → card → Show on map** (T-115,
D-052, D-055). For a levada that draws **its real course** from `content/levadas.json`, built by
`tools/build-levadas.mjs`. There is **no Directions button** — the project lead removed it: *"we
arent a navigator."*

The map also now **opens on your walk rather than on the island** (D-053), the interface follows
**iOS conventions** (D-054), and the trace is **blue rather than red** (D-056). **371 tests.**

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

⚠ **Never verified, because no emulator can answer it:** battery, background survival, GPS
realism (CONTEXT §6.6). Those need a real Android. **No threshold in this app has met real data.**

## The three things that actually block v1

**1. `content/pois.json` is empty.** No places → no stamps, no hero number, no passport, no trip
end. Everything downstream already works. **This is the project lead's** (T-066) — selection is
editorial judgement and the one thing a competitor cannot buy. It is no longer a blank page:

```bash
node tools/poi-candidates.mjs      # ~200 ranked candidates → content/pois.candidates.json
node tools/validate-content.mjs    # checks the work, targets 60–100 places (D-049)
```

**2. No physical device.** The emulator settles rendering, storage, UI, permissions and replayed
routes. A used mid-range Android (~€50–100) is the only source of battery and background-survival
numbers. **The project lead's.**

**3. OD-10 — nothing makes anyone discover this app.** D-051 cut the souvenir video, which
CONTEXT §2.3 called *the entire distribution strategy*; T-105d, a shareable passport, was dropped
the next day. This is a question about whether v1 should launch publicly, not which channel to
use. **The largest open item in the project.**

## The code tail, in rough order of value

- **T-063b** — ~~one glyph range still requested~~ **moot while the platform map ships** (D-057).
  It was a MapLibre glyph fetch; nothing requests it now. It returns if the MapLibre path does.
- **T-067** region boundaries · **T-112** UI reduction pass.
- ~~Directions handoff~~ — **done 2026-08-13** (T-115, D-052): places are drawn on the map, a tap
  opens a card, one button hands off to the phone's maps app. ⚠ **It draws nothing until
  `content/pois.json` has places** — to see it, put two fixture places in that file and revert
  afterwards.

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
cd app && npm test          # 334 tests, Node's own runner
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
| `DECISIONS.md` | Index of 51 decisions. Full text in `docs/decisions-full.md` |
| `TASKS.md` | The checklist. Post-mortems on finished tasks in `docs/task-notes.md` |
| `PROJECT_PLAN.md` | Phases, and the open questions **OD-4/5/8/9/10** |
| `docs/design-brief.md` | Read before touching anything that renders |

**Read D-032 before starting anything large** — it cuts map matching from v1 and deletes work you
might otherwise begin: `grep -A40 "^## D-032" docs/decisions-full.md`.

Reference: `docs/dev-build.md`, `docs/map-style.md`, `docs/field-testing.md`,
`content/README.md`, `docs/osm-coverage.md`, `docs/dependency-audit.md`,
`docs/store-privacy-answers.md`.

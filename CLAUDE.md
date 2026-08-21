# Working on Proa

Loaded automatically every session. **Routing and invariants only** — never content that lives
in another document. If this contradicts a decision, the decision wins and this file is wrong.

## Read this first

**`HANDOFF.md`** — state, what blocks v1, the traps, and the verification commands. Short on
purpose; read it fully.

Then **look things up rather than reading them.** The reference documents are large, and reading
them whole is the main reason a session gets expensive.

```bash
grep -A40 "^## D-032" docs/decisions-full.md   # a decision in full
grep -A30 "^### T-052a" docs/task-notes.md     # why a finished task went the way it did
```

- `DECISIONS.md` — a one-line index of 60 decisions; full text in `docs/decisions-full.md`.
  **Read D-032 before starting anything large**: it defines v1 scope and deletes work you might
  otherwise begin.
- `TASKS.md` — the checklist. Open tasks carry their notes inline; post-mortems on finished ones
  are in `docs/task-notes.md`.
- `CONTEXT.md` — the *why*. **§6 conventions** and **§9 the doc protocol** before writing code;
  the rest on demand.

**Mode: EXECUTION.** Do not open research threads or propose decisions unless genuinely blocked.

## Keep sessions cheap

The documents cost more to read than the code does. In order of impact:

1. **Grep, do not read.** A whole-file read of `docs/decisions-full.md`, `docs/task-notes.md` or
   `TASKS.md` is almost never justified.
2. **Screenshots are expensive.** Prefer `adb shell uiautomator dump` or a `sqlite3` query. Take
   a screenshot when the question is genuinely visual — artwork, layout, contrast — and then take
   one, not five.
3. **Write less.** A decision earns its length from the alternatives it rejects; a finished task
   does not need an essay. Say what changed and why it was not the obvious thing.
4. **Batch independent tool calls** into one block.
5. **Do not re-measure the checkout's size.** ~12 GB, none of it the app; the breakdown and what
   is safe to delete are in `docs/dev-build.md`.

## The two things that are not yours to do

1. **Getting a physical device.** No Mac, and no Android phone of this project's own.
   ⚠ **CHANGED 2026-08-21 — the project lead has temporary access to an Android**, a few days
   only, one handset. Battery (T-054), background survival and OEM killers (T-051/T-053), GPS
   under canopy (T-076–T-080) and one real trip (OD-10) are **answerable for the length of that
   loan** — ask for the measurement rather than recording it as impossible. The emulator
   (`bash tools/run-emulator.sh`) is still legitimate for rendering, storage, UI, permissions and
   replayed routes — and **worthless for battery, background survival and GPS realism**
   (CONTEXT §6.6). See `docs/dev-build.md`.
2. ~~**Curating `content/pois.json`.**~~ **CHANGED 2026-08-16 — the arrangement is now
   *draft-and-veto* (D-064).** Selection was deliberately theirs (T-066) and the project lead has
   now overridden that twice; on 2026-08-16 they set the standing method: **you produce a
   defended draft — one line per place saying why it earns a stamp, unsure ones flagged — and
   they veto down it.** The final say is still theirs and the judgement calls are still to be
   surfaced, not buried.
   ⚠ **The selection principle, LOOSENED 2026-08-19 (D-078).** It read *"greatest hits, no
   filler — fixed"*. The project lead: *"podes mudar o D-002, eu estava a jogar demasiado seguro
   para ter um MVP."* **The canvas may grow, and levadas especially** — eleven of sixty is thin
   for what the island is. What has **not** changed: a place still has to be worth going to.
   Adding a mediocre one to round a number out is still the failure D-002 exists to prevent.
   ⚠ **CURATED 2026-08-16 (T-066a): 60 places**, drafted and vetoed by that method — 16 viewpoints ·
   11 levadas · 16 villages · 7 beaches · 10 landmarks. It is no longer scaffolding. Before editing
   it, run `node tools/validate-content.mjs`; after editing it, run that plus
   `build-regions.mjs --assign` and `build-levadas.mjs`.

## Honesty rules, each of which cost something here

- **Be precise about which half you mean.** The app runs on an emulator and the recorder records
  *there*; it has also run on **real hardware once** (Firebase Test Lab, Pixel 5, 2026-08-19 —
  rendering only, nobody walked anywhere). Battery, background survival and GPS realism are
  unverified and no emulator can answer them. 619 unit tests and a browser workbench are all the
  verification the *logic* has.
- **Never state a measured-sounding number that was not measured.** The battery figure is `null`
  on purpose and a test keeps it that way (D-041). A plausible guess is a promise the app has not
  earned.
- **Check that a measurement actually ran.** If a result does not move when the input changes,
  suspect the probe before believing it.
- **Check hardware and environment before advising on them.** Advice given without looking was
  once wrong in the direction that costs money.

## Commit messages

Commit freely and push to `origin main`. Subject: task IDs, then what it does in plain words —
`git log --grep=T-071` has to find it later. Body: the *why* — the non-obvious constraint, the
alternative rejected, and **anything found or broken along the way**. Be honest in the subject
when a commit is partly a bug: *"settings, and a broken erase-all"*.

End every message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

⚠ **Write the message to a file and use `git commit -F <file>`.** PowerShell 5.1 word-splits
multi-line `-m` arguments containing double quotes. Use the scratchpad directory.

## Conventions that are not obvious

- **Pure logic in its own module, impure wrapper beside it** — `stampRules`/`stampAwards`,
  `geofenceSelection`/`geofenceManager`, `movementPolicy`/`samplingGate`. Only the pure half is
  testable without a device, which is why the split exists.
- **User-facing strings live in `app/src/i18n/strings.ts`, in all three languages.** ⚠ **Pure
  modules may not import `i18n/index.ts`** — it reaches `expo-localization` and breaks every Node
  test. They take a `Language` parameter, the way they already take `nowMs`. The app's own name
  lives in `src/brand.ts`; `brand.test.ts` and `i18n.test.ts` fail the build if either rule slips.
- **A module under unit test imports with an explicit `.ts` extension.** Node's resolver will not
  guess it; Metro does not mind. Everything else stays extensionless.
- **No Madeira knowledge in `app/`** (D-017, absolute). Coordinates, names and bounds come from
  `content/` or the shipped style's metadata.
- **Artwork and cartography are judged by eye, and this project has none.** Put the design in a
  pure module and give it a **second renderer** that draws what ships
  (`tools/preview-stamps.mjs`). Measure the output too — but a mark that passed every geometry
  test still rendered as a crosshair, so look at it as well.
- **Keep the docs current in the same piece of work** (CONTEXT §9): tier 1 just do it, tier 2
  record as **Provisional**, tier 3 ask first.

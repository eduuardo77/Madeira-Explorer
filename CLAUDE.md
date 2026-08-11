# Working on Madeira Explorer

This file is loaded automatically every session. It is **routing and invariants only** — never
content that lives in another document. If something here contradicts `DECISIONS.md`, that wins
and this file is wrong.

## Read this first

**`HANDOFF.md`** — state, what to do next, and the things that are easy to get wrong. Then
`CONTEXT.md` (§6 conventions, **§9 the doc-maintenance protocol you must follow**) and
`DECISIONS.md` **D-032**, which defines v1 scope and deletes work you might otherwise start.
`TASKS.md` tracks everything task by task.

**Mode: EXECUTION.** Do not open research threads or propose decisions unless something is
genuinely blocked.

## The two things that are not yours to do

1. **Getting a *physical* device.** No Android phone and no Mac. **The emulator now works** —
   the project lead enabled CPU virtualization in firmware on 2026-08-11, and
   `emulator-check accel` returns `0` with WHPX usable. `bash tools/run-emulator.sh` boots an
   Android 14 AVD. It is legitimate for rendering, storage, UI, permissions and replayed routes,
   and **worthless for battery, background survival and GPS realism** (CONTEXT §6.6) — those
   still need real hardware. See `docs/dev-build.md`.
2. **Curating `content/pois.json`.** Selection and editorial judgement, deliberately theirs
   (T-066). Do not offer to do it.

## Honesty rules, each of which cost something here

- **Nothing in this app has ever run on a phone.** Say so when reporting anything as working.
  270 unit tests and a browser workbench are the only verification that exists.
- **Never state a measured-sounding number that was not measured.** The battery figure is
  `null` on purpose and a test keeps it that way (D-041). A plausible guess is worse than
  silence — it is a promise the app has not earned.
- **Check that a measurement actually ran.** A DOM probe that silently matched nothing once
  returned three identical numbers that looked exactly like a pass. If a result does not move
  when the input changes, suspect the probe before believing the result.
- **Check hardware and environment before advising on them.** Advice about tooling was given
  once without looking, and was wrong in the direction that costs money.

## Verifying work

```bash
cd app && npm test          # 270 tests, Node's own runner, no framework
cd app && npx tsc --noEmit  # strict
cd app && npx expo export --platform android --output-dir <tmp>   # Metro resolves everything
node tools/validate-content.mjs                                    # the content pack
```

Seeing things:

```bash
bash tools/run-emulator.sh                       # Android 14 AVD (T-029b)
cd app && npm run android                        # build + install the dev client
bash tools/replay-route.sh tools/routes/funchal-seafront.txt   # give it a trace to draw
bash tools/screenshot.sh <name>                  # → tools/out/shots/<name>.png
```

⚠ **The emulator is legitimate for rendering, storage, UI, permissions and replayed routes, and
worthless for battery, background survival and GPS realism** (CONTEXT §6.6). A green result here
never closes a task naming a battery figure or a survival claim.

Without a device at all:

```bash
cd app && npx expo start --web   # the screens (D-038) — a workbench, never a target
bash tiles/viewer/serve.sh        # the map styles over the real tile pack
node tools/preview-stamps.mjs     # the stamp artwork (D-046)
```

## Commit messages

Commit freely — the project lead has said so. Push to `origin main`.

**Subject:** the task IDs, then what it does in plain words. Decision in brackets when the
commit records one. Task IDs are stable and are referenced in commits by design (TASKS.md), so
`git log --grep=T-071` finds the work later.

```
T-071/T-072: geofence crossings become stamps (D-037)
T-141/T-140/T-125: settings, and a broken erase-all
Docs: cut HANDOFF from 826 to 504 lines
```

**Body: explain the reasoning, not the diff.** `git diff` shows what changed; the message is
the only place the *why* survives. In practice that means the non-obvious constraint the code
satisfies, the alternative rejected and why, and — importantly — **anything found or broken
along the way**, including mistakes made en route. Several commits here carry more value in
that last part than in the feature.

Be honest in the subject when a commit is partly a bug: *"settings, and a broken erase-all"*.

End every commit with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

⚠ **Write the message to a file and use `git commit -F <file>`.** PowerShell 5.1 mangles
native-command arguments containing double quotes, so a multi-line `-m` gets word-split. The
scratchpad directory is the place for that file.

## Conventions that are not obvious

- **Pure logic in its own module, impure wrapper beside it** — `stampRules`/`stampAwards`,
  `geofenceSelection`/`geofenceManager`, `movementPolicy`/`samplingGate`,
  `composition`/`souvenirPlan`. Only the pure half is testable without a device, which is why
  the split exists.
- **A module under unit test imports with an explicit `.ts` extension.** Node's resolver will
  not guess it; Metro does not mind. Everything else stays extensionless.
- **No Madeira knowledge in `app/`** (D-017, called absolute). Coordinates, names and bounds
  come from `content/` or the shipped style's metadata.
- **Artwork and cartography are judged by eye, and this project has none.** `stampArt.ts` /
  `preview-stamps.mjs` is the pattern: put the design in a pure module and give it a **second
  renderer** that draws it to a standalone page, so the thing being looked at is the thing that
  ships. Measure the output too — three real defects in the stamps were found by reading the
  generated geometry, none by looking.
- **Keep the docs current in the same piece of work**, per CONTEXT §9: tier 1 just do it, tier 2
  record as **Provisional**, tier 3 ask first. Stale docs are the recurring failure here — the
  handoff twice described a codebase that no longer existed.

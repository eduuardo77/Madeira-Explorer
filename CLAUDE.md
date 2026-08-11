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

1. **Getting a device.** No Android phone, no Mac, and the emulator is parked behind a BIOS
   change the project lead has declined. See `docs/dev-build.md`. Do not re-litigate it.
2. **Curating `content/pois.json`.** Selection and editorial judgement, deliberately theirs
   (T-066). Do not offer to do it.

## Honesty rules, each of which cost something here

- **Nothing in this app has ever run on a phone.** Say so when reporting anything as working.
  155 unit tests and a browser workbench are the only verification that exists.
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
cd app && npm test          # 155 tests, Node's own runner, no framework
cd app && npx tsc --noEmit  # strict
cd app && npx expo export --platform android --output-dir <tmp>   # Metro resolves everything
node tools/validate-content.mjs                                    # the content pack
```

Seeing things, since there is no device:

```bash
cd app && npx expo start --web   # the screens (D-038) — a workbench, never a target
bash tiles/viewer/serve.sh        # the map styles over the real tile pack
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
  `geofenceSelection`/`geofenceManager`, `movementPolicy`/`samplingGate`. Only the pure half is
  testable without a device, which is why the split exists.
- **A module under unit test imports with an explicit `.ts` extension.** Node's resolver will
  not guess it; Metro does not mind. Everything else stays extensionless.
- **No Madeira knowledge in `app/`** (D-017, called absolute). Coordinates, names and bounds
  come from `content/` or the shipped style's metadata.
- **Keep the docs current in the same piece of work**, per CONTEXT §9: tier 1 just do it, tier 2
  record as **Provisional**, tier 3 ask first. Stale docs are the recurring failure here — the
  handoff twice described a codebase that no longer existed.

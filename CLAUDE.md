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

# Working on Madeira Explorer

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

1. **Getting a physical device.** No Android phone, no Mac. The emulator works
   (`bash tools/run-emulator.sh`) and is legitimate for rendering, storage, UI, permissions and
   replayed routes — and **worthless for battery, background survival and GPS realism**
   (CONTEXT §6.6). See `docs/dev-build.md`.
2. **Curating `content/pois.json`.** Selection and editorial judgement, deliberately theirs
   (T-066). `tools/poi-candidates.mjs` prepares the list; do not offer to choose.
   ⚠ **The file is not empty any more.** On 2026-08-14 the project lead asked twice for a full
   set, overriding this rule on purpose, so it holds **80 places picked by prominence and
   coverage — not by merit**. Treat them as scaffolding the project lead is expected to replace,
   not as a decision already taken, and do not add more without being asked.

## Honesty rules, each of which cost something here

- **Be precise about which half you mean.** The app runs on an emulator and the recorder records
  *there*. Battery, background survival and GPS realism are unverified and no emulator can answer
  them. 420 unit tests and a browser workbench are all the verification the *logic* has.
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

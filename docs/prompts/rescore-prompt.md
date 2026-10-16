You are reviewing **Bruma**, an Android app for tourists on Madeira, in the repository at
`C:\Users\eduar\Desktop\Madeira`. Re-score it on the project's **strict rubric**, so the number
compares with the earlier reviews, and write the order of work to reach **15 / 20 or more**
(WalkNYC, the reference app, is about 14).

## Read first, and cheaply

1. `CLAUDE.md` (loaded automatically) and **`HANDOFF.md`**, whose top section is the latest state.
2. **`docs/bruma-score-and-plan-2026-10-09.md`**: the last review (11.9 / 20). Copy its method,
   its eight areas, weights and anchors **exactly**, and its two-part layout (Part 1 the score,
   Part 2 the plan). Earlier scores: 6.7 (24 Sep), 9.1 (6 Oct), 11.9 (9 Oct).
3. **`docs/field-test-log.md`**: every real-life test on the lead's phone, with the plan of what is
   proven and what is left. This is the main evidence for area A.
4. `DECISIONS.md` for the one-line index; **grep** `docs/decisions-full.md` and `TASKS.md` for a
   decision or task by number (for example `grep -A40 "^## D-106" docs/decisions-full.md`). Never
   read those two files whole.

## What changed since 9 Oct (verify each, do not take it on trust)

- **Automatic recording with the app closed** (D-106): failed on 11 Oct, then a **motion wake**
  (the phone's significant-motion sensor and Google's activity updates wake the recorder). Field
  results 13, 15 and 16 Oct: about 90 to 98% of the route lit within 10 m.
- **First battery figure:** about 2 points an hour over one carried day (16 Oct). One day only.
- **Paywall** (D-105): the offer from the first day, at the 3rd and 5th stamps.
- **Huawei's battery warning** after heavy GPS use, and what was done about it.
- **Store:** version 9 built for the closed track; what the lead has uploaded is in `HANDOFF.md`.
- Smaller items: the light timelapse, plural fixes, the comparison tool's tunnel fix.

Check these with `git log --oneline --since=2026-10-09`, the code, the field log and, where you
can, the phone.

## The phone, if it is connected

The lead's **Huawei P30** (serial `XPHDU19C02001808`, EMUI 12, Portuguese, real data). adb is at
`$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe`; in Git Bash prefix commands with
`MSYS_NO_PATHCONV=1`. If adb does not see it, run `adb kill-server` then `adb start-server`.

- **Read only.** Never uninstall, clear data, restore a database or change a phone setting. Ask
  the lead before anything beyond reading, and before installing a build.
- Read `dumpsys batterystats` before anything else if the phone has just come back from a trip.
- The database copy: `adb exec-out run-as com.proa.madeira cat files/SQLite/madeira.db` (also the
  `-wal` and `-shm` files), read with `node:sqlite`, kept outside the repository.
- The release check: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON
  tools/smoke-release.mjs --internal --serial XPHDU19C02001808`.
- Prefer `uiautomator dump` to screenshots; take a screenshot only for a visual question.
- The phone has no mobile data; that is not a fault.

## Rules for the review

- **Score only what you verified today**, on the phone, in the database, in the code or in the
  field log's measured entries. Say which. A claim in `TASKS.md` is not evidence by itself.
- **Never state a number that was not measured.** If something was not checked today, say so in
  the method's "Not done today" list instead of scoring it as if it had been.
- One phone is all the real-hardware evidence there is; say so where it matters (area D).
- **Do not change the code.** This is a review. Fixing is for after the lead reads it.
- **No dashes (— or –)** in anything the lead reads, including your replies: use a comma, a colon
  or a full stop.
- Explain without web-development jargon: the lead does not come from JavaScript.

## Output

1. **`docs/bruma-score-and-plan-<today's date>.md`**, in the 9 Oct layout:
   - **At a glance:** the score, the band (shippable beta, publishable, above WalkNYC), what moved
     it, what holds it under 15, the single most valuable next thing.
   - **Part 1:** method (build, device, data, what was not done), what changed since 9 Oct
     (verified), the rubric table with a new column beside 24 Sep, 6 Oct and 9 Oct, the working of
     the weighted sum, why each score, new findings with evidence and severity, and MVP and
     publishing.
   - **Part 2:** the target area by area, decisions for the lead, the work split into field (the
     lead), desk, the lead's Play Console, and release verification, and expected scores.
2. Add a line to `HANDOFF.md`'s top section pointing at the new review, and update the memory
   note if you keep one.
3. **Commit and push to `origin main`.** The subject starts with the task ID (`T-271` if this is
   the pre-launch review, otherwise none) and says what it is in plain words; the body gives the
   why. Write the message to a file and use `git commit -F`. End it with the co-author line the
   project uses.
4. Then tell the lead, in a few short paragraphs: the score and what changed it, what holds it
   under 15, and the three things that would move it most.

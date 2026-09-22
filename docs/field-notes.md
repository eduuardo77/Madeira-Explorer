# Field notes

What real walks taught this project. **The only entries here are things somebody
observed outdoors** — everything else in the repository is reasoning, and this file
is the small pile of facts it has to answer to.

---

## 2026-08-16 — PR18, Levada do Rei. The first walk.

**Who:** the project lead. **What they were carrying:** no app — this is an
observation about levadas, not a recorded trace.

### What they found, in their words

> *"Grand majority of the levadas you technically do the levada twice because
> you go and return to your parked car."*

> *"A lot of levadas you don't really finish it because in a few you can continue
> walking nonstop. For example, this PR18 had a quite strong waterfall so we
> decided to return at that point but 'technically' we didn't finish it — but
> that's not fair."*

> *"Data on the levada comes and goes."*

> *"I prefer to mistakenly give the levada stamp than doing the levada and not
> earning it."*

### What was wrong because of it

The crediting rules written that morning (D-065) measured a walk against the
**mapped course** — 60% of it, or 3 km. Both assumptions fail here:

1. **A levada has no finish line.** The drawn course is however much of the
   channel OSM happens to have mapped, which can run on for tens of kilometres.
   Turning back at the waterfall is a *complete walk*; measuring it against
   30 km of channel is measuring it against nothing.
2. **The walk is a there-and-back**, so the ground covered is half the distance
   walked. A two-hour walk out and back to the midpoint scores 50% and was
   refused by a 60% bar.
3. **Canopy drops fixes**, so coverage under-measures exactly where levadas are.

### What changed (D-068)

A **time criterion**, alongside the distance ones: 45 minutes on the corridor,
at walking pace, having covered at least 800 m. The distance floor is what keeps
an hour in a café beside the channel from being a levada walk.

⚠ **45 minutes is deliberately generous**, on the project lead's instruction
above. It will hand out stamps to some walks that were not really levada walks.
That is the trade this project chose (D-009), stated by the person whose app it
is, and it is cheaper than the alternative: somebody walks four hours and the app
tells them nothing happened.

### Added 2026-08-17 — how long it took, and why it could take longer

> *"For the PR18 we took +3 hours both ways."*

> *"It was kind of empty because it was at the end of the day. On peak hours it can
> take longer because some parts of the levada it can be narrow and you might need
> to wait for people to cross before you go."*

**The first duration this project has.** OSM gives PR18 as 5.3 km signed, so the
there-and-back is ~10.6 km, so the pace including stops was **~3.4 km/h**. That is
now the only pace figure in the project, and `tools/levada-routes.mjs` uses it to
derive times for the other ten — as a **floor**, because this walk was the empty,
end-of-day, fast case.

**What it says about D-068.** 45 minutes against a 3-hour walk is **~25% of the
walk**. The generosity is therefore larger than it looked when the number was
chosen, and still the right shape: a per-levada threshold would demand most from the
long remote levadas, which are exactly where canopy costs fixes. The draft in
[`docs/levada-routes-draft.md`](levada-routes-draft.md) argues for leaving the
threshold alone and shipping the durations as **content on the place card** instead.

**Why the crowding observation is not just colour — and what it does not break.**
Waiting for people to cross means **standing still, repeatedly, mid-walk**. Checked
in the code rather than assumed:

- `secondsOnCourse` is the span between the **first and last** fix on the corridor,
  not a sum of moving intervals, so waiting still counts toward the 45 minutes — and
  so does a total canopy blackout in the middle. Robust to both.
- The pace test is an **upper bound only** (`MAX_WALKING_PACE_MPS`, to catch the road
  beside the channel). Being slower than walking cannot refuse a stamp. Waiting for
  people is safe.
- ⚠ `WALKED_MINUTES_FLOOR_M = 800` is what stops an hour in a café counting, and it
  is the rule crowding pushes against: a walk that is mostly waiting still has to have
  covered 800 m. On these distances that is a low bar, so the trade holds.

⚠ Standing still *does* get collapsed out of the **drawn** trace (D-066). That is the
picture, never the record — but it means a heavily-crowded walk will draw as a
slightly shorter line than it was.

### Still unmeasured

- **How much data actually drops under canopy.** "Comes and goes" is the
  observation; no trace exists to measure it, so the corridor width and the
  accuracy rules are still guesses (T-018).
- ~~**What a typical completion time is per levada.**~~ **Partly answered
  2026-08-17**: one measured walk (PR18, above) plus OSM's signed distances give
  derived times for six of eleven — see `docs/levada-routes-draft.md`. ⚠ Still one
  pace figure from one walk, and five levadas have no signed distance at all.

---

## 2026-09-22 — The first recorded data. A Huawei P30, 22–28 August.

**Who:** the project lead's borrowed Android (CLAUDE.md's loan), found still
plugged in a month later with its database intact. **What it is:** **831 real
fused fixes**, 30 trips, 2,699 geofence events, 3,627 recording events —
recovered from `files/SQLite/madeira.db` via `run-as`, backed up **outside this
repository** at `Madeira-fieldwork/p30-2026-09-22/` with SHA-256 sums.

⚠ **It is not a levada walk.** Speed is 0 m/s at the median and 19.2 m/s at p90:
this is a phone mostly standing still and occasionally driving. It answers
questions about the *recorder*, and leaves T-018's canopy question exactly where
it was. ⚠ **It must not be committed** — unmasked real movement, which is what
D-016 and D-040 exist for, and `tools/fixtures/` is deliberately not gitignored.

### ⚠⚠ The modelled noise is far more pessimistic than the island is

`tools/preview-trace.mjs` invents its own error, and every judgement about the
cleanup has been made against it. Run over **real** fixes, the same code barely
does anything:

| | Modelled route | **Real fixes** |
|---|---|---|
| Drawn length, raw → cleaned | 4.49 km → 2.55 km (**−43%**) | 16.8 km → 16.5 km (**−2%**) |
| Spikes removed | 4 in 211 | **11 in 818 (1.3%)** |

**The cleanup is a tidy-up on real data, not a rescue.** That is reassuring about
`SIMPLIFY_TOLERANCE_M = 16` — it buys vertex count and costs almost no length,
which is exactly what its own comment claims and could not prove. It also means
**the sweep's numbers should never again be quoted as if they described Madeira.**

### Reported accuracy, measured

| p50 | p75 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|
| **5.2 m** | 6.2 m | 20.0 m | 88.7 m | 108.7 m | **153.7 m** |

- `MAX_DRAWN_ACCURACY_M = 120` rejects **0.6%** of fixes. A reasonable cut.
- `NEVER_DRAWN_ACCURACY_M = 500` **never fired once.** Nothing observed came close.
- The distribution is **bimodal** — a tight cluster at 5–6 m, then a jump to
  ~90–150 m. There is very little in between, which is worth knowing before any
  threshold is placed in the gap.

⚠ All of it open-sky. Under canopy is still unmeasured.

### ⚠⚠ Leaving the archipelago puts the recorder in a loop

**30 trips in six days, 18 of them under 60 seconds, several lasting 0 s** —
created and killed back to back:

```
trip 20  17:00:32  lasted 0s      trip 23  17:57:43  lasted 0s
trip 21  17:00:33  lasted 0s      trip 24  17:57:43  lasted 2s
```

`tripEnd.ts:186` ends a trip as soon as **any** fix lands outside the archipelago
— correct in itself. But nothing stops the recorder opening a *new* trip while
still outside, so the next fix kills that one too, forever. The fixes span
lat 32.65→38.94 and lon −16.83→−9.33: the phone flew to mainland Portugal, and
the loop ran from then on.

**The user-visible cost is notifications.** D-011's cap is **per trip**, so a new
trip means a fresh allowance:

```
x25  reveal: 1 of 2 (D-011)        <- 25 separate trips each sent one
x 1  reveal: 2 of 2 (D-011)
x41  reveal already sent for this trip
```

**26 "your trip has ended" notifications.** The cap worked exactly as written and
was defeated by the churn underneath it. ⚠ A returning visitor — the person most
likely to fly home *with the app installed* — is the case this hits.

### Smaller things, all measured

- **2,699 geofence events, every one an `exit`, none an `enter`.** They arrive in
  simultaneous bursts — **83 sharing one timestamp**, then 81, then 74. Nobody
  leaves 83 places in a second: this is every region firing EXIT as the set is
  registered. `backgroundTasks.ts:135` maps the transition correctly, so the
  initial trigger is where to look.
- **Zero stamps, and that is correct.** Checked properly rather than assumed: all
  831 fixes against all 60 places' geofence radii — **the phone was never inside
  one.** Not a repeat of T-145. But it means the award path is still *untested* on
  real hardware, not proven.
- **Trip 30 is 606 fixes of which 598 collapse as standing still** — 0.11 km raw
  drawing down to 0.00 km. A phone on a desk, still recording.
- **Two errors never seen before:** `ExpoLocation.startLocationUpdatesAsync`
  rejected at recording launch, and `NativeStatement.finalizeAsync` rejected
  inside `onLocations`.
- `activity_type` is `'unknown'` on all 831 rows — hardcoded at
  `backgroundTasks.ts:55`, consistent with D-081, and read by nothing. Not a bug.

### What this still does not answer

- **Canopy** (T-018). No walk, no trees, no dropout.
- **Battery** (T-054) and **background survival** (T-051/T-053). Recording clusters
  on five days with a 25-day gap, and "killed by EMUI" is indistinguishable here
  from "the app was not running". ⚠ The soak test is still the only way.

### ✅ What was fixed because of this, 2026-09-22

**T-171, T-172 and T-173, same day.** `recording/recordingAdmission.ts` holds the rules and its
header carries the evidence. The shape they share: **extending a trip and starting one are
different privileges** — an out-of-bounds fix is still stored when a trip is open, because it is
what ends that trip honestly, and refusing to store it would trade a loop for a holiday that
never finishes.

Replayed over these same 831 fixes:

| | before | after |
|---|---|---|
| trip creations | 226 | **1** |
| notification re-arms | 226 | **1** |
| geofence events written | 2,706 | **0** |

⚠ **2,706 → 0 settles the diagnosis rather than overshooting it**: not one of those exits had a
matching enter, so every single one was the registration artefact. A real exit — one that follows
an enter — is kept, because it is half of a dwell and `stampRules` needs it.

**Confirmed on the phone itself.** Before: `geofence exit camacha`, `geofence exit
ponta-do-garajau-main`, `geofence exit praia-dos-reis-magos`, all at 11:16:27. After:
`watching 74, 0 out of range` and **no exit rows at all**.

⚠ **The FOREIGN KEY error had a different cause than it looked.** `deleteAllUserData` deletes
every `trip` row and ran **outside the recorder's serial queue** — a batch holding a trip id
inserted against it the moment the delete committed. A transaction stops a half-delete; it does
not stop that. The queue is shared now (`storage/recordingQueue.ts`).

---

## 2026-09-22 (later) — ⚠⚠ The recorder was dead, and the app said it was recording

**Found while setting up the T-051 soak test, which it was silently blocking.** The soak would
have run for 72 hours and returned nothing, with no explanation.

Four observations, all at once, on the P30 with the switch **on** and the settings screen saying
*"A registar a sua viagem"*:

- `dumpsys activity services com.proa.madeira` — **no foreground service**
- `dumpsys location` — **no request** from the package
- `madeira.db-wal` mtime **frozen for minutes** while the app was backgrounded
- last real fix in the database: **2026-08-28**, the same day as T-173's error

**The mechanism.** `isRecording()` is `Location.hasStartedLocationUpdatesAsync`, which reports
that the **task is registered** — a flag that outlives the service it stands for.
`syncRecordingWithPreferences` asked it first and returned early, so once the service died (an OEM
kill, or T-173's foreground-service refusal firing *after* the task was registered) **the recorder
was never restarted again for the life of the install.**

⚠ **The app reported itself healthy while recording nothing.** That is worse than failing loudly,
and only a manual off-and-on in Settings recovered it — which no user would think to do. Nothing
would have told them except T-049's day-1 check, which fires once.

**Proved both ways on the device.** Toggling off and on produced `LocationTaskService
isForeground=true` and a live `ACCURACY_FINE gps requested=+10s0ms` request where there had been
nothing. After the fix, a force-stop followed by a relaunch brings both back **by itself** —
which is exactly what the old code could not do.

⚠ **This is the third time this project has shipped a subsystem nothing called** (T-145, T-167,
now T-174), and the first where the app actively asserted the opposite. The pattern is worth
naming: **a flag that means "we asked for X" is not evidence that X is happening**, and every
place the app reports its own health from one is suspect.

## 2026-09-22 (evening) — The WAL was 27 MB, over the auto-backup cap (T-178)

`madeira.db` 684 KB, `madeira.db-wal` **27 MB**. Auto-backup takes the whole `SQLite/` folder and
has historically capped app data around 25 MB — past it the *entire* backup can fail silently,
which defeats ARCHITECTURE §4a. Read from the WAL's frame headers and the `-shm` index, on a
scratch copy and then on the live phone:

- **Only 615 of 6,560 frames were live.** Five generations by salt; today's reset normally at
  ~1,000 frames (four resets in a few hours). SQLite resets the log but **never shrinks the file**
  without `journal_size_limit` or a `TRUNCATE` checkpoint, and Android never closes cleanly. The
  file was the high-water mark, not the current state.
- **One generation ran 22 → 28 Aug 12:41 with no completed checkpoint** — ≥6,560 frames, ≥1,900
  commits of median 3 frames. It ends when T-174's recorder died. Mechanism reproduced off-device
  (SQLite 3.50): **one stepped-but-unfinalised statement on the same connection** makes every
  checkpoint fail with *"database table is locked"*; 3,000 commits gave a 48 MB WAL. That week's
  diary has two *"getFirstAsync: released object, repeated once"* lines (T-142) — a race that
  rejects `finalizeAsync` would leak exactly that. ⚠ **Inferred, not observed.**

**Fixed:** `journal_size_limit = 1 MiB`, a `PASSIVE`+`TRUNCATE` checkpoint at every open, at trip
end, and after erase-all's `VACUUM`. Replayed on a copy of the live files: **27 MB → 0 bytes, all
836 fixes and 3,660 diary rows intact, `integrity_check` ok.** ⚠ **Not yet run on the phone.**

⚠ **Erase-all was not erasing.** Dead WAL frames hold old page versions, so after erase-all and
`VACUUM` the deleted history sat on in the `-wal` file — six days of August, in the P30's case.
The truncate is what makes *"delete my data"* true on disk.

⚠ **What is not fixed:** a pinned connection refuses every checkpoint, so the WAL still grows until
the process dies, and auto-backup kills the process and copies the files *before* the next open
can truncate them. The app now writes a `wal_checkpoint` diary line when that happens, instead of
it taking a phone plugged in by accident to find.

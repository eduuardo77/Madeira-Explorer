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

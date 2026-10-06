# Bruma: Score and Plan, 2026-10-06

One document with everything: **Part 1** is the third review, the detailed score against a high
standard (WalkNYC as the "polished shipped app" line). **Part 2** is the execution plan, the order of
work to exceed it. Both parts are also kept as separate files (`docs/app-review-2026-10-06.md`,
`docs/execution-plan-2026-10.md`); this file is the two joined, word for word.

## At a glance

- **Score today:** **9.1 / 20** on the strict rubric (was 6.7 on 24 Sep). WalkNYC ≈ 14.
- **Target:** **15 / 20 or more**, every area at 13 or more.
- **Order:** 1 fix what users notice, 2 prove the core outdoors, 3 home and depth, 4 compliance and
  the store, 5 release verification, 6 launch.
- **Decisions for the project lead first:** one Portuguese voice (tu or você), the battery
  permission (keep or drop), who the privacy policy names.

---

# Part 1: The score

## Bruma: Third Review, against a high standard

**Date:** 2026-10-06, 19:05 to 19:15
**Build reviewed:** `com.proa.madeira` 0.1.0, version code 3, field build (store flavour, debuggable,
upload key), installed 2026-10-06 17:03, source `9b8eab1`. ⚠ Debuggable: ART runs it a little
slower than a store build, so the performance numbers are slightly pessimistic.
**Device:** Huawei P30 (ELE-L29), Android 10, EMUI, `pt-PT`, the project lead's real data (31
trips, 3 stamps, 6,8 km of road lit today).
**Previous reviews:** [`2026-09-22`](app-review-2026-09-22.md) 7/20, [`2026-09-24`](app-review-2026-09-24.md)
8/20 original, 6.7/20 strict.
**Nothing was changed.** Screens were opened and the map panned; nothing that records, erases, ends
a trip or starts an outing was pressed. One force-stop, for a cold start.

---

### Verdict

| Rubric | 24 Sep | **Today** | WalkNYC |
|---|---:|---:|---:|
| **Strict: "a polished shipped app"** (§3) | 6.7 | **9.1 / 20** | ≈ 14 (indicative) |
| Original (22 Sep method and weights, for continuity, T-208) | 8 | **9.5 ≈ 10 / 20** | n/a |

**Better, clearly. Still not a shippable beta, and not publishable.** The jump is real and comes
from the right place: the core now works outdoors. Roads light up where you went (96% within 10 m of
an iPhone ground truth), stamps are earned on a real phone, the recorder changes profile from the
background, and buying works end to end. First run, the paywall, the celebration and the trophy are
the most finished screens in the app.

**What holds it under 10:**
- the core has never run a whole trip to its end;
- performance went backwards (6,3% janky frames, from 0,7%);
- the replay opens on West Africa;
- the launcher icon is still Expo's template;
- the store and legal side is where it was two weeks ago.

**At 9.1 it sits at the top of "prototype", one point from "shippable beta" (10 to 13).** The next
points are cheap: six fixes worth about 2 points are desk work of a few days (§6).

---

### 1. Method

The strict rubric of 24 Sep, unchanged, so the numbers compare: eight areas, each scored /20 against
anchors where **WalkNYC is the "good shipped app" line (14 to 17)**. Every claim was checked on the
P30 or in the code today, not taken from `TASKS.md`. The same pan-and-zoom workload as last time
(9 pans, 2 double-tap zooms). WalkNYC was not re-measured; its scores are carried from 24 Sep.

**Not done:** onboarding on the device today (it was seen end to end on the P30 yesterday, T-250),
German on screen, a TalkBack read-through, font scaling, outdoors, and a store build from Play.

---

### 2. What changed since 24 Sep, verified

| 24 Sep finding | Now | Seen |
|---|---|---|
| P0-1 Expo template icon | ❌ **Still there**: launcher, status bar, every screenshot. `assets/icon.png` unchanged since the first commit | file, screenshots |
| P0-4 core loop unproven | ⚠ **Mostly proven.** 3 stamps earned on the P30; roads lit and measured against ground truth; background profile changes proven. **No trip ended; no souvenir shared; battery unmeasured** | home map, `stamp_award`, D-093 notes |
| P0-5 blank map at start | ⚠ Still unproven (cannot be induced). Today's cold start drew the map | `home.png` |
| P0-6 store paperwork | ❌ Largely unchanged. Upload key and billing now exist; policy contact, hosted URL, Data Safety, T-123 and the listing do not | code, docs |
| N1 home shows no progress | ⚠ Partly. The status line shows *"A registar automaticamente · 6,8 km hoje"*, and the lit roads are themselves progress. Still no *3 / 80* on the home | `home.png` |
| N2 no trip history | ⚠ The replay now plays without a stamp (T-217). **Still no list of trips** | passport |
| N3 place card thin | ⚠ The stamp art is on the card now (T-218). Still no why-go (0 of 80), no directions, and a layout fault (§4, F2) | `card.png` |
| N4 a11y | ✅ Fixed in code (T-215); the smoke test reads `checked` | smoke test |
| N5 licences | ✅ 286 packages, JavaScript and native, from what ships (T-221) | code |
| N6 privacy policy truthful | ✅ The absolute claims are gone (T-216). ❌ **No controller or contact** (`CONTACT_EMAIL = null`), and nothing about purchases | `privacyPolicy.ts:108` |
| N7 four control styles | ❌ Unchanged (T-220 open) | `home.png` |
| N8 map lost in the ocean | ✅ Zoom floor and *Centrar* (T-223) | code |
| N9 memory 1,5× WalkNYC | ❌ Unchanged: 326 MB after the workload | `meminfo` |
| N10 rows hide that they scroll | ✅ Part of the fourth stamp shows | passport |
| N11 nothing taps every screen | ✅ `smoke-release.mjs` (T-222). ⚠ It cannot pass the animated pop-ups | ran today |
| P1-3 onboarding | ✅ **Redrawn and seen on the P30** (T-250): one card per ask, Android's own words | yesterday |
| (new) monetisation | ✅ Real purchase, acknowledged, refunded; paywall redesigned; founder stamp; medals | 5 and 6 Oct |

---

### 3. The strict rubric

| Area | Weight | 24 Sep | **Today** | WalkNYC |
|---|---:|---:|---:|---:|
| A. Core promise proven in the field | 20% | 4 | **9** | 16 |
| B. First run and home: do I get it in 10 s? | 15% | 7 | **10** | 13 |
| C. Craft: visual consistency, brand, detail | 15% | 6 | **8** | 13 |
| D. Reliability and performance | 15% | 10 | **10** | 16 |
| E. Store, legal and privacy readiness | 10% | 5 | **6** | 15 |
| F. Accessibility and localisation | 10% | 11 | **11** | 9 |
| G. Depth: history, stats, content | 10% | 7 | **9** | 14 |
| H. Business model working | 5% | 3 | **10** | n/a |
| **Weighted** | | **6.7** | **9.1** | **≈ 14.0** |

Working: 1.8 + 1.5 + 1.2 + 1.5 + 0.6 + 1.1 + 0.9 + 0.5 = **9.10**.

**Original rubric** (22 Sep weights): core loop 9 (20%), clarity 10 (15%), store 6 (15%),
monetisation 10 (10%), engineering 14 (10%), performance 10 (10%), polish 8 (10%), l10n/a11y 11
(10%) = 1.8 + 1.5 + 0.9 + 1.0 + 1.4 + 1.0 + 0.8 + 1.1 = **9.5, rounded 10** (was 8).

#### Why each score

**A, 9 (was 4).** The biggest move, and earned.

What is now proven on the P30:
- roads lit where the lead went, 96% within 10 m of an iPhone running SensorLogger, median 1,8 m;
- three stamps earned on real visits;
- the recorder changing profile from the background (*stationary to driving*, zero errors);
- the stamp pop-up;
- a real day lit today (`home.png`).

Why not higher:
- **no trip has ever ended**, so the souvenir has never been made from a real trip;
- battery, overnight survival and GPS under canopy are unmeasured;
- every matching threshold still says NOT TUNED;
- the replay was seen at its end state today but opens badly (D2).

A shippable beta needs one trip, start to end, with a battery figure.

**B, 10 (was 7).** First run is now the best onboarding I could ask of this app: one card per
ask, Android's own button names drawn in advance, matched word for word on the device. The home now
shows your roads lit and a live status line. Against:
- the home still gives no sense of the 80: the only hint is the passport button, which shows one
  stamp;
- the first impression of the home is a Google map with Google's own pins (*Monte Palace Madeira*)
  as loud as anything Bruma draws.

**C, 8 (was 6).** The newest screens are genuinely good: the stamp art, the trophy, the medals with
each municipality's outline, the celebration, the paywall. The rest has not caught up:
- the **template icon** (the first thing a store visitor sees);
- **Portuguese in two voices**: first run and the paywall say *tu*, the passport, Settings and the
  notices say *você* (*Ver a sua viagem*, *O Bruma está a registar por onde andou*);
- a **light place card over the dark album**, with *Santana* orphaned under the stamp (F2);
- **four control styles on the home** (white circle, stamp, white pill, grey bar, green bar);
- **the replay opening blank, then on Côte d'Ivoire** (D2), and its end card framing the island in
  the top half over empty sea;
- the trophy's band of light is subtle enough that most people will not notice it.

**D, 10 (unchanged).** Gains:
- 1045 tests, `tsc` clean;
- a release smoke test that taps every screen;
- the recorder restarting after an update and on open;
- the stationary profile now reachable.

Losses, measured today:
- **6,3% janky frames, p90 13 ms, p99 32 ms** on the workload that gave 0,7%, 11 and 15 ms on 24 Sep.
  The likeliest cause is the hundreds of matched road segments drawn since D-093; that is a
  suspicion, not a measurement;
- **cold start 1 436 ms** after a force-stop. Not comparable with 24 Sep's 166 to 255 ms, which
  were very likely warm starts; WalkNYC's cold start was 760 to 813 ms;
- **326 MB** after the workload (WalkNYC 208);
- T-177 unproven, T-196 and T-197 open;
- the smoke test cannot pass the pop-ups.

**E, 6 (was 5).** Gains: an upload key, a working store build on internal testing, billing,
honest permission texts. Still blocking a listing:
- **no controller or contact in the policy** (GDPR Art. 13);
- **no hosted policy URL**;
- **the policy says nothing about purchases**;
- **the Data Safety draft predates** physical activity, per-stamp notifications and the battery
  permission, and still carries its August *rewrite required* banner;
- **T-123** (background-location review) not started;
- **`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`**, a Play-reviewed permission, unjustified anywhere;
- **the listing text still describes Proa.**

**F, 11 (unchanged).** T-215 fixed the language rows; three languages throughout; first run's
replicas match Android 10 word for word on the P30 (Android 11 and later were read from the
system image, not seen on a phone). Against:
- German still unread by a native speaker;
- no TalkBack read-through ever done;
- the *tu*/*você* split is also a localisation defect.

**G, 9 (was 7).** Depth arrived: the passport with medals and a founder stamp, the trophy with its
set and the next stamp, the replay without a stamp, backup and restore to a file, *km hoje*.
Missing against WalkNYC:
- a **list of trips** (WalkNYC's *Show Walks*);
- any stats beyond km today;
- **why go** on any of the 80 places (0 of 80);
- directions to a place.

**H, 10 (was 3).** Billing works end to end on a real purchase (bought, acknowledged, refunded),
the paywall was redesigned and asks at the right moments, and the paid tier now has things in it.
Not higher: the 18-row purchase matrix is 2 rows done; nothing has sold to a stranger.

---

### 4. New findings this round

| # | Finding | Evidence | Severity |
|---|---|---|---|
| D1 | **Performance regressed**: janky frames 6,3% (was 0,7%), p99 32 ms (was 15) on the same workload | `gfxinfo` | **P1** |
| D2 | **The replay opens blank, then on Côte d'Ivoire** (the map's 0°, 0° default) for several seconds before flying to Madeira; its end card puts the island in the top half over empty sea | `replay1-4.png` | **P1** |
| F1 | **Portuguese in two voices**: *tu* in first run and the paywall, *você* elsewhere | screens, `strings.ts` | **P1** (craft) |
| F2 | Place card: *Santana* sits alone under the stamp, not with the name; light card on the dark album | `card.png` | P2 |
| E1 | **Compliance surface grew, paperwork did not**: activity, per-stamp notifications, battery permission, purchases are in no store document | docs | **P1** (blocker) |
| E2 | **`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`** ships with no Play justification; a rejection risk | manifest | **P1** |
| D3 | Cold start 1,4 s after a force-stop, slower than WalkNYC's teardown figure | `am start -W` | P2 |
| C1 | WalkNYC is still installed and tracking on the P30, and EMUI flags it for battery drain. **Bruma is not flagged.** A small favourable sign, not a measurement | notification shade | info |
| C2 | The phone has under 10% storage free. It does not affect this review, but low storage can make Android stop background apps | notification shade | info |

---

### 5. MVP and publishing

**MVP: nearly.** The loop *go somewhere, stamp, lit roads* now happens on a real phone. Missing for
an MVP: **one trip to its end** with the souvenir made and shared, and a battery figure.

**Publishable: no.** Beyond the MVP:
- the icon;
- the policy's controller, contact and hosting;
- a Data Safety form that matches the app;
- the background-location review;
- a decision on the battery permission;
- a listing;
- the 18-row purchase check.

---

### 6. To reach a shippable beta (10+), in order

| # | Do | Moves | Who | Size |
|---|---|---|---|---|
| 1 | **One trip to its end**, with the souvenir shared and a battery reading (T-205, T-054) | A +2 to 3 | Lead outdoors, me to read it | days, calendar |
| 2 | **Replay starts on the trip**, not at 0°, 0°; end card frames the trip, not the sea (D2) | C, D | Me | hours |
| 3 | **Find the jank** (D1): measure with and without the lit roads, then simplify or cull what is drawn | D +1 | Me | a day |
| 4 | **One Portuguese voice** (F1): pick *tu* or *você*, apply to every string | C, F | Lead decides, me | hours |
| 5 | **The icon** (T-188), from the stamp art (D-086) | C +1, E | Me drafts, lead picks | a day |
| 6 | **Compliance pass** (E1, E2): policy with controller, contact and purchases; Data Safety redone; battery permission justified or dropped; host the policy (T-206) | E +3 | Me drafts, lead answers and sets up email | days |
| 7 | **Why-go lines** (T-201) and the place card fault (F2) | G, C | Lead vetoes, me | hours |
| 8 | **A list of trips** | G +1 | Me | a day |

Items 2 to 5 and 7 are desk work worth about 2 points together. Item 1 is worth as much alone, and
only the project lead can do it.

---

### 7. Appendix: raw evidence

- **Cold start** after one force-stop: `TotalTime 1436 ms` (`am start -W`). The foreground service
  was back afterwards (`ServiceRecord` count 1).
- **Workload** (9 pans, 2 double-taps): 351 frames, 22 janky (6,27%), p50 8 ms, p90 13, p95 20,
  p99 32. Memory before 265 MB, after 326 MB.
- **Tests:** 1045 pass, `tsc` clean.
- **Notifications present:** Bruma's recording service (*"O Bruma está a registar por onde
  andou"*); one Bruma `trip-messages` notification whose text the dump did not show; EMUI's
  battery warning about WalkNYC; low storage.
- **Screenshots** (scratchpad, not committed): `home.png`, `replay1.png` to `replay4.png`,
  `card.png`.

---

# Part 2: The order of work

## Bruma: Execution Plan to Exceed WalkNYC

**Written:** 2026-10-06, from the third review ([`app-review-2026-10-06.md`](app-review-2026-10-06.md),
**9.1 / 20** strict). **Approved scope:** the project lead's instruction, *"exceed WalkNYC, high
standards"*.
**Supersedes, as the order of work:** the release plan at the top of `TASKS.md` and phases 6 and 7
of `docs/monetization-execution-plan.md`. Their tasks are not cancelled; this plan says when each one
happens and what it now has to include.

---

### 0. How to use this document (read first in a new session)

1. Read `HANDOFF.md` (its top section) and `CLAUDE.md`. They hold the working rules and the traps.
2. Work **in the order of §4**, one task at a time. Each task lists its goal, scope, acceptance
   criteria and evidence. **A task is done only when every acceptance line is met and recorded.**
3. Each task gets an entry in `TASKS.md` when it starts (the IDs below are reserved), and a commit
   whose subject starts with its ID.
4. The three decisions in §3 are the project lead's. Ask them at the start of the session; most
   tasks do not depend on them, but four do.
5. After each phase, run the phase's **gate** (§5). Do not start the next phase with a gate failing.

**The definition of done for every task** (unchanged from the release plan):
- **(a)** the change;
- **(b)** a test that fails if the change is reverted, for anything with logic;
- **(c)** evidence on the P30 (`uiautomator dump`, `dumpsys`, `sqlite3` or one screenshot when
  the question is visual) for anything a user can see;
- **(d)** the docs updated in the same commit (CONTEXT §9).

---

### 1. The target

**Exceed WalkNYC on the strict rubric: 15 / 20 or more** (WalkNYC ≈ 14, indicative). Today 9.1.

| Area | Weight | Today | Target | WalkNYC | How this plan gets there |
|---|---:|---:|---:|---:|---|
| A. Core promise proven in the field | 20% | 9 | **16** | 16 | Phase 2: full trips, battery, tuning, update survival |
| B. First run and home | 15% | 10 | **15** | 13 | Phase 3: progress and targets on the home, one control language |
| C. Craft | 15% | 8 | **15** | 13 | Phase 1 and 3: icon, one voice, replay, place card, visual pass |
| D. Reliability and performance | 15% | 10 | **15** | 16 | Phase 1: jank, cold start, memory; Phase 5: release verification |
| E. Store, legal, privacy | 10% | 6 | **15** | 15 | Phase 4: compliance pass, hosting, reviews, listing |
| F. Accessibility and languages | 10% | 11 | **15** | 9 | Phase 3 and 4: one voice, TalkBack pass, German read |
| G. Depth | 10% | 9 | **15** | 14 | Phase 3: trip list, stats, why-go, directions |
| H. Business model | 5% | 10 | **14** | n/a | Phase 5: purchase matrix, founder window at launch |
| **Weighted** | | **9.1** | **≈ 15.1** | **≈ 14.0** | |

Where Bruma already wins and must keep winning: languages (three, real Portuguese), privacy (no
account, no server), meaning (80 places worth going to, not 86 638 blocks), download size, Google
attribution kept visible. **Nothing in this plan may trade any of these away.**

---

### 2. Principles for this plan

1. **The lit roads are the product** (core value). A defect in recording or drawing outranks any
   feature.
2. **Measure, never guess** (D-041). No number in the app, the store or a document that was not
   measured. Battery stays `null` until T-054 measures it.
3. **Less is better** (the project lead, 2026-10-06). Remove before adding; one way to do a thing.
4. **Judge visuals by eye, on the phone.** Draw options for the lead where taste decides
   (`tools/preview-*.mjs` is the pattern), then build the chosen one, then check it on the P30.
5. **The P30 is the lead's field phone.** Ask whether they have been out with it before any probe
   or restore; back up immediately before any database swap; close pop-ups with the Back key.
6. **No dashes** in anything a user reads, or in replies to the lead.

---

### 3. Decisions the project lead makes (ask at the start)

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| L1 | **One Portuguese voice:** *tu* or *você*. First run and the paywall use *tu*, everything else *você*. | **tu**: warmer, matches the newest and best screens, and the lead wrote the paywall in it. German stays *Sie*, English is neutral. | T-255 |
| L2 | **The battery permission** (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`): keep the one-tap dialog and justify it to Google, or drop it and open the settings list. | **Keep and justify** if Google's current policy lists location tracking as acceptable; otherwise drop. Decided in T-266 from Google's own text, not memory. | T-266 |
| L3 | **The privacy controller and contact:** who is named, and which address on `bruma.lol`. | The lead by name (or a business name if one exists), `privacy@bruma.lol` forwarding to Gmail, tested. | T-265, T-267 |

Already answered, do not ask again: the medal titles (content, lead edits), shine only (no tilt),
the free tier (D-089), first run (T-250), the founder stamp art (gold postmark).

---

### 4. The work, in order

Sizes are rough: **S** under half a day, **M** one to two days, **L** several days.
**Who:** *Me* = the implementing session; *Lead* = the project lead.

#### Phase 1: Fix what a user notices first (desk, about a week)

##### T-253 The replay starts on the trip, and ends framed on it (review D2) · M · Me
- **Problem:** the replay opens blank, then shows Côte d'Ivoire (the map's 0°, 0° default) for
  several seconds before reaching Madeira. Its end card frames the island in the top half over
  empty sea.
- **Scope:** the replay's initial camera is the trip's first frame, set before the map is shown
  (not animated to it); nothing is visible until the map is positioned and tiles requested; the end
  card frames the trip's bounds in the space above the caption.
- **Acceptance:**
  - three captures at 0,5 s, 3 s and the end on the P30 show Madeira in every one, never another
    place, never blank for more than one frame;
  - the end card's lit roads fill at least 60% of the map area;
  - a pure test pins the initial camera to the first frame.
- **Files to start from:** `app/src/souvenir/` (the replay screen and `frame.ts`), the map component
  it uses.

##### T-254 Find and remove the jank (review D1) · M · Me
- **Problem:** the same pan-and-zoom workload gives 6,3% janky frames, p99 32 ms (was 0,7% and
  15 ms on 24 Sep). Suspected cause: the hundreds of matched road segments drawn since D-093.
- **Scope:**
  1. Measure first, with the same workload (9 pans, 2 double-tap zooms, `dumpsys gfxinfo reset`
     before), in three conditions: as is, with the lit roads hidden, and with them merged into the
     fewest polylines.
  2. Write the numbers into the task.
  3. Fix the measured cause. Likely candidates: merge connected segments into long polylines;
     draw by zoom level (simplified geometry when zoomed out); avoid re-creating polyline objects on
     each render.
- **Acceptance:**
  - on a **store build** (not the debuggable field build): janky frames ≤ 1%, p99 ≤ 16 ms on the
    workload, with today's real data;
  - memory after the workload ≤ 280 MB;
  - the numbers before and after are in the task.
- **Also measure:** cold start after one force-stop (`am start -W`), three runs, median. Target
  **under 800 ms** (WalkNYC's cold start was 760 to 813 ms). If above, profile what runs before the
  first frame (database open, content parse, map init) and defer what can wait.

##### T-255 One Portuguese voice (review F1) · S · Me ⇠ L1
- **Scope:** every Portuguese string in `app/src/i18n/strings.ts`, the privacy policy's Portuguese,
  and the notifications, in the chosen voice. English and German unchanged.
- **Acceptance:**
  - a test fails if a Portuguese string uses the other voice's markers (for *tu*: *o seu*, *a
    sua*, *seus*, *suas*, *você*, the *-e/-a* imperatives such as *carregue*, *abra*; keep an
    exception list for genuine uses);
  - the smoke test and a passport, Settings and notification read on the P30 show one voice;
  - the lead reads the changed Portuguese before the commit (OQ-8 rule).

##### T-256 The place card, finished (review F2, N3) · S · Me
- **Scope:**
  - the municipality on the same line as the category or under the name, never alone under
    the stamp;
  - the distance back (*a 13 km, em linha reta*);
  - a **Directions** button handing off to Google Maps (an `https://www.google.com/maps/dir/?api=1&destination=lat,lon`
    link opened with `Linking`; no new dependency);
  - the why-go line when T-201 fills it;
  - the card's colours checked against the dark album: either dark to match, or the lead
    confirms the white card (T-218 chose white; confirm it still holds next to the trophy).
- **Acceptance:** a screenshot of an unvisited place's card on the P30; Directions opens Google Maps
  at the place; `accessibility.test.ts` passes.

##### T-257 The icon, from the stamp art (T-188, D-086) · M · Me drafts, Lead picks
- **Scope:** launcher icon, Android adaptive icon (foreground, background, monochrome), splash,
  and the notification small icon (white silhouette, Android's rule), all from one pure module
  with a preview renderer, like the stamps.
- **Process:** draw three options on `tools/out/icon-options.html` at real sizes (48, 72, 192 px,
  the Play 512 px, in a launcher mock with neighbouring icons, on light and dark wallpapers). The
  lead picks. Then build.
- **Acceptance:**
  - no Expo template asset remains (`grep` the build for the template's checksum: `cb975bba2216`
    for `icon.png`);
  - the P30 launcher and the status bar show the new icon (one screenshot);
  - the notification icon reads as a silhouette, not a white square.

##### Gate P1
Re-measure D (performance) and look at the replay, the place card and the icon on the P30. Expected
strict score: about **11** (C and D up, nothing else needed).

---

#### Phase 2: Prove the core (field, in parallel with Phase 1 and 3)

The lead's outdoor work. Each item names what the implementing session prepares and reads.

##### T-246 The tuning outing (exists) · Lead outdoors, Me tunes
- A town walk as an outing, a day on automatic recording, a drive through a VR1 tunnel.
- **Me:** pull the database (`run-as`), run `node tools/eval-matching.mjs --db <copy>`, tune the
  thresholds in `mapMatch.ts` and `motionGate.ts` that the data supports, replace each NOT TUNED
  note with the measured basis.
- **Acceptance:** every threshold either tuned with a cited trace or explicitly left with a reason;
  the SensorLogger comparison (`tools/compare-sensorlogger.mjs`) on one walk stays ≥ 95% within 10 m.

##### T-205 One complete trip (exists, OD-10) · Lead, Me reads
- At least three days, three or more of the 80 places, ended by *Terminar viagem* or the airport.
- **Evidence:** stamps in the database; the stamp notification seen; the trip-end notification; the
  souvenir made, watched and shared once (to the lead's own chat is fine); one screenshot of each.

##### T-054 Battery, measured (exists) · Lead carries, Me reads
- A 12-hour day on automatic recording with normal phone use, the P30 charged to 100% at the start,
  `dumpsys batterystats` reset at the start and pulled at the end.
- **Acceptance:** Bruma's share in mAh and % from `batterystats`, written into the task, and then
  into `MEASURED_BATTERY_PERCENT_PER_DAY` (`permissionPolicy.ts`), which makes the battery sentence
  appear in first run (D-041). Overnight survival recorded in the same run.

##### T-258 An update must not stop the recorder (T-210 follow-up) · M · Me
- **Problem:** EMUI withheld `MY_PACKAGE_REPLACED`, so after an update the recorder stays off until
  the app is opened. A Play auto-update mid-holiday would stop recording silently.
- **Scope:** measure first on the P30 with EMUI's app-launch setting for Bruma on *manual* (all three
  switches on), then on *automatic*. If the broadcast still does not arrive, add the two cheap
  defences:
  - the day-after check notification (T-049) already catches a stopped recorder: verify it fires
    after an update;
  - first run's battery card and Settings name EMUI's app-launch setting where the phone is Huawei
    (manufacturer check, no new permission).
- **Acceptance:** an `install -r` with the app closed, then `dumpsys activity services` a minute
  later, recorded for both EMUI settings; the user-facing guidance seen on the P30.

##### T-259 The blank map at startup, proven or reopened (T-177) · S · Me
- Count cold and pre-started launches over the week of T-205 from `logcat` and the diary; T-177's
  fix holds if none is blank. Close T-177 with the count, or reopen with the evidence.

##### Gate P2
A completed trip with its evidence, a battery figure, tuned thresholds. Expected strict score: about
**13** (A to 15 or 16).

---

#### Phase 3: Exceed WalkNYC on the home and in depth (desk, about two weeks)

##### T-260 The home shows where you stand among the 80 (review N1, D-090) · M · Me, Lead picks
- **Problem:** the home shows the lit roads and *km hoje*, but nothing of the 80 places.
- **Scope:** draw three options (`tools/preview-home-options.mjs`): for example the status line gaining
  *3 / 80 lugares*, the nearest uncollected place as a quiet chip with its distance, or a progress
  ring on the passport button. The lead picks one. Keep the map's roads the loudest thing (core
  value), and Google's own pins quieter than Bruma's (map style).
- **Acceptance:** chosen option on the P30, readable outdoors (contrast test), the 60 dp targets kept.

##### T-220 One control language on the map (exists, review N7) · M · Me, Lead picks
- Options already drawn in `tools/out/screen-options.html`. Re-present them with the T-260 choice in
  place, build the pick.

##### T-261 A list of trips, each watchable (review G) · M · Me
- WalkNYC's *Show Walks*, done Bruma's way.
- **Scope:** a *Viagens* entry in the passport listing every trip (dates, places stamped, km lit),
  newest first; tap to watch its replay and share its souvenir.
- **Acceptance:** the lead's 31 trips listed on the P30; two replays opened from it; a pure test for
  the list's order and totals.

##### T-262 Stats that mean something · S · Me
- **Scope:** on the passport: km lit in total and this trip, days recorded, places this trip, sets
  under way. Only figures the database holds exactly; nothing estimated.
- **Acceptance:** each figure checked against `sqlite3` on the P30 copy.

##### T-201 Why go, for all 80 (exists) · Lead vetoes, Me writes
- `docs/why-go-draft.md` has 80 English lines. Lead vetoes; Me translates to PT (in the L1 voice)
  and DE; into `pois.json`; `validate-content.mjs` reports 80 of 80.

##### T-263 A visual pass with the lead's eye · M · Me prepares, Lead judges
- One page (`tools/out/visual-pass.html`) with a capture of every screen from the P30, side by side
  with WalkNYC's equivalent where one exists. The lead marks what grates; each mark becomes a small
  fix in this task. Include the trophy's sheen (is it visible enough), the light and dark surfaces,
  type sizes, and the empty states.

##### Gate P3
Expected strict score: about **14 to 15** (B, C, G up).

---

#### Phase 4: Compliance and the store (desk plus the lead's accounts, about a week)

Replaces monetisation-plan Phase 6, broadened to everything the app now does.

##### T-264 Inventory: what the app collects, holds and sends · S · Me
- One table in `docs/store-privacy-answers.md`, built from the release manifest (`aapt2 dump`), the
  code and a packet capture:
  - every permission and why;
  - every data type held on the phone;
  - everything that leaves it (Google map tiles, Google Play Billing, Google's fused location
    provider, the D-069 walk donation if used);
  - every third-party SDK's own collection.
- Remove the August *rewrite required* banner only when the table replaces what it warned about.
- **Acceptance:** every row sourced (file and line, or capture); the packet capture over a launch, a
  map pan and a purchase screen shows only Google hosts (T-117b, T-127 restated).

##### T-265 The privacy policy, complete · S · Me ⇠ L3
- **Scope:**
  - controller and contact named;
  - a purchases paragraph (Google Play handles payment; the app keeps the purchase time on the
    phone; no third party);
  - physical activity;
  - per-stamp notifications;
  - all three languages, the L1 voice;
  - `docs/privacy-policy.md` regenerated.
- **Acceptance:** `privacyPolicy.test.ts` extended for each new paragraph; no absolute claim (D-073);
  the lead reads the Portuguese.

##### T-266 The battery permission, decided (review E2) · S · Me ⇠ L2
- Read Google Play's current policy text for `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` and quote it
  in the task. Either write the justification for the Play declaration, or remove the module and
  fall back to the settings list (one module, D-045's original design).
- **Acceptance:** the decision recorded in D-045 with the quoted policy; the manifest matches it
  (`aapt2 dump permissions`).

##### T-267 Host the policy and the contact (T-206) · S · Lead sets up, Me publishes
- Lead: the address on `bruma.lol`, tested by sending to it from another account.
- Me: publish the generated policy at `https://bruma.lol/privacy` (the `site/` folder exists,
  T-241), set `CONTACT_EMAIL`.
- **Acceptance:** the URL loads; the in-app policy and the hosted one show the same version date.

##### T-268 The Data Safety form, redone (T-122) · S · Me drafts, Lead answers and submits
- From T-264's table. The two calls waiting since September (shared or not under the
  service-provider exception; deletion) put to the lead with Google's current help text quoted.
- **Acceptance:** the filled answers recorded in the document, each with its source; the lead
  submits in Play Console.

##### T-123 The background-location review (exists) · Me prepares, Lead submits
- **Me:** the written justification (the core feature, why foreground-only cannot do it, the
  disclosure shown in first run since T-250), and a 30 s screen recording script: first run's
  *Permitir sempre* card, the system dialog, then a day's lit roads with the app closed.
- **Lead:** records the video on the P30 (or Me records via `adb shell screenrecord`) and submits.
- **Acceptance:** submitted; the review's answer recorded.

##### T-269 The store listing (T-133) · M · Me drafts, Lead approves
- **Scope:**
  - title, short and full description in three languages, rewritten for Bruma and the stamps
    first (the marketing plan's §3 and §4 still describe Proa);
  - "one payment" without a price (OQ-6);
  - the founder line only during its window, with its removal date written into TASKS;
  - 6 to 8 screenshots per language from the P30 (home with lit roads, passport, a trophy, a
    medal, the replay end card, first run);
  - the feature graphic;
  - the 512 px icon from T-257.
- **Acceptance:** the lead approves the Portuguese; Play Console's listing preview has no warnings.

##### T-160a German, read by a native speaker (exists) · Lead finds the reader
- Every German string and the listing. Corrections applied; a test still forbids dashes.

##### Gate P4
Expected strict score: **15 or more** (E to 15).

---

#### Phase 5: Release verification (one internal build, about three days)

##### T-270 The smoke test passes the animated screens · S · Me
- `tools/smoke-release.mjs` cannot read screens whose animation never stops (the celebration, the
  sheet). Close them with the Back key (`keyevent 4`) and verify by screenshot hash rather than
  `uiautomator`; add steps for the trophy, the medal shelf and a locked medal's sheet.
- **Acceptance:** the script passes on the P30 with a probe that shows a pop-up.

##### T-239 The purchase matrix, updated (exists) · Lead with test cards, Me reads
- **Update the matrix first:**
  - remove V17 (tilt);
  - add a medal completing on a free passport;
  - add a locked medal opening the sheet;
  - add the medal row in the pop-up;
  - add founder with a temporary window in a probe build.
- Run every row on a Play internal-testing install with a license tester.
- **Acceptance:** each row has evidence or a written reason it was not run.

##### T-207 Pre-launch report (exists)
- Upload the internal build; add Google's re-signing SHA-1 to the Maps key before reading anything.
- **Acceptance:** zero crashes; every accessibility warning fixed or explained; screenshots in all
  three languages look right.

##### T-271 The fourth review · S · Me
- Same rubric and method as `app-review-2026-10-06.md`, on the Play internal build, WalkNYC
  re-measured side by side on the same phone and workload.
- **Acceptance:** **strict score ≥ 15**, every area ≥ 13. If not, the review's own list becomes the
  next work before launch.

---

#### Phase 6: Launch

##### T-137 Submit (exists), with the launch checklist
1. Set `founderWindow.start` in `content/pois.json` to the release date (the smoke test refuses
   otherwise).
2. Remove the debug SHA-1 (`5E:8F:16:...:F6:25`) from the Maps key.
3. Bump `versionCode` in `app/app.json` and `app/android/app/build.gradle`.
4. Build the AAB without the beta flag; verify the upload key, `debuggable false`, the version code.
5. `node tools/smoke-release.mjs` (without `--internal`) passes.
6. Staged rollout at 20%, watching Play's vitals for 48 h before 100%.
7. Write the founder line's removal date (three months on) into TASKS.

---

### 5. Gates and expected scores

| Gate | When | Strict score | Must be true |
|---|---|---:|---|
| P1 | Phase 1 done | ≈ 11 | Replay starts on Madeira; jank ≤ 1%; one voice; new icon |
| P2 | Phase 2 done | ≈ 13 | One complete trip with evidence; a battery figure; thresholds tuned |
| P3 | Phase 3 done | ≈ 14 to 15 | Home shows the 80; trip list; why-go 80/80; visual pass closed |
| P4 | Phase 4 done | ≥ 15 | Policy complete and hosted; Data Safety submitted; T-123 submitted; listing approved |
| Launch | Phase 5 done | ≥ 15, every area ≥ 13 | Purchase matrix done; pre-launch report clean; fourth review passed |

Phases 1, 2 and 3 overlap: Phase 2 is the lead outdoors while Phase 1 and 3 are desk work.

---

### 6. Parked, on purpose

Not before launch, unless the lead says otherwise:
- tilt (T-237, notes on the expo-sensors patch it needs);
- the souvenir video (T-105b);
- import of outside walks (T-164);
- new places beyond 80;
- Porto Santo (D-024);
- new paid features;
- further celebration work.

**Adding to the app before Gate P4 needs a reason tied to the rubric.**

---

### 7. Working notes for the implementing session

- **Commands:** `cd app && npm test` (1045 tests), `npx tsc --noEmit -p .`,
  `node tools/validate-content.mjs`, `node tools/smoke-release.mjs --internal`, the field build in
  `docs/dev-build.md`. Use the repo's `adb` (`tools/android-sdk/platform-tools`).
- **Git Bash traps:**
  - set `MSYS_NO_PATHCONV=1` for `adb` device paths;
  - write edit scripts to the scratchpad with the file tool; heredocs with quotes break;
  - `rm` inside `adb shell sh -c` is refused by a safety check, so issue each `run-as rm` as its
    own command.
- **The P30:**
  - Android 10, EMUI, the lead's real data;
  - back up before any swap (`Madeira-fieldwork/`), restore by checksum, and ask first if the
    lead may have been out;
  - the current build is a debuggable field build, version code 3;
  - the lead prefers the phone to the emulator, which loads the CPU heavily.
- **Animated screens** cannot be read by `uiautomator`; use screenshots and the Back key.
- **Performance** must be measured on a non-debuggable build before it is claimed.
- **Commit:** subject starts with the task ID, body says why and what was found, ends with the
  co-author line in `CLAUDE.md`; push to `origin main`.

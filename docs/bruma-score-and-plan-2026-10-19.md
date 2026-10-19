# Bruma: Score and Plan, 2026-10-19

An interim review, on the same strict rubric as [`bruma-score-and-plan-2026-10-16.md`](bruma-score-and-plan-2026-10-16.md)
and the ones before it, so the numbers compare. **Part 1** is the score, **Part 2** what is left to
reach 15. It is not T-271 (the pre-launch review on a Play build with WalkNYC re-measured): it is a
checkpoint three days and 48 commits after the last one.

## At a glance

- **Score today:** **13.3 / 20** strict (12.9 on 16 Oct, 11.9 on 9 Oct, 9.1 on 6 Oct, 6.7 on
  24 Sep). WalkNYC ≈ 14.
- **Band:** still a **shippable beta** (10 to 13), now just over its top. Not yet publishable, not
  yet above WalkNYC.
- **What moved it:** three carried days now agree on battery (about 2.0, 2.1 and 1.6 points an
  hour); the 17 Oct mode switching faults were fixed and held on 18 Oct (91.4% of the route within
  10 m, in airplane mode); the map pans at 59 to 60 frames a second, measured today, where it ran at
  30 on 16 Oct.
- **What holds it under 15:** the store has not moved in a week (no record that version 9 or 10 is
  on the closed track, so the 14 days have not started); no trip ended on purpose; Huawei's warning
  question still open; memory higher again; one phone.
- **The single most valuable next thing:** upload **version 10** to the closed track and get the
  12 testers opted in. It is the only clock in the plan that cannot be shortened, and it has now
  waited ten days.

---

# Part 1: The score

**Date:** 2026-10-19, 20:16 to 20:30
**Build reviewed:** `com.proa.madeira` 0.1.0, **version code 10, field build** (debuggable),
installed 2026-10-19 20:07, the T-279 work of this evening. Installed ten minutes before the
review, so cold start and memory are pessimistic, as on 16 Oct.
**Device:** Huawei P30 (ELE-L29), Android 10, EMUI, `pt-PT`, the project lead's real data: trip 31
open since 24 Sep, 40,104 fixes, **26 stamps**, *267 km de estradas acesas em 12 dias* on the
passport. On the cable at 100%, 28 °C.
**Nothing was changed.** Read `dumpsys batterystats` first (no trip since the last charge, so
nothing to record from it), copied the database with `run-as cat` (integrity ok) twice, three
force-stops for cold starts, the passport and the trip viewer opened by hand, the pan probe twice
and the zoom probe once, memory after, the release smoke test, the diary read after each step. One
screenshot, of the trip viewer.

## Verdict

| Rubric | 24 Sep | 6 Oct | 9 Oct | 16 Oct | **Today** | WalkNYC |
|---|---:|---:|---:|---:|---:|---:|
| **Strict: "a polished shipped app"** | 6.7 | 9.1 | 11.9 | 12.9 | **13.3 / 20** | ≈ 14 (indicative) |
| Original (22 Sep weights, for continuity) | 8 | 9.5 | 12.1 | 12.9 | **13.2 / 20** | n/a |

**The app got better where it is used, and stood still where it is published.** Three days of
field evidence and a map that finally moves like WalkNYC's are real gains. Against them, nothing
has reached Google since 12 Oct, and the one probe that counted blank maps has been counting the
wrong thing since 18 Oct (N1 below).

## 1. Method

The strict rubric of 24 Sep, unchanged: eight areas, each out of 20 against anchors where WalkNYC
is the "good shipped app" line (14 to 17). Every claim checked today on the P30, in the database
copy, in the code or in the field log's measured entries. Where a figure comes from `HANDOFF.md`
and was not repeated today, it says so. WalkNYC not re-measured; its scores carried from 24 Sep.

**The workload changed.** On 16 Oct the pans were scored with `gfxinfo`, which T-278 showed cannot
see the map's own frames. Today's figure is `tools/measure-map-frames.sh` (the same 9 pans and 2
double-tap zooms, read from what reached the screen) and `tools/measure-map-zoom.sh`. Earlier pan
figures do not compare with today's; the 30 frames a second baseline of 19 Oct morning does.

**Not done today:** first run on the device (last seen end to end 5 Oct); Settings looked at (the
smoke test opened it, nothing more); German on screen; a TalkBack read-through (never done); font
scaling; a store-configuration build (the 650 to 730 ms cold start and 303 to 315 MB are
`HANDOFF.md`'s, not mine); outdoors (the field log's entries stand for it); a Play install; a
purchase; the film of T-279 watched; EMUI's Settings path; the SensorLogger comparisons recomputed.

## 2. What changed since 16 Oct, verified

| Item | Now | Seen today |
|---|---|---|
| Recording, app closed | ✅ 17 Oct 83.1% within 10 m (two mode switching faults), **18 Oct 91.4%**, in airplane mode, with no flip back to still after a wake and walking raised to driving five times | field log; diary: 17 significant-motion wakes since 16 Oct |
| Battery (T-054) | ✅ **Three days:** 2.0 (16 Oct), 2.1 (17 Oct), 1.6 points an hour (18 Oct, airplane mode). The figure stays `null` in the app (D-041) | field log; the test that keeps it `null` passes |
| Huawei's warning | ◐ Came again 17 Oct at 10:41. Not reported on 18 Oct. Whether a day out alone draws it is unanswered | field log |
| Stamps | ✅ **26** (was 12): 10 on 17 Oct, 4 on 18 Oct. 3 missed on 17 Oct, fixed by content (São Vicente seafront, Fanal, an 81st place) | database copy |
| Trip end | ❌ then fixed: **the trip ended at lunch on 18 Oct** (the ferry terminal's circle), repaired by hand; the terminal is no longer a departure point, and the validator refuses a departure circle over a stamp place | diary `trip_end 15:29:42`; `validate-content` |
| Map smoothness (T-278) | ✅ **59.6 and 58.5 frames a second** panning, no gap over 33 ms. Zoom **47.9**, 18 gaps over 33 ms, one of 149 ms | measured today |
| Cold start | ◐ **2.2 s** (2,254, 2,222, 2,234 ms, `COLD`) on a field build ten minutes old: the same as 16 Oct's 2.3 s on a fresh one, which supports the fresh-install reading. `HANDOFF.md` records 650 to 730 ms on a store build | `am start -W` ×3 |
| Memory | ⚠ **420 MB** total after the workload (native heap 169 MB) on the field build, with the passport opened and kept | `meminfo` |
| Map drawn (T-177, T-259) | ⚠ 104 *not drawn* since 18 Oct 17:56, against 1 in the week before. **Reproduced today as a probe fault** (N1); the map drew on all four openings I made | diary |
| Settings, passport speed (T-141, T-254) | ✅ Settings opens and closes in the smoke test; the passport opens with its trip line in place | smoke test, `uiautomator` |
| Chevrons drawn | ◐ Not everywhere: the passport's *‹ Mapa* is still a typed character (N4) | `uiautomator`, `PassportScreen.tsx:781` |
| The day view and the film (T-253, T-279) | ✅ One day per page, *Domingo, 18 de outubro*, 4 stamps, 95 km, 267 km on the trip | screenshot; the film not watched |
| Store | ⚠ **Unchanged.** Version 7 uploaded 12 Oct; no record of 9 being uploaded; **version 10** built 19 Oct 15:34, not uploaded | `HANDOFF.md`, `TASKS.md` T-129 |
| Tests | ✅ **1,156 pass** (was 1,131), `tsc` clean, content valid: 81 places, why-go 81 of 81, 5 warnings | ran today |

## 3. The strict rubric

| Area | Weight | 24 Sep | 6 Oct | 9 Oct | 16 Oct | **Today** | WalkNYC |
|---|---:|---:|---:|---:|---:|---:|---:|
| A. Core promise proven in the field | 20% | 4 | 9 | 11 | 14 | **15** | 16 |
| B. First run and home | 15% | 7 | 10 | 12 | 13 | **13** | 13 |
| C. Craft: visual consistency, brand, detail | 15% | 6 | 8 | 12 | 13 | **13** | 13 |
| D. Reliability and performance | 15% | 10 | 10 | 13 | 13 | **14** | 16 |
| E. Store, legal and privacy readiness | 10% | 5 | 6 | 11 | 11 | **11** | 15 |
| F. Accessibility and localisation | 10% | 11 | 11 | 12 | 12 | **12** | 9 |
| G. Depth: history, stats, content | 10% | 7 | 9 | 13 | 14 | **14** | 14 |
| H. Business model working | 5% | 3 | 10 | 10 | 11 | **11** | n/a |
| **Weighted** | | **6.7** | **9.1** | **11.85** | **12.9** | **13.25** | **≈ 14.0** |

Working: 3.0 + 1.95 + 1.95 + 2.1 + 1.1 + 1.2 + 1.4 + 0.55 = **13.25**, shown as 13.3.

**Original rubric** (22 Sep weights): core loop 15 (20%), clarity 13 (15%), store 11 (15%),
monetisation 11 (10%), engineering 15 (10%), performance 15 (10%), polish 13 (10%), l10n/a11y 12
(10%) = 3.0 + 1.95 + 1.65 + 1.1 + 1.5 + 1.5 + 1.3 + 1.2 = **13.20**.

### Why each score

**A, 15 (was 14).** Two of the three reasons it stopped at 14 moved:
- **the battery is three days now,** not one, and they agree: about 2 points an hour carried, 1.6
  with the cell radio off. The P30 has no SIM, and its radio searching for a network was about half
  the drain on 17 Oct, so a phone with a SIM may well do better. Still one phone;
- **the 17 Oct faults were found, fixed and held the next day:** 91.4% within 10 m in airplane
  mode, the switching rules working as written;
- **a real fault found by real use:** the trip ended at lunch on 18 Oct. Finding it is the point of
  field days; that it was there at all says the trip end rules had never met a long trip.

Why not 16:
- **no trip has been ended on purpose,** and no souvenir made from an ended one (T-205). Trip 31 is
  25 days old;
- **Huawei's warning came again on 17 Oct,** and the question it raises (does one day out draw it
  on its own?) is unanswered. D-106 is still Provisional;
- **untested:** a walk alone, a levada, Poupança since D-106, a restart, a Play update; 3 of 13
  stamp places missed on 17 Oct before the content was changed;
- 36 NOT TUNED notes (39 on 16 Oct).

**B, 13 (unchanged).** The home read today: Google's map, *Definições*, the passport button with
*26/81* and a gold *21*, *Centrar*, *A registar automaticamente*, *Começar passeio*. Nothing on it
has changed in a way that moves this area, the first run has not been seen since 5 Oct, and *where
next* stays off the home by the lead's decision (L4, 9 Oct).

**C, 13 (unchanged).** Real work went in (Settings after WalkNYC's, the passport without a spinner,
the day view, the medals opening their sets), and the day view in today's screenshot is clean: one
day's roads in deep orange over the island, four stamps, one figure per label. Held at 13 because
the two things that would move it did not: nobody but the lead has seen any screen, and the one
claim checked closely was only partly true (N4). Two small things in the screenshot (N9).

**D, 14 (was 13).** Gains:
- **the map's smoothness, measured on screen:** 59.6 and 58.5 frames a second panning with no gap
  over 33 ms, against 30 on 19 Oct morning. This is the lag the lead felt, and it is gone on the P30;
- **the cold start explained:** today's 2.2 s on a fresh field build repeats 16 Oct's 2.3 s, which
  is what a fresh install, not the code, would give;
- the smoke test passed; no `error` in the diary but three billing ones (N7); three `db_retry`, each
  recovered.

Against:
- **memory went up again,** to 420 MB on the field build (N2);
- **the blank map counter has been broken since 18 Oct** (N1): the reliability claim that rested on
  it (82 of 83 drawn) can no longer be extended;
- zooming is 48 frames a second with one 149 ms freeze today, where `HANDOFF.md` says none;
- still **one phone**, no pre-launch report.

**E, 11 (unchanged).** In ten days: version 9 built, version 10 built, neither recorded as uploaded.
Data safety, T-123, the listing and its screenshots are where they were on 9 Oct. Each day this
stays is a day added to the 14 that cannot be shortened.

**F, 12 (unchanged).** Every Portuguese label read today in *tu* and spoken sensibly (*"Fanal: já
lá estiveste. Desbloqueia o teu passaporte para veres este carimbo."*). German unread, no TalkBack
pass.

**G, 14 (unchanged).** More to look back on: 26 stamps, medals that open their sets, the trip viewer
by day with its times, the film of a day or the trip. Held at 14 because neither of 16 Oct's two
reasons moved: 7 levadas still without figures (11 of 18), and no ended trip.

**H, 11 (unchanged).** The offer is where it was; nothing fired by a real stamp checked today, the
purchase matrix still 2 of 18 rows, nothing sold to a stranger.

## 4. New findings this round

| # | Finding | Evidence | Severity |
|---|---|---|---|
| R1 | **The closed track: still no record of which build is on it.** Version 7 (12 Oct) is the last recorded upload; 9 and 10 are built. 7 records nothing at home with the screen off | `HANDOFF.md`, `TASKS.md` T-129 | **P1**, carried (P0 once a tester opts in) |
| N1 | **The blank map probe counts time the map is covered.** 104 *not drawn* since 18 Oct 17:56 (49 on 18 Oct, 55 on 19 Oct), 1 in the week before. Reproduced today: during the smoke test the diary wrote *not drawn 20000 ms* at 20:25:11 and *drawn 20648 ms* one second later, as the screen above the map closed. The map is mounted again under the trip viewer (it reports *drawn* anew on coming back), and the probe times it as if visible. The same fault as 9 Oct in a new shape. **No blank map seen** in the four openings made by hand | diary, both database copies | **P2** (the T-177 counter is unreadable since 18 Oct) |
| N2 | **Memory 420 MB** total after the workload, native heap 169 MB, against 356 MB (115 MB native) on 16 Oct and 279 MB on 9 Oct, each on a field build. The kept passport accounts for about 24 MB by `HANDOFF.md`'s count. The store build's 303 to 315 MB is not comparable: a different build and sequence | `meminfo` | **P2** |
| N3 | **Zoom: one 149 ms freeze**, 47.9 frames a second, 18 gaps over 33 ms. `HANDOFF.md` says *no freezes* | `measure-map-zoom.sh` | P3 |
| N4 | **The passport's back button is still a typed "‹"** (*‹ Mapa*), against `HANDOFF.md`'s *every text chevron is a drawn ChevronMark, seen in all five places*. The trip viewer's back and play are typed "←" and "▶" too (arrows, not chevrons, but the same reason applies) | `uiautomator`, `PassportScreen.tsx:781` | P3 |
| N5 | **The field log contradicts itself on 17 Oct:** the plan says *no Huawei warning with no GPS at home*; the entry and summary say a warning at 10:41. D-106's acceptance waits on exactly this | `field-test-log.md` | P3 (P2 for D-106) |
| N6 | **The trip ended at lunch on 18 Oct**, 24 days in, at a ferry terminal 465 m away. Fixed the same day, with a validator rule against a repeat | diary, field log | fixed |
| N7 | **Three billing errors on 19 Oct** (*fetchPrice: query-product*, 12:28 to 14:25), the first errors in the diary since 7 Oct. They fall in the hours the store-configuration build was on the phone; a sideloaded build signed with the upload key is a likely reason, not a checked one | diary | P3 until T-239 on a Play install |
| N8 | **Cold start 2.2 s** on a field build ten minutes old, matching 16 Oct. Settles R3 as the fresh install | `am start -W` ×3 | info |
| N9 | **The trip viewer:** *ESTRADAS ACESAS* wraps to two lines beside one-line labels; the 18 Oct day touches the screen's left edge at Praia Formosa though the day is framed | screenshot | P3 |
| R7 | 36 NOT TUNED notes (39 on 16 Oct) | `grep` | P3 |
| R8, R9 | The August `dev_poi_fixture` row, and Risco and Alecrim 0 m apart, both still there | database copy, validator | info |

## 5. MVP and publishing

**MVP: yes.** On the P30, a pocket and three days out light the roads, earn the stamps and replay
the day, with the app never opened.

**Publishable: no.** Left, in order of risk: R1 and the 14 days; Huawei's warning on a day out
alone; Data safety, T-123 and the listing submitted; screenshots in three languages; the
pre-launch report; the purchase matrix; one trip ended on purpose.

---

# Part 2: What is left, in order

16 Oct's desk items A (R3, R4) and C (chevrons) were done or mostly done; its field item F2 was
answered twice over. This replaces its order. Task IDs are the project's; new work takes the next
free IDs.

## 1. The target, area by area

| Area | Today | Target | What moves it |
|---|---:|---:|---|
| A. Core promise | 15 | 16 | A trip ended on purpose with its souvenir; a day out after a quiet day without Huawei's warning; a walk alone; a restart and a Play update survived |
| B. First run and home | 13 | 14 | First run re-seen on version 10; a tester's first run from a Play install |
| C. Craft | 13 | 14 | N4 and N9; screens seen by testers |
| D. Reliability | 14 | 15 | N1 fixed and the counter running again; N2 measured on one build and one sequence and explained; the pre-launch report; a second Android |
| E. Store and legal | 11 | 15 | R1, everything submitted, screenshots in three languages, the packet capture |
| F. A11y and languages | 12 | 14 | TalkBack pass, German read |
| G. Depth | 14 | 15 | Levada figures where a source exists; an ended trip |
| H. Business | 11 | 14 | The purchase matrix on a Play install; one offer fired from a real stamp |
| **Weighted** | **13.3** | **≈ 15.0** | |

## 2. Decisions for the project lead

| # | Decision | Recommendation |
|---|---|---|
| L7 | **Which build goes on the closed track** (R1), carried from 16 Oct. | **Version 10 now.** It has the motion wake, no GPS at home, the 17 Oct fixes, the ferry fix and the smooth map. Waiting for the next field day costs days on the only clock that cannot be shortened; anything found can follow as an update. |
| L8 | **Whether the app states a battery figure** (D-041), now that three days agree. | **Not yet in the app.** Three days on one phone without a SIM is a fair figure for that phone, not a promise for a tourist's. Revisit after the closed testers' phones report. |
| L10 | **D-106 to Accepted?** It has worked on every trip since 13 Oct. | Accept after the next test (a day out after a quiet day). If no warning comes, the condition written into it is met. |

## 3. The work

### Field (the lead, with the phone; I prepare and read)

**F5. A day out after a quiet day at home** · Lead, next day out · **first**
- As the field log's *Next test*: a day on the desk off the cable, then a day out with stops,
  the app never opened, SensorLogger from the door. Screenshot any Huawei warning before clearing it.
- **Pass:** no warning; the route near 90% or above; the first minutes after each stop recorded.
  Then D-106 can be Accepted (L10).

**T-205. One trip to its end** · Lead
- *Terminar viagem*, then make, watch and share the souvenir once. A new trip opens at the next fix.

**F3. A walk alone, app closed** · Lead, when it fits.

**F4. A restart, then a Play update** · Lead, on a Play install (T-210).

### Desk (me, about a day)

**A. N1, the probe** · XS. Count only the time the map is on screen and uncovered, or log which
screen covered it. Then re-read the diary from the day it is installed; the T-177 count restarts.

**B. N2, memory** · S. One build, one sequence (launch, passport, trip viewer, workload, settle),
on the store build and the field build. If the native heap is the roads kept for the map and the
passport, say so; if not, find what grew.

**C. N4 and N9** · XS. *‹ Mapa* as a drawn mark; the viewer's labels to one line, and the day
framed with a margin.

**D. N5** · XS. The field log's plan line corrected to match its entry.

**E. Levada figures for the other 7** · S, where a published source exists (D-041's rule).

**F. Store screenshots, three languages** · S · ⇠ the listing approved. From the demo drive, never
the lead's trace.

**G. The packet capture** (T-264 / T-117b) · S, PCAPdroid on the P30 if the lead allows the install.

### The lead's console

1. **L7: version 10 on the closed track** and the 12 testers opted in. The clock starts then.
2. **Approve the listing copy** (`docs/marketing-plan.md` §4); then desk F.
3. **Data safety** from `docs/store-privacy-answers.md`, after desk G.
4. **T-123**: film shot 3 on the P30, then submit.
5. **T-160a**: a native German reader.

### Release verification

**T-207** the pre-launch report; **T-239** the purchase matrix on a Play install with a license
tester, which also answers N7; **T-271** the formal pre-launch review with WalkNYC re-measured on
the same phone and workload. Then T-137.

## 4. Expected scores

| Step | Strict score |
|---|---:|
| Today | 13.3 |
| R1 settled, N1 fixed, N2 explained | ≈ 13.6 (E +1, D +0.5) |
| F5 passes, a trip ended | ≈ 13.9 (A to 16) |
| Phase 4 submitted, capture taken, screenshots in three languages | ≈ 14.4 (E to 15) |
| TalkBack and German, first run re-seen, levada figures | ≈ 14.8 (B, F, G) |
| Pre-launch report clean, purchase matrix done, testers seen the screens | **≈ 15.2** (C, D, H) |

**If F5 brings Huawei's warning back,** battery work outranks everything below the first row: a
tourist whose phone tells them to force-stop the app on day one loses the product.

## 5. Appendix: raw evidence

- **Device:** `versionCode=10`, `DEBUGGABLE`, `lastUpdateTime=2026-10-19 20:07:12`; one foreground
  service after the force-stops; screen awake, Bruma in front, 100% on USB, 28 °C.
- **Cold start** (`am start -W`, after `force-stop`): `COLD` 2,254, 2,222, 2,234 ms. Each logged
  *drawn* 2.5 to 2.6 s after coming to the front.
- **Pan** (`measure-map-frames.sh`, two runs): 356 frames, 59.6 fps in motion, 5 of 349 vsyncs
  missed, p99 33.1 ms, no gap over 33 ms; 353 frames, 58.5 fps, 11 of 353 missed, p99 33.1 ms, no
  gap over 33 ms.
- **Zoom** (`measure-map-zoom.sh`): 180 frames, 47.9 fps, 45 of 216 vsyncs missed, p90 49.6 ms,
  18 gaps over 33 ms, 1 over 50 ms, 1 over 100 ms (149.0 ms).
- **Memory** 25 s after the workload: total 419.9 MB, native heap 168.7 MB, Java heap 48.2 MB,
  code 95.4 MB, graphics 2.5 MB.
- **Map drawn** (diary): since 9 Oct, *drawn* 51, 10, 8, 4, 3, 2, 15, 21, 9, 134 by day; *not
  drawn* 1 (9 Oct), then 49 (18 Oct from 17:56) and 55 (19 Oct). Today by hand: 4 of 4 drawn
  (three cold starts, one return from the trip viewer). In the smoke test: *not drawn* 20:25:11,
  *drawn 20648 ms* 20:25:12.
- **Database copy:** integrity ok; trip 31 open since 24 Sep (the 18 Oct end repaired); 40,104
  fixes, the last 20:16 today; 26 stamps, 14 since 16 Oct; `tracking_quality` balanced,
  `background_tracking` true.
- **Diary since 16 Oct 21:00:** 3 `error` (billing, 19 Oct), 3 `db_retry` (recovered), 1
  `trip_end` (the ferry terminal), 9 stamp notifications and 1 reveal, 6 `outing`, 17
  significant-motion wakes, 272 billing checks *owned 0, unlocked false*.
- **Smoke test** (`--internal`): every screen opened, nothing crashed.
- **Tests:** 1,156 pass, `tsc` clean. **Content:** valid, 81 places, why-go 81 of 81, 11 of 18
  levadas with figures, 5 warnings.
- **Screenshot** (scratchpad, not committed): the trip viewer on 18 Oct.

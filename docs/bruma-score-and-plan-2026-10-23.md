# Bruma: Score and Plan, 2026-10-23

An interim review on the same strict rubric as [`bruma-score-and-plan-2026-10-19.md`](bruma-score-and-plan-2026-10-19.md),
so the numbers compare. Four days and 9 commits after it. **Part 1** is the score, **Part 2** what
is left to reach 15.

## At a glance

- **Score today:** **13.3 / 20** strict (13.33; 13.25 on 19 Oct, 12.9 on 16 Oct, 11.9 on 9 Oct).
  WalkNYC ≈ 14.
- **What improved, verified:** every desk item of the last plan. The blank-map probe is honest
  again (79 openings since the fix, 0 false *not drawn*); memory after the same workload **358 MB,
  was 420**; cold start **0.87 to 1.17 s on the field build, was 2.2 s**; the drawn chevrons and
  the viewer's one-line labels are on screen; *Ver no mapa* now frames the place above its card.
- **Why the score barely moves:** the desk was not what held it. The things that do (a build on
  the closed track, a field day, an ended trip, anything submitted) have not moved since 19 Oct,
  and there has been no day out since 18 Oct. Desk polish is now worth hundredths.
- **The single most valuable next thing:** unchanged, and now 14 days old: **version 11 on the
  closed track**, which needs the background-location video (T-123 shot 3) first.

---

# Part 1: The score

**Date:** 2026-10-23, 11:45 to 11:55
**Build reviewed:** `com.proa.madeira` 0.1.0, **version code 11, field build** (debuggable),
installed 2026-10-23 10:34 (the *Ver no mapa* fix, `9d7ddb9`). Not byte for byte the store AAB of
21 Oct, which is one commit older.
**Device:** Huawei P30, Android 10, `pt-PT`, the lead's real data: trip 31 open since 24 Sep,
41,175 fixes, **26 stamps** (none new since 18 Oct). On USB at 100%, 26 °C.
**Nothing was changed on the phone.** Database copied read only (`run-as cat`, integrity ok),
three force-stops for cold starts, the pan probe four times and the zoom probe once, the passport
and trip viewer by hand, memory after the workload, the release smoke test, *Ver no mapa* from a
place card. Two screenshots (the passport, the place card and its result).

## 1. Method

Unchanged from 19 Oct: eight areas, each out of 20, WalkNYC as the "good shipped app" line (14 to
17), every claim checked today on the P30, in the database copy or in the code. WalkNYC not
re-measured. Half points are used for D this time, as the 19 Oct plan's own forecast did.

**Not done today, as before:** first run on the device; German on screen; TalkBack; font scaling;
a store-configuration build; outdoors; a Play install; a purchase; the film watched.

## 2. What changed since 19 Oct, verified

| Item | Now | Seen today |
|---|---|---|
| N1, the blank-map probe | ✅ **Fixed.** Since 19 Oct 21:23: 79 *map* entries, **0 not drawn**; every opening today drew (2.4 to 2.8 s cold, 0.27 to 0.29 s back from a screen above) | diary, both copies |
| N2, memory | ✅ **358 MB** total after the 19 Oct sequence (native heap 123 MB, was 169). After the longer run that followed (smoke test, passport scrolled to its end, a card, *Ver no mapa*) **417 MB**, so the passport still costs when used | `meminfo` |
| Cold start | ✅ **1,172, 899, 869 ms** `COLD`, on a field build an hour old. 19 Oct: 2.2 s. Closer to the 650 to 730 ms recorded for the store build | `am start -W` ×3 |
| Pan | ◐ **58.5, 57.0, 58.4, 58.9 fps**, but **one freeze over 100 ms in 2 of 4 runs** (199 ms, 165 ms). 19 Oct: none in 2 runs (N10) | `measure-map-frames.sh` ×4 |
| Zoom | ✅ **48.8 fps**, 17 gaps over 33 ms, **worst 83 ms** (19 Oct: 47.9, worst 149 ms) | `measure-map-zoom.sh` |
| N4, N9 | ✅ *‹ Mapa* is a drawn mark; *ESTRADAS ACESAS* on one line | screenshot, `uiautomator` |
| Medals | ✅ One swipeable row, not four | `uiautomator` |
| *Ver no mapa* | ✅ Praia Formosa's pin sits in the map above the card, not behind it | screenshot |
| Smoke test | ✅ Every screen opened, nothing crashed | `smoke-release.mjs --internal` |
| Tests | ✅ **1,162 pass** (was 1,156), `tsc` clean, content valid: 81 places, why-go 81 of 81, 5 warnings | ran today |
| Field | ❌ **No day out since 18 Oct.** Fixes per day since: 3 to 176, all at home. No new stamp | database copy |
| Store | ⚠ **Version 11 built 21 Oct, no record of an upload.** The closed track needs Google's review now, gated by the T-123 video and a foreground-service declaration (drafted in `docs/closed-testing.md`) | `HANDOFF.md`, `TASKS.md` T-129 |
| Porto Santo | ◐ D-107: it comes with the one purchase. Four questions recorded as open, not answered | `DECISIONS.md` |

## 3. The strict rubric

| Area | Weight | 6 Oct | 9 Oct | 16 Oct | 19 Oct | **Today** | WalkNYC |
|---|---:|---:|---:|---:|---:|---:|---:|
| A. Core promise proven in the field | 20% | 9 | 11 | 14 | 15 | **15** | 16 |
| B. First run and home | 15% | 10 | 12 | 13 | 13 | **13** | 13 |
| C. Craft: visual consistency, brand, detail | 15% | 8 | 12 | 13 | 13 | **13** | 13 |
| D. Reliability and performance | 15% | 10 | 13 | 13 | 14 | **14.5** | 16 |
| E. Store, legal and privacy readiness | 10% | 6 | 11 | 11 | 11 | **11** | 15 |
| F. Accessibility and localisation | 10% | 11 | 12 | 12 | 12 | **12** | 9 |
| G. Depth: history, stats, content | 10% | 9 | 13 | 14 | 14 | **14** | 14 |
| H. Business model working | 5% | 10 | 10 | 11 | 11 | **11** | n/a |
| **Weighted** | | **9.1** | **11.85** | **12.9** | **13.25** | **13.33** | **≈ 14.0** |

Working: 3.0 + 1.95 + 1.95 + 2.175 + 1.1 + 1.2 + 1.4 + 0.55 = **13.325**, shown as 13.3.

**Original rubric** (22 Sep weights): core loop 15, clarity 13, store 11, monetisation 11,
engineering 15, performance **16** (was 15), polish 13, l10n/a11y 12 = **13.30** (13.20 on 19 Oct).

### Why each score

**A, 15 (unchanged).** No field day, so nothing new for or against. Every reason it stopped at 15
on 19 Oct stands: no trip ended on purpose, Huawei's warning on a day out alone unanswered (D-106
still Provisional), no walk alone, no restart or Play update survived.

**B, 13 (unchanged).** *Ver no mapa* behind its card was a real flaw and is fixed, but it is one
path off the home; the first run has still not been seen since 5 Oct.

**C, 13 (unchanged).** N4 and N9 are done, the medals row is tidier, the stamp card is the best
screen in the app. Held because the other half of 19 Oct's condition, screens seen by anyone but
the lead, has not moved, and two small things showed today (N11, N12).

**D, 14.5 (was 14).** Gains: N1 fixed and the T-177 counter running again (79 of 79); memory down
62 MB on the same sequence and explained; cold start down to under 1.2 s on a field build; zoom's
worst gap 83 ms. Against: two pan freezes over 100 ms in four runs where 19 Oct had none (N10);
still one phone and no pre-launch report, which is why not 15.

**E, 11 (unchanged).** Real preparation (version 11, the console click order, the declaration that
nobody had drafted), but nothing submitted, uploaded or reviewed. The 14 days have not started.

**F, 12; G, 14; H, 11 (unchanged).** No TalkBack or German pass; no ended trip; no purchase matrix.
D-107 settles the Porto Santo offer in principle but leaves four questions open.

## 4. New findings this round

| # | Finding | Evidence | Severity |
|---|---|---|---|
| R1 | **The closed track: still no upload recorded.** First flagged 9 Oct. Version 11 waits on the T-123 video, which gates the closed review | `HANDOFF.md`, `docs/closed-testing.md` | **P1**, carried |
| N10 | **Pan freezes came back in 2 of 4 runs**: one gap of 199 ms and one of 165 ms, the frame rate otherwise 57 to 59. 19 Oct: none over 33 ms in two runs. Not explained; may be a collection pause, may be the medals or the strip window, which are new since | `measure-map-frames.sh` ×4 | P3 |
| N11 | **The stamp card's *Próximo carimbo* box runs into the button row:** its last line sits on the buttons' top edge with no gap | screenshot, Praia Formosa | P3 |
| N12 | **The map's place card is light grey on a dark app**, and the place is a generic red Google pin, while the passport and stamp card are Bruma's own dark design. Reads as two apps | screenshot | P3 |
| N13 | **The passport still costs when used**: 358 MB after the short sequence, 417 MB after a scroll to its end and a card. Better than 19 Oct, not gone | `meminfo` | info |
| N14 | **Five days without a field day.** A review on unchanged field evidence cannot move A, and A is the heaviest area | database copy | info |
| R7, R8, R9 | 36 NOT TUNED notes; the August fixture row; Risco and Alecrim 0 m apart. All unchanged | `grep`, validator | info |
| carried | The passport's 250 to 390 ms opening hitch (found 21 Oct), not measured today | `HANDOFF.md` | P3 |

## 5. MVP and publishing

**MVP: yes**, as on 19 Oct. **Publishable: no.** In order of risk: R1 and the 14 days; the T-123
video that now gates them; Huawei's warning on a day out alone; Data safety and the listing; the
pre-launch report; the purchase matrix; one trip ended on purpose.

---

# Part 2: What is left, in order

The 19 Oct desk list (A to E) is done. What remains is almost all the lead's, which is why the
order below puts the lead first.

## 1. The target

| Area | Today | Target | What moves it |
|---|---:|---:|---|
| A | 15 | 16 | F5 passed (a day out after a quiet day, no warning); a trip ended with its souvenir |
| B | 13 | 14 | First run re-seen on version 11; a tester's first run from Play |
| C | 13 | 14 | N11, N12; screens seen by testers |
| D | 14.5 | 15 | N10 understood; the pre-launch report; a second Android |
| E | 11 | 15 | Version 11 uploaded and reviewed, Data safety, listing, screenshots in three languages |
| F | 12 | 14 | TalkBack pass, German read |
| G | 14 | 15 | An ended trip |
| H | 11 | 14 | The purchase matrix on a Play install; D-107's four questions answered |
| **Weighted** | **13.3** | **≈ 15.0** | |

## 2. The lead, first

1. **T-123 shot 3** on the P30, then **version 11 on the closed track** with the 12 testers opted
   in (`docs/closed-testing.md`). Nothing else on this list has a clock.
2. **F5:** a quiet day on the desk off the cable, then a day out with stops, the app never opened,
   SensorLogger from the door (field log, *Next test*). Pass: no Huawei warning, the route near 90%.
   Then D-106 can be Accepted.
3. **T-205:** end trip 31 on purpose, make and share the souvenir once.
4. **D-107's four questions** (what a free user sees on Porto Santo, and the rest in T-067a).

## 3. The desk (me, under a day)

- **N10** · XS. Four more pan runs before and after opening the passport; if the freezes follow
  the passport, look at the medals row and strip window; if not, a GC trace.
- **N11** · XS. Space between the *Próximo carimbo* box and the buttons.
- **N12** · S, the lead's eye. The map's place card in the passport's dark style, and Bruma's own
  pin. Show options before building.
- **Store screenshots in three languages** · S, once the listing copy is approved.
- **The packet capture** (T-264) · S, if the lead allows PCAPdroid on the P30.

## 4. Expected scores

| Step | Strict score |
|---|---:|
| Today | 13.3 |
| Version 11 uploaded and in review | ≈ 13.4 (E 12) |
| F5 passes, a trip ended | ≈ 13.7 (A 16) |
| Data safety, listing, screenshots, capture | ≈ 14.0 (E 15) |
| TalkBack and German, first run re-seen, N10 to N12 | ≈ 14.6 (B, C, D, F) |
| Pre-launch report clean, purchase matrix, testers seen the screens | **≈ 15.1** |

## 5. Appendix: raw evidence

- **Device:** `versionCode=11`, `DEBUGGABLE`, `lastUpdateTime=2026-10-23 10:34:12`; one service
  record after the run; 100% on USB, 26 °C.
- **Cold start:** `COLD` 1,172, 899, 869 ms; *map drawn* 2,758, 2,577, 2,420 ms after the screen
  came to the front.
- **Pan:** 349 frames 58.5 fps, max 49.7 ms; 361 frames 57.0 fps, max 198.6 ms (1 over 100);
  360 frames 58.4 fps, max 165.4 ms (1 over 100, after the passport and viewer); 357 frames
  58.9 fps, max 49.7 ms (after the smoke test).
- **Zoom:** 184 frames, 48.8 fps, 42 of 218 vsyncs missed, p99 82.8 ms, 17 gaps over 33 ms, 4 over
  50, none over 100.
- **Memory**, 25 s after map, passport, viewer, back, pan: total 358.5 MB, native 123.2 MB, Java
  47.1 MB, code 94.0 MB, graphics 2.5 MB, unknown 61.3 MB. After the smoke test and *Ver no mapa*:
  416.7 MB.
- **Diary since 19 Oct 21:23:** 480 batch, 79 map (0 *not drawn*), 21 start, 21 geofence, 21
  billing, 21 activity, 12 app_launch, 6 export; **no error, no db_retry, no trip_end.**
- **Database copy:** integrity ok; trip 31 open; 41,175 fixes (19 Oct to 23 Oct: 661, 3, 176, 16,
  93 by day); 26 stamps, the last on 18 Oct.
- **Tests:** 1,162 pass, `tsc` clean. **Content:** valid, 81 places, 5 warnings.
- **Screenshots** (scratchpad, not committed): the passport; Praia Formosa's card; *Ver no mapa*.

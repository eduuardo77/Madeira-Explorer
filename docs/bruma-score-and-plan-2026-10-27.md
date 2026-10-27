# Bruma: Score and Plan, 2026-10-27

A review on the same strict rubric as [`bruma-score-and-plan-2026-10-23.md`](bruma-score-and-plan-2026-10-23.md),
so the numbers compare. Four days and 35 commits after it. **Part 1** is the score, **Part 2** what
is left to reach 15.

## At a glance

- **Score today:** **13.6 / 20** strict (13.63; 13.33 on 23 Oct, 13.25 on 19 Oct, 11.9 on 9 Oct).
  WalkNYC ≈ 14. Band: an MVP and a shippable beta, not yet publishable.
- **What moved it, verified:** closed testing is running (the lead's report, 26 Oct), which was
  the single most valuable thing for 18 days; the **first run seen again** for the first time since
  5 Oct, clean in five steps (emulator, store configuration); German read on screen; N11 and N12
  fixed and seen on the P30; Porto Santo has its own passport with 9 places; the pan is at 59 to
  60 fps with no stall; 1,188 tests pass.
- **What pulls it back:** **the P30 has been asking for GPS every 5 seconds at home since 20:41
  last night** (N15, P1). The T-286 fix shipped on that build, but its still check needs a GPS
  position to prove the phone is still, and indoors it gets none, so it gives up. Also German
  breaks at large text (N16), and the zoom has gaps over 100 ms again (N17).
- **What holds it under 15:** unchanged in kind: no trip ended, no new stamp since 18 Oct, nothing
  on Data safety or the listing verified, no TalkBack pass, no purchase matrix, one phone.
- **The single most valuable next thing:** **fix N15** before any tester updates, because it is
  exactly what draws Huawei's warning, and it hits every phone that is updated or restarted at home
  after a drive.

---

# Part 1: The score

**Date:** 2026-10-27, 10:11 to 10:30
**Build reviewed:** `com.proa.madeira` 0.1.0, **version code 11, field build** (debuggable),
installed 2026-10-26 20:37 (the T-286 fix, `3cc1860`, upload key). For the first run and German:
a **store-configuration build** of the same source for the emulator (x86_64, not debuggable).
**Device:** Huawei P30, Android 10, `pt-PT`, the lead's real data: trip 31 open since 24 Sep,
46,477 fixes, **26 stamps** (none new since 18 Oct). On USB at 100%, 25 °C, **airplane mode on**.
Emulator: Pixel style, 720 × 1560 at 320 dpi (360 × 780 dp), Android 14, English then German.
**Nothing was changed on the phone.** Database copied read only (`run-as cat`, integrity ok);
three force-stops for cold starts; the pan probe twice and the zoom probe three times; the release
smoke test; memory after it; the passport, a stamp card and *Ver no mapa* by hand; `dumpsys
location` and `batterystats` read. Two screenshots on the P30, six on the emulator.

## 1. Method

Unchanged from 23 Oct: eight areas, each out of 20, WalkNYC as the "good shipped app" line (14 to
17), every claim checked today on the P30, in the database copy, on the emulator or in the code.
Half points used where an area moved on part of its condition. WalkNYC not re-measured.

**Done today for the first time since 5 Oct:** the first run (emulator, a clean install); German on
screen; font scaling (130%). The emulator is legitimate for these (CONTEXT §6.6), not for battery
or GPS.
**Not done today:** TalkBack; the first run on the P30 or from Play; outdoors; a Play install; a
purchase (the emulator has no Play account, so no price showed); the film watched; the Play
Console (closed testing is the lead's report, not seen).

## 2. What changed since 23 Oct, verified

| Item | Now | Seen today |
|---|---|---|
| R1, the closed track | ✅ **Running, day 3 of 14 on 26 Oct**, after the T-123 video. Which version code testers have was not said | the lead, in `HANDOFF.md`; not seen in the Play Console |
| N12, the map's place card | ✅ Violet and gold, a gold pin, the levada framed above the card (Levada do Furado) | screenshot, P30 |
| N11 | ✅ Fixed 23 Oct (T-281) | not re-measured |
| One way of recording (D-108) | ✅ Settings shows one switch; *Começar passeio* records the same way | emulator, `uiautomator` |
| Porto Santo (D-109) | ✅ A card in the passport, *0 de 9 lugares*; its own passport with 1 free stamp; the paywall names it | P30 and emulator |
| Field, 26 Oct outing | ✅ 95.3% of the route within 10 m, 96.9% by car; ⚠ a 29 min stop stayed on *driving* (T-286); Huawei's warning a third time | field log; diary agrees (outing 16:13:50 to 18:56:44) |
| T-286, the still check | ❌ **Runs, and fails indoors** (N15) | diary, `dumpsys location`, `batterystats` |
| First run | ✅ Welcome, five steps, *Ready to go*, the map. Honest copy, every system prompt explained before it shows | emulator, store build |
| German | ✅ Settings, passport, Porto Santo, paywall: natural, formal *Sie* throughout | emulator |
| Large text | ❌ Breaks in German (N16) | emulator, screenshot |
| Cold start | ✅ **1,138, 931, 887 ms** `COLD` (23 Oct: 1,172, 899, 869) | `am start -W` ×3 |
| Pan | ✅ **59.6 and 59.1 fps**, stalls over 50 ms: **0 and 0** | `measure-map-frames.sh` ×2 |
| Zoom | ◐ **46.0 and 50.7 fps**; gaps over 100 ms: **1, 3, 2** in three runs, worst 132 ms (23 Oct: 48.8 fps, none over 100, worst 83) | `measure-map-zoom.sh` ×3 |
| Memory | ✅ **393 MB** after the smoke test (23 Oct: 417 after a similar run) | `meminfo` |
| Map drawn | ✅ 13 of 13 openings since 23 Oct drawn, 0.25 to 3.7 s | diary |
| Smoke test | ✅ Every screen opened, nothing crashed | `smoke-release.mjs --internal` |
| Tests | ✅ **1,188 pass** (was 1,162), `tsc` clean; content valid: 81 + 9 places, why-go 90 of 90, 7 warnings | ran today |
| Diary | ✅ No error, no `db_retry` row since 23 Oct | database copy |

## 3. The strict rubric

| Area | Weight | 6 Oct | 9 Oct | 16 Oct | 19 Oct | 23 Oct | **Today** | WalkNYC |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A. Core promise proven in the field | 20% | 9 | 11 | 14 | 15 | 15 | **15** | 16 |
| B. First run and home | 15% | 10 | 12 | 13 | 13 | 13 | **13.5** | 13 |
| C. Craft: visual consistency, brand, detail | 15% | 8 | 12 | 13 | 13 | 13 | **13.5** | 13 |
| D. Reliability and performance | 15% | 10 | 13 | 13 | 14 | 14.5 | **14** | 16 |
| E. Store, legal and privacy readiness | 10% | 6 | 11 | 11 | 11 | 11 | **12.5** | 15 |
| F. Accessibility and localisation | 10% | 11 | 12 | 12 | 12 | 12 | **12** | 9 |
| G. Depth: history, stats, content | 10% | 9 | 13 | 14 | 14 | 14 | **14.5** | 14 |
| H. Business model working | 5% | 10 | 10 | 11 | 11 | 11 | **11.5** | n/a |
| **Weighted** | | **9.1** | **11.85** | **12.9** | **13.25** | **13.33** | **13.63** | **≈ 14.0** |

Working: 3.0 + 2.025 + 2.025 + 2.1 + 1.25 + 1.2 + 1.45 + 0.575 = **13.625**, shown as 13.6.

The original rubric (22 Sep weights) was not recomputed this time.

### Why each score

**A, 15 (unchanged).** For: the 26 Oct outing lit 95.3% of the route on the new single way of
recording, the best car share since 9 and 10 Oct. Against: the same outing found a stop that never
sleeps, and Huawei warned a third time; today the fix for it does not work indoors (N15). No trip
ended, no stamp since 18 Oct. The two cancel.

**B, 13.5 (was 13).** The first run, unseen for three weeks, is good: a welcome that says what the
app does in two lines, each permission explained before Android asks, *Not now* on every step
but the last, and an honest *Ready to go*. Half a point, not one: seen on an emulator, not from
Play, and the background-location step cuts its fourth option on a 360 dp phone (N18).

**C, 13.5 (was 13).** N11 and N12 are done and the map card now looks like the passport, which was
the "two apps" complaint. Porto Santo's card fits in. Held from 14 by testers' eyes not yet
recorded, and by small slips (N19, N20).

**D, 14 (was 14.5).** Gains: the pan at 59 to 60 fps with no stall, cold start under 1.2 s,
memory down to 393 MB, every map opening drawn, no error in four days. Against: **N15**: the
build on the P30 holds the GPS at home with nothing to record, which is a reliability fault in
battery terms and the exact behaviour Huawei warns about; and the zoom's gaps over 100 ms are back
(N17). Still one phone and no pre-launch report.

**E, 12.5 (was 11).** The background-location video was made and closed testing is running, so
Google accepted the declaration and the 14 days have started. A point and a half, not more: this
is the lead's word, not the Play Console seen; Data safety, the listing and store screenshots are
not verified; and the testers' version is not known.

**F, 12 (unchanged).** For: German read on screen for the first time, natural and consistent.
Against: at 130% text on a 360 dp phone, German breaks words in half and cuts lines (N16). Large
text and German are both common among older visitors, so the two together matter. No TalkBack.

**G, 14.5 (was 14).** Porto Santo adds 9 places, its own passport and medal, drafted and vetoed.
No ended trip, which is what 15 asks.

**H, 11.5 (was 11).** D-107's four questions are answered (D-109) and the paywall names Porto
Santo. No purchase matrix on a Play install.

## 4. New findings this round

| # | Finding | Evidence | Severity |
|---|---|---|---|
| N15 | **The P30 has held the GPS at home since 20:41 last night.** The install restarted recording on the stored profile, *driving*. Two still checks ran (20:41 and 06:45) and both ended *"stay, no position"*: indoors, in airplane mode, no GPS position came within the wait, and `runStillCheck` returns without lowering the profile. On *driving* the 50 m filter lets no fix through at home, so nothing else lowers it either. Right now: `ACCURACY_FINE gps requested=+5s` on behalf of Bruma; since the 09:48 battery reset, GPS held 21 min 37 s of 21 min 37 s; no fix stored since 18:53 yesterday. Two causes, both needed: a restart resumes a moving profile, and the still check treats "no position" as "keep moving", when indoors "no position while still" is the normal case. Likely in the testers' build too (the restart part predates T-286). Not fixed: this is a review | diary rows, `dumpsys location`, `batterystats`, `backgroundTasks.ts:195` | **P1** |
| N16 | **German at 130% text on a 360 dp screen breaks:** the unlock banner splits words (*Noch 5 k / ostenlose*, *freischalte / n*), the map's status line is cut (*Automatische Aufzeichnung lä…*), *Alle ansehen* runs off the edge | emulator, screenshot | P2 |
| N17 | **Zoom gaps over 100 ms are back:** 1, 3 and 2 in three runs, worst 132, 116, 116 ms, at 46 to 51 fps. 23 Oct: none over 100. The zoom probe writes no gesture markers, so some may be pauses between gestures, the same trap as N10 on the pan. Unexplained; the gold pin and 9 more places are new since | `measure-map-zoom.sh` ×3 | P3 |
| N18 | The background-location step's drawing of Android's page **cuts its fourth option** (*Don't allow*) behind the button on a 360 × 780 dp phone | emulator, screenshot | P3 |
| N19 | English Settings: the button says *Restore purchase*, the note under it *Recover purchase*. Portuguese and German agree | `strings.ts:901`, `:1192` | P3 |
| N20 | The paywall's stamp art cuts *JARDIM BOTÂNICO DA…* | emulator, screenshot | P3 |
| N21 | Twice on 26 Oct an outing **ended 2 and 9 seconds after it started** (16:13:45 to :47, 19:38:01 to :10). The first is the field log's "retap"; the second is unexplained. A start that reads as a stop to a second tap would cost a tester a whole outing | diary | P3, to check |
| N22 | The Porto Santo card says *Incluído no teu passaporte* in link blue to a user who has not paid, just under the unlock banner. May read as "free". The lead's call | P30 screenshot | info |
| carried | The new-stamp pop-up counts both islands (*1 / 90*, found 26 Oct); the passport's opening hitch; Risco and Alecrim 0 m apart; `founderWindow` null | `HANDOFF.md`, validator | P3 / info |

## 5. MVP and publishing

**MVP: yes. Shippable beta: yes, it is in one.** **Publishable: no.** In order of risk: **N15**;
the 14 days finishing with testers who actually used it; Huawei's warning on a day out alone;
Data safety and the listing; the pre-launch report; the purchase matrix; one trip ended on purpose.

---

# Part 2: What is left, in order

## 1. The target

| Area | Today | Target | What moves it |
|---|---:|---:|---|
| A | 15 | 16 | F5 passed (a day out after a quiet day, no warning), after N15; a trip ended with its souvenir |
| B | 13.5 | 14 | A tester's first run from Play; N18 |
| C | 13.5 | 14 | Testers' remarks on the screens recorded; N19, N20 |
| D | 14 | 15 | N15 fixed and seen on the P30 overnight; N17 understood; the pre-launch report |
| E | 12.5 | 15 | Data safety, listing, screenshots in three languages; the 14 days complete |
| F | 12 | 14 | N16; a TalkBack pass |
| G | 14.5 | 15 | An ended trip |
| H | 11.5 | 14 | The purchase matrix on a Play install |
| **Weighted** | **13.6** | **≈ 15.0** | |

## 2. Decisions for the lead

1. **N15 needs app changes**, and the standing rule since 26 Oct is none. It is the one reason to
   lift it: it drains testers' phones at home and invites Huawei's warning. Two small changes,
   both pure and testable: a restart begins on *stationary* and lets the first moving fix raise
   it; a still check that gets no position after the sensors said still counts as still.
2. **Which version code the testers have.** If it is 11 from 21 Oct, they have the restart half of
   N15 already.
3. **N22:** is *Incluído no teu passaporte* right for someone who has not paid?

## 3. The lead (field and Play Console)

1. **Tonight, if N15 is fixed:** leave the P30 at home overnight off the cable; the morning
   check is the diary and `batterystats`, no outing needed.
2. **F5,** after that: a quiet day then a day out with stops, the app never opened, SensorLogger
   from the door. Pass: no Huawei warning, the route near 90%. Then D-106 can be Accepted.
3. **T-205:** end trip 31 on purpose, make and share the souvenir once.
4. **Play Console:** Data safety, the listing text, and whether the pre-launch report has run.

## 4. The desk (me, under a day)

- **N15** · S, once allowed. The two changes above, tests for both, then the P30 overnight.
- **N16** · S. The banner and the map's status line wrap or shrink cleanly at 130%; check German
  and Portuguese at 130% and 160% on the emulator.
- **N19, N20, N18** · XS each.
- **N17** · XS. Add gesture markers to the zoom probe, then rerun before blaming the app.
- **N21** · XS. Read the outing button's start and stop path for a second tap during start.

## 5. Release verification, for the next build to testers

The smoke test on the P30; one night at home with the diary showing *stationary* within minutes;
the first run on the emulator in all three languages at 130% text.

## 6. Expected scores

| Step | Strict score |
|---|---:|
| Today | 13.6 |
| N15 fixed and a night at home clean | ≈ 13.7 (D 14.5) |
| N16 to N20, N17 understood | ≈ 14.0 (C, D, F) |
| F5 passes, a trip ended | ≈ 14.4 (A 16, G 15) |
| Data safety, listing, screenshots, the 14 days done | ≈ 14.7 (E 15) |
| TalkBack, pre-launch report clean, purchase matrix | **≈ 15.1** |

## 7. Appendix: raw evidence

- **Device:** `versionCode=11`, `DEBUGGABLE`, `lastUpdateTime=2026-10-26 20:37:32`; one service
  record; 100% on USB, 25 °C; `airplane_mode_on=1`.
- **N15:** diary 20:41:04 *start profile=driving*, *still check: started on driving*, 20:41:36
  *stay, no position*; 06:45:00 and 06:45:30 the same. `dumpsys location`: `UpdateRecord[gps
  com.google.android.gms ... Request[ACCURACY_FINE gps requested=+5s0ms] WorkSource{10242
  com.proa.madeira}]`. Batterystats reset 09:48:05; Bruma (u0a242) *Sensor GPS: 21m 37s* of
  *Time on battery: 21m 37s*. Last raw fix 2026-10-26 18:53:52.
- **Cold start:** `COLD` 1,138, 931, 887 ms.
- **Pan:** 352 frames 59.6 fps, max 33.1 ms; 357 frames 59.1 fps, max 49.6 ms; stalls 0.
- **Zoom:** run 1 worst 132.4 ms, 5 stalls over 50, 1 over 100; run 2 46.0 fps, 54 of 225 vsyncs
  missed, 3 over 100, worst 116.0; run 3 50.7 fps, 35 of 215 missed, 2 over 100, worst 115.9.
- **Memory** after the smoke test: total 393.5 MB, native 139.5, Java 55.0, code 92.2, graphics 2.6.
- **Diary since 23 Oct 12:00:** 4,407 batch, 55 map (13 drawn, 0 not drawn), 39 geofence, 36
  start, 36 activity, 32 billing, 11 app_launch, 8 outing, 7 stop, 4 export; no error.
- **Database copy:** integrity ok; trip 31 open; 46,477 fixes; 26 stamps, the last 18 Oct.
- **Emulator:** store-configuration x86_64 build of `a3c2ddd`, clean install; cold start 2.2 s
  (emulator, not comparable).
- **Tests:** 1,188 pass, `tsc` clean. **Content:** valid, 90 places, 7 warnings.
- **Screenshots** (scratchpad, not committed): the passport with Porto Santo; Levada do Furado's
  map card; the first run's step 2; the German paywall; map and passport in German at 130%.

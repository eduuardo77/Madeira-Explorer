# Bruma: Score and Plan, 2026-10-27

A review on the same strict rubric as [`bruma-score-and-plan-2026-10-23.md`](bruma-score-and-plan-2026-10-23.md),
so the numbers compare. Four days and 35 commits after it. **Part 1** is the score, **Part 2** what
is left to reach 15.

## At a glance

> **Revised the same day after extended testing and rechecks: 13.3 / 20** (13.28). The morning pass below scored
> 13.6. The extension (§6) refused every permission on a clean install and **the app crashes on
> every launch once location is refused** (N23, P0), present since 28 Aug, so earlier scores were
> too high on B and D as well. Two morning findings did not survive a recheck: the zoom gaps (N17) and an unannounced stamp (N24)
> and the film's last frame cuts the island (N25). Fix N23 before anything else, then N15.

- **Score, morning pass:** 13.6 / 20 strict (13.63; 13.33 on 23 Oct, 13.25 on 19 Oct, 11.9 on 9 Oct).
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
| N15 | **The P30 has held the GPS at home since 20:41 last night.** The install restarted recording on the stored profile, *driving*. Two still checks ran (20:41 and 06:45) and both ended *"stay, no position"*: indoors, in airplane mode, no GPS position came within the wait, and `runStillCheck` returns without lowering the profile. On *driving* the 50 m filter lets no fix through at home, so nothing else lowers it either. Right now: `ACCURACY_FINE gps requested=+5s` on behalf of Bruma; since the 09:48 battery reset, GPS held 21 min 37 s of 21 min 37 s; no fix stored since 18:53 yesterday. Two causes, both needed: a restart resumes a moving profile, and the still check treats "no position" as "keep moving", when indoors "no position while still" is the normal case. Likely in the testers' build too (the restart part predates T-286). Not fixed: this is a review | diary rows, `dumpsys location`, `batterystats`, `backgroundTasks.ts:195` | **P1, fixed 27 Oct (T-288), a night at home to see** |
| N16 | **German at 130% text on a 360 dp screen breaks:** the unlock banner splits words (*Noch 5 k / ostenlose*, *freischalte / n*), the map's status line is cut (*Automatische Aufzeichnung lä…*), *Alle ansehen* runs off the edge | emulator, screenshot | P2, fixed 27 Oct (T-289) |
| N17 | ~~Zoom gaps over 100 ms are back.~~ **Withdrawn after recheck:** a copy of the probe that runs each zoom stroke separately with a marker before it gave **no gap over 100 ms in four runs**, worst 83 ms, 46 to 53 fps, the same as 23 Oct. The morning's 116 to 132 ms gaps came from the probe running all six strokes as one script | four marked runs | withdrawn |
| N18 | The background-location step's drawing of Android's page **cuts its fourth option** (*Don't allow*) behind the button on a 360 × 780 dp phone | emulator, screenshot | P3 |
| N19 | English Settings: the button says *Restore purchase*, the note under it *Recover purchase*. Portuguese and German agree | `strings.ts:901`, `:1192` | P3 |
| N20 | The paywall's stamp art cuts *JARDIM BOTÂNICO DA…* | emulator, screenshot | P3 |
| N21 | Twice on 26 Oct an outing **ended 2 and 9 seconds after it started** (16:13:45 to :47, 19:38:01 to :10). The first is the field log's "retap"; the second is unexplained. A start that reads as a stop to a second tap would cost a tester a whole outing | diary | P3, to check |
| N22 | The Porto Santo card says *Incluído no teu passaporte* in link blue to a user who has not paid, just under the unlock banner. May read as "free". The lead's call | P30 screenshot | info |
| carried | The new-stamp pop-up counts both islands (*1 / 90 places collected*, *Bronze passport!* for a Madeira stamp; found 26 Oct, **seen today** on both reruns); the passport's opening hitch; Risco and Alecrim 0 m apart; `founderWindow` null | `HANDOFF.md`, validator | P3 / info |

## 5. Extended testing, 10:30 to 11:00

Asked for by the lead after the morning pass. Same store-configuration emulator build and the P30,
still read only.

**What was done:** a clean install refusing every permission; location granted again by command;
a replayed walk to Forte de São Tiago (229 points, 2 s apart, a 4.3 min dwell) during an outing;
the outing ended; a restart; the trip viewer and the whole-trip film on the P30's real data with
the frame probe; a label and touch-size audit of the map, Settings and passport on the P30
(`uiautomator`); English, German at 160% text; the outing button's code (N21).

| # | Finding | Evidence | Severity |
|---|---|---|---|
| N23 | **Refuse location in the first run and the app crashes when the map opens, on every launch.** `java.lang.SecurityException: my location requires permission ACCESS_FINE_LOCATION or ACCESS_COARSE_LOCATION` from Google's map: `isMyLocationEnabled: true` is set unconditionally (`NativeMapScreen.tsx:1023`, since 28 Aug). The user can never reach the in-app *grant location* button. Also expected for anyone who chose *Only this time* once that grant lapses, and anyone who revokes location later. Granting by command, the app opens again. The testers' version 11 very likely has it (same line, same map library); not checked, which would need an uninstall on the P30 | emulator, `logcat -b crash`; **reproduced** on a second build (debuggable) from a second clean install | **P0, fixed 27 Oct (T-287)** |
| N24 | ~~A stamp earned with the map open was not announced.~~ **Withdrawn after recheck.** On a debuggable build, reading the database: with automatic recording the stamp was awarded at 11:19:07 and *New stamp!* was on screen within a minute; on a clean outing it was awarded at 11:36:00 and the pop-up opened within 13 s. The text dumps used in the first run cannot see the pop-up, which opens in its own window; that run also had location refused then granted by command and two walks back to back | two reruns, database and screenshots | withdrawn |
| N25 | **The whole-trip film ends on a frame that cuts the island**: Madeira in the bottom half, the top half empty sea, the west cut (*orto Moniz*), the Porto Moniz roads off the edge. This is the frame people share | P30 screenshot | P2, fixed 27 Oct (T-290), the empty top the lead's call |
| N26 | At 160% text a **divider line runs through the payment note**: *"with ~~no subscription~~"* in English, *"einma~~lige Zahlung~~"* in German, reading as if the promise were struck out. And German at 160% breaks the unlock banner into *kostenl / ose Ste / mpel* (N16, worse) | emulator screenshots | P2; banner fixed (T-289), the line not reproduced |
| N27 | **Four touch targets under 48 dp** on the P30: the gold count badge 19 × 22 dp (over the passport button, which does something else), *Ver tudo* 19 dp tall, *Ver a tua viagem* 31 dp, the Settings switch 32 dp. Play's pre-launch report flags these. For: **every touchable control has a spoken label** on the three screens | `uiautomator`, 480 dpi | P3 |
| N28 | Refusing location still leads to step 5 (*Keep Bruma awake*) and the *don't close Bruma from recent apps* line, both pointless without location | emulator | P3 |
| N29 | The outing summary is Android's plain grey alert, not Bruma's design | emulator screenshot | P3 |
| N21 | **Explained:** the button ignores taps only while a start is in progress (`busy`), and ending asks for no confirmation, so a second tap a second or two after starting ends the outing. Not a crash; a design gap | `NativeMapScreen.tsx:876` | P3 |

**Good:** the film on 46,477 real fixes runs at **46.3 fps**, worst gap 66 ms, none over 100,
the same as T-279's 46; the trip viewer opens on the last day with its numbers; refusing location
skips the background step, as it should; English at 160% holds up in the passport.

### Revised rubric

| Area | Morning | **Revised** | Why |
|---|---:|---:|---|
| A | 15 | **15** | Unchanged |
| B | 13.5 | **12.5** | N23 turns the refusal path of the first run into a crash loop |
| C | 13.5 | **13** | N25 on the shareable film; N29 |
| D | 14 | **13.5** | A crash on every launch for a whole class of users, unseen for two months; N17 withdrawn on recheck |
| E | 12.5 | **12.5** | |
| F | 12 | **11.5** | N26 at 160%; for, every control labelled |
| G | 14.5 | **14.5** | The film and viewer hold up on real data |
| H | 11.5 | **11.5** | |
| **Weighted** | **13.63** | **13.28** | 3.0 + 1.875 + 1.95 + 2.025 + 1.25 + 1.15 + 1.45 + 0.575 |

13.3 (13.28) is level with 23 Oct's 13.33, but the drop is not new damage: N23 was there on 23 Oct too, and
that score would have been about as low had the refusal path been tried.

### Rechecks, 11:10 to 11:40

The lead asked how solid the emulator findings were. Each weak one was run again with a better
instrument: a debuggable emulator build whose database can be read, screenshots instead of text
dumps, a zoom probe with markers, and the P30 read again an hour later.

| Finding | Recheck | Verdict |
|---|---|---|
| N23, crash on refusal | Second build, second clean install, refuse all: `FATAL` again | **Holds** |
| N15, GPS at home | P30 at 11:11: still *driving*, fine GPS requested (now every 15 s), GPS held 5 min 27 s of 5 min 27 s since the battery reset, no fix all day | **Holds** |
| N17, zoom gaps | Four marked runs: none over 100 ms | **Withdrawn** |
| N24, silent stamp | Automatic and outing runs both showed *New stamp!* within seconds of the award | **Withdrawn** |
| N16, N26, large text | The emulator is 360 dp wide, like the P30, so the layout carries over; Huawei's font may move a word | Holds, emulator only |
| First run | Seen on Android 14; the P30 runs Android 10, whose permission screens differ | Unverified on Android 10 |

### Fixed, 27 Oct afternoon

The lead lifted the no-app-changes rule for these fixes only. One commit each.

- **N23, fixed (T-287).** The blue dot only with a location permission (`showsMyLocation`).
  Emulator, clean install, all refused: three launches, no crash, *Allow location* shown; granted
  in Android's settings and back: the blue dot. Testers need a new build.
- **N15, fixed (T-288), on the P30.** A launch starts on stationary unless a fix came in the last
  5 min; a still check with no position counts as still. A third cause found on the P30: a late read
  of the stored profile undid the launch's write. After the fix, at home, Bruma asks Android only for
  the stationary request. Still to see: a restart after a real drive, and a night at home.
- **N16 fixed, N26 half (T-289).** The unlock card's button goes under its words at large text,
  the status line shrinks to fit, the passport headers wrap. Seen in three languages at 130% and
  160%. N26's divider through the payment note did not come back in English or German at 160%,
  cold or with a live size change; nothing was changed for it.
- **N25 fixed (T-290), on the P30.** The closing frame widens its side margins from 24 to 40 dp,
  so the roads and *Porto Moniz* clear the edges. The top half is still sea: the lead's call.

- **Small fixes (T-291):**
  - the new-stamp pop-up counts the stamp's own island (`celebrationOnIsland`, tested): *1 / 81* for a Madeira stamp, *1 / 9* on Porto Santo, as the passport counts (D-109). Unit tested; not seen on a phone.
  - N19: English Settings' note says *Restore purchase*, as its button does.
  - N27: *Ver tudo* 56 × 49 dp, *Ver a tua viagem* 133 × 49, the Settings switch 52 × 48, measured on the P30 (`ui/touchArea.ts`, padding with an equal negative margin, tested; nothing moved). ⚠ **The gold badge only 31 × 26** (was 19 × 22): Android reports it clipped to the passport stamp it sits on, and 48 dp would give a quarter of the stamp's face to the unlock sheet. **The lead's call.**

## 6. MVP and publishing

**MVP: yes. Shippable beta: yes, it is in one, with N23 as an urgent fix.** **Publishable: no.** In order of risk: **N23**; **N15**;
the 14 days finishing with testers who actually used it; Huawei's warning on a day out alone;
Data safety and the listing; the pre-launch report; the purchase matrix; one trip ended on purpose.

---

# Part 2: What is left, in order

## 1. The target

| Area | Today | Target | What moves it |
|---|---:|---:|---|
| A | 15 | 16 | F5 passed (a day out after a quiet day, no warning), after N15; a trip ended with its souvenir |
| B | 12.5 | 14 | N23; a tester's first run from Play; N18 |
| C | 13 | 14 | N25; testers' remarks on the screens recorded; N19, N20 |
| D | 13.5 | 15 | N23; N15 fixed and seen on the P30 overnight; N17 understood; the pre-launch report |
| E | 12.5 | 15 | Data safety, listing, screenshots in three languages; the 14 days complete |
| F | 11.5 | 14 | N16, N26, N27; a TalkBack pass |
| G | 14.5 | 15 | An ended trip |
| H | 11.5 | 14 | The purchase matrix on a Play install |
| **Weighted** | **13.3** | **14.75** | ⚠ These targets sum to 14.75, not 15.0 as the 23 Oct plan said: 15 also needs A 17 and B, C 14.5 (§7) |

## 2. Decisions for the lead

1. **N23 needs an app change too, and first.** N23 is one line: turn the blue dot on only
   when location is granted (re-read when the app returns to the front). N23 with a test. Then a build for the testers, since a tester who said no to location cannot open
   the app at all.
2. **N15 needs app changes**, and the standing rule since 26 Oct is none. With N23 it is the
   reason to lift it: it drains testers' phones at home and invites Huawei's warning. Two small changes,
   both pure and testable: a restart begins on *stationary* and lets the first moving fix raise
   it; a still check that gets no position after the sensors said still counts as still.
3. **Which version code the testers have.** If it is 11 from 21 Oct, they have the restart half of
   N15 already.
4. **N22:** is *Incluído no teu passaporte* right for someone who has not paid?

## 3. The lead (field and Play Console)

1. **Tonight, if N15 is fixed:** leave the P30 at home overnight off the cable; the morning
   check is the diary and `batterystats`, no outing needed.
2. **F5,** after that: a quiet day then a day out with stops, the app never opened, SensorLogger
   from the door. Pass: no Huawei warning, the route near 90%. Then D-106 can be Accepted.
3. **T-205:** end trip 31 on purpose, make and share the souvenir once.
4. **Play Console:** Data safety, the listing text, and whether the pre-launch report has run.

## 4. The desk (me, under a day)

- **N23** · XS, once allowed. The blue dot only with permission; a unit test that the map
  properties never ask for it without; the refusal path rerun on the emulator.
- **The pop-up's island count** · XS. *1 / 90* and *Bronze passport!* for a Madeira stamp (carried).
- **N25** · S. The film's closing camera fits the trip's lines with the overlay's height reserved.
- **N26, N27, N28** · XS each.
- **N15** · S, once allowed. The two changes above, tests for both, then the P30 overnight.
- **N16** · S. The banner and the map's status line wrap or shrink cleanly at 130%; check German
  and Portuguese at 130% and 160% on the emulator.
- **N19, N20, N18** · XS each.
- **N17** · XS. Give `measure-map-zoom.sh` a marker per stroke (the scratch copy used today showed the need).
- **N21** · XS. Read the outing button's start and stop path for a second tap during start.

## 5. Release verification, for the next build to testers

The smoke test on the P30; one night at home with the diary showing *stationary* within minutes;
the first run on the emulator in all three languages at 130% text; **the first run with every
permission refused, then the app opened twice**; a replayed stamp on a clean install, expecting
the pop-up. The first would have caught N23, and the smoke test, which always runs on
a phone with every permission granted, never could.

## 6. Expected scores

| Step | Strict score |
|---|---:|
| Today, revised | 13.3 |
| N23 fixed and the refusal path rerun on the emulator | ≈ 13.6 (B 13.5, D 14) |
| N15 fixed and a night at home clean | ≈ 13.7 (D 14.5) |
| N16 to N20, N17 understood | ≈ 14.0 (C, D, F) |
| F5 passes, a trip ended | ≈ 14.4 (A 16, G 15) |
| Data safety, listing, screenshots, the 14 days done | ≈ 14.7 (E 15) |
| TalkBack, pre-launch report clean, purchase matrix | **≈ 14.75** |
| A 17 (several carried days, a levada, an update survived), B and C 14.5 (testers' first runs and remarks) | **≈ 15.1** |

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

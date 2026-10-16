# Bruma: Score and Plan, 2026-10-16

An interim review, on the same strict rubric as [`bruma-score-and-plan-2026-10-09.md`](bruma-score-and-plan-2026-10-09.md)
so the numbers compare, and the remaining order of work. **Part 1** is the score, **Part 2** what is
left to reach 15. It is not T-271 (the pre-launch review on a Play build with WalkNYC re-measured):
it is a checkpoint a week and 39 commits after the last one.

## At a glance

- **Score today:** **12.9 / 20** strict (was 11.9 on 9 Oct, 9.1 on 6 Oct, 6.7 on 24 Sep). WalkNYC ≈ 14.
- **Still a shippable beta** (10 to 13), at the top of that band; not yet publishable, not yet
  above WalkNYC.
- **What moved it:** automatic recording with the app closed now works on the P30 (three trips, 90
  to 98% of the route lit within 10 m, every start woken by motion); 12 stamps earned, none missed
  on the two measured days; the first battery figure; every desk item of the 9 Oct plan done (one
  km figure, quieter Google pins, the trip list, levada figures); the offer from the first day.
- **What holds it under 15:** nothing submitted to Google beyond a build, and the build on record
  for the closed track is one the project says must not reach testers; no trip ended; one battery
  day, ending in Huawei's *consumo excessivo* warning; no device but the P30; a slower cold start
  and more memory than on 9 Oct, not yet explained.
- **The single most valuable next thing:** confirm on the Play Console that **version 9**, not 7,
  is the closed-track build, then start the 14 days with 12 testers (Part 2, console step 1). It is
  the longest wait in the plan, and nothing else in it can start the clock.

---

# Part 1: The score

**Date:** 2026-10-16, 21:40 to 22:10
**Build reviewed:** `com.proa.madeira` 0.1.0, **version code 9, field build** (debuggable),
installed 2026-10-16 19:35 (`bec2c18`, no GPS at home). Debuggable, so timings are pessimistic, as
on 9 Oct.
**Device:** Huawei P30 (ELE-L29), Android 10, EMUI, `pt-PT`, the project lead's real data: 31 trips
(one open), 37,980 fixes, 12 stamps, *159 km de estradas acesas* on the passport. On the cable,
95%, cool (CPU 34 °C, thermal status 0).
**Nothing was changed.** Read `dumpsys batterystats` first (it still held the 16 Oct day), copied
the database with `run-as cat`, four force-stops for cold starts (the recorder's service was back
each time), the pan and zoom workload twice, the release smoke test, the passport read with
`uiautomator`, closed with Back. One screenshot, of the home.

## Verdict

| Rubric | 24 Sep | 6 Oct | 9 Oct | **Today** | WalkNYC |
|---|---:|---:|---:|---:|---:|
| **Strict: "a polished shipped app"** | 6.7 | 9.1 | 11.9 | **12.9 / 20** | ≈ 14 (indicative) |
| Original (22 Sep weights, for continuity) | 8 | 9.5 | 12.1 | **12.9 / 20** | n/a |

**The core promise now holds on the one phone there is.** On 9 Oct the largest open question was
whether the app records by itself in a pocket. It did not on 11 Oct; since the motion wake it has
on every trip measured, against an iPhone's track. That is the biggest single change in this
project since the August loan.

**What it is not yet:** submitted, or seen anywhere but the P30. The store side has barely moved
in a week, and the two measurements that went backwards today (cold start, memory) need a second
reading before anyone believes them, or dismisses them.

## 1. Method

The strict rubric of 24 Sep, 6 Oct and 9 Oct, unchanged: eight areas, each scored out of 20 against
anchors where WalkNYC is the "good shipped app" line (14 to 17). Every claim checked today on the
P30, in the database copy, in the code or in the field log's measured entries, not taken from
`TASKS.md`. The same workload (`tools/measure-jank.sh`: 9 pans, 2 double-tap zooms). WalkNYC not
re-measured; its scores carried from 24 Sep.

**Not done today:** first run on the device (seen end to end 5 Oct); German on screen; a TalkBack
read-through (never done); font scaling; outdoors (the lead's field entries stand for it); a
Play-installed store build; a purchase; the 3rd and 5th stamp offers fired by a real stamp (read in
the code and its tests only); EMUI's Settings path that the first run names (not opened); the
SensorLogger comparisons themselves (the field log's figures are taken as measured, not recomputed).

## 2. What changed since 9 Oct, verified

| Item | Now | Seen today |
|---|---|---|
| F1 automatic recording, app closed | ✅ **Works.** Failed 11 Oct; passed 12 Oct (94.5% once awake), 13 Oct 97.7%, 15 Oct 89.6%, 16 Oct 90.1% within 10 m, about 97% within 30 m | field log; diary: 13 wakes reached the app (12 by the motion sensor, 1 by activity updates), 6 *stationary to walking: the motion sensors say walking* since 13 Oct |
| The motion wake (D-106) | ✅ Native consumer and a pure policy with tests; D-106 still **Provisional** | `MotionWakeTaskConsumer` in the module, `recording/motionWakePolicy.ts`, decision text |
| Battery (T-054) | ◐ **One day:** 9 h 44 on battery, screen on 11 min, 93 to 74%. Android's estimate puts Bruma first: 664 mAh of an actual 621 to 694, 505 of it GPS | `batterystats` today, field log |
| Stamps | ✅ 12 (was 3), five on 16 Oct; none missed on 15 and 16 Oct | database copy, field log |
| Stamp notifications with the app closed (D-096) | ✅ Fired: two at 14:59:54 on 16 Oct | diary |
| Huawei's warning | ◐ Came again on 16 Oct after a full day. The first run now says not to tap *Forçar paragem*; no GPS at home since `bec2c18` (on the P30 since 19:35, no field result yet) | `strings.ts:203`, package install time |
| Paywall (D-105) | ✅ Offer at the 3rd and 5th stamps (`OFFER_AT_STAMPS`), the passport card: *7 carimbos teus à espera. Desbloqueia e vê-os a cores*; 7 of 12 stamps drawn locked | code, `uiautomator` |
| 9 Oct A: one km figure (D-101) | ✅ *60 km hoje* on the home, *159 km de estradas acesas em 10 dias* on the passport | `uiautomator` |
| 9 Oct B: trip list | ✅ The empty August row is gone; *10 dias de passeio · 12 carimbos*; the spoken labels have no "›" | `uiautomator` |
| 9 Oct C: the sqlite race | ✅ No `error` line since 9 Oct; one `db_retry` (13 Oct), recovered | diary |
| 9 Oct D: Google's pins (D-102) | ✅ No business pins on the home | screenshot |
| 9 Oct H: levada figures | ◐ 11 of 18 levadas carry a published route, km, time and difficulty | `content/pois.json` |
| T-177, the blank map, counted (T-259) | ✅ **82 of 83 openings drawn** since 9 Oct (median 1.5 s, 90% within 4.1 s). The one *not drawn* (9 Oct 13:13) was the probe counting background time, fixed that day | diary |
| Store | ⚠ Version 7 uploaded to the closed track 12 Oct; **version 9 built 13 Oct, its upload not recorded anywhere**. Nothing else submitted | `HANDOFF.md`, `TASKS.md` T-129 |
| Tests | ✅ **1,131 pass** (was 1,098), `tsc` clean, content valid (80 places, why-go 80 of 80, 3 warnings) | ran today |

## 3. The strict rubric

| Area | Weight | 24 Sep | 6 Oct | 9 Oct | **Today** | WalkNYC |
|---|---:|---:|---:|---:|---:|---:|
| A. Core promise proven in the field | 20% | 4 | 9 | 11 | **14** | 16 |
| B. First run and home | 15% | 7 | 10 | 12 | **13** | 13 |
| C. Craft: visual consistency, brand, detail | 15% | 6 | 8 | 12 | **13** | 13 |
| D. Reliability and performance | 15% | 10 | 10 | 13 | **13** | 16 |
| E. Store, legal and privacy readiness | 10% | 5 | 6 | 11 | **11** | 15 |
| F. Accessibility and localisation | 10% | 11 | 11 | 12 | **12** | 9 |
| G. Depth: history, stats, content | 10% | 7 | 9 | 13 | **14** | 14 |
| H. Business model working | 5% | 3 | 10 | 10 | **11** | n/a |
| **Weighted** | | **6.7** | **9.1** | **11.85** | **12.9** | **≈ 14.0** |

Working: 2.8 + 1.95 + 1.95 + 1.95 + 1.1 + 1.2 + 1.4 + 0.55 = **12.90**.

**Original rubric** (22 Sep weights): core loop 14 (20%), clarity 13 (15%), store 11 (15%),
monetisation 11 (10%), engineering 15 (10%), performance 14 (10%), polish 13 (10%), l10n/a11y 12
(10%) = 2.8 + 1.95 + 1.65 + 1.1 + 1.5 + 1.4 + 1.3 + 1.2 = **12.90**.

### Why each score

**A, 14 (was 11).** The largest move, and earned:
- **automatic recording with the app closed passed three times** after the motion wake: 97.7%,
  89.6% and 90.1% of the iPhone's route lit within 10 m, about 97% within 30 m, every departure
  woken by motion before the phone was 100 m from home. The misses are short (55 to 345 m), mostly
  on foot in central Funchal, where the fixes sat a median 22 m off;
- **stamps work in the field:** 12 earned, five in one day, by car and on foot, from the geofence
  and from the trace; on 15 and 16 Oct every curated place the iPhone spent time in was awarded;
- **a first battery figure,** measured honestly (started at 93%, so the P30's full-charge hold hid
  nothing), and confirmed today in `batterystats`.

Why not higher:
- **no trip has ended.** Trip 31 has been open since 24 Sep, 23 days; the souvenir has never been
  made from an ended trip (T-205);
- **the battery is one day,** and that day ended with Huawei's *consumo excessivo* warning and a
  *Forçar paragem* button that stops the recorder. Android's own estimate makes Bruma the phone's
  largest user that day, GPS for three quarters of it. The fix (no GPS at home) is installed but
  unproven;
- **untested:** a walk alone, a levada under canopy, Poupança since D-106, a phone restart, a Play
  update; D-106 is still Provisional;
- **39 NOT TUNED notes** (38 on 9 Oct).

**B, 13 (was 12).** The home reads cleanly: Google's businesses gone, the roads in deep orange
over the light map, *A registar automaticamente · 60 km hoje*, the passport button with *12/80* and
a gold *7*. Against: still no *where next* on the home, by the lead's decision (L4, 9 Oct), which
caps this area near 13; first run not re-seen since 5 Oct.

**C, 13 (was 12).** Three of the four craft findings of 9 Oct are closed (one km figure, the trip
list, the pins) and the fourth was decided (three button colours, D-103). The timelapse now plays
on the light map. Against: the passport's trip row still shows a "›" as visible text (no longer
spoken); the August trip shows *1 dia de passeio · 0 carimbos*, honest but a little odd beside the
current one; nothing in craft has been seen by anyone but the lead.

**D, 13 (unchanged).** Gains:
- **T-177 counted:** 82 of 83 openings drew the map, the 83rd a probe fault fixed the same day;
- **0.66% and 0.00% janky frames** on the two runs, p99 16 and 11 ms;
- the release smoke test passed today on every screen; no `error` in the diary since 9 Oct.

Losses, each unexplained today:
- **cold start 2.3 s** (2,324, 2,259, 2,297, 2,347 ms, all `COLD`), against 873 to 1,142 ms on
  9 Oct on the same kind of build. The log puts about 1.1 s before the activity is created. The
  build was installed two hours before; on 9 Oct it had been installed the evening before, and
  Android compiles an app's code overnight while charging. That is the likely reason, not a
  measured one. A stock app (Settings) started in 243 ms, so the phone itself was not slow;
- **memory 356 MB settled** after the workload (353 and 376 MB just after), against 279 MB. The
  data is larger (37,980 fixes against 28,276; 159 km lit against 56); not separated today;
- still **one phone**: every reliability claim here is the P30's, and no pre-launch report has run.

**E, 11 (unchanged).** In a week, one upload (version 7, closed track, 12 Oct). Data safety, the
background-location pack (T-123), the listing and its screenshots in three languages are where they
were. Worse than unchanged in one respect: **version 7 is the build the project's own notes say
must not reach testers** (it sees nothing at home with the screen off), and no record says version
9 replaced it. If testers opt in now, they get the build that failed F1.

**F, 12 (unchanged).** Plural and wording fixes (*um carimbo* is "it", not "them"); every
Portuguese string read today in *tu*, with spoken labels like *"Monte: já lá estiveste. Desbloqueia
o teu passaporte para veres este carimbo."* German still unread by a native speaker; no TalkBack
pass.

**G, 14 (was 13).** The levada figures (11 of 18, the PR routes, each from the published source,
with the reminder to check the trail is open), one consistent distance, the medal shelf now with
real counts (Funchal 5 of 14, Santa Cruz 3 of 4), a trip viewer of 10 days. Against: 7 levadas
without figures; no ended trip to look back on.

**H, 11 (was 10).** The offer now runs from the first day (D-105): the passport card, the 3rd and
5th stamp pop-ups, three places in colour when nothing waits. Read in the code and on screen, not
fired by a real stamp today. The purchase matrix (T-239) is still 2 of 18 rows; nothing sold to a
stranger.

## 4. New findings this round

| # | Finding | Evidence | Severity |
|---|---|---|---|
| R1 | **The closed track may hold the wrong build.** Version 7 was uploaded 12 Oct; version 9 was built 13 Oct "in place of 7", but no note says it was uploaded. 7 records nothing at home with the screen off | `HANDOFF.md`, `TASKS.md` T-129 | **P1** (P0 the moment a tester opts in) |
| R2 | **Huawei's battery warning after a day out**, with *Forçar paragem*, which stops recording. Android's estimate makes Bruma the day's largest user (664 mAh estimated, 505 of it GPS). The guidance line is in; the no-GPS-at-home build is unproven | `batterystats`, field log 16 Oct, `strings.ts:203` | **P1** for any Huawei visitor |
| R3 | **Cold start 2.3 s** against 0.9 s on 9 Oct, same kind of build, phone cool. Likely the fresh install, not proven | `am start -W` ×4, logcat | P2 until re-measured |
| R4 | **Memory 356 MB settled** against 279 MB on 9 Oct, with about a third more data | `meminfo` | P2 until re-measured |
| R5 | **Trip 31 open for 23 days**: no ended trip, no souvenir from one (T-205) | database copy | P2 |
| R6 | **The Huawei path differs between texts:** the first run says *Definições, Aplicações, Iniciação de aplicações*; the field log's checklist and `HANDOFF.md` say *Definições, Bateria, Iniciar aplicações*. Which one EMUI 12 shows was not checked | `strings.ts:203`, `field-test-log.md` | P3 |
| R7 | 39 NOT TUNED notes, one more than on 9 Oct | `grep` | P3 |
| R8 | A development row (`dev_poi_fixture`, from August) still sits in the lead's database. Nothing in the app reads it any more | database copy, `devPoiFixture.ts` has no caller | info |
| R9 | `levada-do-risco-start` and `levada-do-alecrim-start` 0 m apart, still (9 Oct F11) | validator | info |

## 5. MVP and publishing

**MVP: yes, and without the 9 Oct caveat.** Go somewhere with the phone in a pocket, get stamps,
see the roads lit, watch and share the trip: on the P30 that now happens with the app never opened.

**Publishable: no.** Left, in order of risk: the right build on the closed track and the 14 days
running (R1); a second battery day without Huawei's warning (R2); Data safety, T-123 and the
listing submitted; screenshots in three languages; the pre-launch report; the purchase matrix; one
ended trip.

---

# Part 2: What is left, in order

The 9 Oct plan's desk items are done; its field item F1 is answered. This replaces its order.
Task IDs are the project's; new work takes the next free IDs when it starts.

## 1. The target, area by area

| Area | Today | Target | What moves it |
|---|---:|---:|---|
| A. Core promise | 14 | 16 | A second battery day without Huawei's warning, one ended trip, a walk alone, a restart and a Play update survived |
| B. First run and home | 13 | 14 | First run re-seen on the current build; a Play install's first run seen by a tester |
| C. Craft | 13 | 14 | The trip row's visible "›", screens seen by testers, not only the lead |
| D. Reliability | 13 | 15 | R3 and R4 re-measured (and fixed if real), the pre-launch report, a second Android |
| E. Store and legal | 11 | 15 | R1, everything submitted, screenshots in three languages, the packet capture |
| F. A11y and languages | 12 | 14 | TalkBack pass, German read |
| G. Depth | 14 | 15 | Levada figures for the other 7, where a published source exists |
| H. Business | 11 | 14 | The purchase matrix on a Play install; one offer fired from a real stamp |
| **Weighted** | **12.9** | **≈ 15.0** | |

## 2. Decisions for the project lead

| # | Decision | Recommendation |
|---|---|---|
| L7 | **Which build is on the closed track** (R1), and is the 14-day clock running? | Upload 9 now if it is not there; the no-GPS-at-home change (version 10) can follow as an update once a day passes without Huawei's warning. Waiting for 10 costs days on the only clock that cannot be shortened. |
| L8 | **What the listing says about battery** once a second day is in (D-041). | State a figure only after two days agree, phrased as measured on one phone; until then say nothing, as now. |
| L9 | **The Huawei path** (R6): which words EMUI 12 really shows. | The lead reads it off the P30 once; the text follows the phone. |

## 3. The work

### Field (the lead, with the phone; I prepare and read)

**F2. A second carried day** · Lead, next day out · **first**
- As the field log's next test: Equilibrado, started below 100%, Bruma swiped away and never
  opened, SensorLogger all day, plugged in only at night. Screenshot Huawei's warning if it comes;
  tap nothing.
- **Me:** `batterystats` before anything else, the copy, `compare-sensorlogger.mjs`, the log entry.
- **Pass:** every start woken by motion with no GPS at home; no Huawei warning; the battery per
  hour within reach of 16 Oct's. Then D-106 can be Accepted and version 10 built.

**T-205. One trip to its end** · Lead
- *Terminar viagem* in the passport, then make, watch and share the souvenir once. A new trip opens
  at the next fix, so nothing is lost.

**F3. A walk alone, app closed** · Lead
- Walking is the slower start to detect; every wake so far was a walk that became a drive.

**F4. A restart, then a Play update** · Lead, on a Play install when one exists
- Whether recording and the motion wake come back without opening the app (T-210).

### Desk (me, about a day)

**A. Re-measure R3 and R4** · XS. Tomorrow morning, after the overnight compile: three cold
starts, the workload, memory settled. If they stay high, find what grew (the matched roads drawn,
the fixes loaded at start) before anything else on this list.

**B. R6, the Huawei path** · XS · ⇠ L9. One string in three languages, or the docs, whichever is
wrong.

**C. The trip row's "›"** · XS. Drawn as an icon rather than text.

**D. Levada figures for the other 7** · S. Only where a published source exists (D-041's rule);
otherwise the card stays without them, as now.

**E. Store screenshots, three languages** · S · ⇠ the listing approved. 6 per language from the
demo drive (`tools/make-demo-route.mjs`), never the lead's own trace.

**F. The packet capture** (T-264 / T-117b) · S. PCAPdroid on the P30 if the lead allows the
install; the Data safety answers rest on it.

**G. Tidy** · XS. R8's leftover row is the lead's data: leave it unless they say otherwise; the
NOT TUNED notes that F2 exercises get cited.

### The lead's console

1. **L7: version 9 on the closed track,** if it is not there, and the 12 testers opted in. The
   clock is 14 days from then.
2. **Approve the listing copy** (`docs/marketing-plan.md` §4); then desk E.
3. **Data safety** submitted from `docs/store-privacy-answers.md`, after desk F.
4. **T-123**: film shot 3 on the P30 (a day's roads with the app closed is now available), then
   submit.
5. **T-160a**: a native German reader.

### Release verification

**T-207** the pre-launch report (it runs on upload to a testing track); **T-239** the purchase
matrix on a Play install with a license tester, including one offer fired by a real 3rd or 5th
stamp; **T-271** the formal pre-launch review, with WalkNYC re-measured on the same phone and
workload. Then T-137.

## 4. Expected scores

| Step | Strict score |
|---|---:|
| Today | 12.9 |
| R1 settled, R3 and R4 re-measured and normal | ≈ 13.2 (E +1, D +0.5) |
| F2 passes, a trip ended | ≈ 13.6 (A to 16) |
| Phase 4 submitted, capture taken, screenshots in three languages | ≈ 14.2 (E to 15) |
| TalkBack and German, first run re-seen, levada figures | ≈ 14.6 (B, F, G) |
| Pre-launch report clean, purchase matrix done | **≈ 15.1** (C, D, H) |

**If F2 brings Huawei's warning back,** the battery work outranks everything below the first row:
a tourist whose phone tells them to force-stop the app on day one loses the product.

## 5. Appendix: raw evidence

- **Device:** `versionCode=9`, `DEBUGGABLE`, `lastUpdateTime=2026-10-16 19:35:07`; one foreground
  service before and after every force-stop.
- **Battery record** (since the 16 Oct unplug, 09:40:58): 9 h 44 m 55 s on battery, screen on
  10 m 58 s (18 times), light idle 78.5%; actual drain 621 to 694 mAh of 3,650; Bruma (uid 10242)
  estimated 664 mAh: GPS 505, Wi-Fi 83, CPU 63, wakelocks 13.
- **Cold start** (`am start -W`, process absent before each): `COLD` 2,324, 2,259, 2,297, 2,347
  ms. Settings (stock app) 243 ms. Logcat: process attach to `finishPreloaded` 1.1 s, activity
  created to *Displayed* 1.0 s.
- **Workload** (`tools/measure-jank.sh`), two runs: 151 frames, 1 janky (0.66%), p50 5, p90 8, p95
  10, p99 16 ms; 147 frames, 0 janky, p50 5, p90 7, p95 8, p99 11 ms. Memory 352.8 and 376.3 MB
  after each run, **356.5 MB** 25 s later (native heap 115 MB, Java heap 54, code 84, graphics 46).
- **Map drawn** (diary since 9 Oct): 83 *drawn*, 1 *not drawn* (9 Oct 13:13, the background-time
  fault); median 1.5 s, 90% within 4.1 s; from a cold open 745 to 3,326 ms in 12 of 13.
- **Database copy:** integrity ok; 31 trips, trip 31 open since 24 Sep; 37,980 fixes, the last
  2026-10-16 21:43 local; 12 stamps (3 from 4 to 6 Oct, 4 from 9 to 11 Oct, 5 on 16 Oct); `tracking_quality`
  balanced, `sampling_profile` stationary, `background_tracking` true.
- **Diary since 9 Oct:** 0 `error`, 1 `db_retry` (13 Oct, recovered), 4 `notification` (all
  stamps), 4 `outing`, 13 motion wakes logged (12 by the sensor, 1 by activity updates), 393
  billing checks *owned 0, unlocked false*, 1 *query failed: offline*.
- **Smoke test** (`--internal`): every screen opened, nothing crashed.
- **Tests:** 1,131 pass, `tsc` clean. **Content:** valid, 80 places, 11 of 18 levadas with figures.
- **Screenshot** (scratchpad, not committed): the home after the workload.

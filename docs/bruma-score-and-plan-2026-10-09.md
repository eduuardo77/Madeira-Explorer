# Bruma: Score and Plan, 2026-10-09

An interim review, on the same strict rubric as [`bruma-score-and-plan-2026-10-06.md`](bruma-score-and-plan-2026-10-06.md)
so the numbers compare, and the remaining order of work. **Part 1** is the score, **Part 2** what is
left to reach 15. It is not T-271 (the pre-launch review on a Play build with WalkNYC re-measured):
it is a checkpoint three days and 80 commits after the last one.

## At a glance

- **Score today:** **11.9 / 20** strict (was 9.1 on 6 Oct, 6.7 on 24 Sep). WalkNYC ≈ 14.
- **Now a shippable beta** (10 to 13), not yet publishable, not yet above WalkNYC.
- **What moved it:** performance fixed (0% janky frames, was 6.3%), the icon, one Portuguese voice,
  the trip list and viewer, why-go on 80 of 80, the policy complete and hosted.
- **What holds it under 15:** automatic recording (the default mode) has not worked on a moving
  test since it failed on 6 Oct; no trip ended; no battery figure; nothing submitted to Google yet;
  the purchase matrix not run.
- **The single most valuable next thing:** a ride on automatic recording, no outing, phone in a
  pocket, app never opened, iPhone alongside (Part 2, F1).

---

# Part 1: The score

**Date:** 2026-10-09, 10:05 to 10:20
**Build reviewed:** `com.proa.madeira` 0.1.0, **version code 4, field build** (debuggable, upload
key), installed 2026-10-08 19:58, source `95b6779`. Debuggable, so the timings below are pessimistic;
the store-build figures quoted beside them are from Gate P1 (2026-10-07 and 08), not re-measured today.
**Device:** Huawei P30 (ELE-L29), Android 10, EMUI, `pt-PT`, the project lead's real data: 31 trips,
28,276 fixes, 3 stamps, 56 km of road lit. Storage 43% free (was under 10%).
**Nothing was changed.** Screens opened, the map panned, one place card opened and closed with Back.
Four force-stops for cold starts; the recorder was back each time (one foreground service). The
database was read from a copy pulled by `run-as cat`, never swapped.

## Verdict

| Rubric | 24 Sep | 6 Oct | **Today** | WalkNYC |
|---|---:|---:|---:|---:|
| **Strict: "a polished shipped app"** | 6.7 | 9.1 | **11.9 / 20** | ≈ 14 (indicative) |
| Original (22 Sep weights, for continuity) | 8 | 9.5 | **12.1 / 20** | n/a |

**Clearly better, and now a shippable beta.** Every desk item of the last review's §6 is done or
decided: the replay, the jank, one voice, the icon, the place card, why-go, a list of trips. The
performance regression is gone, not just reduced: zero janky frames on the review's workload even on
a debuggable build. The newest screens (passport, trip viewer, place card) look like one app.

**What it is not yet:** proven. The core promise of the store listing is *it records by itself*.
The only moving test of that mode since the 6 Oct failures was an outing, which the user starts by
hand. And none of the paperwork has reached Google: every store item is a draft waiting on the
lead's console.

## 1. Method

The strict rubric of 24 Sep and 6 Oct, unchanged: eight areas, each scored out of 20 against anchors
where WalkNYC is the "good shipped app" line (14 to 17). Every claim checked today on the P30, in the
database copy or in the code, not taken from `TASKS.md`. The same workload (`tools/measure-jank.sh`:
9 pans, 2 double-tap zooms). WalkNYC not re-measured; its scores carried from 24 Sep.

**Not done today:** first run on the device (seen end to end 5 Oct, T-250), German on screen, a
TalkBack read-through (never done), font scaling, outdoors, a Play-installed store build, the release
smoke test (passed 7 Oct, not re-run).

## 2. What changed since 6 Oct, verified

| 6 Oct finding | Now | Seen today |
|---|---|---|
| D1 jank 6.3%, p99 32 ms | ✅ **0.00%**, p99 11 to 14 ms (two runs, field build); store build 0.00%, p99 10 to 12 (Gate P1) | `gfxinfo` |
| D2 replay opens on Côte d'Ivoire | ✅ Replaced by a trip viewer, a page per day, framed on the day's roads (D-099) | screenshot |
| F1 *tu* and *você* | ✅ *tu* throughout (D-098); every string read today in *tu* | `uiautomator` |
| F2 place card | ✅ Dark over the passport, municipality beside the name, why-go line | screenshot |
| D3 cold start 1.4 s | ✅ **873, 880, 1,142 ms** (field build, all `COLD`); store build median 471 ms (Gate P1). WalkNYC 760 to 813 | `am start -W` |
| N9 memory 326 MB | ✅ 290 to 300 MB after the workload, **279 MB settled** (field build); store build 274 to 280 | `meminfo` |
| P0-1 template icon | ✅ Gone (A2, T-257); notification icon is the app's own drawable | `dumpsys notification` |
| E1 paperwork | ⚠ **Drafted, nothing submitted.** Policy names the controller, explains purchases and what the map sends; `https://bruma.lol/privacy` answers 200; Data safety answers drafted (D-100); T-123 pack with 2 of 3 shots; listing copy pending the lead | `curl`, docs |
| E2 battery permission | ✅ Kept, with Google's policy text quoted (D-045, T-266) | docs |
| N1 home shows no progress | ⚠ *3/80* on the passport button (D-090). The map itself shows no place, collected or not (see §4, B) | screenshot |
| N2 no trip list | ✅ *Viagens* in the passport; any trip opens in the viewer, ▶ and *Partilhar* | `uiautomator` |
| N3 why-go 0 of 80 | ✅ **80 of 80**, three languages (`validate-content.mjs`) | card, validator |
| N7 four control styles | ✅ T-220 closed by the lead | screenshot |
| (new 7 Oct) recorder started twice | ✅ Once per launch (T-273) | code |
| (new 7 Oct) geofence storm | ✅ Migration 5 deleted 3,898 repeats; 14 rows left (T-274) | `sqlite3` |
| Tests | ✅ **1,098 pass** (was 1,045), `tsc` clean | ran today |

## 3. The strict rubric

| Area | Weight | 24 Sep | 6 Oct | **Today** | WalkNYC |
|---|---:|---:|---:|---:|---:|
| A. Core promise proven in the field | 20% | 4 | 9 | **11** | 16 |
| B. First run and home | 15% | 7 | 10 | **12** | 13 |
| C. Craft: visual consistency, brand, detail | 15% | 6 | 8 | **12** | 13 |
| D. Reliability and performance | 15% | 10 | 10 | **13** | 16 |
| E. Store, legal and privacy readiness | 10% | 5 | 6 | **11** | 15 |
| F. Accessibility and localisation | 10% | 11 | 11 | **12** | 9 |
| G. Depth: history, stats, content | 10% | 7 | 9 | **13** | 14 |
| H. Business model working | 5% | 3 | 10 | **10** | n/a |
| **Weighted** | | **6.7** | **9.1** | **11.85** | **≈ 14.0** |

Working: 2.2 + 1.8 + 1.8 + 1.95 + 1.1 + 1.2 + 1.3 + 0.5 = **11.85, given as 11.9**.

**Original rubric** (22 Sep weights): core loop 11 (20%), clarity 12 (15%), store 11 (15%),
monetisation 10 (10%), engineering 15 (10%), performance 15 (10%), polish 12 (10%), l10n/a11y 12
(10%) = 2.2 + 1.8 + 1.65 + 1.0 + 1.5 + 1.5 + 1.2 + 1.2 = **12.05**.

### Why each score

**A, 11 (was 9).** Two real gains:
- the **8 Oct motorcycle ride** on an outing: 99.6% of what was lit lies within 10 m of the
  iPhone's track, 93.7% of what was ridden was lit; the one miss (the first 790 m) is fixed
  (`30c273f`, an outing never samples as stationary), not yet seen on the phone;
- the **7 to 8 Oct overnight run**: the foreground service held 16 h 22 min while the phone sat in
  deep idle 92.6% of the time. Overnight survival, standing still, is now observed.

Why not higher:
- **automatic recording, the default and the listing's promise, has no successful moving test
  since 6 Oct**, when the return from the gym recorded nothing and the Poupança ride kept 29 points
  in 83 minutes. Both 8 Oct successes were outings. This is the largest open question in the app;
- **still no trip ended.** Trip 31 has been open since 24 Sep; the souvenir has never been made from
  an ended trip;
- **no battery figure**: the P30's charge counter reports a capacity of 1 mAh and the level sat at
  100%; `MEASURED_BATTERY_PERCENT_PER_DAY` is `null`, rightly;
- **38 thresholds still say NOT TUNED**, with two SensorLogger rides now in hand to tune from.

**B, 12 (was 10).** The home is quieter and better: one control language, *3/80* on the passport
button, a live status line, the app's own icon and splash, the map drawn about 3 s after the screen
opened (the diary's first T-259 reading, field build). Against:
- **the map shows no place at all.** Collected stamps were taken off on 4 Oct at the lead's request
  and uncollected ones since 24 Sep (D-085 reversed). A visitor opening the home sees their roads and
  a count, and nothing that says *where next*. WalkNYC's home is its progress;
- Google's own pins are still as loud as Bruma's lines (*Monte Palace Madeira* in green at the
  centre of today's opening view);
- the lit roads are framed low, in the band just above the controls (deliberate, `594d6a9`), so the
  island's empty centre takes the middle of the screen.

**C, 12 (was 8).** The biggest single move. The icon, one voice, the dark place card, the trip
viewer and the visual pass the lead closed on 8 Oct. Against:
- **two different kilometre figures for one trip, on neighbouring screens**: the passport says
  *56 km de estradas acesas*, the viewer says *81 km na viagem*. Both are honest (one counts each road
  once, the other counts what was travelled along lit roads, repeats included), but nothing on screen
  says so, and to a user one of them is wrong;
- **the trip list shows a row "23 de agosto a 24 de agosto de 2026, 0 dias · 0 carimbos"**, and the
  current trip as *3 dias* beside a date range of 16 days. Reads as a bug;
- Google's points of interest crowd the trip viewer (a garden, a shop, a viewpoint, each in its own
  colour) over the very roads the page is about;
- buttons still come in three treatments: green on the home, light blue with dark text on the place
  card, white pills on the viewer.

**D, 13 (was 10).** Measured today:
- **0.00% janky frames**, p50 5 ms, p99 11 to 14 ms, on a debuggable build;
- **cold start 880 ms median** (field build), 471 ms on the store build;
- **279 MB settled** after the workload;
- 1,098 tests, `tsc` clean; the release smoke test passed 7 Oct with the animated screens.

Also to its credit: three regressions were found and fixed by the project itself in two days (the
timelapse crash, screens under the status bar, a new visitor's first map failing to start).
Against:
- **the expo-sqlite race still surfaces**: on 7 Oct 14:14 the diary has *"control state:
  NativeDatabase.prepareAsync has been rejected ... cannot be cast to NativeStatement"*, after the
  `withStatement` fix, plus two `db_retry` lines since 7 Oct;
- **on EMUI's default launch setting, an update stops the recorder silently**, with no notice
  (T-258, measured 7 Oct). The defence is guidance in first run and Settings. A Play auto-update on
  a Huawei visitor's second day ends their recording without a word;
- T-177 (blank map) not yet proven, though it is now counted at every opening;
- no pre-launch report yet; no device but the P30.

**E, 11 (was 6).** Real progress, all of it still on paper:
- the policy names who is responsible, explains purchases and says what the map sends, in three
  languages, and is live at `bruma.lol/privacy`;
- the battery permission is decided with Google's text quoted;
- Data safety answers are drafted with Google's own words, and both open calls decided (D-100);
- the background-location pack is written with two of three video shots;
- feature graphic and 512 px icon built from the icon's own art.

Not yet:
- **nothing submitted**: Data safety, T-123 and the listing are all waiting on the lead's console;
- **the packet capture** (T-264 / T-117b) that the Data safety answers rest on has not been taken;
- **4 screenshots, English only**; Play wants them per language, the plan asks 6 to 8;
- the listing copy is still pending the lead's approval;
- the contact is a Gmail address (acceptable, `privacy@bruma.lol` is "later").

**F, 12 (was 11).** One voice is real: every Portuguese string read today is *tu*, and the lead read
the Portuguese (T-265). Content descriptions are thorough (*"Câmara de Lobos: já lá estiveste. Abrir
para ver no mapa."*). Against: German still unread by a native speaker; no TalkBack read-through ever;
each trip row's label ends in *"›"*, which a screen reader says aloud.

**G, 13 (was 9).** Depth arrived where the last review asked: a trip list, a viewer a page per day
with stamps, travelled and trip totals, ▶ a timelapse, sharing any trip, passport stats, why-go on 80
of 80, medals, the founder stamp. Against: the stats contradict each other (C); practical information
for levadas (length, time) is still missing, the thing a levada visitor needs most; directions were
dropped on purpose (D-055) and *Ver no mapa* stands in for them.

**H, 10 (unchanged).** Nothing changed in billing since 6 Oct. The 18-row matrix (T-239) has 2 rows
done; nothing has sold to a stranger; the founder window is null until release (deliberate).

## 4. New findings this round

| # | Finding | Evidence | Severity |
|---|---|---|---|
| F1 | **Automatic recording has no successful moving test since it failed on 6 Oct**; the 8 Oct successes were outings | `field-test-log.md`, diary (`outing started`) | **P0** for the claim, not for the code |
| F2 | **An update stops recording silently on EMUI's default launch setting** | T-258, 7 Oct | **P1** |
| F3 | **Two kilometre figures for one trip**: 56 km lit (passport) vs 81 km on the trip (viewer), unexplained | screens; `tripDays.ts:55` counts travelled metres with repeats | P2 |
| F4 | **Trip list rows that read as bugs**: *0 dias · 0 carimbos*; *3 dias* beside a 16-day range | `uiautomator` | P2 |
| F5 | **The expo-sqlite race still reaches the diary** after the `withStatement` fix: one `error` (*control state*), two `db_retry` | `recording_event` 7 and 8 Oct | P2 |
| F6 | Google points of interest crowd the trip viewer and the home | screenshots | P2 |
| F7 | Screen readers say *"›"* at the end of each trip row | content-desc | P3 |
| F8 | **The test log stopped on 6 Oct**: the overnight run (7 to 8 Oct) and the motorcycle ride (8 Oct) are in TASKS and commits but not in `docs/field-test-log.md`, which the plan made the record of every real test | file | P3 (docs) |
| F9 | **D-070 still says the map shows the places you earned**; since `594d6a9` (4 Oct) it shows none, and no decision records it | `NativeMapScreen.tsx:940`, `decisions-full.md` | P3 (docs) |
| F10 | Bruma is not on Android's battery-optimisation exemption list on the P30 (`deviceidle` user list empty). On EMUI the launch manager governs, so this may not matter; noted, not judged | `dumpsys deviceidle` | info |
| F11 | `levada-do-risco-start` and `levada-do-alecrim-start` are 0 m apart: one arrival, two stamps (the validator's own warning) | `validate-content.mjs` | info |

## 5. MVP and publishing

**MVP: yes, with one caveat.** Go somewhere, get a stamp, see your roads lit, watch and share the
trip: all of it now happens on a real phone, on an outing. The caveat is F1: if automatic recording
fails in a pocket, the MVP is "press *Começar passeio*", which is a different product from the one
the listing describes.

**Publishable: no.** Left, in order of risk: F1 answered; a battery figure or an honest absence of
one in the listing; Data safety, T-123 and the listing submitted; the packet capture; screenshots in
three languages; the pre-launch report; the purchase matrix.

---

# Part 2: What is left, in order

The 6 Oct plan ([`execution-plan-2026-10.md`](execution-plan-2026-10.md)) still holds; Phases 1 and 3
are done. This replaces its order for what remains, with this review's findings slotted in. Task IDs
are the plan's; new work takes the next free IDs when it starts.

## 1. The target, area by area

| Area | Today | Target | What moves it |
|---|---:|---:|---|
| A. Core promise | 11 | 16 | F1 answered, one ended trip, a battery figure, thresholds tuned |
| B. First run and home | 12 | 15 | A sense of *where next* on the home (decision L4), quieter Google pins |
| C. Craft | 12 | 15 | F3, F4, F6, one button treatment |
| D. Reliability | 13 | 15 | F5, the pre-launch report, T-177 counted, a second Android |
| E. Store and legal | 11 | 15 | Everything submitted, the packet capture, screenshots in three languages |
| F. A11y and languages | 12 | 15 | TalkBack pass, German read, F7 |
| G. Depth | 13 | 15 | Levada practical information; F3 fixed |
| H. Business | 10 | 14 | The purchase matrix on a Play install |
| **Weighted** | **11.9** | **≈ 15.2** | |

## 2. Decisions for the project lead

| # | Decision | Recommendation |
|---|---|---|
| L4 | ✅ **Decided 2026-10-09: no, the home stays as it is.** The lead had removed exactly this on 2026-09-24 (D-085: *"keep it simple, get inspired on WalkNYC"*) and kept that call; the next stamp is suggested on the trophy. Area B is accepted near 13 for it. **Does the home show a place to go?** It shows none since 4 Oct. B cannot reach 15 without some *where next*. | One quiet line or chip, the nearest uncollected place and its distance, only when within, say, 15 km. Drawn as options first; *no* is a legitimate answer, and then B stays near 13. |
| L5 | **The EMUI update risk (F2):** accept it with the guidance as it is, or add a line to the listing's Huawei note. | Accept, and say it once in the listing's help text. Nothing in the app can wake on EMUI's default. |
| L6 | **The two km figures (F3):** which number is "the trip"? | Show one: *km de estradas acesas* everywhere (it is the product), and drop travelled distance from the viewer's totals, or label it *percorridos, contando repetições*. |

## 3. The work

### Field (the lead, with the phone; I prepare and read)

**F1. Automatic recording, moving, untouched** · Lead, this week · **first, before anything else**
- A ride or drive of 20 min or more on **Preciso**, *registo automático* on, **no outing**, phone in
  a pocket with the screen off, **the app not opened** from leaving until the phone is back on the
  cable. SensorLogger on the iPhone alongside.
- Before: the checklist in `field-test-log.md` (launch setting manual, tier set and re-checked).
- **Me:** pull the copy, `node tools/compare-sensorlogger.mjs`, write the entry in the test log.
- **Pass:** at least 90% of the ridden route lit within 10 m. **If it fails,** it outranks every
  other item in this document: the recorder's sleep behaviour on EMUI becomes the work.

**T-054. Battery, a run that can show a number** · Lead
- Start at 80% or below (the P30 holds 100% and its counter is broken), a normal day on automatic
  recording, `batterystats` reset at the start and pulled at the end. Two runs, one moving.

**T-205. One trip to its end** · Lead
- Trip 31 has run since 24 Sep. End it with *Terminar viagem* in the passport (a resident has no
  airport), then make, watch and share the souvenir once. Screenshots of each.

**T-246. Tune from what is in hand** · Me. ◐ **2026-10-09:** the ten notes in `mapMatch.ts` and `motionGate.ts` now cite the two rides and the overnight run where those exercised them, and say what is still untested (canopy, walks, wild fixes, a lagging label); no value changed, as nothing measured argued for one. 28 notes elsewhere remain.
- Two SensorLogger rides exist (6 and 8 Oct). Tune what they support in `mapMatch.ts` and
  `motionGate.ts`; replace each NOT TUNED note (38 today) with a cited trace or a reason it stays.

**T-259. The blank map, counted** · Me, at the end of the week
- The diary now logs every opening. Count *drawn* against *not drawn after 20 s*; close T-177 or
  reopen it.

### Desk (me, about two days)

**A. One kilometre figure (F3)** · S · ⇠ L6. ✅ **Done 2026-10-09 (D-101):** home 19 km hoje, passport 65 km, viewer 19 km that day and 65 km the trip, read on the P30. Pure change in `tripViewerData.ts` / the passport stats,
a test that both screens give the same number for the same trip, checked on the P30 copy.

**B. The trip list says what it holds (F4, F7)** · S. ✅ **Done 2026-10-09:** trips with no viewer day are not listed (`tripList.withSomethingToShow`, tested); the count reads *dias de passeio* / *days out* / *Tage unterwegs*; each row has its own spoken label, no "›". Read on the P30: two rows, the empty August one gone. Hide trips with no road and no stamp (or one
quiet *"sem estradas acesas"*); *dias* defined as the viewer's days, or the label changed to say so;
*"›"* out of the content-desc. A pure test on `tripList.ts`.

**C. The sqlite race, the last door (F5)** · S. ✅ **Closed 2026-10-09, no code change:** the
*control state* error (7 Oct 13:14 UTC) went through `withStatement` and the retry; the race's
message had a third wording (*"doesn't contain valid id"*) that the retry learned in `453f444`,
committed three minutes later (14:17 local). Since then the diary has no `error`, and two
`db_retry` lines (7 Oct 11:08 was before; 8 Oct 10:44 after) are the retry recovering, as designed.
The scan was right: no call bypassed the guard. *Original note:* Find the *control state* read that reached
`prepareAsync` outside `withStatement` (the scan test should have caught it; find out why it did
not), route it through, extend the scan.

**D. Google's pins quieter (F6)** · S · Lead looks. ✅ **Done 2026-10-09 (D-102):** the lead chose B of three drawn on the P30, businesses off, attractions kept. In the map style: business points off, attractions
dimmed, on the home and the viewer. Options page first, as for every visual change.

**E. One button treatment** · S · Lead picks. ✅ **Settled 2026-10-09 (D-103): left as it is**, after blue-only and green-only were drawn on the P30. Green primary, text secondary, everywhere (place card
*Ver no mapa* included), or the lead's other choice.

**F. Docs (F8, F9)** · XS. ✅ **Done 2026-10-09:** the test log has 7 to 9 Oct and F1 as its next test (`ed6e912`); D-070 records the 4 Oct removal. The test log's entries for 7 to 8 Oct and 8 Oct; D-070 amended with the
4 Oct removal (or a new decision if the lead takes L4).

**G. The packet capture (T-264 / T-117b)** · S. ◐ **Partly 2026-10-09:** socket tables sampled over a smoke run: Bruma's uid talked to one Google LLC address only (TASKS T-264 has the limits); a full capture would need PCAPdroid on the P30. A launch, a map pan, the purchase sheet; only Google
hosts expected. The Data safety answers rest on it, so before the lead submits.

**H. Levada practical information (T-201 left)** · M. ✅ **Done 2026-10-09:** the eleven PR levadas show their published figures on the card (`docs/levada-practical-draft.md`, the lead's choices: distance as published, no price); every levada card says to check the trail is open (option a; PR7 and PR28 were closed that day). Length and time from IFCN's official figures
for the 18 levadas, on the place card. Only published figures, each sourced (D-041's rule applies to
facts as much as to battery).

### The lead's console (Phase 4)

1. **Upload version 4** (`Madeira-fieldwork/apks/bruma-0.1.0-vc4.aab`) to internal testing, after
   adding Google's re-signing SHA-1 to the Maps key.
2. **Approve the listing copy** (`docs/marketing-plan.md` §4); then I produce **6 screenshots per
   language** from the demo drive (`tools/make-demo-route.mjs`), PT and DE as well as EN.
3. **Data safety** submitted from `docs/store-privacy-answers.md`, after G.
4. **T-123**: film shot 3 on the P30 after F1 (a day's roads with the app closed is exactly F1's
   result), then submit.
5. **T-160a**: find a native German reader.

### Release verification (Phase 5, unchanged)

T-270's pop-up probe on the next real stamp; **T-207** the pre-launch report; **T-239** the purchase
matrix on a Play install with a license tester; **T-271** the formal pre-launch review, with WalkNYC
re-measured on the same phone and workload. Then T-137.

## 4. Expected scores

| Step | Strict score |
|---|---:|
| Today | 11.9 |
| Desk A to F done | ≈ 12.5 (C +2, F +1, D +0.5) |
| F1 passes, a trip ended, a battery figure, thresholds tuned | ≈ 13.5 (A to 15) |
| Phase 4 submitted, capture taken, screenshots in three languages | ≈ 14 (E to 15) |
| L4 built, levada information, TalkBack and German | ≈ 14.7 (B, F, G to 15) |
| Pre-launch report clean, purchase matrix done | **≈ 15.2** (D, H) |

**If F1 fails, every figure below the first row is wrong**, and the next review starts there.

## 5. Appendix: raw evidence

- **Device:** `versionCode=4`, `DEBUGGABLE`, `lastUpdateTime=2026-10-08 19:58:29`; one foreground
  service (`LocationTaskService`) before and after every force-stop.
- **Cold start** (`am start -W`, process absent before each): `COLD` 1,142, 873, 880 ms.
- **Workload** (`tools/measure-jank.sh`), two runs: 244 frames, 0 janky, p50 5, p90 10, p95 11,
  p99 14 ms; 260 frames, 0 janky, p50 5, p90 8, p95 10, p99 11 ms. Memory 300.7 MB before, 293.2
  and 290.5 after each run, 278.9 MB twenty seconds later.
- **Map drawn** 3,034 ms after the screen opened (diary, 8 Oct 19:58, field build).
- **Database copy:** 31 trips (30 ended, 29 by `left_bbox` in August, 1 manual; trip 31 open since
  24 Sep 20:47); 3 stamps (Praia Formosa and Câmara de Lobos 4 Oct, Camacha 6 Oct); 28,276 fixes;
  14 geofence events; `sampling_profile` stationary; `tracking_quality` balanced.
- **Diary, last 50 h:** 1 `error` (7 Oct 14:14, *control state*, prepareAsync cast), 2 `db_retry`
  (7 Oct 12:08, 8 Oct 11:44, both *released object, repeated once and succeeded*), outings 17:31 to
  18:30 and 18:54 on 8 Oct.
- **Google's `datatransport` store** in the app's databases: 0 events queued (the Maps SDK's
  telemetry queue, consistent with the Data safety draft's *Analytics* row).
- **Tests:** 1,098 pass, `tsc` clean. **Content:** valid, 80 places, why-go 80 of 80, 3 warnings.
- **Policy:** `https://bruma.lol/privacy` → 200 (redirects to `www`).
- **Screenshots** (scratchpad, not committed): home at opening, home after the workload, passport,
  trip viewer day 3, place card.

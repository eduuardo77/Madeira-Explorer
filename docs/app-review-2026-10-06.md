# Bruma: Third Review, against a high standard

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

## Verdict

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

## 1. Method

The strict rubric of 24 Sep, unchanged, so the numbers compare: eight areas, each scored /20 against
anchors where **WalkNYC is the "good shipped app" line (14 to 17)**. Every claim was checked on the
P30 or in the code today, not taken from `TASKS.md`. The same pan-and-zoom workload as last time
(9 pans, 2 double-tap zooms). WalkNYC was not re-measured; its scores are carried from 24 Sep.

**Not done:** onboarding on the device today (it was seen end to end on the P30 yesterday, T-250),
German on screen, a TalkBack read-through, font scaling, outdoors, and a store build from Play.

---

## 2. What changed since 24 Sep, verified

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

## 3. The strict rubric

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

### Why each score

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

## 4. New findings this round

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

## 5. MVP and publishing

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

## 6. To reach a shippable beta (10+), in order

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

## 7. Appendix: raw evidence

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

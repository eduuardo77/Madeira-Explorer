# Monetisation study plan — 2026-09-24

**What this is.** The plan for settling how Proa makes money **before the first public release**.
It is a plan, not a decision. The decision it leads to is **D-089 (Provisional)**, and nothing in
the app changes until the study below is done.

**Why now.** Nothing has shipped. Until the first public release, any free tier can be redrawn at
no cost. After it, anything taken away from free users is the rug pull D-072 exists to prevent —
*"a video that gets shorter, watermarked or lower-resolution in an update is the rug pull that earns
the worst reviews available"* (`decisions-full.md`, D-072 / T-159). **This study has one deadline:
the public release that D-084 gates on billing.**

**What was decided before this** (full story in `docs/monetization-options.md`):

| When | What | Where |
|---|---|---|
| 2026-08-17 | Break-even is $25; price is positioning, not revenue | monetization-options §1 |
| 2026-08-17 | Paid up front → withdrawn same day: Play forbids free→paid | D-072, §9 |
| 2026-08-17 | Research rated a **count** gate ❌ and a **geographic** gate ✅ | monetization-options §14 |
| 2026-08-17 | Under freemium, price costs no installs → €5.99–€7.99 | monetization-options §15 |
| 2026-08-17 | **Accepted:** 10 stamps + first levada free, €4.99 unlocks the rest | D-072 FINAL |
| 2026-08-17 | **Accepted:** the timelapse video is free | T-159 |
| 2026-08-18 | An earned-but-unpaid stamp shows **locked**, never "not collected" | D-075 (Provisional) |
| 2026-09-23 | No public release until billing works end to end | D-084 |
| 2026-09-24 | Billing library: on-device (`expo-iap`), not RevenueCat — chat recommendation | §3 Q8 below |

---

## 1. The working hypothesis — the project lead, 2026-09-24

> *"Very limited stamp collection and a timelapse with huge watermarks. For the map walked/been
> places I would keep it unlimited."*

| | Free | Paid (one unlock) |
|---|---|---|
| **Map of where you walked / been** | ✅ Unlimited, forever | same |
| **Recorder, trips** | ✅ Unlimited | same |
| **Stamps** | **Very limited** — N to be set by Q2 | All 80 |
| **Timelapse video** | ✅ Yes, with a **huge** watermark | Clean — with the brand mark D-013 needs (Q4) |
| **Still share image** | ⚠ Not stated — Q4 | ⚠ |

**What it changes from what is on record:**

- **D-072:** the free allowance drops from *10 + first levada* to *very limited*. The idea of
  counting stamps survives.
- **T-159:** the video stops being fully free. The free version exists, but watermarked. This is
  **additive, not a rug pull**, only because the video has never shipped: no user ever had a
  clean one.
- **D-013 is not changed, but it is under strain.** The video's watermark *is* the distribution
  strategy. A huge watermark makes each post louder and may make people post less (Q4).

**What it keeps:** §4 of the research, *never withhold a trip already recorded*. The map is the
trip, and it stays free. That is what makes a small stamp allowance defensible, where the research
rejected a count gate on its own.

---

## 2. What must not change, whatever the study finds

1. **The map of where you have been is never paywalled.** Not by trip count, days or area.
2. **An earned stamp is never erased.** Past the allowance it is *locked*, and it counts (D-075).
3. **Nothing given free after the public release is ever taken away.** From then on, any new
   limit only adds something on the paid side.
4. **No ads, no subscriptions, no accounts, no servers of ours** (D-001, D-031, research §17
   "Never").
5. **Google's attribution stays visible** in every video, free or paid (Geo Guidelines, T-105b).
6. **One purchase.** Whatever unlocks stamps also cleans the video, unless Q6 finds a strong
   reason for two products.

---

## 3. The questions

Ordered by how much the answer changes everything after it. Each one says what it decides, how it
gets answered **without changing the app**, and when it counts as answered.

### Q1 — How many stamps does a real visitor collect, and when? ⭐ decides N

**Why it comes first.** With 10 free, nobody knows whether anyone ever sees the paywall. With
"very limited", nearly everyone will — so the question becomes **when**: day one, before the
app has earned any trust, or day three, after it has.

**What a stamp takes** (`app/src/progress/stampRules.ts`): **3 min** inside the radius
(`MIN_DWELL_SECONDS = 180`), arriving at walking pace (`MAX_ARRIVAL_SPEED_MPS = 2.0`, so driving
past does not count), and **20 min** on a levada (`MIN_LEVADA_SECONDS`). The drive-by rule matters
most: a car tour through Madeira collects far fewer stamps than its route suggests.

**How to answer:**
1. **Desk model, days.** Write 6 typical itineraries as ordered lists of the 80 places, with
   a transport mode between each, and count stamps day by day under the rules above:
   - one-week hire car, "classic" (Pico do Areeiro, Porto Moniz, Cabo Girão, Funchal…)
   - one-week hiker (25 Fontes, PR1, Ponta de São Lourenço…)
   - long weekend, Funchal-based
   - cruise passenger, one day ashore
   - resident, one weekend
   - organised coach tour, 3 days

   ⚠ The itineraries come from public "Madeira in a week" guides, **not** invented. A small
   script over `content/pois.json` can do the counting; it is a tool, not app code.
2. **The project lead's real trip (T-205)**: the first real count ever.
3. **Closed beta (T-129)**: each tester reports their passport count and the day of their first
   stamp. There is no telemetry, so this is a question in the feedback form, and it stays that way.

**Answered when:** there is, for each itinerary, a *stamps by day* curve, and the real trip has
confirmed or broken at least one of them.

**Desk answer, 2026-09-24** (`node tools/stamp-days.mjs`, `--detail` for every stop). Eight
published itineraries, each with its URL in the tool. *low* counts the places a guide names; *high*
adds places whose geofence overlaps a stop's (Monte Palace sits inside Monte's circle).

| Itinerary | Stamps held at end of each day | Lock at N=3 | N=5 | N=10 |
|---|---|---|---|---|
| Hire car, one week | 3-4 · 9-13 · 10-14 · 13-17 · 17-22 · 20-25 · 21-26 | day 1-2 | day 2 | day 2-4 |
| Hiker, one week | 3 · 6 · 8 · 12-14 · 12-14 · 13-15 · 13-15 | day 2 | day 2 | day 4 |
| Long weekend, hire car | 6-9 · 12-17 · 15-20 | day 1 | day 1 | day 2 |
| Long weekend, no car | 2 · 4-5 · 6-7 | day 2 | day 3 | never |
| Hiker, long weekend | 1-2 · 3-4 · 4-5 | day 2-3 | never | never |
| Organised tours, 3 days | 4 · 7-8 · 11-14 | day 1 | day 2 | day 3 |
| Cruise, a day ashore (two tours) | 4-5 | day 1 | never | never |

What it says, before T-205 checks it:
- ⚠ **D-072's 10 is not generous for anyone with a car.** A hire-car visitor passes it on day 2
  to 4, a long weekend by car on day 2. The fear that "nobody reaches stamp 11" holds only for
  cruise passengers, visitors without a car and a hiker's long weekend.
- **N=3 locks nearly everyone on day 1**, before the first evening: the "before trust exists"
  row of Q2's table, now with numbers.
- **Q2's own target, the typical day-2 count, is about 6 to 8** (median of the day-2 column). N=5
  locks most car visitors on day 2 and never locks a cruise passenger.
- A cruise passenger collects 4 or 5 in the one day they have. Any N at or above 5 gives them
  everything they will ever earn for free, which may be the right answer: they cannot become a
  paying customer on a later day anyway.
- **Levadas arrive late.** Every week-long itinerary walks its first levada on day 3 to 6, so a
  "first levada" guarantee (D-072) mostly unlocks a stamp *after* the count lock has fallen.
- ⚠ Guides list highlights. A real visitor also stops at places no guide names, so the real
  curve is probably steeper than *low*. The model assumes every named stop is a stop on foot of
  3 minutes or more.

### Q2 — How limited is "very limited"? decides N

**The trade.** Too few and the user hits the lock before they know why stamps are fun. Too many and
the tourist leaves before hitting it (today's 10 may be this).

**Candidates to judge against Q1's curves:**

| Option | Shape | For | Against |
|---|---|---|---|
| **3** | First three, any kind | Everyone sees the lock on day 1–2 | Before trust exists |
| **5** | First five | Middle | Arbitrary number |
| **One per category** (5) | First viewpoint, levada, village, beach, landmark | Shows the whole passport before asking for money | More rules to explain |
| **First levada + 2** | The current guarantee, smaller | Keeps D-072's "first levada" promise | — |
| **Keep 10** | Status quo | No change | Q1 may show nobody reaches it |

**The rule for choosing:** the lock should appear **after the first moment of delight and inside
the trip**. A useful target is *the typical visitor's day-2 count*. Q1 gives that number.

**Answered when:** N is a number with a Q1 curve beside it.

### Q3 — What does the user see at stamp N+1? designs the paywall moment

The research's objection to count gates is *"you hit the wall mid-trip, having already walked."*
D-075 softens it, because the stamp is earned and counted, just locked. Still unstudied:

- The **exact screen** at N+1: stamp-earned animation, then padlock? A sheet? Nothing until the
  passport is opened?
- **The offer's wording.** It must not read as "you lost something". Draft in PT and EN, and read
  the Portuguese aloud to someone.
- **How often it may appear.** Once per stamp is nagging. A proposal to test: at N+1, at
  video export, and in the passport, nowhere else.
- **Offline.** A tourist in a levada valley taps *Buy*. Play needs a network to charge. The lock
  must say "you can unlock this later" rather than fail.
- **Restore** on reinstall or a new phone with the same Google account.

**How:** paper sketches → the workbench (`npm --prefix app run web`) where it already renders the
locked state → 5 people shown the sequence.
**Answered when:** one storyboard of the N+1 moment and its copy in PT and EN, reviewed by at least
3 people who are not the project lead.

### Q4 — The watermark: how big on free, and what stays on paid? ⚠ tension with D-013

**The tension, stated plainly.** D-013 says the video is how the app spreads: *"Watermarked,
clean, aesthetic."* The free video now carries a **huge** watermark to make people pay. Two things
can happen:

- the huge mark gets **more** brand exposure per post (CapCut's free-tier model), or
- people **stop posting** because it looks like an ad, and the distribution engine stops.

Nobody knows which, and it is the most consequential unknown here after Q1.

**Two things that follow already:**
1. **Paid cannot mean "no mark at all."** D-013 needs the brand on every shared video. Paid means
   *small, elegant mark*; free means *large mark*. The store copy has to say exactly that.
2. **The Google attribution is a separate mark** and stays in both (rule 5). The design must keep
   it out from under the huge watermark, and nobody has checked the replay's hero number against
   it yet (HANDOFF, T-105b).

**Also undecided:**
- **In-app replay (T-105e).** Watching your own trip in the app — should that be watermarked?
  *Recommendation:* no. The mark belongs on the **exported file**, the thing that leaves the phone.
  A watermark on a private screen only irritates.
- **The still share image (T-105d).** Free today, and D-013's lower-effort sibling. Same large
  mark? Hypothesis: keep it clean with the small mark, as the free advert.

**How:** draw three sizes — *small (paid)*, *medium*, *huge* — over frames from
`node tools/preview-film.mjs` (geometry only, no basemap) plus one real screenshot of the replay.
Ask 8–10 people who have posted a trip online: *"Would you post this one?"* Measure how much of the
frame each covers.
**Answered when:** one free and one paid mark specified in pixels and position, with the
"would you post it" answers beside them.

**Mock-ups drawn, 2026-09-24:** `node tools/preview-film.mjs --watermarks` writes
`tools/out/watermark-sizes.html`, three marks over the mid-film and final frames at 360 x 640:
*small (paid)* 0.9% of the frame, bottom right; *medium* 5.2%, lower third; *huge (free)* 14.3%,
tilted across the centre at 55% opacity. **All three stay clear of Google's attribution (bottom
left) and of the hero number**, measured as boxes. ⚠ No basemap in this renderer, so the mark is
seen against flat ground; the "would you post it" question wants a version over a real replay
screenshot, which needs a trip with a trace on the P30. **Still open:** the people to ask (the
project lead's), and their answers.

### Q5 — The video does not export yet ⚠ a dependency, not a design question

**The fact.** Exporting the timelapse to MP4 is **T-105b-v2**, an open spike: it encodes
**Google's** map, which renders on its own surface. `captureRef` over it is unreliable, and
`expo-maps` may not expose `snapshot()`. In-app **replay** exists (T-105e). An **exported
file** does not.

**So the second pillar of the hypothesis cannot ship until the spike is solved.** Two paths:

- **A — v1 sells stamps only.** The video paywall arrives with the video export. That is
  additive: nobody ever had a clean exported video, so a watermarked free one plus a clean paid one
  is not a rug pull. *Recommended*: it takes the spike off the release path.
- **B — v1 waits for the video.** Revenue gets a second pillar at launch, but the launch now
  depends on the riskiest technical item in the project.

**Answered when:** the project lead picks A or B. If B, T-105b-v2 moves into v1 scope with a
deadline.

### Q6 — Price, and how many products

- **Price.** €4.99 was set to protect installs on a *paid* listing, a reason the research's §15
  says no longer applies under freemium. Candidates: **€4.99 / €5.99 / €7.99**. WalkMe's entry
  price is $7.99; Fog of World is $29.99 (research §2). With a smaller free tier the paid version
  carries more, which argues upward.
- **One product or two** (stamps / clean video)? One is simpler to explain, restore and design,
  and matches rule 6. Two lets someone buy only what they care about. *Hypothesis:* one.
- **Regional pricing:** Play suggests local prices per country. Accept or set by hand?

**How:** desk only. Price the comparable apps again (the numbers in the research are from August),
then decide.
**Answered when:** one price, one or two products, written into D-089.

**Desk check, 2026-09-24.** Prices seen today:

| App | Model and price | Change since August |
|---|---|---|
| WalkMe, Madeira (App Store) | Free + Basic $7.99 · Week Pass $9.99 · Plus $14.99 · Explorer $49.99 | Week Pass was $8.99 |
| Fog of World | $29.99 one-off, Android and iOS | none |
| komoot | Regions (€3.99 one, €8.99 bundle) closed to new accounts since March 2025; Premium only | moved to subscription |
| MysteryHike (fog genre) | $6.99/month, $39.99/year, lifetime $59.99 to $79.99 | new here |

Recommendation, for the project lead's call:
- **€5.99, one product.** The closest competitor's cheapest unlock is $7.99, and its tourist
  product, the Week Pass, just rose to $9.99. €5.99 stays under both while charging for a free
  tier that now gives less. €7.99 is defensible too; €4.99 was set for a paid listing, a reason
  that no longer applies.
- **One product** (study rule 6). Nothing in the check argues for two.
- **Regional pricing: accept Play's conversions.** Buyers are visitors paying in their home
  currency, and a hand-set table is upkeep with no evidence behind it.

### Q7 — Can a small allowance still earn good reviews?

Write the three most likely 1-star reviews for the hypothesis, e.g. *"only 3 stamps free, then
pay"* and *"the video is covered in a watermark"*. Then check that the store listing already
answers each one: what is free is stated in the first line, and the free map is the headline.
**Output:** the listing's free/paid lines, drafted into `docs/marketing-plan.md`.

### Q8 — Billing library (mostly settled)

Recommendation from 2026-09-24: an **on-device** library (`expo-iap`, or `react-native-iap`), not
RevenueCat. Why:

- One non-consumable product, on one store.
- No accounts, so RevenueCat's cross-platform sharing does not apply.
- RevenueCat is free under $2.5K monthly revenue, so money is not the reason.
- RevenueCat would send every buyer's ID and purchase to a third-party server.

**Still to check before it is final:**
- `expo-iap` works with **Expo SDK 57**.
- Its Play Billing Library version meets Google's current minimum, and has a record of keeping up.
  Google moves that minimum on a deadline, and this is RevenueCat's genuine advantage.
- Refunds show up through a query at launch, with no server.
- It confirms each purchase to Google within the 3-day acknowledgement window.

**Answered when:** those four are checked against the library's docs and changelog, and the
choice goes into D-089.

**Checked, 2026-09-24.** `expo-iap` stands, with one caveat about refunds.
1. ✅ **Expo SDK 57.** Its setup page (openiap.dev) names SDK 57 with React Native 0.86 as the
   validated baseline, which is this app (Expo ~57.0.12, RN 0.86.2). Latest 5.6.3, 2026-09-19,
   seven releases in the last month. ⚠ The GitHub repository moved into the `hyodotdev/openiap`
   monorepo; the npm package is the same one.
2. ✅ **Play Billing Library v9.1.0.** Google's floor is v8 for any new app or update since
   2026-08-31, so it is one major version ahead of the requirement.
3. ⚠ **Refunds, without a server: partly.** Google documents the Voided Purchases API as the way to
   learn of a refund, and that is a server call with a service account, which rule 4 rules out.
   On the phone, `getAvailablePurchases` asks Play what is owned *now*, and the docs do not say
   whether a refunded one-time purchase drops out of it. **Accepted risk:** a single €5 to €8
   unlock, so the most a refund abuser can take is one price. Verify with a test refund once the
   upload key exists (T-187), and write down what was seen.
4. ✅ **Acknowledgement.** It is not automatic: the app must call `finishTransaction` after
   granting, or Play refunds the purchase after 3 days. Google also asks the app to query
   purchases at launch and on resume, to catch one completed while the app was closed. Both
   belong in T-156's spec.

### Q9 — Privacy and store paperwork

Billing is the app's first network call of its own (D-084). Regardless of the tier shape:

- privacy wording in `strings.ts`, `docs/privacy-policy.md` and `app.json`
- the Data Safety answers (T-122)
- the network checks, T-117b and T-127

all get restated. **Not a study question** — a checklist that follows Q8. Listed so it is not
forgotten.

### Q10 — Revenue expectations, re-run

Re-do research §7 with the hypothesis: a smaller free allowance means more people see the offer.
The research quotes hard paywalls at a median **12.1%** download-to-paid against **2.2%** for
freemium, and warns that the comparison is weak here (D-072). ⚠ **Every figure is modelled, not
measured.** Label it so, and do not quote it outside this document.

---

## 4. Order and dependencies

```
Q1 desk model ──► Q2 choose N ──► Q3 N+1 moment ──┐
      │                                            ├─► D-089 Accepted ─► build tasks
      └─► T-205 real trip confirms ──────────────┘         (T-156 billing, paywall UI,
Q4 watermark mock-ups ─► Q5 pick A/B ───────────────┘          T-106 watermark)
Q6 price · Q7 reviews · Q8 library check ───────────┘
Q9 paperwork follows Q8 · Q10 any time after Q2
```

**Nothing in `app/` changes until D-089 is Accepted.** Every question above is answered with desk
work, drawings, a tool script or people's opinions.

**Can start today, no dependencies:** Q1's desk model, Q4's mock-ups, Q6's price check, Q8's library
check.
**Needs the project lead:** Q2's N, Q5's A/B, Q6's price, and the people for Q3 and Q4.
**Needs a real trip:** Q1's confirmation (T-205).

---

## 5. When the study ends — what gets written where

When D-089 is Accepted (CONTEXT §9):

| Document | Change |
|---|---|
| `DECISIONS.md` + `decisions-full.md` | D-089 Accepted. D-072 marked **Superseded in part** (the allowance, maybe the price). T-159 marked superseded by the watermark rule |
| `CONTEXT.md` §8 | The OD-4 row gets the new free tier |
| `TASKS.md` | T-213 closed. Build tasks opened: allowance constant, N+1 moment, watermark (T-106), billing (T-156) |
| `app/src/entitlement/freeTier.ts` | `FREE_STAMP_ALLOWANCE` and `GUARANTEED_CATEGORY` — the only constants the allowance lives in |
| `docs/marketing-plan.md` | The listing says exactly what is free |
| `docs/privacy-policy.md`, `store-privacy-answers.md` | Q9 |
| `HANDOFF.md` | One line |

---

## 6. Not covered here

- **Geographic gating** (research §14's ✅): not the hypothesis. It remains the fallback if Q1
  shows a count gate reads badly.
- **iOS**: no Mac. Apple allows price changes both ways, so paid-up-front can be tested there later.
- **Printed souvenirs**: D-014, still deferred.
- **A second island** (research §16): not until one island has users.

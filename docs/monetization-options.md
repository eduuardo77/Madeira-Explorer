# OD-4 — How this app makes money

**Written 2026-08-17**, on the project lead's instruction to research it properly. Their stated
goal, in their words: *"I don't expect to bring huge revenue from this. I'm just looking forward to
break even and finally see some online money."* And: *"think like a premium app."*

Everything below is sourced. Where a number is a guess it says so.

---

## 1. The finding that changes the question

**Break-even is $25.**

| Cost | Amount | Recurring? |
|---|---|---|
| Google Play Console registration | **$25** | **One time, ever** |
| Apple Developer Program | **$99/yr** | Annual — *and only if iOS ships* |
| Google Maps SDK (map display) | **€0** | Unlimited free tier, already verified in `docs/competitors.md` |
| Servers, backend, analytics | **€0** | There are none (D-001, D-031) |
| Landing page domain (optional) | ~€10–15/yr | Only if OD-10 wants one |

This project **has no Mac and no iOS build** (HANDOFF). So the real, current cost of being in
business is **$25 once and nothing per year**.

At €4.99 with Google Play's fee, the app nets about **€4.24** per sale. Break-even is therefore
**six sales. Not six per month — six, ever.** Adding iOS later raises the annual bar to about
€99, which is **24 sales a year**, or one every fortnight.

⚠ **This means pricing is not a revenue decision. It is a positioning decision.** Any model on
this list "works" financially at the stated goal. So the right question is not *which earns most*
but **which one is worth being**, and which one does least damage to the two things this project
actually has: the privacy claim and the trace.

**Store fees, verified:**

- **Google Play changed on 30 June 2026**: 10% service fee on the first $1M, plus a **5% billing
  fee** in the US, UK and EEA when using Play billing → **15% total** for us. ([Play Console
  Help](https://support.google.com/googleplay/android-developer/answer/11131145?hl=en-EN),
  [analysis](https://ecorpit.com/google-play-service-fee-split-2026-app-economics/))
- **Apple Small Business Program: 15%**, for developers under $1M/yr in proceeds — which includes
  everyone new. ([Apple](https://developer.apple.com/app-store/small-business-program/))
- **Apple and Google are merchant of record for EU VAT**, Portugal included. They calculate,
  collect and remit it. **No VAT registration is needed for app-store sales** — the only duty is
  correct tax info in the console, and declaring the income in Portugal.
  ([guide](https://www.afternoon.co/blog/apple-app-store-sales-tax-guide))
  ⚠ **This is the single biggest reason to sell software and not objects.** See §5E.

---

## 2. What the competitor actually charges — and how big this market is

**WalkMe | Walking in Madeira**, the fourteen-year incumbent and the app `docs/competitors.md`
treats as the direct comparison:

| | |
|---|---|
| App price | **Free** |
| IAP — *Basic* | **$7.99** |
| IAP — *Week Pass* | **$8.99** |
| IAP — *Plus* | **$14.99** |
| IAP — *"Become an explorer!"* | **$49.99** |
| Rating | **4.8 ★ from 93 ratings** (US storefront) |
| Play installs | **100,000+**, and the listing claims 300,000+ worldwide |

Sources: [App Store](https://apps.apple.com/us/app/walkme-levadas-madeira/id577067362),
[Google Play](https://play.google.com/store/apps/details?id=com.walkme).

**Three things to take from this:**

1. **The paywall is their weak point.** A recurring complaint in their store reviews is that most
   features sit behind the purchase ladder. ⚠ **Softly sourced** — this came through a search
   summary of their listings rather than a review count I tallied myself, so treat it as a strong
   impression, not a measurement. `T-028b` (install WalkMe and look at it) is what would confirm
   it. If it holds, a **single honest price** is not merely a different pricing model, it is a
   *positioning attack* on the market leader.
2. **100,000+ installs over fourteen years** is the market's shape. That is roughly 7,000
   installs/year for the category leader, in a destination taking **1,407,400 guests in the first
   seven months of 2025 alone** (+9.7% y/y;
   [DREM](https://estatistica.madeira.gov.pt/en/download-now-3/economic/turismo-gb/turismo-noticias-gb/tourism-press-release-current-gb/5278-31-07-2025-in-june-2025-the-overnight-stays-in-tourist-accommodation-in-the-autonomous-region-of-madeira-increased-by-9-2-year-on-year-nearly-reaching-6-million-in-the-first-semester.html)).
   So the leader reaches well under 1% of visitors. **The ceiling here is low and the floor is
   reachable.**
3. **93 ratings** on the US store for the category leader. ⚠ Apple counts ratings per storefront
   and Madeira's visitors are mostly Portuguese, British and German (20.3% / 14.9% / 14.8% of
   overnight stays), so the true total is higher. But it still says this is a **small, quiet
   market where a good app can be noticed.**

---

## 3. The constraint nobody else on this list has

⚠ **A paid app requires no billing code. Any in-app purchase does.**

This matters more here than in a normal app, because of what this project has promised:

- **A paid-up-front app** is bought in the *store*, outside our binary. There is no billing
  library, no receipt validation, no purchase state, **and not one network call added to our app.**
  ⚠ **CORRECTED 2026-08-17: this originally said T-117b and T-127's "zero outbound requests" would
  stay literally true. That was already false when written.** D-057 moved the app to Google's map,
  which streams tiles — its own text says *"the app makes no network requests at all, and that is no
  longer true."* The narrow point survives (billing adds requests **on our account**, tied to a
  purchase); the absolute claim was spent in August. See `docs/marketing-plan.md` §0.
- **Any IAP** means Play Billing and StoreKit inside the app. StoreKit 2 can validate on-device
  via JWS with no server of ours ([Qonversion](https://qonversion.io/blog/storekit-2-capabilities-deep-dive)),
  which is genuinely good news for D-001 — but Play's `queryPurchasesAsync` **makes a network call
  when its local cache expires** ([Adapty](https://adapty.io/blog/retrieving-active-in-app-purchases-and-subscription-change-for-android/)).

So adding IAP does **not** break *"we collect nothing"* — no data of ours leaves the device. It
**does** break *"this app makes no network requests"*, which is the stronger and more memorable
version of the claim, and the one written into `docs/store-privacy-answers.md`, D-044 and the
Data Safety form.

⚠ **That is a decision, not a detail.** It would need D-043's network audit re-run on the billing
libraries, and the privacy copy reworded from *"nothing leaves your phone"* to *"nothing leaves
your phone except a purchase you started"*. Recoverable, but it is a real cost paid in the one
currency this project is rich in.

---

## 4. What must never be paywalled

Whatever model is chosen, one rule follows from D-009 and from the whole point of the app:

> **Never withhold a trip the user has already recorded.**

Someone spends seven days walking the island and the app has been quietly filling a map. If a
paywall appears *at the end*, between them and the thing they earned, that is not a business model
— it is a hostage situation, and it is the single fastest way to earn the review WalkMe already
gets. The paywall, if there is one, must be visible **before** the trip, not after it.

This rules out the most "efficient" freemium design (record free, pay to see the result) on
principle, and the recommendation below respects it.

---

## 5. The options

### A. Paid up front, one price, no IAP

⚠ **Recommended in Part 1 and SUPERSEDED by Part 2 §12.** Kept as written, because the
reasoning is still sound on its own terms and the reversal turns on facts the project lead
supplied afterwards — not on an error here.

Buy it, own it. No free tier, no unlock, no upsell, no tip jar.

- **Break-even:** six sales at €4.99.
- **Premium:** highest available. This is the App Store equivalent of a well-made object, and it
  is the *only* option that never asks the user for money twice.
- **Privacy:** unique to this option — **zero billing code, zero added network calls.** The
  project's central claim survives intact and stays testable.
- **Cruelty risk:** none. Nothing is ever withheld from a recorded trip (§4).
- ⚠ **Its real cost: nobody can try it.** Neither store offers a trial for a paid app. Combined
  with OD-10 — where discovery is *already* the biggest open problem and the recommendation is not
  to launch yet — a paid app makes a hard problem harder.
- ⚠ **Mitigation that costs nothing: promo codes.** Both stores issue them free. Testers, hotel
  partners, the first real trips (T-129) all get in without weakening the price.

### B. Free, one non-consumable unlock — **the credible alternative**

Free to install and genuinely usable in **one municipality** (Funchal, say); one purchase unlocks
the island.

- **Why this shape and not a time limit:** a geographic boundary is honest and demonstrable — you
  really use the app, on a real walk, before paying — and it never takes away something already
  earned (§4).
- **Evidence it converts better:** hard paywalls median **12.1% download-to-paid** versus **2.2%
  for freemium**, and hard-paywall apps show ~5× the paid conversion and ~8× revenue per install
  with essentially identical one-year retention (27% vs 28%)
  ([benchmarks](https://dev.to/paywallpro/global-subscription-app-conversion-benchmarks-3c75),
  [CatDoes](https://catdoes.com/blog/free-trial-vs-pay-upfront)).
  ⚠ **Read that carefully** — it compares *in-app* paywall styles, not "paid listing vs free
  listing". It is evidence that a *firm* boundary beats a leaky one; it is **not** evidence that a
  paid app out-earns a free one at the store level.
- **Costs:** the billing libraries, the network calls, the privacy rewording (§3), plus paywall
  UI, restore-purchase handling and a second app state to test.

### C. Free app, paid souvenir

The app is free and complete; you pay for the end-of-trip artefact (the video, T-105b-v2, or a
high-resolution still).

- **The appeal is real:** it charges at the moment of maximum value, and it charges for the thing
  that took the most work.
- ⚠ **But it taxes the only growth mechanism the project has.** D-013 makes the souvenir *the
  distribution strategy* and D-063 brought it back into v1 for that reason. Charging for the thing
  that is supposed to spread the app is throttling the engine to sell fuel.
- **Verdict: not now.** Reconsider only if the souvenir turns out *not* to drive installs, which is
  exactly what T-136 is written to measure.

### D. Tip jar — "support the developer"

Explicitly permitted: *"Apps may use in-app purchase currencies to enable customers to 'tip' the
developer"* ([App Review
Guidelines](https://developer.apple.com/app-store/review/guidelines/)).

- Honest, never cruel, and would plausibly cover the $25.
- ⚠ **But it is not premium.** A well-made object does not ask for change. And it still drags in
  the billing library and its network calls (§3) for the least revenue on this list.
- **Verdict: no.** If money is worth taking, it is worth pricing.

### E. Printed poster / physical souvenir — **keep deferred (D-014 was right)**

The original OD-4 idea, and the research makes the case against it much stronger than "not yet":

- Print-on-demand base cost for a large giclée print is **~$11 cheapest to $16+**, before shipping
  ([comparison](https://www.printondemandbusiness.com/printful-vs-gelato/)). Retail would need to
  be €35+ to leave a margin worth the trouble.
- ⚠ **And selling a physical object makes *us* the merchant of record.** Everything the app stores
  do for free in §1 becomes ours: **VAT registration**, EU consumer law and its 14-day right of
  withdrawal, shipping, damage, returns and support.
- **Verdict: this is a business, not a feature.** For a break-even goal it is the worst option on
  the list — the most operational burden and the only one that can lose money.

### F. Partner / B2B codes

Hotels, quintas and rental agencies buy or are given promo codes for guests. Ties directly to
OD-10's option B, which is the only channel that fires at *arrival* — the moment that matters,
since the app must be installed on day one to have anything to show on day seven.

- **Verdict: not a model on its own, but the natural companion to A.** Promo codes are free, and
  they turn a paid app's weakness (no trial) into a partner's giveaway.

### G. Ads

**Ruled out and not reopened.** They would destroy the privacy position that D-001 and D-031 exist
to protect — the one thing the competitor cannot copy.

---

## 6. Recommendation (Part 1 — see §12 for the revised one)

⚠ **Superseded.** Read §9–§12 before acting on this section.

**Paid up front, Android first, €4.99, no IAP of any kind in v1. Free promo codes for testers and
partners.**

The reasoning, in order of weight:

1. **It is the only model that keeps the app's central claim literally true.** No billing library,
   no receipt validation, no network call added — so *"nothing leaves your phone"* stays a
   verifiable statement rather than a nearly-true one. That claim is this project's only real
   moat, and every other option spends some of it.
2. **Break-even is six sales.** At the stated goal, no other model is *financially* better in any
   way that matters. So the deciding factors should be dignity and risk, and A wins both.
3. **It attacks the incumbent where it is weakest.** WalkMe is free with a $7.99 / $14.99 / $49.99
   ladder and takes review damage for it. "One price, everything included, nothing collected" is a
   sentence that sells itself against that.
4. **It cannot be cruel.** §4's rule is satisfied by construction rather than by careful design.
5. **It is the least code.** Nothing to build. No paywall screens, no restore flow, no purchase
   state, no second app configuration to test. For a solo project that has not yet completed one
   real trip, the cheapest monetisation is the one with no implementation.

**On the price:** €4.99 is deliberate. It is a real price rather than an impulse tier, it is a
third of WalkMe *Plus*, and it is under their entry IAP. ⚠ A premium instinct says €6.99–€7.99, and
the argument against is not revenue — it is that this app's scarcest resource is **real trips
recorded**, and every euro of price costs installs the project needs more than it needs money.
Revisit after the first ten real trips (T-134).

**What I would not do yet:** decide anything about IAP, the souvenir video's price, or the poster.
All three depend on facts that do not exist — whether the souvenir drives installs (T-136), what
the video costs to build (T-105c), and whether anybody finishes a trip at all.

---

## 7. Honest expectations

⚠ **Modelled, not measured.** The only anchors are WalkMe's ~7,000 installs/year and Madeira's
~2.4M annual guests.

| Scenario | Sales, year one | Net at €4.99 |
|---|---|---|
| No channel at all, store listing only | 10–50 | €42–€212 |
| One partner route working (OD-10 B) | 100–300 | €424–€1,272 |
| The souvenir actually spreads (D-013) | unknowable | — |

**Break-even ($25) is very likely. Meaningful revenue is not**, and that is consistent with the
goal as stated. The realistic prize is a few hundred euros a year, an app that pays for itself, and
the thing the project lead actually asked for: *finally seeing some online money.*

---

## 8. What this needs from the project lead

1. **Model:** confirm A (paid up front) or pick B.
2. **Price:** €4.99, or override.
3. **Whether iOS is worth $99/yr** before a single Android trip has been completed. My view: no —
   Android first, and let the €99 wait until there is evidence anybody wants it.
4. **Whether the paid listing should wait for OD-10.** A paid app with no discovery channel sells
   to nobody; that is not a reason to make it free, it is a reason to sequence the two together.

---

# Part 2 — Reversibility, and every remaining option

**Added 2026-08-17**, after the project lead pushed back on paid-up-front with the right objection:
*"I'm afraid I won't get any downloads and would have to invest more in marketing and not using the
play store organic growth potential. 25€ loss is something I definitely can live with. I just need
some proof before jumping to iOS where the big market is."* Plus: *"my marketing skills are quite
limited, the only bright side is that it would be good for learning."*

## 9. "Is starting with one strategy and changing it later a bad move?"

**It depends entirely on the direction, and Google Play makes one direction impossible.**

Quoted from [Play Console Help](https://support.google.com/googleplay/android-developer/answer/6334373):

> **"Once your app has been offered for free, the app can't be changed to paid."**
>
> **"You can change your app from paid to free."**

To charge for an app that launched free, you must **create a new app with a new package name** —
a new listing, zero reviews, no ranking history, and every existing user stranded on the free one.

Apple is the opposite: prices can be scheduled and changed in either direction once the Paid Apps
Agreement is accepted ([App Store
Connect](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/)).

### The reversibility matrix

| Launch as | Can become | Cannot become | Still available later |
|---|---|---|---|
| **Paid (Play)** | Free, any time | — | IAP, price changes |
| **Free (Play)** | — | **Paid, ever** | IAP, price changes |
| **Either (Apple)** | Anything | — | Everything |

⚠ **So the intuition "start free, charge once it is good" is the one path Google forbids.** And the
instinct that paid-up-front is the risky, hard-to-undo choice is **backwards** — on Play, paid is the
*reversible* option and free is the permanent one.

⚠ **There is a second cost that is not in the store rules: the rug pull.** Adding a paywall to an app
people already use free earns the worst reviews there are, and this project cannot afford them. So
"free now, charge later" is only clean if the later charge is for something **additive that did not
exist before** — never for something taken away. That single constraint shapes §12.

## 10. What the discovery objection is actually worth

The project lead's fear is correct in direction. The size of it:

- **97% of Android apps are free** (Sept 2025), and Play's top charts are **split into free and
  paid**. A paid app competes in the 3% pond: far less traffic, and also far less competition.
- **~65% of installs start with a search**, which makes ASO the highest-leverage zero-budget channel
  there is ([App Radar](https://appradar.com/academy/what-is-app-store-optimization-aso)).
- **Ranking is behavioural, not just metadata.** Install velocity plus retention explain most Play
  ranking movement; **uninstall rate is the most heavily weighted negative signal**; and **Android
  Vitals is now folded directly into discovery weighting**
  ([AppFollow](https://appfollow.io/blog/aso-ranking-factors),
  [vmobify](https://vmobify.com/blog/google-play-algorithm-2026)).

⚠ **That last point matters most here, and it is not about money at all.** Play rewards apps that are
installed, kept, and do not crash. This app has **never run on real hardware**, has no measured
battery figure, and has never survived a night of Doze. A paid launch with no installs produces no
ranking, no retention data and no revenue — **the worst of the three outcomes.** A free launch at
least produces the data everything else depends on.

### The iOS assumption needs correcting

*"iOS where the big market is"* is half right. By **users** in Europe iOS is the minority: **UK
roughly 50/50**, **Germany ~39% iOS**, **Western Europe ~32% iOS**
([Statista](https://www.statista.com/statistics/262179/market-share-held-by-mobile-operating-systems-in-the-united-kingdom/),
[comparison](https://www.mobiloud.com/blog/android-vs-ios-market-share)). iOS is the
**higher-spending** market, not the bigger one.

Against Madeira's actual visitor mix — Portugal 20.3%, UK 14.9%, Germany 14.8% of overnight stays —
**Android-first covers the Portuguese and the German majority; iOS mainly unlocks about half the
British slice.** Worth $99/yr eventually, not first.

## 11. Every option, with pros and cons

### The four that are live

**① Paid up front** — €4.99, no IAP.

| Pros | Cons |
|---|---|
| No billing code, **no network call added** — privacy claim stays literally true | ⚠ Forfeits organic discovery in a 97%-free store |
| Premium by construction; never asks twice | No trial possible on either store |
| **Reversible** to free on Play | With limited marketing, plausibly **near-zero installs** |
| Cannot be cruel (§4) | No installs → no retention, no ranking, no proof |
| Six sales breaks even | Risks yielding **neither** money nor data |

**② Free, no IAP at all in v1** — monetise later, additively. ⭐ **now recommended**

| Pros | Cons |
|---|---|
| Full organic discovery; competes where the traffic is | ⚠ **Forecloses paid-up-front on Play permanently** |
| **Still zero billing code**, so v1's privacy claim stays literally true and T-117b/T-127 verifiable | No revenue in v1 — "some online money" is deferred |
| Maximises what the project needs most: installs, retention, real trips (T-134) | Later monetisation must be **additive**, or it is a rug pull |
| €25 is the entire downside, which the project lead has accepted | Requires discipline not to paywall what was free |
| ASO becomes the learning project, at zero cost | |

**③ Free + one non-consumable unlock** — geographic, not temporal.

| Pros | Cons |
|---|---|
| Discovery of free, revenue of paid | Billing libraries → **network calls** → privacy copy reworded (§3) |
| Best-evidenced converter (12.1% vs 2.2%, §5B) | D-043's audit must be re-run |
| Boundary is honest: use it on a real walk before paying | Paywall UI, restore flow, a second app state to test |
| Prices fully changeable, addable at any time | If added after a free v1, must not remove anything |

**④ Partner / B2B codes** — companion to any of the above.

| Pros | Cons |
|---|---|
| Promo codes are **free** on both stores | Depends on outreach the project lead may not want to do |
| Fires at *arrival*, the only moment that matters (OD-10) | Not a model on its own |
| Turns a paid app's lack of trial into a partner's giveaway | |

### The rest, briefly

| Option | Verdict |
|---|---|
| **⑤ Free + tip jar** | Permitted by Apple and would cover the $25 — but a well-made object does not ask for change, and it drags in billing for the least revenue on the list. **No.** |
| **⑥ Subscription** | Wrong shape entirely: this app is used for one week of one holiday. A recurring charge for a one-week product is what users punish hardest. **No.** |
| **⑦ Ads** | Destroys the position D-001/D-031 protect. **Never.** |
| **⑧ Printed poster / print-on-demand** | The project lead's own read — *"an idea but for the long term future, not now"* — matches the research: it makes us merchant of record (VAT, EU withdrawal rights, shipping, returns) and is the only option that can lose money. **Deferred; D-014 stands.** |
| **⑨ Paid app plus a separate free "Lite"** | Play permits two package names. Doubles listings, builds and review surface for a solo dev, and splits ranking signals across two apps. **No.** |
| **⑩ Google Play Pass** | Google pays from a pool for bundled apps; entry is by application and aimed at established titles. Nothing to lose by applying **much later**. **Not now.** |
| **⑪ Sponsorship** (tourism board, a hotel group) | Real money and real strings: a sponsor eventually wants placement, data, or editorial say over the curated 60 — which is D-064's selection principle and D-001's privacy in one go. **Only under a contract forbidding all three.** |
| **⑫ Licensing / white-label** the content pack | Plausible long-term B2B, and the pack (T-066a) is the asset. Needs a buyer, and OSM's licence constrains redistribution. **Long term.** |
| **⑬ Regional pricing** | Cheaper in Portugal, higher in the UK and Germany. A refinement of ① or ③, not a strategy. **Later.** |
| **⑭ Off-store donations** (Ko-fi, GitHub Sponsors) | Store rules restrict linking to outside payment for digital goods; a plain "support" link is safer but earns little. **Marginal.** |

## 12. The revised recommendation, and what changed my mind

**Ship v1 free on Google Play with no in-app purchases at all. Make the first paid thing the souvenir
*video* — something that does not exist yet, so nothing is ever taken away.**

⚠ **This reverses Part 1, and it should be clear why**, because the earlier reasoning was not wrong on
its own terms. Part 1 optimised for *break-even and dignity*, which paid-up-front wins. Two things
the project lead then supplied change the weighting:

1. **Installs are the binding constraint, not money.** They can absorb the €25 and they need *proof*
   before iOS. Proof means installs, retention and Android Vitals — all of which a paid launch may
   produce **none of**. A model yielding neither money nor data is worse than one yielding data now
   and money later.
2. **Marketing skill is limited, by their own account.** Paid-up-front is precisely the model that
   *requires* marketing, because it forfeits the organic channel. Recommending it to somebody who has
   said they cannot yet market is recommending a plan that depends on the one thing they lack.

**Why the foreclosure is acceptable.** Going free costs paid-up-front on Play **forever** — a real,
irreversible loss. But it is an option unlikely to be exercised profitably: by the time there is
proof, IAP is the flexible route anyway, and **iOS is where paid can be experimented with freely**,
because Apple allows price changes in both directions.

**Why v1 carries no IAP at all.** It keeps *"nothing leaves your phone"* literally true for the one
release where that claim is made for the first time, keeps T-117b and T-127 verifiable, and means
there is no billing code to write before a single real trip exists. **The cheapest monetisation is
the one not yet built.**

**The sequence:**

1. **v1 — free, complete, no IAP, Android only.** Cost: $25. ASO is the marketing project, and the
   one worth learning: ~65% of installs start with a search.
2. **Measure what the store gives away.** Installs, D1/D7 retention, uninstall rate, and Android
   Vitals per device model — which is the OEM-survival and battery evidence T-053/T-054 need,
   arriving without collecting anything (Part 1 §3).
3. **First money: the souvenir video** (T-105b-v2) as a one-time purchase, once it exists. Additive,
   so no rug pull; it arrives at peak emotional value; and the **free still image keeps doing the
   distribution work D-013 depends on** — which is what made charging for the souvenir wrong in
   Part 1 and acceptable here.
4. **iOS when Android shows retention** — €99/yr against evidence, not hope. Prices there are
   reversible, so paid-up-front can even be *tested* on iOS if it ever appeals.

⚠ **What would change this back.** If the project lead would rather have €200 and 40 users than 2,000
users and €0, ① is the better plan and there is no shame in it. This recommendation follows from
*their* stated order: proof first, money second, and a €25 loss they can live with.

⚠ **The €4.99 in Part 1 is superseded by §15.** It was chosen to protect installs on a *paid*
listing. Under freemium the install decision is made at €0 regardless, so price costs no downloads
and the unlock should sit at **€5.99–€7.99**.

---

# Part 3 — The genre worldwide, and how to design the freemium boundary

**Added 2026-08-17.** The project lead's two asks: *"We need to explore more the freemium part of
it. I was looking to an equilibrium between profit and scaleability hence the low price."* And:
*"WalkME in madeira is not our only competition. This type of app can be common in different parts
of the world."* Correct on both counts — Part 1 looked at one local rival and missed the category.

## 13. This app sits in three genres at once, and they price completely differently

### ① Regional trail guides — *free base, paid offline maps*

| App | Region | Model |
|---|---|---|
| **WalkMe \| Walking in Madeira** | Madeira | Free + IAP $7.99 / $8.99 wk / $14.99 / $49.99 |
| **⚠ Walkme Portugal Trails** | **Azores** | Free + IAP |
| Camino Maps | Camino de Santiago | Free offline guide |
| TrailSmart | Caminos | Free, paid offline maps |
| Bergfex | Alps, 200k+ trails | Freemium |
| Tabacco Maps | Dolomites | Paid maps |

⚠ **The most important line in this table is the second one.** The incumbent has already
**replicated itself to another archipelago**. The genre is repeatable, the competitor knows it, and
they got there first. See §16 — because *this project is architecturally better placed to do the
same thing than they are.*

**The dominant model in this genre is free base + paid offline maps or regions.** Nobody
successful in it charges up front.

### ② Fog-of-war exploration — *the actual mechanic, and it prices high*

| App | Model | Reach |
|---|---|---|
| **Fog of World** | **$29.99 paid up front**, no subscription | **500k+ downloads**, Apple **App of the Day in 137 countries**, 4.8★ iOS / 3.6★ Android |
| Wanderlust: Fog of War | $4 + free tier | Discontinued |
| Wanderings, FOWIRL | Free | Small |

⚠ **This is the finding that should move the price conversation.** The closest thing to this app's
*core mechanic* — a map that fills in as you move — sustains **$29.99 up front** and half a million
downloads. The ceiling for "watching a map fill in" is far above the €4.99 Part 1 proposed.

⚠ **But read the difference before copying the price.** Fog of World is **global and generic**: it
works anywhere on earth, so its addressable market is everyone who travels. This app is **regional
and curated**: 60 hand-picked places on one island. Higher relevance per user, a far smaller pond.
**Fog of World's price is evidence about the mechanic's value, not about this app's market.**

### ③ Trip memory and artifacts — *free app, sell the object*

**Polarsteps: 18 million users, profitable, free, no ads, no subscription, no data selling.** The
revenue is almost entirely **printed travel books**, plus some booking affiliate income.

⚠ **This is this project's positioning, already proven at scale by somebody else.** They rejected
ads and data selling on the grounds that both distort the travel experience — the same argument
D-001 and D-031 make here.

⚠ **And the print idea came from their users, not from them.** Which is a direct answer to the
project lead's instinct that print-on-demand is *"an idea but for the long term future, not now"*:
**that instinct matches how it actually happened at the one company that made it work.** It is the
model to grow *into*, once there are users to ask.

### ④ The platforms — *and a goodwill window that is open right now*

**Komoot** is the closest thing to a proof of the freemium design proposed here: **one free region**,
then **$3.99 per region**, **$8.99 a bundle**, **$29.99 the world pack** — one-time purchases, not
subscriptions.

⚠ **And Komoot is currently damaging itself.** After Bending Spoons acquired it in March 2025 it
pushed new users toward a **$59/yr subscription**, drawing headlines like *"Komoot confirms: we
don't want any new customers."* **There is goodwill available in this category right now for
anything that charges once and honestly** — which is a positioning opportunity that will not stay
open forever.

## 14. What this means for the freemium boundary

Play forbids free→paid (§9), so on Android **freemium is the only way to have discovery and revenue
at the same time.** The question is therefore not *whether* but *where the line goes*. Five candidate
boundaries, judged against the rule in §4 — *never withhold a trip already recorded*:

| Boundary | Precedent | Verdict |
|---|---|---|
| **Geographic** — one municipality free, island paid | **Komoot's free region**; D-024 already hides Porto Santo until you go | ✅ **Strongest.** Honest, demonstrable, you use it on a real walk before paying |
| **Additive artifact** — app free, souvenir *video* paid | Polarsteps' books | ✅ **Best first step.** Takes nothing away, so no rug pull |
| **Category** — viewpoints free, levadas paid | WalkMe gates trails | ⚠ Levadas are the crown jewels and the costliest to curate — but it splits the passport metaphor and reads as arbitrary |
| **Count** — first 10 stamps free | Common elsewhere | ❌ **Violates §4.** You hit the wall *mid-trip*, having already walked |
| **Time** — 7-day trial | Common elsewhere | ❌ **Worst possible here.** The trip *is* the time. A 7-day trial on a 7-day holiday is either a joke or a trap |

## 15. The insight that resolves "profit versus scalability"

The project lead reasoned: *low price → more downloads → scale.* **That is correct for a paid app
and largely irrelevant under freemium**, because:

> **Under freemium, price is invisible to everyone who does not convert.** The install decision is
> made at €0 regardless. Price affects only the converting minority — so raising it costs
> **nothing** in downloads, ranking, retention or Android Vitals.

⚠ **So freemium decouples price from discovery, and the low price stops being necessary.** €4.99 was
chosen in Part 1 to protect installs on a *paid* listing. Under freemium that protection is free,
and the unlock can sit at **€5.99–€7.99** — still under WalkMe's $7.99 entry, still a fraction of
Fog of World's $29.99 — without costing a single install.

**The equilibrium the project lead is looking for is not a low price. It is a free door.**

## 16. The scalability asset nobody has named yet

⚠ **This project is already built to become a second app, and that is an accident of D-017 rather
than a plan.**

*"No Madeira knowledge in `app/`"* is absolute: every coordinate, name, boundary and levada course
lives in `content/`, produced by tools from OSM. The app does not know what island it is on.

**So "Azores Explorer" is a content pack, not a rewrite** — a new `pois.json`, a re-run of
`build-regions.mjs` and `build-levadas.mjs`, and the same binary. WalkMe needed a whole second app
to reach the Azores; this architecture needs a data file.

⚠ **That is the real answer to "scalability"** — not pricing. One island proves the product; the
second costs a curation pass. And it argues for keeping the store listing and branding **capable of
carrying a family** rather than hard-coding "Madeira" into the identity.

⚠ **Do not act on this yet.** It is worth nothing until one island has users, and D-032's warning
applies: a second region is exactly the kind of large scope that looks cheap and is not — the
curation of 60 places (T-066a) took a full session and a veto pass.

## 17. Revised freemium recommendation

**Free on Play. No IAP in v1. First unlock is the souvenir video. Geographic unlock only if more
revenue is ever needed. €5.99–€7.99, not €4.99.**

| Step | What | Why |
|---|---|---|
| **v1** | Free, complete, **no billing code** | Discovery + *"nothing leaves your phone"* stays literally true (§3) |
| **v1.1** | Souvenir **video** as one-time purchase | **Additive** — nothing taken away, no rug pull. The free still image keeps doing D-013's distribution work |
| **v2, only if needed** | Geographic unlock, Komoot-style | Proven boundary; honest; usable on a real walk before paying |
| **Later** | Printed artifact | Polarsteps' actual model — but it needed 18M users. The project lead's *"long term"* read is right |
| **Never** | Count gates, time trials, subscriptions, ads | §4, and D-001/D-031 |

⚠ **What is still true from Part 1 and should not be lost:** the moment any IAP ships, Play Billing
adds network calls, D-043's audit must be re-run, and the privacy copy must change from *"nothing
leaves your phone"* to *"nothing except a purchase you started."* That cost is worth paying **once**,
for the video — not twice, and not before there is anyone to sell to.

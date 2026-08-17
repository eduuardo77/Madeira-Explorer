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
  library, no receipt validation, no purchase state, **and not one network call added to our
  app.** `T-117b` and `T-127` — "verify zero outbound requests" — stay literally true and
  literally verifiable.
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

### A. Paid up front, one price, no IAP ⭐ **recommended**

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

## 6. Recommendation

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

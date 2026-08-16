# OD-10 — how anybody finds this app

**For:** the project lead, to decide. **Written:** 2026-08-16.
**Status:** options and a recommendation. **No decision is taken here** — OD-10 is theirs
(CONTEXT §9 puts scope and launch in the *ask first* tier).

## The question is two questions, and they get conflated

1. **Should v1 launch publicly at all?**
2. If it does, **through what channel?**

Most of the difficulty comes from answering the second while the first is unresolved.

## Five facts that constrain every answer

**1. There is no search term.** Nobody types "Madeira stamp collecting app". The searches that
exist — *madeira levada app*, *madeira hiking* — lead to WalkMe: fourteen years old, actively
maintained, updated four days before our survey, and the market leader (`docs/competitors.md`).
Competing for that search is competing on their ground, and we are not the same product.

**2. This is a souvenir, not a guide — and that inverts the sales moment.** A guide is wanted
*before* the trip: the tourist has a felt need ("which walk, is it open"). A souvenir has no felt
need until afterwards, when it is too late to install it — **the app must already be running on
day one to have anything to show on day seven.**

⚠ **That single fact decides more than any channel comparison.** The moment to reach somebody is
*arrival*: the airport, the rental car, the check-in desk, the welcome book in the apartment. It is
also why CONTEXT §4.10's partner routes were mislabelled as a fallback. They are not the cheap
option — they are **the only channel that fires at the moment the app has to be installed.**

**3. The app cannot measure its own launch.** No backend, no accounts, no analytics, nothing
collected (D-001, D-031). That is the product's best feature and its distribution blind spot:
after a launch you will know **installs, and nothing else**. Not how many recorded a trip, not how
many earned a stamp, not how many opened it twice.

⚠ This cost is not written down anywhere else in the project, so it is written here: **a
privacy-first app is one you cannot run a growth loop on.** Every option below has to be judged
knowing you will be flying blind.

**4. The reward mechanism people would share does not exist yet.** D-051 cut the souvenir video —
which D-013 and CONTEXT §2.3 both called *the entire distribution strategy* — and D-063 put it back
**last**. So the sharing half is real but not soon.

**5. Tourists demonstrably pay for Madeira hiking apps.** WalkMe sustains $8.99 week passes and
$49.99 lifetime unlocks, solo, for fourteen years. The market exists and is not price-sensitive at
the low end. v1 is free with no ads (D-014) — but this matters for OD-4, and it means a partner has
a reason to take you seriously.

## The options

### A. Do not launch yet. Use it yourself for one real trip.

**Cost:** nothing. **What it buys:** the field data that currently blocks battery, background
survival, GPS realism and every threshold I have written this week — *and* the only honest answer
to "is the loop actually good", which nobody knows because **no one has ever completed a trip with
this app.**

**Against:** it is not distribution, and it delays everything. It is also the option that costs
nothing if wrong.

### B. Partner routes — rental cars, hotels, quintas, the tourism board

**The only channel aligned with fact 2.** A card in the glovebox, a line in the welcome book, a QR
by the check-in desk. Everyone who sees it is in-market, on the island, on day one.

**Cost:** time and relationships, not money — a one-page pitch, a printed card, and somebody
willing to talk to accommodation owners. **You live there, which is the whole advantage.**

**Against:** it does not scale, and you cannot measure it (fact 3). A handful of quintas is a
handful of installs. Also: a partner will ask *what is in it for them*, and the honest answer today
is "your guests get a nice souvenir" — real, but thin. It becomes much stronger once the souvenir
exists (D-063), which is an argument for sequencing B **after** the still-image share.

### C. A store listing, and nothing else

**Cost:** the store work, which is largely done (T-120, T-122, T-118 privacy answers and manifest).
**What it buys:** almost no discovery on its own — but it is the *prerequisite* for B, D and E.
Nothing can be pointed at until it exists.

### D. The souvenir share (D-063)

The original plan, and structurally the best one: the artefact is the advertisement. **But it is
circular** — it needs users to produce shares to produce users — so it cannot be the *first* move,
only the multiplier on whatever the first move is. And D-063 puts it last on purpose.

### E. Showing the traces publicly — a Madeira-focused feed

Post the drawn traces of famous walks: the 25 Fontes, the Areeiro–Ruivo ridge, a week of one trip
filling in. This is what works for niche travel apps now, it costs time rather than money, and it
is the only option that builds an audience *before* launch.

**Against:** it is a job, not a task — it wants a post a week for months. ⚠ And I have **no
evidence** about what performs in this niche; that claim is a general impression, not a measurement,
and should be treated with the same suspicion as any other unmeasured number in this project.

### F. Press, forums, local blogs

One-off, cheap, low yield. Worth an afternoon on launch week and no more.

## Recommendation

**A now. C when the code is done. Then B, with E in parallel if you have the appetite.**

The reasoning is that the app is not yet in a state where distribution is the constraint. **Nobody
has completed a single trip with it.** The thresholds are guesses, the battery figure is `null`, the
content was curated yesterday, and the recorder has never survived a night. Launching into that
spends the one thing a solo project cannot get back — the first impression of the people you most
want — on a version you cannot measure and would want to change.

The honest sequencing is: **make it true, then make it known.**

⚠ **And record the consequence plainly**: choosing A means accepting that v1 ships with **no growth
mechanism at all**. That is a real decision, not a deferral, and it should be written into the
decision log as one rather than left as an open question that quietly never closes.

## What I would need from you to take this further

- **Which options are live**, so the ones that need code (a share sheet, a QR landing page, store
  copy) can be sequenced against the foundations.
- Whether **B is something you would actually do** — it is the only option that depends on you
  personally, and if the answer is no, that is worth knowing now rather than at launch.

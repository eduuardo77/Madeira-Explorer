# Marketing — a free app, no budget, and one channel that matters

**Written 2026-08-17**, after D-072 settled the app as **free on Google Play**. That decision
changes marketing completely: there is now a single channel worth working, it is free, and it is
learnable — which is what the project lead asked for.

⚠ **Read `docs/distribution-options.md` (OD-10) alongside this.** That document asks *which channels
exist*; this one is *what to actually do* on the one that is live.

---

## 0. A correction I have to make first, because the copy depends on it

⚠ **I twice told the project lead that a paid app would keep "zero outbound requests" literally
true. That was wrong**, and the repository already knew it. D-057 says so in its own text:

> *"the app makes no network requests at all, and that is no longer true: the map streams tiles."*

Since the app moved to Google's map, the phone fetches map tiles as you pan. **"Nothing leaves your
phone" has not been accurate since 2026-08-14.** The IAP argument in `monetization-options.md` still
holds in its narrow form — billing adds requests *on our account*, tied to a purchase — but the
absolute claim was already spent.

**The privacy policy is exact where I was sloppy, and its wording is what the marketing must use:**

> *"Your trip never leaves the phone."*
> *"Google sees which part of the island you are looking at. It does not see your trip."*
> *"There is no account and no server."*

⚠ **Never write "works offline" or "nothing leaves your phone" in the listing.** Both are false now.
What is true, and still worth saying loudly: **recording keeps working with no signal** — GPS needs
no network, so the trip is captured in a levada valley even when the map cannot draw.

---

## 1. The only channel: the Play listing

- **~65% of installs start with a search.** For a free app with no budget, ASO is not *a* channel,
  it is *the* channel.
- **Google Play indexes roughly 4,110 characters**: title 30, short description 80, full description
  4,000 — and unlike Apple, **the full description is indexed for keywords**.
- ⚠ **Stuffing is a suspension risk**, not merely bad taste: repetitive or irrelevant keyword use in
  the title or description can get an app removed.
- **Store listing experiments are free A/B testing** on real store traffic — icon, feature graphic,
  screenshots, short and full description, up to three variants against the current listing, and up
  to five localised experiments at once.

## 2. What NOT to compete on, and why it would actively hurt

WalkMe owns *levada*, *trails* and *hiking in Madeira*: fourteen years, 100,000+ installs, and the
top result for all of them. **Fighting that head-on is a losing keyword war.**

⚠ **And winning it would be worse than losing it.** Play's most heavily weighted negative signal is
**uninstall rate**. If this app ranks for *"levada navigation"* and a user arrives expecting turn-by-
turn directions, they find an app that **deliberately never navigates** (D-018, D-055) — and they
uninstall, which costs ranking on every other term too.

**So: rank honestly for what the app is.** The split that matters:

| | |
|---|---|
| **Keywords get you into the pool** | Destination terms — *Madeira*, *levada*, *walk*, *map*, *trip* |
| **Screenshots and the short description convert** | The trace filling in, the passport, the privacy |

The differentiator is **not** "trails". It is *a record of your own trip* and *nothing collected*.
That belongs in the pictures and the first line, not in a keyword list.

## 3. The name: **Proa**

✅ **Decided 2026-08-17 (D-074): the app is *Proa*; the listing is *Proa - Madeira*.**

Brand plus keyword, so nothing is traded away: **Proa** carries the souvenir watermark — design brief
§7.2's primary distribution surface — and **Madeira** sits in the title where the search weight is.

The "could it carry a family later?" worry is answered twice: the brand survives a second island
(*Proa - Azores*), and the competitor already ships **separate listings per region** (*Walking in
Madeira*, *Portugal Trails*).

⚠ *Rasto* was rejected on meaning rather than availability — it reads as **tracking** in Portuguese,
which is what §7.2 bans on an app facing a manual background-location review. *Fanal* was rejected
because it is one of the curated 60. D-074 has the full screen.

## 4. The listing, drafted

### Title (30 max)

> **Proa - Madeira** — 14 characters ✅ **decided 2026-08-17 (D-074)**

⚠ **Superseded what this section first said.** It recommended keeping *"Madeira Explorer"* on ASO
grounds, without having read **design brief §7**, which had argued against that name since August.
D-074 is the synthesis: **brand plus keyword** — *Proa* for the souvenir watermark, *Madeira* for
the search box, and no *Explorer*, which §7.2 called generic.

⚠ **The title cannot be A/B tested** — Play's experiments cover the icon, feature graphic,
screenshots and both descriptions, but not the title. It had to be decided on principle.

### Short description (80 max) — the most weighted field after the title, and what shows in search

> **Your map of Madeira fills in as you walk. Collect the island's 60 best places.** — 76 characters

Alternatives worth A/B testing (§7):

- *"See where you walked in Madeira. Your map fills in. Your trip stays private."* (75)
- *"Walk Madeira, fill in your own map, and collect the 60 places worth going to."* (76)

### Full description — the first 167 characters carry the hook, before "Read more"

```
Proa draws the map of your own trip.

Walk a levada, drive a mountain road, wander into a village — the app records where you
went and draws it on the map. At the end of the week you have a picture of your holiday
that nobody else has: your Madeira, not a guidebook's.

SIXTY PLACES WORTH GOING TO
Sixteen viewpoints, eleven levadas, sixteen villages, seven beaches, ten landmarks —
chosen one at a time, with no filler. Reach one and you collect its stamp. The passport
shows all sixty, so you always know what is left to find.

IT FILLS ITSELF IN
Give it permission once and it records while it sits in your pocket. Prefer to keep
location off? There is a Start walk button, and the app works fully without background
tracking.

NO SIGNAL, NO PROBLEM
Recording does not need a network. The trip is captured under laurel canopy and deep in
the valleys, where phone signal is not.

YOUR TRIP NEVER LEAVES YOUR PHONE
No account. No sign-up. No analytics. No advertising. The record of where you went is
kept on your phone and stays there. The map underneath is Google's, the same one most
apps use, so Google sees which part of the island is on your screen — never your trip.

A SOUVENIR AT THE END
When you leave the island, the app puts your week together: the line you walked, the
places you collected, the dates. Share it or keep it.

FREE TO START
The map, the recording and your trace are free forever. Your first ten stamps are free,
and your first levada is always free. If you want the rest of the island, one payment of
EUR 4.99 unlocks it — no subscription, ever.

Made in Madeira.
```

⚠ **The last paragraph is a compliance surface, not just copy.** Google requires the free/paid
boundary to be stated accurately, and it must match what T-155 actually builds. If the numbers
change, this changes.

## 5. Screenshots — where the converting happens

The first two are what appear in search results; most people never swipe.

| # | Shot | Why |
|---|---|---|
| **1** | **The map with the trace across Funchal** | This is the product. It is also the one image no competitor has |
| **2** | **The passport, part-filled** | The collection, and the reason to keep the app |
| 3 | A place card | Shows the curation is real |
| 4 | The souvenir card | The payoff, and the shareable |
| 5 | Settings / the privacy line | The differentiator, stated |

⚠ **Use real screenshots, not mockups.** The ones taken on 2026-08-17 (`tools/out/shots/`) are
already close: the decluttered light map with the blue trace reads well at thumbnail size, which is
the size that matters.

## 6. ⚠ The biggest free lever is blocked, and it is worth knowing now

**Madeira's visitors are Portuguese 20.3%, British 14.9%, German 14.8% of overnight stays.** Play
lets you localise the listing per language at no cost, and run five localised experiments at once.
Localising into **Portuguese and German** addresses ~35% of the market for the price of translation.

⚠ **But the app has no internationalisation at all** — no `i18n`, no `expo-localization`, every
string English. A German listing pointing at an English-only app produces exactly the mismatch that
causes an **uninstall**, which is the most heavily weighted negative ranking signal there is.

**So the sequence is: app localisation first, listing localisation second.** Portuguese especially —
an app made in Madeira that cannot speak Portuguese is a strange thing to hand a Portuguese visitor.
Filed as **T-160**.

## 7. The learning project: free A/B testing

The project lead named learning as the upside. **Store listing experiments are the right first
exercise**: real traffic, free, reversible, and they answer a question rather than a hunch.

Run them **one at a time**, in this order:

1. **Short description** — cheapest to change, high weight, three variants from §4.
2. **First screenshot** — trace-on-map versus passport. This is the real question: does the *map*
   or the *collection* sell the app? Nobody knows.
3. **Icon** — last, and only once there is enough traffic to read a result.

⚠ **Wait for enough installs to make a result mean anything.** With tens of installs a week, an
experiment is noise, and acting on noise is worse than not testing.

## 8. What to measure, all of it free

From Play Console, collecting nothing ourselves:

- **Store listing conversion rate** — impressions to installs. The number ASO moves.
- **Acquisition source** — organic search vs browse vs referral, so a partner link can be told apart.
- **D1 / D7 retention, and uninstall rate.**
- **Android Vitals per device model** — which doubles as the OEM-survival evidence T-053/T-054 need.

⚠ **Expect D30 retention to look terrible, and do not chase it.** The audience is a tourist who stays
a week and leaves. The retention curve is **holiday-shaped**; the store's metrics were designed for
apps used daily forever. Optimising against D30 here means optimising against holidays ending.

## 9. The channels, re-weighted now the app is free

| Channel | Change |
|---|---|
| **Partners** (hotels, quintas, rental cars) | ⚠ **Much easier than it was.** Recommending a *free* app costs a hotel nothing and risks no guest complaint. This was the hardest ask when the app was paid; it is now the easiest |
| **Store listing** | Promoted from formality to **primary channel** |
| **The souvenir share** | Works as designed — the still image is free and always will be (D-072) |
| **Press, forums, local blogs** | Cheap, learnable, and the honest angle is *"a Madeiran built a private one"* |
| **Use it yourself for one real trip** | ⚠ **Still first, and still not done.** OD-10's recommendation stands: nobody has completed a single trip with this app |

## 10. Sequence

1. **Record one real trip yourself.** Everything below is guesswork until then, and it is also how the
   screenshots stop being emulator shots of a replayed route.
2. **Ship the listing in English**, with the §4 copy and the §5 screenshots.
3. **Watch conversion, retention and Vitals for a few weeks.** Change nothing.
4. **Localise the app** (T-160), then the listing.
5. **Then experiments**, once traffic can carry them.
6. **Then partners**, with a tagged install link per partner so the channel is measurable.

## 11. What not to do

- **Do not buy ads.** No budget, and with no analytics the attribution would be guesswork anyway.
- **Do not claim offline or "nothing leaves your phone."** Both are false (§0), and a false privacy
  claim in a store listing is the one lie this project cannot survive.
- **Do not target navigation keywords.** The app deliberately does not navigate, and ranking for them
  buys uninstalls.
- **Do not launch before one real trip exists.** OD-10 §A, unchanged.

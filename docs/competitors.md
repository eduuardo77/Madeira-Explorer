# Competitor Teardown

What the incumbents actually run, measured rather than assumed. Surveyed **2026-08-08**.

Method: inspected loaded resources and page markup directly where possible; App Store listings
otherwise. Marked **[verified]** or **[secondary]** throughout — the difference matters.

---

## WalkMe — the direct competitor

*"WalkMe | Walking in Madeira"* — the market leader for Madeira levadas, and the closest thing
this project has to a direct rival.

| | |
|---|---|
| Developer | Marco Batista — **a solo developer**, like this project |
| Age | iOS app ID `577067362` places the listing around **2012**. Fourteen years old. |
| Activity | v8.8.7, **updated 4 days before survey.** Actively maintained. |
| **App size** | **178.5 MB** |
| Map | **Apple Maps (MapKit)** — the "Maps / Legal" attribution is on screen **[verified from screenshots, 2026-08-08]** |
| Offline | *claims* "Download trail maps… internet or not" — **but see §Offline claim below** |
| UI | Portuguese-localised; bottom tab bar (Início · Avisos · **Caminhadas** · Info · Perfil) with the primary action as a large centre button |
| Content | 50+ curated trails, descriptions, photos, difficulty, closure and weather alerts |
| Trailhead directions | **Hands off to Google Maps** — the same conclusion as D-018 |
| **Pricing** | Free + IAP: Basic **$7.99** · Plus **$14.99** · Week Pass **$8.99** · Lifetime **$49.99** |
| **Data collected** | **Location (precise), contact info, user content, identifiers, usage data, diagnostics** — declared "not linked to your identity" |

### What this tells us

**1. They are a guide. We are a souvenir.** They sell *"where should I walk and is it open."* We
give *"here is everywhere you went."* A tourist could plausibly use both, and the overlap is
thinner than the shared word "levada" suggests. This is not a head-to-head product.

**2. Their privacy posture is our differentiator, and it is not close.** Six declared collection
categories including precise location. Ours is a store declaration of *nothing collected, nothing
shared* (T-120, T-122). **That is a position they cannot copy without rebuilding**, because their
curation, alerts and subscription all depend on a backend. See D-031.

**3. 178.5 MB against our 12 MB whole-archipelago tile pack.** Offline map packs are heavy when
they come from a general-purpose hosted provider. Ours ships the entire island, both islands, for
a fraction of that.

**4. Tourists demonstrably pay for Madeira hiking apps.** A **$8.99 week pass** and **$49.99
lifetime**, sustained over fourteen years by one developer. PROJECT_PLAN's monetisation note
(OD-4) assumed a ~€4 paid app; the real market clears higher. This does not change the v1
decision — free, no ads (D-014) — but it is evidence worth having when OD-4 is reopened.

**5. They record walks too — "Gravar percurso."** Closer to this project than the "guide vs
souvenir" split suggested, but it is a **manual, per-walk button press**, not passive background
recording. The user has to decide to press it, at the trailhead, having remembered the app
exists. That is the gap this project's ghost operation targets, and it is the whole reason for
the permission and battery work in Phase 1.

**6. Trail closures are a top-level tab** ("Avisos"). In Madeira, closure status is important
enough to earn one of five slots. Worth remembering when T-115's landmark card is designed.

**7. Fourteen years and still shipping.** A solo Madeira hiking app is a viable long-term
concern. Encouraging, and a caution against assuming the niche is empty.

---

### ⚠ Correction, 2026-08-08 — the map is Apple Maps, not Mapbox

An earlier version of this file recorded Mapbox, on the strength of a "fixed Mapbox glitches"
line in their App Store release notes. **Screenshots of the running app show the Apple Maps
attribution.** They most likely migrated and the release note is historical. Recorded because the
error is instructive: **a secondary source lost to one screenshot.**

### The offline claim — worth two minutes to test

Apple exposes **no offline tile API to third-party apps**. Apple Maps added offline regions in
iOS 17 for *Apple's own* Maps app only. So WalkMe's "offline maps" claim can only mean one of:

1. the **trail data** (routes, descriptions, photos) is offline while the **basemap is not**, or
2. they ship their own separate offline tiles and swap renderers when the network drops.

**(1) is far more likely**, and if so their basemap goes blank in exactly the places Madeira has
no coverage — the north and the interior, which is where the levadas are.

**Test: put the phone in airplane mode and open a trail.** If the map goes grey, the strongest
claim in this project's positioning is confirmed against the market leader, and it costs one
minute to find out. Worth doing before any marketing copy is written.

---

## ⚠ WalkNYC uses the platform's own maps — Apple on iOS, Google on Android

**From the project lead, 2026-08-13, "for the record".** The app held up as the visual reference
does not ship a map. It uses **Apple Maps on iOS and Google Maps on Android**.

This is the single most useful fact anybody has recorded about why our map looks different, and it
is not a styling gap that can be closed by trying harder:

- **Their cartography is Apple's and Google's.** Decades of label placement, generalisation, colour
  and terrain work, rendered by the platform, updated without them shipping anything. Nobody
  matches that with a MapLibre style, and the attempt is the most expensive way to lose.
- **Their map therefore looks native on each platform, because it *is* native.** An iPhone user
  sees the map they already know. That is most of the "feel" being asked for (D-054).
- **And it is exactly what this project traded away.** D-001 forbids the network; D-035/D-036 ship
  a 19.1 MB tile pack inside the binary so the app works in a levada valley with no signal. Both
  Apple's and Google's SDKs stream tiles and talk to their servers — adopting either would end the
  offline guarantee, the zero-network privacy claim (D-044, `docs/store-privacy-answers.md`), and
  the souvenir renderer's dark style (D-026/D-139), which needs a map we control.

**So the honest framing is a fork, not a defect:**

| | WalkNYC's route | Ours |
|---|---|---|
| Map | Platform SDK — free, native-looking, always current | Own pack — offline, private, ours to style |
| Works with no signal | **No** (their offline claim is about trail data, see above) | **Yes**, entirely |
| Looks like the phone | **Yes**, by construction | Only as far as our own cartography gets us |
| Souvenir/dark render | Not possible | The whole of Phase 5 |

⚠ **This is a decision the project lead has not been asked to make, and it is theirs.** Nothing in
the code assumes it either way beyond `map/` and the tile pipeline. If "looks like the phone's map"
matters more than "works with no signal", that reverses D-001 and most of Phase 0 — and it should
be decided deliberately, not drifted into. It is **not** recorded as a D-0xx because no
recommendation has been made.

---

## The wider field

| App | Map stack | Backend | Evidence |
|---|---|---|---|
| **AllTrails** | **Mapbox** — custom style `api.mapbox.com/styles/v1/alltrails/…`, own API token | Yes | **[verified]** — pulled from loaded resources on their Madeira page |
| **Wikiloc** | **Leaflet + MapLibre**, heavy **IGN** (national topo) references | Yes | **[verified]** in page markup |
| **Komoot** | OSM data, own tile style, own servers | Yes | **[secondary]** |
| **WalkMe** | **Apple Maps (MapKit)** | Yes | **[verified]** from app screenshots |
| **OsmAnd / Organic Maps** | **Own renderer, own binary format** — Organic Maps is a C++ core | No | **[secondary]** |

### The pattern that matters

**Every commercial trail app is online-first with a hosted tile service.** Every pan and zoom is
a billed request carrying a user's position into someone's logs. They can afford that because
they have revenue and backends. It is also exactly what CONTEXT §4.7 refuses.

**The genuinely comparable apps are the offline ones** — OsmAnd, Organic Maps, Maps.me — and they
all had to **write their own rendering engine and binary map format**, because when they were
built no standard existed for offline vector maps on a phone. Organic Maps is a C++ core with
Java, Objective-C and Swift layered on it.

**MapLibre + PMTiles is the modern answer to that same problem.** So this project is not off the
beaten path — it is on the current one, and it is far shorter than the path OsmAnd walked. What
cost them a custom C++ engine costs us a style file and an 8-second extract (D-030).

### Nobody's map is good "out of the box"

AllTrails' map looks good because someone designed a **custom Mapbox style**. Komoot's looks good
because someone designed a **custom style**. That is the same work D-026 describes — start from a
good base and tune — except theirs is locked to a paid host, and ours ships inside the app.

This also confirms the claim already in CONTEXT §4.9: **nobody does on-device recording, on-device
matching and offline rendering simultaneously.** The levada field bears it out — the incumbents
are online guides with servers, and the offline apps do not do trails as a product.

---

## Open follow-ups

- **Install WalkMe and look at it.** The map is app-only, so the cartography, the trail rendering
  and the offline download flow could not be inspected from the web. The project lead is in
  Madeira and this costs one afternoon.
- Their closure/restriction alerts come from official PR trail status. Worth knowing whether that
  feed is public — it is genuinely useful safety information, though it implies a network call we
  do not currently permit (§6.4).
- Re-check pricing when OD-4 is reopened.

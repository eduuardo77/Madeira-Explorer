# UI and Visual Design Brief

The product's visual direction, screen structure, and the reasoning behind both.

**Document date:** 2026-08-08
**Status:** Direction agreed with the project lead. **Nothing here has been drawn, and no style
has been authored against real tiles.** Treat the specifics as intent, not as specification.

**Related decisions:** [D-026](../DECISIONS.md) (two styles, terrain),
[D-027](../DECISIONS.md) (passport by category), [D-015](../DECISIONS.md) (accessibility beats
aesthetics), [D-022](../DECISIONS.md) (overlay rendering), [D-018](../DECISIONS.md) (never build
navigation).

---

## 1. The most important thing about this document

**Most of what looks like "UI work" on this app is cartography, not interface design.**

The primary screen is a map plus three controls. The three controls are a small amount of React
Native. The map is a **MapLibre style** — a text file describing layer order, line widths per
zoom level, colour ramps, label density, and terrain shading.

This distinction matters because it explains why the design phase stalled. Asking a UI design
tool for "the screen" produces generic dashboard chrome, glass panels and gradient cards,
because that is the only thing such a tool knows how to fill space with. It is answering a
question nobody asked. The actual work splits cleanly:

| Surface | What it is | Where it is judged |
|---|---|---|
| **The map** | MapLibre style JSON over our own tile pack | Against real Madeira tiles, outdoors, in sunlight |
| **The chrome** | Three controls | Almost no design surface. Restraint is the whole job. |

**Sequencing consequence:** the map cannot be designed before Phase 0 Track B (T-022, T-023)
produces real tiles. Until then any mockup has invented road density, wrong coastline detail and
fictional label load — it will look convincing and be wrong, and every iteration on it is wasted.

---

## 2. Visual direction

### 2.1 Two styles (D-026)

- **Light** for everyday in-app use — legible in Madeira's outdoor midday sun, which is where
  this app is actually read.
- **Dark** for the souvenir renderer, and available as a user preference. The fog-of-war
  metaphor is natively dark, and the souvenir video is the entire distribution strategy (D-013).

Both are built from the **same tile pack**, by starting from an existing permissively-licensed
style and **subtracting**: Protomaps' basemap themes, or CARTO Positron / Dark Matter over an
OpenMapTiles-schema build. Check the licence of whichever is chosen.

### 2.2 Figure-ground is terrain, not buildings

Madeira is defined by 1,800 m of relief and a dramatic coastline. Shaded terrain gives the
landmass the solidity that a city map gets from building massing, using the thing that actually
characterises the island. It also reinforces the elevation theme that runs through the whole
system (CONTEXT §5). Cost: tile pack size, a direct input to T-026.

### 2.3 The quality bar, stated so it can be tested

Not "looks as good as Apple Maps" — that is the wrong target, because Apple's map is optimised
for finding a restaurant and ours is optimised for showing one line. Instead:

- [ ] Reads at a glance in Funchal midday sun, held at arm's length
- [ ] The visited trace is unambiguously the brightest thing on screen
- [ ] Label load stays low enough that the island's shape carries the composition
- [ ] Legible with system font scaling turned up
- [ ] Unvisited roads remain readable — never near-black, never near-invisible (D-015)

Test outdoors. Not at a desk.

### 2.4 What "visited" looks like in each style

D-015's rule is *never differentiate by hue alone, and keep unvisited legible.* How that is
expressed depends on the style:

| | Unvisited | Visited |
|---|---|---|
| **Dark style** | Legible mid-grey | Brighter **and** heavier |
| **Light style** | Legible mid-grey | Darker/saturated **and** heavier |

Weight always carries part of the signal, in both. That covers colour vision deficiency for free.

---

## 3. Screen structure

Three things on the primary screen. That is the whole app.

```
┌─────────────────────────────────┐
│  ⚙                              │   Settings — gear, top-left
│                                 │
│                                 │
│           [ the map ]           │   The product. Everything else is chrome.
│                                 │
│                                 │
│                                 │
│ ┌──────────┐                    │   Stamp button — bottom-left
│ │ ◈ 23/180 │                    │   Carries the hero number (T-075)
│ └──────────┘                    │
└─────────────────────────────────┘
```

### 3.1 The stamp button, bottom-left

Opens the passport. **It also carries the hero number** — the mark plus `23 / 180`. One element
doing two jobs, which is how T-075's "one hero number" requirement is met without adding a fourth
thing to the screen.

**Bottom-left, on the project lead's instruction (2026-08-12).** This section previously argued
for bottom-right, and the argument was thumb reach: on a large phone the bottom-left corner is the
hardest reach for a right-handed thumb, and this is the app's primary action. That reasoning is
recorded here rather than deleted, because it is still true and it is what to weigh if the
placement is ever revisited — a one-handed field test (T-065, outdoors) is what would settle it.

What must be preserved either way: **the two bottom controls stay on opposite sides.** When the
passport moved left the start/stop control moved right. It is the opposition, not the specific
side, that stops one being a mis-tap for the other — putting both under the same thumb is the
actual failure. Leave clearance from the screen edge on both: each is back-gesture territory on
Android.

**The icon is a drawn stamp mark, not the `🛂` emoji.** That glyph rendered at button size as a
plain blue rectangle, and on 2026-08-12 the project lead looked at the running app and asked what
"the button to centre the map" did. It opened the passport. `passport/stampMark.ts` now draws a
tilted, die-cut octagonal seal, using the same `cutEdge` geometry as the real stamps so the icon
cannot drift away from the things it stands for.

**No text label. The mark and the number, nothing else — decided by the project lead 2026-08-12.**
The question was live because the emoji had just failed to identify itself, and CONTEXT §6.5 says
in as many words that *minimal does not mean unlabelled*. A word like "Passport" would have made
identification certain. It was rejected because this screen is allowed **three things** and the
button already does two jobs (§3.1); a label makes the app's one hero element wordier than the
hero number it carries, and the mark is now a drawn seal rather than an unreadable glyph, which is
the actual fix for the actual failure. The accessible label still says *"Open your passport, 23 of
180 places collected"* — the reduction is visual, never for a screen reader.

⚠ **This is the one place the "no learning curve for anyone" rule is being traded against
restraint, so it is the thing to watch in T-065.** If a first-time user outdoors cannot say what
the button does, the label wins and this paragraph is what to overrule.

⚠ **The first attempt at that mark was a 20-gon and it failed the same way**, for a reason worth
keeping: it passed every geometry test and then rendered as a ring with a dot in it — a record
button, or a crosshair, which was precisely the wrong thing to draw on a screen where a
map-centring control had just been removed. At 34 dp a 20-gon *is* a circle and a 1.6-unit scallop
does not exist. **Corners and tilt are what survive being small.** The tests were rewritten to pin
those two properties, but they did not find the problem and could not have — looking at it did.

### 3.2 Settings, top-left

**A gear, not three lines.** Three stacked lines is a convention learned from apps and websites,
and it conventionally promises a drawer full of destinations. This is one screen with a handful
of toggles. A gear reads as "settings" to someone who is not fluent in app idiom — which is the
stated audience. CONTEXT §6.5: *minimal does not mean unlabelled.*

Top-left is correct precisely because settings should be rare and slightly out of the way.

### 3.3 The missing fourth control: start/stop recording

D-008 promises the app is **fully functional with While-Using permission only**, via an explicit
start/end recording mode. For a user who never grants Always, start/stop is a **primary action**,
not a setting.

**Resolution:** a clear, labelled button on the primary screen, shown **only** to users who have
not granted Always. Users on Always never see it. Putting it in settings would bury a frequent
action in a rare place.

### 3.4 The places, and the card (T-115, D-018, D-052)

**Added 2026-08-13, Provisional.** The curated places are drawn on the map as small circles, and
tapping one opens a card at the bottom of the screen. This is the only detail view in the app.

```
   ○  uncollected — a hollow ring, mid-grey
   ●  collected  — filled, half again as large, heavier casing
```

- **The markers are quieter than the trace, by measurement.** §2.3's bar is *the trace is
  unambiguously the brightest thing on screen*, and after D-032 the trace is the whole visual
  product of v1. Every marker colour measures below the trace's contrast against the same ground,
  and the style tests fail the build if that stops being true. The consequence is that the two
  marker states sit in a narrow band of near-identical grey — so **shape, size and weight** carry
  the difference, which is what D-015 requires anyway.
- **The card is the fifth thing on the screen, and it is transient.** Category, name, distance,
  Directions, Close. No description, no photo (there is no photo — see D-052), no route drawn on
  our map, ever (D-018).
- **The distance is a straight line and says so.** On this island that is not pedantry: a
  miradouro 2 km away across a ravine is a 25-minute drive. When the recorder has no recent fix
  the line is simply absent — a number the app has not earned is worse than no number (D-041's
  reflex).
- ⚠ **The card and the bottom controls are one column, not two anchored things.** The first
  version positioned them independently and the card landed on top of the passport button. The
  controls step up as the card appears; nothing on this screen becomes unreachable because a card
  is open.

### 3.5 Accessibility floor (D-015, CONTEXT §6.5)

- Minimum tap target **60dp**, not 44
- Every control labelled with text, not icon-only
- System font scaling respected everywhere
- No meaning carried by hue alone

---

## 4. The passport

Organised by **category**, five named rows, no catch-all (D-027):

> **Viewpoints · Levadas · Villages · Beaches · Landmarks**

**The levada row is different in kind.** Every other category means *"you arrived somewhere."* A
levada stamp means *"you walked the whole thing"* — trailhead geofence plus exit geofence
(D-009). Hardest to earn, most valuable, and it should look like it. It is still geofence-driven,
so CONTEXT §2.1 holds: the reward does not depend on map matching succeeding.

Region progress does not live here. It moves to the map screen, where it does the "where should I
go next" job that D-002 needs it for.

Must be legible with 3 stamps and with 200 (T-081).

---

## 5. Settings

It will not stay at two items. The docs already require more than that, and the discipline is
**ordering and explanation**, not deletion.

| Section | Items | Source |
|---|---|---|
| Recording | Permission status + route to system settings | D-008, T-044, T-121 |
| | Battery-optimisation exemption (Android) | T-046 |
| Appearance | Light / dark preference | D-026 |
| Map | Tile pack status (later) | T-057 |
| About | Privacy policy | T-124 |
| *(hidden)* | Debug screen / trace export | T-050, T-130 |
| **Delete** | **Erase all my data** | T-125, D-010 |

**Two patterns worth copying, both observed in the reference app:**

1. **Every section gets a header and a plain-English footnote** explaining what it does and what
   it costs. This is what lets a settings screen grow without becoming hostile.
2. **The destructive action goes last, in its own section, in red, with an icon.** Findable, not
   fat-fingerable.

**The erase-all copy must be honest about consequences.** There is no cloud, no account and no
restore (D-001). Deleting is permanent and takes the whole trip with it. Say so, and require a
second confirmation step. Avoid developer idiom in the section header — name it for what it does.

**State the battery cost in the label.** The single best pattern observed in the reference app is
putting *"uses about N% of your battery per day"* directly next to the tracking toggle. It
answers the question the user is actually anxious about, at the moment they are deciding. This
belongs in the permission flow (T-042) and the Always upgrade (T-043), with a **measured** number
from T-054 — never an invented one.

---

## 6. The WalkNYC reading

The project lead brought **WalkNYC** — a New York walking-coverage app by Joe Puccio, built on
Apple Maps — as the visual reference. Screenshots reviewed 2026-08-08. It is a solo-developer
app, which is itself worth knowing.

Note there are two different things called WalkNYC: this app, and **New York City DOT's
pedestrian wayfinding signage system** (the street pylons, PentaCityGroup / T-Kartor, 2013). The
signage system's design language — heads-up orientation, walk-time circles, building massing on a
warm ground, ruthless label editing — is what most references to "WalkNYC design" mean. See §6.4.

### 6.1 Worth stealing

- **The battery figure in the toggle label.** See §5.
- **Sectioned settings with plain-English footnotes.**
- **Destructive action last, own section, red, icon.**
- **Labelled tabs/controls, never icon-only.**
- **The primary action visually separated** from secondary controls.

### 6.2 Worth avoiding

- **Two stacked dismissible banners covering the top third of the map**, one of them promoting a
  social feature. On a screen whose only job is showing a map, that is a lot of map gone.
- **A three-way battery/completeness switch** pushed to the user. Honest, but it delegates a
  decision the user cannot make well. CONTEXT §3 forbids that kind of option here.
- **`0.00%` as a headline figure.** See §6.3.
- **User-configurable progress denominators** (their per-borough toggles). A manual fix for a
  problem D-024 solves automatically.

### 6.3 What their screenshots demonstrate about our own decisions

Three of our decisions are visible in their app as observed failures or observed costs. Recorded
because concrete evidence is more persuasive than argument:

- **`0.00% / 0 blocks`** as the hero number, needing two decimal places to avoid reading as zero.
  This is exactly what D-002 rejected when it refused island-wide coverage percentage as the
  headline.
- **A modal reading *"Swiping away WalkNYC prevents tracking."*** They ship a popup asking users
  not to force-quit, because standard iOS background location updates die permanently on
  force-quit. Their only available mitigation is asking nicely. **D-005 avoids needing that
  conversation** — geofences relaunch a terminated app on iOS even after force-quit.
- **A walk of 1.38 mi over 22 minutes credited `0 BLOCKS`.** The user did the thing and the app
  did not notice. That is the D-009 failure mode, photographed. Keep this in mind whenever
  generosity thresholds are being tightened.

Also confirmed visually: the first iOS permission dialog offers only *Once / While Using / Don't
Allow*. **No "Always."** That is D-008's central claim, on screen.

### 6.4 What does not transfer, and why

- **Apple Maps as the basemap.** Four hard stops — see D-026's rejected alternatives. Their
  choice is *correct for them*: New York has connectivity everywhere, so an online basemap is a
  non-issue and they save the cartography work. Madeira's north and interior do not, and our
  users are on foreign SIMs actively avoiding data. The reference fails on operating environment,
  not on taste.
- **Heads-up orientation and walk-time circles** (the signage system's signatures). Both are
  *wayfinding* features. This app is explicitly not navigation (D-018) and is mostly
  retrospective. Heads-up rotation also needs continuous compass heading — a battery cost against
  §6.3 for no benefit here.
- **Building massing.** See D-026.
- **Their badge system.** Still "Coming soon" as of 2026-08-08 — an announced intention, not a
  shipped mechanic. It is *not* validating prior art for our stamps, and we are ahead of them
  here: our stamps have award rules, dwell-and-speed gates, confidence values and curated content
  behind them.
- **Their layout.** They use a five-tab bottom bar (Replay, Stats, Badges, Settings, Start). Ours
  is three things. The layout in §3 is the project lead's own design, not a copy.

### 6.5 A note on owning your place names

Apple localises place names to the phone's system language — their map renders "Parque Central"
and "Nova Jersey" on a Portuguese handset. Owning the tiles means Madeira's names render as they
actually are: *Pico do Arieiro*, *Câmara de Lobos*, *Ponta de São Lourenço*. For a Madeira app
this is both more correct and better-looking. The app's UI is English-only (CONTEXT §1);
**place names are not UI.**

---

## 7. Naming — a live warning

The reference app currently displays a banner reading:

> *"NYC DOT sent me a cease and desist — Tell them why you use WalkNYC."*

**WalkNYC is New York City DOT's own trademarked wayfinding programme.** The developer named
their app after a government-owned brand and is now in a dispute with their app's identity
attached to it.

The project has **no name and no domain yet** (as of 2026-08-08), which makes this the cheapest
possible moment to absorb the lesson.

- **Avoid anything that reads as official.** Madeira's regional government and tourism board
  operate branded assets — *Visit Madeira* and similar. A name implying endorsement is the same
  trap.
- *Madeira* as a geographic word is fine and cannot be exclusively owned. A name that suggests
  official status is not.
- **Search the Portuguese INPI and EUIPO trademark registers before committing.** Fifteen
  minutes, and clearly not done in the cautionary example above.

**On the bundle identifier:** it does not require a domain — reverse-DNS is convention, not
requirement. It is permanent only **after store publication**; changing it during development
costs a rebuild. So `com.madeiraexplorer.app` stays as a working placeholder, must not block the
dev build, and needs a deliberate decision before T-137. The app's public name and its bundle
identifier are independent.

### 7.1 When the name is actually needed

| Needs it | Phase |
|---|---|
| Watermark on the souvenir (T-106) | 5 |
| Google Play background-location demo video (T-123) | 6 |
| Store listing (T-133); bundle identifier locked permanently (T-137) | 7 |

Nothing before Phase 5 depends on it. **Deliberately deferred 2026-08-08** — and not merely
tolerated as an open item. Naming now would mean naming a product nobody has seen. Once the tile
spike renders the real style (T-025) and a souvenir exists (T-105), there is far more to name
*from*. Revisit then; decide before the demo video, not before the store listing.

### 7.2 Constraints the name must satisfy

- **Legible small, in a watermark.** Short. This is the primary distribution surface (D-013).
- **Spellable by a UK, German or Nordic visitor who heard it once.** Rules out `lh`, `ã`, and
  `-eiro` endings.
- **No `Track` or `Tracker`.** The app already asks for the hardest permission on mobile and
  faces a manual Google Play review (T-123, D-008). A name that sounds like surveillance makes
  both harder for no gain.
- **No `Cloud`.** It implies a backend, which is the precise opposite of D-001.
- **No `Visit`, `Official`, `Guide`.** The cease-and-desist trap in §7.
- **No `Passport`**, tempting as D-003 makes it — *Madeira Passport* reads as a discount tourist
  card, and such products exist.
- **No place name in it.** D-017 says the moat must not become the ceiling; a Madeira-locked name
  makes an Azores or Canaries content pack into a new store listing, losing reviews, ranking and
  watermark recognition.
- The working title **"Madeira Explorer" fails two of these** — it locks the scope, and
  *Explorer* is generic and Microsoft-shaped.

### 7.3 Why the name does not need to describe the app

The obvious pattern is `verb + place`, as in the reference app. **It does not transfer.** That
works because they have exactly one activity and one city. This app covers **walking *and*
driving** — the levadas and the VR1 — and a name built on "walk" would exclude most of the road
network, which is the same error as gating recording on the pedometer (D-028).

The prior art already in CONTEXT §4.9 settles it. **Polarsteps** — the closest business analogue
— is a meaningless coined word. **Strava** is Swedish for "strive" and means nothing to its
users. Both are passive-recording souvenir products that grew by sharing. The *descriptive* names
in that list, AllTrails and Wikiloc, belong to **search-driven** businesses, which this app
explicitly is not (D-013).

**So: distinctive name, and the App Store subtitle carries the meaning.** The name is what gets
remembered off a video watermark; the subtitle explains.

### 7.4 Shortlist — candidates, not cleared names

**None of these has been checked** against INPI, EUIPO, either app store, or domain
availability. They are candidates to check.

| Name | Meaning | Notes |
|---|---|---|
| **Fanal** | Beacon, lantern (PT; also FR and IT) | Also Madeira's iconic misty laurel forest — simultaneously Madeiran *and* "a light that shows you where you've been." Two syllables, unmistakable in a watermark. **Current favourite.** |
| **Rumo** | Heading, course (PT; `rumbo` ES) | Four letters, impossible to misspell, carries into the Canaries. Age-of-Discovery resonance — Madeira was its launchpad. Safest and most portable. |
| **Vereda** | Footpath (PT and ES) | The word Madeira uses for its mountain trails. Beautiful and authentic, but leans hiking, and a common noun means a crowded trademark space. |
| **Rasto** | The trail something leaves behind (PT; `rastro` ES) | Hints at function without sounding clinical. The best option if a functional hint is wanted. |
| **Trace** | — | The truest description — it is literally what is stored — and covers walking and driving equally. Faint forensic edge; a milder form of the `Tracker` problem. |

**Considered and set aside:** *Roteiro* (a navigator's route-book — conceptually the best fit of
any candidate, but fails the spelling test); *Zarco* (unmistakably Madeiran, but crowded locally
and names a colonial-era figure, which should be a deliberate choice rather than an accident);
*Roam* (good verb, but "roaming" means data charges to every European traveller — awkward for an
app whose pitch is zero data usage); *Farol*, *Lume* (same beacon logic as Fanal, more contested);
*Contour* (elevation is central to the design, but generic and crowded in software); *Wander*
(too close to Wandrer.earth, already in the prior-art list).

**Next step when ready:** shortlist two or three, then search INPI and EUIPO plus both app
stores. Fifteen minutes, and demonstrably not done by the cautionary example in §7.

---

## 8. Open

- [ ] Confirm D-026 against real tiles and real sunlight, after T-025
- [ ] Choose the starting basemap style and verify its licence
- [ ] The app's name (see §7)
- [ ] Stamp artwork direction (T-070) — not addressed here at all
- [ ] What the region "where next" nudge actually looks like on the map screen (D-027)

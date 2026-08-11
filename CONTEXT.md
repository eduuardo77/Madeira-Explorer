# Context

**Read this first.** Everything a fresh contributor — human or AI — needs before touching
anything in this project, including the reasoning behind decisions that look arbitrary from
the outside.

**Document date:** 2026-08-06
**Updated:** 2026-08-11 — the souvenir composition (T-105a, D-042). Previously 2026-08-10 (v1
feature-complete in code) and 2026-08-08 (design session, D-026/D-027/D-028).
**Repository state:** Git repository, ~20 commits. Planning documents plus the **whole v1
chain** in `app/` — 53 source files and 12 test files, ~12,600 lines. **None of it has ever run
on a phone**; 178 unit tests and a browser workbench (D-038) are the only verification that
exists. Phase 0 is half done: the tile pack is built, the field runs are not.

**Read `HANDOFF.md` for what to do next.** This document is the *why*; that one is the state.

---

## 1. What this project is

A mobile app for tourists visiting **Madeira Island, Portugal**. It passively records where
the user has been and reveals it back to them as a beautiful, shareable map at the end of
their trip.

Roads and levada trails you have travelled light up. Everywhere you have not been stays dim —
the fog-of-war map from GTA, applied to a real island. Along the way you collect **passport
stamps** for reaching notable places.

**The one-sentence pitch:** install it when you land, forget about it, and on your way home
the app hands you a map of everything you saw.

The app is **in English only**.

---

## 2. The five things that explain most of the design

If you understand only five things about this project, make them these.

### 2.1 Stamps are the score. Highlighted roads are decoration.

Map matching noisy GPS to individual road segments is the fragile part of the system. Madeira
is close to the worst case for it. So the user's *reward* deliberately does not depend on it:
stamps are collected by geofence at curated places, and those work even when matching fails
completely. This is what makes the system degrade gracefully instead of catastrophically.

**Implication:** never let road coverage become the headline metric, and never let a matching
improvement be prioritised over stamp reliability.

### 2.2 Geofences are the backbone.

OS geofences are handled by the location coprocessor at near-zero battery cost, survive app
termination and force-quit on iOS, tolerate poor GPS accuracy, and need no continuous
location stream. They are simultaneously the cheapest on battery, the toughest against OS
termination, the most tolerant of bad signal, and the most privacy-preserving mechanism
available. That convergence is unusual, and everything important rides on it.

### 2.3 The souvenir video is the entire distribution strategy.

There is no App Store search term that finds this app. Nobody searches "Madeira exploration
tracker." Users install once, use it for seven days, and go home — no retention loop, no
in-app virality.

But consider who sees the end-of-trip video when it is posted: **people who follow someone
who just went to Madeira.** That is an extraordinarily well-targeted audience, and it costs
nothing. Every trip that ends is a free, perfectly-aimed advertisement — *provided the video
is good enough that people actually post it.*

**Implication:** the video's quality is load-bearing, not polish. Treat it as a headline
feature.

### 2.4 Raw traces are the only irreplaceable asset.

Matching, scoring, visualisation and UI can all be rewritten and re-run over stored history,
retroactively improving every user's map. A week of missed recording can never be recovered.

**Implication:** the recorder gets built first (Phase 1), and it gets the most reliability
attention. Raw fixes are immutable and append-only. Everything derived from them is
regenerable and may be wiped freely.

### 2.5 The bounded scope is what makes everything simple.

Madeira is ~740 km². That is small enough to bundle the entire island offline — map tiles,
road graph, POIs, everything. Which means no tile server, no network during the trip, no
mobile data cost, no position leaking to a third party, and no dependency on the poor
coverage in the north and interior. A global app could never do this. **The constraint is the
advantage.**

---

## 3. Hard constraints

These are non-negotiable and shape every decision. If a proposed change violates one, the
change is wrong.

| Constraint | What it means in practice |
|---|---|
| **Battery** | Target low single-digit % per *day*. Tourists are outdoors all day on one charge, using their phone for navigation and photos. Naive continuous GPS costs 10–20% per *hour* and is disqualified. |
| **Mobile data** | Target zero network usage during the trip. The only permitted network activity in the app's entire lifetime is an optional one-time tile download over WiFi. |
| **Radical simplicity** | An 80-year-old must use it with no instruction. One primary screen. One hero number. Minimal text, minimal options. |
| **Privacy by architecture** | Location data never leaves the device. No account, no backend, no analytics, no ads. |
| **Ghost operation** | Install once, never open it again for a week, and it still works. |
| **Graceful degradation** | Missing a levada because of poor GPS is worse than crediting one generously. |

### Explicit non-goals

- **Not a navigation app.** Tap a place → minimal card → one "Directions" button that hands
  off to Apple/Google Maps. We never draw a route to follow.
- **Not a social network.** No accounts, friends, leaderboards, or live location sharing.
  Every social feature would create a new privacy surface.
- **Not a trip planner.** No itineraries, bookings, or reviews.
- **Not global.** Madeira only, deliberately.

---

## 4. Important discussion outcomes

Conclusions reached during design that are not obvious from the code or the docs alone. Full
reasoning lives in [DECISIONS.md](DECISIONS.md).

### 4.1 Why the canvas is curated, not island-wide

A tourist visits for 5–10 days and would light up perhaps **3–5%** of the island's roads. The
map would stay ~95% dark for the entire trip. GTA's fog map works because you eventually fill
it; Fog of World works because residents play for years. **Our user leaves before the
payoff.**

It also breaks discovery: "where you can go next" does not fall out of a dark map, because on
day 2 everywhere is dark. Absence of highlight is noise, not a recommendation.

Fix: a curated set of **150–250 notable places** plus per-region progress. That number moves
every day, and the uncollected places *are* the recommendations.

### 4.2 Why "stamps" and not "stars"

Stars were the original proposal. A points currency invites *"what do I spend these on?"* and
if the answer is "nothing," they feel hollow. **Passport stamps** are universally understood
by travellers of any age, need no explanation, are inherently collectible, and are complete
in themselves. A filled passport page is also a second shareable screen.

Watch the complexity budget: region % *and* stamps *and* highlighted roads is three scoring
systems on one screen. One must be the hero.

### 4.3 Why the permission flow is a two-stage escalation

Background location is the hardest permission on mobile and getting harder.

- **iOS** cannot request "Always" up front. It then periodically shows the user a map of
  everywhere the app tracked them and asks whether to continue — which reads as a security
  warning to a non-technical 80-year-old, who will tap Deny.
- **Android 11+** cannot request it inline at all; the user must be sent to a system settings
  screen. Plus a prominent-disclosure screen and a permanent foreground-service notification.
- **Google Play reviews these apps manually and rejects many**, requiring a demonstration
  video and written justification. Re-review cycles are slow.

**This alone could sink the app** if onboarding depends on it. So: the app is **fully
functional with While-Using permission only** via an explicit start/end recording mode, and
Always is requested around day 2 as an upgrade, after the user has seen a filled-in trail and
understands why.

### 4.4 Why generosity in matching has a precise boundary

The rule:

> **Be generous filling in gaps between things you are certain about.
> Be strict about what you are certain about.**

Credit the connection; verify the endpoints.

A missed levada is an uninstall — the user did the hard thing and the app did not notice.
That is the worst failure. But unlimited generosity is fatal in a different way: if stamps
fire when someone merely drives past a trailhead, the whole collection becomes worthless.

Concretely: tunnel portal A → portal B credits the whole tunnel (a certainty, not a guess);
levada trailhead → exit credits the whole walk (levadas are linear with no mid-route exits);
gaps under ~30 min and ~15 km with a plausible shortest path get credited. But stamps require
**dwell time and walking speed**.

### 4.5 Why a "ghost app" still sends two notifications

The enemy of a ghost app is **the OS, not the user**. Android OEMs (Xiaomi, Huawei, Samsung,
Oppo, OnePlus) kill background work regardless of the official APIs. iOS terminates apps
routinely.

If tracking dies on day 2 and the user opens the app on day 7 to find three-quarters of their
trip missing, that is *worse than never having installed it*. So: a day-1 health check
notification (12–24h after install) and the reveal at trip end. Two messages in seven days is
not intrusive — it is the difference between a delightful surprise and a silent failure
discovered too late.

And when there *are* gaps, show them honestly. Gap-annotated data is trustworthy; fabricated
continuity is not.

### 4.6 The one real privacy risk is our own best feature

The souvenir video is an export of location history. A trace returning to the same house
every night publishes the user's accommodation — and when it is empty — to a public feed.
Mitigation, **on by default**: mask a radius around the detected overnight location, or trim
the first and last stretch of each day.

### 4.7 Why offline tiles are a privacy feature, not just a battery one

A normal map app leaks position to a tile server on every pan and zoom. Tile coordinates plus
IP address *is* location data, sitting in someone else's logs. This app never makes the
request.

### 4.8 Where these apps actually leak

Not through carelessness with the location database — through **dependencies**. Firebase
Analytics, Crashlytics, Sentry, attribution SDKs and ad networks routinely collect coarse
location or IP by default. That is how "no data leaves the device" quietly becomes false
without anyone deciding it should.

**Target: zero networked dependencies.** Any crash reporting must be local and uploaded only
on an explicit user tap.

**Audited 2026-08-11 (T-117) — `docs/dependency-audit.md`.** No analytics, no crash reporting,
no telemetry, and no network call in the app's own code. The target is met with one asterisk:
`expo-notifications` puts **Firebase Cloud Messaging** in the Android build (D-043). It ships no
configuration and is never asked for a push token, so it has nothing to register against — but
that is a static argument and **T-117b owes the on-device confirmation.** Read the audit before
filling in the Data Safety form or the nutrition label.

### 4.9 Feasibility is settled; the components are proven

Prior art confirms every individual piece ships:

- **Wandrer.earth** and **CityStrides** — street-level OSM matching with regional %
  completion scoring, with paying users.
- **Fog of World** — fog-of-war exploration mapping, both platforms, a decade of operation.
- **Polarsteps** — passive trip tracking with a beautiful end-of-trip artefact, monetised via
  printed books. The closest business-model analogue.
- **AllTrails / Wikiloc** — offline maps and trail data at scale. Wikiloc is big in Portugal.
  These are also the **incumbent competition** for the levada use case.
- **WalkNYC** (Joe Puccio, iOS) — passive street-coverage tracking, built on Apple Maps, by one
  developer. Reviewed 2026-08-08 as a visual reference; the full reading is in
  `docs/design-brief.md` §6. Its main value is as a catalogue of **observed failure modes** that
  our decisions already anticipate — see ARCHITECTURE §11.

**The caveat that matters:** each solved *one* of our three problems. Wandrer and CityStrides
never touch the user's battery — they piggyback on Strava's recording and do all matching
server-side. Fog of World records but does not street-match. Polarsteps records only
coarsely. **Nobody does on-device recording + on-device street matching + offline rendering
simultaneously.** The components are proven; the integration is genuinely new work.

### 4.10 The commercial picture, recorded honestly

On realistic numbers — well over a million annual visitors, and a 0.1–0.5% install rate for
an unknown niche app with no marketing — a paid app at ~€4 would gross a few thousand to
perhaps €20k a year before store fees. **That is a side project that pays for itself, not a
business.**

Partner distribution (rental cars — Madeira tourism runs on them — hotels, quintas, tour
operators, the regional tourism board, cruise lines) was analysed as higher-leverage than App
Store optimisation, but has been **explicitly set aside** in favour of organic sharing. The
printed-poster monetisation route (the Polarsteps model) is **deferred**. Both remain the
obvious fallbacks if organic sharing underperforms.

One quiet advantage worth remembering: Madeira has an unusual number of **repeat visitors**,
which partly fixes the slow-fill problem. Year two, they return to a partly-lit map.

---

## 5. Madeira-specific domain knowledge

Facts about the island that directly drive engineering decisions. A contributor unfamiliar
with Madeira will make wrong assumptions without these.

- **Tunnels everywhere.** Well over a hundred road tunnels; the VR1/VE1 expressway is
  substantially underground. GPS simply stops. The trail will have holes through exactly the
  roads people drive most, unless tunnel inference is implemented.
- **Vertically stacked roads.** The modern VR1 runs above or below the old ER101 coastal road
  in many places. Nearest-segment matching confuses them constantly. Altitude (barometer, not
  GPS) is the discriminator.
- **Levadas are the point of the island.** Irrigation canals with footpaths beside them, and
  the defining tourist activity. Omit them and the app misses what people actually came for.
  GPS under Laurissilva canopy is poor, and levadas run through their own tunnels — **108 ways
  are tagged both `highway` and `tunnel`**, so this is a routine case, not an exotic one.
  **But they are linear with no mid-route exits**, which makes them the *easiest* thing to
  credit despite the worst signal.
  **⚠ Corrected 2026-08-08 (T-028, D-029):** an earlier version of this line said levadas *are*
  `highway=path` in OSM. That is true of only **23%** of them. OSM maps a levada as **two
  parallel ways sharing one name** — the channel (usually `waterway=drain`) and the footpath
  beside it (usually `highway=path`). Select by **name plus hiking-relation membership, never by
  a single tag.** Measurements in `docs/osm-coverage.md`.
- **Elevation is enormously discriminating** on this island. It separates roads that overlap
  in plan view and unambiguously identifies a levada climb.
- **Mobile coverage is better than this document originally claimed.** ⚠ **Corrected
  2026-08-08 by the project lead, who lives here:** only *specific spots* are weak; the main
  areas have genuinely good connection. The original "poor coverage in the north and interior"
  framing was overstated.
  **Offline-first is unaffected, but its justification changes.** It now rests on **battery**
  (every tile fetch wakes the radio — §6.3) and **privacy** (tile requests leak position to a
  third party — §4.7, and the thing WalkMe cannot copy), not primarily on coverage. Since the
  whole archipelago is a 12 MB file (D-030), it stays a cheap win regardless. Do not cite poor
  coverage as the main argument.
- **Rental-car dominated tourism**, with strong UK, German and Nordic markets.
- **Porto Santo** is a separate island, ~40 minutes by air or a ferry ride. **In scope for v1**
  (OD-2 resolved 2026-08-06, D-021) — included structurally, deprioritised editorially, and
  hidden from the UI until the user actually goes there (D-024).
- **Cruise-ship day-trippers** are a large segment in Funchal — an 8-hour visit is a very
  different product from a 7-day trip. Currently not designed for (OD-5).
- **One airport** (plus Porto Santo's and the Funchal cruise terminal), which makes airport
  geofencing a reliable trip-end trigger.

---

## 5a. The project lead lives in Madeira

Confirmed 2026-08-06. This is a structural advantage and it should shape how the project is
run, not just a biographical detail.

- **Phase 0 validation is cheap and repeatable.** Walking a levada or driving a tunnel route
  with a logger is an afternoon, not a trip. The "validate before building" sequencing in
  PROJECT_PLAN.md holds.
- **Field testing is continuous, not a milestone.** Any matching threshold, geofence radius or
  battery figure can be re-tested against real terrain the same week it changes. Most teams
  building this would be guessing.
- **POI curation is first-hand.** The 150–250 place list (T-066) requires exactly the local
  knowledge a global competitor cannot buy. This is the moat in D-002 and D-017 made concrete.
- **Beta recruitment is local.** T-129 no longer depends on finding strangers who happen to be
  flying to Madeira.

**Implication for planning:** do not treat field verification as expensive or batch it up.
When a matching assumption is in doubt, go and measure it.

---

## 6. Coding conventions

**Status: partly established.** The Phase 1 recorder skeleton (`app/src/storage`,
`app/src/recording`, `app/src/ui`) was written to these conventions, but none of it has run yet
and nothing below has been tested against real code in anger. Treat them as working positions;
revise them deliberately as Phase 1 is verified, and update this section when you do.

### 6.1 Structure

- The layout in [README.md](README.md) is the target: `app/src/{recording, matching, progress,
  map, souvenir, storage, platform, ui}`, plus `content/`, `tiles/` and `tools/`.
- **The `content/` rule is absolute:** no Madeira-specific knowledge in `app/`. POI lists,
  region boundaries, levada corridors, tunnel portals, stamp artwork and tile packs all live
  in `content/` as data. The moat is the bounded scope; it must not become the ceiling.
- Subsystem boundaries follow the data flow in [ARCHITECTURE.md](ARCHITECTURE.md). Recording
  must not depend on matching; matching must not depend on presentation.

### 6.2 Data handling

- **`raw_fix` and `sensor_sample` are immutable and append-only.** Never edit, never delete
  mid-trip.
- **Everything derived is regenerable.** `visited_segment`, `stamp_award` and
  `region_progress` must be reproducible from raw data plus the content pack. If a change
  makes them un-regenerable, the change is wrong.
- **Flush immediately.** Every batch goes to disk on arrival. A crash costs seconds, not
  hours. Never hold a day's data in memory.
- **Store confidence on every credit.** One column, never shown to the user, and it is what
  lets thresholds be retuned later against real data without re-collecting anything.
- SQLite with WAL mode throughout. R-tree spatial index over the road graph.

### 6.3 Battery discipline

Treat these as review criteria, not suggestions:

- Never open a continuous high-accuracy location stream. **We need the trace, not real-time
  position.**
- Use batched delivery (iOS deferred updates, Android `setMaxWaitTime`) — the single largest
  win available.
- Gate sampling on activity recognition.
- Prefer geofences to polling, always.
- Run matching in bursts on idle or charge, never per-fix.
- Never render the map in the background.
- Prefer barometer and pedometer to GPS wherever they suffice — they are dedicated low-power
  sensors that also work where GPS does not.

Any PR that adds a periodic timer, a background render, or a location stream needs an
explicit battery justification.

### 6.4 Privacy discipline

- **No new dependency lands without a network-behaviour check.** This is the actual leak
  vector.
- No analytics, no ads, no crash-reporting SDK that phones home.
- No new network call may be added without an explicit decision recorded in DECISIONS.md.
  The current permitted total is one: the optional first-run tile download.

### 6.5 Accessibility discipline

- Minimum tap target **60dp**, not 44.
- Respect system font scaling everywhere.
- Never differentiate meaning by hue alone — always brightness and/or weight as well.
- Unvisited roads stay legible mid-grey. Never near-black, never near-invisible.
- Minimal does **not** mean unlabelled. Older users want confirmation of what a control does.
  The target is one screen with a small number of large, clearly-named things. This is why the
  settings entry point is a **gear and not three lines** — a hamburger is a learned convention
  that promises a drawer of destinations.
- Test in bright outdoor sunlight, not just on a desk.

**Revised 2026-08-08 (D-026).** The dark-aesthetic-versus-legibility tension noted here was
resolved rather than traded: the app ships **two styles over one tile pack** — light for
everyday use, where sunlight legibility matters, and dark for the souvenir, where the
fog-of-war metaphor and the shareability matter. "Visited is brighter" therefore holds only in
the dark style; in the light style visited is *darker and heavier*. The underlying rule is
unchanged and is the one to apply: **weight always carries part of the signal, and unvisited
must stay readable.** Full direction and the primary-screen structure are in
`docs/design-brief.md`.

### 6.6 Testing

- **Unit tests run on Node's own test runner, with no test framework installed.**
  `cd app && npm test`. Node 22+ strips TypeScript types as it loads a file, so a `.test.ts`
  file next to the code runs directly — no Jest, no Babel, no transform config, and nothing
  added to `package.json` except the script. Added 2026-08-10 with T-039.
  Two consequences worth knowing before writing one:
  - **A tested module must import with an explicit `.ts` extension** (`./distance.ts`).
    Node's module resolver will not guess it; Metro does not mind either way. This is
    JavaScript-ecosystem weirdness, not a concept — everything not under test stays
    extensionless, as the rest of the codebase is.
  - **Test what is pure.** Anything that touches SQLite, Expo or the clock is not reachable
    this way and belongs in the device testing below. Keeping the arithmetic in its own
    module — as `geofenceSelection.ts` is separated from `geofenceManager.ts` — is what makes
    the valuable half testable at all.
- The Phase 0 field traces in `tools/fixtures/` are the **permanent matching regression
  suite**. Every matching change runs against them.
- Real-device testing is mandatory for anything touching recording. Simulators do not
  reproduce OEM battery killers, force-quit relaunch behaviour, or barometer noise.
  **This rule survived contact with reality on 2026-08-10** and is worth restating precisely,
  because there is no Android device on the project and an emulator is doing the day-to-day
  looking (`docs/dev-build.md`). The emulator is legitimate for *rendering, storage, UI,
  permissions and replayed-route logic* — and worthless for battery, background survival and
  GPS realism. Never let a green result in the emulator close a task that names a battery
  figure or a survival claim.
- Battery measurements are part of the acceptance criteria for Phase 1, not an afterthought.

---

### 6.7 The project lead is new to JavaScript

Confirmed 2026-08-06. They have **no JavaScript, TypeScript or web development background** and
chose React Native on technical merit anyway (D-023). They are learning the language alongside
the project. This should shape how the codebase is written and how things are explained.

- **Use TypeScript from the first file, not plain JavaScript.** Counterintuitive for a beginner,
  but types catch exactly the class of error that is most baffling without prior JS idiom —
  undefined properties, wrong shapes, silent coercion. Expo's templates are TypeScript by
  default.
- **Do not assume web idiom.** No DOM, no CSS layout quirks, no bundler folklore. The JavaScript
  surface this app actually needs is narrow: components, state, `async`/`await`, and array
  methods. Explain within that surface rather than gesturing at the wider ecosystem.
- **Prefer explicit, boring code over idiomatic cleverness.** No point-free style, no clever
  destructuring chains, no `reduce` where a plain loop reads better. Readability by someone
  still learning the language outranks concision.
- **Phase 1 is a gentle on-ramp by luck of sequencing** — the recorder is mostly configuration
  and data plumbing with a debug screen, not complex UI. Keep it that way.
- **Comment the *why*, not the *what*.** The reasoning behind this project is unusually dense
  and most of it lives in DECISIONS.md. Reference decision IDs from code where relevant.

**Sharpened risk:** the map-matching-in-JavaScript performance concern (D-023) matters more
here, because diagnosing a performance problem in an unfamiliar language is harder. Measure
matching throughput **early** in Phase 4, not late.

---

## 7. Platform facts you must not rediscover the hard way

- **iOS: region monitoring and significant-location-change relaunch a terminated app, even
  after the user force-quits it from the app switcher. Standard continuous background location
  updates do not.** This single fact is why geofences are the backbone. *Re-verify against
  current Apple docs before implementing — stable for years, but Apple adjusts it.*
- **iOS caps simultaneously monitored regions at 20.** With 150–250 POIs, the geofence set
  must be swapped dynamically (nearest ~18 + one large "you left this area" trigger). Painful
  to retrofit; design it in from the start. Android's cap is around 100, but the same
  mechanism covers both.
- **iOS Data Protection must be `CompleteUntilFirstUserAuthentication`.** Full `Complete`
  will fail, because the app needs to write while the device is locked.
- **iOS can silently downgrade Always → While-Using** mid-trip. Detect it and recover gently.
- **Android OEM battery managers kill background work regardless of the official APIs.** A
  foreground service with a persistent notification survives far better; also request a
  battery-optimisation exemption. See dontkillmyapp.com.
- **Android 14+ requires the `FOREGROUND_SERVICE_LOCATION` type declaration.**
- **The database should participate in normal encrypted device backup.** That is the answer
  to "my phone died on day 5," and it costs nothing in privacy terms.
- **`setFeatureState` is a MapLibre GL *JS* API and is not reliably available on MapLibre
  Native mobile.** It landed on Android and reached Web only recently; iOS parity is unclear
  and in flux, and the React Native and Flutter wrappers lag the core library regardless. This
  affects both frameworks equally. **Do not design anything around it** — see D-022 for the
  overlay approach that avoids it. Data-driven style *expressions* are fine and fully
  supported; only runtime per-feature state mutation is the problem.

---

## 8. Open questions

Tracked in full in [PROJECT_PLAN.md](PROJECT_PLAN.md) under "Outstanding decisions."

| ID | Question | Blocks | Status |
|---|---|---|---|
| OD-1 | React Native or Flutter? | ~~All of Phase 1~~ | **Resolved 2026-08-06 — React Native** (D-023). Phase 1 unblocked. |
| OD-2 | Is Porto Santo in scope? | Tile bounds, POI curation, trip-end detection | **Resolved 2026-08-06 — included** (D-021) |
| OD-3 | Hero number: stamps or road coverage? | Primary screen, data model | **Resolved 2026-08-06 — stamps** (D-002 Accepted) |
| OD-4 | Monetisation | Nothing (deferred) | Deferred. Free for v1; no ads ever. |
| OD-5 | Cruise day-trippers as a segment? | Content curation | Open, not blocking. Not designed for; happy accident if it works. |
| OD-6 | Raw trace retention policy | Phase 1 schema | **Resolved 2026-08-06 — retain**, with a delete-all control (D-010 Accepted) |
| OD-7 | Levada data source and licensing | ~~Content, matching~~ | **Resolved 2026-08-08 — OSM alone is sufficient** (D-029). The 44 official PR routes are already in OSM, so no external licensing arises. Select by name + relation, never by tag. See `docs/osm-coverage.md` |

### Recently closed

- ~~Who does the Phase 0 fieldwork?~~ **Resolved 2026-08-06 — the project lead lives in
  Madeira.** See §5a. Sequencing stands; field validation is continuous.
- ~~Transistor Soft licence sign-off~~ **Resolved 2026-08-06 — not purchasing for now.**
  Costed at $399 one-time, perpetual, one app, both platforms. Superseded by D-025: build on
  free `expo-location` behind a swappable interface, and buy only if the Phase 1 soak tests
  (T-051–T-054) fail. **The project currently has a $0 dependency cost.**

### Unvalidated assumptions (Phase 0 answers these)

- Does the barometer stay usable inside tunnels and under canopy?
- Does altitude reliably separate the VR1 from the coastal road below it?
- Does the pedometer keep counting through GPS blackouts?
- Do stable OSM way IDs survive the tile pipeline? *(No longer a decision gate — D-022 removed
  the dependency. Still nice to have as an internal join key.)*
- Does the locally-drawn overlay align cleanly with the basemap's road rendering? *(This is the
  new thing to prove in Phase 0.2.)*
- Is the tile pack small enough for a hotel-WiFi download?
- ~~Is OSM levada coverage complete enough to build on?~~ **Answered 2026-08-08 (T-028, D-029) —
  yes.** 3,981 named ways, 1,386 walkable, 108 levada tunnels, 44 official PR relations. The open
  question is now **accuracy**, not coverage: corridor connectivity, portal-node precision, and
  whether the PR relations are current. Only answerable in the field.
- Do batched location APIs actually hit the battery targets on real devices?

### Accepted product risks

- A curated 150–250-place canvas produces visible daily progress where island-wide road
  coverage would not. *Believed, not proven.*
- The souvenir video is compelling enough to drive organic installs. **This is the entire
  distribution strategy and there is no fallback currently in play.**
- Tourists will grant background location if asked at the right moment with a clear reason.
- An 80-year-old will use a passive tracker at all. (The accessibility constraint is better
  read as "no learning curve for anyone" than as a literal demographic target.)

---

## 9. Keeping these documents true

**These seven documents are the source of truth for the project, not conversation history.**
The six at the repository root — README, PROJECT_PLAN, ARCHITECTURE, TASKS, DECISIONS,
CONTEXT — plus `docs/design-brief.md`, added 2026-08-08.

Conversation history does not survive across sessions or context compaction. A decision that
lives only in a chat log is a decision that will be re-litigated in three weeks, or silently
reversed by someone who never knew it was made. Much of the reasoning in this project is
non-obvious from the outside — several decisions look arbitrary until you know what they were
protecting against. That reasoning has to live in the repository.

### The rule

Whenever an important architectural or planning decision is made, **update the affected
documents as part of the same piece of work.** Not later, not at the end of the phase.

### How much latitude — agreed with the project lead 2026-08-08

The standing instruction to keep these documents current pulled against the instruction not to
change the plan without approval. The boundary is now drawn, in three tiers:

| Tier | Examples | What to do |
|---|---|---|
| **Just do it** | Factual corrections; internal contradictions between documents; task status changes; writing down something the project lead decided in conversation | Make the change, and say plainly afterwards what changed and why |
| **Do it, mark Provisional** | A new decision being *recommended*, including ones the project lead has agreed to in conversation but that remain unvalidated | Record it with a `D-0xx`, status **Provisional**, and flag it. Never launder a strong lean into **Accepted** |
| **Ask first** | Reversing an Accepted decision; changing scope; reordering phases | Do not edit. Raise it |

This resolves the fourth item in the old "decisions waiting on the project lead" table in
HANDOFF.md. The default for anything new is **Provisional** — the burden is on confirmation, not
on objection.

### Which document gets updated

| Change | Update |
|---|---|
| Any decision with alternatives worth remembering | **DECISIONS.md** — always, first |
| System design, components, data flow, schema, platform behaviour | ARCHITECTURE.md |
| Phases, milestones, success criteria, open decisions, risks | PROJECT_PLAN.md |
| New/removed/reordered tasks, changed dependencies, completed work | TASKS.md |
| Anything a fresh contributor would need to know | CONTEXT.md |
| Status, goals, project structure | README.md |
| Visual direction, map styling, screen structure, naming | `docs/design-brief.md` |

Most decisions touch more than one. A decision that changes the architecture almost always
changes tasks and their dependencies too.

### Conventions

- **DECISIONS.md IDs are stable.** Take the next free `D-0xx`. Never renumber, never reuse.
  Supersede rather than delete — mark the old entry **Superseded** and link forward.
- **Record what was rejected, and why.** The rejected alternatives are the most valuable part
  of the log. They are what stops a settled question from being reopened.
- **Mark decisions the project lead has not explicitly confirmed as Provisional**, not
  Accepted. Do not launder a strong lean into a settled decision.
- **Resolving an open question is a three-place edit:** the `OD-x` entry in PROJECT_PLAN.md,
  the open-questions table in CONTEXT.md §8, and the status of the corresponding DECISIONS.md
  entry.
- **Task IDs are stable too.** Reference them in commits. Never renumber.
- When Phase 0 answers an unvalidated assumption, move it out of the "unvalidated" lists in
  ARCHITECTURE.md §11 and CONTEXT.md §8, and record the actual measured result — not just
  "confirmed."
- Say plainly which documents were changed and why. Never rewrite these silently.

### A note on the AI-assisted workflow

Claude Code sessions on this project are instructed to do the above automatically. That
instruction is stored in the session memory for this directory, but it is written here as well
because the repository must not depend on any particular tool's memory to stay coherent.

---

## 10. Where to start

1. Read [DECISIONS.md](DECISIONS.md) — it explains *why*, and prevents re-litigating settled
   questions.
2. Check [TASKS.md](TASKS.md) for the ordered checklist and dependencies.
3. **The immediate next action is Phase 0 validation** — the tile pipeline spike (T-022–T-026)
   and the field GPS runs (T-017–T-021a). Phase 0 is deliberately cheap and answers the
   questions that would be expensive to get wrong later. The tile spike in particular is the
   unblock for all visual work, because the map is a MapLibre style and cannot be designed
   against an imaginary map (`docs/design-brief.md` §1).
4. **A development build is the other gate.** Background location cannot run in Expo Go, so no
   Phase 1 claim is verifiable until one exists. See HANDOFF.md.

*(T-013, the framework decision, was the blocking item here until 2026-08-06. It is closed —
React Native, D-023.)*

Two things that are worth starting early because they sit on the critical path and are
outside our control: the **Google Play background-location review** (T-123) and **beta
recruitment** (T-129), which requires real people to actually go to Madeira for a week.

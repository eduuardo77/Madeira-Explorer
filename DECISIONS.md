# Decision Log

Design decisions, the alternatives considered, and the reasoning. Each entry stands alone so
it can be revisited without re-deriving the argument.

**Document date:** 2026-08-06

Status values: **Accepted** · **Provisional** (leaning strongly, not final) · **Open** ·
**Deferred** · **Superseded**

**Maintenance:** this log is updated as decisions are made, not retrospectively. Take the next
free `D-0xx` for new entries; IDs are stable and are never renumbered or reused. Supersede
rather than delete. Always record the alternatives rejected and why — that is the part that
stops settled questions being reopened. Full protocol in [CONTEXT.md §9](CONTEXT.md).

---

## D-001 — No backend. Fully on-device architecture.

**Status:** Accepted

**Decision:** The app has no server, no account, no sync, and no analytics. All data lives on
the device. The only network activity in the app's lifetime is an optional one-time tile pack
download over WiFi.

**Alternatives considered:**

- *Server-side map matching* (the Wandrer/CityStrides model). Rejected: uploading raw
  location traces creates a GDPR controller relationship, an ongoing hosting cost, a breach
  surface, and a dependency on connectivity that Madeira's north and interior cannot supply.
- *Optional cloud sync for backup.* Rejected for v1: it reintroduces accounts and a privacy
  surface to solve a problem the OS-level encrypted device backup already solves.
- *Anonymous analytics only.* Rejected: it would make "no data leaves the device" false, and
  the marginal insight is not worth surrendering the cleanest possible store privacy
  declaration.

**Reasoning:** The bounded geography makes this viable — a global app could not bundle its
map. Going server-free simultaneously solves mobile data cost, privacy, running cost,
offline operation in poor-coverage areas, and store privacy declarations. It is the rare
decision where every constraint points the same way.

**Consequences:** No remote diagnostics; beta feedback must come from voluntary, explicit
trace export. No cross-device history. Losing the phone loses the trip unless device backup
covers it.

---

## D-002 — Curate the canvas. Stamps are the score, not island-wide road coverage.

**Status:** **Accepted** — re-confirmed by the project lead 2026-08-06 after the question was
re-explained in plain terms. OD-3 closed.

**Decision:** The headline metric is a curated collection of 150–250 notable places, with
per-region progress as supporting detail. Island-wide road coverage percentage is *not* the
hero number.

**The problem this solves:** A tourist is in Madeira for 5–10 days. Against a canvas of every
road on the island, they would light up perhaps 3–5%. The map stays ~95% dark for the entire
trip. GTA's fog map works because you eventually fill it; Fog of World works because
residents play for years. Our user leaves before any payoff. A dark map is demotivating, not
rewarding.

It also fails the second half of the product's purpose. "Where you can go next" does not fall
out of a dark map — on day 2, everywhere is dark. Absence of highlight is noise, not a
recommendation.

**Alternatives considered:**

- *Track all roads, score island-wide %.* Rejected for the reason above.
- *Fog-of-war reveal circles instead of street highlighting.* Reveals area faster and feels
  more generous, and needs no map matching at all. Retained as the **fallback** if the tile
  pipeline cannot preserve OSM IDs (see D-004), and as a possible v1 simplification.
- *Per-region progress alone.* Good, and adopted as a supporting mechanic — there is always a
  nearby win, and it implicitly directs the user. But it does not by itself produce the
  discrete, collectible moments that make a day feel rewarded.

**Reasoning:** A curated set moves every day, produces visible progress in a week, and solves
discovery for free — the uncollected places *are* the recommendations. It also plays to the
one advantage a Madeira-only app has over any global competitor: we can hand-verify every
entry.

**Consequences:** Requires real curation effort (Phase 3). Creates a content pipeline. Makes
the app's quality partly editorial rather than purely technical.

---

## D-003 — "Passport stamps," not "stars."

**Status:** Accepted

**Decision:** The collectible is a stamp in a passport, not a star or a point.

**Alternatives considered:**

- *Stars.* The original proposal. Rejected on two grounds. First, a points currency invites
  the question *"what do I spend these on?"*, and if the answer is "nothing," they feel
  hollow. Second, stars imply a rating scale, which implies places are ranked.
- *Badges/achievements.* More gamified than the audience wants, and harder to make legible
  for an older user.

**Reasoning:** "Passport stamps" is universally understood by travellers of any age, needs no
explanation, is inherently collectible, and is complete in itself — a stamp does not have to
be spent to have value. It also produces a second highly shareable screen: a filled passport
page, which is a souvenir in its own right.

**Consequences:** Requires stamp artwork per POI, which is a real design cost. Also imposes a
complexity-budget discipline: region % *and* stamps *and* highlighted roads is three scoring
systems on one screen. One must be the hero.

---

## D-004 — MapLibre GL Native with offline vector tiles carrying stable OSM way IDs.

**Status:** Accepted (with a defined fallback)

**Decision:** Render with MapLibre GL Native against a PMTiles/MBTiles vector extract of
Madeira. Generate tiles (via Tilemaker, Protomaps or equivalent) such that **stable OSM way
IDs survive into the tiles**, so individual segments can be recoloured at runtime via
data-driven style expressions and feature state.

**Why this specific detail matters:** the OSM way ID is the join key between the visited-set
in SQLite and the geometry on screen. Without it, highlighting an individual street means
regenerating tiles on device, which is not feasible. With it, recolouring thousands of
segments is a GPU-side operation that costs nothing.

**Alternatives considered:**

- *Google Maps / Mapbox SDKs.* Rejected: network-dependent by default, per-request billing,
  weaker offline story, and every tile request leaks position to a third party — which would
  destroy D-001.
- *Raster tiles.* Rejected: cannot recolour individual features at runtime.
- *Rendering our own geometry over a static base.* Considered; adds significant work for no
  advantage once feature state is available.

**Fallback:** if Phase 0.2 shows OSM IDs cannot be preserved through the pipeline,
street-level highlighting is not viable client-side and we fall back to fog-of-war reveal
(D-002 alternative). The product still works, because stamps carry the score.

### ⚠ Revision 2026-08-06 — the feature-state half of this decision was wrong

Research into the framework choice surfaced that **`setFeatureState` is a MapLibre GL JS (web)
API and is not reliably available on MapLibre Native mobile.** As of mid-2026 it has landed on
Android and was only recently brought to Web; iOS parity is unclear and in flux, and the React
Native and Flutter wrappers lag the core library regardless. A maintainer discussion on the
React Native repo (May 2025) states plainly that it is not implemented in the wrapper because
the underlying native mobile SDKs lacked it.

**This is not a framework differentiator — it affects React Native and Flutter equally.** It is
an architecture risk that was mis-assessed here, and it is superseded by **D-022**, which
removes the dependency entirely.

Data-driven style *expressions* remain fully supported and are unaffected. Only the
feature-state mechanism for mutating per-feature values at runtime is in question.

---

## D-005 — Geofences as the system backbone.

**Status:** Accepted

**Decision:** The reward system (stamp collection) is driven by OS geofences, not by
analysing the continuous location stream.

**Reasoning:** OS geofences are handled by the location coprocessor and are effectively free
on battery; they survive app termination *and* force-quit on iOS, where continuous background
location updates do not; they tolerate poor GPS accuracy because the radius can be generous;
and they require no continuous stream at all. Battery, OS-resilience, GPS-tolerance and
privacy all point to the same mechanism. That convergence is unusual enough to build around.

**Alternatives considered:**

- *Proximity detection from the continuous location stream.* Rejected: requires the stream to
  be running (battery), requires the app to be alive (fragile), and fails when accuracy is
  poor.

**Consequences and constraints:**

- **iOS caps simultaneous monitored regions at 20.** With 150–250 POIs, the active set must be
  managed dynamically: register roughly the nearest 18, plus one large "you have left this
  area" region whose exit triggers a reshuffle. Android's limit is around 100, but the same
  mechanism covers both.
- This is painful to retrofit, so it is designed in from Phase 1.

---

## D-006 — Buy the background-geolocation library rather than build it.

**Status:** **Superseded in part by D-025 (2026-08-06).** The technical assessment below still
stands — it is the best-in-class option and the right thing to buy *if we need it*. What
changed is the sequencing: it is now a contingency purchase, not a starting assumption.

**Decision:** Use Transistor Soft's `react-native-background-geolocation` /
`flutter_background_geolocation` (paid licence).

**Reasoning:** It encapsulates years of accumulated platform-specific battery, permission and
OEM-survival quirks that we would otherwise rediscover painfully and slowly — the exact
category of problem where in-house implementation looks cheap and is not. It is the
highest-leverage money on the project.

**Alternatives considered:**

- *Free/open-source plugins.* Generally weaker on the hard parts: OEM killers, deferred
  updates, permission escalation flows, termination survival.
- *Writing native CoreLocation and FusedLocationProvider integration ourselves.* This is the
  main argument for going fully native, and buying the library removes it.

**Consequences:** A licence cost, and a dependency on a third party for the most critical
subsystem. Mitigated by the fact that its behaviour is well documented and the raw data it
produces is ours.

**Licence terms, checked 2026-08-06:** the plugin wrapper is Apache-2.0, but it wraps
Transistor Software's proprietary native iOS/Android SDKs, which require a paid licence for
production use. Pricing is a **perpetual, one-time, per-app-identifier fee** — Starter is
**$399 for one app**, covering both iOS and Android, unlimited users and devices, including one
year of updates. Higher tiers cover more apps. Restrictions are the usual: no resale or
sublicensing of the SDK or keys, binary distribution embedded in your own app only,
non-transferable, no warranty.

**Unresolved:** the published terms say a licence is needed for "production use" but do not
explicitly state whether debug/development builds run unlicensed. In practice these SDKs
normally work in debug and fail licence validation in release builds, which would mean the
whole app can be built and tested before paying. **Confirm with Transistor directly before
planning around it** — it determines whether the $399 is an up-front cost or a
pre-launch one.

---

## D-007 — React Native or Flutter, not fully native.

**Status:** Accepted. Specific framework resolved 2026-08-06 — **React Native** (D-023).

**Decision:** Build cross-platform rather than two native apps.

**Reasoning:** The main argument for native was fine-grained control over background location
and battery. D-006 removes that argument, since the library provides equivalent control from
either framework. Native would buy marginal additional battery control for roughly double the
work — not worth it for v1.

**Open sub-decision:** React Native vs Flutter — resolved by recommendation in **D-023**.

---

## D-008 — The app must be fully usable with "While Using" permission only.

**Status:** Accepted

**Decision:** Background ("Always") location is an *upgrade*, never a gate. The app ships a
complete experience with While-Using permission via an explicit start/end recording mode, and
requests Always later — around day 2, after the user has already seen a filled-in trail and
understands why it helps.

**Reasoning:** Background location is the hardest permission on both platforms and is getting
harder.

- **iOS** cannot request Always up front; the flow is While-Using then escalate. iOS then
  periodically shows the user a map of everywhere the app tracked them and asks whether to
  continue. To a non-technical 80-year-old that reads as a security warning, and they will
  tap Deny.
- **Android 11+** cannot request background location inline at all — the user must be sent to
  a system settings screen. It also requires a prominent-disclosure screen beforehand and a
  permanent foreground-service notification.
- **Google Play reviews these apps manually and rejects many**, requiring a demonstration
  video and written justification. Apple pushes back too unless the purpose strings are
  excellent.

**This alone could sink the app** if onboarding depends on it. Gating install-time
onboarding on the hardest permission in mobile is the single most avoidable way to fail.

**Consequences:** Two supported operating modes, and therefore more testing surface. A
permission-downgrade detector is required, because iOS can silently drop Always → While-Using
mid-trip.

---

## D-009 — Bias matching toward false positives.

**Status:** Accepted

**Decision:** When in doubt, credit the user. The governing rule:

> **Be generous filling in gaps between things you are certain about.
> Be strict about what you are certain about.**

Credit the connection; verify the endpoints.

**Reasoning:** A missed levada is an uninstall — the user did the hard thing and the app did
not notice. That is the worst possible failure. But unlimited generosity is equally fatal in
a different way: if stamps fire when someone merely drives past a trailhead, the entire
collection becomes worthless and the reward evaporates. The asymmetry resolves cleanly by
separating the two questions: *were they there* (strict) and *how did they get between two
places we know they were* (generous).

**Concrete rules derived from this:**

| Situation | Treatment |
|---|---|
| Fix at tunnel portal A, then portal B, plausible elapsed time | Credit whole tunnel — this is a certainty, not a guess |
| Signal gap with a plausible shortest path (<~30 min, <~15 km) | Credit the route |
| Levada trailhead + exit point | Credit the entire walk; levadas are linear with no mid-route exits |
| GPS dead but pedometer + barometer show a climb from a known trailhead | Credit via sensor fallback |
| In a POI geofence for N minutes at walking pace | Award stamp |
| Passing a POI geofence at 60 km/h | **Do not** award stamp |

**Consequences:** Requires the tunnel portal and levada corridor data in the content pack.
Requires a confidence value stored per credit so thresholds can be retuned later against real
data without re-collecting anything.

---

## D-010 — Retain raw traces; treat matching as a replaceable layer.

**Status:** **Accepted** — re-confirmed by the project lead 2026-08-06 after the question was
re-explained in plain terms. OD-6 closed.

**Decision:** Raw fixes and sensor samples are stored immutably and never discarded during a
trip. Matching outputs are derived and fully regenerable.

**Reasoning:** The raw trace is the only irreplaceable asset. Algorithms, scoring and
visualisation can all be rewritten and re-run over stored history, retroactively improving
every user's map. A missed recording can never be recovered. A week of batched fixes is a
trivially small amount of data.

**Tension:** GDPR data-minimisation would argue for discarding raw data after matching. This
is weighed against the fact that nothing ever leaves the device, so the exposure is minimal.

**Counterweight:** a single, obvious "delete all my data" control.

---

## D-011 — Exactly two notifications per trip.

**Status:** Accepted

**Decision:** Despite the "ghost app" framing, the app sends two notifications in a normal
week:

1. **Day-1 health check** (12–24h after install): confirmation that recording is working —
   or, if it is not, the one interruption worth making while six days remain to fix it.
2. **The reveal** at trip end.

**Reasoning:** A true silent ghost has a catastrophic failure mode: if tracking dies on day 2
and the user opens the app on day 7 to find three-quarters of their trip missing, that is
worse than never having installed it. Two messages in seven days is not intrusive; it is the
difference between a delightful surprise and a silent failure discovered too late.

**Alternatives considered:**

- *Zero notifications.* Purest expression of the concept, but it makes silent failure
  undetectable and unrecoverable.
- *Daily summaries.* Rejected: destroys the surprise, adds nagging, and contradicts the
  entire product concept.

**Amended 2026-08-12 — the budget holds at two. Confirmed by the project lead.**

T-052b built a continuous check that notices a recorder which is running and receiving nothing
(D-047 is the day it was needed). The obvious next step was to let it *tell* the user, which
would have been a third notification. **Rejected, and this is the reasoning to keep:**

- Its threshold, `SILENCE_TOLERANCE`, is **provisional and unmeasured**. Spending a permanent
  interruption on a guessed number is how a false alarm becomes a habit, and
  `healthCheckPolicy`'s own header explains at length why a false alarm here is expensive: it
  teaches a tourist to distrust the app, and the fixes they reach for — reinstalling, revoking
  permissions — make things worse.
- **The day-1 check already covers the case for a user who is not looking.** It asks the same
  question at 14 hours and spends a notification that is already budgeted. The new check's value
  is that it answers in *minutes* and costs *nothing*, which is worth having on the debug screen
  and in a field test without being worth an interruption.
- A third message is also a scope change, and CONTEXT §9 puts that with the project lead rather
  than in a commit.

**The revisit trigger is T-051.** If the soak shows silence that the day-1 check would miss and a
user could act on, this comes back — with a measured threshold, and probably by *sharpening the
day-1 check* rather than adding a third message.

---

## D-012 — Airport geofence as the trip-end trigger.

**Status:** Accepted

**Decision:** Trip end is detected primarily by a geofence around Madeira Airport, with Porto
Santo airport and the Funchal cruise terminal as additional triggers. Fallbacks: leaving the
island bounding box, or 24h+ without data.

**Reasoning:** This is the best moment in the entire product. The user arrives to fly home,
their phone buzzes, and they are sitting in a departure lounge with nothing to do and a head
full of the trip they just had. That is the ideal context for both the emotional payoff and
the share action that constitutes our entire distribution strategy. It is also trivial to
implement — a geofence and a notification.

---

## D-013 — The souvenir video is the distribution strategy.

**Status:** Accepted

**Decision:** The end-of-trip 9:16 vertical video is treated as a headline feature and gets
disproportionate polish. Watermarked, clean, aesthetic.

**Reasoning:** There is no organic App Store search term that finds this app. Nobody searches
"Madeira exploration tracker" — they search "Madeira hiking" and land on AllTrails. The user
installs once, uses it for seven days, and goes home; there is no retention loop and no
in-app virality.

But consider who sees the video when it is posted: **people who follow someone who just went
to Madeira.** That is an extraordinarily well-targeted audience for a Madeira app, and it
costs nothing. Every trip that ends is a free, perfectly-aimed advertisement — *provided the
video is good enough that people actually post it.*

**Alternatives considered:**

- *Partner distribution* (rental car companies, hotels, quintas, tour operators, the regional
  tourism board, cruise lines). Analysed and judged higher-leverage per unit of effort than
  App Store optimisation, but **explicitly set aside by project decision** in favour of
  organic sharing. Recorded here because it remains the obvious fallback if organic sharing
  underperforms.
- *Paid acquisition.* Not viable at the likely ARPU.

**Consequences:** The video's quality is not a polish item; it is load-bearing. If it is
mediocre, the app has no distribution at all.

---

## D-014 — Printed poster / physical souvenir monetisation deferred.

**Status:** Deferred (see OD-4)

**Decision:** No monetisation in v1. Free, no in-app purchases, no ads.

**Reasoning:** Ads would destroy the privacy position outright (ad SDKs collect location and
IP by default, making "no data leaves the device" false). The printed-map idea — the
Polarsteps model, where the app is free and the money is in a physical artefact people buy on
holiday — is commercially the most credible option and was analysed favourably, but the
project lead has parked it for now.

**Context worth preserving:** on realistic numbers (well over a million annual visitors, a
0.1–0.5% install rate for an unknown niche app with no marketing) a paid app at ~€4 would
gross a few thousand to perhaps €20k a year before store fees. That is a side project that
pays for itself, not a business. Raising ARPU via a physical product is the lever that
changes that arithmetic, if the project ever wants it to.

---

## D-015 — Accessibility beats aesthetics where they conflict.

**Status:** Accepted. **The encoding below is revised by D-026 (2026-08-08)** — the app ships
two styles, so "visited is brighter" holds only in the dark one; in the light style visited is
darker and heavier. The rule itself is unchanged and is the part that matters: *never
differentiate by hue alone, and unvisited must stay legible.*

**Decision:** Unvisited roads render as a legible mid-grey, not near-black. Visited segments
are differentiated by **brightness and line weight**, not hue alone.

**Reasoning:** A dark map with very low-contrast unvisited roads is precisely what reduced
contrast sensitivity and age-related lens yellowing struggle with — the stated "80+ must be
able to use it" goal directly contradicts the stated "dark map with shaded unvisited roads"
aesthetic. If unvisited roads are too dim, an older user cannot read the map at all, and it
stops being a map and becomes a mood. Differentiating by brightness *and* weight rather than
colour alone also covers colour vision deficiency for free. The map must also stay readable
in bright outdoor sunlight.

**Related constraints adopted:** tap targets 60dp minimum (not 44), system font scaling
respected for labels, one hero number on the primary screen.

**Note on "less text":** minimal does not mean unlabelled. Older users often want
*confirmation* of what a control does. The target is one screen with a small number of
large, clearly-named things — not an unlabelled interface.

---

## D-016 — Mask the user's accommodation in exports by default.

**Status:** Accepted

**Decision:** Detect the most frequently visited overnight location and mask a radius around
it in all shared exports. Alternatively or additionally, trim the first and last stretch of
each day's trace.

**Reasoning:** The souvenir video is an export of location history. A trace that returns to
the same house every night publishes the user's accommodation — and by extension, when it is
empty — to a public social feed. This is the single genuine privacy risk in an otherwise
airtight design, and it comes from the app's most-promoted feature. The fix is cheap and it
is the kind of detail that earns trust and good reviews.

---

## D-017 — All Madeira-specific content lives as data, not code.

**Status:** Accepted

**Decision:** The POI list, region boundaries, levada corridors, tunnel portals, stamp
artwork and tile pack all live in `content/`. The application contains no hardcoded island
knowledge.

**Reasoning:** Costs nothing now and saves everything later. The bounded scope is the moat
today — hand-curation is exactly what a global competitor cannot do. But if this works, the
natural next move is the Azores, Tenerife or Gran Canaria, and that should be a content pack
rather than a rewrite. The moat must not become the ceiling.

**Reinforced by D-021:** Porto Santo is the first test of this rule. If adding a second island
requires touching anything in `app/`, the content/code separation has already failed.

---

## D-018 — Never build navigation.

**Status:** Accepted

**Decision:** Tapping a place shows a minimal card — name, photo, distance, and a single
"Directions" button that hands off to Apple or Google Maps. The app never draws a route to
follow.

**Reasoning:** Turn-by-turn navigation is an enormous engineering surface, is done far better
by incumbents the user already has installed, would require live routing data (breaking the
offline architecture), and would be a battery catastrophe. Handing off costs one button.

---

## D-019 — Build the recorder before the visualisation.

**Status:** Accepted

**Decision:** Phase 1 delivers a durable recorder with only a debug UI. The map, stamps,
matching and souvenir all come afterward.

**Reasoning:** Follows from D-010. The trace is the only thing that cannot be recreated
later. Every other layer can be rewritten and re-run over stored data. Building the pretty
part first and the reliable part second is the standard way these projects fail.

---

## D-020 — Validate physical assumptions before committing to street-level matching.

**Status:** Accepted

**Decision:** Phase 0 walks a real levada and drives a real tunnel route with a raw logger
before any matching code is written, and commits the resulting traces as permanent test
fixtures.

**Reasoning:** Madeira is close to the worst case for GPS map matching — well over a hundred
road tunnels with the VR1/VE1 substantially underground, vertically stacked roads where the
expressway runs above or below the old coastal ER101, and dense Laurissilva canopy over the
levadas that are the island's defining activity. Whether street-level matching is viable at
all depends on facts we do not yet have. A weekend of fieldwork answers it, and the resulting
traces become the regression suite that every future matching change is tested against.

**Caveat raised and resolved 2026-08-06:** this assumed whoever does the fieldwork is on the
island. **Confirmed — the project lead lives in Madeira.** Phase 0 is genuinely cheap, the
"validate before building" sequencing stands unchanged, and field validation is a continuous
capability rather than a one-off trip. See CONTEXT.md §5a.

---

## D-021 — Porto Santo is in scope for v1.

**Status:** Accepted — decided by the project lead 2026-08-06 (OD-2 closed)

**Decision:** Porto Santo is included **structurally but not editorially.**

Clarified by the project lead 2026-08-06: include it now because retrofitting later is more
expensive, but **do not spend curation effort or design attention on it.** It stays "in the
shadows" for v1.

| Include now (cheap, or a correctness requirement) | Defer |
|---|---|
| Tile extract bounds cover both islands — one flag | POI curation beyond a handful of obvious entries, or none at all |
| Both islands treated as one region for trip-end detection — **correctness, not polish** | Sub-regions or per-region progress breakdown for Porto Santo |
| Ferry crossing excluded from gap bridging — **correctness** | Stamp artwork |
| Porto Santo airport as a trip-end trigger | Any dedicated UI, copy, or design consideration |

The two "correctness" rows are not optional. Without them, a Porto Santo day trip **falsely
ends the trip** and the ferry crossing gets credited as a road route — active bugs for Madeira
users, not merely missing Porto Santo features. Everything else can wait indefinitely.

**Alternatives considered:**

- *Madeira only.* Smaller tile pack, less curation work, simpler trip-end logic. Rejected
  because visitors who ferry or fly over — a genuinely common day trip — would get an
  unrecorded gap in the middle of their map, which is exactly the "the app didn't notice what
  I did" failure that D-009 exists to prevent.

**Reasoning:** The incremental cost is small and front-loaded: a slightly larger tile extract,
a handful of additional POIs, one more region, and one more airport geofence. Retrofitting a
second island later is disproportionately more work than including it now, because it would
force the region and trip-end models to be generalised after they had already been built
around a single landmass.

**Consequences:**
- Tile extract bounds must cover both islands (T-022).
- Trip-end detection needs Porto Santo airport as an additional trigger (T-099), and the
  "left the island bounding box" fallback must treat the two islands as one region — otherwise
  a day trip to Porto Santo would falsely end the trip. **This is a real edge case and is the
  main hidden cost of this decision.**
- The ferry crossing itself will produce a long, unmatched marine gap. Gap bridging (T-088)
  must not attempt to credit a road route across it.
- Porto Santo is the first real test of D-017: adding it must not require changes in `app/`.

---

## D-022 — Draw visited segments as our own overlay, not by recolouring basemap features.

**Status:** **Accepted** — recommended 2026-08-06, confirmed by the project lead 2026-08-08.
T-016a closed. This was the last Provisional entry from the planning phase.

**Decision:** The vector tile pack provides a **dumb dark basemap only**. Visited roads and
levadas are rendered as a *separate overlay layer* built from geometry we already hold in the
local `road_graph` table, rather than by mutating the styling of features inside the basemap
tiles.

**What prompted this:** the D-004 revision above. `setFeatureState` is not reliably available
on MapLibre Native mobile, so the originally planned recolouring mechanism cannot be depended
on.

**Alternatives considered:**

- *Feature state on basemap features* (the original D-004 plan). No longer viable — see the
  D-004 revision.
- *Runtime filter expressions listing visited OSM way IDs.* Technically works with plain
  data-driven expressions and no feature state. Rejected as the primary approach: the
  expression grows with every visited segment, and a filter containing thousands of IDs is a
  poor thing to re-evaluate on every frame.
- *Regenerating tiles on device.* Not feasible.

**Reasoning:** We already need the full road/path geometry locally for map matching (T-082) —
it is not an extra asset, it is one we are building anyway. Drawing from it directly is
straightforward, framework-independent, and removes a dependency on an unstable upstream API.

**Consequences — and one is genuinely good:**

- **T-024 stops being a decision gate.** Stable OSM way IDs no longer need to survive into the
  rendered tiles, because we are not addressing tile features at runtime. IDs are still wanted
  as the join key between matching output and local geometry, but that is entirely within our
  own data. **This removes the single biggest technical risk in Phase 0.**
- The fog-of-war fallback in D-004 is correspondingly less likely to be needed.
- **New risk introduced:** the overlay must align visually with the basemap's own road
  rendering, or roads will appear doubled or offset. Both derive from the same OSM extract so
  the geometry should match exactly; the fiddly part is matching line widths across zoom
  levels. Mitigation: consider suppressing road rendering in the basemap style entirely and
  drawing *all* roads — visited and unvisited — from our own overlay, which makes alignment
  a non-issue by construction.
- Rendering performance must be verified against the full island road network, not a sample
  (T-064 already covers this).

---

## D-023 — React Native.

**Status:** **Accepted** — 2026-08-06. Recommended on technical merit at the project lead's
request, then confirmed by them. **OD-1 closed. Phase 1 is unblocked.**

**Context that matters for everything downstream:** the project lead has **no JavaScript, web
or TypeScript experience** and chose React Native anyway, on the strength of the technical
argument. They will be learning the language alongside the project. Explanations, code style
and library choices should assume no prior JS idiom — see CONTEXT.md §6.7.

**Decision:** Build in React Native with `@maplibre/maplibre-react-native` v11.

**This is a close call, and it reverses an earlier lean toward Flutter** made before the
`setFeatureState` research (D-004 revision / D-022). That earlier lean rested substantially on
Flutter's in-framework rendering being an advantage for the souvenir video; `react-native-skia`
largely neutralises it.

**Reasoning, specific to this app rather than general framework preference:**

1. **The core screen is a native map view, permanently on screen.** React Native's new
   architecture (Fabric/JSI) embeds native views as first-class components. Flutter renders its
   own UI and embeds native views through the platform-view layer, which is an extra
   composition step for the one view this app is built around. This is the deciding factor.
2. **maplibre-react-native v11 aligns its Layer API with the MapLibre GL JS style spec.**
   Style-spec-compliant paint and layout props can be spread directly onto a Layer with no
   translation. Our workload is exactly this: hand-authoring a custom dark style plus overlay
   layers (D-022). It is a direct fit for the work we will actually be doing.
3. **`react-native-skia` covers the Phase 5 souvenir video**, removing what would otherwise
   have been Flutter's clearest advantage.
4. **Versioning signals.** maplibre-react-native is at an actively developed v11; the Flutter
   MapLibre plugin remains 0.x after years, which carries no API-stability guarantee.
5. **Background location is genuinely neutral** — Transistor Soft ships equivalent-quality
   plugins for both (D-006).

**Accepted risk:** v11 shipped April 2026 as a full API overhaul, new-architecture-only. We are
adopting a recent major rewrite, and should expect some churn and thinner community answers for
v11-specific problems. Judged acceptable because the API change moves *toward* the GL JS style
spec, which is the direction our own work needs.

**What would change this:** if the project lead has substantial Flutter/Dart experience and no
JavaScript background, familiarity outweighs every point above and Flutter should win instead.
This was asked and not answered; the recommendation assumes no strong existing preference.

### Revised 2026-08-06 after the free-stack decision (D-025)

Adopting the free location stack changes the comparison, and one earlier claim was wrong.

**Correction:** the assertion in D-025 that Flutter's free geofencing was "fragmented" was
overstated. Maintained free options exist on both sides — notably `native_geofence` (updated
April 2026, with reboot persistence and foreground-service support) and
`geofence_foreground_service` (March 2026). Flutter's free stack is two packages
(`geolocator` + a geofencing package) rather than one, and community-maintained rather than
first-party, but it is not neglected.

**Now genuinely equal:** free geofencing availability, the underlying native battery
behaviour, MapLibre core, store compliance, and the privacy architecture.

**React Native / Expo advantages, revised:**

1. **One first-party package.** `expo-location` covers background location *and* geofencing,
   maintained by Expo as a company. Flutter needs two community packages for the same job.
   Since geofences are the architectural backbone (D-005), the number of independent
   maintainers that backbone depends on is a real consideration.
2. **The map view is the entire app**, and React Native embeds native views as first-class
   components rather than through a platform-view composition layer. Unchanged and still the
   strongest structural point.
3. **maplibre-react-native v11 mirrors the MapLibre GL JS style spec**, so the whole MapLibre
   web documentation and example corpus transfers directly to our custom dark style and
   overlay work (D-022). For a solo developer this is a significant practical accelerator.
4. **Expo tooling (EAS Build)** removes most Xcode/Gradle handling. This matters
   disproportionately if the project lead is new to mobile development.
5. `react-native-skia` covers the Phase 5 souvenir video.

**Flutter advantages, revised:**

1. **Map matching.** Still the strongest counter-argument. Dart compiles to native code and
   runs in Isolates, so the matching engine is written once in the app's own language. In React
   Native, if matching proves too slow on the JS thread, it may need rewriting natively in both
   Swift and Kotlin. Measure early in Phase 4 (see the note above).
2. **`native_geofence` advertises reboot persistence**, which may address the Android
   termination gap identified in D-025 *better* than `expo-location` does. Worth verifying if
   Android recording reliability becomes a problem.
3. Single language, one toolchain, historically less upgrade churn.
4. More consistent rendering on low-end Android devices.

**Recommendation unchanged: React Native.** The map-view embedding, the style-spec
documentation transfer, and the single first-party location package together outweigh the
matching-engine concern, which is measurable and mitigable.

**Resolved:** the project lead confirmed they have **no** JavaScript or web background, and
chose React Native regardless. Under that condition the recommendation was still React Native —
Expo's tooling lowers the barrier to actually shipping more than Flutter's single-language
story helps — but it was genuinely close, and Flutter would not have been a mistake.

**One risk this raises:** the matching-engine-in-JS concern (Flutter advantage #1) is now
*sharper*, because diagnosing a performance problem is harder in an unfamiliar language.
Mitigation is unchanged but more important: **measure matching throughput early in Phase 4
rather than late.** The fallback is not necessarily a full native rewrite — chunking the work
across batches, or pushing only the hot inner loop native, are both cheaper options to try
first.

**Honest counter-argument, recorded 2026-08-06 so it is not lost:** map matching (Phase 4) is
the one genuinely CPU-heavy workload in the app. Flutter compiles Dart to native code and can
run it in an Isolate, so the matching engine would be written once in the app's own language.
In React Native, heavy computation on the JS thread is the framework's classic weak point — if
matching proves too slow in JS, it would have to be rewritten natively in both Swift and
Kotlin, which is double work and a real cost. Mitigating factors: matching runs in occasional
background bursts rather than interactively, and a day's batch is only a few hundred to a few
thousand fixes against an indexed SQLite graph, which is probably fine in JS. **This should be
measured early in Phase 4 rather than assumed.**

---

## D-024 — Porto Santo stays hidden until the user goes there.

**Status:** Accepted — proposed by the project lead 2026-08-06

**Decision:** The app presents itself as a Madeira app. Porto Santo does not appear in the map,
the region list, or anywhere in the UI until the device's location indicates the user is
actually there. On arrival it unlocks — map, roads, stamps — and stays unlocked permanently.

**Reasoning:** This is a better answer than the "include it but deprioritise it" framing in
D-021, and it resolves the tension that decision was carrying.

- **It protects the simplicity constraint.** A second island visible on day one is a second
  thing to understand, on a screen whose entire design goal is having as little as possible on
  it. Hidden, it costs the user nothing.
- **It protects the progress mechanic.** Porto Santo's places would otherwise sit permanently
  uncollected in the counter for the ~90% of users who never go, dragging the headline number
  down and implying they had failed to do something. Hidden, they are simply not in the
  denominator.
- **It turns a scope compromise into a product moment.** An unexpected unlock on arrival is
  exactly the kind of surprise the app is built around — the same instinct as the airport
  reveal (D-012).

**Implementation notes:**

- The tile pack still contains both islands from day one (D-021) — bundled, not rendered. It is
  a rendering and UI gate, not a data gate. No download, no network, no extra complexity.
- Unlock trigger: an island-level geofence around Porto Santo. Once set, the unlock flag is
  permanent.
- Map camera bounds are Madeira-only until unlocked, then widen.
- The stamp denominator must be computed over *unlocked* regions only, or the counter breaks in
  exactly the way this decision exists to prevent.
- **Independent of unlock state:** the trip-end and gap-bridging correctness fixes in D-021
  still apply always. A user who has never unlocked Porto Santo can still take the ferry, and
  must not have their trip falsely ended or the ocean credited as a road.
- Because Porto Santo is a bonus rather than baseline content, its POI list can stay minimal
  indefinitely without the app feeling incomplete.

---

## D-025 — Start on the free location stack. Treat the paid SDK as a contingency.

**Status:** Accepted — 2026-08-06, on a cost-effectiveness requirement from the project lead

**Decision:** Build Phase 1 on **`expo-location`** (free, MIT, part of the Expo SDK). Put the
recorder behind a `LocationProvider` interface. Purchase the Transistor Soft licence **only if
the Phase 1 acceptance tests fail** on the free stack.

**What prompted this:** the $399 licence was recorded as a starting assumption in D-006 without
first checking whether the free option could carry our specific architecture. It can — mostly.

**What `expo-location` actually provides (verified 2026-08-06):**

| Capability we need | Free stack |
|---|---|
| Geofence region monitoring (`startGeofencingAsync`) | ✅ |
| Batched/deferred delivery (`deferredUpdatesInterval` / `deferredUpdatesDistance`) | ✅ |
| Activity-type hinting (`activityType`, iOS) | ✅ |
| Auto-pause when stationary (`pausesUpdatesAutomatically`, iOS) | ✅ |
| Android foreground service with notification | ✅ |
| **iOS: system relaunches a terminated app for geofence events** | ✅ |
| Geofence caps — iOS 20, Android 100 | Same as native; our dynamic set manager (D-005) already handles this |

**The one real gap:** *"Android: a terminated app will not automatically restart when a location
or geofencing event occurs, due to platform limitations."* Transistor's native SDK invests
heavily in exactly this — restart machinery, boot receivers, and motion-detection intelligence
hardened against OEM process killers.

**Why the gap is survivable, and why this is not a lucky accident:** our architecture was
already built around geofences precisely because they survive termination (D-005), and around
stamps rather than road coverage precisely so the reward survives recording failure (D-002). On
iOS — where geofence relaunch works on the free stack — the backbone is intact. On Android, the
foreground service (already required by D-006's platform analysis) keeps the process alive so
that termination is the exception, and the day-1 health check (D-011) catches the cases where
it is not. **The design decisions that made this app battery-efficient and fault-tolerant are
the same ones that make the paid SDK optional.**

**Alternatives considered:**

- *Buy Transistor up front (D-006 as originally written).* Rejected as premature: $399 spent
  before any evidence that the free stack is insufficient, on a project with no revenue.
- *Write the native layer ourselves.* Rejected — this is the work Transistor encapsulates, and
  it is a poor use of time compared to either alternative.
- *`react-native-background-geolocation` (mauron85 fork).* Not seriously considered; long
  unmaintained.

**Why this is safely reversible:** the recorder writes to `raw_fix` behind an interface. Only
the provider implementation changes; matching, storage, progress and presentation are all
untouched. The switch is contained to one subsystem, and by then we would have real soak-test
data proving it is necessary.

**Decision rule — buy the licence if any of these fail on the free stack:**
- T-051 — 72-hour untouched-device soak produces a continuous trace
- T-052 — iOS force-quit does not permanently stop recording
- T-053 — recording survives on an aggressive Android OEM device
- T-054 — battery cost stays within ~5% per 12-hour day

**Consequence for OD-1:** see the revised comparison in D-023. An initial claim that Flutter's
free geofencing was "fragmented" was overstated and has been corrected there — maintained free
options exist on both sides.

---

## D-026 — Two map styles: light for use, dark for the souvenir. Terrain, not buildings.

**Status:** Provisional — chosen by the project lead 2026-08-08, but not yet validated against
real tiles or in real Madeira sunlight. Confirm after T-025.

**Decision:** The app ships **two MapLibre styles built from the same tile pack**:

- a **light** style for everyday in-app use, and
- a **dark** style used by the souvenir renderer (Phase 5), also offered as a user preference.

Both are produced by **starting from an existing permissively-licensed basemap style and
subtracting** — Protomaps' basemap themes, or CARTO Positron / Dark Matter over an
OpenMapTiles-schema build — rather than authored from a blank file. Confirm the licence terms
of whichever is chosen; both are permissive, but check.

Figure-ground comes from **shaded terrain**, not building footprints.

**What prompted this:** the project lead brought WalkNYC (a New York walking-coverage app built
on Apple Maps) as a visual reference. See `docs/design-brief.md` for the full reading.

**Alternatives considered:**

- *Dark only* — the original assumption behind D-015 and T-058. The fog-of-war metaphor is
  natively dark: unvisited is dim, visited lights up. It also makes a far more striking souvenir
  video, which is load-bearing (D-013). **Rejected as the sole style** because dark screens are
  genuinely hard to read in direct sunlight, and CONTEXT §6.5 requires outdoor legibility. The
  users are outdoors all day; this is not a hypothetical.
- *Light only* — best outdoors, but "roads light up" barely means anything against a light
  ground. Visited would have to render *darker* or heavier, which reads as underlining rather
  than revealing, and it weakens the souvenir badly.
- *Apple Maps / `MKMapView`* — the reference app's own choice. **Rejected on four hard stops:**
  no offline tile API is exposed to third-party apps (breaking two of the six hard constraints
  in CONTEXT §3, and T-063 outright); every pan and zoom leaks position to a tile server,
  reversing CONTEXT §4.7; the basemap cannot be dimmed, so there is no fog of war at all; and
  there is no Apple Maps SDK for Android, so the app would need two maps and look like two
  different products. This is the same reasoning that rejected the Google and Mapbox SDKs in
  D-004.
- *Authoring cartography from scratch.* Rejected as unnecessary work and the main reason the
  design phase had stalled.
- *Building massing* (WalkNYC's actual signature look). Rejected: OSM building coverage in
  Madeira is patchy outside Funchal, buildings add tile weight against T-026, and they compete
  visually with the only thing meant to light up. Madeira's defining feature is its relief, not
  its built form.

**The counter-argument, recorded because it is a real one.** Raised by the project lead
2026-08-08: *Apple Maps carries familiarity — most users have seen it before, and a familiar map
is easier to read.* This is true and should not be dismissed.

The resolution is a distinction between **conventions** and **styling**. Familiarity comes from
map conventions — water is blue, parks are green, roads are lighter than the ground they sit on,
labels look like map labels, north is up by default — and from **interaction**, which MapLibre
provides identically: pinch to zoom, drag to pan, two-finger rotate. Every one of those is kept.
What is discarded is Apple's *POI density and brand look*, which is precisely the part that would
compete with the trace. A custom style can be more familiar-feeling than Apple Maps for this
task, because it does less.

**Reasoning:** the two styles are two text files over one tile pack, and the souvenir renderer is
already a separate path (T-105), so this is far cheaper than it sounds. It resolves a genuine
conflict — D-015's accessibility priority pulls light, D-013's distribution strategy pulls dark —
without either losing.

**Consequences:**

- **D-015's encoding is style-dependent, not absolute.** "Visited is brighter" holds in the dark
  style. In the light style, visited must be differentiated by **weight and darkness**. The
  underlying rule survives unchanged and is the one that matters: *never differentiate by hue
  alone, and unvisited must stay legible.*
- T-058 and T-060 now cover two styles. A new task (T-139) covers the souvenir dark variant.
- A light/dark preference joins settings (T-140).
- Shaded terrain increases tile pack size — a direct input to T-026.
- **A quality bar, testable rather than aspirational:** the map reads at a glance in Funchal
  midday sun; the trace is unambiguously the brightest thing on screen; label load stays low
  enough that the island's shape carries the composition. Test outdoors, not at a desk.

---

## D-027 — The passport is organised by category, not by region.

**Status:** Provisional — chosen by the project lead 2026-08-08.

**Decision:** The passport screen's primary axis is **place category**, with five named rows:

> **Viewpoints · Levadas · Villages · Beaches · Landmarks**

There is deliberately **no "Other" row.** Every curated place must belong to one of the five.

Region does not disappear — it moves to the **map screen**, where it does the "where should I go
next" job. Each POI therefore carries both a `category` and a `region_id`, and both live in the
content pack, never in `app/` (D-017).

**Alternatives considered:**

- *Region as the primary axis* (the original plan in T-073/T-074). Regions are better at
  **discovery** — an empty region is a recommendation, which is half of what D-002 is for. But
  they are worse at **collecting**, and the passport's entire job is collecting.
- *An "Other" / miscellaneous row.* Rejected. A catch-all bin absorbs every awkward classification
  decision, grows without limit, and means nothing by the end. Forcing five named rows is a
  curation discipline, not a UI constraint — if a place fits nowhere, that is a signal about the
  place.
- *Both axes on one screen.* Rejected on the complexity budget already flagged in D-003: region %
  *and* stamps *and* highlighted roads is three scoring systems, and one must be the hero.

**Reasoning:** splitting the two jobs puts each where it works. The passport collects; the map
suggests. Neither is asked to do the other's work.

**Supporting evidence:** the reference app ships a settings section that lets the user switch off
whole boroughs so they stop counting toward progress — a manual fix for a denominator that is too
large and too demoralising. Its headline figure, photographed 2026-08-08, reads **`0.00%`** — a
progress number needing two decimal places to avoid displaying as zero. That is exactly the
failure D-002 predicted and D-024 avoids automatically.

**Consequences:**

- **Levadas are not points, and the levada row is different in kind.** Every other category means
  *"you arrived somewhere."* A levada stamp means *"you walked the whole thing"* — trailhead
  geofence plus exit geofence (D-009). It is the hardest row to earn and the most valuable, and
  should look different. Importantly it is still **geofence-driven**, so CONTEXT §2.1 holds: the
  reward does not depend on map matching.
- T-066 curation must assign exactly one of the five categories to every place.
- T-073 (region progress) survives but is consumed by the map screen, not the passport.
- The category set is content, not code — a second island ships new categories without touching
  `app/` (D-017).

---

## D-028 — Gate sampling on stationary-vs-moving. The pedometer classifies; it never gates.

**Status:** Provisional — chosen 2026-08-08. Revisit once T-020 field data exists.

**Decision:** Activity gating (T-034) is split into two separate problems, and only the first is
solved now.

1. **Stationary vs moving — implement now.** Derived from distance over time (starting point:
   moved less than ~100 m in ~10 minutes → stationary profile). No new sensor, no new dependency,
   no new permission, and **identical behaviour on both platforms.**
2. **Walking vs driving — deferred.** A single "moving" profile until Phase 0 data shows the
   distinction pays for itself.

Where speed is ambiguous, the **pedometer may be consulted as a classifier** on iOS, where it is
free. It must **never** be used to gate recording on or off.

**What prompted this:** the project lead correctly objected that speed alone is a poor signal *in
Madeira specifically* — steep gradients and single-lane roads compress driving speeds into
walking range, and Funchal traffic does the same. They asked whether the pedometer could resolve
it, noting the reference app does exactly that.

**It does — and its own settings screen says so.** Photographed 2026-08-08:

> *"Aggressive should catch all your walks. Uses about 20% of your battery per day. WalkNYC only
> records your location when the pedometer detects you're walking."*

Two things follow from that sentence, and they point in opposite directions from the obvious
conclusion:

- **Pedometer gating did not buy them a low battery number.** 20% per day at the setting that
  catches everything, against ~3% at the setting that does not. They could not resolve the
  trade-off and shipped it to the user as a three-way switch (Battery Saver / Default /
  Aggressive). We cannot do that — CONTEXT §3 forbids that kind of option, and an 80-year-old
  should not be adjudicating a battery/completeness trade.
- **They are a walking-only app.** Driving is irrelevant to them, so *"record only when walking"*
  costs them nothing. **Madeira tourism is rental-car dominated** (CONTEXT §5). Gating recording
  on steps would make us blind to the tunnel drives, the VR1 and the ER101 — precisely the roads
  the tunnel-inference design in ARCHITECTURE §8.1 exists to serve, and precisely the failure
  D-009 calls an uninstall.

**Alternatives considered:**

- *Speed alone.* The original proposal. Correctly rejected by the project lead for the reasons
  above.
- *Pedometer as the recording gate* (the reference app's approach). Rejected: loses all driving
  data, and is iOS-only for us anyway.
- *A dedicated activity-recognition dependency.* Rejected **for now**: it costs a new dependency
  against the zero-networked-dependency target (§6.4) and, on Android, an additional
  `ACTIVITY_RECOGNITION` runtime permission. Spending a permission prompt on an unmeasured guess
  is a bad trade when the app's hardest problem is already permissions (D-008). Reconsider if
  T-020 shows the walking/driving split is worth real battery.

**Reasoning:** nearly all of the available saving lives in stationary-vs-moving, not in
walking-vs-driving. A tourist sleeps eight hours and sits in restaurants, cafés and their
accommodation for several more — over half the day at near-zero cost, detectable with no new
sensor and no platform asymmetry. The walking/driving distinction is both harder to detect and
worth much less.

**The Android asymmetry this avoids.** `Pedometer.getStepCountAsync` is iOS-only, `expo-sensors`
has no historical step query on Android, and its live watcher does not deliver in the background.
A pedometer-led design would give iOS users good battery behaviour and Android users none —
exactly the outcome the sampling-bias warning in HANDOFF and T-021a exists to prevent.

**Consequences:**

- T-034 is reworded to stationary-vs-moving and is no longer blocked on an undecided trigger.
- The ~100 m / ~10 min threshold is a **guess**, like the 30-minute gap threshold in T-048. Both
  are tuned by T-038 against T-020 data.
- The pedometer's importance to **T-090 (levada sensor fallback)** is unchanged and unaffected.
  That remains iOS-only and remains documented as such.
- **Benchmark worth keeping:** a competing iOS app spends 20%/day to reliably catch walking in a
  dense city. Our ≤5% per 12-hour day (T-054) depends on batching, geofences and stationary
  gating together — not on activity detection alone. If T-054 fails, this is where to look first.

### Implemented 2026-08-10 (T-034) — three sub-choices this entry did not settle

Recorded here rather than as a new decision, because each is a refinement of this one and this
is where somebody would come looking. All three are reversible in one file
(`movementPolicy.ts`) and none has been tested on hardware.

1. **The rule is asymmetric.** One fix beyond 100 m flips to moving; going stationary needs a
   full ten minutes of evidence. Being slow to notice a stop costs a few minutes of unnecessary
   sampling. Being slow to notice a start costs the beginning of a walk, which is trace nothing
   can recover (CONTEXT §2.4). The costs are not symmetric, so the rule is not either.
2. **`walking` is the single "moving" profile**, not `driving`. This entry deferred
   walking-vs-driving but did not say which survives. `walking` is the cheaper of the two, and
   the argument for `driving`'s tighter sampling — catching a clean fix at each tunnel portal —
   left v1 with the rest of Phase 4 (D-032). `driving` stays in `samplingPolicy.ts` for manual
   use and for T-034a.
3. **Fixes less accurate than 100 m are ignored** when measuring displacement. A fix with a
   ±150 m accuracy radius cannot answer a 100 m question, and under Laurissilva canopy it will
   report jumps the user did not make. Flipping to the expensive profile on noise is a battery
   leak that would be almost impossible to find later. Fixes reporting *no* accuracy are
   trusted, because refusing them would mean ignoring every fix on a platform that omits the
   field.

**And one hazard this creates.** The stationary profile sets `pausesUpdatesAutomatically`, so
the gate can put the recorder to sleep and **cannot wake it**: if iOS stops delivering, no fix
arrives, so the gate never runs again. Recovery depends on region monitoring and
significant-location-change (T-047) and the day-1 health check (T-049), none of which has been
tested. This is the specific thing T-051 must watch.

---

## D-029 — OSM alone is sufficient for levadas. Select by name and relation, never by tag.

**Status:** Provisional — measured 2026-08-08 (T-028). **Resolves OD-7.** Provisional because
counts prove the data *exists*, not that it is *accurate*; confirm by comparing one known levada
against OSM in the field.

**Decision:** Build levada content on **OpenStreetMap alone**. No external or official dataset is
licensed, purchased or reconciled in.

Levada geometry is selected by **name (`Levada*`) plus hiking-relation membership**, *never* by a
single tag. For matching, use the `highway=*` ways — the user walks the path, not the channel.
Fall back to `waterway=*` geometry where a levada has a channel mapped but no path.

**What the survey found** (full writeup in `docs/osm-coverage.md`):

| Count | Feature |
|---:|---|
| 3,981 | ways named `Levada*` |
| 1,386 | …tagged `highway=*` — the walkable path (922 of them `highway=path`) |
| 2,552 | …tagged `waterway=*` — the channel (2,357 of them `waterway=drain`) |
| 108 | `highway=*` **and** `tunnel=*` — levada tunnels |
| 44 | `route=hiking` relations carrying an official `ref=PR*` |

**Alternatives considered:**

- *License official PR-route data from the regional authority and reconcile it with OSM.* This
  was the concern that kept OD-7 open and undecidable since planning. **Moot** — the official PR
  route structure is already in OSM as 44 ref-carrying relations. No negotiation, no second
  source, no reconciliation pipeline, no licence beyond ODbL which the project already accepts.
- *Select levadas by `highway=path`.* This is what CONTEXT §5 assumed. **Rejected because it is
  wrong** — it captures 922 of 3,981 named ways, 23%.
- *Select by `waterway=canal`*, the semantically correct tag for an irrigation channel.
  **Rejected — it captures 3%.** Madeira's levadas are overwhelmingly mapped `waterway=drain`,
  which is semantically odd but consistent, and consistency is what a selector needs.

**Reasoning:** OSM maps a levada as **two parallel ways sharing one name** — the channel and the
footpath beside it — with different tags on each. Any tag-based selector therefore gets a
fraction of the network, and *which* fraction depends on an arbitrary mapping convention we do
not control. The name is the stable join; the relations carry the official structure.

**Consequences:**

- **T-028 is done and OD-7 is closed.** Both had been blocking Phase 3 content and Phase 4
  matching.
- **T-068 (levada corridors) changes shape** — name-and-relation selection, with a documented
  fallback, rather than a tag filter.
- **T-069 (tunnel portals) must cover walkable tunnels**, not just road tunnels. 108 of the 604
  tunnel ways are levada tunnels, and those are precisely the zero-GPS case T-089 and T-090 exist
  for.
- **CONTEXT §5's claim about `highway=path` is corrected** in the same pass.
- **The risk moved.** It is no longer "is there enough data" but "**is the data accurate enough**"
  — corridor connectivity, portal-node precision, and whether the 44 PR relations are current.
  None of that is answerable from counts. It is answerable in an afternoon by someone living on
  the island (CONTEXT §5a), and that is the honest next step.
- Zero cost. Dependency spend remains **$0**.

---

## D-030 — Protomaps basemap schema, extracted from their hosted planet build.

**Status:** Provisional — decided 2026-08-08 after a second, deeper research pass requested by
the project lead. Provisional until the map has been *looked at* with terrain and a real style.

**Decision:** The tile pack uses the **Protomaps basemap schema**, obtained by `pmtiles extract`
against a **pinned, dated** Protomaps planet build (currently `20260803`). Pipeline in
`tiles/pipeline/build.sh`.

**Measured:** 12 MB for Madeira + Porto Santo, zoom 0–15, in **8.5 seconds**, with no local
toolchain.

**How this decision was reached, recorded because the process was the useful part:** the first
pass adopted planetiler's *default* profile (OpenMapTiles) without examining it. That was chosen
by what would run on the dev machine, which is the wrong basis for a load-bearing choice. The
project lead stopped it and asked for research twice. Both passes changed the answer. **The
lesson is worth more than the decision: a default is not a decision.**

**Alternatives considered:**

- *OpenMapTiles via planetiler* — what was built first, and it works: 8.9 MB, 3m37s. **Rejected
  on two grounds.** Its schema is **CC-BY**, requiring a visible "© OpenMapTiles" credit that
  would have to appear in the souvenir video (D-013) beside our own name. And it **strips names
  from the `transportation` layer** by design, so a levada path is indistinguishable from any
  footpath (T-026a). It is also incompatible with the styles D-026 already chose — an
  inconsistency introduced and then caught.
- *Shortbread* — lean, community schema, ODbL-only attribution. Rejected: it splits names into
  separate label layers, the same pattern that hurt us in OpenMapTiles, and no ready-made style
  ecosystem comparable to Protomaps'.
- *A custom planetiler YAML schema* — technically the strongest "own everything" answer, needs
  no Java, only ODbL attribution, and could make levadas a first-class layer. **Rejected for
  now** because no existing style targets a bespoke schema, so it would mean authoring
  cartography from a blank file — precisely the trap D-026 exists to avoid and precisely what
  stalled the design phase. Retained as fallback route 2 in `build.sh`.

**Reasoning:**

1. **Attribution.** CC0 schema. Only "© OpenStreetMap" remains, which is required under ODbL
   under *every* option including a fully custom build. The watermark problem disappears.
2. **Levadas stay identifiable.** `roads` carries `name` at z13+, verified by decoding a real
   tile — `Levada da Serra do Faial/Levada da Faja da Nogueira`, `kind=path`.
3. **Measurably better suited to Madeira.** 48 `cliff` features in one z13 tile, plus
   `bare_rock`, `scrub`, and peaks carrying `elevation`. For an island defined by relief this is
   material, and it was not predictable from documentation.
4. **`is_tunnel` is a first-class boolean**, useful to T-069/T-087.
5. **It is the schema D-026's chosen styles target natively.**

**The dependency risk, assessed rather than waved away:** Protomaps is essentially one maintainer
(@bdon), a single-member LLC with no outside investors, funded by GitHub Sponsors and an
NLnet/EU NGI grant. For most projects that is a real supplier risk. **Here it is nearly
irrelevant, and the reason is our own architecture** — it is a *build-time* dependency, never a
runtime one. We ship a file and the app makes no requests (D-001). If the hosted builds stop
tomorrow, the shipped pack keeps working, and `build.sh` documents three self-build fallbacks
using a toolchain already proven on this machine.

**Why this is safely reversible — and this matters more than the choice itself.** Trace what
depends on the tile schema: matching uses `road_graph` imported from OSM (T-082); visited-road
rendering uses `road_graph` (D-022); stamps, geofences and regions use the content pack, built
from OSM directly; the recorder does not touch tiles at all. **The tile pack is the background
only.** Changing schema later means rewriting one style file, not a rewrite. What *is* sticky is
shipping: once tiles are bundled (T-057) a change forces a re-download, and once a souvenir video
is published its attribution is public. So this needed to be right before **shipping**, not
before **building**.

**Consequences:**

- `tiles/pipeline/build.sh` is now an extract, not a build. The planetiler toolchain stays as a
  documented fallback and is no longer required for a normal build.
- `tiles/style/light.json` rewritten against Protomaps layer names.
- The planet build date is **pinned** in `build.sh`; an unpinned "latest" would make builds
  irreproducible. Bump deliberately and record it.
- **Terrain remains the real open question.** Neither schema carries elevation, so D-026's shaded
  relief is a separate pipeline regardless, and it is the single largest determinant of whether
  this map looks good. 12 MB is the floor, not the answer.

---

## D-031 — No backend. Re-examined against the competition, and reaffirmed.

**Status:** Accepted — D-001 reaffirmed 2026-08-08 after the project lead asked directly whether
we could have a backend, having noticed that every competitor does.

**The question:** the trail apps all run servers. Why not us?

**Decision:** unchanged — no backend, no account, no analytics (D-001). But the reasoning is
sharper now that the competition has been measured, so it is recorded rather than left implicit.

**What a backend would actually buy:** exactly one thing of substance — **server-side map
matching**, the Wandrer/CityStrides model. That is a real argument, because matching in
JavaScript on-device is the sharpest technical risk in the project (D-023). Everything else on
the list (sync, remote diagnostics, analytics) is convenience.

**What it would cost:**

- An ongoing hosting bill on a project with **no revenue** (D-014).
- A **GDPR controller relationship over location data** — the most sensitive category there is —
  where today we have essentially no obligations because nothing is transmitted.
- A breach surface, and accounts, which break the "80-year-old, no instructions" constraint.
- Network dependency in exactly the places Madeira has no coverage (CONTEXT §5).

**And critically, it would not help the map at all.** The whole archipelago is a 12 MB file
(D-030). There is nothing a tile server could give us that we do not already have offline.

**What the competition actually shows** (`docs/competitors.md`): the market leader for Madeira
levadas, WalkMe, declares collection of **location, contact info, user content, identifiers,
usage data and diagnostics**. AllTrails serves its maps from Mapbox, so every pan and zoom is a
billed request carrying a user's position. **They have backends because they are online products
with revenue** — social discovery, subscriptions, curation. Ours is a passive recorder that hands
over a souvenir.

**So the honest framing:** "nothing leaves your phone" is not purism, it is the one position the
incumbents structurally cannot copy without rebuilding. Giving it up to solve a matching
performance problem we have not yet measured would be trading the differentiator for a
convenience.

**Revisit only if** T-094/T-098 show on-device matching is genuinely infeasible — and even then,
the cheaper options in D-023 (chunking, or pushing the hot loop native) come first. Raw traces
are retained (D-010) precisely so matching can be improved later without re-collecting anything.

---

## D-032 — v1 ships without map matching. Draw the raw trace. Spend the effort on the UI.

**Status:** Accepted — decided by the project lead 2026-08-08. **This is a scope decision and it
supersedes the sequencing, not the architecture.**

**Decision:** **Phase 4 (map matching) is deferred out of v1 entirely.** v1 draws the **raw GPS
trace** on the map instead of matching it to road segments. The saved effort goes into the
**interface and the map's appearance**, which is where this app can beat the incumbent.

**v1 is:** record location → award stamps by geofence → **draw the trace** → passport screen →
souvenir at trip end. That is the project lead's original one-sentence brief, and most of what
has accreted since is optional.

**What prompted this:** the project lead observed that the engineering ambition had grown far
beyond the original goal — *"an app which records which roads you've walked, and if you walked a
levada or been at a touristic place you earn a badge"* — and stated the priority plainly: **a
good interface matters more than GPS accuracy.** WalkMe is weaker on interface than on content,
and that is the opening.

**This is a return, not a pivot.** D-002 already says *stamps are the score; highlighted roads
are decoration.* CONTEXT §2.1 already says *the user's reward deliberately does not depend on
matching.* D-002's own rejected-alternatives list already names fog-of-war trace rendering as
"a possible v1 simplification." The architecture was designed so accuracy would not matter; the
plan then drifted into making it matter.

**Where the complexity actually was:**

| Subsystem | Cost | Needed for the original brief? |
|---|---|---|
| Ghost operation (passive background recording) | Large | No — it is what makes it *magical*, not what makes it *work* |
| **Street-level map matching (Phase 4)** | **Largest** | **No — the docs call it decoration** |
| **Geofence stamps** | **Small** | **Yes — and it is the entire reward** |

**Stamps need almost no accuracy.** A generous radius at a curated place plus a dwell-and-speed
gate (D-009) works with poor GPS, under canopy, on cheap Android hardware. It is the cheapest
subsystem in the project and it delivers the payoff. Matching is the most expensive and delivers
decoration.

**Alternatives considered:**

- *Build Phase 4 for v1 as planned.* Rejected: it is the single largest body of work in the
  project — road graph import, R-tree, snapping, hysteresis, tunnel inference, gap bridging,
  corridor crediting, sensor fallback, regression harness — in service of something already
  classified as decoration.
- *Ship matching but crude.* Rejected as the worst of both: still needs the graph, the index and
  the snapping, and a visibly wrong highlighted road is worse than an honest trace.
- *Also cut ghost operation and ship a manual start/stop like WalkMe.* **Not adopted, but not
  dead.** It would remove the Always permission, the Play background-location review (T-123) and
  the OEM battery war from the critical path. It is rejected for now because passive recording is
  the differentiator against WalkMe's manual button — but D-008 already requires While-Using to be
  fully functional, so **v1 can ship While-Using-first and add Always later** if the Play review
  drags. Keep that escape hatch visible.

**Why the raw trace is not a downgrade:** for a *souvenir*, the actual wandering path is more
personal and more truthful than a set of highlighted street segments. Fog of World has shipped
exactly this for a decade. It is also honest in a way matching is not — it shows where the phone
actually was, with no inference.

**Consequences:**

- **Phase 4 (T-082–T-098) moves to v2.** With it go the road graph, the R-tree, tunnel portal
  inference, gap bridging, levada corridor crediting and the sensor fallback.
- **T-059 changes meaning:** draw the recorded trace, not matched segments.
- **D-022's alignment risk disappears for v1.** There is no overlay of road geometry to align
  with the basemap, because we draw the trace instead. D-022 still governs v2.
- **T-028a's precision worry is largely moot for v1** — reinforced by the project lead's point
  that levadas do not require navigation-grade accuracy to walk (CONTEXT §5).
- **D-010 still holds and is now more important.** Raw traces are retained immutably, so matching
  can be added in v2 and **run retroactively over every trip already recorded**. Deferring costs
  nothing permanent. This is exactly the property D-010 was written to buy.
- Phase 0 Track A (T-017–T-021) drops off the v1 critical path — its output tunes matching
  thresholds. Still worth doing, no longer blocking.

**What must NOT be cut, because these are what actually drive uninstalls** — and none is about
accuracy:

1. **Battery.** The number one uninstall trigger for any tracking app. Nothing else matters if
   the phone dies at 16:00.
2. **Silent failure.** Recording dies on day 2, discovered on day 7. Keep the day-1 health check
   (D-011) — it is cheap and exists precisely for this.
3. **Missing something obvious.** They walked a famous levada and got nothing. Note this is a
   *geofence* problem, not a matching problem: generous radii at trailheads solve it.

Nobody uninstalls because a drawn line was twenty metres off.

**Where the perfectionism should go instead:** the map's appearance (D-026 — style and terrain)
and the interface (`docs/design-brief.md` — one screen, three controls, one number). Against a
fourteen-year incumbent with five tabs and dense chrome, **"does less, beautifully" is the one
position where being new is an advantage.**

---

## D-033 — The dynamic geofence window: nearest-by-edge-distance, plus an exit-only anchor.

**Status:** Provisional — implemented 2026-08-10 (T-039), agreed in principle by nobody yet.
The mechanism is sound on paper and unit-tested; **none of the three numbers in it has been
measured against a real device**, which is what T-076 is for.

**Context:** iOS monitors at most 20 regions at once, Android about 100, and the content pack
will hold 150–250 places (T-066). D-005 and ARCHITECTURE §6.1 already said the set must be
swapped dynamically — "roughly the nearest 18, plus one large 'you have left this area'
region." This decision records *how*, because two of the choices below are not the obvious
ones and would otherwise be quietly undone by a future contributor.

**Decision:**

1. **Rank by edge distance, not centre distance.** A place's own radius is subtracted before
   ranking, so a 500 m trailhead outranks a 100 m viewpoint that is nearer by centre. The
   question being answered is "which could the user enter first", not "which is nearest".
2. **Spend one region slot on an anchor** centred on the user, exit-only, registered under the
   reserved id `__anchor__`. Its exit is what rebuilds the window. It is never written to
   `geofence_event` — it is not a place.
3. **Size the anchor from a stated safety property**, not from a fixed radius:

   > While the user is inside the anchor, they cannot have reached any place we are not
   > monitoring.

   which holds when `anchorRadius ≤ (edge distance to the nearest unmonitored place) − margin`.
   When the whole catalogue fits inside the cap, there is no anchor at all.
4. **Back the anchor up with recorded fixes.** Location batches are arriving anyway; if one
   shows the user 75% of the way to the anchor's boundary, rebuild without waiting for the
   exit event.

**Alternatives considered:**

- *A fixed-radius anchor (say 5 km).* Rejected: it is either too small in the empty interior,
  where it fires constantly for nothing, or too large in Funchal, where places are dense and
  it would let the user walk past several unmonitored ones. Deriving the radius from the
  catalogue costs one line of arithmetic and is correct in both.
- *Periodically re-selecting on a timer.* Rejected outright — CONTEXT §6.3 forbids adding a
  periodic timer without a battery justification, and there is none here. The anchor is the
  event-driven form of the same thing, handled by the location coprocessor at no cost to us.
- *Ranking by centre distance.* Rejected: it systematically disadvantages exactly the places
  we deliberately give generous radii to, which are the trailheads, which are the ones whose
  omission D-032 names as an uninstall trigger.
- *Re-selecting only on the anchor exit, with no backstop.* Rejected: a single missed geofence
  event would freeze the monitored set for the rest of the trip, silently and invisibly. The
  backstop costs one distance calculation per batch of fixes we were already being handed.
- *Requesting a fresh GPS fix when rebuilding.* Rejected on battery grounds. The manager uses
  the OS's cached position, falls back to our own last recorded fix, and defers if it has
  neither.

**The three unmeasured numbers**, all in `geofenceSelection.ts` and all guesses:

| Constant | Value | What would set it properly |
|---|---|---|
| `ANCHOR_MARGIN_M` | 500 m | How late the OS actually delivers an exit event, at 80 km/h — T-076 |
| `MIN_ANCHOR_RADIUS_M` | 300 m | The radius below which regions become unreliable in practice |
| `REBUILD_AT_FRACTION_OF_RADIUS` | 0.75 | How often the backstop fires in normal use versus how much it repairs |

**Known limitation, recorded rather than hidden:** in a cluster denser than the region cap —
central Funchal, plausibly — the anchor is clamped to its minimum and the safety property no
longer holds. There is then an unmonitored place within 300 m. It is unreachable without
passing closer to something that *is* monitored, so the practical cost is believed small, but
the manager logs the condition to the recording diary rather than pretending otherwise
(ARCHITECTURE §10). If T-066 produces a cluster like this, the fix is a larger region cap on
Android and accepting it on iOS, not a cleverer selection rule.

**Consequences:**

- **Content-pack ids must never begin with `__`** — that prefix is reserved for regions that
  are mechanism rather than content. T-040 should validate it.
- `recording_event` gains a `geofence` kind, so a reshuffle can be told apart from a batch of
  fixes when reading the diary in the field.
- The manager is content-agnostic and driven through a `PoiCatalogueSource` seam. T-040 is
  now a one-line change in `index.ts` plus the pack itself.

---

## D-034 — The content pack: one JSON file, compiled in, validated twice.

**Status:** Provisional — implemented 2026-08-10 (T-040). The format is settled enough to
curate against; it has never been exercised by a real list, and T-066 is what will find its
gaps.

**Context:** D-017 says all Madeira content is data, not code, and CONTEXT §6.1 calls that rule
absolute. T-039 left a `PoiCatalogueSource` seam and nothing to plug into it. T-066 — 150–250
hand-verified places — is on the critical path, can only be done by the project lead, and
cannot start until the file it produces has a defined shape.

**Decision:**

1. **`content/pois.json`, a single file at the repository root**, outside `app/`. Reached by
   `app/metro.config.js` adding `content/` to Metro's `watchFolders`, and imported by exactly
   one module, `app/src/content/poiCatalogue.ts`.
2. **A place owns one or more geofences.** Almost every place has one. A levada has two, roles
   `start` and `end`, because a levada stamp means "you walked the whole thing" and needs both
   crossings (D-009). Geofence ids are globally unique and are what land in
   `geofence_event.poi_id`.
3. **Validated twice, with one set of rules.** `contentPack.ts` validates at runtime;
   `tools/validate-content.mjs` imports that same parser and adds the checks only a curator can
   act on — island bounds, levadas missing an end, places suspiciously close together, progress
   against the 150–250 target. Node strips the types, so the tool needs no build step and the
   two can never drift apart.
4. **A broken file throws; a broken row does not.** Structural failure stops the app, because
   the caller must not mistake "the file is wrong" for "there are no places". An individual bad
   row is dropped, counted, and written to the recording diary. A curation mistake costs one
   stamp, never a recorder that will not start (D-010).
5. **Radius bounds 40–2000 m.** Below the floor, both platforms treat regions as approximate
   and the stamp never fires. Above the ceiling, a stamp fires on somebody driving past, and a
   collection where that happens is worthless (CONTEXT §4.4).

**Alternatives considered:**

- *Put `pois.json` inside `app/`.* Rejected: it is the exact thing D-017 forbids, and the
  bundler configuration needed to avoid it is twelve lines.
- *Ship the pack as a runtime asset read from the filesystem.* Rejected for v1 — it buys the
  ability to update content without an app update, which is worth nothing to an app with no
  backend and no network (D-001). The seam is async anyway, so this stays available later.
- *One geofence per place, with levadas as two separate places.* Rejected: the passport would
  show "Levada do X (start)" and "Levada do X (end)" as two stamps, and the "you walked the
  whole thing" rule would have to be reconstructed from a naming convention.
- *A schema validator dependency (zod, ajv).* Rejected: a hand-written parser is ~200 lines,
  adds nothing to the bundle, and every new dependency needs a network-behaviour audit
  (CONTEXT §6.4) for a problem this small.
- *Validate only in the tool, and trust the file at runtime.* Rejected: the tool is a thing a
  human remembers to run. The runtime check is the one that is always there, and it is what
  makes a mistake cost one stamp instead of an app that will not launch.

**Consequences:**

- **Place ids are permanent once released.** They are the key stamps are awarded against.
- **Content changes require an app update.** Accepted for v1; see the rejected alternative.
- A development-only fallback (`withDevFixtureFallback`) substitutes synthetic places while the
  pack is empty, guarded on `__DEV__`, so the geofence backbone stays field-testable during the
  weeks T-066 takes. **T-117 must confirm it is inert in the release build.**
- `app/src/content/` is a new directory, not in README's original layout. It holds the reader,
  never the content.

---

## D-035 — Terrain ships as raw elevation, shaded at render time. AWS Terrain Tiles, z12 ceiling.

**Status:** Provisional — implemented 2026-08-10 (T-058a). Confirmed or killed by two events:
hillshade rendering correctly in `maplibre-react-native` on a real device (T-056), and the
outdoor look test (T-065).

**Decision:** the terrain D-026 asks for is shipped as a **second PMTiles pack of raw
elevation** (`madeira-terrain.pmtiles`, terrarium-encoded PNGs, z0–12, 6.5 MB), built by
`tiles/pipeline/build-terrain.py` from the AWS Open Data *Terrain Tiles* set (underlying DEM
for Madeira: NASA SRTM, public domain). Shading is computed **at render time** by MapLibre's
`hillshade` layer, styled per-style in `tiles/style/generate.mjs`.

**Why render-time shading rather than a baked hillshade image:**

- **One pack serves both styles.** D-026 requires a light and a dark map from one tile pack.
  Baked shading is one style's shadows frozen into pixels; raw elevation lets the light style
  shade warm-on-paper and the dark style shade moonlit, from the same 6.5 MB.
- **Restyling stays a style-file edit.** Exaggeration, light direction and shadow colour are
  paint properties, tunable in the viewer in seconds. A baked raster puts every such change
  through a rebuild.
- **It keeps a door open** — the same raster-dem source can drive 3D terrain or slope shading
  in the souvenir renderer later without new data.

**Why z12 and not deeper:** the DEM under it is ~30 m/pixel, which z12 already slightly
outresolves. z13 would quadruple the tile count to interpolate the same information. MapLibre
overzooms the DEM past z12, so shading never disappears — ridges just stop gaining detail.
Measured cost of going deeper anyway: z13 ≈ +4× tiles for no new information.

**Alternatives rejected:**

- *Prebaked hillshade raster tiles.* Rejected for the reasons above; also slightly larger at
  comparable quality, because shading compresses worse than smooth elevation gradients.
- *Vector contour lines.* A different aesthetic (topo map), higher visual noise — competes
  with the trace, which is the one thing D-032 says the map must not do.
- *EU-DEM / Copernicus as the source.* Comparable data for Madeira but carries an attribution
  obligation; SRTM is public domain and the AWS tile set asks only a courtesy credit, which
  ships in the style's source attribution.
- *No terrain.* Was the status quo, and the viewer made the case against it plainly: Rabaçal —
  400 m ravines — rendered as flat pale green. D-026 called terrain the figure-ground element;
  the flat map confirmed it.

**Costs, recorded against T-026:** basemap 12.6 MB + terrain 6.5 MB = **19.1 MB total pack**.
Still comfortably a hotel-WiFi download; T-057's bundle-vs-download question stays open with
this number.

**One platform lesson, written down because it cost twenty minutes:** a `raster-dem` source
covering a partial-world archive **must declare `bounds`**. Without it the renderer requests
DEM tiles beyond the archive edge, receives empty responses, and fails neighbour
reconciliation with a `dem dimension mismatch` error. With bounds declared the requests are
never made. The vector source gets bounds too — there it is merely efficiency.

---

## D-036 — The map ships inside the app binary, not as a first-run download.

**Status:** Provisional — implemented 2026-08-10 with T-056. Revisit only if the shipped pack
grows past ~40 MB or store policies push back on binary size.

**Decision:** the tile packs, glyphs and style templates are bundled as app assets and copied
to device storage on first launch (`app/src/map/mapAssets.ts`, version-keyed so app updates
can replace them). T-057's alternative — a WiFi-gated first-run download — is not built.

**Reasoning:** the download path only earns its complexity when the payload is too big to
ship. At 19.1 MB (D-030 + D-035) it is not: the marginal install size is modest against the
app itself, and bundling deletes an entire failure class — first-run on hotel WiFi that
drops, a user opening the app for the first time already up a levada with no signal, a
half-downloaded pack. The app works completely from the moment it is installed, which is what
"install it when you land and forget it" requires. D-030 anticipated exactly this when the
pack came in small.

**Rejected:** *WiFi-gated first-run download* — the one permitted network call (D-001) stays
permitted but unused; keeping the door open costs nothing. *Play Asset Delivery / iOS ODR* —
store-specific machinery solving a size problem we do not have.

**Consequences:** app updates are the only content-update channel (already true of the POI
pack, D-034).

**Amended the same day — the copies live in the CACHE directory.** The first implementation put
them in the document directory, which would have required two platform-specific backup
exclusions (an iCloud attribute on iOS, an XML rule on Android) kept in step with the code
forever. Both platforms exclude the cache directory from backup by construction, so the 19 MB
cannot compete with the user's trip history for backup space (ARCHITECTURE §4a) without anyone
having to remember a rule.

The trade — either OS may purge the files, and a user may clear them from settings — costs
nothing here and is self-healing: the source is the app binary, so the next launch copies them
again, with no network, in airplane mode, up a levada. Regenerable data in the regenerable
place. This closes what was briefly flagged as the open iOS half of T-032; the SQLite database
stays in the document directory, where it is correctly backed up.

---

## D-037 — Stamp awards: two gates, and levadas verify their endpoints.

**Status:** Provisional — implemented 2026-08-10 (T-071). Every threshold is a reasoned guess;
T-131 retunes them against real holidays, which costs nothing because each award stores what it
was judged on.

**Decision:** a place becomes a stamp when a recorded visit clears **both** gates —

1. **dwell** ≥ 3 minutes inside the geofence (1 minute at a levada endpoint), and
2. **mean speed** while inside ≤ 2.0 m/s, *when speed is known*.

**Levadas are judged differently**, because the stamp means "you walked the whole thing" and
not "you arrived" (D-009, design brief §4). Both the `start` and `end` geofences must
independently clear the gates above, and the elapsed time between them must be 20 minutes to
14 hours.

**The non-obvious part, and the reason this needed a decision.** The naive levada rule — "was
inside both endpoint geofences" — hands the stamp to somebody who **drives** between two
trailheads, which on this island is often quicker than walking between them. Requiring each
endpoint to pass its own dwell-and-speed gate is D-009's own sentence applied literally:
*credit the connection, verify the endpoints*. A drive-by fails at the trailhead, before the
connection is ever considered. The 20-minute floor is a second, cheaper guard on the same case.

**Missing speed does not veto an award.** It lowers confidence instead (capped at 0.6 against
1.0 for a clean two-gate pass). Refusing would deny stamps precisely where GPS is worst — under
Laurissilva canopy, at the levada trailheads that matter most — which is the uninstall trigger
D-032 names. Fixes reporting *no* speed are excluded from the mean rather than averaged as
zero: "unknown" must never read as "stationary".

**Alternatives considered:**

- *Award on the geofence enter event, immediately.* Rejected: a visit is not judgeable until it
  has lasted, and the enter event arrives in a headless process whose only job should be
  writing it down (D-010). Hence a re-runnable pass rather than a listener.
- *Dwell only.* Rejected: it cannot tell a genuine visit from a traffic jam inside a generous
  trailhead radius, and D-032 wants those radii generous.
- *Speed only.* Rejected for the reason D-028 already established — on Madeira's gradients and
  in Funchal traffic, speed alone cannot separate walking from driving. Averaged over several
  minutes in one small circle it answers a much easier question: did they stop?
- *Require a levada's endpoints in walking order.* Rejected: levadas are walked in both
  directions, and the direction carries no information about whether the walk happened.
- *Overwrite an existing award when re-running the pass.* Rejected: the first award keeps its
  timestamp. When a stamp was earned belongs to the user; a threshold change months later must
  not rewrite their holiday.

**Consequences:** `stamp_award` (migration 2) stores dwell, mean speed, confidence and a
human-readable reason next to each verdict, so a surprising stamp is explicable and the
thresholds are retunable without re-collecting anything. The pass runs when the app opens and
will run again at trip end (T-101). `recording_event` gains a `stamp` kind.

---

## D-038 — A web design workbench, for looking at screens. Web is not a target.

**Status:** Provisional — added 2026-08-10. Revisit if it ever starts costing more than it
returns, or if anyone mistakes it for a product surface.

**Decision:** the app gains a **web build used only as a design workbench** —
`App.web.tsx`, mounting the presentational screens against fixture data in a browser. Metro's
platform-extension resolution (`.web.tsx`) means the shipping app is untouched: no
`Platform.OS` conditional enters the recorder, and `backgroundTasks.web.ts` is a no-op file
rather than a branch.

**Why:** D-032 moved the remaining effort to the interface, and there is **no device on this
project** — no Android phone, no Mac, and the emulator is blocked behind a BIOS setting the
project lead has declined to change. An interface nobody can look at cannot be judged, and
building screens blind and declaring them done is the failure mode this decision exists to
avoid.

**It paid for itself immediately.** Two things were measured rather than guessed, and neither
was visible by reading the code:

- The passport at three stamps scrolled to **1.1 screens** — a first-morning scroll that
  reveals nothing — caused by five near-identical "No X yet" lines. Replaced by one invitation
  under the hero; day one and three stamps now fit **exactly one screen**, and 180 stamps
  browse in 2.66.
- The primary screen's two bottom controls **overlapped by 38 px** on a 320 dp phone showing
  `180 / 180` with the While-Using recording control visible. A real combination, and the worst
  case for width. They now stack, which cannot collide at any width (verified at 320/360/390/430).

**Alternatives considered:**

- *Build the screens blind and check them later on a device.* Rejected: "later" has no date,
  and both defects above would have shipped into a build somebody was relying on to evaluate
  the design.
- *Static HTML mockups.* Rejected: a second implementation that drifts from the real
  components, and it would not have caught either defect, because both came from the actual
  layout engine.
- *A cloud device farm.* Still the right answer for the *map* and for anything native, and it
  remains recommended in `docs/dev-build.md`. It is minutes-per-iteration rather than seconds,
  which is the wrong loop for pushing pixels around.
- *Ship a web version.* Rejected outright, and this is the risk the decision has to guard.
  The app needs background location, OS geofences and an offline native renderer; a browser
  has none of them. `backgroundTasks.web.ts` says so in the file itself.

**Consequences:** three dev dependencies (`react-native-web`, `react-dom`,
`@expo/metro-runtime`) that no shipped binary includes. Screens must be written
**presentational** — props in, pixels out — with the database work in a container. That is a
better shape anyway, and it is what made T-081 answerable at all.

**What it still cannot tell anyone:** real text scaling, real touch behaviour, the map (no web
build for the native renderer), and sunlight legibility. T-065 and real hardware are unmoved by
any of this.

---

## D-039 — Trip end: the arrival crossing must not end the trip, and silence takes three days.

**Status:** Provisional — implemented 2026-08-10 (T-099, T-100). Refines D-012 rather than
replacing it; D-012's choice of signals stands unchanged.

**Context:** D-012 chose the airport geofence as the trip-end trigger and named two fallbacks.
Implementing it surfaced one trap it does not mention and one threshold worth arguing with.

**Decision:**

1. **An airport crossing only ends a trip if the user has been somewhere else first**, and the
   trip is at least 20 hours old. **This is the trap.** Every user walks through the airport on
   the way *in* — they land, collect a bag, pick up a rental car and drive off, straight through
   the geofence that is supposed to mean "going home". Naively implemented, every holiday ends
   about forty minutes after it begins, and the reveal — one of exactly two notifications
   (D-011) — is spent on an empty trip on the way out of arrivals.

   Of the two guards, *"has been somewhere else"* is the one that carries the rule; trip age
   alone would still fire on a slow first day.

2. **A departure needs a 45-minute dwell**, which separates flying out from dropping somebody
   off or passing on the coast road.

3. **Silence ends a trip after three days, not D-012's 24 hours.** Silence is ambiguous in a
   way the other two signals are not: it means *"the user left"* or *"an OEM killed the
   recorder"* (ARCHITECTURE §6.2), and those want opposite responses. Ending a live holiday
   because the recorder died would fire the reveal over a half-recorded trip and burn the
   notification budget on it. Three days makes that mistake much rarer and costs only a late
   reveal when wrong — the cheaper error. D-012 said "24h+", so this is within its latitude.

4. **The trip is dated to when it actually ended**, not when the app noticed: the moment they
   reached the airport, or the last fix before the silence. Claiming otherwise would put empty
   days on the souvenir, which ARCHITECTURE §10 forbids.

**Alternatives considered:**

- *Distinguish arrival from departure by dwell alone.* Rejected: arrivals can be slow (baggage,
  car hire queues) and departures can be quick. Dwell separates flying from errands, not
  arriving from leaving.
- *Use the flight direction implied by the first fix after the airport.* Rejected: there is no
  fix after a departure — the phone goes into airplane mode.
- *Keep D-012's 24 hours for silence.* Rejected above.
- *End the trip on the airport crossing regardless, and let the user reopen it.* Rejected: the
  reveal cannot be un-sent, and D-011 allows exactly two notifications.

**Consequences:** the content pack gains `departurePoints` (D-034 amended) — monitored like any
other geofence so the trip can end, and deliberately excluded from the stamp rules so nobody
collects an airport. `recording_event` gains a `trip_end` kind. Detection runs on every
geofence crossing, which is what puts the reveal in the departure lounge rather than at the
next app launch, and again on launch so a trip that ended unobserved is still finalised.

---

## D-040 — Masking is enforced by a single export door, and an unverifiable trace is withheld.

**Status:** Provisional — implemented 2026-08-10 (T-103, T-104). Confirmed by T-110, which
must inspect a real default export and fail to find the accommodation.

**Context:** D-016 requires the user's accommodation masked in exports, on by default, because
the souvenir is an export of location history and a trace that returns to one building every
night publishes where somebody is staying — and when it is empty — to a public feed. It is the
one genuine privacy hole in the design, and it sits inside the most-promoted feature (D-013).

**Decision:**

1. **One door.** `souvenir/exportTrace.ts` is the only function that yields a shareable trace.
   The renderer (T-105), the still, and anything later read from it and never from `rawFixDao`.
   Masking is therefore not a step somebody remembers — it is the only way out.
2. **No opt-out parameter.** There is deliberately no `mask: false` argument. If a "show my
   real trace" setting is ever added it belongs at the call site with its own confirmation,
   not as a flag threaded through a function where it could default wrong.
3. **An unverifiable trace is withheld, not exported.** If overnight fixes exist but no
   accommodation could be identified, the export returns *nothing* and says why. **A null
   accommodation must never be read as "nothing to hide."** That inversion is the single most
   likely way this feature fails silently, and it would fail in the direction that publishes an
   address.
4. **The mask radius (300 m) is much larger than the cluster radius (150 m).** The goal is not
   hiding the building but making it unidentifiable — 300 m in Funchal covers hundreds of
   dwellings. A radius that merely covered GPS error would still point at one front door.
5. **Overnight is 01:00–05:00 local.** It excludes late dinners and early starts, both of which
   happen away from the accommodation, and needs no map, address lookup or network to evaluate.

**The asymmetry that sets every threshold here** is the opposite of D-009's. For stamps, err
generous — a missed levada is an uninstall. For masking, err toward hiding: masking too much
costs a little trace near the hotel that nobody notices, masking too little publishes an
address. When in doubt, mask.

**Alternatives considered:**

- *Trim the first and last stretch of each day*, which D-016 offers as an alternative. Rejected
  as the primary mechanism: it removes real trip content on days that start and end away from
  the hotel, and it fails entirely for somebody who returns mid-afternoon. Still available as a
  supplement if T-110 finds the radius insufficient.
- *Ask the user to confirm their accommodation.* Rejected: it is a prompt about a privacy risk
  most users have not thought about, at onboarding, in an app whose promise is that it needs no
  attention (CONTEXT §3). Detecting it is cheap and silent.
- *Reverse-geocode to snap to a building and hide that.* Rejected: needs network and an address
  database, both forbidden (D-001), and hiding exactly one building is weaker than hiding a
  neighbourhood anyway.
- *Export unmasked when detection fails, and warn.* Rejected — see point 3. A warning at the
  moment of sharing is read by nobody.

**Consequences:** `recording_event` gains an `export` kind, so the one privacy-relevant action
the app takes leaves a trace of its own. `tripDao.getMostRecentTrip` exists because export
happens *after* trip end, when there is no active trip by definition.

---

## D-041 — Onboarding: three screens, no gate, and no battery figure until one is measured.

**Status:** Provisional — implemented 2026-08-10 (T-042, T-043, T-044, T-114, T-121). The copy
has never been read by anybody outside this project; that is what T-112's reduction pass and a
real beta (T-129) are for.

**Context:** CONTEXT §4.3 says the location permission alone could sink the app, and D-008
answers it: fully functional on While-Using, Always is an upgrade and never a gate. Nothing
specified what the user actually sees.

**Decision:**

1. **Three screens, then the map.** Welcome (what this does), Location (why, then the system
   dialog), Notifications (how few there will be, then the dialog). Every decline is a **real
   button the same size as the accept** — not grey text in a corner. Refusing is a supported
   way to use this app, and styling it as a lesser choice would make D-008 a lie.
2. **Nothing gates.** There is no step that requires a grant to move past. A user who denies
   everything reaches a working app with a start/stop button.
3. **Notifications are asked separately, with a screen in front.** Two system dialogs back to
   back get both refused — the second is dismissed on reflex before it is read. The screen
   between them is also the honest place to promise "two messages, ever", which is the actual
   objection.
4. **The Always upgrade is offered once, on day 2, and never again.** A second ask is pressure,
   and pressure is what gets permissions revoked. Settings keeps a way to enable it later
   (T-141). It waits for something to have been recorded, because the pitch is made in terms
   of the map they already have.
5. **No battery figure is stated until one is measured.** T-042 requires the measured number
   from T-054 and forbids an invented one, so `MEASURED_BATTERY_PERCENT_PER_DAY` is `null` and
   the sentence is **omitted entirely** rather than estimated. A guessed percentage is worse
   than none: it is a promise the app has not earned, made to somebody deciding whether to
   trust it with a week of their location, and it would be found wrong on their holiday. A
   test asserts the constant is still null.
6. **No jargon.** "Permission", "background", "geofence", "GPS" and "enable" do not appear in
   any user-facing string. Verified by a check over the rendered DOM, not by eye.

**Alternatives considered:**

- *Ask for Always during onboarding.* Rejected — this is the single thing CONTEXT §4.3 warns
  hardest against, and on Android 11+ it is not even possible inline.
- *Ask for notifications alongside location.* Rejected; see point 3.
- *Estimate the battery cost as "about 5%".* Rejected; see point 5. It is the plausible number
  that would have shipped if nobody wrote the constraint into the code.
- *A skippable single-screen onboarding.* Rejected: the location ask needs its own reason
  stated immediately before the dialog, or the dialog is the first explanation the user gets.

**Consequences:** the action buttons sit **outside** the ScrollView, which is load-bearing —
measured at 2× text scaling, the Play disclosure copy overflows and scrolls while both buttons
stay reachable; inside, they would be pushed off screen for exactly the users who need large
text most (D-015). The Android prominent-disclosure screen (T-121) uses Play's required
phrasing and is shown before the Always request on Android only.

---

## D-042 — The souvenir is planned as a storyboard, paced by movement, and never partial.

**Status:** Provisional — implemented 2026-08-11 (T-105a). **Nothing in it has been watched.**
Every duration below is a reasoned guess by somebody who has not seen the film, and the first
person who does will have better numbers. The arithmetic is unit-tested (23 tests); the
aesthetics are not tested at all, because they cannot be.

**Context:** D-013 makes the 9:16 video the entire distribution strategy, which makes T-105 the
largest remaining piece of v1 — and the half that encodes frames cannot be verified without a
device this project does not have. The same problem was already solved twice here
(`stampRules`/`stampAwards`, `geofenceSelection`/`geofenceManager`), so it is solved the same
way a third time.

**Decision:**

1. **The film is planned before it is rendered.** `souvenir/composition.ts` turns a trip into a
   **storyboard**: absolute millisecond times from the start of the video, a camera path, the
   strokes to draw, and the moment each stamp lands. It is pure — no clock, no randomness, no
   database — so it is testable on Node today, and so the same trip always composes to the same
   film. A renderer consuming it needs no judgement of its own. T-105b is the encoder.

2. **Time is spent on movement, not on hours.** The draw-on advances one *recorded fix* at a
   time, not one minute at a time. Elapsed-time pacing would spend a third of the video sitting
   outside a restaurant, because the recorder samples a stationary phone rarely but for a long
   while (D-028). This has a free second consequence: the pen-lift across a blackout consumes
   exactly one step, so **a recording gap is a visible beat in the film** rather than a line
   drawn across a road nobody proved was taken (ARCHITECTURE §10).

3. **No stamp is ever dropped.** Stamps are the reward (D-002). Funchal will hand somebody six
   inside an hour, so cue spacing shrinks and the draw lengthens to accommodate them; if they
   still will not fit, they spread evenly across the scene. Compressed is acceptable; missing
   is not. A stamp is cued at the fix that was current when it was earned, so the badge lands
   as the line reaches the place.

4. **An unsafe trace produces no film at all.** The input type demands the `safeToShare` flag
   from `getExportableTrace` (D-040) rather than a bare fix list, and the composition returns a
   refusal with a reason instead of scenes. `Composition` is a discriminated union, so a caller
   *cannot* reach the scenes of a film that declined to exist. This is the same stance as
   D-040: withhold rather than ship something unverified.

5. **Bounded length, three scenes.** Establish (1.2 s), draw (6–14 s, bought by distance
   travelled), finale (3 s) — so between roughly 10 and 18 seconds whatever the trip was. An
   afternoon must still be a film and a fortnight must still be watchable in a feed.

6. **It names no place and no island.** Every string comes from the content pack via the
   caller (D-017). If the video should open on a title card reading a destination name, that
   name becomes a field in `content/pois.json`, not a literal in `app/`. That is why there is
   no title card today.

**Alternatives considered:**

- *Render directly from the trip, with the timing decided inside the encoder.* Rejected: it is
  the whole of T-105 blocked behind hardware, and none of the interesting judgement would be
  testable. The split is what lets the biggest remaining piece of v1 move at all.
- *Pace the draw-on by elapsed time.* Rejected; see point 2. It is the obvious implementation
  and it produces a film that is mostly a stationary dot.
- *Cap the number of stamps shown, or show the "best" ones.* Rejected: there is no defensible
  ranking of a person's own holiday, and the collection is the reward. Compress instead.
- *Draw one continuous line across recording gaps.* Rejected — ARCHITECTURE §10 forbids
  fabricated continuity, and the souvenir is the worst place to start inventing it because it
  is the artefact that gets published.
- *Show a partial film when masking could not be verified.* Rejected; see point 4.
- *Fix the video at a single duration.* Rejected: a one-day trip and a two-week road trip
  produce very different amounts of line, and a fixed length either rushes one or pads the
  other.

**Consequences:** `map/traceGeoJson.ts` grew a `splitIntoSegments` export and `buildTrace` is
now built on it, so the map screen and the souvenir decide where a line breaks with **one**
function. Two callers deciding that independently would be two chances to bridge a blackout.

**What confirms or kills this:** T-105b, and somebody watching the result. Specifically at
risk: `MIN_CUE_GAP_MS` (350 ms) is a legibility figure and legibility is measured by watching;
`CAMERA_WINDOW_FRACTION` decides whether the pan reads as deliberate or as drift; and the whole
duration budget is guesswork until a real trip has been composed and watched to the end.

---

## D-043 — Firebase Cloud Messaging ships in the Android build, and stays.

**Status:** Provisional — decided while auditing dependencies 2026-08-11 (T-117). The
behavioural half is unverified: **T-117b must confirm it with a packet capture on a device.**

**Context:** the dependency audit (`docs/dependency-audit.md`) found that `expo-notifications`
declares `com.google.firebase:firebase-messaging` on Android and registers a
`com.google.firebase.MESSAGING_EVENT` service. Both land in the APK. On an app whose entire
position is "no data leaves the device" (D-001), a Google push SDK in the binary is not a
detail — CONTEXT §4.8 says this is precisely how "no data leaves the device" quietly becomes
false without anyone deciding it should.

**Decision:** keep `expo-notifications`, and **write the situation down rather than discover it
during the Play review.**

1. **The app uses local scheduled notifications only** — two per trip, ever (D-011). No push
   token is requested anywhere in `app/src`; the audit verified this against the source.
2. **No Firebase configuration ships.** There is no `google-services.json` and no
   `android.googleServicesFile` in `app.json`, so the google-services Gradle plugin never runs
   and no sender configuration is compiled in. Without a default `FirebaseApp` there is nothing
   for FCM to register against.
3. **That argument is static and is not enough.** T-117b watches the network on a real device,
   during the T-051 soak, where it costs nothing extra.
4. **The privacy policy (T-124), the Data Safety form (T-122) and the nutrition label (T-120)
   are written knowing this**, not around it.

**Alternatives considered:**

- *Drop notifications entirely and remove the dependency.* Rejected, and it was the tempting
  option. CONTEXT §4.5 is explicit: the enemy of a ghost app is the OS, not the user. A
  recorder that dies on day 2 and is discovered on day 7 is **worse than never having installed
  the app**, and the day-1 health check (T-049) is the only thing standing between the user and
  that outcome. Removing an SDK that does nothing, at the cost of the mechanism that catches
  silent failure, trades a real protection for an appearance.
- *Replace `expo-notifications` with a local-only notification library.* Not rejected on
  merit — **left open**. It would remove the finding outright. It is not done now because it is
  a dependency swap on a working, permission-tested flow (T-042/T-114) with no device to
  re-verify it on, which is the wrong order. Revisit if the Play review (T-123) makes an issue
  of Firebase, or when a device exists.
- *Say nothing and hope it does not come up.* Rejected. It is one grep away, on a claim that
  invites grepping.

**Consequences:** `docs/dependency-audit.md` exists and is the artefact to hand a reviewer.
T-117b is added, and is a Phase 1 device task rather than a compliance one, because the cheapest
moment to run it is while the 72-hour soak is already running.

---

## D-044 — The privacy policy is shown offline in the app, and the web copy is generated from it.

**Status:** Provisional — written 2026-08-11 (T-124). **Not lawyer-reviewed**, and it must be
before either store submission.

**Context:** both stores require a privacy-policy URL in the listing before they will accept a
background-location app (T-123). The app itself needs one too, and the settings row for it has
existed and done nothing since T-141.

**Decision:**

1. **The policy is a screen in the app, not a link to a browser.** Two reasons, and the first
   is the stronger: this app makes **no network requests at all** (D-001), so a linked policy
   would become the only thing in the product that does. The second is the reader — a tourist
   wondering what the app is doing with their location is frequently a tourist with no signal,
   and that is exactly the moment the document has to be available.
2. **The text lives in `app/src/legal/privacyPolicy.ts` and `docs/privacy-policy.md` is
   generated from it** by `tools/generate-privacy-policy.mjs`. Two hand-maintained copies of a
   legal document is a promise to let them drift, and a policy that says one thing in the app
   and another on the web is worse than either. Same rule as the map styles: never edit the
   generated file.
3. **It states the two exceptions to "nothing leaves your phone", because both are true.**
   (a) The trip is in the phone's own encrypted backup — ARCHITECTURE §4a puts it there
   deliberately, as the answer to "my phone died on day 5". (b) Sharing the souvenir publishes
   where the user went, with their accommodation removed first and no way to switch that off
   (D-040). A policy written from the marketing line rather than from the code omits both, and
   the gap between "very nearly true" and "true" is where a policy earns its keep.
4. **`CONTACT_EMAIL` is null and the contact section is omitted entirely** rather than shipped
   with a placeholder address — the same stance D-041 takes on the unmeasured battery figure,
   and a test enforces it. It is **not** defaulted to the project lead's personal address:
   publishing somebody's email in a store listing is their decision. **This blocks T-123.**
5. **Libraries are not enumerated.** D-043's Firebase finding is not mentioned, because FCM is
   never given anything to send and there is no server to send it to — there is no data
   practice to disclose, and asking a lay reader to reason about a push library they were never
   subject to makes the document less trusted, not more. The technical account is
   `docs/dependency-audit.md`, which is what a reviewer gets. **If that stops being true, this
   reverses.**
6. **The vocabulary is tested, not eyeballed** — the T-114 technique. "Geofence", "SDK", "API",
   "analytics", "third-party", "GPS", "anonymised" and eleven others appear nowhere, and no
   sentence runs past 45 words. D-015's reader is 80 years old and a policy they will not read
   is decoration.

**Alternatives considered:**

- *Link out to a hosted page.* Rejected; see point 1. It is what almost every app does and it
  is wrong for this one specifically.
- *Keep the markdown canonical and have the app import it.* Rejected: React Native cannot
  import markdown without a transformer, and adding a bundler plugin to ship a legal document
  is a poor trade.
- *Use the project lead's personal email as the contact.* Rejected; see point 4.
- *Mention Firebase in the policy for maximum candour.* Rejected; see point 5. Recorded because
  it is a genuine judgement call and the opposite choice is defensible.

**Consequences:** T-118, T-120 and T-122 can now be filled in from a document that says what
is true. **T-123 stays blocked on `CONTACT_EMAIL` and on a hosting URL**, which needs the
domain question settled — the same open item as the bundle identifier.

---

## D-045 — The battery exemption opens a settings screen; it does not ask for the restricted permission.

**Status:** Provisional — implemented 2026-08-11 (T-046). **Deliberately reversible**, and
T-053 is what decides.

**Context:** CONTEXT §7 and HANDOFF both state it plainly — **Android OEMs kill background work
regardless of the official APIs.** Xiaomi, Huawei, Samsung, Oppo and OnePlus ship battery
managers that stop a foreground service anyway. The battery-optimisation exemption is the one
official lever against that, and without it a recorder correct in every other respect still
dies on somebody's holiday.

**Decision:** the settings row sends
`android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS` — the system list of apps and their
battery setting — rather than requesting `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` and showing the
one-tap dialog.

**Why the worse user experience wins here:** the direct dialog needs a permission Google Play
treats as restricted and reviews against a list of qualifying uses. This app is *already* going
through Play's manual background-location review (T-123), which is slow and sits on the
critical path. Adding a second restricted permission to that submission is a risk taken in
exchange for saving two taps, and the taps are recoverable where a rejected submission is
weeks.

**The honest cost, and it is real:** the user has to find this app in a list, and D-015's reader
is 80 years old. The footnote therefore names the app so it can be recognised in that list, and
uses the phone's own word ("battery") so the screen is identifiable when they arrive.

**What the app cannot do, and how it copes:** it **cannot read whether it is currently exempt**
— `PowerManager.isIgnoringBatteryOptimizations()` has no Expo API and reading it would mean a
native module for one boolean. So the row offers the action and **never claims a state**.
Showing "Off" when the app cannot tell would be an invented fact, which is the thing D-041
exists to prevent. What catches the failure instead is the **day-1 health check** (T-049): it
does not know *why* recording stopped, but it knows that it did, and telling the user is what
protects the trip.

**Alternatives considered:**

- *Request the restricted permission and show the one-tap dialog.* **Not rejected on merit —
  held in reserve.** It is the better experience. Adopt it if T-053 shows OEMs killing the
  recorder despite the foreground service, at which point the reliability argument outweighs
  the review risk and there is evidence to put in the submission.
- *Write a small native module to read the exemption state.* Rejected for now: disproportionate
  native surface for one boolean, on a project with no device to test native code on.
- *Do nothing and rely on the foreground service.* Rejected — it is exactly what
  dontkillmyapp.com exists to document as insufficient.
- *Add `expo-intent-launcher` for the intent constants.* Rejected: a new dependency needs a
  network-behaviour check (CONTEXT §6.4, T-117), and `Linking.sendIntent` is already in React
  Native.

**Consequences:** the row is Android-only and absent on iOS, which has no equivalent. No unit
test, deliberately — there is nothing pure to test, and a test asserting that a string constant
equals itself would be worse than none. **T-053 is the verification and it needs an
aggressive-OEM Android device.**

---

## D-046 — Stamp artwork is generated per place. The emblem carries the category; shape and colour do not.

**Status:** Provisional — implemented 2026-08-11 (T-070), and **revised once the same day**
after the project lead looked at the first version and called it too minimalistic. It has now
been seen exactly twice, on a browser, by one person. No device has drawn it.

**Context:** the passport drew a placeholder disc with an initial. T-070 is the real artwork,
and it sits on a constraint nobody can remove: the passport holds **150–250 places** (D-002)
and `content/pois.json` is curated by the project lead (T-066), so artwork cannot be
commissioned per place — and a place added next month must arrive with artwork already, or
curation acquires a second job.

**Decision:** the artwork is **generated from what the pack already knows** — the place's
category and its id — in the vocabulary of vintage die-cut luggage labels, chosen by the
project lead from a reference sheet.

1. **The emblem carries the category. Shape and colour are decoration.** D-015 forbids
   differentiating meaning by hue alone, so the reader needs a non-colour signal. The first
   version made the *silhouette* carry it, one shape per category. The project lead asked for
   varied shapes, and the reference sheet settles it: Greece, Spain and London are all
   rectangles and nobody confuses them, because the icon does the work. **Eight silhouettes**
   are now spread across places by hash and a test forbids two categories sharing an emblem.
2. **Variation is derived from a hash of the place id, and from nothing else.** No clock, no
   random, no list index that shifts as the pack grows. A stamp that changes appearance between
   two launches is not a souvenir; it is a bug the user cannot describe. The hash is written out
   rather than imported precisely so it can never change.
3. **The layout is searched, not tabulated.** Eight shapes × one or two lines of name × five
   emblems is too many combinations to hand-tune, and three shapes taper. So `bestBandY` and
   `bestEmblem` **measure** each silhouette: the band goes as low as it can while staying wide
   enough and leaving the emblem room, and the emblem is fitted to what is actually left. The
   project lead's requirement that **the place name fits** is therefore a property of the
   system rather than of the sample data.
4. **Long names wrap to two lines rather than being truncated.** "MIRADOURO GRA…" technically
   fits and tells the reader nothing.
5. **Detail is part of the specification, not polish.** Two cut borders, a sunburst, perforation
   dots, a keyline, two-tone emblems, six colourways per category. A test pins the layer count
   so a later simplification is a decision rather than a drift.

**Alternatives considered:**

- *Commission artwork per place.* Rejected: 150–250 illustrations, and it makes every future
  content addition wait on an illustrator.
- *One shape per category, carrying the meaning.* **Implemented, then rejected** on the project
  lead's instruction. The accessibility requirement moved to the emblem rather than being lost.
- *Draw with plain React Native views.* Rejected: no torn edges, no silhouettes. `react-native-svg`
  was added instead — audited the same day per CONTEXT §6.4, and that audit found Fresco's OkHttp
  image pipeline inside it, which nobody would have guessed was in a vector library
  (`docs/dependency-audit.md`).
- *Truncate long names with an ellipsis.* Rejected; see point 4.

**Consequences:** `react-native-svg` is a new native dependency, so the next dev build is not
the same binary as the last. `tools/preview-stamps.mjs` renders the same designs to a
standalone page from the same module, which is the only way this could be judged at all on a
project with no device — and the same one-source rule the map styles and the privacy policy
follow.

**What confirms or kills this:** somebody looking at it, and then T-065 outdoors. Everything
here is a screen judgement, and the sticker colours have never been seen in Funchal sun.

**Amended 2026-08-11 (T-113).** The thirty colourways were written by something that cannot
see, and were then measured. Three pairs failed: a teal name on dark slate at **3.03:1**, cream
on bright red at **3.90:1**, and — outside this decision but found by the same pass —
`colors.border` at **1.85:1**. All are corrected, and `ui/contrast.test.ts` now checks every
colourway on every build, so the next palette added cannot ship unreadable. The colours here
are still unseen outdoors; contrast is a floor, not a verdict.


---

## D-047 — The emulator cannot serve a `balanced`-accuracy location request. The recorder was never broken.

**Status:** Provisional — measured on the emulator 2026-08-12 (T-052a). The *finding* is
measured and reproducible; the **consequence for the walking profile on real hardware is not**,
and that is the part waiting on T-021a.

**What was actually wrong:** nothing in this codebase. The recorder's whole chain — task
registration, `expo-location`'s Android task path, the sink, SQLite, lazy trip creation — works
end to end. What failed was the **requested accuracy priority**.

`samplingPolicy.ts` asks for `balanced` when walking and `coarse` when stationary.
`expo-location` maps both onto `PRIORITY_BALANCED_POWER_ACCURACY`, which is served by the
**network** location provider (GMS's `NetworkLocationService` — wifi and cell geolocation). An
emulator has no real wifi or cell survey to geolocate from, so that request produces nothing,
registers nothing, and turns nothing on. `adb emu geo fix` drives the **GPS** provider only, and
only a `PRIORITY_HIGH_ACCURACY` request powers it up. `driving` is the one profile that asks for
`high`.

**The evidence, in the order it was collected:**

1. A plain foreground `watchPositionAsync` at `Accuracy.High` received **11 positions in 15 s**,
   and a one-shot `getCurrentPositionAsync` returned a fix. So `expo-location`, the fused client
   and `adb emu geo fix` all work together on this machine.
2. Geofencing registered *and delivered crossings* through the same PendingIntent machinery, so
   the broadcast-receiver path was never implicated either.
3. With the **walking** profile: `dumpsys location` reads `ProviderRequest[OFF]` on every
   provider, our uid appears nowhere, and 41 replayed points produce **zero** rows.
4. With the **driving** profile: `gps provider: ProviderRequest[@+15s0ms, HIGH_ACCURACY,
   WorkSource{10192 com.madeiraexplorer.app}]` — our uid, at exactly the profile's `minTimeMs` —
   and the same 41-point replay produces **12 fixes spaced 15 s apart**, which then draw as a
   trace on the map.
5. Reversed and re-reversed: walking → `OFF`, driving → registered. The result moves when the
   input moves, which is the check CLAUDE.md demands before believing any of this.

**This corrects T-052a's second suspect.** It was framed as *GPS provider versus fused provider*.
The provider family was never the axis — a `HIGH_ACCURACY` request through the very same fused
client works. **The axis is priority.**

**What this does and does not settle:**

- ✅ **Settled:** the recorder records. The oldest and largest unknown in the project is closed.
- ✅ **Settled:** T-052a was an environment limitation, not an app defect. Nothing was changed to
  make it work, which is the strongest available evidence for that claim.
- ❌ **Not settled:** whether `balanced` produces fixes on a real phone. It should — wifi and cell
  geolocation are real there — but that is an argument, not a measurement, and this project has
  been bitten before by exactly that distinction (D-043). **T-051 owes the reading.**

**The risk this exposes, which is the part worth keeping:** with the walking profile the app's
location request is *invisible* and produces *nothing*, while the debug screen cheerfully reports
`Recording: yes` and the foreground-service notification sits in the shade. That is precisely the
silent failure CONTEXT §4.5 calls worse than never installing the app. A tourist on a levada with
no SIM and wifi off is not an exotic state.

**Alternatives considered:**

- *Raise `walking` to `high` accuracy now.* **Rejected for now, and it is the obvious candidate.**
  It would have made the emulator record on the first try, but it spends the battery budget
  (D-028, ARCHITECTURE §7) to fix a machine that has no battery — and T-054 has never measured
  what that budget actually is. Changing tuned constants to satisfy a simulator is how a
  measurement gets faked. **Revisit when T-051/T-054 report.**
- *Reach for the Transistor SDK (T-031a, D-025).* Rejected, and it would have been an expensive
  mistake: the free stack was working the whole time.
- *Have the recorder verify its own request registered.* **Not adopted, but the most interesting
  option** — it is the general fix for the silent-failure class, not just this instance. There is
  no public Android API for "did my request register", but *"recording has been on for N minutes
  and no fix has arrived"* is answerable and the health-check machinery (D-011, T-049) already
  exists to carry it. Raised as **T-052b**.

**Consequences:** `app/src/recording/locationProbe.ts` stays — it is the instrument that settled
this and it is what settles it again on real hardware. `samplingPolicy.ts` is **untouched**.
CONTEXT §6.6's list of what an emulator cannot answer gains a fourth entry, and it is the one
that would have cost the most time to rediscover.

---

## D-048 — The recording sink is serialised. The OS delivers concurrently and our writes assumed it did not.

**Status:** Provisional — implemented and measured 2026-08-12 (T-052c). The fix is verified by
before/after on the same input; what is *not* established is whether serialising is the right
long-term shape or a workaround for an `expo-sqlite` defect that will be fixed upstream.

**Decision:** every entry point on `databaseSink` — `onLocations`, `onGeofenceTransition`,
`onError` — runs through one `createSerialQueue()`. Work arrives concurrently and is executed one
at a time, in arrival order.

**What prompted it:** a cold start with the dev fixture delivered **99 geofence transitions inside
100 ms**, and `recording_event` caught an error. Chasing it found two bugs, one of which is far
worse than the thing being chased.

**Bug 1 — two trips instead of one, and it is silent.** `getOrCreateActiveTrip` reads, finds no
active trip, and inserts one, with an `await` between the read and the insert. Concurrent callers
all read "none" before any of them inserts, so each creates a trip. **Every downstream assumption
in this app is that a trip is singular** — the trace (T-059), the progress count (T-073), the
passport, trip-end detection (T-099). Both callers are the sink, and the OS delivering a location
batch and a geofence crossing in the same wake-up is the *normal* case. This was never observed in
the wild only because a trip usually already exists; the window is the first burst after install,
which is precisely the moment the app is least able to explain itself.

**Bug 2 — a statement used after release.** Under many overlapping calls on one connection,
`expo-sqlite` intermittently rejected with *"Cannot use shared object that was already released"*,
surfacing as a cast failure on a `NativeStatement`. Our data access does nothing exotic — plain
`runAsync(sql, ...params)`, no reused or shared statements — so this is the library's own
prepare/finalize racing itself. Seen twice: from `onGeofenceTransition` and, a day earlier, from
`checkTripEnd`. **A lost crossing is a lost stamp, and stamps are the entire reward (D-002).**

**Measured, same input both times.** Before: 99 jobs → an error row. After: 99 jobs → 99
`geofence_event` rows, 99 diary entries, zero errors.

**Alternatives considered:**

- *Fix `getOrCreateActiveTrip` alone* — a unique index, or `INSERT … WHERE NOT EXISTS`. Rejected as
  insufficient: it addresses bug 1 and leaves bug 2 entirely. It is still worth doing as
  belt-and-braces and is **not** done here, because the sink is now the only caller and adding a
  constraint to a shipped schema needs a migration for a race that can no longer happen. Revisit if
  a second caller ever appears — **that is the trigger.**
- *Serialise every database call.* Rejected, and it would have deadlocked: `insertFixes` and the
  migration runner both work inside `withTransactionAsync`, so a queued call nested inside a
  transaction would wait for itself. It would also queue the UI's reads behind the recorder's
  writes for no benefit.
- *Wait for an `expo-sqlite` fix.* Rejected: it does not touch bug 1 at all, and D-025's whole
  point is that a platform library's behaviour is not something this project gets to depend on.
- *A bounded queue, dropping work under load.* Rejected outright. D-010 makes raw data the one
  thing that may never be dropped, and the burst is small — a handful of small writes.

**Consequences:** `storage/serialQueue.ts` is pure and tested (9 tests), and the queue is private
to `recordingSink.ts` — the one boundary the OS delivers to, and nothing inside it re-enters. A
failing task no longer blocks what is queued behind it, which matters over a week of recording:
one bad write must not stop the recorder for the rest of the trip.

**What would change this:** if `expo-sqlite` fixes its statement race, bug 2's justification goes
away — but bug 1's does not, and bug 1 is the one that quietly corrupts a trip. The queue should
stay regardless.

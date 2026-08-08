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

**Status:** Accepted

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

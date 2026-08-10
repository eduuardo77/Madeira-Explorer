# Madeira Explorer (working title)

A mobile app for tourists visiting Madeira Island that passively records where they have
been and reveals it back to them as a beautiful, shareable map at the end of their trip.

Think of the fog-of-war map from GTA, applied to a real island: roads and trails you have
travelled light up; everywhere you have not been stays dim. Along the way you collect
stamps for reaching notable places — miradouros, levada walks, villages, beaches.

---

## The one-sentence pitch

Install it when you land, forget about it, and on your way home the app hands you a map of
everything you saw.

---

## Goals

### Product goals

1. **Show where you have been.** A clean, quiet map of Madeira where travelled roads and
   levadas are highlighted and untravelled ones recede. Light for everyday use, dark for the
   souvenir (D-026).
2. **Suggest where to go next.** Unvisited curated places and per-region progress imply the
   recommendation without needing a recommendation engine.
3. **Reward exploration.** Collectible stamps for reaching notable places — the "passport"
   metaphor, not a points currency.
4. **Deliver a souvenir.** An end-of-trip vertical video and still image good enough that
   people want to post it.

### Non-negotiable constraints

| Constraint | What it means in practice |
|---|---|
| **Battery efficiency** | Tourists are outdoors all day on one charge, using their phone for navigation and photos. Our tracking must cost single-digit % per day, not per hour. |
| **Mobile data efficiency** | Target zero network usage during the trip. The entire island ships offline. |
| **Radical simplicity** | An 80-year-old must be able to use it with no instruction. One primary screen. Minimal text, minimal options. |
| **Privacy by architecture** | Location history never leaves the device. No account, no backend, no analytics. |
| **Ghost operation** | Install once, never open it again for a week, and it still works. |
| **Graceful degradation** | Missing a levada because of poor GPS is worse than crediting one generously. |

### Explicit non-goals

- **Not a navigation app.** Tapping a place hands off to Apple/Google Maps. We never draw a route to follow.
- **Not a social network.** No accounts, no friends, no leaderboards, no live location sharing.
- **Not a trip planner.** No itineraries, no bookings, no reviews.
- **Not global.** Madeira only, deliberately. The bounded scope is the advantage.

---

## Current status

**Phase: Planning complete. Phase 1 recorder written, including the geofence backbone; it has
never run on a phone. Phase 0 half done — the tile pack is built, the field runs are not.**

- ✅ Concept defined and critiqued
- ✅ Core product risks identified and mitigated in design
- ✅ Technical architecture drafted
- ✅ Privacy and platform-compliance approach settled
- ✅ Low-signal (tunnel / levada) matching strategy designed
- ✅ Scope confirmed: Porto Santo included (D-021)
- ✅ Hero metric confirmed: passport stamps, not road coverage (D-002)
- ✅ Raw trace retention confirmed: retain, with a delete-all control (D-010)
- ✅ Framework decided: **React Native + Expo, TypeScript** (D-023)
- ✅ Location stack decided: free `expo-location`; paid SDK is a contingency only (D-025)
- ✅ Rendering approach confirmed: local overlay, not feature state (D-022, Accepted 2026-08-08)
- ✅ Visual direction agreed: two styles — light for use, dark for the souvenir (D-026,
  *Provisional*); passport by category (D-027, *Provisional*) — see
  [docs/design-brief.md](docs/design-brief.md)
- ✅ Sampling gate decided: stationary-vs-moving (D-028, *Provisional*)
- ✅ v1 scope cut: **no map matching in v1 — draw the raw trace** (D-032)
- ✅ Geofence backbone built: the dynamic monitored set, with an exit-only anchor (T-039,
  D-033, *Provisional*) — unit-tested, unproven on hardware
- ✅ Content pack format defined and loading (T-040, D-034, *Provisional*) — see
  [content/README.md](content/README.md)
- ✅ **The reward mechanic works** (T-071/T-072, D-037, *Provisional*): geofence crossings
  become stamps behind a dwell-and-speed gate, and a levada needs both its endpoints verified
  so driving between trailheads earns nothing
- 🟨 **POI curation (T-066) — the file is ready and empty.** This is the critical path now, and
  it is the one task nobody else can do.
- 🟨 Phase 1 recorder written — **~3,100 lines, never executed on hardware**
- ✅ Tile pipeline spike — **12 MB pack for the whole archipelago** (T-026, D-030)
- ⬜ Field validation of GPS behaviour on levadas and tunnels — **not started** (no longer
  blocks v1 after D-032)
- ✅ Sampling gating implemented: stationary-vs-moving, asymmetric on purpose (T-034, D-028)
- ✅ Map styles authored as a generator over the Protomaps theme — light for use, draft dark for
  the souvenir (T-058, D-026); **shaded terrain** built and rendering (T-058a, D-035,
  *Provisional*). Total pack: **19.1 MB**. See [docs/map-style.md](docs/map-style.md)
- ✅ **The map is in the app** (T-056): MapLibre installed, packs and glyphs bundled in the
  binary and copied out on first launch (T-057, D-036, *Provisional*), and the **recorded trace
  draws** over terrain with honest gap breaks (T-059). Never rendered on a device.
- 🟨 Development build — **not created.** `app/eas.json` is written and
  [docs/dev-build.md](docs/dev-build.md) is the runbook. There is **no Android device and no
  Mac**, so the free path is a portable emulator (`tools/fetch-android-emulator.sh`) running an
  EAS-built APK; real battery and background-survival numbers still need real hardware.
  **Nothing in Phase 1 is verified without it.**

**All blocking decisions are closed.** Current dependency cost: **$0** (the only unavoidable
spend is store fees — Apple $99/year, Google Play $25 one-time).

Everything buildable without a device has been built. The next concrete steps are
**standing up the emulator and getting an APK into it**
([docs/dev-build.md](docs/dev-build.md) — free, and it settles whether the map actually
renders) and **curating the places** ([content/README.md](content/README.md)).

**The app has no name yet**, and the bundle identifier is a placeholder. See
[docs/design-brief.md §7](docs/design-brief.md).

---

## How the project is organized

### Documentation

| File | Purpose |
|---|---|
| `README.md` | This file. Overview, goals, status. |
| [HANDOFF.md](HANDOFF.md) | **Start here if you are new.** Session handoff: current state, what to do next, and the things that are easy to get wrong. |
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | Phased roadmap, milestones, success criteria, outstanding decisions. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, components, data flow, technical decisions, assumptions. |
| [TASKS.md](TASKS.md) | Ordered, dependency-aware implementation checklist. |
| [DECISIONS.md](DECISIONS.md) | Decision log — what we chose, what we rejected, and why. |
| [CONTEXT.md](CONTEXT.md) | Everything a fresh contributor (human or AI) needs before touching anything. |
| [docs/design-brief.md](docs/design-brief.md) | Visual direction, screen structure, and why most of the "UI work" here is cartography. |
| [docs/dev-build.md](docs/dev-build.md) | How to get a development build onto a phone or emulator, and what to check first once it runs. |
| [docs/emulator-setup.md](docs/emulator-setup.md) | The one BIOS setting that stands between this project and seeing its own map. |
| [content/README.md](content/README.md) | The content pack format, and the guide for curating it (T-066). |
| [docs/map-style.md](docs/map-style.md) | How the map styles are generated, and why they look the way they do (T-058, D-035). |

**These documents are the source of truth, not conversation history.** They are updated as
decisions are made, not retrospectively. The maintenance protocol — which document to update
for which kind of change, and the conventions around stable IDs and superseding — is in
[CONTEXT.md §9](CONTEXT.md).

### Source layout

The target structure. **Partly created:** `app/src/{recording,storage,ui,content}`,
`app/plugins/`, `tiles/` and `tools/` exist and hold real work. `content/pois.json` exists and
is **empty of places** — filling it is T-066. Everything else below is planned.

```
/
├── docs/                      # These planning documents (may move here later)
├── app/                       # Mobile application source
│   ├── src/
│   │   ├── recording/         # Location capture, batching, sensor fusion
│   │   ├── matching/          # Map matching, gap bridging, tunnel inference
│   │   ├── progress/          # Stamps, regions, scoring, confidence
│   │   ├── map/               # MapLibre integration, style loading, visited-road overlay
│   │   ├── souvenir/          # End-of-trip video and image rendering
│   │   ├── storage/           # SQLite schema, migrations, DAOs
│   │   ├── content/           # Reads content/ — the pack's only entry point (D-034)
│   │   ├── platform/          # iOS/Android-specific permission + lifecycle glue
│   │   └── ui/                # Screens (there are very few)
│   ├── metro.config.js        # Exists only to let the bundler see content/ (D-034)
│   ├── ios/
│   └── android/
├── content/                   # ALL Madeira-specific data — never hardcoded in app/
│   ├── README.md              # The format, and the guide for curating it (T-066)
│   ├── pois.json              # Curated places + category + region + geofence radii + stamps
│   ├── regions.geojson        # Region boundaries for per-region progress
│   ├── levadas.geojson        # Levada corridors with entry/exit nodes
│   ├── tunnels.geojson        # Tunnel portals for gap inference
│   └── stamps/                # Stamp artwork
├── tiles/                     # Offline map pipeline
│   ├── pipeline/              # OSM extract → vector tiles (+ terrain)
│   └── style/                 # MapLibre style JSON — light.json and dark.json (D-026)
└── tools/                     # Field-test loggers, trace replay, matching harness
    └── validate-content.mjs   # Checks content/pois.json using the app's own parser
```

### The `content/` rule

Everything Madeira-specific — the POI list, region boundaries, stamp artwork, tile pack —
lives in `content/` as **data, not code**. The app must contain no hardcoded island
knowledge. If this works, the natural next move is the Azores or the Canaries, and that
should be a content pack rather than a rewrite. The bounded scope is our moat today; it
must not become our ceiling.

---

## Quick orientation for anyone new

Read [CONTEXT.md](CONTEXT.md) first. It is written specifically to bring a cold reader up to
full speed, including the reasoning behind decisions that look arbitrary from the outside.

The three ideas that explain most of the design:

1. **Stamps are the score; highlighted roads are decoration.** Road matching is allowed to
   be imperfect because the user's reward does not depend on it.
2. **Geofences are the backbone.** They are simultaneously the cheapest on battery, the most
   robust to OS termination, the most tolerant of poor GPS, and the most privacy-preserving
   mechanism available. Everything important rides on them.
3. **The end-of-trip video is the marketing budget.** It is the only organic distribution
   channel this app can have, so it gets disproportionate polish.

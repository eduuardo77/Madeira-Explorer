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

1. **Show where you have been.** A dark, clean map of Madeira where travelled roads and
   levadas are highlighted and untravelled ones recede.
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

**Phase: Planning complete, pre-implementation.**

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
- ⬜ Field validation of GPS behaviour on levadas and tunnels — **not started**
- ⬜ Tile pipeline spike — **not started**
- ⬜ No code written

**All blocking decisions are now closed. Phase 0 can begin.** Current dependency cost: **$0**
(the only unavoidable spend is store fees — Apple $99/year, Google Play $25 one-time).

Nothing has been built yet. The next concrete step is **Phase 0 validation** (see
[PROJECT_PLAN.md](PROJECT_PLAN.md)), which is deliberately cheap and answers the questions
that would be expensive to get wrong.

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

**These documents are the source of truth, not conversation history.** They are updated as
decisions are made, not retrospectively. The maintenance protocol — which document to update
for which kind of change, and the conventions around stable IDs and superseding — is in
[CONTEXT.md §9](CONTEXT.md).

### Planned source layout

This is the intended structure once implementation begins. It is not yet created.

```
/
├── docs/                      # These planning documents (may move here later)
├── app/                       # Mobile application source
│   ├── src/
│   │   ├── recording/         # Location capture, batching, sensor fusion
│   │   ├── matching/          # Map matching, gap bridging, tunnel inference
│   │   ├── progress/          # Stamps, regions, scoring, confidence
│   │   ├── map/               # MapLibre integration, dark style, visited-road overlay
│   │   ├── souvenir/          # End-of-trip video and image rendering
│   │   ├── storage/           # SQLite schema, migrations, DAOs
│   │   ├── platform/          # iOS/Android-specific permission + lifecycle glue
│   │   └── ui/                # Screens (there are very few)
│   ├── ios/
│   └── android/
├── content/                   # ALL Madeira-specific data — never hardcoded in app/
│   ├── pois.json              # Curated places + geofence radii + stamp metadata
│   ├── regions.geojson        # Region boundaries for per-region progress
│   ├── levadas.geojson        # Levada corridors with entry/exit nodes
│   ├── tunnels.geojson        # Tunnel portals for gap inference
│   └── stamps/                # Stamp artwork
├── tiles/                     # Offline map pipeline
│   ├── pipeline/              # OSM extract → vector tiles with stable OSM IDs
│   └── style/                 # MapLibre style JSON (dark base, visited/unvisited)
└── tools/                     # Field-test loggers, trace replay, matching harness
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

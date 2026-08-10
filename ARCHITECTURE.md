# Architecture

System design for the Madeira Explorer app.

**Document date:** 2026-08-06
**Updated:** 2026-08-08 — §2 diagram corrected for D-022/D-026/D-027; status corrected.
**Status:** Design. **Partly implemented and wholly unverified** — the storage layer (§4) and
the recording subsystem (§2) exist in `app/src`, but no line of the app has ever executed on
hardware. Everything from §8 onward is unbuilt.

---

## 1. Architectural summary

A **fully offline, single-device, no-backend mobile application**.

There is no server. There is no account. No location data ever leaves the phone. The entire
island — map tiles, road graph, POI list, region boundaries, stamp artwork — is bundled or
downloaded once over WiFi, after which the app makes no network requests at all.

This is not primarily a privacy decision; it fell out of the battery and mobile-data
constraints, and the privacy position is a consequence. Because Madeira is geographically
bounded (~740 km²), shipping the whole island offline is practical in a way it would never be
for a global app. **The bounded scope is what makes the architecture simple.**

### The three load-bearing ideas

1. **Geofences are the backbone.** OS geofences are handled by the location coprocessor at
   near-zero battery cost, survive app termination and force-quit, tolerate poor GPS accuracy,
   and require no continuous location stream. They are simultaneously the cheapest,
   toughest, most fault-tolerant and most privacy-preserving mechanism available. The primary
   reward system therefore rides on them.

2. **Stamps are the score; road highlighting is decoration.** Because the user's reward comes
   from geofence-driven stamps, the fragile part of the system (map matching noisy GPS to
   individual road segments) is allowed to fail without destroying the experience. This is
   what makes the system degrade gracefully rather than catastrophically.

3. **Raw traces are the irreplaceable asset.** Matching is a separate, replaceable layer
   operating over stored raw data. Improving the algorithm later retroactively improves every
   user's history.

---

## 2. Component overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                          PLATFORM LAYER                               │
│  iOS: CoreLocation, CMAltimeter, CMPedometer, CMMotionActivity        │
│  Android: FusedLocationProvider, GeofencingClient, SensorManager,     │
│           ActivityRecognition, ForegroundService                      │
└──────────────────────────────┬────────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────────┐
│                        RECORDING SUBSYSTEM                            │
│  • Batched location capture (deferred / maxWaitTime)                  │
│  • Activity-gated sampling policy                                     │
│  • Barometer + pedometer capture                                      │
│  • Geofence manager (dynamic set, iOS 20-region cap)                  │
│  • Service health monitor                                             │
│  Writes: raw_fix, sensor_sample, geofence_event                       │
└──────────────────────────────┬────────────────────────────────────────┘
                               │  (append-only, immediate flush)
┌──────────────────────────────▼────────────────────────────────────────┐
│                      LOCAL STORE (SQLite, WAL)                        │
│  raw_fix │ sensor_sample │ geofence_event │ visited_segment │         │
│  stamp_award │ region_progress │ trip │ road_graph (+R-tree)          │
└───────┬──────────────────────────────────────────────┬────────────────┘
        │                                              │
        │ (burst, on idle/charge)                      │ (read)
┌───────▼──────────────────────┐          ┌────────────▼────────────────┐
│     MATCHING SUBSYSTEM       │          │      PROGRESS SUBSYSTEM     │
│  • Snap-to-segment           │          │  • Stamp award rules        │
│  • Altitude disambiguation   │          │    (dwell + speed gates)    │
│  • Hysteresis                │          │  • Region % computation     │
│  • Tunnel portal inference   │          │  • Confidence scoring       │
│  • Shortest-path gap bridge  │          │  • Trip lifecycle / end     │
│  • Levada corridor crediting │          │    detection                │
│  • Sensor-only fallback      │          └────────────┬────────────────┘
└───────┬──────────────────────┘                       │
        │  writes visited_segment                      │
        └──────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────────────┐
│                        PRESENTATION LAYER                             │
│  • MapLibre GL Native + offline PMTiles/MBTiles                       │
│  • Two styles over one tile pack: light for use, dark for the         │
│    souvenir (D-026). Figure-ground from shaded terrain.               │
│  • Visited-road overlay drawn from local road_graph geometry (D-022)  │
│  • Passport (stamp collection) view — by category (D-027)             │
│  • Souvenir renderer (9:16 video + still, on-device)                  │
│  • Accommodation masking filter                                       │
└───────────────────────────────────────────────────────────────────────┘

              NO NETWORK BOUNDARY EXISTS BELOW THIS POINT.
   The only network activity in the app's entire lifetime is the optional
        one-time tile pack download on first run, over WiFi.
```

---

## 3. Data flow

### 3.1 Steady state (the 99% case — app closed, phone in pocket)

```
Location coprocessor
   │  (buffers fixes; app is not running)
   ▼
Batched delivery wakes the app briefly
   │
   ├─► append raw_fix rows ──────────────┐
   ├─► append sensor_sample rows ────────┤──► SQLite (immediate flush, WAL)
   └─► evaluate geofence set ────────────┘
           │
           ├─ entered/exited region → append geofence_event
           └─ user moved far → reshuffle active geofence set
   │
   ▼
App returns to suspended. No rendering. No network.
```

The app is closed for essentially the entire trip. This is the design target, not a
degraded mode.

### 3.2 Deferred processing (burst, when idle or charging)

```
Unprocessed raw_fix batch
   │
   ▼
Segment the trace into movement bouts using activity type + speed
   │
   ▼
For each bout:
   ├─ snap fixes to road_graph (heading + speed + ALTITUDE + hysteresis)
   ├─ detect gaps
   │     ├─ both ends at tunnel portals?      → credit whole tunnel (certainty)
   │     ├─ inside a levada corridor?         → credit whole levada
   │     ├─ shortest path plausible for the
   │     │   elapsed time and speed?          → credit the route
   │     └─ otherwise                         → leave uncredited
   └─ write visited_segment rows with a confidence value
   │
   ▼
Evaluate geofence_event dwell + speed → award stamps
   │
   ▼
Recompute region_progress
```

### 3.3 The reveal (once, at trip end)

```
Airport / cruise-terminal geofence fires
   (fallbacks: left island bounding box; 24h+ no data)
   │
   ▼
Finalise trip: run any pending matching
   │
   ▼
Notification: "Your Madeira map is ready"
   │
   ▼  (user opens app — possibly for the first time since install)
Map renders with all visited_segment highlighted + passport populated
   │
   ▼
Souvenir renderer → 9:16 video + still
   │  (accommodation masking applied by default)
   ▼
Share sheet
```

---

## 4. Data model

Indicative schema. Not final; refine during Phase 1.

```sql
-- Immutable raw capture. Never edited, only appended. The irreplaceable asset.
raw_fix(
  id, trip_id, ts, lat, lon,
  accuracy_m, speed_mps, bearing_deg, altitude_m,
  activity_type,          -- still | walking | running | cycling | driving | unknown
  source                  -- gps | fused | significant_change | geofence
)

sensor_sample(
  id, trip_id, ts,
  pressure_hpa,           -- barometer: works in tunnels and under canopy
  relative_altitude_m,
  step_count_delta        -- pedometer: proves movement with no GPS
)

geofence_event(
  id, trip_id, poi_id, ts,   -- poi_id NEVER starts with `__`: that prefix is
                             -- reserved for mechanism regions, currently just
                             -- the geofence manager's `__anchor__` (D-033)
  event_type,             -- enter | exit | dwell
  accuracy_m
)

-- Derived, re-computable. Safe to wipe and regenerate from raw_fix.
visited_segment(
  osm_way_id,             -- join key into the vector tiles
  first_visited_ts, last_visited_ts,
  visit_count,
  confidence,             -- 0.0–1.0, stored, never shown to the user
  credit_method           -- direct | tunnel_inference | gap_bridge |
                          -- levada_corridor | sensor_fallback
)

stamp_award(
  id, trip_id,
  place_id,               -- the content pack's PLACE, not a geofence: a levada
                          -- owns two geofences and earns one stamp (D-034)
  awarded_ts,
  dwell_seconds, mean_speed_mps,
  confidence,             -- 0..1, stored, never shown (D-009, T-072)
  reason                  -- why, in words; makes a surprising stamp explicable
)                         -- UNIQUE(trip_id, place_id) makes the pass idempotent

region_progress(
  region_id,
  stamps_collected, stamps_total,
  segments_visited, segments_total,
  updated_ts
)

trip(
  id, started_ts, ended_ts,
  end_detection_method,   -- airport_geofence | left_bbox | inactivity | manual
  home_mask_lat, home_mask_lon, home_mask_radius_m   -- accommodation masking
)

-- Static, from the content pack (D-034). Not database tables: `content/pois.json` is
-- compiled into the bundle and parsed on first use by app/src/content/. A place owns
-- one or more geofences — two for a levada, a `start` and an `end` (D-009) — and the
-- geofence id is what `geofence_event.poi_id` holds.
--
--   place(id, name, category, regionId, geofences[])
--   geofence(id, role, lat, lon, radiusM)

-- Static, from content pack. Read-only at runtime. v2 (D-032).
road_graph(
  osm_way_id, geometry, highway_type,
  is_tunnel, tunnel_portal_a, tunnel_portal_b,
  region_id, length_m
)
-- + R-tree spatial index over road_graph bounding boxes
```

### Retention

Raw traces are retained for the life of the trip (see PROJECT_PLAN.md OD-6). A week of
fixes at batched sampling rates is a trivially small amount of data. Retention buys the
ability to re-run improved matching over history. A single "delete all my data" control is
the user-facing counterweight.

---

## 4a. Where user data physically lives

There is no server and no user account, but there **is** a database — a local one.

- **SQLite, as a single file in app-private storage.** Built into both platforms; nothing to
  install or run. The OS prevents other apps from reading it, and on iOS it is encrypted at
  rest via the Data Protection class above.
- **Size:** a full week of batched fixes plus sensor samples is roughly **1–5 MB**. Trivial.
- **Deleting the app deletes the data.** There is no server copy. This is the accepted cost of
  the privacy architecture (D-001), alongside no cross-device sync.

### Backup policy — get this right early

| Asset | Backup | Why |
|---|---|---|
| SQLite database | **Include** | The answer to "my phone died on day 5." Small, and it is the user's own irreplaceable data. |
| Tile pack | **Exclude** | Tens of MB, identical for every user, and re-obtainable. Backing it up wastes the user's iCloud/Google quota. |

**The tile-pack exclusion is not just politeness.** Android's auto-backup has historically
capped app data around 25 MB; a tile pack alone can exceed that, and exceeding it can cause the
*entire* backup to fail — silently taking the user's trip history with it. iOS uses an
`isExcludedFromBackup` resource flag; Android uses backup rules in the manifest.

Device backup only applies if the user has it enabled, which we cannot control and should not
nag about. It is a safety net, not a guarantee.

---

## 5. Key technical decisions

Full reasoning, including rejected alternatives, is in [DECISIONS.md](DECISIONS.md). Summary:

| Area | Decision |
|---|---|
| Backend | None. Zero-server architecture. |
| Map rendering | MapLibre GL Native |
| Tiles | PMTiles/MBTiles vector extract of Madeira **and Porto Santo** (D-021) — a dumb basemap carrying no visited state |
| Map styling | **Two styles over one tile pack** — light for in-app use, dark for the souvenir (D-026). Both derived by subtracting from an existing permissively-licensed style, not authored from scratch. Figure-ground from shaded terrain, not buildings. |
| Segment highlighting | **Overlay layer drawn from our own local `road_graph` geometry** (D-022), *not* feature state on basemap features — `setFeatureState` is not reliably available on MapLibre Native mobile |
| Location capture | `expo-location` (free) behind a swappable `LocationProvider` interface. Transistor Soft SDK is a paid contingency if soak tests fail (D-025). |
| Storage | SQLite + WAL + R-tree spatial index |
| Reward backbone | OS geofences with dynamic set management |
| Framework | **React Native + Expo, TypeScript** (D-023) |
| Map bindings | `@maplibre/maplibre-react-native` v11 — API mirrors the MapLibre GL JS style spec |
| Analytics | None |
| Crash reporting | Local only, uploaded only on explicit user action, if at all |

---

## 6. Platform-specific behaviour that shapes the design

These are not implementation details; they are constraints that determined the architecture.

### 6.1 iOS

- **Region monitoring and significant-location-change relaunch a terminated app, even after
  the user force-quits it from the app switcher. Standard continuous background location
  updates do not.** This single fact is why geofences are the backbone and continuous
  updates are only an enrichment layer.
  *Verify against current Apple documentation before implementing — this behaviour has been
  stable for years but Apple adjusts it.*
- **Maximum 20 simultaneously monitored regions.** With 150–250 POIs, the geofence set must
  be managed dynamically: register roughly the nearest 18, plus one large "you have left this
  area" region whose exit triggers a reshuffle. This is painful to retrofit, so it is
  designed in from the start.
  **Implemented 2026-08-10 (T-039); the selection rule and its three unmeasured constants are
  D-033.** Two invariants a future change must not break: places are ranked by *edge* distance
  (centre distance minus their own radius), and the anchor region is registered under the
  reserved id `__anchor__` and never written to `geofence_event`.
- **"Always" location cannot be requested up front.** The flow is While-Using first, then
  escalate. iOS then periodically shows the user a map of everywhere the app has tracked
  them and asks whether to continue — which reads as a security warning to a non-technical
  user and is a major cause of revocation. Detect downgrades and recover gently.
- Deferred location updates let the chip buffer fixes without waking the app.
- Data Protection class must be `CompleteUntilFirstUserAuthentication`. Full `Complete` will
  fail, because the app needs to write while the device is locked.
- `PrivacyInfo.xcprivacy` manifest is required, including for third-party SDKs.

### 6.2 Android

- **OEM battery managers (Xiaomi, Huawei, Samsung, Oppo, OnePlus) kill background work
  regardless of the official APIs.** A foreground service with a persistent notification
  survives far better. This mildly dents the "ghost" feeling but is the honest trade, and
  users stop noticing the notification within an hour. Also request a battery-optimisation
  exemption.
- `FusedLocationProvider` with `setMaxWaitTime` gives batched delivery — the single largest
  battery win available.
- Android 14+ requires declaring the `FOREGROUND_SERVICE_LOCATION` type.
- Background location cannot be requested inline on Android 11+; the user must be sent to a
  system settings screen. A prominent-disclosure screen is required beforehand.
- **Google Play reviews background-location apps manually and rejects many.** A demonstration
  video and written justification must be submitted. Re-review cycles are slow.
- Geofence limit is around 100, but the dynamic set management built for iOS covers this
  anyway.

---

## 7. Battery strategy

The mistake to avoid is a continuous high-accuracy GPS stream. **We do not need real-time
position — we need the trace.** That distinction is the whole strategy.

| Technique | Effect |
|---|---|
| Batched delivery (deferred updates / `setMaxWaitTime`) | The chip buffers fixes and wakes the app every few minutes instead of every second. **Largest single win.** |
| **Stationary-vs-moving gating** (D-028) | Stationary → near-zero. This is where nearly all the saving lives: a tourist sleeps eight hours and sits in restaurants and their accommodation for several more. Derived from distance over time — no extra sensor, no platform asymmetry. Walking-vs-driving is deferred (T-034a); the pedometer classifies but never gates. |
| Geofences over polling | Handled by the coprocessor; effectively free. |
| Burst matching | Map matching runs over a buffered batch when idle or charging, never per-fix. |
| Never render in background | The map is only drawn when the user is looking at it. |
| Offline tiles | No radio wake-ups for network requests. |
| Barometer / pedometer | Dedicated low-power sensors; far cheaper than GPS and they work where GPS does not. |

**Target:** low single-digit percent per day, versus 10–20% per hour for naive continuous GPS.

Worth remembering: once the app is *open*, screen and map rendering typically cost more than
the GPS does. The design goal is that the app is closed almost always — a passive recorder
with one viewing session at the end.

---

## 8. Low-signal matching strategy

Madeira is close to the worst case for GPS map matching. This subsystem is designed around
that, with an explicit bias toward false positives.

### The governing rule

> **Be generous filling in gaps between things you are certain about.
> Be strict about what you are certain about.**

Credit the connection; verify the endpoints. A missed levada causes an uninstall. A stamp
that fires when you merely drive past a trailhead makes the entire collection worthless.

### 8.1 Tunnels

Madeira has well over a hundred road tunnels, and the VR1/VE1 expressway is substantially
underground. GPS simply stops. But tunnels are tagged in OSM (`tunnel=yes`) and both portal
locations are known. **A fix at portal A followed by a fix at portal B within plausible
travel time is a certainty, not a guess** — there is no way to be at both without having
gone through. Credit the entire segment.

### 8.2 Vertically stacked roads

The VR1 expressway runs above or below the older ER101 coastal road in many places.
Nearest-segment matching will confuse them constantly. Mitigation: include **altitude** in
the matching cost function (barometer-derived, more reliable than GPS altitude), plus heading
and speed, plus hysteresis so the match does not flicker between candidates.

### 8.3 Levadas

Levada walks are the defining Madeira activity, and they are the *most* forgiving case
despite the worst GPS conditions.

- They are in OSM as `highway=path`, so they must be included or the app misses the point of
  the island.
- GPS under Laurissilva canopy is poor, and several levadas run through their own tunnels.
- **But levadas are linear with no mid-route exits** — a canal with a path beside it. You
  cannot leave one in the middle. Therefore: **trailhead + exit point credits the entire
  walk**, no per-point matching required.
- Use a wide match corridor for paths (50–75m versus 15–25m for roads). Canopy error is
  large, but there is nothing nearby to confuse the path *with*, so the wide corridor costs
  no real accuracy.

### 8.4 Sensor fallback

Two sensors that are almost free and work where GPS does not:

- **Barometer** — most phones have one, it runs on a low-power chip, and it works in tunnels
  and under canopy. On Madeira, elevation is enormously discriminating: it separates the VR1
  from the coastal road below it and unambiguously identifies a levada climb.
- **Pedometer** — also a dedicated low-power chip, also GPS-independent. If GPS dies at a
  trailhead and the step counter records 9,000 steps over the following two hours, the user
  kept walking.

No true inertial dead reckoning is required. **Known start + known end + step count +
elevation profile** is enough to confidently credit a levada with essentially no GPS in the
middle.

### 8.5 Where to stay strict

Stamps require **dwell time and plausible speed**. Inside the geofence for N minutes at
walking pace = awarded. Passing at 60 km/h = not awarded. That single rule is what keeps the
collection meaningful.

### 8.6 Confidence scoring

Every credited segment and stamp stores a confidence value. It costs one column, is never
shown to the user, and allows every threshold above to be retuned against real trip data
later without re-collecting anything.

---

## 9. Privacy architecture

The strongest privacy position available is not careful handling of data — it is **never
receiving it**.

- **No backend, no account, no sync, no analytics, no ads.** GDPR obligations collapse to
  almost nothing when nothing is transmitted. A privacy policy is still required by both
  stores; it can be very short.
- **Offline tiles are a privacy feature, not just a battery one.** A normal map app leaks
  position to a tile server on every pan and zoom — tile coordinates plus IP address *is*
  location data sitting in someone else's logs. This app never makes the request.
- **Dependency audit is the real risk surface.** Firebase Analytics, Crashlytics, Sentry,
  attribution SDKs and ad networks routinely collect coarse location or IP by default. That
  is how these apps actually leak, usually unintentionally. **Target: zero networked
  dependencies.** Any crash reporting must be local, uploaded only on an explicit user tap.
- **Storage:** app-private SQLite, WAL mode, iOS Data Protection
  `CompleteUntilFirstUserAuthentication`, Android internal storage, optionally SQLCipher.
- **Backups:** the database *should* participate in the normal encrypted device backup. That
  is the answer to "my phone died on day 5," and it costs nothing in privacy terms. **But the
  tile pack must be excluded from backup** — see §4a.
- **Anti-features protect us.** No sharing of live location, no leaderboards, no friends, no
  accounts. Every social feature would create a new privacy surface.

### The one genuine residual risk

**The souvenir video is an export of location history.** A trace that returns to the same
house every night publishes the user's accommodation to Instagram. Mitigation, on by
default: detect the most frequent overnight location and mask a radius around it in all
exports, or trim the first and last stretch of each day. Cheap to build, and exactly the
kind of detail that earns trust.

---

## 10. "Ghost app" resilience

The value proposition is *install, forget, be delighted later*. If tracking dies silently on
day 2, the reveal on day 7 is a disappointment and we have done worse than nothing.

**The enemy is the OS, not the user.** Design for OS-resilience, not user absence.

| Threat | Mitigation |
|---|---|
| Android OEM process killers | Foreground service + battery-optimisation exemption + honest gap reporting |
| iOS background termination | Geofences and significant-location-change survive it, including after force-quit |
| iOS Always → While-Using downgrade | Detect and prompt gently |
| Crash or storage failure | Incremental flush on every batch; a crash costs seconds, not days |
| Silent total failure | Day-1 self-check, 12–24h after install |

### The two notifications

Exactly two in a normal week, despite the ghost framing:

1. **Day 1 health check** (12–24h after install). If recording is working: one quiet
   confirmation. If it is not, that is the one moment worth interrupting them, while there
   are still six days to fix it.
2. **The reveal**, at trip end.

Two messages in seven days is not intrusive. It is the difference between a delightful
surprise and a silent failure discovered too late to do anything about.

### Honesty about gaps

If an OEM killed the service for three days, the app must not pretend otherwise. Show what
was actually recorded. Gap-annotated data is trustworthy; fabricated continuity is not.

### Trip-end detection

Airport geofence is the primary mechanism. Madeira has essentially one airport, plus Porto
Santo and the Funchal cruise terminal. Fallbacks: leaving the island bounding box, or 24h+
without data.

The departure lounge is the single best moment in the entire product — the user is sitting
with nothing to do and a head full of the trip they just had. It costs almost nothing to
build and should be treated as a headline feature.

---

## 11. Assumptions

Stated explicitly so they can be checked and, where wrong, corrected early.

### Validated by prior art (low risk)

- Street-level OSM matching with regional % scoring is proven — Wandrer.earth, CityStrides.
- Fog-of-war exploration mapping ships and retains users — Fog of World.
- Passive trip tracking with a beautiful end-of-trip artefact is a real product —
  Polarsteps.
- Offline maps with trail data at scale work — AllTrails, Wikiloc.
- Street-coverage tracking with a passive recorder ships as a solo-developer app — **WalkNYC**
  (Joe Puccio, iOS). Reviewed 2026-08-08; see `docs/design-brief.md` §6. Useful mostly as a
  source of **observed failure modes** rather than validation: a `0.00%` hero number (the exact
  outcome D-002 rejected), a modal begging users not to force-quit (the problem D-005 avoids
  architecturally), a 22-minute walk credited zero (the D-009 uninstall case), and 20%/day
  battery at the setting that reliably catches walks. Its badge system is still unshipped.

**Caveat:** each of those solved *one* of our three problems. Wandrer and CityStrides never
touch the user's battery — they piggyback on Strava's recording and do all matching
server-side. Fog of World records but does not street-match. Polarsteps records only
coarsely. **Nobody does on-device recording + on-device street matching + offline rendering
simultaneously.** The components are proven; the integration is genuinely new work.

### Unvalidated (must be checked in Phase 0)

- Barometer stays usable inside tunnels and under canopy.
- Altitude reliably distinguishes the VR1 from the coastal road below it.
- Pedometer keeps counting through GPS blackouts.
- ~~Stable OSM way IDs survive the tile pipeline into runtime.~~ **No longer load-bearing as
  of D-022** — the overlay is drawn from our own local geometry, so runtime addressing of tile
  features is not required. IDs remain useful as an internal join key only.
- The tile pack is small enough for a hotel-WiFi download.
- ~~OSM levada coverage is complete enough to build on.~~ **Answered 2026-08-08 (T-028, D-029) —
  yes.** 3,981 ways named `Levada*`, 1,386 of them walkable, 108 levada tunnels, and 44 official
  PR routes already in OSM. **Still unvalidated: whether it is *accurate* enough** — corridor
  connectivity, tunnel portal-node precision, and whether the PR relations are current. Counts
  cannot answer that; fieldwork can (T-028a). Measurements in `docs/osm-coverage.md`.
- Batched location on real devices actually achieves the target battery figures.

### Product assumptions (accepted risk)

- A curated canvas of 150–250 places produces visible daily progress over a 7-day trip,
  where island-wide road coverage would not.
- The souvenir video is compelling enough to drive organic installs. **This is the entire
  distribution strategy** — there is no fallback if it fails.
- Tourists will grant background location if asked at the right moment with a clear reason.
- An 80-year-old will use a passive tracker at all. (The accessibility constraint is better
  read as "no learning curve for anyone" than as a demographic target.)

### Environmental assumptions

- Madeira is ~740 km², making full offline bundling practical.
- Mobile coverage in the north and interior is poor — reinforcing offline-first.
- Madeira tourism is heavily rental-car based and includes an unusual number of repeat
  visitors, which quietly mitigates the slow-fill problem: year two, they return to a
  partly-lit map.

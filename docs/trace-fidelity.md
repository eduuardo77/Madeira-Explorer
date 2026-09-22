# Why the drawn trace looks wrong, and what a proper fix is

**Written:** 2026-09-22. **Status:** research, feeding **D-082 (Provisional)**.
**Prompted by:** the project lead, looking at the running app — *"sometimes the app makes lines in
random places which looks a bit odd. I want the app to only highlight the real roads."*

This is the costing behind that request. It is deliberately not a plan: the last tier of it
touches D-032, which is Accepted, and that is the project lead's to move.

---

## 1. Four separate causes, and only one of them is what was asked about

The request reads as one problem — *the line is not on the road* — but there are four mechanisms
producing it, they have wildly different costs, and **three of them are fixable without going near
map matching.**

| | Cause | Kind | Cost |
|---|---|---|---|
| **A** | The map never calls the cleanup that exists | **Bug** | One line |
| **B** | The renderer's joint geometry amplifies what is left | **Rendering** | Small, needs a test |
| **C** | A 4 pt hairline claims a precision GPS does not have | **Design** | Small, needs a decision |
| **D** | Nothing snaps the trace to a path | **Scope (D-032)** | Large |

Only **D** is the thing D-032 deferred. A, B and C are all inside v1 scope and together they are
most of what the eye is objecting to.

---

## 2. Cause A — the cleanup is written, tested, and not wired in

`traceCleanup.ts` removes spikes, collapses standing-still scribble and simplifies jitter. It has
its own test file. **The map screen does not call it.**

- [`NativeMapScreen.tsx:326`](../app/src/map/NativeMapScreen.tsx) calls `splitIntoSegments` — raw.
- The cleaned entry point is `drawableSegments` ([`traceGeoJson.ts:314`](../app/src/map/traceGeoJson.ts)).

**How it happened.** `10fa42a` (Aug 14) wrote the Google screen against `splitIntoSegments`.
`98796d8` (Aug 16, T-150/D-066) added the cleanup and wired it into `buildTrace` — and the screen
calling `buildTrace` at that moment was the MapLibre one, which is now in `app/attic/` and still
calls it today. The cleanup shipped into the retired screen, the souvenir card
([`shareTrip.ts:75`](../app/src/souvenir/shareTrip.ts)) and every preview tool. Not into the live map.

**This is the T-145 shape.** No test covers `NativeMapScreen`, so 619 passing tests cannot see it.

**What still runs on the map today:** the accuracy filter, the gap break, and the impossible-jump
break. That last one only fires above **250 m *and* 55 m/s** — so a fix 150 m off the path, 20 s
from its neighbours, implies 7.5 m/s, trips nothing, and is drawn in full as a V out and back.

Measured on `tools/routes/funchal-seafront.txt`:

| | Drawn length | Worst error | Vertices |
|---|---|---|---|
| Raw — **what the phone draws** | 4.49 km | **151 m** | 211 |
| Cleaned — what the souvenir draws | 2.55 km | 20 m | 35 |
| *(true walk)* | *2.23 km* | — | *181* |

⚠ **Modelled noise, not measured** (T-018 is still open). Judge the shape, not the digits.

---

## 3. Cause B — the renderer turns a small error into a big spike

`expo-maps@57.0.1` builds its polyline in
`android/src/main/java/expo/modules/maps/GoogleMapsView.kt:158`, passing **only** `points`,
`color`, `geodesic`, `width`, `clickable`, `onClick`. It never sets `jointType`, `startCap`,
`endCap`, `pattern` or `zIndex`, so all of those take the Maps Compose defaults — which are
**miter joints** and **butt (square) caps**.

A miter joint's spike length is `width / (2·sin(θ/2))`, where θ is the interior angle. Counting
interior angles on the same route:

| | Vertices | Corners under 60° | Corners under 30° | Sharpest |
|---|---|---|---|---|
| Raw — **what the phone draws** | 211 | 46 | **27** | **1.3°** |
| Cleaned | 35 | 4 | 2 | 9.7° |

A 1.3° corner on an 11 px line mitres to roughly **480 px** — most of the screen height — from a
vertex that may be only a few metres off the path. There are **27 of them in one modelled walk.**

⚠ **This is a strong hypothesis, not a measurement.** Whether Google's renderer applies a miter
limit is not documented and was not tested here. If it does (typically ~4×), the spikes are ~44 px
instead of ~480 px — still 27 visible barbs on a line that should be smooth. **The cheap test is one
emulator screenshot of a deliberately zigzagged fixture**, and it is worth taking before any of
this is designed around.

Either way the conclusion is the same and it is the useful part: **fixing A also fixes most of B**,
because Douglas–Peucker at 16 m takes the near-reversals from 27 to 2. The two are one job.

**Butt caps** are the smaller sibling of the same problem: every broken stroke ends in a flat
square edge. Google's own route line uses round caps. It reads as unfinished, and it cannot be
changed from JS.

---

## 4. Cause C — a hairline is a claim of precision

This is the one that matters most for *"professional and clean"*, and it is not a bug.

A 4 pt crisp line says **you were exactly here.** GPS gives ±5–20 m under open sky and much worse
under laurel canopy, which is the app's signature terrain. So every metre of real error is drawn as
a visible mistake, and the mark's own confidence is what makes it look broken.

A wider, softer, translucent band says **you were along here** — and the identical error now falls
*inside* the mark. Nothing has been faked; the drawing has simply stopped claiming more than the
instrument delivered. It is also the honest rendering of what the data is, which is the same
instinct as `traceCleanup.ts`'s rule against moving a point.

⚠ This pulls against `traceStyle.ts`, where the trace is *"the one saturated, heavy thing on the
map"*, and against design-brief §2.3's *"unambiguously the brightest thing on screen"*. Those were
written about **weight and contrast**, not about sharpness, and a 12 pt band at 40% alpha can be
heavier and more dominant than a 4 pt hairline while being far more forgiving. But it is a visual
change to a measured design and it is judged by eye, which this project has none of — so it goes to
the workbench and the project lead, not into `app/`.

---

## 5. What the renderer can actually do — the constraint that shapes every option

Read out of `Records.kt` and `GoogleMapsView.kt` at the installed version:

| Capability | Available? | Consequence |
|---|---|---|
| Colour **with alpha** | ✅ `CircleRecord`'s default is `0x7F0000FF` — alpha is expected | Translucent bands and faint bridges are possible |
| Width | ✅ | ⚠ in **pixels**, not points |
| Geodesic | ✅ | Irrelevant at island scale |
| **Dash pattern** | ❌ not passed | **Dashed bridges are not implementable** |
| **Joint type** | ❌ not passed | Miter spikes, §3 |
| **Caps** | ❌ not passed | Square stroke ends |
| **zIndex** | ❌ not passed | Order is array order only |

⚠ **And one known bug gates three of the options at once.** `NativeMapScreen.tsx:156` records that a
casing was tried as two polylines and *"rendered wrong on the device anyway"* — one segment came out
as a bare casing with a hairline core — most likely `expo-maps` binding polyline updates **by array
position rather than by `id`**. That note is from 14 August. If it is fixed in 57.0.1, then the
**casing**, the **translucent band under a core**, and **faint bridges as their own strokes** all
become available together. **One emulator test settles all three.** That is the highest
value-per-minute experiment in this document.

**The dashed-bridge idea recorded in `traceGeoJson.ts:112` as belonging to the project lead is
therefore not currently buildable.** The nearest available thing is the same stroke drawn faint —
which needs the layering question above answered first.

---

## 6. Cause D — matching, and the Proa-shaped version of it

D-032 defers island-wide matching and its reasoning holds: T-082 alone is ~51,000 highway ways plus
16,066 footways, in service of something D-002 calls decoration. Nothing here argues with that.

But there is a version D-032 never considered, because it did not exist yet.

### The insight: curate the matching graph, the way D-002 curated the canvas

**The app already ships the geometry of eleven levadas.** `content/levadas.json` — real OSM way
geometry, extracted at build time by `tools/build-levadas.mjs`, drawn in green whenever a levada
card is open. The road graph D-032 priced is not needed to snap a trace to *those*.

| | General matching (T-082–T-085) | Snapping to shipped levada courses |
|---|---|---|
| Graph | ~51,000 ways, needs an R-tree | **11 polylines, already on the device** |
| Ambiguity | VR1 stacked over ER-101, hysteresis (T-084) | ⚠ **Essentially none** — see below |
| New data | Import pipeline, storage, schema | **None** |
| Where it helps | Everywhere, a bit | Exactly where it looks worst and matters most |

**Why the ambiguity disappears.** What makes general matching hard is parallel candidates — a
levada does not have them. It runs along a contour on steep ground; within 40 m of one, at walking
pace, there is usually nothing else you could physically be on. The hard case (T-084) is two roads
vertically stacked, and levadas are not that.

**And it fixes the worst-looking case.** Under laurel canopy is where GPS is worst, where the app's
signature walks are, and where the wobble currently looks most broken. It would put the blue trace
exactly on the green course the app already draws — which is the "professional" picture being asked
for, on the screen where it counts.

⚠ **Two objections, and both are real.**

1. **It moves a point.** `traceCleanup.ts`'s one rule is that every surviving point is a position
   the device actually reported. Snapping breaks that rule and it must not be smuggled in — it
   belongs in its own module, applied at draw time only, with D-010's raw rows untouched. The
   mitigating argument is that a polyline **already** draws positions nobody observed: the straight
   segment between two fixes is interpolation. The question is only what shape that interpolation
   takes. That is an argument, not a licence.
2. **It is confidently wrong when it is wrong.** D-032's rejected alternative — *"a visibly wrong
   highlighted road is worse than an honest trace"* — applies with full force. It needs a
   confidence gate: snap only within a tight corridor, only at walking pace, only when a run of
   consecutive fixes agrees. Otherwise draw raw.

⚠⚠ **And it cannot be validated today.** `tools/fixtures/` is empty until T-018. There is no
recorded levada walk to test a snapper against, so any corridor width chosen now is a guess of
exactly the kind this project has been burned by. **This is the blocker, and it is cheap to
remove:** the project lead has an iPhone and Sensor Logger, `tools/import-sensor-logger.mjs` is
built and waiting, and one walk on one levada produces the fixture.

---

## 7. What Strava does, since it was asked

Mostly, **they do not snap.** A Strava activity map is raw recorded GPS — which is why Strava
traces wobble, cut corners and drift through buildings on a far larger engineering budget. They made
the same call D-032 did. What they do instead:

- **Cleanup and filtering**, roughly `traceCleanup.ts`'s job. Elevation is the exception: device
  altitude is discarded and re-derived from a terrain model, because both barometric and GPS
  altitude are bad.
- **Segment matching** — the trace matched against a curated library of pre-drawn segments for
  leaderboards. ⚠ **This is Proa's stamps**, and it is the same architecture: reward from matching
  against a known curated set, never from matching the whole network. D-002 and §2.1 arrived here
  independently.
- **Route builder** snaps to the network — but that is *planning*, where you draw on the graph and
  there is nothing to match.

Their recorded-activity pipeline is not published in detail, so treat the internals as inference;
the observable behaviour is not in doubt.

**Where snapping is done** the technique is HMM map matching — Newson & Krumm 2009, still standard:
candidate segments per fix, emission probability from reported accuracy, transition probability from
route-distance versus straight-line distance, Viterbi for the likeliest path. Open: Valhalla's Meili,
OSRM `match`, GraphHopper. Hosted: Mapbox Map Matching, Google Roads API.

⚠ **Google's Roads API is a trap for this app specifically.** It snaps to the **road** network.
Caldeirão Verde's nearest road is the ER-101, several hundred metres away and several hundred
metres below. It would take the walks the app exists for and place them confidently, spectacularly
wrong — D-032's rejected alternative with a Google logo on it. It also means POSTing the user's
whole trace to an endpoint, against D-001 and everything §2.5 buys.

---

## 8. Recommendation

**Tier 0 — do now, uncontroversial.** Wire the map to `drawableSegments`, plus a guard test in the
shape of `freeTier.test.ts` so it cannot silently come unwired again. Identical signatures; one
import and one call site. Fixes A, and most of B with it.

**Tier 1 — one emulator test, then a design call.** Screenshot a deliberately zigzagged fixture to
settle the miter question (§3), and re-test the two-polyline binding bug (§5). If layering works,
the casing, a translucent band and faint bridges all open up at once. Then the project lead judges
the band-versus-hairline question (§4) in the workbench.

**Tier 2 — blocked on one walk.** Levada snapping (§6) is the answer to *"only highlight the real
roads"* that fits inside Proa's architecture instead of fighting it. It should not be built against
guessed thresholds. **One Sensor Logger recording of one levada unblocks it**, and that same
fixture is the thing T-018, T-019, T-020 and T-021 have all been waiting on.

**Not recommended:** general map matching (D-032 stands), and the Google Roads API (§7).

---

## 9. What this document changed

- **D-082**, Provisional, in `DECISIONS.md` and `docs/decisions-full.md`.
- **T-167 … T-170** in `TASKS.md`.
- Nothing in `app/` yet.

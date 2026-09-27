# The highlighted lines on the map: the problem, for a fresh look

**Written 2026-09-27** at the project lead's request, to open the question in a new chat. It
collects what is known, what was measured, what is fixed, and what is still open. It is a brief
for research, not a decision. Nothing here changes the app.

**How to start the new chat:**

> Read `HANDOFF.md`, then `docs/map-lines-problem.md` in full. We are researching the map's
> highlighted lines. Do not change the app until we decide.

---

## 1. The problem, in the project lead's words

- 2026-09-22: *"sometimes the app makes lines in random places which looks a bit odd. I want the
  app to only highlight the real roads which you can see on Google Maps."*
- 2026-09-26: *"the highlighted lines are just random and not on the street. I've pointed this
  problem several times."*

**Why it matters more than decoration.** The product's core value is *where you have been*: the
lit-up roads are the thing people keep (see the memory note on the core value, and D-071). The
Play short description chosen on 2026-09-26 promises it outright: *"Every road you walk or drive
in Madeira, highlighted. See where you've been."* Today the app does not do that.

---

## 2. What the map draws today

The map does **not** draw roads. It draws the phone's own GPS positions, joined by straight
lines, after a cleanup:

```
raw_fix (database)
  → rawFixDao.getTraceFixes(trip)                 every stored fix of the trip on show
  → splitIntoSegments   (map/traceGeoJson.ts)     drops fixes worse than ±120 m;
                                                  breaks the line on a 30 min silence,
                                                  an impossible speed (> 55 m/s),
                                                  or a step longer than 500 m (T-244)
  → cleanTrace          (map/traceCleanup.ts)     rejectSpikes: median of 4 either side,
                                                    a fix ≥ 50 m (or 2× its accuracy) off
                                                    AND implying > 2.5 m/s out and back
                                                  collapseStationary: ≥ 3 fixes within 25 m
                                                    for ≥ 2 min become one point
                                                  simplify: Douglas-Peucker, 16 m
  → expo-maps polyline on Google's map (NativeMapScreen.tsx)
```

`drawableSegments` is the entry point (the map and the share card use it). **Every surviving
point is a position the phone actually reported**: `traceCleanup.ts` never moves a point, on
purpose. So a line can only ever be as close to the street as the GPS was, and between two points
it is always a straight segment.

⚠ **The replay film is different:** `souvenir/composition.ts` gives the film **raw** fixes
through `splitIntoSegments`, without `cleanTrace`. The film therefore draws every wobble. Noted
on 2026-09-26, not changed.

---

## 3. What was measured (2026-09-26, on the P30's real data)

Method: the map's own `drawableSegments` run in Node over copies of the phone's database, kept
outside the repository (real movement must never be committed: D-016, D-040). Distances only.
Full numbers in `docs/field-notes.md`, section *2026-09-26*.

### Cause 1: lines around a phone that did not move (NOT fixed)

The P30 lay on a desk from 22 to 25 September.

| Stretch | Fixes | Where they really were | What the map drew |
|---|---|---|---|
| 22 Sep 20:11 → 23 Sep 14:08 | 4,340 | 90% within 3 m of the phone | **18 points, 0.8 km of lines**, up to 109 m out |
| 24 Sep 19:47 → 25 Sep 13:31 | 2,285 | 90% within 1 m | **7 points, 0.3 km of lines**, up to 57 m out |

The cleanup collapses the honest cluster into one dot and draws **the rest**. The rest is not a
few lone spikes. Sampled every 7 to 12 s, the position **drifts smoothly** 20 to 110 m away over
several minutes and comes back, with a reported accuracy of about ±5 m. For example, metres from
the phone, one fix after another: 23, 29, 34, 39, 44, 38, 27, 20, 12.

**Why no simple rule removes it:** by position, speed and accuracy that is exactly what walking
slowly looks like. A rule that deletes it also deletes real slow movement.

⚠ A first fix (absorb lone strays into a stop) passed its own tests and changed nothing on the
real data, because the real strays are not lone. It was reverted. The test model was wrong, which
is the project's standing lesson: check the measurement moves.

❓ **Open fact:** was the phone carried on the evenings of 22 and 24 September, or did it stay on
the desk? If it stayed, this is indoor GPS drift (multipath). If it was carried, part of it is
real movement inside a house or garden, which is also "not on the street".

### Cause 2: straight lines across holes (FIXED, T-244, not yet on the phone)

When the recorder misses a stretch without a long silence, two far-apart fixes were joined by
one straight stroke across the mountains. On the August loan trips: **4.0 km in 2.3 min** (a
tunnel, or the OS starving the app of fixes) and **3.2 km in 5 min**. Both passed the 30-minute
rule and the 55 m/s rule.

`MAX_DRAWN_STEP_M = 500` now breaks the line there (the driving profile's honest step is about
420 m: 15 s at 100 km/h). Longest stroke on those trips: **4,084 m before, 862 m after**; what is
left over 500 m is simplified straight stretches, each within 16 m of recorded fixes.

⚠ **The trade-off, pinned by a test:** a drive the recorder starved (fixes kilometres apart) is
now a **gap** instead of straight chords. A normally sampled drive is still one line.

### Cause 3: do dense fixes sit on the street? (NOT measurable yet)

**No real movement on Madeira has ever been recorded on this phone.** The August loan trips were
not on the island (none of their 176 fixes is inside the bounds), and the one drive on
2026-09-26 (Praia dos Reis Magos) was lost to the recorder bug T-242, now fixed. When fixes did
arrive in August they were dense (every 3 s, 60 to 100 m apart, ±3 to 4 m).

**This is the first thing the next real outing should answer.** The road geometry needed is
already in the project and readable offline (§6), so it can be measured without sending a single
coordinate anywhere.

### Two causes recorded earlier (`docs/trace-fidelity.md`)

- **Fixed 2026-09-22 (T-167):** for a month the map drew the *uncleaned* trace.
- **Not fixed (T-168):** Google's polyline uses **miter joints**, so a sharp corner in the line
  can render as a long spike. A strong hypothesis from the code, never seen on a screen.

---

## 4. Where the decisions stand

| | What it says | Status |
|---|---|---|
| **D-032** | Map matching (snapping to roads) is **deferred out of v1**: ~51,000 road ways plus 16,066 footways, for something D-002 calls decoration. *"A visibly wrong highlighted road is worse than an honest trace."* | Accepted, long ago |
| **D-082** | Clean the trace (done), give the line an honest weight (T-169, not done), snap **only to the levada courses already shipped** (T-170, blocked on a recorded levada walk). General road matching and Google's Roads API rejected. | ⚠ **Provisional**, never confirmed by the project lead |
| **D-082 note, 2026-09-26** | Measured: what the lead objects to is mostly cause 1 and cause 2. Levada snapping helps neither. | Recorded |

**The tension to resolve:** D-032 treats the lit-up roads as decoration; the product, the core
value and the store listing now treat them as the point.

---

## 5. What "fixed" could mean, and what each costs

These are directions to research, not recommendations.

| Direction | What the user would see | Solves | Big questions |
|---|---|---|---|
| **A. Keep the GPS line, tidy harder** | The phone's own path, wobbles and all | Some of cause 1 at best | No position-only rule separates drift from slow walking (§3). Motion sensors could (below). |
| **B. Motion-gated drawing** | Nothing drawn while the phone says it is still | Most of cause 1 | Android's activity recognition or step counter needs the `ACTIVITY_RECOGNITION` permission on Android 10+: a new prompt and a privacy-policy line. The pedometer capture exists but is off (D-050). |
| **C. Snap to roads and paths, on the phone, offline** | Real streets and paths light up where you went; nothing where no street matches | Causes 1, 2 and 3, and the listing's promise | Reverses D-032. Data size on the phone, a matching algorithm (commonly a hidden Markov model, Newson and Krumm 2009), stacked roads (VR1 over ER-101), tunnels, walks off the network, levadas. Draws roads rather than GPS: a different honesty contract. |
| **D. Snap with Google's Roads API** | Same as C | Same as C | Rejected in D-082: sends the trace to Google, costs per request, needs the network, and snaps a levada walk to the nearest road hundreds of metres away. |
| **E. Snap only to levadas (D-082 tier 2)** | Levada walks on their course | The signature walks only | Blocked on one recorded levada walk to set thresholds. Does nothing for roads or drift. |

---

## 6. Constraints any answer has to live with

- **The renderer** (`expo-maps` polylines): only points, colour (alpha works), width in pixels
  and geodesic. **No dash pattern, no joint type, no caps, no zIndex** (`GoogleMapsView.kt:158`).
  A casing drawn as two polylines once rendered wrong on the device. `docs/trace-fidelity.md` §5.
- **No Madeira knowledge in `app/` (D-017, absolute).** Road or path data would ship as content,
  like `content/levadas.json` (18 courses today), built by a tool in `tools/`.
- **Offline data already in the project:**
  - `app/assets/map/madeira.pmtiles`: OpenStreetMap vector tiles of the island (from the old
    offline map), zoom 0 to 15, with a `roads` layer (each feature has a `kind`). On 2026-09-26 a
    throwaway Python reader over `tools/mvt-preview.py`'s decoder read it locally: 609 road
    features in one zoom-14 tile of central Funchal.
  - `tiles/src/portugal-latest.osm.pbf`: the full OpenStreetMap extract for Portugal, Madeira
    included, and `tiles/src/planetiler`.
- **Privacy:** real traces never leave the phone except as a masked share (D-016, D-040). Research
  on real data happens on copies outside the repository (`Madeira-fieldwork/`).
- **Honesty rules:** never state a measured-sounding number that was not measured; the thresholds
  in `traceCleanup.ts` are all marked as not tuned against real GPS.
- **The phone:** the P30 (Android 10, EMUI), with a store field build since 2026-09-26 19:07 that
  has the recorder fix (T-242). `run-as` works, so its database can be pulled after an outing
  (`docs/dev-build.md`).

---

## 7. Questions for the research chat

1. **Product:** what exactly should light up: the GPS line, the matched street, or the matched
   street *segment by segment* (a street lights up once you have used it)? What happens where
   you walked with no street (a beach, a square, a levada, a garden)?
2. **Evidence first:** after one real outing on the fixed build, how far from the nearest mapped
   street are the dense fixes? If they are within a few metres, the problem is mostly causes 1
   and 2 and matching is optional. If not, matching is the only fix.
3. **Drift at rest:** is motion-gating (B) worth a new permission, or does matching (C) make it
   unnecessary by drawing nothing where no street matches?
4. **If matching:** how big is Madeira's road and path graph as shipped content? Which algorithm,
   and does it run on the P30 fast enough, after each trip rather than live? How are the VR1 over
   the ER-101, tunnels and hairpins handled? Are footways and levadas in the graph?
5. **Honesty contract:** is it acceptable that the map draws a street the phone was *near*,
   rather than the phone's positions? What confidence gate stops it lighting the wrong street?
6. **What stays GPS:** the replay film and the share card: matched or raw?
7. **Order:** is this v1 (before launch), or v1.1 with an honest line in v1? The store listing
   text depends on the answer (monetisation plan, Phase 6).

---

## 8. Where to look

| | |
|---|---|
| `docs/trace-fidelity.md` | The 2026-09-22 analysis: four causes, the renderer's limits, why levada-only snapping |
| `docs/field-notes.md` | Measured facts, including the 2026-09-26 section behind §3 |
| `docs/decisions-full.md` | `grep -A60 "^## D-032"` and `grep -A70 "^## D-082"` |
| `TASKS.md` | T-167 (done), T-168, T-169, T-170, T-244 (the holes, done) |
| `app/src/map/traceGeoJson.ts`, `traceCleanup.ts` | The pipeline in §2 and every threshold, each with its reasoning |
| `app/src/map/NativeMapScreen.tsx` | Where the map calls `drawableSegments` and draws the polylines |
| `tools/preview-trace.mjs` | Draws a trace before and after cleanup (`--fixes` for a real one) |

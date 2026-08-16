# The content pack

Everything Madeira-specific lives here, as **data, not code**. The app in `app/` contains no
island knowledge and must not gain any (D-017; [CONTEXT.md](../CONTEXT.md) §6.1 calls the rule
absolute). If this ever ships for the Azores, the change is a different `content/` directory,
not a rewrite.

| File | What it is | Task |
|---|---|---|
| `pois.json` | The curated places, and the departure points that end a trip | T-066, T-099 |
| `regions.json` | The eleven municipalities, with their boundaries. Generated | T-067, D-061 |
| `levadas.json` | The course of each curated levada, as drawn. Generated | T-068, D-055 |
| `levadas.geojson` | Levada corridors with entry/exit **nodes** — not the same file as above | T-068 — *v2* |
| `tunnels.geojson` | Tunnel portal pairs | T-069 — *v2* |
| `stamps/` | Stamp artwork | T-070 |

---

> ### ⚠ The eighty places in `pois.json` are a STARTER SET, not curation — 2026-08-14
> The project lead asked for a full set so the app could be used. All 80 are real, they validate,
> and all 15 levadas have courses — but **they are not T-066**. Selection was by *prominence and
> coverage*, not by merit: 21 viewpoints, 15 levadas, 16 villages, 11 beaches, 16 landmarks, spread
> across the island. Nobody has asked of any of them "is this worth a stamp", which is the whole job.
>
> **Where each came from:** the non-levadas are entries of `pois.candidates.json`, chosen by name
> and copied wholesale — coordinates, region and radius are the tile pack's. The levadas were
> chosen from an OSM survey of all 104 walkable named levadas, taking the longest, and their
> geofences are the **free ends of the mapped way** (see `tools/build-levadas.mjs`).
>
> **The viewpoints were rebuilt from OSM directly on 2026-08-14**, and the reason is worth knowing
> if you ever go back to `pois.candidates.json`: the tile pack's `pois` layer carries *fragments* —
> `Barcelos`, `Bodes`, `Escalvado`, `Facho` — while OSM's own nodes at the same places are named
> properly: **Pico dos Barcelos**, **Pico dos Bodes**, **Ponta do Rosto**. A stamp reading "GATO"
> means nothing; one reading "PICO DOS BARCELOS" is a place. The candidate list is still the right
> starting point for everything else, but check a name against OSM before trusting it.
>
> **Delete them freely.** `git rm`-ing the lot and starting from the candidate list loses nothing.
> What they are good for: seeing the passport at real density, checking the artwork against real
> Portuguese names, and proving the chain end to end.
>
> ⚠ **The two levada endpoints are approximate.** They are OSM way endpoints, not the trailhead
> and exit a walker would recognise, and the stamp rule (D-009) needs both crossed. Pairing the
> right entry with the right exit is exactly the local knowledge this file exists to hold.
>
> ⚠ **Three editorial edits were made on 2026-08-16**, each on the project lead's instruction.
> One was a deletion: **Monumento Natural do Cabo Girão** was the same cliff as **Cabo Girão**,
> 745 m away and sitting on an administrative centroid — one stamp for one place, so the pack is
> 79. The other two were coordinates: **Cabo Girão** and **Rocha do Navio** were both
> curated *in the sea* — 525 m and 1.4 km out — so neither stamp could have been earned by anybody
> standing at the place. See the `regions.json` section below for what they are now and why the
> reserve is a harder case than it looks. **This is the failure mode of copying a label wholesale:
> the label sits where the map drew the word, not where the visitor stands.**
>
> ⚠ **And the class of place it happens to is now known: marine protected areas.** Re-running the
> candidate tool against the boundaries leaves exactly six entries with no municipality, and all
> six are reserves whose OSM point is the *water* — including the two that got into `pois.json`.
> `poi-candidates.mjs` now prints them as a warning instead of guessing a region for them. A
> marine reserve is a real place and not a stampable one: take the viewpoint you see it from.

## Curating `pois.json` (T-066)

**The target is ~80 places (band 60–100, D-049) on Madeira only.** Porto Santo is deliberately
deferred (D-021, D-024) — do not spend effort on it.

⚠ **This was 150–250 until 2026-08-12.** It was cut because a 7-day trip takes in 25–45 places,
so against 250 a visitor finished with a passport about a tenth full and a souvenir reading
`31 / 250`. At 80 the same trip finishes a third to half full. **The practical effect for you is
that this job is now less than half the size it was.**

**This is selection, not research.** The OSM survey (`docs/osm-coverage.md`) found 569
viewpoints, 180 peaks and 79 settlements already mapped inside the bounding box — far more
candidates than the target. The work is hand-verification and editorial judgement, which is
the one thing a global competitor cannot buy.

### Start from the candidate list, not from a blank file

```bash
node tools/poi-candidates.mjs          # → content/pois.candidates.json
```

Reads the tile pack that is already in the repository and writes **~200 candidates** — every
named viewpoint, peak, cape, beach, church, museum, garden and settlement on the main island,
with coordinates, a suggested category, a suggested radius and a region. Ordered by OSM's own
prominence signal, so the ones most likely to matter are at the top. `--max 800` shows more.

**It does not curate and cannot.** Everything in it is mechanical — a name, a coordinate and a
lookup table. The judgement is entirely yours, and the work is mostly **deleting**: ~200 down to
60–100, throwing out the ones nobody would cross a road for, fixing names OSM spells differently
from how people say them, and widening the radius on anything under canopy.

Two things it deliberately leaves alone:

- **Levadas.** They need a `start` and an `end` geofence and the award requires both (D-009);
  pairing a trailhead with the right exit is exactly the local knowledge the tool has none of.
  The 33 named trailheads it found are listed under `_trailheads` as a starting point.
- **Departure points.** Airports and the cruise terminal end the trip (D-012) and are worth
  getting right by hand.

Delete the `_osmKind` and `_prominence` hints as you go, then save the result as `pois.json`.

### Check your work as you go

```bash
node tools/validate-content.mjs
```

It reuses the app's own parser, so anything it rejects is exactly what the app would drop. It
prints a per-category and per-region breakdown and your progress toward the target. It also catches
the mistakes that are invisible by eye: a duplicated id, a longitude missing its minus sign, two
places 40 m apart that are really one place entered twice.

To check a draft without touching the real list, pass a path:

```bash
node tools/validate-content.mjs my-draft.json
```

---

## The format

```json
{
  "formatVersion": 1,
  "places": [
    {
      "id": "some-viewpoint",
      "name": "Some Viewpoint",
      "category": "viewpoint",
      "regionId": "funchal",
      "geofences": [
        { "id": "some-viewpoint", "lat": 32.6500, "lon": -16.9100, "radiusM": 200 }
      ]
    },
    {
      "id": "levada-example",
      "name": "Levada Example",
      "category": "levada",
      "regionId": "santana",
      "geofences": [
        { "id": "levada-example/start", "role": "start", "lat": 32.8000, "lon": -16.9000, "radiusM": 400 },
        { "id": "levada-example/end",   "role": "end",   "lat": 32.8200, "lon": -16.8600, "radiusM": 400 }
      ]
    }
  ]
}
```

### Fields

| Field | Rules |
|---|---|
| `id` | Unique across the file. Stable — **never change one after release**, it is the key stamps are awarded against. Lower-case and hyphenated by convention. May not start with `__`. |
| `name` | What the user reads. The only field here they ever see. |
| `category` | Exactly one of `viewpoint` · `levada` · `village` · `beach` · `landmark` (D-027). |
| `regionId` | Drives per-region progress on the **map** screen. The passport is organised by category, not by region. |
| `geofences` | One for most places. A levada has two — see below. |
| `geofences[].id` | **Unique across the whole file**, not just within the place. This is the only string the operating system hands back when a crossing happens; a collision awards the stamp to the wrong place, silently. |
| `geofences[].role` | Optional, defaults to `main`. Use `start` and `end` on levadas. |
| `geofences[].radiusM` | Between 40 and 2000. See below — this number matters more than it looks. |

### Departure points — how the trip knows it is over

Alongside `places`, the same file carries the geofences that **end the trip** (D-012, T-099):
Madeira Airport, Porto Santo Airport, and the Funchal cruise terminal.

```json
{
  "formatVersion": 1,
  "places": [ ... ],
  "departurePoints": [
    { "id": "airport-madeira", "name": "Madeira Airport", "lat": 32.6900, "lon": -16.7745, "radiusM": 1500 }
  ]
}
```

They are **monitored like anything else but can never earn a stamp** — "you collected Madeira
Airport" is not a reward. Their ids share the same namespace as place geofences, so a
collision is an error, not a warning.

**Give them a generous radius** — 1–2 km. The point is catching somebody who has arrived to
fly home, and an airport is large. Over-catching costs little: arriving on day one cannot end
the trip, because the app also requires that you have been somewhere else first.

**With none defined, no trip ever ends at an airport** and the app falls back to noticing you
left the archipelago, or three days of silence. The validator warns about this.

### There is no "Other" category

Deliberately. A place that fits none of the five is a signal about the place, not a missing
row (D-027).

### Levadas are the exception

Every other category means *you arrived somewhere*. A levada stamp means *you walked the whole
thing* — so it carries two geofences, a `start` at the trailhead and an `end` at the exit, and
the award needs both (D-009). Levadas are linear with no mid-route exits, which is what makes
this reliable despite having the worst GPS signal on the island.

One geofence on a levada would award the stamp to somebody who parked at the trailhead and
turned around. The validator warns about it.

### Choose the radius generously

**This single number is the difference between a stamp firing and a walked levada going
uncredited** — the failure D-032 names as an uninstall trigger. It is not a precision setting.

- A trailhead in a valley under canopy: **400–600 m**. The user's phone may not get a good fix
  for twenty minutes, and the geofence has to catch them anyway.
- An exposed miradouro with a car park: **150–250 m**.
- A village: whatever covers the part a visitor would actually walk.

The ceiling exists to stop a stamp firing on somebody driving past on the VR1, which would make
the whole collection worthless (CONTEXT §4.4). Within that ceiling, err large. Missing a place
the user genuinely reached is the worse failure, every time.

Note the app ranks places by **edge** distance — how far you are from the boundary, not the
centre — precisely so that a generously-sized trailhead is not pushed out of the monitored set
by a tighter viewpoint that happens to be nearer (D-033).

### Coordinates

Decimal degrees, WGS84 — what every map app gives you when you long-press and copy. Longitude
in Madeira is **negative**; a dropped minus sign puts the place off the coast of Morocco, which
the validator checks for.

Four decimal places is about 11 m, which is plenty. More is harmless.

---

## `levadas.json` — generated, never hand-edited (D-055)

The course of each curated levada, as drawn when the user taps *Show on map*. One feature per
levada, keyed by **place id**.

```bash
node tools/build-levadas.mjs   # reads pois.json, writes levadas.json
```

Re-run it whenever a levada is added, removed or **renamed** in `pois.json`. The tool matches the
name against OSM — exactly first, then by prefix — and is loud when it finds nothing:

```
Levada do Furado … 39 highway ways (exact name match), 654 → 181 points, 3.8 km across
Levada dos Balcões … NOTHING FOUND (0 ways carry a matching name). Check the spelling against OSM.
```

⚠ **Both of those lines are for you, not for the log.**

- *NOTHING FOUND* means the curated spelling and OSM's disagree — accents included. The app still
  shows that levada's card and marker; it just cannot draw the walk.
- **The span in kilometres is the sanity check.** The longest levada on the island is around 25 km,
  so anything much larger means the name matched a second levada somewhere else, and the map will
  zoom out to fit both.

## `regions.json` — generated, never hand-edited (D-061)

The eleven **concelhos** (municipalities), with their real boundaries, from OSM's own
`admin_level=7` relations. They are what the map screen means by "where should I go next"
(D-027), and each one carries the island it belongs to, which is what the Porto Santo gate keys
on (D-024, T-067a).

```bash
node tools/build-regions.mjs            # build, and report what would change
node tools/build-regions.mjs --assign   # …and write the region ids into pois.json
```

⚠ **`regionId` is derived, not curated.** It is the answer to *which polygon is this place in*,
so the tool computes it and writes it back; everything else in `pois.json` is yours. Re-run
`--assign` after adding or moving a place, and `node tools/validate-content.mjs` will tell you if
you forget.

⚠ **It reports two things you have to read.**

- *"46 of 80 places have the wrong region id"* — the state this file was found in on 2026-08-16.
  The old ids came from a nearest-settlement guess and a third of them named the island itself.
- *"N place(s) fall outside every boundary"* — with the distance. Up to ~22 m is this file's own
  simplification; **beyond that the place is in the sea**, and a geofence in the sea is a stamp
  nobody standing at the place can earn. Two of the starter set were, and were corrected on
  2026-08-16 on the project lead's instruction: **Cabo Girão** was 525 m offshore and is now the
  skywalk viewpoint, **Rocha do Navio** was 1.4 km offshore — the marine reserve's own centre —
  and is now the clifftop viewpoint above the cable car. Both coordinates are OSM's.
  ⚠ **A marine reserve has no coordinate on land, so the geofence is its access point, not its
  middle.** If a stamp is going to be earned by standing somewhere, the place has to be somewhere
  you can stand — so that place was renamed **Miradouro da Rocha do Navio** and recategorised as a
  `viewpoint`, which is what its geofence now describes.
  ⚠ **Renaming changes the id, and an id is what a stamp is stored against.** A phone that had
  already collected the old place keeps an award pointing at nothing; the passport is driven by
  the pack, so that award simply stops appearing. Harmless before release, a stamp taken away
  after it.

## Checking the names against OSM (T-066)

```bash
node tools/check-names.mjs      # talks to OSM; ~1 minute
```

The name is the whole of the reward — a stamp is a seal with a place's name across it — and the
tile pack's `pois` layer carries **fragments**: `Barcelos` where OSM says **Pico dos Barcelos**.
This asks OSM what is named within 400 m of every curated geofence and sorts each place into
*exact*, *fragment*, *more specific* or *unmatched*.

**On the starter set (2026-08-16): 63 exact, 0 fragments** of the 65 non-levada places. The
fragment problem was confined to the viewpoints, which were rebuilt from OSM on 2026-08-14.

⚠ **Levadas are skipped, deliberately.** Overpass returns a way's *centre*, which for a 12 km
contour is kilometres from the trailhead — the first version reported every levada as wrong and
suggested renaming *Levada dos Tornos* after its spring. `build-levadas.mjs` checks those names
instead, exactly, and shouts when one does not match.

## How the pack reaches the app

`app/src/content/poiCatalogue.ts` imports this directory across the `app/` boundary, which
works because `app/metro.config.js` adds `content/` to Metro's `watchFolders`. The pack is
compiled into the JavaScript bundle, so **changing a place needs an app update** — acceptable
for v1, and the offline-first design has no channel to deliver content any other way.

A structurally broken file stops the app from starting. A single bad *row* does not: it is
dropped, counted, and written to the recording diary. A curation mistake must cost one stamp,
never a recorder that will not run (D-010).

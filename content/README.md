# The content pack

Everything Madeira-specific lives here, as **data, not code**. The app in `app/` contains no
island knowledge and must not gain any (D-017; [CONTEXT.md](../CONTEXT.md) §6.1 calls the rule
absolute). If this ever ships for the Azores, the change is a different `content/` directory,
not a rewrite.

| File | What it is | Task |
|---|---|---|
| `pois.json` | The curated places, and the departure points that end a trip. **The only file that currently exists.** | T-066, T-099 |
| `regions.geojson` | Region boundaries, for per-region progress on the map screen | T-067 |
| `levadas.geojson` | Levada corridors with entry/exit nodes | T-068 — *v2* |
| `tunnels.geojson` | Tunnel portal pairs | T-069 — *v2* |
| `stamps/` | Stamp artwork | T-070 |

---

## Curating `pois.json` (T-066)

**The target is 150–250 places on Madeira only.** Porto Santo is deliberately deferred
(D-021, D-024) — do not spend effort on it.

**This is selection, not research.** The OSM survey (`docs/osm-coverage.md`) found 569
viewpoints, 180 peaks and 79 settlements already mapped inside the bounding box — far more
candidates than the target. The work is hand-verification and editorial judgement, which is
the one thing a global competitor cannot buy.

### Check your work as you go

```bash
node tools/validate-content.mjs
```

It reuses the app's own parser, so anything it rejects is exactly what the app would drop. It
prints a per-category and per-region breakdown and your progress toward 150. It also catches
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

## How the pack reaches the app

`app/src/content/poiCatalogue.ts` imports this directory across the `app/` boundary, which
works because `app/metro.config.js` adds `content/` to Metro's `watchFolders`. The pack is
compiled into the JavaScript bundle, so **changing a place needs an app update** — acceptable
for v1, and the offline-first design has no channel to deliver content any other way.

A structurally broken file stops the app from starting. A single bad *row* does not: it is
dropped, counted, and written to the recording diary. A curation mistake must cost one stamp,
never a recorder that will not run (D-010).

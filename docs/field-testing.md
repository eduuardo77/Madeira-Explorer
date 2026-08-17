# Field GPS validation (Track A, T-017 → T-021a)

Moved out of `HANDOFF.md` on 2026-08-10 — it is a procedure to follow on a specific afternoon,
not something every session needs to read.

**Status: not started, and no longer blocking v1.** Its output tunes *matching* thresholds, and
matching moved to v2 (D-032). Still worth doing: it is also the only source of real GPS
behaviour under Laurissilva canopy, which several v1 guesses lean on.


The project lead **lives in Madeira**, so this is an afternoon, not an expedition. **No code is
required** — use an off-the-shelf logger.

#### Tooling: Sensor Logger

**Sensor Logger** by Kelvin Choi (iOS + Android) —
`https://apps.apple.com/us/app/sensor-logger/id1531582925`

Chosen because it captures GPS, barometer and pedometer **in one time-aligned session**,
exports CSV/JSON/SQLite, has companion parsing tooling at
`github.com/tszheichoi/awesome-sensor-logger`, and is cross-platform so the same procedure
works for the Android comparison run (T-021a).

The **paid tier is required** — it unlocks combined CSV export plus the barometric-altitude and
pedometer channels, which are the whole point of the exercise.

#### Setup

1. Install Sensor Logger; buy the paid tier.
2. Enable **Location**, **Barometer** and **Pedometer**.
3. Set location to the **highest sample rate available.** These runs characterise the terrain —
   they are deliberately not a simulation of how the finished app samples. Maximum fidelity.
4. Bring a power bank. High-rate logging for a three-hour walk drains the battery, and that is
   expected.

#### Run 1 — the levada (T-018)

- Pick one with genuine Laurissilva canopy, ideally including a tunnel section.
- Start recording at the trailhead, stop at the exit.
- **Carry the phone as a tourist would** — pocket or daypack, *not* held up to the sky.
  Hand-held data looks better than reality and would produce falsely optimistic thresholds.

#### Run 2 — the tunnel drive (T-019)

- Any substantial VR1/VE1 stretch.
- Prioritise a section where the expressway runs **above or below the old ER101 coastal road**
  — that is the case where altitude has to do the work of telling them apart.

#### Ground truth (T-017a)

**Take a photo at every key waypoint** — trailhead, each tunnel portal, the exit. EXIF supplies
timestamp and location for free. Without ground truth a trace is an ungradeable squiggle; the
entire exercise is comparing what the sensors *recorded* against what actually *happened*.

#### Afterwards

**The import is one command, and it does the T-020 arithmetic for you** (built 2026-08-17):

```bash
node tools/import-sensor-logger.mjs <unzipped-export-dir> --name levada-do-rei
node tools/preview-trace.mjs --fixes tools/fixtures/levada-do-rei.json --sweep
```

The first prints blackout durations, fix interval and accuracy percentiles, and writes the
fixture. The second runs **the app's own `cleanTrace`** over the real fixes and draws the
before and after, which is the whole point: until this exists, every threshold in the trace
chapter was tuned against noise this repository invented for itself.

- Paste the printed numbers, and what they mean, into `docs/field-notes.md` (T-020).
- Commit exports and photos to `tools/fixtures/` — **these become the permanent matching
  regression suite** (T-021). Every future matching change is tested against them.
- **Repeat at least one run on a mid-range Android** before finalising any Phase 4 threshold
  (T-021a) — see the warning below.

#### Questions these runs must answer

- Does the barometer stay usable inside tunnels and under canopy?
- Does altitude reliably separate the VR1 from the coastal ER101 below it?
- Does the pedometer keep counting through GPS blackouts?
- How long are the blackouts, in seconds and metres, and how large is the error on recovery?

#### ⚠ Sampling bias warning

The project lead's **iPhone 15 has better GNSS than much of what tourists actually carry.**
iPhone-only fixtures are best-case. Tuning corridor widths and gap thresholds against them
risks shipping an app that quietly **under-credits users on mid-range Android hardware** —
precisely the failure mode identified as an uninstall trigger (D-009). Do not finalise Phase 4
thresholds on iPhone data alone.

---

## Fold these into the same afternoon

- **T-028a** — verify levada corridor connectivity on the ground.
- **T-028b** — check WalkMe in airplane mode, for the competitor read.

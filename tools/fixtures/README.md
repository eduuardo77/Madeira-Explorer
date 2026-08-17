# Fixtures — real walks, and nothing else

**Only traces somebody actually recorded outdoors go in this directory.** Everything
else in this repository is reasoning; this is the small pile of evidence it has to
answer to, the same standing as `docs/field-notes.md`.

⚠ **Never commit a synthetic trace here**, however useful it was for a probe. A fixture
whose provenance is unclear is worse than no fixture, because it will be believed.
Modelled noise lives inside `tools/preview-trace.mjs`, which says loudly that it is
modelled.

**How to record one is `docs/field-testing.md`** — the logger, both runs, the photo
ground truth, and the sampling-bias warning. Do not do the walk from this file.

## Importing one

```bash
node tools/import-sensor-logger.mjs ~/Downloads/levada-do-rei --name levada-do-rei
node tools/preview-trace.mjs --fixes tools/fixtures/levada-do-rei.json --sweep
```

⚠ **Unzip the export first** — Node has no unzip and this project adds no dependency
for one.

The importer prints what T-020 asks for — blackout lengths, error magnitudes, fix
interval — and writes the fixes in `TraceFix` shape, so the app's own `cleanTrace` runs
against them with nothing in between to disagree with it. Each fixture carries its own
provenance: source filename, format, import date, and the columns that were matched.

⚠ **`preview-trace.mjs --fixes` prints no deviation number**, because on a real walk
nobody recorded where the walker actually was. Pass a route file alongside the fixture
only if the course really is known.

## What the first fixture settles

Every one of these was written on 2026-08-16 against invented noise, and stays a guess
until a file lands here:

| Guess | Where | What the fixture answers |
|---|---|---|
| 16 m simplification tolerance | `traceCleanup.ts` | `--sweep`, then judged by eye |
| 120 m accuracy cut (D-067) | `traceGeoJson.ts` | what share of canopy fixes it refuses |
| 60 m levada corridor (D-065) | `stampRules` | how far fixes wander off the mapped channel |
| 45 min / 800 m credit (D-068) | `stampRules` | how long the walk took, how much of it drew |

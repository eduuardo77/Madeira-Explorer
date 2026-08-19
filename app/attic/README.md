# The attic

**Kept on purpose. Not compiled, not shipped, not deleted.**

The project lead's instruction, 2026-08-13, when D-057 replaced this app's own map with the
platform's: *"Don't delete the map we've created as it might come useful in the future."*

That instruction stands. What changed on **2026-08-18** is narrower: **keeping the source and
shipping the native library are different things, and only the second cost anything.**

`libmaplibre.so` was **10 MB of the 48 MB a real user downloads** — a fifth of the app — for a
screen no code path could reach. `App.tsx` mentioned it only in a comment. So the file moved here,
`app/tsconfig.json` excludes `attic/`, and `@maplibre/maplibre-react-native` came out of
`package.json`.

---

## What is in here

### `MapLibreScreen.tsx`

The complete primary screen, drawn with MapLibre instead of Google Maps: offline vector tiles, the
authored light and dark styles, the trace, the levada course, place markers, the recording
controls. It worked. It was replaced because Google's and Apple's cartography is better than this
project will ever maintain (D-057), not because it was broken.

## What is **not** in here, and why

⚠ **The cartography itself never moved, because it is not MapLibre's.**

- **`tiles/`** — the whole pipeline: the tile schema (D-030), terrain and hillshade generation, the
  glyph fetcher, and the authored `light.json` / `dark.json`. It is **build tooling**, tracked in
  git, and it has never been inside the APK, so it costs nothing where it is.
- **`app/assets/map/light.json`** — still shipped and still used. The **Google** map path reads it
  for the clutter rules and the dark fallback (`mapClutter.ts`, `darkMode.ts`).
- **`app/src/map/`** — `mapStyle`, `mapAssets`, `traceStyle`, `placeStyle`, `levadaHighlight`,
  `cameraFit`, `traceGeoJson` and the rest all stayed. They are shared with the shipping map and
  with the souvenir film.

**The valuable part of this work was never the wiring.** It was the schema, the styles, the
hillshading, the glyph bundling and the decisions behind them — and every one of those is still in
the repository, still documented, still tracked.

## Reviving it

Not a matter of moving the file back. Expect to:

1. Re-add `@maplibre/maplibre-react-native` and expect its API to have moved — it changes a lot.
2. Remove `attic` from `tsconfig.json`'s `exclude` and fix whatever two years of Expo and React
   Native upgrades broke. ⚠ **This file is not type-checked while it sits here**, so it will rot.
   That was accepted knowingly: it has no tests, is never rendered, and *"still compiles"* was
   always a weak guarantee that it still works.
3. Rebuild the tile packs from `tiles/`.
4. Re-read **D-057** first, and be sure the reason it was set aside no longer applies.

⚠ **The one thing that would genuinely bring it back is offline maps** — the single capability
Google's map cannot give this app. Note that D-073 forbids claiming *"works offline"* in any store
copy while that remains untrue.

#!/usr/bin/env bash
# T-023 - build the offline vector tile pack for Madeira and Porto Santo.
#
#     bash tiles/pipeline/build.sh
#
# Output: tiles/out/madeira.pmtiles  (gitignored - regenerate, never commit)
#
# Schema: PROTOMAPS BASEMAP (D-030). Extracted by bounding box from Protomaps'
# hosted planet build via HTTP range requests - no local OSM processing.
#
# Why this rather than building from OSM ourselves (D-030 has the full case):
#   - Schema is CC0. Only "(c) OpenStreetMap" attribution is required, which is
#     unavoidable under ODbL whatever we do. The OpenMapTiles schema is CC-BY
#     and would have forced "(c) OpenMapTiles" into the souvenir video (D-013).
#   - Keeps names on road/path features, so levadas stay identifiable (T-026a).
#   - It is the schema D-026's chosen styles target natively.
#
# This is a BUILD-time dependency, never a runtime one. We ship a file; the app
# makes no network requests (D-001). If build.protomaps.com disappears, the
# pack we already shipped keeps working and the fallback below still applies.
set -euo pipefail
cd "$(dirname "$0")/../.."

PMTILES="tools/bin/pmtiles.exe"

# Pinned deliberately: an unpinned "latest" would make builds irreproducible.
# Bump when a refresh is wanted, and record the date in docs/tile-pipeline.md.
PLANET_BUILD="20260803"
SRC="https://build.protomaps.com/${PLANET_BUILD}.pmtiles"

# Both islands, per D-021, as west,south,east,north. Madeira is roughly
# -17.27..-16.65 / 32.61..32.88; Porto Santo -16.42..-16.27 / 32.99..33.12.
# The Desertas fall inside the box and cost almost nothing - ocean tiles are
# nearly empty in vector form.
BBOX="-17.32,32.40,-16.20,33.20"

OUT="tiles/out/madeira.pmtiles"

if [ ! -x "$PMTILES" ]; then
  echo "No pmtiles CLI. Run: bash tools/fetch-toolchain.sh" >&2
  exit 1
fi

mkdir -p tiles/out
"$PMTILES" extract "$SRC" "$OUT" --bbox="$BBOX"

echo
echo "Built $OUT from planet build $PLANET_BUILD"
ls -lh "$OUT" | awk '{print "  size: " $5}'
echo
echo "T-026: record this size in docs/tile-pipeline.md. It does NOT include"
echo "terrain (D-026), which is a separate pipeline and will move the number."

# ---------------------------------------------------------------------------
# FALLBACK - build the tiles ourselves, if Protomaps' hosted builds ever stop.
#
# The toolchain for this is already fetched (portable JDK + planetiler) and was
# proven working on 2026-08-08: it produced an 8.9 MB OpenMapTiles-schema pack
# of the same area in 3m37s. Two routes, in order of preference:
#
#   1. Protomaps' own planetiler profile, keeping this schema and these styles.
#      Needs Maven and a build from source of github.com/protomaps/basemaps.
#      No prebuilt jar is published.
#
#   2. A custom schema via planetiler's YAML config - no Java required:
#        java -jar tools/bin/planetiler.jar generate-custom --schema=schema.yml
#      Full control and no licence encumbrance, but NO existing style targets a
#      bespoke schema, so it means authoring cartography from a blank file -
#      the exact trap D-026 exists to avoid. Last resort, not first.
#
#   3. planetiler's default OpenMapTiles profile. Works today, but reintroduces
#      the CC-BY attribution and strips names from paths. Documented for
#      completeness; not recommended.
#
#      java -Xmx4g -jar tools/bin/planetiler.jar \
#        --osm_path=tiles/src/portugal-latest.osm.pbf \
#        --bounds="$BBOX" --output="$OUT" \
#        --download_dir=tiles/src/planetiler --download --force
#
# Geofabrik publishes no Madeira extract - only the Azores, and Portugal whole
# (400 MB) - so any self-build route clips Portugal to BBOX.
# ---------------------------------------------------------------------------

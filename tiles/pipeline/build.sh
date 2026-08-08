#!/usr/bin/env bash
# T-023 - build the offline vector tile pack for Madeira and Porto Santo.
#
#     bash tiles/pipeline/build.sh
#
# Prerequisite: bash tools/fetch-toolchain.sh
# Output:       tiles/out/madeira.pmtiles  (gitignored - regenerate, never commit)
#
# The pipeline is committed; its output is not. That is the point of T-023:
# the tile pack must be reproducible from a script so it can be rebuilt against
# fresher OSM data, rather than being a downloaded file that silently goes
# stale.
set -euo pipefail
cd "$(dirname "$0")/../.."

JAVA="tools/jdk/jdk-21.0.12+8/bin/java.exe"
PLANETILER="tools/bin/planetiler.jar"

# Both islands, per D-021. south/west/north/east as west,south,east,north.
# Madeira runs roughly -17.27..-16.65 / 32.61..32.88; Porto Santo sits at
# -16.42..-16.27 / 32.99..33.12. The Desertas fall inside the box and cost
# nothing - ocean tiles are almost empty in vector form.
BOUNDS="-17.32,32.40,-16.20,33.20"

# Geofabrik publishes no Madeira extract - only the Azores, and Portugal as a
# whole - so we take Portugal (400 MB) and let planetiler clip to BOUNDS.
OSM_SRC="tiles/src/portugal-latest.osm.pbf"
OSM_URL="https://download.geofabrik.de/europe/portugal-latest.osm.pbf"

OUT="tiles/out/madeira.pmtiles"

if [ ! -x "$JAVA" ]; then
  echo "No JDK. Run: bash tools/fetch-toolchain.sh" >&2
  exit 1
fi

if [ ! -f "$OSM_SRC" ]; then
  echo "Fetching Portugal OSM extract (400 MB)..."
  mkdir -p tiles/src
  curl -L --fail -o "$OSM_SRC" "$OSM_URL"
  curl -sL -o "$OSM_SRC.md5" "$OSM_URL.md5"
  ( cd tiles/src && md5sum -c "$(basename "$OSM_SRC").md5" )
fi

mkdir -p tiles/out

# --download fetches planetiler's global reference data on first run and caches
# it: water polygons (928 MB), Natural Earth (434 MB), lake centrelines (81 MB).
# ~1.4 GB, one-time, gitignored.
#
# That is a lot of *global* data to render a 740 km2 island, and most of it is
# dead weight here - Natural Earth and lake centrelines only matter at low zoom.
# The water polygons are not optional: they are what makes the coastline a
# coastline, which for an island is most of the map. Avoiding the rest would
# mean writing a custom planetiler profile in Java, which is a poor trade for
# this project (CONTEXT.md 6.7) unless T-026's size target forces it.
"$JAVA" -Xmx4g -jar "$PLANETILER" \
  --osm_path="$OSM_SRC" \
  --bounds="$BOUNDS" \
  --output="$OUT" \
  --download_dir=tiles/src/planetiler \
  --download \
  --force

echo
echo "Built $OUT"
ls -lh "$OUT" | awk '{print "  size: " $5}'
echo
echo "T-026: record this size in docs/osm-coverage.md and judge it against a"
echo "hotel-WiFi download. Note it does NOT yet include terrain (D-026)."

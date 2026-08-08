#!/usr/bin/env bash
# Serve the tile pack and the T-025 viewer locally.
#
#     bash tiles/viewer/serve.sh      then open http://localhost:8081/
#
# Two servers, because they do different jobs:
#
#   :8080  pmtiles serve  - turns madeira.pmtiles into z/x/y tile requests.
#          PMTiles is a single file read via HTTP *range* requests, and
#          Python's http.server does not implement Range - so a plain static
#          server cannot serve it. This is why go-pmtiles is in the toolchain
#          even though the build does not need it.
#
#   :8081  static server  - the viewer page, the style, and overlay.geojson.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ ! -f tiles/out/madeira.pmtiles ]; then
  echo "No tile pack. Run: bash tiles/pipeline/build.sh" >&2
  exit 1
fi

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

./tools/bin/pmtiles.exe serve tiles/out --port 8080 --cors '*' &
python -m http.server 8081 --directory tiles &

echo
echo "  viewer  http://localhost:8081/viewer/"
echo "  tiles   http://localhost:8080/madeira/{z}/{x}/{y}.mvt"
echo
echo "Ctrl-C to stop both."
wait

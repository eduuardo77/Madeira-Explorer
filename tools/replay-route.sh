#!/usr/bin/env bash
# Feed a route into the running emulator, so the recorder has something to record.
#
#     bash tools/replay-route.sh tools/routes/funchal-seafront.txt
#     bash tools/replay-route.sh tools/routes/vr1-tunnel.txt 3
#
# Second argument is seconds between points (default 2). The recorder batches
# and gates its own sampling (T-034, D-028), so a replay faster than real time
# does not produce a proportionally denser trace — it produces whatever the
# sampling gate lets through, which is the point.
#
# WHY THIS EXISTS
# ---------------
# The emulator can render the map, but an emulator with no location fixes draws
# an empty island: `raw_fix` is empty, so `traceGeoJson` has nothing to build
# and the trace layer is blank. Every check that involves *seeing the app work*
# — the map (T-063), the trace (T-059), geofence crossings (T-076), the day-1
# health check (T-049) — needs positions arriving over time.
#
# ⚠ WHAT THIS CANNOT TELL YOU. It is a replay, not a walk. CONTEXT §6.6 is
# explicit and unchanged: the emulator is legitimate for rendering, storage, UI,
# permissions and replayed routes, and **worthless for battery, background
# survival and GPS realism**. These points are clean, evenly spaced and never
# lose signal. Real GPS under Laurissilva canopy is none of those things, and no
# threshold in D-033, D-037 or D-041 may be closed by this.
#
# ⚠ `adb emu geo fix` TAKES LONGITUDE FIRST. The route files below are written
# `lat lon` because that is the order every other file in this project uses, and
# the swap happens here, once. Getting it backwards puts Madeira in Somalia.
set -euo pipefail
cd "$(dirname "$0")/.."

ROUTE="${1:-}"
INTERVAL="${2:-2}"
ADB="$(pwd)/tools/android-sdk/platform-tools/adb.exe"

if [ -z "$ROUTE" ] || [ ! -f "$ROUTE" ]; then
  echo "Usage: bash tools/replay-route.sh <route-file> [seconds-per-point]" >&2
  echo "Routes available:" >&2
  ls tools/routes/*.txt 2>/dev/null | sed 's/^/  /' >&2
  exit 1
fi
if [ ! -f "$ADB" ]; then
  echo "No adb. Run: bash tools/fetch-android-emulator.sh" >&2
  exit 1
fi
if ! "$ADB" devices | grep -q "emulator.*device"; then
  echo "No emulator running. Run: bash tools/run-emulator.sh" >&2
  exit 1
fi

# Comments and blank lines are allowed in a route file so each one can say what
# it is for.
POINTS=$(grep -vE '^\s*(#|$)' "$ROUTE")
TOTAL=$(echo "$POINTS" | wc -l | tr -d ' ')

echo "Replaying $ROUTE — $TOTAL points, ${INTERVAL}s apart (~$((TOTAL * INTERVAL))s)"

INDEX=0
while read -r LAT LON _; do
  [ -z "${LAT:-}" ] && continue
  INDEX=$((INDEX + 1))
  # Longitude first. See the warning above.
  "$ADB" emu geo fix "$LON" "$LAT" >/dev/null
  printf '\r  %d/%d  %s, %s   ' "$INDEX" "$TOTAL" "$LAT" "$LON"
  sleep "$INTERVAL"
done <<< "$POINTS"

echo
echo "Done. The recorder gates its own sampling, so expect fewer stored fixes"
echo "than points replayed — that is D-028 working, not a fault."

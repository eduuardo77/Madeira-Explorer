#!/usr/bin/env bash
# The replay's smoothness: frames that reached the screen while the film plays (T-279).
#
#     bash tools/measure-film-frames.sh [seconds] [label] [serial]
#
# Start the film on the phone (the trip viewer's ▶, then a choice), then run
# this at once: it reads SurfaceFlinger's present times for the app's window
# for `seconds` (default 20, longer than the whole-trip film) and prints the
# frame intervals (`map-frames.mjs`). Nothing is touched on the phone.
#
# ⚠ Why SurfaceFlinger and not `gfxinfo`: see `measure-map-frames.sh`. The map
# draws on its own GL thread, and a slow thread makes fewer frames, not late ones.
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1
SECONDS_TO_READ="${1:-20}"
LABEL="${2:-film}"
SERIAL="${3:-XPHDU19C02001808}"
PKG="com.proa.madeira"
ADB="tools/android-sdk/platform-tools/adb.exe -s $SERIAL"
OUT="tools/out/map-frames"
mkdir -p "$OUT"
RAW="$OUT/$LABEL-$(date +%H%M%S).txt"

LAYER=$($ADB shell dumpsys SurfaceFlinger --list | tr -d '\r' | grep "^$PKG/" | head -1)
if [ -z "$LAYER" ]; then
  echo "No window layer for $PKG: is it open in front?" >&2
  exit 1
fi

$ADB shell dumpsys SurfaceFlinger --latency-clear "'$LAYER'" >/dev/null
$ADB shell "while true; do dumpsys SurfaceFlinger --latency '$LAYER'; echo ---; sleep 0.5; done" >"$RAW" &
READER=$!
sleep "$SECONDS_TO_READ"
kill $READER 2>/dev/null || true
wait $READER 2>/dev/null || true

echo "$LABEL ($LAYER)"
node tools/map-frames.mjs "$RAW"

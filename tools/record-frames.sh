#!/usr/bin/env bash
# Frames on screen for a while, with no gesture: an animation's smoothness (T-278).
#
#     bash tools/record-frames.sh <seconds> [package] [label] [serial]
#
# Start the animation (the trip replay, say), then run this. It reads
# SurfaceFlinger's present times for the app's window as `measure-map-frames.sh`
# does and prints the same summary. Pauses longer than 250 ms count as rest.
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1
SECONDS_TO_RECORD="$1"
PKG="${2:-com.proa.madeira}"
LABEL="${3:-$PKG-record}"
SERIAL="${4:-XPHDU19C02001808}"
ADB="tools/android-sdk/platform-tools/adb.exe -s $SERIAL"
OUT="tools/out/map-frames"
mkdir -p "$OUT"
RAW="$OUT/$LABEL-$(date +%H%M%S).txt"

LAYER=$($ADB shell dumpsys SurfaceFlinger --list | tr -d '\r' | grep "^$PKG/" | head -1)
[ -n "$LAYER" ] || { echo "No window layer for $PKG: is it open in front?" >&2; exit 1; }

$ADB shell dumpsys SurfaceFlinger --latency-clear "'$LAYER'" >/dev/null
$ADB shell "while true; do dumpsys SurfaceFlinger --latency '$LAYER'; echo ---; sleep 0.5; done" >"$RAW" &
READER=$!
sleep "$SECONDS_TO_RECORD"
kill $READER 2>/dev/null || true
wait $READER 2>/dev/null || true
echo "$LABEL ($LAYER)"
node tools/map-frames.mjs "$RAW"

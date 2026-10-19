#!/usr/bin/env bash
# The map's frames during a zoom gesture, in and out three times (T-278).
#
#     bash tools/measure-map-zoom.sh [package] [label] [serial]
#
# For Bruma, open on the island view after a fresh launch: a slow swipe first
# brings Funchal (where the lit roads are densest) up to where the gesture
# starts, and two double taps there bring it to about zoom 12, so the cycles
# cross every width step (12, 13.5, 15). Then `make-zoom-gesture.py`'s one-finger zoom runs through monkey
# while SurfaceFlinger's present times are read, as in `measure-map-frames.sh`.
# Pass SKIP_PAN=1 for an app whose map is already where it should be.
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1
PKG="${1:-com.proa.madeira}"
LABEL="${2:-$PKG-zoom}"
SERIAL="${3:-XPHDU19C02001808}"
ADB="tools/android-sdk/platform-tools/adb.exe -s $SERIAL"
OUT="tools/out/map-frames"
mkdir -p "$OUT"
RAW="$OUT/$LABEL-$(date +%H%M%S).txt"

python -I tools/make-zoom-gesture.py "$OUT/zoom-gesture.txt" 530
$ADB push "$OUT/zoom-gesture.txt" /data/local/tmp/zoom-gesture.txt >/dev/null

LAYER=$($ADB shell dumpsys SurfaceFlinger --list | tr -d '\r' | grep "^$PKG/" | head -1)
[ -n "$LAYER" ] || { echo "No window layer for $PKG: is it open in front?" >&2; exit 1; }

if [ "${SKIP_PAN:-0}" != 1 ]; then
  $ADB shell input swipe 600 1530 600 530 900
  sleep 1.5
  for tap in 1 2; do
    $ADB shell "input tap 540 530 & sleep 0.08; input tap 540 530"
    sleep 1.2
  done
fi

$ADB shell dumpsys SurfaceFlinger --latency-clear "'$LAYER'" >/dev/null
$ADB shell "while true; do dumpsys SurfaceFlinger --latency '$LAYER'; echo ---; sleep 0.5; done" >"$RAW" &
READER=$!
sleep 0.5
$ADB shell monkey -f /data/local/tmp/zoom-gesture.txt 1 >/dev/null 2>&1
sleep 1
kill $READER 2>/dev/null || true
wait $READER 2>/dev/null || true
echo "$LABEL ($LAYER)"
node tools/map-frames.mjs "$RAW"

#!/usr/bin/env bash
# The map's own smoothness: frames that reached the screen during a pan (map pass, 2026-10-19).
#
#     bash tools/measure-map-frames.sh [package] [label] [serial]
#
# The app must be open on its map. Runs the same 9 pans and 2 double-tap zooms as
# `measure-jank.sh`, while reading SurfaceFlinger's present times for the app's
# window, then prints the frame intervals (`map-frames.mjs`).
#
# ⚠ Why not `gfxinfo`: it counts frames the app's interface drew and calls one
# janky when the interface was late. On the P30 the Google map draws on its own
# GL thread into a TextureView; when that thread is slow, frames are simply not
# produced, and `gfxinfo` reports 0% janky over a map that stutters. What the
# eye sees is the gap between frames on screen, which is what this reads.
# ⚠ SurfaceFlinger keeps only the last 128 frames, so it is read every 0.5 s
# and the readings merged by timestamp.
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1
PKG="${1:-com.proa.madeira}"
LABEL="${2:-$PKG}"
SERIAL="${3:-XPHDU19C02001808}"
ADB="tools/android-sdk/platform-tools/adb.exe -s $SERIAL"
OUT="tools/out/map-frames"
mkdir -p "$OUT"
RAW="$OUT/$LABEL-$(date +%H%M%S).txt"

LAYER=$($ADB shell dumpsys SurfaceFlinger --list | tr -d '\r' | grep "^$PKG/" | head -1)
if [ -z "$LAYER" ]; then
  echo "No window layer for $PKG: is it open in front?" >&2
  exit 1
fi

X=540
Y=900

$ADB shell dumpsys SurfaceFlinger --latency-clear "'$LAYER'" >/dev/null
$ADB shell "while true; do dumpsys SurfaceFlinger --latency '$LAYER'; echo ---; sleep 0.5; done" >"$RAW" &
READER=$!
sleep 0.5

# Each gesture logs a marker on the phone's clock just before it starts, in the
# same shell call, so map-frames.mjs can tell a stall from the wait for the next
# gesture (N10, 2026-10-23; see there).
G="log -t mapframes gesture;"
for step in 1 2 3 4 5 6 7 8 9; do
  case $((step % 4)) in
    0) $ADB shell "$G input swipe $X $Y $((X - 350)) $Y 250" ;;
    1) $ADB shell "$G input swipe $X $Y $((X + 350)) $Y 250" ;;
    2) $ADB shell "$G input swipe $X $Y $X $((Y + 400)) 250" ;;
    3) $ADB shell "$G input swipe $X $Y $X $((Y - 400)) 250" ;;
  esac
  sleep 0.6
done
for zoom in 1 2; do
  $ADB shell "$G input tap $X $Y"
  $ADB shell input tap $X $Y
  sleep 1
done
sleep 1.5

kill $READER 2>/dev/null || true
wait $READER 2>/dev/null || true
# The markers, as "MARK <monotonic s>": logcat's monotonic clock is the one
# SurfaceFlinger's present times use. Old markers fall outside the run's frames.
$ADB logcat -d -v monotonic -s mapframes:I | tr -d '\r' | awk '/mapframes: gesture/ {print "MARK " $1}' >>"$RAW"
echo "$LABEL ($LAYER)"
node tools/map-frames.mjs "$RAW"

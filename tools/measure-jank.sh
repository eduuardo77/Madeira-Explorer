#!/usr/bin/env bash
# The review's pan-and-zoom workload, made repeatable (T-254).
#
#     bash tools/measure-jank.sh [serial]
#
# The app must be open on the home map. Resets `gfxinfo`, then 9 pans and 2
# double-tap zooms (the workload of the 24 Sep and 6 Oct reviews), then prints
# the frame summary and memory.
#
# ⚠ `gfxinfo` counts the app's own interface frames. The Google map draws on its
# own surface and its frame rate is not in these numbers (app-review-2026-09-24).
# ⚠ Measure on a build without the debuggable flag: ART runs a debuggable app
# less optimised, and the 6 Oct figures were taken on one (CONTEXT, dev-build).
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1
SERIAL="${1:-XPHDU19C02001808}"
ADB="tools/android-sdk/platform-tools/adb.exe -s $SERIAL"
PKG=com.proa.madeira

# The map's middle on a 1080 x 2340 screen, clear of the controls.
X=540
Y=900

$ADB shell dumpsys gfxinfo $PKG reset >/dev/null
for step in 1 2 3 4 5 6 7 8 9; do
  case $((step % 4)) in
    0) $ADB shell input swipe $X $Y $((X - 350)) $Y 250 ;;
    1) $ADB shell input swipe $X $Y $((X + 350)) $Y 250 ;;
    2) $ADB shell input swipe $X $Y $X $((Y + 400)) 250 ;;
    3) $ADB shell input swipe $X $Y $X $((Y - 400)) 250 ;;
  esac
  sleep 0.6
done
for zoom in 1 2; do
  $ADB shell input tap $X $Y
  $ADB shell input tap $X $Y
  sleep 1
done
sleep 1

$ADB shell dumpsys gfxinfo $PKG | grep -E "Total frames rendered|Janky frames|50th|90th|95th|99th|Number Slow UI|Number Frame deadline missed" | sed 's/^ *//'
$ADB shell dumpsys meminfo $PKG | grep -E "TOTAL:|Native Heap  |Graphics:" | head -3 | sed 's/^ *//'

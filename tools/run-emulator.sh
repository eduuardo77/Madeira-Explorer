#!/usr/bin/env bash
# Start the virtual phone.
#
#     bash tools/run-emulator.sh
#
# Runs in the foreground; Ctrl-C stops it. First boot takes a minute or two,
# later ones are quick because the emulator snapshots its own state.
set -euo pipefail
cd "$(dirname "$0")/.."

ANDROID_HOME="$(pwd)/tools/android-sdk"

if [ ! -d "$ANDROID_HOME/emulator" ]; then
  echo "No emulator. Run: bash tools/fetch-android-emulator.sh" >&2
  exit 1
fi

# ⚠⚠ `-gpu host` RENDERS THE GOOGLE MAP AS PURE BLACK. Found 2026-08-17.
#
# The app's own UI composites through Skia and draws perfectly; the map's
# separate GL surface comes back blank. No error, no authorization failure, no
# Google wordmark — the primary screen is simply black, in both styles, before
# and after panning. It looks exactly like a broken app rather than a broken
# emulator flag, which is why it cost a session to find.
#
# ⚠ **AND THE REASON `-gpu host` WAS HERE HAS BEEN OBSOLETE SINCE D-057.** The
# comment this replaces said the real GPU was needed because *"MapLibre draws
# vector tiles and computes hillshading on it"*. D-057 replaced MapLibre with
# **the platform's own map** — Google's, rendered by Play services — so nothing
# in the app rasterises tiles any more. The flag kept its justification after
# the thing it justified was removed, and then hid the map from every session
# that tried to look at it.
#
# `swiftshader_indirect` is slower to boot and the map is unmistakably there.
# Override if a future host handles `host` correctly: MADEIRA_GPU=host bash …
#
# ⚠⚠ **THE GPU FLAG IS NOT THE WHOLE STORY, and the first version of this comment
# claimed it was.** With swiftshader the map draws after a **fresh boot** and then
# goes black again after an `am force-stop` and relaunch. So the honest statement
# is: the map surface on this emulator is fragile across app restarts, and
# swiftshader is the setting where it comes back.
#
# **If the map is black, cold-boot the emulator** rather than debugging the app.
# The AVD reloads its snapshot by default, and a snapshot taken while the surface
# was broken restores it broken — which is how this wasted a session in the first
# place. `-no-snapshot-load` forces a genuinely cold boot:
#
#     MADEIRA_COLD=1 bash tools/run-emulator.sh
# ⚠⚠ **REVERSED 2026-10-06: the default is now `auto`, the graphics card.** The
# project lead reported the emulator using too much of the PC. Measured with
# `Get-Process qemu-system-x86_64` over an idle stretch: **78% of the whole PC**
# with swiftshader at 1080x2400 and 4 cores, **6%** with `auto` (it picks the
# GTX 1060) at 720x1560, 2 cores, no audio. Under `auto` the Google map drew,
# and still drew after a force-stop and relaunch (0% black pixels in the map
# area). `angle_indirect` is refused by this emulator ("not a valid option").
# The history above stays because it may come back: if the map is black, run
# MADEIRA_GPU=swiftshader_indirect bash tools/run-emulator.sh and cold-boot.
GPU="${MADEIRA_GPU:-auto}"
COLD=""
if [ -n "${MADEIRA_COLD:-}" ]; then
  COLD="-no-snapshot-load"
fi

# ⚠ Independent of the GPU: Play services hands this emulator the **LEGACY**
# Maps renderer (T-147), and Google's own dark map is a latest-renderer
# feature. So the dark style cannot be judged here at any GPU setting.
# `adb logcat -d | grep "renderer version"` says which one you got.
exec "$ANDROID_HOME/emulator/emulator" -avd madeira -no-boot-anim -gpu "$GPU" $COLD

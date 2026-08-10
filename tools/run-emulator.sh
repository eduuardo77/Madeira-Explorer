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

# -no-boot-anim shaves a few seconds; -gpu host uses the real GPU, which the
# map genuinely needs — MapLibre draws vector tiles and computes hillshading
# on it, and a software rasteriser makes the map look far worse than it is.
exec "$ANDROID_HOME/emulator/emulator" -avd madeira -no-boot-anim -gpu host

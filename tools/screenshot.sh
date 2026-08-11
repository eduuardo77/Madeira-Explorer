#!/usr/bin/env bash
# Grab a screenshot from the running emulator.
#
#     bash tools/screenshot.sh map
#     → tools/out/shots/map.png
#
# Named rather than timestamped, because these get looked at side by side and
# referred to in commit messages. Overwrites deliberately: a directory of
# `screenshot-1731...png` is a directory nobody opens.
#
# Screenshots are gitignored (`tools/out/shots/`) — they are 1.3 MB each and
# throwaway. Deliberate artefacts in `tools/out/` are committed individually;
# `tools/out/stamps.html` is the one that is.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-screen}"
ADB="$(pwd)/tools/android-sdk/platform-tools/adb.exe"
OUT="tools/out/shots"

if [ ! -f "$ADB" ]; then
  echo "No adb. Run: bash tools/fetch-android-emulator.sh" >&2
  exit 1
fi
if ! "$ADB" devices | grep -q "emulator.*device"; then
  echo "No emulator running. Run: bash tools/run-emulator.sh" >&2
  exit 1
fi

mkdir -p "$OUT"

# `exec-out` rather than `shell screencap > file`: on Windows the shell
# transport rewrites \n to \r\n and corrupts the PNG. This is the fix and it is
# not optional here.
"$ADB" exec-out screencap -p > "$OUT/$NAME.png"

SIZE=$(wc -c < "$OUT/$NAME.png" | tr -d ' ')
if [ "$SIZE" -lt 1000 ]; then
  echo "Screenshot is only ${SIZE} bytes — the capture failed." >&2
  exit 1
fi

echo "$OUT/$NAME.png  (${SIZE} bytes)"

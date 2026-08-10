#!/usr/bin/env bash
# Install an EAS-built APK into the running emulator.
#
#     bash tools/install-apk.sh ~/Downloads/build-1234.apk
#
# The APK comes from `eas build --profile development --platform android`,
# downloaded from the URL that build prints. Nothing is compiled here.
set -euo pipefail
cd "$(dirname "$0")/.."

APK="${1:-}"
ADB="$(pwd)/tools/android-sdk/platform-tools/adb"

if [ -z "$APK" ] || [ ! -f "$APK" ]; then
  echo "Usage: bash tools/install-apk.sh <path-to.apk>" >&2
  exit 1
fi
if [ ! -x "$ADB" ] && [ ! -f "$ADB.exe" ]; then
  echo "No adb. Run: bash tools/fetch-android-emulator.sh" >&2
  exit 1
fi

"$ADB" wait-for-device
# -r reinstalls over an existing copy, keeping the app's data — which matters:
# wiping it would delete the recorded trace you are trying to look at (D-010).
"$ADB" install -r "$APK"

echo
echo "Installed. Useful from here:"
echo "  $ADB logcat -s ReactNativeJS   app console output"
echo "  $ADB shell pm clear com.madeiraexplorer.app   wipe app data (destroys the trace)"

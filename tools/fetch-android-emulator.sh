#!/usr/bin/env bash
# Fetch a portable Android emulator, so the app can be SEEN on a machine with
# no Android phone attached.
#
#     bash tools/fetch-android-emulator.sh
#
# Everything lands in tools/android-sdk/, which is gitignored. Nothing is
# installed system-wide, nothing is added to PATH, and deleting that one
# folder removes all of it. Same principle as the portable JDK in
# fetch-toolchain.sh, and for the same reason (CONTEXT §6.7): the project lead
# should not have to carry a permanent Android Studio install to look at a map.
#
# DOWNLOADS ROUGHLY 2.5 GB. Most of it is the system image.
#
# WHAT THIS IS AND IS NOT FOR
# ---------------------------
# It runs an APK that EAS built in the cloud. It deliberately does NOT install
# the native build toolchain (NDK, CMake, build-tools) — that would be another
# ~5 GB to compile locally something EAS compiles for free.
#
# The emulator can settle every question that does not involve real radios:
#
#   ✓ Does the map render offline from the bundled packs (T-063)
#   ✓ Do the migrations run, does the debug screen work, does the content pack load
#   ✓ Do the permission dialogs appear and get recorded correctly
#   ✓ Does a replayed GPX route produce a trace, drive the sampling gate (T-034)
#     and reshuffle the geofence set (T-039/T-076) — Extended controls ▸ Location
#
#   ✗ Battery cost (T-054). There is no battery.
#   ✗ OEM background killers (ARCHITECTURE §6.2). There is no OEM.
#   ✗ Force-quit relaunch behaviour, barometer, real GPS noise.
#   ✗ Anything iOS-specific: the 20-region cap (D-033), data protection,
#     pausesUpdatesAutomatically.
#
# CONTEXT §6.6 stands: real-device testing remains mandatory for anything
# touching recording. This makes the app visible; it does not make it proven.
set -euo pipefail
cd "$(dirname "$0")/.."

SDK_DIR="tools/android-sdk"

# Pinned deliberately — an unpinned "latest" makes a machine unreproducible.
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"

# API 34 (Android 14) on x86_64: new enough to exercise the Android 14
# FOREGROUND_SERVICE_LOCATION requirement (ARCHITECTURE §6.2) and the runtime
# notification permission, old enough to be widely mirrored. `google_apis`
# rather than `google_apis_playstore` because a non-Play image is rootable and
# far easier to inspect; we need no Play Services.
SYSTEM_IMAGE="system-images;android-34;google_apis;x86_64"
AVD_NAME="madeira"

if [ ! -d "tools/jdk" ]; then
  echo "No JDK. Run: bash tools/fetch-toolchain.sh" >&2
  exit 1
fi

JAVA_HOME_DIR="$(cd tools/jdk/* && pwd)"
export JAVA_HOME="$JAVA_HOME_DIR"
export PATH="$JAVA_HOME/bin:$PATH"

mkdir -p "$SDK_DIR"

if [ ! -d "$SDK_DIR/cmdline-tools/latest" ]; then
  echo "Fetching Android command-line tools…"
  curl -fL "$CMDLINE_TOOLS_URL" -o "$SDK_DIR/cmdline-tools.zip"
  # The zip contains a bare `cmdline-tools/` folder, but sdkmanager insists on
  # living at cmdline-tools/latest/ or it cannot find its own packages.
  unzip -q "$SDK_DIR/cmdline-tools.zip" -d "$SDK_DIR/tmp"
  mkdir -p "$SDK_DIR/cmdline-tools"
  mv "$SDK_DIR/tmp/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
  rm -rf "$SDK_DIR/tmp" "$SDK_DIR/cmdline-tools.zip"
fi

SDKMANAGER="$SDK_DIR/cmdline-tools/latest/bin/sdkmanager.bat"
AVDMANAGER="$SDK_DIR/cmdline-tools/latest/bin/avdmanager.bat"
export ANDROID_HOME="$(pwd)/$SDK_DIR"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

echo "Accepting SDK licences…"
yes | "$SDKMANAGER" --sdk_root="$ANDROID_HOME" --licenses > /dev/null || true

echo "Fetching platform-tools, emulator and the system image (~2.5 GB)…"
"$SDKMANAGER" --sdk_root="$ANDROID_HOME" \
  "platform-tools" "emulator" "$SYSTEM_IMAGE"

if ! "$AVDMANAGER" list avd 2>/dev/null | grep -q "Name: $AVD_NAME"; then
  echo "Creating the '$AVD_NAME' virtual device…"
  # A mid-range phone shape on purpose. The app is read at arm's length in
  # sunlight by people who are not looking for detail (D-015); testing it on a
  # giant desktop-sized viewport would flatter the layout.
  echo "no" | "$AVDMANAGER" create avd \
    --name "$AVD_NAME" \
    --package "$SYSTEM_IMAGE" \
    --device "pixel_6" \
    --force
fi

cat <<'DONE'

Done. Two commands from here, both from the repo root:

  bash tools/run-emulator.sh          start the virtual phone
  bash tools/install-apk.sh <path>    install an EAS-built APK into it

See docs/dev-build.md for what to check once it is running.
DONE

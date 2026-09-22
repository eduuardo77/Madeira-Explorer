#!/usr/bin/env bash
# Read the state of a running soak test (T-051) without touching the phone.
#
#     bash tools/soak-check.sh                 # whichever device is attached
#     bash tools/soak-check.sh 192.168.1.136   # the phone over WiFi
#
# ⚠ **THE PHONE MUST NOT BE PLUGGED IN.** Android's Doze is the single biggest
# threat to a background recorder, and it never engages while charging —
# `dumpsys deviceidle` reports `mCharging=true mState=ACTIVE` for as long as the
# cable is in. A 72-hour soak on a charger tests almost nothing T-051 is about,
# and it cannot answer T-054 at all. That is why this script reads over WiFi.
#
# ⚠ It is deliberately READ-ONLY and never launches or foregrounds the app.
# "Untouched" is the whole experiment: opening the app resets exactly the OEM
# timers being measured, so a check that woke it would destroy what it came to
# read. Everything below comes from `dumpsys` and one file mtime.
set -euo pipefail
cd "$(dirname "$0")/.."

ADB="$(pwd)/tools/android-sdk/platform-tools/adb.exe"
PKG="com.proa.madeira"
HOST="${1:-}"

# ⚠ A serial is always chosen explicitly. Once `adb tcpip` is on, the same phone
# appears TWICE — over USB and over WiFi — and a bare `adb shell` then fails with
# "more than one device". That failure printed as a dead recorder the first time
# this script ran, which is the wrong answer to an important question.
if [ -n "$HOST" ]; then
  "$ADB" connect "${HOST}:5555" >/dev/null 2>&1 || true
  TARGET="${HOST}:5555"
else
  TARGET="$("$ADB" devices | awk '$2=="device"{print $1; exit}')"
fi

if [ -z "$TARGET" ]; then
  echo "No device. Plug the phone in, or pass its WiFi address." >&2
  exit 1
fi

run() { MSYS_NO_PATHCONV=1 "$ADB" -s "$TARGET" shell "$@" 2>/dev/null | tr -d '\r'; }

# `grep -c` exits 1 when it counts zero, which `set -e` treats as fatal.
count() { grep -c "$1" || true; }

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==================================="
echo "target        $TARGET"

# --- Is the recorder actually alive? ----------------------------------------
# ⚠ Ask the OS, never the app. T-174 is precisely this mistake: the app's own
# `isRecording()` reports that the task is REGISTERED, and that flag outlives the
# service — it claimed "recording" for three weeks while nothing ran.
SERVICE=$(run dumpsys activity services "$PKG" | count "LocationTaskService")
REQUEST=$(run dumpsys location | count "WorkSource{[0-9]* $PKG}")

if [ "$SERVICE" -gt 0 ] && [ "$REQUEST" -gt 0 ]; then
  echo "recorder      ALIVE   (foreground service up, OS location request present)"
else
  echo "recorder      DEAD    (service=$SERVICE, os-request=$REQUEST)  <- the soak has failed"
fi

# --- Power ------------------------------------------------------------------
LEVEL=$(run dumpsys battery | grep "level:" | head -1 | tr -dc '0-9')
PLUGGED=$(run dumpsys battery | grep -E "USB powered|AC powered" | count "true")
if [ "${PLUGGED:-0}" -gt 0 ]; then
  echo "battery       ${LEVEL:-?}%   PLUGGED IN — Doze will never engage, this soak proves nothing"
else
  echo "battery       ${LEVEL:-?}%"
fi

echo "doze          $(run dumpsys deviceidle | grep -E '^  mState=' | head -1 | sed 's/^ *//')"

# --- Is data actually arriving? ---------------------------------------------
# The file's mtime, not a query: reading the database would mean pulling a 27 MB
# WAL over WiFi on every check.
echo "last db write $(run run-as "$PKG" stat -c '%y' files/SQLite/madeira.db-wal | head -1)"

echo
echo "Silence is not failure on its own: the sampling gate suppresses fixes while"
echo "the phone is still, which is most of a soak. The recorder line above is the"
echo "one that says whether the test is still running."

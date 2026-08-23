<#
.SYNOPSIS
  One command for working against the Android that is plugged in (T-167/T-168 era).

.DESCRIPTION
  Sets the three environment variables the build needs, checks the four things
  that actually go wrong, and then either builds the app onto the phone or
  starts the Metro server that feeds it JavaScript.

  ⚠ WHY THIS SCRIPT EXISTS RATHER THAN FOUR LINES IN A DOCUMENT
  -------------------------------------------------------------
  The environment variables live **only in the PowerShell window they were typed
  into**. Close it, or open a second one for Metro, and they are gone — and the
  failure that produces is a Gradle error about a missing SDK that says nothing
  about environment variables. Every command below sets them itself, so there is
  no window that is "the right window".

  ⚠ It never installs anything and never touches the phone's storage. The two
  toolchains it points at are the ones already in the repository
  (`tools/android-sdk`, `tools/jdk`), both gitignored, both re-fetchable.

.PARAMETER Start
  Start Metro for the development build. THE DAILY COMMAND.

.PARAMETER Build
  Compile the development build and install it over USB. Needed once, and again
  after any native change (a new native dependency, or an app.json edit).

.PARAMETER Release
  Compile the standalone build — the one that carries its own JavaScript and can
  therefore go up a levada without a laptop.

.PARAMETER Lan
  With -Start: serve over the local network instead of a tunnel. Faster at the
  desk; requires the phone and the laptop on the same wifi.

.EXAMPLE
  .\tools\dev-phone.ps1 -Build
  .\tools\dev-phone.ps1 -Start
#>

[CmdletBinding()]
param(
    [switch] $Start,
    [switch] $Build,
    [switch] $Release,
    [switch] $Lan
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$appDir = Join-Path $repo 'app'

function Say($text)  { Write-Host $text -ForegroundColor Cyan }
function Warn($text) { Write-Host $text -ForegroundColor Yellow }
function Die($text)  { Write-Host $text -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
# The toolchains, found rather than assumed
# ---------------------------------------------------------------------------

$sdk = Join-Path $repo 'tools\android-sdk'
if (-not (Test-Path $sdk)) {
    Die "No Android SDK at $sdk. Run: bash tools/fetch-android-emulator.sh"
}

# ⚠ Discovered, not hardcoded. The JDK folder carries its exact version in its
# name (`jdk-21.0.12+8`), so a patch bump silently breaks a hardcoded path —
# and the error Gradle gives for that is about Java, not about this line.
$jdkParent = Join-Path $repo 'tools\jdk'
$jdk = $null
if (Test-Path $jdkParent) {
    $jdk = Get-ChildItem -Path $jdkParent -Directory -Filter 'jdk-*' |
        Sort-Object Name -Descending |
        Select-Object -First 1
}
if ($null -eq $jdk) {
    Die "No JDK under $jdkParent. Run: bash tools/fetch-toolchain.sh"
}

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:JAVA_HOME = $jdk.FullName
$env:PATH = "$($jdk.FullName)\bin;$sdk\platform-tools;$env:PATH"

Say "JAVA_HOME    $env:JAVA_HOME"
Say "ANDROID_HOME $env:ANDROID_HOME"

# ---------------------------------------------------------------------------
# The four things that actually go wrong
# ---------------------------------------------------------------------------

# 1. The Maps key. Its absence is a grey grid that reads as a broken app, and
#    that has cost this project a debugging session more than once (D-057).
$envFile = Join-Path $appDir '.env'
if (-not (Test-Path $envFile)) {
    Warn "⚠ app\.env is missing — the map will be a GREY GRID and nothing else will fail."
    Warn "  copy app\.env.example to app\.env and paste the Google Maps key into it."
} elseif (-not (Select-String -Path $envFile -Pattern 'GOOGLE_MAPS_API_KEY=\S' -Quiet)) {
    Warn "⚠ app\.env has no key in GOOGLE_MAPS_API_KEY — the map will be a GREY GRID."
}

# 2. node_modules.
if (-not (Test-Path (Join-Path $appDir 'node_modules'))) {
    Warn "node_modules missing — running npm install first."
    Push-Location $appDir
    try { & npm install } finally { Pop-Location }
}

# 3. The phone, but only when something is about to be pushed to it.
if ($Build -or $Release) {
    $adb = Join-Path $sdk 'platform-tools\adb.exe'
    if (-not (Test-Path $adb)) {
        Die "adb not found at $adb"
    }

    $devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_.Trim() -ne '' }

    if (-not $devices) {
        Die @"
No device. In order, the three things it usually is:
  1. the cable (a charge-only cable looks identical to a data one)
  2. Developer options -> USB debugging, and the fingerprint prompt on the phone
  3. on Huawei/Xiaomi/Oppo: a SECOND switch, usually 'Install via USB'
"@
    }

    foreach ($line in $devices) {
        if ($line -match 'unauthorized') {
            Die "The phone says unauthorized — accept the 'Allow USB debugging' prompt on its screen."
        }
    }

    Say "Device: $($devices -join ', ')"
}

# ---------------------------------------------------------------------------
# What was asked for
# ---------------------------------------------------------------------------

Push-Location $appDir
try {
    if ($Build) {
        Say "Building the development build and installing it (~4 minutes cold)…"
        & npx expo run:android
    }
    elseif ($Release) {
        # ⚠ The build to take walking. A development build holds no JavaScript
        # of its own, so without Metro it cannot start — and it is also the only
        # kind that can answer battery (T-054) or overnight survival honestly.
        Say "Building the standalone release build…"
        & npx expo run:android --variant release
    }
    else {
        # The default, because it is the one typed every day.
        $mode = if ($Lan) { '--lan' } else { '--tunnel' }
        Say "Starting Metro ($mode). Open Proa on the phone; press r here to reload."
        & npx expo start --dev-client $mode
    }
}
finally {
    Pop-Location
}

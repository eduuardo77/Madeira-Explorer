<#
.SYNOPSIS
  One command for working against the Android that is plugged in (T-167/T-168 era).

.DESCRIPTION
  Sets the three environment variables the build needs, checks the four things
  that actually go wrong, and then either builds the app onto the phone or
  starts the Metro server that feeds it JavaScript.

  !! WHY THIS SCRIPT EXISTS RATHER THAN FOUR LINES IN A DOCUMENT
  -------------------------------------------------------------
  The environment variables live **only in the PowerShell window they were typed
  into**. Close it, or open a second one for Metro, and they are gone -- and the
  failure that produces is a Gradle error about a missing SDK that says nothing
  about environment variables. Every command below sets them itself, so there is
  no window that is "the right window".

  !! Nothing here installs anything system-wide or needs an administrator, and
  nothing touches the phone's storage. `-Setup` fetches the two toolchains into
  `tools\` -- gitignored, re-fetchable, and removed completely by deleting those
  two folders. That matters on a **borrowed** machine, which is exactly where
  `-Setup` gets used.

.PARAMETER Setup
  Fetch the two toolchains this build needs -- a portable Temurin JDK and the
  Android command-line tools -- into `tools\`, on a machine that has neither.
  For a borrowed PC: nothing is installed system-wide, nothing needs an
  administrator, and deleting `tools\jdk` and `tools\android-sdk` removes all
  of it. **It does NOT fetch the emulator or its 4.2 GB system image** -- with a
  real phone plugged in, those are the largest thing you would download and
  never use.

.PARAMETER Start
  Start Metro for the development build. THE DAILY COMMAND.

.PARAMETER Build
  Compile the development build and install it over USB. Needed once, and again
  after any native change (a new native dependency, or an app.json edit).

.PARAMETER Release
  Compile the standalone build -- the one that carries its own JavaScript and can
  therefore go up a levada without a laptop.

.PARAMETER Lan
  With -Start: serve over the local network instead of a tunnel. Faster at the
  desk; requires the phone and the laptop on the same wifi.

.PARAMETER Usb
  With -Start: serve over the USB cable. No wifi, no tunnel, no ngrok, no
  firewall prompt -- `adb reverse` points the phone's own localhost:8081 at this
  laptop, so there is no address that has to be reachable from anywhere.
  THE ONE TO USE AT THE DESK. The tunnel is for walking away from it.

.EXAMPLE
  .\tools\dev-phone.ps1 -Build
  .\tools\dev-phone.ps1 -Start
#>

[CmdletBinding()]
param(
    [switch] $Setup,
    [switch] $Start,
    [switch] $Build,
    [switch] $Release,
    [switch] $Lan,
    [switch] $Usb
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$appDir = Join-Path $repo 'app'

function Say($text)  { Write-Host $text -ForegroundColor Cyan }
function Warn($text) { Write-Host $text -ForegroundColor Yellow }
function Die($text)  { Write-Host $text -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
# The toolchains -- fetched on request, then found rather than assumed
# ---------------------------------------------------------------------------
#
# !! THREE PLACES, IN THIS ORDER, AND THE ORDER IS THE POINT. The project's own
# machine keeps both toolchains inside the repository (CONTEXT 6.7: no
# system-wide Java for one build step). A borrowed machine may instead have
# Android Studio, which ships both. Whatever is found first wins, so the same
# command works on either without being told which it is.

$repoSdk = Join-Path $repo 'tools\android-sdk'
$repoJdkParent = Join-Path $repo 'tools\jdk'

function Find-RepoJdk {
    if (-not (Test-Path $repoJdkParent)) { return $null }
    # !! Discovered, not hardcoded. The folder carries its exact patch version
    # (`jdk-21.0.12+8`), so a bump renames it -- and the error Gradle gives for a
    # stale path is about Java, not about the path.
    return Get-ChildItem -Path $repoJdkParent -Directory -Filter 'jdk-*' |
        Sort-Object Name -Descending |
        Select-Object -First 1 |
        ForEach-Object { $_.FullName }
}

if ($Setup) {
    # A portable JDK, pinned and checksummed exactly as tools/fetch-toolchain.sh
    # pins it -- two scripts fetching two different Javas is a bug waiting for a
    # rainy day.
    $jdkUrl = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12%2B8/OpenJDK21U-jdk_x64_windows_hotspot_21.0.12_8.zip'
    $jdkSha = '9ba963ee2371874a74185d18bc7bb2ab9407df7683300855ed7606e0662321d0'
    $toolsUrl = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'

    if ($null -eq (Find-RepoJdk)) {
        Say 'Fetching the Temurin JDK (196 MB)...'
        New-Item -ItemType Directory -Force -Path $repoJdkParent | Out-Null
        $zip = Join-Path $repoJdkParent 'temurin.zip'
        # !! TLS 1.2 explicitly: PowerShell 5.1 still defaults to TLS 1.0 on some
        # builds, and GitHub refuses it with a connection error that looks like
        # a network fault.
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $jdkUrl -OutFile $zip -UseBasicParsing

        # Verify rather than trust -- the same rule as the bash script.
        $got = (Get-FileHash -Path $zip -Algorithm SHA256).Hash.ToLower()
        if ($got -ne $jdkSha) {
            Remove-Item $zip -Force
            Die "JDK checksum mismatch.`n  expected $jdkSha`n  got      $got"
        }
        Expand-Archive -Path $zip -DestinationPath $repoJdkParent -Force
        Remove-Item $zip -Force
    } else {
        Say 'JDK already present, skipping.'
    }

    if (-not (Test-Path (Join-Path $repoSdk 'cmdline-tools\latest'))) {
        Say 'Fetching the Android command-line tools (~150 MB)...'
        New-Item -ItemType Directory -Force -Path $repoSdk | Out-Null
        $zip = Join-Path $repoSdk 'cmdline-tools.zip'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $toolsUrl -OutFile $zip -UseBasicParsing
        $tmp = Join-Path $repoSdk 'tmp'
        Expand-Archive -Path $zip -DestinationPath $tmp -Force
        # !! sdkmanager insists on living at cmdline-tools\latest\ or it cannot
        # find its own packages. The zip does not put it there.
        New-Item -ItemType Directory -Force -Path (Join-Path $repoSdk 'cmdline-tools') | Out-Null
        Move-Item -Path (Join-Path $tmp 'cmdline-tools') -Destination (Join-Path $repoSdk 'cmdline-tools\latest')
        Remove-Item $tmp -Recurse -Force
        Remove-Item $zip -Force
    } else {
        Say 'Android command-line tools already present, skipping.'
    }

    $env:JAVA_HOME = Find-RepoJdk
    $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
    $sdkManager = Join-Path $repoSdk 'cmdline-tools\latest\bin\sdkmanager.bat'

    Warn ''
    Warn 'Google now wants its licences accepted. Press y and Enter at each prompt.'
    & $sdkManager --sdk_root="$repoSdk" --licenses

    Say 'Fetching platform-tools (adb) -- about 15 MB...'
    & $sdkManager --sdk_root="$repoSdk" 'platform-tools'

    Say ''
    Say 'Toolchains ready. Next: .\tools\dev-phone.ps1 -Build'
    Warn 'That first build downloads another ~4 GB through Gradle -- the NDK and'
    Warn 'the build tools. It is a one-off, and it lands in tools\android-sdk'
    Warn 'and %USERPROFILE%\.gradle.'
    exit 0
}

# Where is the SDK?
$sdk = $null
foreach ($candidate in @(
    $repoSdk,
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk')      # Android Studio's default
)) {
    if ($candidate -and (Test-Path $candidate)) { $sdk = $candidate; break }
}
if ($null -eq $sdk) {
    $studio = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    Die ("No Android SDK found. Looked in:`n" +
         "  $repoSdk`n" +
         "  ANDROID_HOME / ANDROID_SDK_ROOT`n" +
         "  $studio`n`n" +
         "On a machine that has never built this app:`n" +
         "  .\tools\dev-phone.ps1 -Setup")
}

# Where is Java?
$jdkPath = Find-RepoJdk
if ($null -eq $jdkPath) {
    foreach ($candidate in @(
        $env:JAVA_HOME,
        'C:\Program Files\Android\Android Studio\jbr'   # Studio's bundled JDK
    )) {
        if ($candidate -and (Test-Path (Join-Path $candidate 'bin\java.exe'))) {
            $jdkPath = $candidate
            break
        }
    }
}
if ($null -eq $jdkPath) {
    Die "No JDK found. Run: .\tools\dev-phone.ps1 -Setup"
}

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:JAVA_HOME = $jdkPath
$env:PATH = "$jdkPath\bin;$sdk\platform-tools;$env:PATH"

Say "JAVA_HOME    $env:JAVA_HOME"
Say "ANDROID_HOME $env:ANDROID_HOME"

# ---------------------------------------------------------------------------
# The four things that actually go wrong
# ---------------------------------------------------------------------------

# 1. The Maps key. Its absence is a grey grid that reads as a broken app, and
#    that has cost this project a debugging session more than once (D-057).
$envFile = Join-Path $appDir '.env'
if (-not (Test-Path $envFile)) {
    Warn "!! app\.env is missing -- the map will be a GREY GRID and nothing else will fail."
    Warn "  copy app\.env.example to app\.env and paste the Google Maps key into it."
} elseif (-not (Select-String -Path $envFile -Pattern 'GOOGLE_MAPS_API_KEY=\S' -Quiet)) {
    Warn "!! app\.env has no key in GOOGLE_MAPS_API_KEY -- the map will be a GREY GRID."
}

# 2. node_modules.
if (-not (Test-Path (Join-Path $appDir 'node_modules'))) {
    Warn "node_modules missing -- running npm install first."
    Push-Location $appDir
    try { & npm install } finally { Pop-Location }
}

# 3. The phone, but only when something is about to be pushed to it.
if ($Build -or $Release -or $Usb) {
    $adb = Join-Path $sdk 'platform-tools\adb.exe'
    if (-not (Test-Path $adb)) {
        Die "adb not found at $adb"
    }

    $devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_.Trim() -ne '' }

    if (-not $devices) {
        Die ("No device. In order, the three things it usually is:`n" +
             "  1. the cable (a charge-only cable looks identical to a data one)`n" +
             "  2. Developer options -> USB debugging, and the prompt on the phone`n" +
             "  3. on Huawei/Xiaomi/Oppo: a SECOND switch, usually 'Install via USB'")
    }

    foreach ($line in $devices) {
        if ($line -match 'unauthorized') {
            Die "The phone says unauthorized -- accept the 'Allow USB debugging' prompt on its screen."
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
        Say "Building the development build and installing it (~4 minutes cold)..."
        & npx expo run:android
    }
    elseif ($Release) {
        # !! The build to take walking. A development build holds no JavaScript
        # of its own, so without Metro it cannot start -- and it is also the only
        # kind that can answer battery (T-054) or overnight survival honestly.
        Say "Building the standalone release build..."
        & npx expo run:android --variant release
    }
    elseif ($Usb) {
        # !! No network at all. `adb reverse` makes the phone's own
        # localhost:8081 arrive at this laptop down the cable, so "host
        # unreachable" cannot happen: there is no host to reach. Wifi client
        # isolation, Windows Firewall and a failed ngrok install are all
        # sidestepped rather than diagnosed.
        $adb = Join-Path $sdk 'platform-tools\adb.exe'
        Say 'Pointing the phone localhost:8081 at this laptop over USB...'
        & $adb reverse tcp:8081 tcp:8081 | Out-Null
        Say 'Starting Metro (USB). Press a in this window to open the app.'
        & npx expo start --dev-client --localhost
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

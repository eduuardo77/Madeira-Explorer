# Getting the app onto something that can run it

> ### ⚠ You need a Google Maps API key now — 2026-08-14 (D-057)
> The app draws Google Maps on Android. Without a key the map is a **grey grid with the Google
> logo**, which looks exactly like a broken screen and is not one — recording, stamps, the passport
> and the card all work regardless.
>
> ```bash
> cp app/.env.example app/.env      # then paste your key into it
> ```
>
> The key comes from the Google Cloud console: create a project, enable **Maps SDK for Android**,
> create an API key, and restrict it to the package `com.proa.madeira` **plus your build's
> SHA-1 fingerprint** and to that one API. Map display on the mobile SDK is free and unlimited
> (SKU `6DE1-4D9C-5B67`); the project still needs billing enabled.
>
> ```bash
> # the debug fingerprint, for the key restriction
> # ⚠ NOT ~/.android/debug.keystore — Expo's prebuild writes its own into the
> # generated project, and that is the one this app is actually signed with.
> tools/jdk/jdk-21.0.12+8/bin/keytool -list -v >   -keystore app/android/app/debug.keystore -alias androiddebugkey >   -storepass android -keypass android | grep SHA1
> ```
>
> ⚠ **The debug key is not yours and not secret.** It comes from the Expo
> template, so every Expo project shares it. That is fine for a debug build and
> is exactly why it must never be the only fingerprint on a released key.
>
> ⚠ **THE RELEASE FINGERPRINT IS A DIFFERENT ONE, AND IT IS NOT YOUR UPLOAD
> KEY.** Google Play re-signs every new app (Play App Signing), so the
> certificate the store serves is Google's, not the one you uploaded with. The
> SHA-1 to restrict against is in **Play Console → Test and release → Setup →
> App integrity → App signing key certificate**. Restricting to the upload key
> instead is the classic way to ship an app whose map is blank for everyone but
> the developer. One key can carry several package + SHA-1 pairs, so add both.
>
> `app/.env` is gitignored. `app.config.js` injects it; `app.json` holds everything else.

---

## Getting the Google Maps key without spending money

**Checked against Google's own pricing and cost-management pages on 2026-08-14.** Pricing changes;
re-check before trusting this.

### The one fact that makes this safe

**Map display in a native mobile app is SKU `6DE1-4D9C-5B67` — free cap *Unlimited*, no charge at
any tier.** It is not "free up to N". The 10,000-then-$7/1,000 figure everybody quotes is the
**web** Dynamic Maps SKU (`FAF4-3B2D-51B2`) and does not apply to an Android app.

What *does* cost money is the rest of the platform: Places, Directions, Geocoding, Static Maps.
**This app calls none of them.** There is no code path that can — the Directions handoff was
deleted in D-055, so the only request the app makes is "draw the map".

### The structural protection: enable one API and only one

An API that was never enabled cannot bill you, whatever happens to the key. So:

1. **console.cloud.google.com** → new project (`madeira-explorer`).
2. **Billing** → link a billing account. ⚠ A card is required even for a free SKU. Steps 3–6 are
   what make that safe.
3. **APIs & Services → Library** → **Maps SDK for Android** → *Enable*. **Nothing else.** Not
   Places, not Directions, not Maps SDK for iOS "for later" — add that the day there is an iOS
   build.
4. **APIs & Services → Credentials → Create credentials → API key.**
5. Edit the key → **Application restrictions → Android apps**, and add the package
   `com.proa.madeira` with the SHA-1 fingerprint (see above for which one — debug and
   release are different, and the release one is Google's, not your upload key).
6. Same page → **API restrictions → Restrict key** → **Maps SDK for Android** only. Save.

A leaked key can then only draw a map, only from an app signed by you, and that draw is free.

### ⚠ Two ways the key silently stops working, and how to tell them apart

**The restriction is bound to the package name AND the SHA-1. Change either and the map dies with
no error, no crash and nothing in the log.** Both happened on 2026-08-17.

**1. The package name changed.** D-074 renamed the app to `com.proa.madeira`, and a key restricted
to the old package keeps returning tiles to nobody. The fix is an **edit, not a new key** — Cloud
console → *APIs & Services → Credentials* → the existing key → *Application restrictions → Android
apps* → change the package. Leave the SHA-1 alone. ⚠ Google says changes take **up to 5 minutes**
to propagate, so a grey map immediately afterwards is not yet a failure.

**2. The SHA-1 changed.** `npx expo prebuild --clean` regenerates `android/`, and that includes
`app/android/app/debug.keystore`. It has been stable so far because it is React Native's template
keystore — its certificate is valid from **31 December 2013**, which is how you can tell it is the
shared one rather than yours:

```bash
export JAVA_HOME="$(pwd)/tools/jdk/jdk-21.0.12+8"
"$JAVA_HOME/bin/keytool" -list -v -keystore app/android/app/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

⚠ **That fingerprint is not really yours, and the restriction is weaker than it looks.** Thousands
of projects ship the same template keystore, so "package + this SHA-1" is guessable. Acceptable for
a **debug** key on a free SKU; not a security control. The release fingerprint below is the one that
matters.

### ⚠ Grey map or black map — they are different faults

| What you see | Cause | Fix |
|---|---|---|
| **Grey grid, Google logo, no tiles** | The **API key** is missing, wrong, or restricted to the wrong package/SHA-1 | This section |
| **Pure black, no logo, no error** | The **emulator GPU** — `-gpu host` never draws the map surface | `tools/run-emulator.sh` (defaults to swiftshader); cold-boot with `MADEIRA_COLD=1` |

Telling these apart first saves debugging the wrong half of the stack. **The Google wordmark is the
tell:** the SDK drew *something*, so the surface works and the problem is the key.

### ⚠ Before publishing: a second entry, or the map is grey for every real user

**Google re-signs uploaded apps with their own key** (Play App Signing), so the SHA-1 in the
installed app is **not** the debug one above and **not** your upload key.

- **Play Console → Test and release → Setup → App integrity → App signing key certificate** → copy
  its SHA-1.
- Add it as a **second Android entry on the same key**. One key carries several package + SHA-1
  pairs, so debug and release coexist.

⚠ **Skip this and the map works perfectly in every build you make and is grey for everybody who
installs from the store** — invisible until a stranger opens it. This is the worst version of the
failure and it belongs on the pre-launch checklist (T-137).

### ⚠ A budget does NOT cap spending

Google's own words: *"Setting a budget does not automatically cap Google Cloud or Google Maps
Platform usage or spending."* It emails you; it does not stop anything.

- **Budget alert as a tripwire.** Billing → Budgets & alerts → **€1**, alerting at 50/90/100%. With
  nothing billable enabled the correct lifetime spend is €0.00, so *any* alert means something is
  enabled that should not be.
- **Quota limits are the actual hard stop** (APIs & Services → the API → Quotas): requests simply
  stop being served past the limit. Not needed while nothing billable is enabled — but it is the
  lever if a paid API is ever added, and setting one too low is its own outage.
- **Verify after a few days:** Billing → Reports should read €0.00.

### The realistic failure mode

Not this app. It is enabling an extra API later to try something, forgetting, and leaving it
reachable from a key that is already in a shipped binary. The €1 alert is what catches that.




**This is the only real blocker in the project.** Nothing written so far has ever run, and
nothing can until this exists — background location and MapLibre both need a native build, so
Expo Go is out and every claim is a hypothesis until then.

**Corrected 2026-08-10.** An earlier version of this document said "Android alone unblocks
everything, and it needs no Apple Developer membership." That was written without checking what
hardware exists. The actual situation:

| | |
|---|---|
| Phone | **iPhone 15** |
| Computer | Windows, portable JDK 21 (`tools/fetch-toolchain.sh`) |
| Android device | **none** |
| Mac | none |

Which makes the free advice wrong: an iPhone development build requires the **Apple Developer
Program, $99/year**, with no way around it. A free Apple ID can sign an app for a personal
device only through Xcode, which needs a Mac.

So there are three paths, and they are not alternatives so much as a sequence.

---

## Path A — the emulator, free, today

A virtual Android phone on the Windows machine. **This is the recommended first step** and it
needs no hardware, no Apple money, and no decision about anything.

```bash
bash tools/fetch-android-emulator.sh
```

~2.5 GB, portable, entirely inside `tools/android-sdk/` — gitignored, nothing installed
system-wide, delete the folder to undo it. **Already done on this machine (2026-08-10),
including the AVD.**

✅ **Working since 2026-08-11**, when the project lead enabled CPU virtualization in firmware.
`emulator-check accel` returns `0` and reports WHPX usable; the `madeira` AVD boots to Android 14
in about 55 seconds. ⚠ Note the reporting quirk: Windows still says
`VirtualizationFirmwareEnabled: False` once a hypervisor is running, so **ask
`emulator-check accel`, not Windows**.

*Historical note, kept because it cost a week:* it would not start until CPU virtualization was
enabled in the BIOS — measured on this
machine and switched off there. That is a one-time firmware toggle no program can make;
**[emulator-setup.md](emulator-setup.md)** has the exact ASUS menu path and the driver step
that follows it. Roughly five minutes, and nothing else in Path A works before it.

The install deliberately skips the native build toolchain (NDK, CMake — another ~5 GB): EAS
compiles the APK in the cloud for free, and the emulator only has to run it.

Then create a free Expo account, build once, and install:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest build --profile development --platform android
```

```bash
bash tools/run-emulator.sh
```

```bash
bash tools/install-apk.sh <the-apk-that-build-printed>
```

### What the emulator settles

Everything that does not involve a real radio — which is most of the currently-unverified pile:

- **Does the map render at all**, offline, from the bundled packs — terrain shading, Portuguese
  labels, the lot (T-063, D-035, D-036). This has never been seen.
- Migrations run, the debug screen works, the content pack loads.
- Permission dialogs appear and are recorded correctly.
- **A replayed GPX route** (Extended controls ▸ Location ▸ Routes, or `bash
  tools/replay-route.sh`) drives the whole recorder end-to-end: fixes land in `raw_fix`, the trace
  draws, the sampling gate switches profiles (T-034), and the geofence set reshuffles around the
  synthetic fixture (T-039, T-076). **Verified 2026-08-12** — 41 replayed points produced 12
  fixes 15 s apart, a trip, and a drawn trace.

  ⚠ **You must record on the `driving` profile for any of that to happen** (D-047). `walking` and
  `stationary` ask for `balanced`/`coarse` accuracy, which resolves to the *network* provider —
  wifi and cell geolocation — and an emulator has neither. Those profiles register no request at
  all and produce a flawless impersonation of a dead recorder; it cost a day before it was
  understood. **`adb shell dumpsys location` is the one-line check:** while recording you want to
  see `gps provider: ProviderRequest[@…, HIGH_ACCURACY, WorkSource{… com.proa.madeira}]`.
  No line naming our package means nothing is being asked for.

### What it cannot settle, ever

- **Battery** (T-054). There is no battery. The honest figure the onboarding copy is required
  to quote (T-042) cannot come from here.
- **OEM background killers** (ARCHITECTURE §6.2). There is no OEM.
- **Force-quit relaunch**, barometer, real GPS noise under canopy.
- **Whether a `balanced`-accuracy request works at all** (D-047). It should on a real phone —
  wifi and cell geolocation are real there — but that is an argument, not a reading, and the
  `walking` and `stationary` profiles both depend on it. **T-051 owes the measurement.**
- Anything iOS: the 20-region cap driving D-033, `CompleteUntilFirstUserAuthentication`,
  `pausesUpdatesAutomatically`.

CONTEXT §6.6 stands unchanged: real-device testing is mandatory for anything touching
recording. **This makes the app visible. It does not make it proven.**

---

## Path B — a cheap used Android phone, ~€50–100 once

**This is already on the plan.** T-021a and the sampling-bias warning in HANDOFF say it
outright: the iPhone 15 has better GNSS than much of what tourists actually carry, so iPhone-only
data is best-case, and tuning thresholds against it risks shipping an app that quietly
under-credits people on cheaper hardware — the exact uninstall trigger D-009 exists to avoid.

So a mid-range Android was always going to be needed. Bought now instead of later it is also
the cheapest way to get real hardware at all: **one-time, and less than the Apple fee**. Any
recent-ish handset with a barometer works; the more mid-range and OEM-skinned, the more honest
the battery and background-survival results.

This is what unlocks T-051–T-055 (the soak tests), the real T-076 walk, and D-033's three
guessed constants.

---

## ⚠ The phone is here — working against it without building an APK each time (2026-08-22)

**Path B happened.** The project lead has an Android and keeps it. This section is the daily loop
for changing the app and seeing the change on that phone **without producing a new APK**, and the
one question it answers first is: *what has to be installed on the phone?*

### What goes on the phone: one app, and it is not Expo Go

**Install the app's own development build — nothing else.** `npx expo run:android` compiles it and
pushes it over the cable; there is no Play Store download and no second app to keep in sync.

⚠ **Expo Go cannot run this app, and reaching for it will waste an evening.** Expo Go carries a
fixed set of native modules; this app draws **Google Maps through `expo-maps` with an API key
injected by `app.config.js`**, records background location through a task manager, and ships under
its own package name (`com.proa.madeira`, D-074). None of that exists inside somebody else's
container app.

What the development build *adds* over a release build is the **dev launcher**: the JavaScript is
fetched from a Metro server on the laptop instead of being baked into the APK. That is the whole
trick — **the native half is installed once, and the half that changes every day is downloaded on
launch.**

### One-time, on the phone

1. **Settings → About phone → tap *Build number* seven times.** It says *You are now a developer*.
2. **Settings → System → Developer options → USB debugging**, on.
3. On Huawei/Xiaomi/Oppo skins there is a **second** switch, usually *Install via USB*. Without it
   the install fails with a permission error that does not mention USB.
4. Plug into the laptop and accept the **Allow USB debugging** fingerprint prompt on the phone.
5. Check the laptop can see it:

   ```powershell
   tools\android-sdk\platform-tools\adb.exe devices     # one line, "device", not "unauthorized"
   ```

⚠ **`adb root` drops `adb reverse`** (HANDOFF). If the phone stops receiving the bundle after a
root, that is why.

### ⚠ A Windows machine that has never built this — what has to be installed

Three things, and **only the first two need an installer.** Everything else the project fetches
into `tools\`, where deleting two folders removes it completely — which is the point when the
machine is borrowed.

| | Why | Admin needed? |
|---|---|---|
| **Node.js LTS** (22.x) | npm, Metro, and the unit tests, which use Node's own test runner | Yes, for the .msi |
| **Git for Windows** | cloning, and the `git pull` in the daily loop | Yes, for the installer |
| **JDK 21 + Android command-line tools** | Gradle and `adb` | **No** — `-Setup` puts them in `tools\` |

```powershell
git clone https://github.com/eduuardo77/Madeira-Explorer.git
cd Madeira-Explorer
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned     # see below
.\tools\dev-phone.ps1 -Setup                            # ~350 MB, no admin
.\tools\dev-phone.ps1 -Build                            # ~4 GB more, once
```

⚠ **Android Studio is not required, and installing it is the slower path.** If the borrowed
machine happens to have it, the script finds its SDK and its bundled JDK by itself and `-Setup` can
be skipped.

⚠ **If you cannot install anything at all** — a locked-down work laptop — Node and Git both have
portable zip builds that run from a folder without an installer. That is the only part of this list
with no no-admin route through the project's own scripts.

#### What it costs the borrowed machine, honestly

| | |
|---|---|
| Clone | ~30 MB |
| `npm install` → `app\node_modules` | ~500 MB |
| `-Setup` → `tools\jdk` + `tools\android-sdk` | ~350 MB |
| The first build: NDK, build-tools, platforms | **~4 GB**, into `tools\android-sdk` |
| Gradle's own cache | ~1.5 GB, into `%USERPROFILE%\.gradle` |

**Call it 6–7 GB and an hour**, most of it downloading once. ⚠ **The emulator is deliberately not
part of that** — `tools\fetch-android-emulator.sh` would add another 2.5 GB, of which a 4.2 GB
system image is the bulk, and with a real phone plugged in it is the largest thing you could
download and never use.

#### Giving the machine back

```powershell
Remove-Item -Recurse -Force tools\android-sdk, tools\jdk, app\node_modules
Remove-Item -Recurse -Force "$env:USERPROFILE\.gradle"
```

Then delete the clone. Nothing was written anywhere else, no service was installed, and
`Set-ExecutionPolicy -Scope CurrentUser Restricted` puts back the one setting that was changed.

⚠ **`app\.env` holds the Google Maps key and it is inside the clone.** Deleting the folder removes
it; leaving the folder on somebody else's machine leaves the key on it too.

#### ⚠ The phone's driver, which is the one Windows-only trap

Windows needs a USB driver before `adb` can see the phone at all, and the failure looks identical
to a bad cable. Windows Update usually supplies it on first connection — give it a minute and check
Device Manager for a device with a warning triangle. If one is there, the **Google USB Driver**
(`sdkmanager "extras;google;usb_driver"`) covers most handsets, and Huawei/Xiaomi/Oppo publish
their own.

---

### The laptop half, in PowerShell — what each line is for

⚠ **Everything below is typed into PowerShell on Windows.** Start menu → type
*PowerShell* → **Windows PowerShell**. It does **not** need to be run as administrator, and it must
**not** be Command Prompt (`cmd.exe`), where `$env:` syntax is not a thing.

#### 0. One line you may need before anything else works

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Windows refuses to run local `.ps1` scripts by default — including npm's own launcher. The symptom
is:

```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts
is disabled on this system.
```

`RemoteSigned` means *scripts written on this machine may run; scripts downloaded from the internet
must be signed*. It is per-user, needs no administrator, and is asked for once ever. Type `Y`.

#### 1. Get to the repository

```powershell
cd C:\Users\<you>\Madeira-Explorer
```

The path is whatever Explorer's address bar shows for the folder holding `app\`, `content\` and
`tools\`. Quote it if it contains spaces: `cd "C:\My Projects\Madeira-Explorer"`.

⚠ **Be at the repository root, not inside `app\`.** The next command reads `$PWD` — *the folder you
are standing in* — to find the toolchains, and from the wrong folder it points at directories that
do not exist.

#### 2. Get the code

```powershell
git pull
git checkout claude/android-app-ui-improvements-gwu584
```

#### 3. On a machine that has never built this, fetch the toolchains

```powershell
.\tools\dev-phone.ps1 -Setup
```

Skip it on a machine that already has `tools\android-sdk` and `tools\jdk`, or Android Studio —
the script finds all three. See the section above for what it costs.

#### 4. Build it onto the phone — one command

```powershell
.\tools\dev-phone.ps1 -Build
```

⚠ **The leading `.\` is required.** PowerShell will not run a script from the current directory
without it, and the error it gives instead suggests the file does not exist.

That script does five things, in this order, and stops with a plain-English reason if any of them
is not true:

1. **Points at the toolchains in this repository** — `tools\android-sdk` and `tools\jdk` — by
   setting `JAVA_HOME`, `ANDROID_HOME` and `PATH`. Nothing is installed system-wide.
2. **Checks `app\.env` has a Maps key**, because its absence is a grey grid that reads as a broken
   app rather than as a missing key.
3. **Runs `npm install`** if `node_modules` is not there.
4. **Checks the phone is actually visible**, and says which of the three usual causes it is.
5. **Runs `npx expo run:android`** — roughly four minutes the first time. It compiles, installs and
   launches the app on the phone.

#### ⚠ Why a script rather than four lines you paste

```powershell
$env:JAVA_HOME = "$PWD\tools\jdk\jdk-21.0.12+8"
```

`$env:NAME = "..."` sets an environment variable **for that PowerShell window only**. Close the
window — or open a second one to run Metro alongside the build — and it is gone. What you get then
is a Gradle error about a missing SDK that says nothing whatsoever about environment variables, on
a machine where the SDK is present. Every mode of the script sets them itself, so **there is no
"right window"** to keep open.

It also does not hardcode the JDK's version. The folder is named `jdk-21.0.12+8`; a patch bump
renames it, and a pasted path then breaks in a way that reads as a Java problem.

If you would rather see it by hand, this is the whole of what it sets:

```powershell
$env:ANDROID_HOME = "$PWD\tools\android-sdk"
$env:JAVA_HOME    = "$PWD\tools\jdk\jdk-21.0.12+8"   # ⚠ check the real folder name
$env:PATH         = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
cd app
npx expo run:android
```

### Every day after that

```powershell
.\tools\dev-phone.ps1 -Start
```

Metro starts and **keeps the window** — that is normal, it is a server, not a command that
finishes. Leave it running and open Proa on the phone; it finds the server and loads the current
JavaScript.

- **`r`** in that window reloads the phone. Shaking the phone opens the dev menu.
- Saving a file reloads it by itself (Fast Refresh).
- **After `git pull` in a second window, the next reload has the new code.** No rebuild.
- **Ctrl-C** stops the server.

`-Start` tunnels through the internet by default, so the phone can be on mobile data with the
laptop anywhere. At the desk, on the same wifi, `-Lan` is faster:

```powershell
.\tools\dev-phone.ps1 -Start -Lan
```

And for the build that goes walking — the one carrying its own JavaScript:

```powershell
.\tools\dev-phone.ps1 -Release
```


### ⚠ When a rebuild IS unavoidable

Fast Refresh moves **JavaScript**. It cannot move native code. Rebuild
(`.\tools\dev-phone.ps1 -Build`) after any of:

- a new dependency with native code — **`expo-updates` will be one** when OTA goes in;
- any change to `app.json` or `app.config.js` — permissions, plugins, the package name, the Maps
  key. `expo-localization` is a config plugin and needed exactly this once already (T-160);
- anything under `android/`, or a change of signing key.

Everything in T-167 and T-168 — the re-center control, the permanent walk button, the light
Settings — is JavaScript, and needs no rebuild after the first one.

### ⚠ The dev build is for the desk, not for the levada

**A development build has no JavaScript inside it.** With no Metro server it shows the launcher
and cannot start — which is exactly the wrong property for a phone in a pocket four hours from a
laptop. For a real walk, build the standalone one:

```powershell
.\tools\dev-phone.ps1 -Release
```

That APK carries its own bundle, behaves like the shipping app, and is the only kind of build that
can honestly answer battery (T-054) or overnight survival (T-051/T-053) — a phone tethered to
Metro is not the app anybody will install.

**Use both: the dev build to iterate, a release build to walk.** The two can be installed at once
only if their package names differ, which they do not — so installing one replaces the other.

### When it does not work

| What you see | What it is |
|---|---|
| Grey grid **with** the Google wordmark | The API key. Package name **and** SHA-1 must both match (top of this file) |
| Pure black map, no wordmark | The GPU. Emulator only — `-gpu host`. A real phone does not do this |
| *Unable to load script* | Metro is not running, or the tunnel died. Restart `npx expo start --dev-client --tunnel` |
| The phone is not listed by `adb devices` | Cable, USB-debugging prompt, or the OEM's *Install via USB* switch |
| Fast Refresh stops applying changes | A native change slipped in — rebuild |

---

## Path C — the iPhone, $99/year

Needed eventually regardless: publishing to the App Store requires the same membership
(T-137). It is also the only way to test the platform whose behaviour several decisions
depend on — geofence relaunch after force-quit (D-005) is an *iOS* property, and the 20-region
cap (D-033) is an *iOS* limit.

Once paid:

```bash
npx eas-cli@latest device:create
```

```bash
npx eas-cli@latest build --profile development --platform ios
```

**Not urgent.** Nothing about the map, the content pack, the trace or the recorder logic needs
iOS to be checked first.

---

## Recommended order

1. **A now** — free, today, and it clears the largest block of unverified work.
2. **B soon** — already required by T-021a, cheaper than the annual fee, and the only source of
   real battery and background-survival numbers.
3. **C when approaching release** — or earlier if an iOS-specific decision starts blocking.

---

## Why the checkout is ~12 GB, and what is safe to delete

**Measured 2026-08-15, after a cleanup.** The question was asked as *"is there any reason for the
app to be 12gb?"*, and the answer is that **none of it is the app**. The app is one APK:

| | |
|---|---|
| `tools/android-sdk` | **7.9 GB** — `system-images` 4.2, `ndk` 2.2, `emulator` 1.0 |
| `app/node_modules` | **2.0 GB** |
| `tiles/src` | **1.7 GB** — the OSM extract the MapLibre tile pipeline reads |
| `tools/jdk`, `tools/bin` | 0.5 GB |
| `.git` | 0.03 GB |

The **debug APK is 235 MB**, and that is not what users would download either. Looking inside it
(2026-08-15), the top entries are four copies of the React Native runtime — one per CPU
architecture — at 22.3, 21.6, 21.5 and 12.9 MB, plus 30 MB of dex. A dev build carries the dev
client, every architecture, and no minification; a Play App Bundle ships one architecture per
device. **What a release build actually weighs has never been measured here — do not quote a
number for it until one exists.**

⚠ **The offline tile packs are not in the APK.** `app/assets/map/*.pmtiles` is 18 MB and it is the
largest thing in the repository, which makes it look like the obvious saving. It is not: they are
reached only through `map/MapLibreScreen.tsx`, which nothing imports since D-057, so Metro never
bundles them — **verified by listing the APK's own entries**. They cost checkout size, not
download size, and deleting them would break the kept MapLibre path for no user benefit.

### Safe to delete, and it comes back on the next build

```bash
rm -rf app/android/app/build app/android/app/.cxx app/android/build app/android/.gradle
```

2.9 GB, regenerated by `npx expo run:android`. The cost is one slow build (~5 minutes). Deleting
it does **not** uninstall anything: the APK already on the emulator stays.

`tools/out/shots/` is gitignored working output — prune it freely.

### Not safe, however tempting

- ⚠ **`tools/android-sdk/ndk` (2.2 GB).** `android/app/build.gradle` declares `ndkVersion` and
  React Native compiles native code under the New Architecture. Removing it breaks the build.
- ⚠ **`system-images` (4.2 GB).** This is the emulator. Without a physical device it is the only
  way to run anything (CONTEXT §6.6).

### A judgement call, not a cleanup

**`tiles/src` is 1.7 GB of OSM extract** feeding a tile pipeline that **no longer ships**: D-057
moved the app to Google's map. It is kept because D-057 also kept `map/MapLibreScreen.tsx`
working, and re-downloading the extract to revive that path is a slow errand. Delete it only
deliberately, knowing the pipeline cannot run again until it is fetched.

## The first things to check, in order

Each is cheap and each can invalidate the next.

1. **Airplane mode, then open the app.** The island should render fully — coastline, terrain
   shading, Portuguese place names — with no network at all. This is the first ever test of
   hillshade-over-PMTiles on a real renderer (D-035, D-036) and of the bundled glyphs.
2. **The Debug button, top-right.** Migrations ran, the content pack reports itself, the
   recorder state is legible.
3. **Request While-Using.** A real dialog appears; the screen says `while_using` afterwards.
4. **Replay a GPX route** through the emulator's location controls, or walk outside with a real
   device. Fix count climbs, the trace appears on the map.
5. **Start geofence field test** (T-076). Synthetic places appear around the current position
   with an anchor at ~850 m. Cross it. The diary should show a `geofence` rebuild with a
   different set. **On a real device, note how late the anchor exit arrives** — that number
   sets `ANCHOR_MARGIN_M` and confirms or kills D-033.
6. **Overnight, on a real device** (T-051). Check the gap count in the morning. This is where
   `pausesUpdatesAutomatically` and the sampling gate's known hazard either behave or do not.
7. **Battery over a 12-hour day** (T-054), real device only.

---

## Known things that will look wrong and are not

- **`expo-dev-client` adds permissions that must not ship** — `SYSTEM_ALERT_WINDOW`,
  `READ/WRITE_EXTERNAL_STORAGE`, `NSAllowsArbitraryLoads`. Harmless in a development build;
  T-117 confirms they are absent from the production one.
- **The Android foreground-service notification is permanent** while recording. The deliberate
  trade in ARCHITECTURE §6.2 — OEM battery managers kill everything quieter.
- **The bundle identifier is still `com.proa.madeira`**, a placeholder. Permanent only
  after store publication (T-137).
- **The emulator's map may look slightly soft.** It renders through a translated GPU. Judge
  cartography on real hardware, and the final verdict outdoors (T-065).

---

## ⚠ The emulator was configured to be slow, 2026-08-18

**The project lead:** *"The emulator feels laggy, not responsive."* They were right and it was not
Android's fault. `~/.android/avd/madeira.avd/config.ini` held:

| | Was | Now |
|---|---|---|
| `hw.ramSize` | **1536M** | 4096M |
| `vm.heapSize` | **228M** | 512M |
| `hw.keyboard` | **no** | yes |
| `hw.gpu.enabled` | **no** | yes |

**1.5 GB is not enough to run Android 14, Play services, a Google map and a dev client**, and the
228 MB Dalvik heap is the default for a *phone from 2013*. It was thrashing. `hw.keyboard = no`
is the one that makes it feel broken rather than slow: **the physical keyboard does nothing**, so
every text field has to be poked at through the on-screen keyboard.

⚠ **The GPU story is unchanged and is separate.** `run-emulator.sh` still passes
`-gpu swiftshader_indirect` on the command line, because `-gpu host` renders the Google map as
pure black on this machine. Software rendering is a real cost and this does not remove it —
`hw.gpu.enabled = yes` only stops the AVD *also* disabling it a second way. If a future session
wants to try harder: **`MADEIRA_GPU=angle_indirect`** is the option not yet tried, and it is the
one that most often fixes GL surfaces on Windows.

⚠ **CPU acceleration was never the problem** — `emulator -accel-check` reports WHPX installed and
usable.

⚠⚠ **None of this has been measured.** The old numbers were objectively too low and the new ones
are ordinary; whether the emulator now *feels* fine is something only the project lead can say.
A backup of the original sits beside it as `config.ini.bak-<epoch>`.

## ⚠ Two ways a release build lies about what is in it, 2026-08-21

Both were found while cutting a throwaway test APK for a trip, both produced a **wrong conclusion
that survived until it was checked**, and both will happen again to anyone who trusts
`BUILD SUCCESSFUL`.

### Gradle does not watch `content/`

`assembleRelease` re-bundles when `app/src` changes and **silently does not when
`content/pois.json` does.** The content pack lives outside the Android project, so it is not in
the bundle task's input set — `poiCatalogue.ts` imports it
(`import rawPack from '../../../content/pois.json'`), but Gradle's up-to-date check never looks
there.

The symptom is a build that succeeds suspiciously fast:

    BUILD SUCCESSFUL in 8s
    629 actionable tasks: 6 executed, 623 up-to-date

and an APK whose `assets/index.android.bundle` is **byte-identical to the previous one**. A
content edit that was definitely on disk was definitely not in the APK.

Force the bundle by deleting the task's outputs first:

```bash
rm -f app/android/app/build/generated/assets/react/release/index.android.bundle       app/android/app/build/intermediates/assets/release/mergeReleaseAssets/index.android.bundle
cd app/android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

A real bundle costs ~25 s here, not 8. ⚠ **Do not trust the timing — verify the artefact.** The
APK is a zip; read the bundle out and grep it for a string only the new content has:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead('<path>.apk')
$e = $z.Entries | Where-Object { $_.FullName -eq 'assets/index.android.bundle' }
$s = $e.Open(); $ms = New-Object System.IO.MemoryStream; $s.CopyTo($ms); $s.Close()
[System.Text.Encoding]::UTF8.GetString($ms.ToArray()).Contains('<some-new-id>')
```

### `assembleRelease` empties `outputs/apk/release/`

Every run wipes that directory, so a hand-renamed APK from the previous build is **gone** — this
ate two labelled builds before the pattern was obvious, including the one the Test Lab run of
2026-08-19 had used. **Copy anything worth keeping out of the build tree in the same command that
produced it**, and take a backup before rebuilding over a known-good APK.

⚠ Related: gradle emits `app-release.apk`. The `proa-arm64-release.apk` name used elsewhere in
these docs is a **manual rename**, not something the build produces.

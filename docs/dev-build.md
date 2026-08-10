# Getting the app onto something that can run it

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

⚠ **It will not start until CPU virtualization is enabled in the BIOS** — measured on this
machine and switched off there. That is a one-time firmware toggle no program can make;
**[emulator-setup.md](emulator-setup.md)** has the exact ASUS menu path and the driver step
that follows it. Roughly five minutes, and nothing else in Path A works before it. It deliberately skips the native build toolchain
(NDK, CMake — another ~5 GB): EAS compiles the APK in the cloud for free, and the emulator only
has to run it.

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
- **A replayed GPX route** (Extended controls ▸ Location ▸ Routes) drives the whole recorder
  end-to-end: fixes land in `raw_fix`, the trace draws, the sampling gate switches profiles
  (T-034), and the geofence set reshuffles around the synthetic fixture (T-039, T-076).

### What it cannot settle, ever

- **Battery** (T-054). There is no battery. The honest figure the onboarding copy is required
  to quote (T-042) cannot come from here.
- **OEM background killers** (ARCHITECTURE §6.2). There is no OEM.
- **Force-quit relaunch**, barometer, real GPS noise under canopy.
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
- **The bundle identifier is still `com.madeiraexplorer.app`**, a placeholder. Permanent only
  after store publication (T-137).
- **The emulator's map may look slightly soft.** It renders through a translated GPU. Judge
  cartography on real hardware, and the final verdict outdoors (T-065).

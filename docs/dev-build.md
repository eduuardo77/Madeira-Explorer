# Getting a development build onto a phone

**This is the only real blocker in the project.** Nothing written so far has ever run on a
phone, and nothing can until this exists — background location does not work in Expo Go, so
every claim about the recorder is a hypothesis until then (HANDOFF).

`app/eas.json` is written and committed. The remaining steps need an Expo account, which only
the project lead can create.

---

## Why Expo Go is not enough

Expo Go is a pre-built app containing a fixed set of native modules. This project needs
background location, a foreground service, an iOS data-protection entitlement and two config
plugins — all of which change the native project. A **development build** is this app's own
native binary with the developer menu still in it: you install it once, and after that JavaScript
changes reload over WiFi exactly as they would in Expo Go.

## Why EAS Build rather than building locally

A local Android build needs a JDK and the Android SDK; a local iOS build needs a Mac. Neither is
available here. EAS Build compiles on Expo's machines. The free tier is slow at busy times but
costs nothing, and this project needs a handful of builds, not a pipeline.

---

## Steps

### 1. Create an Expo account

<https://expo.dev/signup>. Free. No card.

### 2. Link the project

From `app/`:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

`init` creates the project on expo.dev and writes an `extra.eas.projectId` into `app.json`.
**Commit that change** — it is how every later build knows which project it belongs to.

It may also add a `cli` block to `eas.json` recording the CLI version it expects. That is
normal; keep it.

### 3. Build for Android

```bash
npx eas-cli@latest build --profile development --platform android
```

Ten to twenty minutes, most of it queueing. It ends with a URL and a QR code; open it on the
phone and install the APK. Android will warn about installing outside the Play Store — that is
expected for `distribution: internal`.

The `development` profile builds an **APK** rather than an AAB precisely so it can be installed
this way.

### 4. Run it

From `app/`:

```bash
npx expo start --dev-client
```

Scan the QR code with the development build (not the camera app). The debug screen should
appear.

### 5. iOS, when you want it

iOS is harder and is **not needed to start testing** — the recorder, the geofence manager and
the battery behaviour can all be exercised on Android first.

When you do:

- It needs the **Apple Developer Program**, $99/year. There is no way around this for installing
  on a physical iPhone.
- Each test device must be registered: `npx eas-cli@latest device:create`, then
  `npx eas-cli@latest build --profile development --platform ios`.
- Note the project's iOS-specific claims can only be verified here: the
  `CompleteUntilFirstUserAuthentication` data-protection entitlement, the 20-region cap
  driving the geofence manager (D-033), relaunch-after-force-quit, and
  `pausesUpdatesAutomatically` — which HANDOFF flags as a live risk of silent recording death.

---

## The first things to check once it runs

In roughly this order, because each one is cheap and each one can invalidate the next:

1. **The app opens and the database migrates.** The map screen appears (the Debug button
   top-right switches to the instrument panel). **Put the phone in airplane mode first**: the
   island should render fully, with terrain shading and Portuguese labels, from the bundled
   packs alone (T-063). This is also the first-ever device test of hillshade-over-PMTiles
   (D-035, D-036).
2. **Request While-Using.** A real permission dialog appears, and the screen says
   `while_using` afterwards.
3. **Start recording, walk to the end of the street.** The fix count moves. This is the first
   time anything in this project has been proven rather than argued.
4. **Start geofence field test** (T-076). It builds ~20 synthetic places around wherever you
   are standing, with an anchor at roughly 850 m. Walk that far. The recent-events list should
   show a `geofence` rebuild with a different set, and `geofence_event` should collect enters
   and exits. **Write down how late the anchor exit was** — that number is what sets
   `ANCHOR_MARGIN_M` and confirms or kills D-033.
5. **Leave it recording overnight** (T-051). Check the gap count in the morning. This is where
   `pausesUpdatesAutomatically` either behaves or does not.
6. **Battery** (T-054). The honest number the onboarding copy is required to quote (T-042)
   comes from here, and from nowhere else — never invent it.

---

## Known things that will look wrong and are not

- **`expo-dev-client` adds permissions that must not ship** — `SYSTEM_ALERT_WINDOW`,
  `READ/WRITE_EXTERNAL_STORAGE`, `NSAllowsArbitraryLoads`. Harmless in a development build.
  T-117 confirms they are absent from the production build.
- **The Android foreground-service notification is permanent** while recording. That is the
  deliberate trade in ARCHITECTURE §6.2 — OEM battery managers kill everything quieter.
- **The bundle identifier is still `com.madeiraexplorer.app`**, a placeholder. It only becomes
  permanent at store publication (T-137), so it does not block anything here.

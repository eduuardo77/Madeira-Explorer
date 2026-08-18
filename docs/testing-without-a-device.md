# Verifying on real hardware without owning any

**Written 2026-08-18.** The project lead, plainly: *"Eu quero é criar uma app decente para Android
sem ter que comprar um telemóvel."*

**That is achievable, and this document exists because nobody had checked.** Every session of this
project has repeated *"nothing has ever run on real hardware and only a device can answer that"* as
if it were a law. It is not. It is two services this project had never looked at, and one of them
is free and already on the critical path for other reasons.

⚠ **What follows does not make the residual list empty.** It makes it much shorter and much more
honest — see the last section, which is the part that matters most.

---

## 1. Google Play's pre-launch report — free, automatic, and already needed

Uploading a build to any Play **test track** makes Google run it **on real devices** and hand back
a report. No test code, no extra cost, no configuration. It reports:

| | Why it matters *here* |
|---|---|
| **Crashes, ANRs, defective libraries, unsupported APIs** | The app has never started on real hardware once |
| **Screenshots across devices *and languages*** | ⚠⚠ This is how Portuguese and German get seen on a real screen. T-160a's German has never been read *on a device* by anyone |
| **Accessibility: content labelling, touch target sizes, colour contrast** | Checks T-166's labels and D-015's 60 dp targets — ⚠ **including the `hitSlop` the workbench is blind to**, which HANDOFF lists as a trap |
| **Performance: CPU, memory, network activity, frame rates** | ⚠ **Frame rates.** *"Nobody has seen the replay move"* stops being unanswerable |
| **Security: restricted Android interfaces** | Feeds T-117a |

⚠ **It costs the $25 Play registration and nothing else** — the same $25 that D-072's break-even is
calculated against, and the same account T-156 needs for license testers. **One registration
unlocks both billing testing and continuous real-device verification.** That is a very different
proposition from "buy a phone".

⚠ **Network activity is reported**, which is a free partial answer to T-117b — not a substitute
for a packet capture, but a second opinion from outside our own build.

## 2. Firebase Test Lab — real devices, five runs a day, free

Usable **today**, before any Play account exists.

- **Free tier (Spark): 5 physical-device runs per day**, plus 10 virtual. Beyond that, physical
  devices are charged per device-hour.
- **Robo tests need no test code.** Test Lab explores the app's UI by itself and returns
  **video, screenshots and logs**.
- You upload an **APK**. That is the whole integration.

⚠⚠ **THIS DOES NOT PUT FIREBASE IN THE APP, AND THAT DISTINCTION IS LOAD-BEARING HERE.** Test Lab
runs the APK you hand it; it requires no SDK, no dependency and no code change. **D-001, D-043 and
the store privacy declarations are untouched** — nothing is added to `package.json` and nothing
new ships. A project that has refused analytics on principle should not refuse this by reflex
because of the word *Firebase*: the app never links against it.

**What a Robo test on *this* app would actually answer** — worth being precise, because a robot
cannot walk a levada:

- ✅ **Does the Google map render on real hardware?** ⚠ This is the big one. The map has only ever
  been seen on a **swiftshader** emulator whose surface is known to be fragile across app
  restarts, and `-gpu host` renders it pure black here. **Nobody knows what the map does on a real
  GPU.** It is the single most fragile unknown in the product and a Robo test answers it in
  minutes.
- ✅ Does onboarding survive a real permission dialog?
- ✅ Do the screens lay out on screen sizes that are not this one AVD?
- ✅ Does it crash?
- ❌ It will not record a walk, earn a stamp, or produce a trace.

## 3. What is left that genuinely needs a phone in a pocket

Shorter than the list this project has been carrying, and none of it blocks *building*:

- **Battery over a day** (T-054). ⚠ The project lead's position, recorded: measure it from users
  later rather than guessing. That works **after** launch, via OD-11's send-a-walk route.
- **Surviving in a pocket overnight, and OEM battery killers** (T-051, T-053). ⚠ **The one that
  cannot be delegated to user data**, because when it fails there *is* no data — the user simply
  gets nothing and never knows. This is what beta testers (T-129) are for.
- **GPS under laurel canopy, and whether OS geofences fire in the field** (T-076–T-080).
- **One real trip, end to end** (OD-10).

**Every one of those is a *beta tester* problem, not a *buy a phone* problem** — and beta testers
need the app on Play, which needs the $25, which is the same $25 as everything above.

---

## The honest revision

The old framing — *"a physical Android blocks v1"* — was **overstated**, and this project repeated
it for weeks without checking. What actually blocks v1 is **a $25 Play registration**, after which
real devices report back automatically on every upload. What is left after that is a small set of
questions about a phone in somebody's pocket for a week, which is what a closed beta is for and
what buying one phone would answer only for one phone anyway.

---

## The first release APK, 2026-08-18 — what it cost to find out

**The project lead asked for the APK prepared. Building it answered T-117a and opened two new
tasks.** Recorded here because the whole point of D-077 is that real artefacts tell you things
static analysis does not.

**It built first time**, which was not a given: JS bundling, ProGuard, and the Maps key manifest
placeholder had never met a release build before.

| | |
|---|---|
| ✅ **Dev scaffolding is gone** | No `expo-dev-launcher`, no dev menu, **no ML Kit barcode library** — the 5.9 MB measured in debug is absent |
| ⚠⚠ **Three dev permissions were not** | `SYSTEM_ALERT_WINDOW` + both storage permissions, in **our own** manifest. Fixed — `plugins/withoutDevPermissions.js`, verified gone by re-dumping the APK |
| ⚠⚠ **FCM ships** | `firebase-messaging` via `expo-notifications`, for an app that sends **local** notifications only → **T-117c** |
| ⚠ **128 MB** | ~40 MB is `libmaplibre.so` across four ABIs, for a map D-057 replaced → **T-117d** |

⚠ **The release is signed with the debug keystore** — the template's default, with its *"Caution!"*
comment still in place. Fine for Test Lab, **not** for Play. And when a real key exists, remember
HANDOFF's trap: Google re-signs uploads, so a **second SHA-1** must go on the Maps API key or the
map is grey for every real user while working perfectly in these builds.

### The APK

```
app/android/app/build/outputs/apk/release/app-release.apk
```

Rebuild it with:

```bash
cd app/android && ./gradlew assembleRelease
```

⚠ `ANDROID_HOME` and `JAVA_HOME` must be set — see the top of this file's sibling,
`docs/dev-build.md`.

### Uploading it to Firebase Test Lab — the project lead's Google account, not this session's

1. **console.firebase.google.com** → add a project (no billing; the Spark plan is the free tier).
2. **Test Lab** → **Run a test** → **Robo test** → upload `app-release.apk`.
3. Choose devices. ⚠ **Pick real ones, not virtual** — the whole question is what a real GPU does.
   Five physical runs a day are free.
4. Robo explores the app by itself. No test code.

**What to look at first, in order:**

1. ⚠⚠ **Does the Google map render?** It has only ever been seen on a swiftshader emulator with a
   surface known to be fragile, and `-gpu host` paints it pure black on the dev machine. **This is
   the single most fragile unknown in the product.** The video and screenshots answer it.
2. Does onboarding survive a real permission dialog?
3. Does it crash, and do the screens lay out on hardware that is not one AVD?

⚠ **What a robot cannot do:** record a walk, earn a stamp, or produce a trace. It will not
exercise the recorder, the geofences or the replay.

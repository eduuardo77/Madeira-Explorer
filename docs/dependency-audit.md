# Dependency network audit

**T-117.** Does anything this app ships transmit data?

**Run:** 2026-08-11, against `app/package.json` as committed (Expo SDK 57.0.12, RN 0.86.2).
**Verdict:** no analytics, no crash reporting, no telemetry, and no code path in this app that
makes a network request — with **three findings worth knowing about**, one of which will come
up in the Play review.

**What this audit is not.** Every check below is *static*: package manifests, native build
files, and the JavaScript bundle Metro actually produces. **Nothing has been observed on a
device**, because there is no device (`docs/dev-build.md`). Capability is not behaviour, and
this audit establishes that nothing *calls* the networked libraries that ship — not that
nothing *did*. **T-117b** is the runtime confirmation and it needs hardware.

CONTEXT §4.8 is the reason this task exists: these apps do not leak through carelessness with
the location database, they leak through a dependency that phones home by default.

---

## How to re-run it

```bash
cd app && npm ls --omit=dev --all                    # what actually ships
cd app && npx expo export --platform android --no-bytecode --output-dir <tmp>
```

Then grep the emitted bundle. `--no-bytecode` matters: the default export is Hermes bytecode
and greps nothing useful.

**Verify the probe before believing a zero.** A grep that matches nothing looks exactly like a
pass. Every "0 hits" below was taken with the same command that returns non-zero for
`maplibre`, `sqlite`, `pmtiles` and `exp.host` in the same file.

---

## What ships, and what each one can do

| Package | Native dependencies it drags in | Can it reach the network? |
|---|---|---|
| `expo-location` | `com.google.android.gms:play-services-location` | The fused provider runs inside Google Play Services on the device. It does not upload location on its own. **This is Google code in the process** — say so plainly rather than claiming otherwise. |
| `expo-notifications` | **`com.google.firebase:firebase-messaging`** | Yes, by design — see finding 1. |
| `expo-file-system`, `expo-asset` | OkHttp | Yes, if asked. Never asked. |
| `expo-sqlite` | vendored SQLite / libsql | No |
| `expo-sensors`, `expo-task-manager`, `expo-system-ui`, `expo-status-bar` | none beyond AndroidX | No |
| `@maplibre/maplibre-react-native` | MapLibre Native (vendored xcframework on iOS) | Only for remote tile/glyph/sprite URLs. **Ours are all `file://`** (D-036, and the glyph bundling in T-056). |
| `react-native-svg` *(added 2026-08-11, T-070)* | Fresco, and **`imagepipeline-okhttp3`** | Yes, if asked — Fresco's HTTP backend exists so `<Image>` inside an SVG can load a remote `href`. **The stamp artwork draws only paths, polygons, rects and text**; there is no `SvgUri`, no `<Image>` and no remote href anywhere in `app/`. iOS: `React-Core` only. No telemetry strings in its source. |

**iOS is clean by inspection:** every shipped module's podspec depends on `ExpoModulesCore` and
nothing else. MapLibre is a vendored binary framework. There are no third-party pods.

**`expo-updates` is not installed.** Worth stating explicitly, because it is the default way an
Expo app acquires a network call on every single launch — an OTA update check. There is no
`updates` key in `app.json` and no `expo-updates` in `node_modules`.

## Telemetry scan of the shipped bundle

Zero hits, all seventeen, in the emitted JavaScript:

`sentry` · `crashlytics` · `firebase-analytics` · `amplitude` · `segment.com` · `bugsnag` ·
`appsflyer` · `adjust.com` · `branch.io` · `facebook.com` · `graph.facebook` · `mixpanel` ·
`datadog` · `newrelic` · `google-analytics` · `googletagmanager` · `doubleclick`

## Every absolute URL in the shipped bundle

Three are real endpoints; the rest are documentation links and error-message text.

| URL | Where from | Reached? |
|---|---|---|
| `https://exp.host/--/api/v2/push/updateDeviceToken` | `expo-notifications` | **No** — only via `getExpoPushTokenAsync`, which this app never calls. See finding 2. |
| `https://classic-assets.eascdn.net/~assets/` | `expo-asset` | **No** — every asset is bundled. See finding 3. |
| `http://localhost:8081/` | Metro | Development only. |
| `openstreetmap.org/copyright` | our own style metadata | It is an attribution *link* the user may tap (ODbL, D-030), not a request the app makes. |

## The app's own code

- **No `fetch`, no `XMLHttpRequest`, no `WebSocket`, no HTTP client anywhere in `app/src`.**
- The only notification calls are `scheduleNotificationAsync`, `getPermissionsAsync` and
  `requestPermissionsAsync` — all local. **No push token is ever requested.**
- One call that reads alarmingly and is not: `mapAssets.ts` calls `asset.downloadAsync()`. In a
  release build that resolves the asset inside the binary with no request. In a *development*
  build it may fetch from the Metro server on localhost. Dev scaffolding; T-117a's territory.
- `usesCleartextTraffic: false` is already set (`expo-build-properties`).

---

## Finding 1 — `expo-notifications` puts Firebase Cloud Messaging in the APK

**This is the one that will come up in the Play review, and the one to have an answer ready
for.** `expo-notifications`' Android build declares
`implementation 'com.google.firebase:firebase-messaging:25.0.1'`, and its manifest registers a
service for `com.google.firebase.MESSAGING_EVENT`. Both end up in the merged APK whether or not
push is used.

**This app uses only local scheduled notifications** — two per trip, ever (D-011): the day-1
health check and the trip-end reveal. Neither needs a server, and the code confirms it: no push
token is requested anywhere.

**And it cannot register even if something tried.** There is no `google-services.json` in the
project and no `android.googleServicesFile` in `app.json`, so the google-services Gradle plugin
never runs and no FCM sender configuration is compiled in. Without a default `FirebaseApp`, FCM
registration has nothing to register against.

**What is still owed:** that is a static argument about a runtime behaviour. **T-117b must
confirm it on a device** with a packet capture, ideally during the T-051 soak — it costs
nothing extra to watch the network while the recorder is already running for 72 hours.

**Why the dependency is not simply removed:** the two notifications are load-bearing.
CONTEXT §4.5 is explicit that the enemy of a ghost app is the OS, not the user, and that a
recorder which dies on day 2 discovered on day 7 is worse than never having installed the app.
Recorded as **D-043**.

## Finding 2 — an Expo push endpoint is a string in the bundle

`https://exp.host/--/api/v2/push/updateDeviceToken` ships as dead code inside
`expo-notifications`. Nothing reaches it, but anyone who greps the bundle — a reviewer, a
journalist, a curious user — will find it, and "no data leaves the device" is a claim that
invites exactly that. It is written down here so the answer exists before the question.

## Finding 3 — an Expo asset CDN URL is a string in the bundle

`https://classic-assets.eascdn.net/~assets/` from `expo-asset`, for remote asset resolution.
Every asset in this app is bundled, so the path is never taken. Same category as finding 2.

---

## What this changes

- **The privacy policy (T-124) can now be written**, and it can say what is actually true
  rather than what was hoped.
- **The Data Safety form (T-122) and the nutrition label (T-120)** should describe *no data
  collected and none shared*, and whoever fills them in should have read finding 1 first.
- **The standing rule stands:** no new dependency lands without this check (CONTEXT §6.4). Any
  addition that brings a networked SDK needs a recorded decision, not a judgement call. It was
  applied to `react-native-svg` on the day it was added, which is the point of writing the rule
  down — and it found Fresco's OkHttp image pipeline, which nobody would have guessed was in a
  vector-drawing library.

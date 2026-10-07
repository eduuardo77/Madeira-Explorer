# Store privacy answers

> ### Status, 2026-10-07 (T-264)
> **The inventory just below is current for the Android release** and is the source for the Play
> Data safety form (T-268). It replaces the August banner, which warned that the app had started
> talking to Google Maps; that is now answered row by row. **The Apple section further down is still
> the August text** and must be redone before any iOS build. **Not legal advice.**

## Inventory: what the app asks for, keeps and sends (T-264, 2026-10-07)

Built from the release APK (`aapt2 dump permissions`, version code 3 tree, 2026-10-07), the
manifest merger report, and the code. ⚠ **Not yet done: a packet capture** over a launch, a map pan
and the purchase sheet, which T-264 asks for to confirm the only hosts are Google's (T-117b). Until
then the "leaves the phone" table rests on the code and Google's own disclosures.

### Every permission, and why

| Permission | Added by | Why |
|---|---|---|
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | `app.json` | Recording where the user goes: the core feature |
| `ACCESS_BACKGROUND_LOCATION` | `app.json` | Recording with the app closed (T-123 review pending) |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` | `app.json` | The recorder runs as a location foreground service, with its notification |
| `ACTIVITY_RECOGNITION`, `com.google.android.gms.permission.ACTIVITY_RECOGNITION` | `app.json`; `modules/activity-transitions` | Walking or driving, to light the right road (D-094); optional |
| `POST_NOTIFICATIONS` | `app.json` | The recorder's notification, the day-after check, the trip's end, each new stamp (D-096) |
| `RECEIVE_BOOT_COMPLETED` | `app.json`; expo-notifications | Restarting the recorder after the phone restarts |
| `WAKE_LOCK` | `app.json`; Firebase (inert) | Keeping the recorder's batch writes alive |
| `VIBRATE` | the app's manifest | The new-stamp celebration's short vibration (`StampNewsCard.tsx`) |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | `modules/battery-exemption` | The one-tap battery exemption in first run (D-045, T-266: kept, declaration drafted there) |
| `com.android.vending.BILLING` | expo-iap (openiap) | Unlocking the passport, one payment through Google Play (D-089) |
| `INTERNET`, `ACCESS_NETWORK_STATE` | Expo; Google Play services | The map's tiles; Play Billing |
| `com.proa.madeira.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX | Internal to the app; protects its own broadcast receivers |

### What is kept on the phone

All in the app's own database (`madeira.db`), readable only by the app:

| Data | Table | Notes |
|---|---|---|
| Positions with time, accuracy and speed | `raw_fix` | The trip itself; never sent by the app |
| Motion sensor readings and walking or driving changes | `sensor_sample`, `activity_event` | D-094 |
| The roads matched from the positions | `matched_chain`, `match_progress` | What the map lights |
| Trips, stamps earned and when | `trip`, `stamp_award` | |
| Place entries and exits | `geofence_event` | |
| A diary of whether recording worked | `recording_event` | For the day-after check (T-049) |
| Settings, and the purchase's answer and time | `app_state` | The purchase time drives the founder stamp (T-233) |

⚠ **Android's own backup includes this database** when the user has backups on (`allowBackup`
true, `backup_rules`, `data_extraction_rules`): it goes to the user's own Google account, under
Google's encryption, as the privacy policy says. The app never sends it anywhere itself.

### What leaves the phone

| What | To whom | When | Evidence |
|---|---|---|---|
| The part of the map on screen; device details, IP, a pseudonymous Maps identifier, crash data, map pan and zoom events | Google (Maps SDK) | Whenever the map is shown | Google's [Maps SDK data disclosure](https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure) (rows in the Play section below) |
| The purchase request; the purchase token when it is acknowledged | Google Play | Only when the user buys or restores | `entitlement/storeBilling.ts`, `entitlement/billingSync.ts` (expo-iap); nothing goes to a server of ours |
| Nothing (Firebase is never initialised: no `google-services.json`) | | | `FirebaseApp: Default FirebaseApp failed to initialize`, every launch on the P30 |
| The masked share image, the backup file, the walk report | **Wherever the user sends them**, through Android's share sheet | Only on the user's tap | `tripShare.ts` and `shareTrip.ts` (masked, D-040), `backupFile.ts`, `donateWalk.ts` (D-069) |
| The trip | **Nobody.** No account, no server of ours, no analytics, no ads | | The privacy policy's central claim |

**How each lands on the Play form:** see the Data safety section below (T-268, 2026-10-07):
billing is not declared, by Google's own exemption for its billing system; physical activity,
per-stamp notifications and the battery permission stay on the phone, so nothing new is collected.

---

**T-120** (Apple's App Privacy "nutrition label") and **T-122** (Google Play's Data safety
form). Two forms, one set of facts — so they live in one document, because the failure mode is
answering them months apart and contradicting yourself in front of two reviewers.

**Written:** 2026-08-11, from `docs/dependency-audit.md` (T-117) and the privacy manifest
(T-118). **Not legal advice and not lawyer-reviewed** — the same caveat as the privacy policy
(D-044), and it should be read by somebody qualified before either submission.

---

## The one rule both platforms share

**Data processed only on the device and never sent off it is not "collected"**, and does not
have to be declared. Both say so explicitly:

- **Apple** — [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/):
  "collect" means transmitting data off the device where the developer or its partners can
  access it beyond servicing the request in real time. Data processed only on device is not
  collected and need not be disclosed.
- **Google** — [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469):
  collection means transmitting data off the device; data accessed by the app but processed only
  locally does not need to be disclosed.

This app has **no server, no account and no analytics** (D-001), and T-117 confirmed that by
audit rather than by assertion. So the answer to both forms is the same, and it is the short
one.

### ⚠ This corrects what T-120 originally said

The task read: *"iOS Privacy Nutrition Label — Location / App Functionality / Not Linked to
You / Not Used for Tracking."* That is the answer for an app that **does** collect location and
uses it only to run the app. It is wrong here, and wrong in the expensive direction: declaring
collection the app does not do would put "Location" on the store listing of the one app whose
entire differentiator is that location never leaves the phone (CONTEXT §4.7). Corrected in
TASKS.md.

---

## Apple — App Privacy (T-120)

In App Store Connect → App Privacy.

| Question | Answer |
|---|---|
| Do you or your third-party partners collect data from this app? | **No — "Data Not Collected"** |
| Does this app use data for tracking? | **No** |

There is nothing further to fill in: choosing *Data Not Collected* ends the questionnaire.

**Consistency check.** This must agree with the privacy manifest, which already states it in
Apple's own vocabulary (T-118, `ios.privacyManifests` in `app.json`):
`NSPrivacyTracking: false`, `NSPrivacyTrackingDomains: []`, `NSPrivacyCollectedDataTypes: []`.
If one is ever changed, change both in the same piece of work.

---

## Google Play — Data safety (T-122, redone as T-268)

> ### ⚠ READY 2026-10-07 (T-268): both calls decided (D-100); the project lead submits
> Built from the inventory above (T-264) and Google's text as read on 2026-10-07. **Not legal
> advice.** Two answers are judgement calls and are marked as such; everything else follows from
> Google's own words, quoted. The packet capture (T-264, T-117b) is still owed before submission:
> until then "the only hosts are Google's" rests on the code and Google's disclosure.

### What each SDK in the release APK sends, and the evidence

| SDK in the APK | What leaves the phone | Evidence |
|---|---|---|
| **Maps SDK for Android** (via expo-maps) | Device metadata (OS version, name, model, brand, form factor), SDK version; stack traces and crash metrics; **IP address** *"to understand SDK usage and improve Google services"*; a *"Maps SDK-specific pseudonymous identifier to measure daily active SDK users"*; **map interaction events** (*"panning and zooming the map"*, when the Camera APIs are used, which this app does) | Google's [Maps SDK data disclosure](https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure), last updated 2026-10-05, read 2026-10-07 |
| **Google Play Billing** (via expo-iap) | The purchase, between the phone and Google Play. The app receives only Google's answer (owned or not) and keeps it, with the purchase time, on the phone | `entitlement/storeBilling.ts`, `entitlement/billingSync.ts`; no server of ours |
| **Firebase Cloud Messaging** (inside expo-notifications) | **Nothing.** Firebase never starts: no `google-services.json` | Every launch on the P30: `Default FirebaseApp failed to initialize` |
| **Play Install Referrer** (transitive) | **Nothing.** Its permission is removed (T-194) and no code calls it | `withoutUnusedPermissions.js` |
| **Google Play services location** (the recorder) | Fixes are handed to the app **on the phone**. Google Location Accuracy is a device setting the user controls | D-010 |

**The trip itself** (positions, roads, stamps, diary) is never transmitted by the app. That stays
the claim the listing leads with.

### The answers, as drafted

| Question | Draft answer | Source |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Google counts *"user data transmitted off device from your app by libraries and/or SDKs used in your app"* ([guidance](https://support.google.com/googleplay/android-developer/answer/10787469)); the Maps SDK rows above |
| **Collected** data types | **App info and performance: Crash logs, Diagnostics. Device or other IDs** (the pseudonymous Maps identifier). **App activity: App interactions** (panning and zooming) | The Maps SDK disclosure, row by row |
| Location? | **Not declared** | The IP address is declared as location only *"where developers use IP addresses as a means to determine location"*; neither the app nor, per its disclosure, the SDK does |
| Financial info (purchases)? | **Not declared** | *"If your app uses a payment service such as PayPal, Google Pay, Google Play's billing system, or similar services to complete payment transactions, you don't need to declare collection"* when the app never accesses the financial data. The app keeps only "owned" and the time, on the phone, which is not collection |
| Physical activity, stamps, the trip | **Not declared** | Processed only on the phone; not transmitted, so not collected |
| **Shared?** | **No** (decided 2026-10-07, D-100) | *"Sharing"* is *"transferring user data collected from your app to a third party"*. Here the SDK's provider is the party that collects it, through the SDK; the app transfers nothing on to anyone else. The service-provider exception (*"processes user data on behalf of the developer and based on the developer's instructions"*) is the weaker argument, because Google states its own purposes (*"improve Google services"*), so the answer should not rest on it. Google's Maps page says the developer is *"solely responsible"* for the answer and gives none. The conservative alternative: mark the same types *shared* with Google |
| Processed ephemerally? | **No** | Ephemeral means *"only stored in memory and retained for no longer than necessary to service the specific request in real-time"*; crash metrics and a daily-user identifier are kept |
| Required or optional? | **Required** | The map cannot be used without the SDK |
| Purposes | **App functionality; Analytics** | The SDK's stated purposes: running the map, crash and usage measurement |
| Encrypted in transit? | **Yes** | `usesCleartextTraffic=false` for the whole process, which the SDK runs in |
| **Can users request deletion?** | **No** (decided 2026-10-07, D-100) | The question is whether *"you provide users with a mechanism to request data deletion; or automatically initiate deletion or anonymization of collected data within 90 days"*. The only collected data is the Maps SDK's, held by Google under Google's policy; the app cannot delete it. *Apagar tudo* erases everything the app keeps, but none of that is collected |
| Privacy policy URL | **https://bruma.lol/privacy** | Live since 2026-10-07 (T-267), the same text as the app's (`tools/build-site.mjs`) |

**The policy now says what the map sends** (2026-10-07): the map section names the phone's
model and system, the internet address, crash reports, the anonymous counting number and how the
map is moved, in English and Portuguese, so the form and the policy agree.

**Not needed:** an account-deletion URL. Play asks for one from apps that let users create an
account; this one has none.

---

## Considered, and correctly excluded

Written down because each one is a reasonable question a reviewer might ask, and the answer
should exist before the question.

**The souvenir share sheet (T-108).** The user exports a video of their trip and sends it
somewhere. That is a transfer to a third party — but it is initiated by the user, for a purpose
they obviously understand, which both platforms treat as outside the disclosure. The app never
transmits it on its own, and the user's accommodation is removed before the export exists at
all (D-040).

~~**The Directions hand-off (T-115, D-018).**~~ Removed by D-055: the card has no Directions
button, so nothing is handed to another app.

**The device's own encrypted backup.** The trip database participates in normal iCloud/Google
backup, deliberately (ARCHITECTURE §4a) — it is the answer to "my phone died on day 5". That is
the *user's* backup under the *user's* account; the developer cannot reach it, so it is not
collection by either definition. The privacy policy discloses it to the user anyway, in its own
section, because the user can reach it and may want to turn it off.

**Physical activity (D-094, 2026-09-27).** Android's activity transitions (still, walking, in a
vehicle) are stored on the phone and read by the road matcher; nothing sends them anywhere. Play's
definition of *collected* is data transmitted off the device, so this is **not collected** and
nothing is declared. The permission itself is visible to the user and a reviewer, so the privacy
policy says what it is for, in the section on what the app asks for. ⚠ If a reviewer asks, the
answer is that section and this paragraph.

**Firebase Cloud Messaging in the Android build (D-043).** It ships inside
`expo-notifications`, is never asked for a push token, and has no configuration to register
with. It collects nothing, so there is nothing to declare — but see the risk below. ✅ **Observed 2026-09-24:** every launch on the P30
logs *"Default FirebaseApp failed to initialize because no default options were found"*.

---

## ⚠ The risk to be ready for

**A background-location app declaring "no data collected" looks surprising**, and it is exactly
the combination a reviewer stops on. It is also true. Have the evidence ready rather than the
assertion:

- `docs/dependency-audit.md` — what ships, what it can reach, and the three findings.
- `docs/privacy-policy.md` — the same claims in the user's words.
- The permission itself is justified separately, in the **background-location declaration**
  (T-123), which is where the demo video and the written justification go. Requesting a
  permission is not collecting data, and the two forms ask different questions.

**And one honest gap:** every claim above is *static* — T-117 established that nothing calls the
networked libraries that ship, not that nothing did, because there is no device.
**T-117b is the packet capture that turns this from an argument into an observation**, and it
should be run before submission, not after.

---

## Keep these four in agreement

Change one, change all of them in the same piece of work:

1. `ios.privacyManifests` in `app/app.json` (T-118)
2. Apple's App Privacy answers (this document, T-120)
3. Google's Data safety answers (this document, T-122)
4. `app/src/legal/privacyPolicy.ts` → `docs/privacy-policy.md` (T-124, D-044)

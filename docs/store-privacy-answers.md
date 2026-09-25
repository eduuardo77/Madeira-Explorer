# Store privacy answers

> ### ⚠ REWRITE REQUIRED BEFORE SUBMISSION — 2026-08-14 (D-057)
> This document was written when the app made **no network requests at all**. It now draws
> **Google Maps on Android**, which streams tiles. Two things follow, and both must be settled
> before either store form is filled in:
>
> 1. **The "zero outbound connections" framing below is no longer true of the app as a whole.** It
>    remains true of the *trip*: the recorded trace, the stamps and the diary never leave the phone,
>    there is still no account, no server of ours, no analytics and no ads. The distinction is now
>    load-bearing and every answer has to make it precisely.
> 2. **Google Play's Data Safety form asks about third-party SDKs.** The Maps SDK is one, and its
>    own data collection is Google's to declare, not ours — but the form asks whether the app
>    *shares* data with third parties, and "which part of the map you are looking at" is a judgement
>    call a reviewer may read differently than we do. Answer it conservatively and in writing here.
>
> `legal/privacyPolicy.ts` is already rewritten (D-044 keeps the two in step). This file is not,
> because the store answers are a compliance artefact and rewriting them from a code change without
> the project lead reading them would be exactly the wrong kind of confidence.


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

## Google Play — Data safety (T-122)

> ### ⚠ REDONE 2026-09-24, as a DRAFT for the project lead to read — not yet submitted
> The old answer was **"No data collected"**. It is wrong for the APK that ships. Google's rule
> counts *"user data transmitted off device from your app by libraries and/or SDKs used in your
> app, irrespective of whether data is transmitted to you or a third-party server"*
> ([Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469)),
> and the Maps SDK transmits some. **Not legal advice**, the same caveat as above.

### What each SDK in the release APK sends, and the evidence

| SDK in the APK | What leaves the phone | Evidence |
|---|---|---|
| **Maps SDK for Android** (via expo-maps) | Device metadata (OS version, model, brand, form factor), SDK version and result counts; stack traces and crash metrics; **IP address** "to understand usage"; a pseudonymous **Maps SDK identifier** for counting daily active users; **map interaction events** (panning and zooming when the Map Camera APIs are used, which this app does) | Google's [Maps SDK data disclosure](https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure), read 2026-09-24 |
| **Firebase Cloud Messaging** (inside expo-notifications) | **Nothing.** Firebase never starts: the release build has no `google-services.json`, so no Firebase installation ID is created and FCM never registers | Seen on the P30, every launch: `FirebaseApp: Default FirebaseApp failed to initialize because no default options were found` |
| **Play Install Referrer** (a transitive dependency) | **Nothing.** The permission that lets it reach the Play Store is removed from the manifest (T-194), and no code calls it | `withoutUnusedPermissions.js`; `dumpsys package` on the P30 lists 12 permissions |
| **Google Play services location** (the recorder) | Fixes are handed to the app **on the phone**. Whether the phone improves them with Wi-Fi and cell data is *Google Location Accuracy*, a device setting the user controls, not something this app sends | D-010; the recorder stores fixes only in the local database |

**The trip itself** (trace, stamps, diary) is still never transmitted by the app. That claim
stands, and it is the one the listing should lead with.

### The answers, as drafted

| Question | Draft answer | Why |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | The Maps SDK rows above |
| **Collected** data types | **App info and performance → Crash logs; Diagnostics.** **Device or other IDs** (the pseudonymous Maps SDK identifier). **App activity → App interactions** (map panning and zooming) | Google's own definitions: crash logs are *"stack traces, or other information directly related to a crash"*; device IDs include *"Firebase installation ID"*-style app identifiers; app interactions are *"how a user interacts with the app"* |
| Location? | **Not declared** | The only location that leaves the phone is the IP address, and Google says to declare IP as location *"where developers use IP addresses as a means to determine location"*. Neither this app nor, per its disclosure, the Maps SDK does |
| Shared? | ⚠ **Draft: not shared** | Google processes it to run the map this app uses. The *"service provider"* exception may cover that, but a reviewer could read Google as a third party using the data for its own purposes (measuring the SDK). **This is the call to confirm.** The conservative alternative is to mark the same types as *shared* |
| Processed ephemerally? | **No** | Crash metrics and a daily-active-user identifier are retained by design |
| Required or optional? | **Required** | The map cannot be used without the SDK |
| Purposes | **App functionality; Analytics** | Stability and usage measurement are the purposes Google gives |
| Encrypted in transit? | **Yes** | The manifest sets `usesCleartextTraffic=false` for the whole process, and the Maps SDK runs in it |
| Can users request deletion? | ⚠ **Draft: No** | The app's own data is only on the phone and *Apagar tudo* erases it (T-125). But the question is about **collected** data, and the only collected data is the Maps SDK's, held by Google under Google's policy, which the app cannot delete. Saying *Yes* would promise something the app cannot do |

⚠ **Coming with T-156 (billing):** Play Billing adds **Financial info → Purchase history**. Redo
this table in the same piece of work. Billing is `expo-iap` (D-091): the purchase goes between the
phone and Google only, with no third party such as RevenueCat in between.

⚠ **Keep the in-app policy in step (D-044).** `legal/privacyPolicy.ts` says Google sees which
part of the island the user is looking at. It does **not** yet say that the map component also
sends Google device details, crash reports, a pseudonymous identifier and how the map is
moved. **Proposed sentence, pending the project lead:** *"The map component also sends Google
basic details about your phone, crash reports, an anonymous identifier for counting users, and
how you move the map. It never sends your trip."* (in en, pt and de).

**Play also requires a privacy policy URL.** ⚠ **Blocked** on T-187 (a domain) and
`CONTACT_EMAIL`, as before.

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

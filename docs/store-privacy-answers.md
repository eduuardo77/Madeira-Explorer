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

In Play Console → App content → Data safety.

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | *(not asked — nothing is transmitted)* |
| Do you provide a way for users to request that their data is deleted? | **Yes** |

**On deletion**, answer yes and explain plainly: the app has no account and no server, so there
is nothing held anywhere to request deletion of; Settings has a control that erases everything
on the device immediately and permanently (T-125), and uninstalling does the same. That is the
whole mechanism, and the privacy policy says so in the same words (D-044).

**Play also requires a privacy policy URL.** ⚠ **Blocked** — `docs/privacy-policy.md` is
written and generated, but there is no domain to host it on and `CONTACT_EMAIL` is still null
(D-044). Both block T-123 as well.

---

## Considered, and correctly excluded

Written down because each one is a reasonable question a reviewer might ask, and the answer
should exist before the question.

**The souvenir share sheet (T-108).** The user exports a video of their trip and sends it
somewhere. That is a transfer to a third party — but it is initiated by the user, for a purpose
they obviously understand, which both platforms treat as outside the disclosure. The app never
transmits it on its own, and the user's accommodation is removed before the export exists at
all (D-040).

**The Directions hand-off (T-115, D-018).** Tapping a place offers one button that opens Apple
or Google Maps. What is handed over is a **curated place's coordinates from the content pack**,
not the user's location or history — and again only on an explicit tap.

**The device's own encrypted backup.** The trip database participates in normal iCloud/Google
backup, deliberately (ARCHITECTURE §4a) — it is the answer to "my phone died on day 5". That is
the *user's* backup under the *user's* account; the developer cannot reach it, so it is not
collection by either definition. The privacy policy discloses it to the user anyway, in its own
section, because the user can reach it and may want to turn it off.

**Firebase Cloud Messaging in the Android build (D-043).** It ships inside
`expo-notifications`, is never asked for a push token, and has no configuration to register
with. It collects nothing, so there is nothing to declare — but see the risk below.

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

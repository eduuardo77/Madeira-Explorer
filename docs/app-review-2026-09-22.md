# Proa — Independent App Review

**Date:** 2026-09-22
**Build reviewed:** `com.proa.madeira` 0.1.0 (versionCode 1), release build installed 2026-09-22 21:37, source at `37d0146`
**Device:** Huawei P30 (ELE-L29), Android 10, 1080×2340 @ 480 dpi, locale `pt-PT`, Play Services current, no SIM, Wi-Fi on
**Standard applied:** a large company deciding whether to publish, not "does it work for the person who built it"
**Final score: 7 / 20** — **not ready to publish; not yet an MVP.**

---

## Contents

1. [Executive summary](#1-executive-summary)
2. [Method — what was done, and what was not](#2-method--what-was-done-and-what-was-not)
3. [How the score is calculated](#3-how-the-score-is-calculated)
4. [Launch blockers (P0)](#4-launch-blockers-p0)
5. [Product and UX findings (P1)](#5-product-and-ux-findings-p1)
6. [Polish, language and accessibility findings (P2)](#6-polish-language-and-accessibility-findings-p2)
7. [What is genuinely good](#7-what-is-genuinely-good)
8. [Scoring, area by area](#8-scoring-area-by-area)
9. [Is it an MVP? Is it publishable?](#9-is-it-an-mvp-is-it-publishable)
10. [Path to a publishable v1, in order](#10-path-to-a-publishable-v1-in-order)
11. [Limits of this review](#11-limits-of-this-review)
12. [Appendix — raw measurements and evidence](#12-appendix--raw-measurements-and-evidence)

---

## 1. Executive summary

Proa is built with an engineering discipline you rarely see in a solo project: 697 passing
tests, strict TypeScript, pure logic kept separate from device code, and bugs found by
replaying real field data. **As a product, though, it is a prototype.** Three facts decide
the verdict:

1. **Nobody has ever seen the core promise work on a real phone.** No stamp has ever been
   earned on real hardware. No trip has ever been completed end to end. The trip open on the
   test phone started on 28 August, 25 days ago, and has not ended.
2. **The build contains things no company would ship.** The launcher icon is Expo's template
   placeholder. A screen titled *"Phase 1 debug view. Not the product."* can be reached from
   Settings. And the paywall locks stamps even though the app has no way to pay.
3. **The store paperwork is not done.** There is no hosted privacy policy. The background-location
   review has not been submitted. The Data Safety answer ("no data collected") conflicts with the
   third-party SDKs in the APK. And no release signing key exists yet.

Some things score well: performance on the test device (402 ms cold start, 2% janky frames),
the privacy stance, and the size and quality of the content base (80 curated places).
The score is 7/20 because a store-ready app has to be complete and proven, and today Proa is
neither.

---

## 2. Method — what was done, and what was not

### Done

| Step | How | Why |
|---|---|---|
| Automated checks | `npm test` (697/697 pass), `npx tsc --noEmit` (exit 0) | Baseline code health |
| Cold start | `am force-stop` then `am start -W` | Launch time as a user feels it |
| Screen walk | Map → passport → place card → settings (every section) → share → technical details | Every reachable surface |
| UI structure | `uiautomator dump` on each screen | Exact text, accessibility labels and tap targets, without guessing from pixels |
| Visual check | 6 screenshots (map, passport, place card, settings, share sheet, debug) | Layout, contrast and brand, which only a picture can judge |
| Service truth | `dumpsys activity services`, `dumpsys location` | Whether the recorder really runs, rather than trusting the UI |
| Performance | `dumpsys gfxinfo` over 8 passport swipes; `dumpsys meminfo` | Jank and memory |
| Stability | `dumpsys dropbox` for app crashes and ANRs | Crash history on the device |
| Package audit | `dumpsys package` | Permissions, SDK targets, backup flag |
| Source cross-check | grep of `app/src`, `app.json`, `TASKS.md`, `docs/field-notes.md`, `docs/store-privacy-answers.md` | Confirm each finding has a cause in code, and that nothing was blamed on a stale build |

### Not done, deliberately

- **Onboarding was not viewed on the device.** It would have meant wiping the phone's data,
  and that phone holds the project's only real field data. Onboarding was judged from its text
  in `app/src/i18n/strings.ts`.
- **No code or app state was changed.** The instruction was "DO NOT MAKE CHANGES TO THE CURRENT
  APP". Pressing *Começar a registar* would have written a trip, so its behaviour was read from
  source instead.
- **Not tested at all:** the dark map, a low-end phone, a small screen, German, TalkBack
  read-through, offline behaviour at launch, and the replay film.

### One measurement that had to be redone

The first `gfxinfo` probe reported 0 frames. The app had been backgrounded by an extra *Back*
press, so the probe was measuring nothing. It was rerun with the app confirmed in front, and
the figures below come from that second run. This is noted per the project's own rule: if a
result does not move, suspect the probe.

---

## 3. How the score is calculated

Eight areas, each scored /20, each weighted by how much it decides success **for a paid,
store-published consumer app**:

| Area | Weight | Why this weight |
|---|---:|---|
| Core loop proven on real hardware | 20% | If the promise does not happen, nothing else matters |
| Clarity of what the app is for (product and UX) | 15% | Users who do not understand in 10 seconds uninstall |
| Store and policy compliance | 15% | Binary gate: fail it and the app cannot be listed at all |
| Monetisation actually working | 10% | D-072 makes stamps the revenue |
| Engineering foundation | 10% | Decides how cheaply every other gap can be closed |
| Performance and stability | 10% | Ratings punish slowness and crashes fast |
| Visual polish and brand | 10% | First impression in the store and on the home screen |
| Localisation and accessibility | 10% | Three languages are promised; tourists read their own |

**Overall = Σ (score × weight)**, rounded to the nearest whole point. §8 shows the working.

**Scale used for each area:**

| Score | Meaning |
|---|---|
| 17–20 | Would pass a big-company release review as is |
| 13–16 | Solid; minor issues |
| 9–12 | Works, with visible flaws a user will notice |
| 5–8 | Significant gaps; not shippable in this area |
| 0–4 | Missing or unproven |

---

## 4. Launch blockers (P0)

Any one of these on its own should stop a release.

### P0-1 — The launcher icon is Expo's template placeholder

- **Evidence:** `app/assets/icon.png` is a blue "Λ" drawn over a blueprint grid of circles and
  dashed guide lines. That is the icon every new Expo project starts with.
  `android-icon-foreground.png` is the same mark, and it shows in the P30's status bar while the
  recorder runs.
- **Why it matters:** the icon is the first thing a store visitor sees, and it stays on the home
  screen after install. A template icon marks the app as unfinished at a glance, and store
  reviewers and users both notice it.
- **Fix size:** small in effort, but it needs a brand decision (`docs/design-brief.md` §7 covers
  the name).

### P0-2 — A developer screen can be reached from the production build

- **Evidence:** Settings → *Sobre* → *Detalhes técnicos* opens a screen whose header reads
  **"Recorder — Phase 1 debug view. Not the product."** (`app/src/ui/DebugScreen.tsx:301`).
  It is English-only on a Portuguese phone and shows `Provider: expo-location`, `Trip id: 30`,
  fix counts and timestamps. The route is not gated behind `__DEV__`:
  `App.tsx:178` renders it and `SettingsView.tsx:465` links to it. The source also has buttons
  that start recording on hard-coded profiles (`DebugScreen.tsx:515,521`).
- **While on this screen, `uiautomator` reported "could not get idle state"**: the screen keeps
  redrawing. That is harmless on its own, but it confirms a live diagnostic view is running in
  the shipped app.
- **Why it matters:** it is the least professional surface in the app. It invites support
  tickets and could let a user change recorder state by accident.

### P0-3 — Stamps are locked, but the app has no way to pay

- **Evidence:** the free tier is live (T-155): ten stamps plus the first levada, and everything
  after that is drawn locked. `app/src/entitlement/entitlementStore.ts` says so itself:
  *"Today it is a local flag with no way for a user to set it."* Play Billing is T-156, and it
  is open.
- **Why it matters:** if this shipped as is, a user would earn their 11th stamp, see a padlock,
  and find no purchase screen, price or "unlock" button. From the user's side that looks like a
  bug in the reward itself. It produces 1-star reviews, and there is no revenue to set against
  them.
- **The only two acceptable states for a release:** billing that works end to end, including
  restore and refunds, **or** no lock at all. D-072 notes that Play forbids moving an app from
  free to paid. That rule is about the listing price, not in-app purchases, so shipping without
  the lock first is allowed. Confirm that reading before relying on it.

### P0-4 — The core loop has never worked on real hardware

The core loop is: record → reach a place → earn a stamp → trip ends → souvenir.

- **Evidence, from the project's own records and the device:**
  - `docs/field-notes.md:186`: *"Zero stamps… the award path is still untested on real
    hardware, not proven."* The 831 real fixes from August never came inside any geofence.
  - `HANDOFF.md` and `PROJECT_PLAN.md` (OD-10): nobody has completed a trip with the app.
  - The on-device debug screen shows **Trip id 30, started 28/08/2026 10:59:56**, still open on
    22/09, 25 days later, with 1,213 fixes.
  - The passport reads **0 / 80**.
- **Why it matters:**
  - The product is sold on the stamp and the souvenir, and neither has been seen on a phone.
  - A trip that never ends means the *"your map is ready"* notification and the souvenir never
    arrive. On an island where residents are also potential users, the trip-end rule decides
    whether the payoff ever happens.
  - 697 unit tests prove the logic is consistent with itself. They do not prove it matches the
    real world.

### P0-5 — The map fails to appear on about 1 launch in 5

- **Evidence:** T-177 records 2 blank launches out of 9 on this P30: grey screen, no Google
  wordmark, `AndroidViewsHandler` with no child. There is no known cause and no reliable way to
  reproduce it. The recorder keeps working, but the user sees nothing.
- **During this review:** one cold launch rendered correctly. One sample says nothing about a
  22% failure rate.
- **Why it matters:** the map is the main screen. If about 22% of launches show a blank grey
  screen, users will call the app broken and uninstall.

### P0-6 — Store and policy compliance is not done

| Item | Status | Consequence |
|---|---|---|
| Hosted privacy-policy URL | ⚠ Blocked (`docs/store-privacy-answers.md:93`) | Play requires one for any app requesting location. Without it the listing cannot be submitted |
| Background-location declaration and demo video (T-123) | Open | Play's strictest review. Rejection is common, and each cycle can take days |
| Data Safety form (T-122 marked done: "no data collected") | Conflicts with T-117c | The release APK contains the Maps SDK, Firebase Cloud Messaging (`c2dm.permission.RECEIVE`) and the Play install referrer. Play counts data collected by third-party SDKs, so an inaccurate form is a policy violation |
| Release signing key (T-117e) | Not created | Once it exists, Google's re-signing SHA-1 must be added to the Maps key, or **the map is grey for every store user** while working in every internal build |
| Store listing assets (T-133) | Open | No screenshots, feature graphic or preview video. The listing text is drafted in `docs/marketing-plan.md` |
| Trademark search on "Proa" (D-074) | Open | Renaming after launch costs reviews, installs and search ranking |

### P0-7 — Privacy text makes claims the project's own rules forbid

- **Evidence:** the iOS location permission texts in `app/app.json:14-16` say *"Your location
  stays on this phone and is never uploaded"* and *"Nothing is uploaded."* The Android plugin
  text at line 87 is milder. D-073 says never to claim *"works offline"* or *"nothing leaves your
  phone"*, because the Google map loads over the network. The in-app sentence
  *"A sua viagem nunca nos é enviada"* ("your trip is never sent to us") is accurate. The
  absolute "never uploaded" is not safe.
- **Why it matters:** an absolute privacy claim is exactly what a reviewer, journalist or data
  protection authority tests. If one packet contradicts it, the app's main selling point turns
  against it.
- **Note:** Android does not show these purpose strings in its own permission dialog, so today
  the risk is mainly iOS and any text copied into store listings.

---

## 5. Product and UX findings (P1)

These would not stop a submission, but they would stop it from doing well.

### P1-1 — The main screen does not show what the app is for

- **Observed:** with 0 stamps, the home screen is an ordinary Google Map around the user's
  location. It shows Google's own green place pins (*Quinta Splendida Botanical Garden*,
  *Praia dos Reis Magos*, *Levada do Caniço*), a settings button, a grey passport sticker and a
  big green **"Começar a registar"** ("start recording") button.
- **What is missing:** any sign of the 80 places, the nearest one to go for, progress, or why
  the passport matters. D-070 shows only *collected* places on the map, so a new user sees
  **nothing to collect**. Meanwhile Google's pins look like targets but have nothing to do with
  the app.
- **Why it matters:** the first 10 seconds decide whether a tourist keeps the app. At the moment
  those seconds show "Google Maps with a button". The paid feature is invisible at exactly the
  moment it should sell itself.

### P1-2 — The app contradicts itself about recording

- **Observed, all at the same moment:**
  - Settings → *Registo*: **"A registar a sua viagem · Preenche-se sozinho"** ("recording your
    trip · fills itself in"), with background recording **ATIVADO**.
  - `dumpsys activity services`: `LocationTaskService` **isForeground=true**, with GPS updates
    requested every 10 s. The recorder really is running.
  - Home screen: the main button says **"Começar a registar"** ("start recording").
  - Onboarding (`strings.ts:49`): *"You do not need to open it again."*
- **Cause:** two separate ideas share one verb. One is always-on background recording. The other
  is an explicit "I'm on a walk now" mode (`PrimaryOverlay.tsx:285-315`). The code comment above
  that button says *"'Start walk', not 'Start recording'"*, but the text it actually shows is
  "Start recording" (`strings.ts:264`). So the code and its own notes disagree too.
- **Why it matters:** users cannot tell whether they are being recorded. A privacy-first app
  cannot afford that confusion, and it will cause missed stamps ("I thought it was on").

### P1-3 — Onboarding never introduces the product

- **Observed, from the text:** the pitch is *"This app quietly notes the places you visit…
  and turns them into a map of your trip."* The words stamps, passport, levadas and 80 places
  never appear. The app calls itself **"this app"** throughout, never *Proa*.
- **Why it matters:** onboarding is where the reason to keep the app gets set. Right now it
  sells a passive tracker, which is the part competitors give away free, and leaves out the
  collecting that is actually paid for.

### P1-4 — The place card is thin, and half English on a Portuguese phone

- **Observed:** tapping *Pico do Areeiro* opens a sheet with:
  - **"VIEWPOINT"** — English
  - "Pico do Areeiro"
  - "Santana"
  - **"13 km away, in a straight line"** — English
  - "Ver no mapa" / "Fechar"
- **Cause:** hardcoded strings in `app/src/places/placeCard.ts:118-129` (`CATEGORY_LABELS`,
  `STRAIGHT_LINE_NOTE`) and `app/src/ui/PlaceCardView.tsx:67,93` (`· Collected`, `away,`).
  **`i18nCoverage.test.ts` does not catch them**, because they sit inside `{}` expressions,
  the blind spot `HANDOFF.md` already warns about.
- **Missing content:** a photo, a one-line reason to go, practical information (walk length,
  difficulty, parking) and directions. For a tourist, this card is where the value is, and today
  it holds a name and a straight-line distance.
- **Layout:** the sheet has no dimmed backdrop, so the stamps behind it compete with it for
  attention.

### P1-5 — Sharing (the viral loop) is weak

- **You can share at 0 / 80.** *Partilhar* is active with no stamps, and the preview is an almost
  entirely black image.
- **The card text is English-only:** `app/src/souvenir/shareCard.ts:260` hardcodes
  `'place collected' / 'places collected'`. A Portuguese or German user shares an English card.
- **The file is named `ReactNative-snapshot-<digits>.png`.** That is the default from
  `captureRef(... result: 'tmpfile')` (`shareTrip.ts:112`). The name is visible in the Android
  share sheet and to whoever receives the image, and it gives away the framework.
- **Why it matters:** shared souvenirs are the growth plan (T-136 targets half of testers
  sharing unprompted). An English card named after the framework undercuts that.

### P1-6 — Settings reads like engineering notes

- **Observed copy:**
  - *"Preferimos mostrar-lhe um número medido a um palpite, e medi-lo exige um telemóvel real —
    por isso, para já, a diferença é descrita."* (`strings.ts:519`). In English: "we'd rather show
    you a measured number than a guess, and measuring it needs a real phone". It tells the user
    the app has not been tested on a real phone.
  - Long paragraphs under every control. The settings screen takes four full swipes on a
    6.1-inch phone.
  - *"AJUDAR A MELHORAR A APLICAÇÃO → Enviar um registo"* ("help improve the app → send a log"):
    diagnostic export shown to every user.
- **Missing, but expected in a store app:** version number, language choice (it only follows
  the system), support or contact link, rate the app, open-source licences (Google Maps
  attribution and other licences), terms, and restore purchase (needed once billing exists).
- **Unclear:** the *Registo* card pairs "A registar a sua viagem" with a button labelled
  "Abrir definições do telemóvel" ("open phone settings"). It isn't clear why recording would
  send you to system settings.

### P1-7 — Trip end is unproven for residents and long stays

- Trip 30 has been open for 25 days on a phone that never left Madeira. Trip end is decided by a
  fix outside the archipelago (`tripEnd.ts`, field notes line 160). A resident, or a tourist whose
  phone is off during the flight home, may never get the ending that the souvenir and the second
  of the "two messages" depend on.

---

## 6. Polish, language and accessibility findings (P2)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| P2-1 | Wrong gender agreement: **"Ver todos os 19 Aldeias"** | `strings.ts:378` builds `'Ver todos os {total} {category}'`; *aldeias* and *levadas* are feminine | Give each category its own string, or ask a native speaker |
| P2-2 | **"Bem-vindo"** is masculine only | `strings.ts:42` | "Boas-vindas" |
| P2-3 | **"0 / 80 lugares por visitar"** reads backwards: the big number counts visits, the caption says "places to visit" | `strings.ts:348` (EN "places to collect") | Name what the number counts |
| P2-4 | A second, **English** accessibility label on every stamp: *"Pico do Areeiro, not collected yet"*, and *"Passaporte, not collected yet"* on the home button | `StampArt.tsx:86`, a hardcoded fallback; seen in every passport dump | Translate it, or hide the inner label from accessibility |
| P2-5 | Uncollected stamps are all the same grey on dark panels, and hard to tell apart at arm's length | Screenshot 02 | Design pass |
| P2-6 | Dark stamp panels on a light page look like two different design languages | Screenshot 02 | Design pass |
| P2-7 | Stamps that run off the right edge still get tap areas: `Bica da Cana` bounds `[1032,1184][1032,1472]`, zero width | Passport dump | Harmless, but tidy it up |
| P2-8 | The passport placeholder on the map is a dark grey blob until the first stamp | Screenshot 01 | Make the empty state say something |
| P2-9 | Memory reached **≈510 MB PSS** right after sharing (native heap 251 MB), against 275 MB at rest | `dumpsys meminfo` | Check on a 3–4 GB phone. The recorder shares the process, so memory pressure risks the recorder being killed |
| P2-10 | German translations were written by the assistant, and no German speaker has checked them (T-160a) | `HANDOFF.md` | Native review before a German listing |

---

## 7. What is genuinely good

Being straight about the problems means being straight about this too:

- **Engineering foundation.** 697/697 tests, `tsc --strict` clean, logic kept separate from
  device code so it can be tested without a phone, and tests that enforce contrast, branding and
  translation coverage. Replaying 831 real fixes found and fixed four real bugs (T-171 to T-174),
  including a recorder that claimed to run while dead. That is professional practice.
- **Performance on this device:**
  - Cold start: **402 ms** to first frame.
  - Passport scroll: **189 frames, 2.1% janky**, 50th/90th/99th percentile **6/11/18 ms**.
  - **No crash or ANR entries** in `dumpsys dropbox`.
  - Release APK: **36 MB**, down from 128 MB (T-117d).
- **Honest privacy design.** No account, no server, a real *erase everything* control with an
  honest warning about phone backups, and backup rules that were thought through.
- **Content.** 80 hand-picked places across five categories, with a written defence for each one
  (D-064). That is a real competitive advantage over generic map apps.
- **Stamp artwork** has character and a consistent visual system.
- **Portuguese is mostly good.** Apart from the leaks listed above, the Portuguese copy is natural
  and warm.
- **The background recorder works on this phone right now:** a foreground service, GPS every
  10 s, last fix 50 s old at the time of the check.

---

## 8. Scoring, area by area

### 8.1 Core loop proven on real hardware — **4 / 20** (weight 20%)

- **+** The recorder records on real hardware (verified today) and survived the fixes in T-174.
- **+** Geofences are registered (the debug screen shows "Geofencing: yes").
- **−** No stamp has ever been earned on a real phone.
- **−** No trip has ever been completed; one has been open for 25 days.
- **−** The souvenir film has never been seen moving (`HANDOFF.md`, OD-12).
- **−** Battery, overnight survival and GPS under tree cover are unmeasured.

Recording works; everything the user is promised after recording is unproven, so this sits in
the 0–4 band.

### 8.2 Clarity of what the app is for — **6 / 20** (weight 15%)

- **+** The passport, once opened, explains itself ("Vá a um e ele preenche-se sozinho" — "go to
  one and it fills itself in").
- **−** The home screen hides the 80 places (P1-1).
- **−** The recording state contradicts itself (P1-2).
- **−** Onboarding pitches the wrong product (P1-3).
- **−** The place card gives no reason to go anywhere (P1-4).

### 8.3 Store and policy compliance — **3 / 20** (weight 15%)

- **+** The prominent disclosure before the background-location request exists (T-121).
- **+** Delete-all exists (T-125).
- **+** The iOS privacy manifest is in place.
- **+** `usesCleartextTraffic=false`.
- **−** No privacy-policy URL, no background-location submission, a Data Safety answer that
  conflicts with the SDKs in the APK, no signing key, no listing assets, no trademark search, and
  overstated privacy strings (P0-6, P0-7).

### 8.4 Monetisation actually working — **2 / 20** (weight 10%)

- **+** The free-tier logic is written and tested (`freeTier.ts`), and D-075's rule never to take
  away an earned stamp is sound.
- **−** There is no billing, no price screen, no restore and no refund handling, and the lock is
  already active in the build (P0-3). As shipped, it turns away paying intent and earns nothing.

### 8.5 Engineering foundation — **15 / 20** (weight 10%)

- **+** Tests, strict types, module boundaries and honest docs, as described in §7.
- **−** A debug route is not gated to development builds.
- **−** The i18n gate has a known blind spot, and strings slipped through it.
- **−** Code comments contradict the shipped text (P1-2).
- **−** `app/attic/` is kept but not type-checked, so it will rot.
- **−** The project docs are large enough that keeping them current is itself a cost.

### 8.6 Performance and stability — **14 / 20** (weight 10%)

- **+** Fast cold start, smooth scrolling and no crashes on this device.
- **−** T-177, the blank map on about 22% of launches.
- **−** A memory spike after sharing.
- **−** Only one 2019 flagship has been measured; nothing low-end.

### 8.7 Visual polish and brand — **8 / 20** (weight 10%)

- **+** The stamp artwork is good, and the map controls were checked for contrast.
- **−** The template launcher icon (P0-1).
- **−** Dark panels on a light page, grey stamps that look alike, a sheet with no backdrop, and a
  grey blob as the passport placeholder.
- **−** The brand appears nowhere in the app: onboarding says "this app".

### 8.8 Localisation and accessibility — **8 / 20** (weight 10%)

- **+** Three languages are wired in, the Portuguese copy is good, and most controls have
  accessibility labels.
- **−** English leaks in the place card, share card, debug screen and stamp labels.
- **−** Gender agreement errors.
- **−** German has not been checked by a native speaker.
- **−** No in-app language choice.
- **−** No TalkBack pass.

### 8.9 The arithmetic

| Area | Score | Weight | Weighted |
|---|---:|---:|---:|
| Core loop proven on real hardware | 4 | 20% | 0.80 |
| Clarity of what the app is for | 6 | 15% | 0.90 |
| Store and policy compliance | 3 | 15% | 0.45 |
| Monetisation actually working | 2 | 10% | 0.20 |
| Engineering foundation | 15 | 10% | 1.50 |
| Performance and stability | 14 | 10% | 1.40 |
| Visual polish and brand | 8 | 10% | 0.80 |
| Localisation and accessibility | 8 | 10% | 0.80 |
| **Total** | | **100%** | **6.85 → 7 / 20** |

**How to read it:** the areas you control from the desk (engineering, performance) score 14–15.
The areas that need a real trip, a real design pass or real store work score 2–8. The low score
is not about sloppy work. It says the project has put its effort into the code, and the other
work a release needs has not been done yet.

---

## 9. Is it an MVP? Is it publishable?

### Is it an MVP? **No.**

A minimum viable product has to **deliver its core value to a real user at least once**. For
Proa that value is simple: *go somewhere on the island → a stamp appears → at the end you get a
souvenir of your trip.* None of those three steps has happened on a real phone. What exists is a
**well-engineered prototype**. The parts are built and tested, but they have not been proven
together in the real world.

### Is it publishable? **No.**

Even setting quality aside, Play would stop it: there is no privacy policy URL, no
background-location approval and no signing key. And even if it passed review, the template icon,
the debug screen and a paywall with no way to pay would cause damage in the first week of
ratings that is hard to reverse.

### What would change the answer

MVP means P0-1 to P0-5 are closed and **one real trip by the project lead** has produced at least
one stamp, a trip end and a souvenir.
Publishable means the MVP bar is met, P0-6 and P0-7 are closed, P1-1, P1-2, P1-4 and P1-5 are
addressed, and a closed beta (T-129) has run.

---

## 10. Path to a publishable v1, in order

Ordered by *risk removed per unit of effort*, not by how interesting the work is.

| # | Action | Closes | Rough size |
|---|---|---|---|
| 1 | Replace the icon and splash with a real brand mark | P0-1 | Small, plus a brand decision |
| 2 | Gate `DebugScreen` and "Enviar um registo" behind `__DEV__` or the field build only | P0-2 | Small |
| 3 | Decide: **ship with no lock** (set the entitlement to open), **or** build Play Billing with restore | P0-3 | Small / large |
| 4 | Fix every English leak found here, and close the `{}` blind spot in `i18nCoverage.test.ts` | P1-4, P1-5, P2-4 | Small |
| 5 | Name the shared file `Proa-<date>.png`; disable Share at 0 stamps | P1-5 | Small |
| 6 | **One real trip by the project lead**, planned to pass through at least 3 of the 80 places, and ending with a trip end | P0-4 | 1–2 days on the island |
| 7 | Find the cause of T-177 (blank map) with logging on the P30 | P0-5 | Unknown — the highest-risk item |
| 8 | Resolve "recording" into one idea and one word across home, settings and onboarding | P1-2 | Medium (product decision + copy) |
| 9 | Show the uncollected places, or at least the nearest one, on the home map | P1-1 | Medium (it revisits D-070) |
| 10 | Rewrite onboarding around the passport and name the app | P1-3 | Small–medium |
| 11 | Add photo, why-go line and practical info to the place card | P1-4 | Medium (content work × 80) |
| 12 | Host the privacy policy; soften the absolute privacy claims; redo the Data Safety answers against the real SDK list | P0-6, P0-7 | Small–medium |
| 13 | Create the upload key; add Play's re-signing SHA-1 to the Maps key | P0-6 | Small, but exact |
| 14 | Upload to Play internal testing → read the pre-launch report (per-language screenshots, accessibility, crashes) | Several | Small |
| 15 | Background-location declaration + demo video | P0-6 | Medium, with review round-trips |
| 16 | Closed beta with real visitors (T-129), then store listing assets (T-133) | P0-4, P0-6 | Weeks |

**Realistic estimate:** several weeks of focused work to a publishable v1, not days. Items 6
and 7 carry most of the uncertainty.

---

## 11. Limits of this review

- **One device.** A 2019 flagship on Android 10 with EMUI. Low-end phones, Android 14+ (which has
  stricter background-location and foreground-service rules), Samsung/Xiaomi battery managers,
  tablets and small screens were not tested.
- **Portuguese only on screen.** English was judged from source; German was not judged.
- **Onboarding was not seen on the device** (see §2).
- **No outdoor test.** GPS accuracy, battery and background survival cannot be judged from a desk.
- **The dark map and the replay film were not exercised.**
- **The T-177 rate (2 of 9) comes from the project's own log**, not from this review. One launch
  here rendered correctly, which neither confirms nor rules out the rate.
- **Scores are judgement.** The weights are stated so anyone can disagree with them openly and
  recompute.

---

## 12. Appendix — raw measurements and evidence

### 12.1 Package (from `dumpsys package com.proa.madeira`)

```
versionCode=1 minSdk=24 targetSdk=36 versionName=0.1.0
flags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP ]
base.apk 37,754,971 bytes
Runtime permissions granted: FINE, COARSE, BACKGROUND location
Also requested: FOREGROUND_SERVICE(_LOCATION), POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED,
  WAKE_LOCK, VIBRATE, INTERNET, ACCESS_NETWORK_STATE,
  com.google.android.c2dm.permission.RECEIVE            ← Firebase Cloud Messaging (T-117c)
  com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE
  + 17 launcher-badge permissions (Samsung, HTC, Sony, Huawei, Oppo…) from a badge library
```

The 17 launcher-badge permissions are harmless, but they lengthen the permissions list that
careful users and reviewers read.

### 12.2 Cold start

```
LaunchState: COLD   TotalTime: 402 ms   WaitTime: 404 ms
```

### 12.3 Passport scroll (`dumpsys gfxinfo`, second, valid run)

```
Total frames rendered: 189
Janky frames: 4 (2.12%)
50th percentile: 6ms   90th: 11ms   99th: 18ms
Slow UI thread: 1      Frame deadline missed: 3
```

### 12.4 Memory (`dumpsys meminfo`, KB)

| Moment | Total PSS | Native heap | Graphics |
|---|---:|---:|---:|
| Right after share sheet | ~509,730 | 251,304 | 140,008 |
| After returning, at rest | ~274,697 | 102,316 | 53,048 |

### 12.5 Recorder truth (`dumpsys activity services` / `dumpsys location`)

```
ServiceRecord com.proa.madeira/expo.modules.location.services.LocationTaskService
  isForeground=true  channel=com.proa.madeira:madeira-location-updates
Request[ACCURACY_FINE gps requested=+10s0ms]  WorkSource{com.proa.madeira}
```

On-device debug screen at 21:43: Recording **yes**, last fix **50 s** ago, Geofencing **yes**,
Sampling profile **walking**, **Trip id 30, Started 28/08/2026 10:59:56**, Fixes **1213**.

### 12.6 Automated checks

```
npm test         → tests 697, pass 697, fail 0   (~2.5 s)
npx tsc --noEmit → exit 0
```

### 12.7 English text found on a `pt-PT` device

| Where | Text | Source |
|---|---|---|
| Place card | `VIEWPOINT` | `places/placeCard.ts:118` |
| Place card | `13 km away, in a straight line` | `ui/PlaceCardView.tsx:93`, `placeCard.ts:129` |
| Place card (collected) | `· Collected` | `ui/PlaceCardView.tsx:67` |
| Share image | `places collected` | `souvenir/shareCard.ts:260` |
| Stamp a11y labels | `…, not collected yet` | `ui/StampArt.tsx:86` |
| Debug screen | whole screen | `ui/DebugScreen.tsx` |
| Shared file name | `ReactNative-snapshot-….png` | `souvenir/shareTrip.ts:112` |

### 12.8 Screenshots taken (scratchpad, not committed)

1. `01-map.png` — home map, 0 stamps, Google pins, "Começar a registar"
2. `02-passport.png` — passport, 0 / 80, grey stamps on dark panels
3. `03-place.png` — place card with English category and distance
4. `04-settings.png` — "A registar a sua viagem" while home says "Começar a registar"
5. `05-share.png` — share sheet: black thumbnail, `ReactNative-snapshot…png`
6. `06-debug.png` — "Phase 1 debug view. Not the product." in the release build

---

*Reviewed against the release build on real hardware. No app code or app data was changed
during this review.*

# The reference app, taken apart — 2026-09-22

**What this is.** A working list of everything worth improving in Proa that came out of looking at
**WalkNYC 1.1.6** (`com.walknyc.app`, versionCode 9, targetSdk 36) on the project lead's **Huawei
P30 (ELE-L29, Android 10)**, over adb, on 2026-09-22. It is **findings, not decisions** — nothing
here is a `D-0xx` and nothing here has been agreed.

`docs/competitors.md` stays the place for what the two products *are*. This file is only the
teardown: what they do on a phone, and what it says about ours.

**How it was gathered.** `dumpsys package`, `dumpsys notification`, `dumpsys deviceidle whitelist`,
`dumpsys activity services` and `uiautomator dump`; **one screenshot**, taken mid-simulation because
the question was genuinely visual. No APK decompilation. Nothing was granted, revoked, sent or
purchased, and the phone was left on the screen it started on.

⚠ **What was deliberately not touched.** The **live recorder** — pressing *Start Walk* writes a
walk into the project lead's own app, so **Run Simulation** was used instead, which the app's own
copy says does not affect walk data (verified afterwards: it does not). **Import** was left alone
entirely; it is an OAuth flow into the project lead's Strava and Google accounts. The leaderboard
and anything else that talks to their server were not opened.

⚠ **Two limits on everything below.** It is **one handset on Android 10**, so some of what the
permission flow does there (an inline *"allow all the time"* option) does not exist on Android 11+.
And the install is fresh — **0 of 86 638 blocks** — so nothing here is about how the app behaves
with a year of data in it.

---

## Ranked

Each item says what WalkNYC does, what Proa does today, and what it would take. Grade is
**defect** (we are wrong), **idea** (they are better), **evidence** (settles an open question),
**correction** (this file was wrong) or **open** (not settled yet).

---

### 1. ⚠⚠ Our privacy copy claims something that is not true — **defect**

**Theirs**, in Settings:

> your walk data is stored only on your phone, never on our servers. Uninstalling the app removes
> it from the phone, **though a device backup you've enabled (such as Google Drive) may keep a
> copy.** You can also back up your data to a file to prevent data loss.

**Ours.** `plugins/withAndroidBackupRules.js` deliberately puts the SQLite database into Google's
encrypted device backup — `allowBackup: true` in `app.json`, and `ALLOW_BACKUP` confirmed in the
P30's own package flags. That is a **good decision**, argued in ARCHITECTURE §4a: it is the answer
to *"my phone died on day 5"*.

**The privacy policy gets it right** — `privacyPolicy.ts` says the trip is in the phone's ordinary
iCloud/Google backup, and `privacyPolicy.test.ts` fails the build if that sentence disappears.
**Four in-app strings say the opposite:**

| Key | Claims |
|---|---|
| `settings.about.nothingLeaves` | "Nothing you record leaves this phone." |
| `settings.erase.footnote` | "There is no backup and no account to restore from" |
| `erase.confirm.body2` | "There is no backup… what is on this phone is the only copy" |
| `onboarding.location.body2` | "nothing is uploaded" |

**Two consequences, the second worse.**

- **D-073 already bans *"nothing leaves your phone"*** for an unrelated reason (D-057, Google's
  basemap). These strings contradict an accepted decision, and now for a *second* independent
  reason nobody had joined up.
- **"Erase everything" does not erase the Google backup**, and `erase.confirm.body2` tells the user
  it is the only copy **at the moment they are deciding**. That is not an inaccurate boast, it is
  an inaccurate statement inside a privacy action.

**What it would take.** The four strings, in three languages. The erase flow may want more than
copy — a line telling the user where the other copy is and that their phone's settings control it,
which is what the privacy policy already says. ⚠ The copy is tier 1 (an internal contradiction);
changing what the erase dialog *promises* is closer to tier 2 and should be recorded.

---

### 2. State the cheap tier's cost behaviourally, not as a percentage — **idea**

**Theirs:**

> Battery Saver may miss the first 2-3 blocks of your walks, but battery use is significantly
> reduced.

This is the way out of the bind D-041 puts us in. They give a **concrete cost in the unit the user
came for** without ever claiming a battery figure.

**Ours** (`settings.quality.detail.saver`) is qualitative: *"lets your phone rest when you are
still… the line on your map will be rougher."*

**Ours is available and it is not a measurement.** The stationary profile's `minTimeMs` is **five
minutes** (`samplingPolicy.ts`), so on Saver the first minutes of a walk can be missing. That is a
fact about a constant we chose, not a number off a battery — **D-041 permits it**, the same way it
permits describing the difference at all.

---

### 3. Two notification channels at different importance — **idea**

**Theirs:** `walknyc.tracking` at importance **2** — silent, no badge, `category=service` — for the
ongoing foreground-service notification. `walknyc.stationary` at importance **3** — sound, badge —
for the exceptional one. A user can silence the permanent notification **without** silencing the
alert that matters.

**Ours:** nothing in `notify/` or `recording/` creates a channel at all. D-011's two notifications
and the foreground-service notification inherit whatever `expo-notifications` and `expo-location`
set up between them.

**Why it matters beyond tidiness.** If the day-1 health check (T-049) lands on the same low
channel as the service notification, **it arrives silently** — and a health check nobody hears is
the failure T-049 exists to prevent. ⚠ There is already a related unknown on record: T-102's note
says the reveal notification was logged as sent but never appeared in `dumpsys notification`.
**Checking which channel each of our notifications actually uses on the P30 is cheap and has not
been done.**

---

### 4. Permission repair at two levels, ambient not one-shot — **idea**

**Theirs**, and it is finer than "put it on the button":

- **Blocking gap** (no location at all) → the **primary button** becomes `Grant location
  permission`, and reverts to `Start Walk` once granted. One button, two states.
- **Optional gap** (no background) → a **dismissible banner**: *"Always Gathering needs background
  location / Tap to set location to Allow all the time in Settings."* It names **the exact OS
  wording** the user has to find.

**Ours:** `PrimaryOverlay.tsx` explicitly disclaims permission state — *"permission state is not
this component's business"*. Recovery is the once-only downgrade prompt (T-044) and a Settings row.
A user who denied at first run, or whose grant was revoked by unused-app hibernation, gets a map
that is simply quiet until the day-1 health check.

**The dismissibility is the part to copy.** It makes the banner an offer rather than a nag, which
is the D-008 objection to an always-present ask. Naming the exact OS string is something our
keep-running note already does (*"Look for this app in the list"*).

---

### 5. Ask with the product visible behind the ask — **idea**

Every one of their permission cards is a modal **over the working map**, with the city and
`0 / 86 638 blocks · 0,0%` behind it. Their empty states do the same — *"No walks yet"* overlays the
map rather than replacing it.

**Ours:** the 12-hour Always upgrade **replaces the whole screen** (`App.tsx`), which throws away
the one asset the twelve-hour delay exists to create. `permissionPolicy.ts` argues for the delay in
exactly these words: *"somebody who has watched a place fill in has a reason to say yes."*

First-run screens should stay full-screen — there is nothing behind them yet. This is about the
day-2 prompt and the downgrade recovery. **Cost:** the prompt short-circuits before `MapScreen`
mounts, so it has to become an overlay the map renders rather than a branch in `App.tsx`.

---

### 6. A shipped simulation mode — **idea, and it is aimed at a live blocker**

Settings → Simulation → **Run Simulation**: *"Replay a walk on the map. Your walk data will not be
affected."* Run twice and watched to the end on 2026-09-22.

**What it is.** One button. No walk picker, no speed picker, no length — it replays a **bundled,
dated real walk** (*"fev 12  4:31:45 a.m."*, Greenwich Village round Washington Square) at **80×**.
The multiplier is shown as a badge at the start and is **not persistent**; by mid-run it is gone.

**What it does on screen, and three of these are the part worth copying.**

- ⚠ **The primary action changes colour.** The app's chrome is green — gear, stats, *Start Walk*.
  In simulation the button is **blue** and reads *Stop Simulation*, with a blue **`▶ SIMULATION
  MODE`** pill above the progress bar. You cannot be in this mode and not know it.
- ⚠ **The simulated position is drawn differently** — a grey pin, not the live blue location dot.
  Simulated "where you are" never impersonates real "where you are".
- Streets fill in **green segment by segment** as it passes, and the counter climbs live: it
  reached **25 / 86 638 blocks**. Re-centre stays available throughout.

**What it does not do.**

- **No foreground service starts.** `dumpsys activity services com.walknyc.app` was empty for the
  whole run — the simulation does not go near the recorder.
- **No data is written.** Verified after stopping: `WALKS 0`, `New Blocks 0`, counter back to
  `0 / 86 638`. Their promise holds.

**Two things they got wrong, which are free for us to get right.**

- ⚠ **There is no terminal state.** When the replayed walk ends, the clock disappears and the
  counter freezes — but the badge still says `SIMULATION MODE`, the button still says *Stop
  Simulation*, and nothing says it finished. The user has to notice that nothing is moving.
  **Proa has a natural ending built already**: trip end → the souvenir (D-076). A simulation that
  runs into the souvenir is the demo, and it is the thing their version is missing.
- **The banners stay up throughout**, covering roughly the top third of the screen during the one
  mode whose purpose is to show the map off. ⚠ This is a nit, not the design failure I first called
  it — see item 11. A dedicated mode could hide transient chrome; the permission warning is
  arguably still true during a simulation.

**Why this is not just a nice-to-have.** HANDOFF blocker 2 is *"nobody has completed a single trip
with this app"*, and it names the consequence: **the store screenshots are a replayed route**. This
is how the reference app gets a populated map to photograph without walking anywhere, and it would
let the project lead demo the whole chain from the sofa.

**What we already have.** `tools/replay-route.sh` feeds a route into the emulator over adb, with
four routes in `tools/routes/` — but it drives the *emulator's* GPS from a laptop, so it is not
reachable on a real phone and not reachable by the project lead on a sofa. The gap is a user-facing
entry point and the mode chrome, not the route data.

⚠ **Costed, not recommended.** This is squarely the kind of thing D-032 deletes from v1, and the
honest version of the argument is that it earns its place only if it is what unblocks the store
screenshots.

---

### 7. Their empty and zero states are framed upward — **idea**

- Rank **#23 816** is captioned *"Beating 7 walkers across NYC"*.
- `WALKS 0` sits under *"Replay each walk on the map with its path, timestamps, and the blocks it
  turned green"* — the empty state describes what the feature will be, not that it is empty.
- Stats with no data show **`—`**, not `0`.

That last one is D-041's instinct, shipped: **a dash where there is no number**, which is exactly
what `batterySentence()` does by returning null. Worth knowing a real app in this category does the
same rather than inventing a zero.

Proa's zero state is the passport at 0 of 60 on day one, and `places.emptyBody` already does this
well (*"These are the places. Go to one and it fills in by itself"*). No change proposed — listed
because it is the one place our copy is clearly ahead and should not be regressed.

---

### 8. D-045's held-in-reserve option is proven shippable — **evidence**

WalkNYC declares **`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`**, and `dumpsys deviceidle whitelist`
shows `user,com.walknyc.app,10238` — the exemption was asked for with the one-tap dialog and
granted.

D-045 chose the worse route (the settings list) **only** to avoid putting a second restricted
permission into the same Play submission as background location. That reasoning is intact, but
*"Play will not wear it for an app like ours"* is now off the table: here is an app like ours, with
`ACCESS_BACKGROUND_LOCATION: restricted=true`, shipping it on Play.

⚠ **Still T-053's call.** D-045 says the evidence to adopt it is OEMs killing the recorder in
practice — and the P30 is an EMUI device, which is where that would show.

---

### 9. Health Connect is the route they took for steps — **evidence**

They declare **`android.permission.health.READ_STEPS`** and ship
`androidx.health.platform.client.impl.sdkservice.HealthDataSdkService`.

D-081 deferred the pedometer to v2 and named exactly two honest options — a native module reading
the cumulative counter, or **Health Connect, "a new dependency, a separate permission and its own
Play declaration"**. The reference app took the second. That does not make it right for us, but
when T-090/T-034a come back to it, this is a worked example rather than a guess.

---

### 10. What their flow costs them, measured once — **evidence, weak**

After the six-popup first run the project lead photographed, the P30 shows:

| Permission | State |
|---|---|
| `ACCESS_FINE_LOCATION` | granted |
| `ACCESS_COARSE_LOCATION` | granted |
| `ACTIVITY_RECOGNITION` | granted |
| **`ACCESS_BACKGROUND_LOCATION`** | **granted=false, USER_SET** |
| battery exemption | granted |

The barrage got denied on the one permission it most wanted.

⚠⚠ **This is n=1 and the user was the project lead, who may have declined deliberately to show
the flow.** It is an anecdote. It is recorded because it points the same way D-008 already does,
not because it demonstrates anything.

---

### 11. ⚠ The banners are well-behaved, and my first reading of them was wrong — **correction**

**What I claimed**, twice: that the promo card and the orange permission warning "accumulate" over
the map, and that this was the failure design brief §3 watches for. **The project lead pushed back
— both banners carry an `×`, and they liked the pattern.** They were right, and it was testable, so
it was tested rather than argued.

**The test, 2026-09-22.** Dismissed the promo banner, `am force-stop`, cold relaunch. **It did not
come back.** Dismissal is persistent.

**So what is actually there is two different things that happen to be on screen at once on a fresh
install:**

| | Behaviour | Verdict |
|---|---|---|
| Promo card (*"New: import from Strava…"*) | Dismissible, **stays dismissed across a cold start** | Fine |
| Orange warning (*"Always Gathering needs background location"*) | Dismissible, but **persists because the condition is still true** — background location is still denied | **Correct**, and the pattern item 4 recommends |

**The correction that matters.** *"Two banners visible at once on a fresh install"* is not
*"banners accumulate"*. The second is the design-brief §3 failure; the first is two well-behaved
components that happen to coincide on day one. A warning that survives dismissal **while the
problem survives** is not a nag, it is the app declining to forget a real defect — and it disappears
by itself when the user fixes the permission.

⚠ **This is the pattern to copy, not to avoid**, and it is the same conclusion item 4 reached from
the other direction.

⚠ **Note on the device:** the promo banner on the project lead's phone was dismissed by this test
and will not return. Its feature is still reachable at Settings → Import.

---

### 12. "It runs smoother than mine" — the comparison cannot be made yet, and finding out why is the finding — **correction + open**

The project lead's impression, and the project lead cleared the way to measure it properly on
2026-09-22. It was measured, and then **almost all of it had to be thrown away.** What is left is
more useful than the numbers would have been.

#### What survives — WalkNYC's side, all valid

| | WalkNYC 1.1.6 (Play release) |
|---|---|
| Installed APK | 53 MB, `splits=[base, config.arm64_v8a, config.pt, config.xxhdpi]` |
| Cold start (`am start -W`) | **760 ms** / 813 ms over two runs |
| Pan-and-zoom workload | 230 frames, **0.87% janky**, 90th 7 ms, 99th 15 ms |

An **App Bundle**, so Play sent that phone one architecture, one density and **only Portuguese**.

#### ⚠⚠ What had to be retracted — everything on Proa's side

**The benchmark measured the wrong app.** `am start` on `com.proa.madeira` opens the
**expo-dev-launcher** — *"Development Build / DEVELOPMENT SERVERS / Start a local development
server with npx expo start"*. The 1 931 ms cold start and the 1 415 frames at 26.43% jank are
**the dev launcher's own list UI**, not Proa: no map, no trace, none of the app. Withdrawn
entirely.

**The APK size comparison goes with it.** Proa's 69 MB is a **dev-client** build — `expo-dev-client`,
every architecture, no minification. `docs/dev-build.md` says exactly this. 69 MB against a release
App Bundle's 53 MB is not a comparison, it is two different kinds of artefact.

**And a claim from the previous commit was simply wrong.** This file said *"`eas.json` has no
production profile… the submission in HANDOFF blocker 1 cannot be made with what `eas.json`
currently builds."* **There is a `production` profile.** It sets `autoIncrement: true` and no
`android.buildType`, which takes EAS's Android default — `app-bundle`. **There is no Play blocker
here and there never was.** ⚠ The error came from grepping `eas.json` for `buildType|apk|aab` and
never reading it: the production profile contains none of those words, so it did not appear.
CLAUDE.md's *"grep, do not read"* saves money; this is the shape of what it costs.

#### The actual finding, which is worth more than the benchmark

**The only Proa build on the P30 is a dev-client build that cannot run the app without a Metro
server.** There is no bundle cached in the launcher and `npx expo start` is not running, so the app
is currently unreachable on that phone.

It follows that:

- **Every impression anyone has of how Proa performs on real hardware is of a debug build** running
  a development bundle — unminified JS, dev-mode checks, the dev client's own overhead. Comparing
  that to a Play release of a native Jetpack Compose app is not a fair fight, and *"WalkNYC runs
  smoother"* is very likely measuring that and not the product.
- **T-051's soak is running the same dev build.** Its result is still meaningful for OEM killing —
  EMUI does not care why a process exists — but it is not a soak of what users would install.
- ⚠ **The recorder was killed by this measurement** and cannot be restarted without Metro, because
  force-stopping the app dropped the in-memory bundle it had been running since earlier that day.
  The soak was already invalid (the probe's own line: *"PLUGGED IN — Doze will never engage, this
  soak proves nothing"*, and the clock was never started), but the recorder is down until somebody
  runs `npx expo start` and reconnects the phone.

#### What would make the question answerable

Build the **`preview`** profile — `distribution: internal`, `buildType: apk`, **no**
`developmentClient` — and install that. It is a release build: minified, bundled, no dev client, no
Metro needed. Then the same workload against WalkNYC means something, **and so does the soak.**

⚠ **Until that exists, the honest answer to "is theirs smoother?" is "nobody knows, and the app on
the phone is not the app".**

#### One structural thing no build will change

WalkNYC is native Android — Jetpack Compose, `androidx.work`, Health Connect client, targetSdk 36.
Proa is React Native under Expo. ⚠ *Inferred* from the accessibility tree's shape and the
`androidx.*` components, not from decompilation. Not reversible inside v1 and not proposed as one;
recorded so that a release-build measurement is read against the right baseline.

---

### 13. Their settings screen, next to ours — **idea**

The project lead likes theirs. Side by side:

| WalkNYC | Proa |
|---|---|
| Profile · Goal · Import · **Passive Capture** · Data · Simulation · **Danger Zone** · **Contact** | Recording · If recording keeps stopping · Background tracking · Appearance · How closely · Map · About · Help improve the app · Erase |

**Three things theirs does that ours does not.**

- ⚠ **A human at the bottom.** *"Contact · Email me · Made by Joe Puccio · joepucc.io · Privacy
  Policy."* A named person and a way to reach them. **Proa has no contact string at all** — grep
  `strings.ts` for "contact" or "email" and there is nothing. For a paid app from an unknown solo
  developer (D-072), a name and an address at the bottom of settings is cheap trust, and Play wants
  a support contact on the listing regardless.
- **"Danger Zone"** as the section name, rather than the neutral *"Erase"*. It signals before the
  user reads the row. ⚠ Ours has the stronger confirmation flow behind it, so this is a label
  question, not a safety one.
- **Backup Data / Restore Data** — an explicit, user-controlled export to a file, separate from
  the OS backup. Relevant to item 1: their privacy paragraph can honestly say *"you can also back
  up your data to a file"* precisely because they built it.

**One thing ours does better, worth not losing.** Every Proa section carries a footnote explaining
what the control does *and what it costs* — `settings.background.off`, `settings.quality.footnote`,
`settings.map.footnote`. WalkNYC does this in some sections and not others. Ours is more consistent.

**The honest read of "I like theirs".** Their section names are mostly **nouns the user came for**
(Profile, Goal, Import, Data), where several of ours name **mechanisms** (*"How closely"*,
*"Background tracking"*, *"If recording keeps stopping"*). That is the difference worth chasing, and
it is a copy change rather than a rebuild.

---

## Not worth taking

- **Six system dialogs in one minute.** Four of the six are OS dialogs, which the app cannot style,
  cannot re-ask, and gets one word back from. Proa fires one on first run and defers the background
  ask by twelve hours (D-008, D-081).
- ~~**The banner stack.**~~ **WITHDRAWN 2026-09-22 — I was wrong, see item 11.**
- **The inline "allow all the time" option.** An Android 10 artefact. It does not exist on the
  phones we ship to.
- **Their monetisation.** Already settled in `competitors.md`: no accounts, no purchases, so nothing
  to copy and D-072 stands alone.

---

## What has not been looked at

- The **live recording UI** — deliberately skipped, because starting a walk writes data to the
  project lead's own app. The simulation was used instead.
- **Import (Strava / Apple Health / Google Timeline)** — an OAuth flow into the project lead's
  accounts. Not touched.
- The **leaderboard** and anything else that talks to their server.
- **Behaviour with real data in it.** The install is fresh.
- ⚠ **Proa driven the same way, for a fair frame-rate comparison** (item 12). Foregrounding Proa
  resets the OEM timers T-051 is baselined on, so it waits for the project lead.

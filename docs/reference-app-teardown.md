# The reference app, taken apart — 2026-09-22

**What this is.** A working list of everything worth improving in Proa that came out of looking at
**WalkNYC 1.1.6** (`com.walknyc.app`, versionCode 9, targetSdk 36) on the project lead's **Huawei
P30 (ELE-L29, Android 10)**, over adb, on 2026-09-22. It is **findings, not decisions** — nothing
here is a `D-0xx` and nothing here has been agreed.

`docs/competitors.md` stays the place for what the two products *are*. This file is only the
teardown: what they do on a phone, and what it says about ours.

**How it was gathered.** `dumpsys package`, `dumpsys notification`, `dumpsys deviceidle whitelist`
and `uiautomator dump` — no screenshots, no APK decompilation. Read-only: nothing was granted,
revoked, sent or purchased, and the phone was left on the screen it started on. The one interactive
thing done was **Run Simulation**, which the app's own copy says does not affect walk data.

⚠ **Two limits on everything below.** It is **one handset on Android 10**, so some of what the
permission flow does there (an inline *"allow all the time"* option) does not exist on Android 11+.
And the install is fresh — **0 of 86 638 blocks** — so nothing here is about how the app behaves
with a year of data in it.

---

## Ranked

Each item says what WalkNYC does, what Proa does today, and what it would take. Grade is
**defect** (we are wrong), **idea** (they are better), or **evidence** (settles an open question).

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

Settings → **Run Simulation**: *"Replay a walk on the map. Your walk data will not be affected."*
Watched running — the map animates, a **`SIMULATION MODE`** badge sits over the chrome, a **`80×`**
speed control is exposed, the replayed walk's own clock is drawn on the map, and the block counter
climbs live (0 → 4 blocks). Stopping it left the counter back at 0, so the promise holds.

**Ours:** replay exists for development (the browser workbench, D-038; replayed routes on the
emulator) and is not in the app.

**Why this is not just a nice-to-have.** HANDOFF blocker 2 is *"nobody has completed a single trip
with this app"*, and it names the consequence: **the store screenshots are a replayed route**. A
user-facing simulation is how the reference app gets a populated map to photograph without walking
anywhere — and it would let the project lead demo the whole chain on the sofa. ⚠ It is also
squarely the kind of thing D-032 deletes, so this is a *cost* to weigh, not a recommendation.

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

## Not worth taking

- **Six system dialogs in one minute.** Four of the six are OS dialogs, which the app cannot style,
  cannot re-ask, and gets one word back from. Proa fires one on first run and defers the background
  ask by twelve hours (D-008, D-081).
- **The banner stack.** The promo banner and the permission warning are *both* over the map at all
  times — including during a permission dialog, and including during **Simulation Mode**. Design
  brief §3 already names this and T-144's note records it as the thing our map screen watches for.
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

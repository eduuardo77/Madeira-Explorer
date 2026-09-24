# Proa — Second Review, against WalkNYC

**Date:** 2026-09-24, 21:00–21:15
**Build reviewed:** `com.proa.madeira` 0.1.0 **beta** release (unlocked, D-084), installed
2026-09-24 20:52, source ≈ `b5c9446`. Not debuggable, so performance readings are valid.
**Benchmark:** WalkNYC 1.1.6 (`com.walknyc.app`), Play release, on the **same phone**, same
session, same workload.
**Device:** Huawei P30 (ELE-L29), Android 10, EMUI, `pt-PT`, Wi-Fi, no SIM.
**Previous review:** [`app-review-2026-09-22.md`](app-review-2026-09-22.md), 7/20.
**No app code or app data was changed.** The Privacy, Licences and Settings screens were
opened; nothing was pressed that records, erases, ends a trip or starts a walk, in either app.

---

## Verdict

| Rubric | Proa | WalkNYC |
|---|---:|---:|
| **Original rubric** (09-22 method and weights, for continuity, T-208) | **8 / 20** (was 7) | — |
| **Strict rubric: "better than WalkNYC"** (this review, §3) | **6.7 / 20** | **≈ 14 / 20** (indicative) |

**Not publishable. Still not an MVP.** Two days of work closed most of the first review's
embarrassing items: the debug screen, the English leaks, the zero-stamp share, the permission
texts, the recording confusion and a Settings crash. What it did not move is the thing that makes an
app an app: **no stamp has ever been earned on a real phone, no trip has been completed, and
nobody has seen the replay move.**

Against WalkNYC, Proa is **already better at five things**: launch speed, download size, language,
privacy and honouring Google's attribution. It is **clearly worse at four**: showing progress on the
home screen, depth (history, stats, replay), visual consistency, and being a finished product
in a store. **To beat WalkNYC, Proa does not need more features first. It needs proof, a home
screen that shows your progress the way WalkNYC's does, and a design pass done by a person who
judges with their eyes.**

---

## 1. Method

The same method as the first review (§2 there), with three changes for a stricter bar.

1. **WalkNYC was measured side by side:** same phone, same pan-and-zoom workload, one app right
   after the other.
2. **Accessibility was read from the source,** not only from the UI tree: `uiautomator` cannot
   see `hitSlop`, so every small target was checked in code before being reported.
3. **Everything shown in the first review as "fixed" was checked again on the device**, not
   taken from `TASKS.md`.

**Not done:** onboarding on the device (it would wipe the P30's field data), the dark map, German on
screen, TalkBack read-through, font scaling, a low-end phone, and anything outdoors. The P30 was
**not** force-stopped in a loop (HANDOFF trap): one force-stop, and the recorder restarted by
itself within 12 s (T-212 holds).

**⚠ A mistake of mine, recorded:** two presses of *Back* left Proa and landed in WalkNYC, where a
swipe panned its map and a tap opened its Settings. Nothing was changed there. The side-by-side
numbers below were taken afterwards, with the app in front confirmed.

---

## 2. What changed since 2026-09-22 — verified on the phone

| 09-22 finding | Now | Seen |
|---|---|---|
| P0-1 Expo template icon | ❌ **Still there**, as the launcher icon and as the recording notification's status-bar icon. T-188 waits on the trademark search (T-187) | status bar, every screenshot |
| P0-2 debug screen in release | ✅ Gone. *Sobre* shows Privacy, Licences, Version | UI tree |
| P0-3 lock with no payment | ✅ Correctly parked: beta builds unlock; store builds still lock. Billing waits on the D-089 study | Settings *0.1.0 (beta)* |
| P0-4 core loop unproven | ❌ **Unchanged.** Trip end is now built (D-088), but no stamp, no trip, no replay on real hardware | field notes, TASKS |
| P0-5 blank map ~20% | ⚠ Fix built (maps-compose 6.12.1), **unproven**: cannot be induced on the P30 | 3 launches, all with a map |
| P0-6 store paperwork | ⚠ Data Safety redone (waits on 3 calls). URL, contact, key, trademark, T-123 and listing all open | TASKS |
| P0-7 absolute privacy claims | ✅ Mostly. `app.json` fixed. ⚠ The in-app policy still says *"Fica tudo no telemóvel"*, see N6 | Privacy screen |
| P1-1 home hides the 80 places | ❌ **Regressed by choice**: the rings were added, then removed (D-085). At 0 stamps the home is Google's map, a stamp and a button | screenshot r3-01 |
| P1-2 recording contradicts itself | ✅ **Fixed.** *Começar passeio* now starts an outing that changes the recorder (D-087). *Registo automático* lives in Settings | UI tree + `dumpsys` |
| P1-3 onboarding sells a tracker | ✅ In the copy: *"Welcome to Proa"*, the passport named. Not seen on the device | `strings.ts` |
| P1-4 place card thin and English | ⚠ Portuguese now (*MIRADOURO*, *A 13 km, em linha reta*). Still no reason to go (T-201 waits on the veto), no photo, no directions | screenshot r3-03 |
| P1-5 share at 0/80, English, file name | ✅ Share disabled until the first stamp; file name and language fixed | UI tree |
| P1-6 Settings reads like notes | ✅ Largely. Version, language and licences added; copy halved | UI tree |
| P2-1…P2-4 language errors, a11y labels | ✅ *Ver as 19 aldeias*, *Boas-vindas*, *lugares visitados*; a11y labels in Portuguese | UI tree |
| P2-5/P2-6 passport look | ✅ One dark album; unvisited stamps keep a muted colour of their own. A real improvement | screenshot r3-02 |
| P2-9 memory after sharing | ⚠ Not re-measured: sharing needs a stamp | — |
| (new) T-209 Settings crashed on Privacy/Erase/Licences | ✅ Fixed; opened here without a crash | device |
| (new) T-210/T-212 recorder stayed dead after an update | ✅ Fixed; after a force-stop the service was back in 12 s | `dumpsys activity services` |

**Improvements confirmed on the phone: 12. Still open or unproven: 6.** That is fast, honest work.
**⚠ And T-209 is a warning:** Settings crashed on three buttons **for five weeks** and no test
saw it. See N11.

---

## 3. The strict rubric

The first rubric gave engineering a 10% share. A user never sees a test suite, so this one grades
**only what a user or a store reviewer can meet**. The anchors are set so that **WalkNYC is the
"good shipped app" line**:

| Score | Meaning |
|---|---|
| 18–20 | Best in class: design-award level, nothing to forgive |
| 14–17 | **A polished shipped app: the WalkNYC line** |
| 10–13 | A shippable beta: works, with flaws users notice |
| 5–9 | A prototype: parts work, the whole is not proven |
| 0–4 | Missing or unproven |

| Area | Weight | Proa | WalkNYC |
|---|---:|---:|---:|
| A. Core promise proven in the field | 20% | **4** | 16 |
| B. First run and home: do I get it in 10 s? | 15% | **7** | 13 |
| C. Craft: visual consistency, brand, detail | 15% | **6** | 13 |
| D. Reliability and performance | 15% | **10** | 16 |
| E. Store, legal and privacy readiness | 10% | **5** | 15 |
| F. Accessibility and localisation | 10% | **11** | 9 |
| G. Depth: history, stats, content | 10% | **7** | 14 |
| H. Business model working | 5% | **3** | n/a |
| **Weighted** | | **6.7** | **≈ 14.0** |

Proa's working: 0.8 + 1.05 + 0.9 + 1.5 + 0.5 + 1.1 + 0.7 + 0.15 = **6.70**.
WalkNYC's is computed without H (it takes no money by design) and rescaled over 95%:
13.3 / 0.95 = **14.0**.

⚠ **WalkNYC's score is indicative.** It comes from a fresh install on one phone (`0 / 86 638
blocks`), the teardown in `docs/reference-app-teardown.md` and its store presence. Its GPS
accuracy and battery are no better known to this review than Proa's. It scores 16 on A only
because it is live and used; nothing here measured it walking.

### Why each Proa score

**A — 4.** The recorder is now robust: it restarts after a force-stop or an update, and trips end
three ways. But the promise is *a stamp, and a souvenir at the end*, and **neither has happened
on a real phone.** The replay is only offered after the first stamp (`PassportView.tsx:463`), so it
has never been seen moving either.

**B — 7.** The recording model is now clear, and the onboarding copy sells the passport. But the
home screen at 0 stamps (r3-01) is a zoomed-out Google map of the island with the ocean filling
about 60% of the screen, a stamp, a *Centrar* pill and *Começar passeio*. **Nothing says what
there is to collect, or how far along you are.** D-085's reasoning was *"stay as quiet as
WalkNYC's"*, but **WalkNYC's home is not silent**: it carries a permanent progress bar,
*"0 / 86 638 blocks · 0,0%"* (r3-w01). Its quietness is *no pins*, not *no progress*.

**C — 6.**
- The template icon (P0-1).
- **Four control languages on one screen:** a white circle (settings), a tilted paper stamp
  (passport), a white pill (*Centrar*), a green bar (start). WalkNYC uses one: green circles and a
  green bar.
- A **light** place-card sheet over the **dark** passport album (r3-03).
- *⚠ Apagar tudo* uses an emoji for its danger signal instead of destructive styling.
- *Terminar viagem* is a full-width button at the foot of the passport, the same weight as a
  primary action, for something done once per holiday.
- Passport rows show exactly three stamps and **nothing of the fourth**, so nothing hints that a
  row scrolls sideways (r3-02).
- In its favour: the stamp art is the best thing in the app, and the dark album is a real step up.

**D — 10.**
- Cold start: 166–255 ms (WalkNYC: 760–813 ms cold in the teardown). Proa wins.
- Same workload: **0.72% janky frames, p90 11 ms, p99 15 ms, 322 MB**. WalkNYC: **0.00%, p90
  6 ms, p99 8 ms, 208 MB**. Both are smooth; WalkNYC's interface thread does half the work, and
  Proa holds 1.5× the memory. That matters on a 3 GB phone, where memory pressure kills the
  recorder along with the app.
- Against: T-177's fix is unproven; a Settings crash shipped in every build for five weeks
  (T-209); the recorder stayed dead after an update until today (T-210/T-212).

**E — 5.** Solved since the last review: honest permission texts, 12 permissions, no push SDK,
Data Safety redone, a licences screen. Still open:
- the policy has **no named controller and no contact**, because `CONTACT_EMAIL` is `null`
  (`legal/privacyPolicy.ts:96`), and GDPR Art. 13 requires both;
- no hosted policy URL;
- no upload key;
- no trademark search;
- no background-location review (T-123);
- no store listing assets.

**F — 11.** Three languages with real Portuguese and a language picker. WalkNYC shows English on a
Portuguese phone. But, all from source:
- **The language rows are 32 dp tall with no `hitSlop`** (`styles.row`, `minHeight: spacing.xl`,
  `SettingsView.tsx:538`). Android's floor is 48 dp, and `accessibility.test.ts` did not catch it.
- **The radio rows report `selected`, not `checked`** (`SettingsView.tsx:535`), so TalkBack says
  nothing about which language is chosen.
- **The quality chip reads *Preciso* on screen and *Máximo detalhe* to TalkBack**: the spoken name
  does not contain the visible one (WCAG 2.5.3).
- The German translation has still not been read by a native speaker (T-160a).

**G — 7.** 80 curated places are a genuine asset: WalkNYC's 86 638 blocks are a grind, Proa's 80 are
reasons to go somewhere. But:
- **there is no trip history at all**, and WalkNYC has *Show Walks*, a replay of each walk;
- the replay hides until the first stamp;
- there are no stats;
- the place card has no stamp art (you tap a stamp and the card that opens does not show it), no
  "why go", no photo and no directions;
- there is no import (T-164).

**H — 3.** The beta unlocks correctly, and the monetisation study (D-089) is well framed with a desk
answer. There is still no way to pay, and the shape of the free tier is open.

---

## 4. New findings this round

Ordered by severity. **N** = new since the first review.

| # | Finding | Evidence | Severity |
|---|---|---|---|
| N1 | Home at 0 stamps shows **no progress and no targets** again. WalkNYC's home has a progress bar | r3-01 vs r3-w01; D-085 rings removed 2026-09-24 | **P1** |
| N2 | **No trip history**; the replay only after the first stamp. A user who walked all day with no stamp cannot watch their day | `PassportView.tsx:463` | **P1** |
| N3 | Place card: no stamp art, no why-go (T-201), no photo, no "get there" hand-off to a navigation app; light sheet on a dark album | r3-03 | **P1** |
| N4 | Language rows 32 dp without `hitSlop`; radio `selected` not `checked`; *Preciso* vs *Máximo detalhe* | `SettingsView.tsx:532-541`, strings 744/760 | **P1** (a11y) |
| N5 | Licences list 119 JS packages **including build tools** (`@babel/core`); **no native Android libraries** (androidx, Kotlin, OkHttp, maps-compose 6.12.1: all open source, Apache 2.0); 6 entries without licence text | `legal/licences.json` | P2 |
| N6 | Privacy policy: no controller or contact; *"Fica tudo no telemóvel"* sits beside the backup caveat; *"A Google… não vê a sua viagem"* while fixes come from **Google Play services' fused provider** (`dumpsys location` shows `com.google.android.gms` requesting on Proa's behalf) | Privacy screen; `dumpsys location` | **P1** (legal) |
| N7 | Four control styles on the home screen; *⚠* emoji as the danger signal; *Terminar viagem* at primary weight | r3-01, UI tree | P2 |
| N8 | Home camera frames the whole island in about 40% of the screen; the map can be panned into open ocean with nothing to say where you are (r3-07) | screenshots | P2 |
| N9 | 322 MB against WalkNYC's 208 MB on the same workload; p90 frame 11 ms against 6 ms | `gfxinfo`, `meminfo` | P2 |
| N10 | Passport rows give no hint they scroll: the fourth stamp is fully off-screen | r3-02 | P2 |
| N11 | **Process:** a crash on three Settings buttons survived 5 weeks of builds. Nothing taps every screen of a release build before it goes on a phone | T-209 | **P1** (process) |
| N12 | *"Estes são os lugares. Vá a um e ele preenche-se sozinho."* In Portuguese the *ele* reads as the place filling itself | passport | P3 |

### Where Proa already beats WalkNYC

| | Proa | WalkNYC |
|---|---|---|
| Launch | 166–255 ms | 760–813 ms cold (teardown) |
| Download | 38.3 MB, one universal APK | 56.4 MB, a device-specific split |
| Language | PT/EN/DE, in-app picker | English on a Portuguese phone |
| Google attribution | Always visible | **Partly covered by *Start Walk*** (r3-w01); Google's attribution rules require the logo to stay unobscured |
| Privacy | No account, no server | Leaderboard, profile, server |
| Nagging | One quiet notice when something is wrong | A permanent yellow banner until dismissed |
| Meaning | 80 places worth a trip | 86 638 blocks to paint |

**This is the pitch.** Proa can be *the WalkNYC of an island, without the account, faster, in your
language*. Right now it is not yet *finished*, which is the one thing WalkNYC is.

---

## 5. MVP and publishing

**MVP: no.** Unchanged, and for the same reason. The value is *go somewhere → stamp → souvenir*,
and none of it has happened on a real phone. T-205, one real trip, is the gate, and it needs the
project lead outdoors, not more code.

**Publishable: no.** Beyond the MVP gate: the icon, a privacy policy that names someone, a
hosted URL, the upload key, the background-location review, billing (or a store build without
the lock), and a listing.

**Distance.** On the original rubric, 7 → 8 in two days, almost all of it from closing
desk-fixable items. **The rest of the distance is not desk-fixable:** a real trip, a designer's eye
and the project lead's store paperwork. That is the honest reason the score is moving slowly now.

---

## 6. To beat WalkNYC — in order

| # | Do | Moves | Who |
|---|---|---|---|
| 1 | **One real trip** (T-205): earn a stamp, end the trip, watch the replay, share | A, G | Project lead, outdoors |
| 2 | **Put progress on the home screen**, as WalkNYC does: *3 / 80* and the next place, not pins | B | Decision + small code |
| 3 | **An on-device smoke test** of every screen on each release build: Maestro, or a Firebase Robo run with a script | D, N11 | Assistant |
| 4 | **Trip history + replay without a stamp:** every trip listed, each one watchable | G, N2 | Code |
| 5 | **The icon and one control language** (T-188, T-203) | C | Trademark search first |
| 6 | **Place card:** stamp art, why-go (T-201 veto), a "get there" button to Google Maps | G, N3 | Veto + code |
| 7 | **Privacy policy with a controller and contact**; remove "fica tudo"; reword the Google sentence | E, N6 | Project lead + copy |
| 8 | **A11y sweep:** 48 dp everywhere, `checked`, label-in-name; extend `accessibility.test.ts` so it checks them | F, N4 | Code |
| 9 | **Licences:** production-only, with the native libraries (Google's `oss-licenses` plugin or a Gradle report) | E, N5 | Code |
| 10 | Memory: find why Proa holds 1.5× WalkNYC (T-197) | D, N9 | Code |

Items 2 to 10 are all within reach in a week. **Item 1 decides whether the rest matters.**

---

## 7. Appendix — raw evidence

### Launch

```
Proa   09-24 15:44  TotalTime 255 / 250 / 166 ms (three force-stop launches)
Proa   09-24 21:04  LaunchState WARM  TotalTime 169 ms  (process pre-started by the recorder's broadcast)
WalkNYC 09-22       760 / 813 ms cold (reference-app-teardown.md §12)
```

### Same workload (9 pans, 2 double-tap zooms), back to back, 21:09

```
Proa     frames 417  janky 3 (0.72%)  p50 6  p90 11  p99 15 ms  slow UI 1  deadline missed 2
         TOTAL PSS 321,781 KB  native 144,864  graphics 30,224
WalkNYC  frames 405  janky 0 (0.00%)  p50 5  p90 6   p99 8 ms   slow UI 0  deadline missed 0
         TOTAL PSS 207,752 KB  native 16,912   graphics 49,896
```

⚠ `gfxinfo` counts the app's own interface frames. The Google map draws on its own surface in
both apps, and its frame rate is not in these numbers.

### Package

```
Proa     base.apk 38,282,239 B · 12 requested permissions · pkgFlags without DEBUGGABLE · 0.1.0 (beta)
WalkNYC  56,437,157 B (split APK set)
```

### Recorder after one force-stop (21:04)

```
before: LocationTaskService isForeground=true
after 12 s: TaskJobService + LocationTaskService isForeground=true   (T-212 holds)
```

### Tests

```
npm test → 774 pass, 0 fail · tsc --noEmit → exit 0
```

### Screenshots (scratchpad, not committed)

`r3-01-map` home · `r3-w01-home` WalkNYC home · `r3-02-passport` · `r3-03-place` ·
`r3-04-settings` · `r3-05-privacy` · `r3-06-passport-bottom` · `r3-07-map-zoomed` (open ocean)

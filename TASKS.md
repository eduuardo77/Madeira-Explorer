# Tasks

Ordered implementation checklist with explicit dependencies.

**Document date:** 2026-08-06
**Last updated:** 2026-09-23 — **a release-readiness plan from the 2026-09-22 review (7/20) now
leads this file** (T-182–T-208), and T-122 is reopened.
**Previously 2026-08-17** — **the app is Proa (D-074)** and the UI speaks EN/PT/DE (T-160, T-160b). Also — **marketing planned (D-073): ASO on one free listing** (T-160–T-163), and ⚠ **D-071 partly reversed — stamps are a priority again** now D-072 makes them the revenue. Also — **OD-4 resolved (D-072): free on Play, 10 stamps + your first levada free, €4.99 unlocks the rest** (T-155–T-159). Also — the **Sensor Logger importer** (T-021), so a real walk becomes a
fixture and the app's own `cleanTrace` can be run against it; plus three checkboxes that were
stale — **T-107**, **T-108** and **T-130** all shipped on 2026-08-16 and were still unticked.
**Previously 2026-08-16** — a long session. **Content curated** (T-066a, 79 → 60 places, D-064);
**regions made real** (T-067, D-061/D-062) which found 46 places filed wrongly; **crediting
rewritten** — two detectors per stamp, coverage and time for levadas (T-068a, T-149, D-065/D-068),
the last from the first field walk (`docs/field-notes.md`); **the drawn trace cleaned** (T-150/T-151,
D-066/D-067); **the souvenir still shipped and verified on a device** (T-105d/T-107/T-108, D-063);
and **walk donation built** (D-069, answering OD-11). 500 tests.
**Last updated:** 2026-08-11 — T-105 split into **T-105a** (the souvenir *composition*, done,
D-042) and **T-105b** (the encoder, which needs a device); **T-117** the dependency network
audit done statically (`docs/dependency-audit.md`, D-043), adding **T-117b** for the on-device
half; **T-124** the privacy policy (D-044); **T-046** the battery exemption (D-045); **T-070**
the stamp artwork (D-046); **T-113**'s contrast half, which found three shipped failures;
**T-118** the Apple privacy manifest; **T-116**/**T-116a** the notification budget and the
island's name out of `app/`; **T-120**/**T-122** the store privacy answers; **T-113** closed by measuring every screen;
**T-139** the dark style tuned by contrast, and **T-140** wired to the map.
Previously 2026-08-10 — **v1 is
feature-complete in code.** That day closed T-034,
T-039/T-040 (D-033/D-034), T-049, T-056–T-059 (D-035/D-036), T-071–T-075, T-081, T-099–T-104
(D-039/D-040), T-114/T-121 and T-125/T-140/T-141, and added a web design workbench (D-038).
It also found that **erase-all had been silently broken since migration 2**.
Previously 2026-08-08 — v1 scope cut (D-032); tile schema (D-030); visual direction and
passport structure (D-026, D-027); activity gating (D-028); D-022 confirmed.

> **v1 = record → stamps by geofence → draw the trace → passport → souvenir.**
> Phases 1, 2, 3, 5, 6, 7. **Phase 4 is v2.** See D-032.
**Overall progress:** the whole v1 chain is written and **nothing has run on real hardware.**
What remains: T-105b (the souvenir *encoder* — its composition is now written), a short tail of
small items, verification that needs a device, and the curated content. See `HANDOFF.md`.

⚠ **Everything marked done below is verified by typecheck, bundle, 270 unit tests over the
pure logic, and — for the screens — measurement in a browser (D-038).** No fix has ever been
recorded, no permission dialog seen, no battery figure measured, and no map rendered on a GPU.
Real-device testing is mandatory for anything touching recording (CONTEXT §6.6) and is what
T-051–T-055 exist for.

Task IDs are stable — reference them in commits and never renumber. Dependencies are listed
as `⇠ T-xxx`. A task must not start until all its dependencies are done.

This list is kept current as work happens and as decisions change the plan — see the
maintenance protocol in [CONTEXT.md §9](CONTEXT.md). A decision that changes the architecture
almost always changes tasks and dependencies here too.

Legend: `[x]` done · `[ ]` not started · `[~]` in progress · `[!]` blocked

---

## Release readiness — the plan from the 2026-09-22 review ⚠ CURRENT PRIORITY

**Added 2026-09-23, approved by the project lead.** Source: `docs/app-review-2026-09-22.md` —
**7/20, not an MVP, not publishable.** Finding IDs (P0-1…P2-10) refer to that document. The
review was checked against source before this was written. Three of its claims were corrected:
**P2-4 was already fixed** by `e1d0b8c`, after the build it reviewed. **"Enviar um registo" is not
a debug export**: it is D-069's walk donation (T-130), a deliberate feature, and it is not gated
here. **"22% blank maps" is 2 launches of 9**, which has a 95% interval of about 6–55%. One bug it
missed is **T-195**.

**How every task below is done.** A task counts as done when it has: (a) the change, (b) a test
that fails if the change is reverted, (c) evidence on the P30 (`uiautomator dump`, `dumpsys` or
`sqlite3`) for anything a user can see, and (d) the docs updated in the same commit. The check
that would have caught a problem comes before its fix (T-190).

**Parked until Gate R1** (not cancelled): T-158 artwork (already deferred by the project lead),
T-164 import, T-105b video, T-168–T-170 trace work, and new content.

### Decisions only the project lead can make (tier 3)

Nothing that depends on one of these starts until it is made. Each becomes a D-entry once decided.

- [x] **T-182** ✅ **Decided 2026-09-23: A — D-084.** **Decide what the paywall does at launch** — P0-3. Three options: billing in
      public v1, or a v1 with no lock (then say how early users are grandfathered, since D-075
      never takes a visible stamp away), or dropping the lock idea. *Recommended: run the beta
      unlocked, and ship public v1 with T-156.*
      — ✅ **Applied 2026-09-24: the beta half was never built.** Every build locked stamp 11
      onward, testers' included. Now `EXPO_PUBLIC_PROA_BETA=1` at build time unlocks
      (`entitlement/betaBuild.ts`, read only in `entitlementStore.isUnlocked`), and Settings says
      *0.1.0 (beta)*. Verified in the bundles: beta and store differ by one opcode.
      `docs/dev-build.md` has the command and the re-bundle trap.
- [x] **T-183** ✅ **Decided 2026-09-23 — D-087, after WalkNYC's recorder: pause yes, a short summary when a walk stops.** **Decide what "recording" means** — P1-2. Today the home button says *Começar a
      registar* while background recording is already on. *Recommended: background recording is
      the product. The home control shows the real state, and "Start" appears only when
      background permission was refused (D-008).*
- [x] **T-184** ✅ **Decided 2026-09-23: A — D-085.** **Decide whether the home map shows places not yet collected** — P1-1. This
      revisits D-070 (Provisional). *Recommended: faint marks for all 80, with the nearest one to
      three called out.*
- [x] **T-185** ✅ **Decided 2026-09-24: both, D-088** (the button plus the three-day silence). ~~Still open 2026-09-23.~~ Fix T-195 first; it may shrink the question. **Decide how a trip ends when nobody flies home** — P1-7: residents, long stays,
      and a phone that is off on the flight. *Recommended: fix T-195 first, then add a manual
      "finish this trip".*
- [x] **T-186** ✅ **Decided 2026-09-23: B, in-house from the stamp art — D-086.** **Decide who draws the icon and brand mark** — P0-1. *Recommended: a paid
      designer. The project has nobody to judge artwork.*
- [x] **T-213** ✅ **Finished 2026-09-25: D-089 Accepted.** The project lead settled it in
      conversation: the map free and unlimited, **5 stamps + the first levada** free, **€5.99 once**
      for all of Madeira, **set medals** and a **founder stamp** (buyers in the first 3 months, by
      Google's purchase time) paid only, **tilt and shine** on every stamp, the video's limit in v1.1
      (medium mark + 2 s end card on free). Storyboard review (Q3) dropped. ✅ The app has the new
      allowance since T-232 (2026-09-26).
      → **The build: `docs/monetization-execution-plan.md` (2026-09-25).** Tasks **T-232 to T-239**
      and **T-156a to T-156e**, reserved there; each is added here when it starts. Its nine
      questions (OQ-1 to OQ-9) were **all answered 2026-09-25**: every recommendation accepted.
      *As opened:* **The monetisation study — D-089 (Provisional)** ⇠ nothing; ⚠ must finish before
      D-084's public release. Plan: `docs/monetization-study-plan.md`. The project lead's
      hypothesis, 2026-09-24: very few free stamps, the video free with a huge watermark, the map
      unlimited. Desk work first (Q1 itinerary model, Q4 watermark mock-ups, Q6 price, Q8 library
      check). The lead decides N, video path A/B and the price. **No `app/` change until D-089 is
      Accepted.**
      ⚠ **Desk half done 2026-09-24:** Q1's model (`tools/stamp-days.mjs`), Q4's mock-ups
      (`preview-film.mjs --watermarks`), Q6's price check and Q8's four checks are written into the
      plan. Waiting on the project lead: N (Q2), A/B (Q5), the price (Q6), people for Q3/Q4.
- [~] **T-214** **A quiet progress line on the home map (D-090)**, after the second review's N1.
      ✅ **Code 2026-09-24:** `progress/homeProgress.ts` (4 tests), the strip in `PrimaryOverlay`,
      `map.progress` in three languages, `mapChrome.muted`/`track` held by `contrast.test.ts`, and the
      camera padding grown by the strip's exported height. Measured in the workbench: 44 dp, 8 dp
      from the stamp row and from the walk button, and a fill of 5 px of 324 at 3/180.
      ⚠ **Not yet judged by eye on the phone.** Subtle enough? Readable on the light map outdoors?
- [ ] **T-187** **The project lead's own actions:** ✅ **domain bought 2026-09-25: `bruma.lol`**, for a
      WalkNYC-style page (walknyc.app) and to host the privacy policy (T-206); a domain to host the privacy policy, and
      `CONTACT_EMAIL` (D-044); the TMview/INPI search on ~~"Proa" (D-074)~~ **"Bruma" (D-092,
      2026-09-25)**, ⚠ **done 2026-09-25 and it failed**: a live app *Bruma: Fog of War City Map*
      and EUTM 006378988 BRUMA (details in D-092); Proa screened cleanest of the fallbacks. ✅ **Bruma kept anyway** (the app looks abandoned). **Left:** an
      attorney's view on EUTM 006378988 (recommended, not required). **Not registering Bruma** for now
      (project lead, 2026-09-25; revisit after launch, D-092); the upload key (T-117e). **Start them on day one**: each is small, but they
      take the longest to come back.
      ✅ **Satisfied 2026-09-25: the search is done and Bruma is kept (D-092).** It had to precede
      the first upload to Play Console, which makes the package name (`com.proa.madeira`, kept)
      permanent. Monetisation plan, Phase 0 step 0.0.
- [x] **T-240** **Rename Proa to Bruma in code and copy (D-092)**. ✅ **Code 2026-09-25:**
      `APP_NAME` is Bruma; `app.json`'s name and the six permission strings; the generated
      `android/.../strings.xml` `app_name` edited to match (the next prebuild writes the same);
      `docs/privacy-policy.md` regenerated; `brand.test.ts` now sweeps for *Proa* as well as
      *Madeira Explorer*, in `src/` and `app.json`. 796 tests pass, typecheck clean.
      **The package stays `com.proa.madeira`** (project lead): no Maps key change, no prebuild
      `--clean`, the P30's beta data kept. So do the slug, the scheme and every internal "proa"
      (`EXPO_PUBLIC_PROA_BETA`, `PROA_UPLOAD_*`, `proaFieldBuild`, the logcat tag): no user reads them.
      ⚠ **Not yet seen on the phone:** the name under the icon needs a new build.
      ✅ **Store copy 2026-09-26:** title, short description (chosen) and full description (approved
      as is "for now") in `docs/marketing-plan.md` §4. Portuguese (Portugal) and German listings translated 2026-09-26, Provisional (the German unreviewed:
      nobody on the project speaks it).

### ⚠⚠ Found 2026-09-26: the recorder stalls and says nothing

- [ ] **T-242** **Every background location and geofence delivery hangs, silently, after a
      relaunch in the same process.** Found when the project lead drove to Praia dos Reis Magos
      and back (16:00 to 18:05, *Começar* pressed) and the app recorded **nothing**: no fix, no
      geofence event, no stamp. **Not mobile data** (the phone has no SIM, but fused fixes were
      being produced indoors at the time of the check) and **not today's store build**: the
      last fix before today is **2026-09-25 14:31:02**, minutes after the beta build was installed,
      and nothing was written for 25 hours. A fresh process wrote 5 fixes today (15:43 to 15:46),
      then stalled the same way.
      **Evidence (P30, 18:19 to 18:34):** the foreground service alive 2 h 46 min, the OS's GPS
      request active for the app, `TaskService` logged **63 deliveries handed to JavaScript and 0
      `Finished task`**, 120 task jobs pending, no `batch` and no `error` row in
      `recording_event`, while UI writes (*outing started* 16:00, *ended* 18:05) succeeded. So the
      database works and the JS task handlers never complete. Process 4599 started 15:46:12 and
      logged "recording re-asserted on launch" 8 times: the app was reopened repeatedly within one
      process. On 2026-09-25 the stall also followed several relaunches and a burst of *recorder
      options re-applied in place*. The log saved: scratchpad `stall-2026-09-26/`.
      **Not yet known:** what the first stuck delivery waits on. Candidates: an event emitted to a
      JS listener that is gone (expo-task-manager drops those on purpose, `TaskManagerModule.kt`),
      or one queued job that never settles, leaving every later one behind it in
      `recordingQueue`. **Next:** reproduce with `adb logcat` running from process start, relaunch
      in the same process, find the first delivery with no `Finished task`.
      **Found reading, separate, latent:** `closeLapsedTrip` runs inside `recordingQueue` and calls
      `checkTripEnd`, which calls `truncateWal`, which waits on `recordingQueue`: a deadlock
      whenever a trip lapses inside a batch. `recordingSink.ts` says "cannot deadlock";
      `database.ts` says never call `truncateWal` from inside the queue. Not today's cause (no
      `trip_end` row), but it would stall the recorder the same way. Needs its own test.
      ⚠ **T-174's lesson again:** the app said it was recording the whole time.

### The monetisation build (`docs/monetization-execution-plan.md`, D-089, D-091)

Tasks T-232 to T-239 and T-156a to T-156e, added here as each starts. The plan's §1.3 is this
section's definition of done.

- [~] **T-232** **Free allowance 10 → 5, plus the first levada** (D-089 rules 2, 3; OQ-1).
      ✅ **Code 2026-09-26:** `FREE_STAMP_ALLOWANCE = 5`, at most 6 shown. Comments that stated ten,
      eleven or €4.99 corrected in `freeTier.ts`, `passportButton.ts`, `PassportView.tsx` and the
      workbench; the price now appears nowhere in `app/` (a Play Console setting). **OQ-1:** rank
      thresholds kept at 1/10/25/all; `stampTier.ts`'s silver reason rewritten (the rank counts what
      was collected, locked included, so it has no link to the allowance).
      **Tests (797):** 7 in `freeTier.test.ts` fail against 10 (checked before the change): the
      fifth shows and the sixth locks, a levada earned third leaves the sixth locked, never more than
      six, ties at the 5/6 boundary, the constant. *"A levada earned sixth is shown"* passes under
      both and is a spec, not a guard. `stampTier.test.ts` fails if silver and the allowance
      coincide (it did at 10). `tripProgress.ts` joins the modules forbidden to import
      `entitlement/`, because the rank reads its count and must keep counting locked stamps.
      **Workbench:** "23 stamps, free tier" shows 6 of 24 earned, 18 locked (was 11).
      **P30, partial:** a store field build (no beta flag) is installed and reads *Bruma · Versão
      0.1.0*, no "(beta)"; `smoke-release.mjs` passes every screen. ⚠ **The phone has 0 stamp
      awards on any trip**, so awards against shown stamps would read 0 against 0 under either
      allowance: the locking itself is **not yet seen on a device**. Needs 7+ awards on the P30
      (a drive past seven places, or the project lead's consent to a probe database: backed up,
      8 synthetic awards, restored), or an emulator replay.
- [~] **T-241** **bruma.lol, a WalkNYC-style page** (project lead, 2026-09-26). ✅ `site/`: `index.html`
      (name, promise, Play button marked *coming soon*, five screen slots, highlights, FAQ, about) and
      `privacy.html`, **generated** by `node tools/build-site.mjs` from `privacyPolicy.ts`, like
      `docs/privacy-policy.md`, so web and app cannot disagree. The script also fails on any dash in
      a page (probe checked). Preview: the `site` entry in `.claude/launch.json`. Claims checked
      against the policy: no battery number (D-041), no offline map claim (D-073).
      **Left:** real screenshots (the slots are placeholders; the P30's trace is the project lead's
      real movements, so ask before using it); a contact once `CONTACT_EMAIL` exists (T-206); the
      real icon (T-188); hosting and DNS for `bruma.lol`.

### The second review's findings, as tasks (`docs/app-review-2026-09-24.md`, 6.7/20)

**Added 2026-09-24, from the plan the project lead approved.** N-numbers are the review's. Their
answers: N1 is T-214; the trip history is the replay (N2), offered without a stamp; the place
card keeps *Show on map* and gets no hand-off (D-055 stands) and no photo; one control language
and a quieter *Terminar viagem*. Checked against source first: **two review claims are wrong.**
*Terminar viagem* was already tinted text, not a filled button (N7); and N4 was not one control
but eight (below). N9 is T-197's; N11 is T-222.

- [x] **T-215** **Accessibility from source (N4), and the rules that hold it.** The language rows
      were 32 dp against D-015's 60, not Android's 48 as the review had it; both radio groups
      reported `selected`, so TalkBack never said which was chosen. **Label in name failed in
      seven more places**, found by the new rule: every *Concluído* was spoken as *Voltar ao
      mapa* or *Voltar às definições*, *Ver a sua viagem* as *Reproduzir*, English *Re-center* as
      *Center the map*. The spoken name is now the visible word and the explanation is the hint.
      The notice banner's pressable body only reached its text height. **Found beside it:**
      `describePermission` returned the English *'Off'* on every phone (`settings.permission.denied`).
      *Apagar tudo* loses its ⚠ emoji (N7): the words and the red carry it.
      `accessibility.test.ts` gains three rules (checked, tap target from styles, label in name),
      each proved against the shape it was written for.
- [~] **T-216** **The privacy policy says only what is true (N6).** ✅ **Text 2026-09-24**, EN and PT,
      version `2026-09-24`, `docs/privacy-policy.md` regenerated. N6's three: "fica tudo" (twice)
      and "absolutamente nada" gone; Google "não vê a sua viagem" is now *the app never sends it*,
      and the policy names the phone's location service as Google's. Plus four stale claims the
      review missed: "two notifications, ever", "sharing is the one time your trip leaves" (the
      D-069 walk report can reach us, and now says so), a map "left out of the backup" that
      D-057 deleted, and a "video" that is not built. Each retired phrase fails
      `privacyPolicy.test.ts`. `marketing-plan.md` quoted the old wording and follows it.
      ⚠ **Open:** controller and contact wait on T-187; the Portuguese wants the project lead's
      eye (T-160b); the walk report may change the Data Safety answer (T-122's "shared or not").
- [~] **T-217** **The replay without a stamp (N2).** ✅ Code: *Watch* whenever the trip on show has
      a line's worth of fixes (`composition.mayHaveAFilm`, held to `composeSouvenir`); at zero the
      film ends on its dates, not "0 / 80". ⚠ Still nobody has seen the replay move (OD-12).
- [~] **T-218** **The place card shows the stamp (N3): option B, white (2026-09-25).** The project
      lead chose B from `tools/out/screen-options.html`: *"I want the user to look closer to the
      stamp."* White, the stamp beside the name, a status line (*Ainda por visitar* / *Visitou a
      20 de setembro*), the why-go line when T-201 fills it. The dark album card built first was
      removed with its palette prop. Dates follow the app's language (`DATE_LOCALES`).
- [~] **T-219** **A passport row shows part of the next stamp (N10).** On a 360 dp phone the
      fourth sticker began exactly at the card's edge. ✅ `passport/stripLayout.ts`: 96 where the
      cut reads, 84 on the P30, measured from the strip itself. Workbench: 44% of the fourth.
- [ ] **T-220** **One control language on the map (N7)** ⇠ judged by eye. Design first.
      2026-09-25: three options drawn for the project lead in `tools/out/screen-options.html`
      (`node tools/preview-screen-options.mjs`): today, all in the brand green, or one white
      panel at the bottom. The same page asks about the place card and the passport's top, which
      the project lead also found wanting on the P30.
      ✅ **Decided 2026-09-25: A, today's controls.** The progress line stays between the stamp row
      and *Começar passeio* (my mock drew it above; the app already had it there), and is made
      quieter like WalkNYC's: flat `#EEEFF2` panel sampled from WalkNYC, no shadow, grey fill
      (D-090 amended). The passport's top: **A, unchanged**; the project lead liked B's category
      counts but not its *Ver a sua viagem* button. Card: B (T-218).
- [x] **T-231** **The pause removed; one tier explained at a time; a tidier tier control** (2026-09-25,
      the project lead). The pause went everywhere it lived (Settings, the map notice, the sink's
      filter, `trackingSettings`, its tests): the switch already stops recording (D-087 §6
      reversed). Under the tiers, only the chosen one's line, changing as another is tapped. The
      control is now a grey track with the chosen tier as a raised white chip, 54 dp drawn and 60 dp
      to tap. Found on the way: the P30's tier read *Poupança* at 14:27 though it was *Preciso* at
      11:36, cause unproven; the test scripts' swipes passed over those buttons, so they now run
      down the page margin, and the tier was left for the project lead to set. The recorder's
      diary said "tier changed" on a language change; it now says what happened.
- [x] **T-230** **Each recording tier explained; the passport's invitation removed** (2026-09-25,
      the project lead). Under *Registo automático*: what it is for, then one line per tier with
      its name in bold, as WalkNYC names its tiers (*"if not you don't know the difference"*);
      *Equilibrado*'s line now says what it does. The invitation (*"Estes são os lugares..."*) is
      gone: the project lead could not find it and, found, saw no purpose in it.
- [ ] **T-229** **Still indoors, GPS drift is drawn as short spikes** (found 2026-09-25 from the
      P30's own data, `docs/field-notes.md`). Trip #30 drew 3 lines whose points reached 109 m from a
      phone that never moved: the project lead's *"random blue lines, not on the street"*. They drift
      out slowly, so `rejectSpikes`' 2.5 m/s test passes them. Candidate: while stationary (the
      collapse's own test), drop an excursion that leaves and returns within minutes without
      crossing a walking pace. ⚠ Test it on a synthetic fixture shaped like these, never on the
      real data (D-016), and check it does not eat a real short walk. Affects drawing, not stamps.
- [x] **T-228** **Settings after WalkNYC, looked at on the P30; privacy summary first; Centrar lower**
      (2026-09-25). The project lead: T-227's list of modes was *"too simple, only text; bring back
      the toggle"*, and look at WalkNYC on the phone. Looked (screenshots only): its *Passive
      Capture* is a toggle with a blue pin and a three-way control under it, one explanation below;
      each row starts with a small coloured glyph; actions are blue words; headings are in sentence
      case; a line at the foot names the maker. Settings now does that (`SettingsIcon`,
      `ListRow` tones link/action/danger, `ToggleRow`, outlined `Segmented`), keeping the language
      list at the top and location access shown only when it needs fixing. The policy screen opens
      on five summary points, each a promise the policy makes, then the full text as sections that
      open on a tap; `BackBar` (*‹ Definições*) replaces the *Concluído* bars. *Centrar* sits lower
      in the stamp's row. Found on the way: i18n.test's banned claims stopped a summary line saying
      the trip "leaves your phone only when you share it" (the backup is another way); a long value
      squeezed "Idioma" to a letter a line; the smoke test tapped off-screen rows at [0,0]. All
      fixed; smoke test passing on the P30.
- [x] **T-227** **Automatic recording as one list of modes, after WalkNYC; the progress line names a
      municipality; a quieter Centrar** (2026-09-25, the project lead's picks from
      `tools/out/screen-options-2.html` and their note that location settings still confused).
      Settings: a location row, a switch and a three-way control that appeared under it became one
      row, *Registo automático · Preciso ›*, opening *Desligado · Poupança · Equilibrado · Preciso*,
      each in one line (WalkNYC's *Passive Capture* is one list too). Location access shows only when
      it needs fixing, in the page and at the top of the list; the tiers are disabled, not hidden,
      until then. `LanguageSheet` became `ChoiceSheet`, used by both. Progress line **B**:
      `homeProgress` counts the municipality started and closest to finished (`suggestNextRegion`,
      D-027's never-shown "where next"), falls back to the island with no stamp or no name.
      Centrar **B, blue words**: flat in the line's grey, 32 dp seen, 60 dp to tap, contrast held.
      Seen on the P30; smoke test passing.
- [x] **T-226** **Settings, compact, and no jump when choosing a language** (2026-09-25, the project
      lead on the P30: *"whenever you click language the page goes up and down"*, *"the settings take
      too much space"*). Measured first: after a tap on a language the IDIOMA heading left the screen
      for over a second, because every paragraph above it re-wrote itself in the new language. Now
      language is the first row and opens a list (`LanguageSheet`); measured again, the row stays at
      y=436 throughout. Every control is a plain `ListRow`; location status and its button are one
      row (*Acesso à localização · Sempre*); the battery row joined the group, titled *Registo
      automático* per D-087 §1; the Done bar became *‹ Mapa* at the top, as on the passport; one
      short note per group. The first screenful holds six controls, where it held two. 16 unused
      strings removed. Seen on the P30, smoke test passing. ⚠ **Rows stay 60 dp (D-015)**: the
      project lead finds them tall, and that is their call on D-015, asked, not taken.
- [x] **T-225** **The place card shows a distance only when it is near** (≤ 2 km, `placeCard.ts`
      rule 3). The project lead on the P30: *"A 39 km em linha reta" is a bit useless, Madeira is
      full of turns.* The 2 km is a judgement, not a measurement, and rule 2's qualifier stays.
- [~] **T-221** **Licences: what ships, JavaScript and native (N5).** ✅ Code 2026-09-25. Worse than
      the review said in both directions: of 119 listed, **77 never ship** (`@babel/core`,
      `typescript`, `react-dom`), and **15 that ship were missing** (`@babel/runtime`, `scheduler`,
      `promise`). Now `tools/build-licences.mjs` reads the release bundle's source map and, through
      `tools/gradle/licences.init.gradle` (passed on the command line, the app's build unchanged),
      each Android module's own POM: **286 packages, 37 JavaScript, 244 Android, 5 both**, every
      licence named by its POM, none guessed (only 34 of 237 POMs were in the local cache, so a
      rule table was rejected). One shared copy of the Apache text. `licences.test.ts` holds the
      lock-file hash, no build-only package, the Android half present. ⚠ Not yet seen on the phone.
- [~] **T-222** **Every screen of a release build opened before it reaches a phone (N11).**
      ✅ Written 2026-09-25: `node tools/smoke-release.mjs` taps through map, Settings, Privacy,
      Licences, passport, a stamp's card and the replay, with the app's own labels in the phone's
      language, and fails on a crash, a restarted process or a screen that never appears. Never
      presses anything that changes data. Reads the language radios' `checked` (T-215's evidence).
      Pure half `tools/lib/uiTree.mjs`, 4 tests (`node --test tools/lib/uiTree.test.mjs`), one of
      which caught its own first crash reader blaming this app for another's crash.
      ✅ **Run on the P30 2026-09-25: passes** (see the evidence note above Stage 1).
- [~] **T-223** **The home map cannot be lost in the ocean (N8).** ⚠ **`expo-maps` cannot fence
      the camera**: `latLngBoundsForCameraTarget` is commented out in its `Records.kt`, and its
      minimum zoom defaults to 3, half the planet. ✅ Code (`map/mapFence.ts`, 4 tests): a zoom
      floor at the archipelago plus half a level, and *Centrar* offered whenever the map's centre
      leaves the archipelago, going to the islands when the user is not on them. Nothing snaps
      back on its own. ⚠ The review's other half, the island in 40% of the screen, is geometry:
      the island is 0.63° wide and 0.29° tall, and `fitBounds` already fills the width.
- [x] **T-224** **N12:** *"Vá a um e ele preenche-se sozinho"* read as the place filling itself.
      Now *"Vá a um deles e o carimbo aparece sozinho"*, and the stamp in EN and DE too.

**✅ Seen on the P30, 2026-09-25 10:12 to 10:40** (beta release from `27d6a43` plus the fix below,
installed over the old one, data kept; recorder back in the foreground after the update):
`node tools/smoke-release.mjs` passes every step: map, Settings, Privacy, Licences, passport, a
stamp's card, back. From `uiautomator`: language rows and quality options **180 px = 60 dp**, both
report `checked` (T-215); passport cells **84 dp**, the fourth showing **36 dp of 84** at the edge
(T-219); the invitation reads *"Vá a um deles e o carimbo aparece sozinho"* (T-224); the card reads
*MIRADOURO / Pico do Areeiro / Ainda por visitar / Santana* with no distance (T-218, T-225); the
progress line sits between the stamp and *Começar passeio* (D-090).
⚠ **Found there, fixed the same hour (T-217):** *Ver a sua viagem* was offered at 0 stamps and
opened *"Ainda não há nada para ver"*. The offer counted fixes; the project lead's trip is mostly
at home, and D-040 masks where you sleep, so nothing drawable was left. The passport now asks
`getSouvenirComposition({ quiet: true })` after the page shows; on the P30 it is correctly not
offered (checked again after 6 s, so not a race). Not yet seen: a film actually moving (OD-12).
⚠ The smoke test's first two runs failed on the test, not the app (it counted the quality
options as language rows; it did not search plural labels). Fixed in the script.

### Stage 1 — Release hygiene (desk work, small items, done in parallel)

- [ ] **T-188** **A real launcher icon, adaptive icon, splash and notification icon** ⇠ T-186, T-187 (trademark search first) — D-086. A pure module plus a second renderer, like the stamps —
      P0-1. Replaces Expo's template. Verified by eye on the P30's home screen and status bar;
      one screenshot is justified here.
- [x] **T-189** ✅ **Seen on the P30 2026-09-23** (field build from `2ea386f`): Settings → *Sobre* shows
      only *Privacidade*. **`__DEV__` only, and the field build loses the screen too.** ⚠ **This reverses the note below, which I wrote the same day.** A
      flag inlined into the JS bundle is not a Gradle or Metro input, so a bundle built under one
      setting can be reused under the other. That is T-180's stale-bundle shape, and here it would
      put the debug route into a *store* build. Field work reads the phone through `dumpsys` and
      `sqlite3` anyway. Guarded by `ui/releaseSurface.test.ts` (checked by removing the guard). The
      i18n gate now also reads `App.tsx`, and `DebugScreen`'s exemption, which *said* it was never
      shipped, is now true. *"Enviar um registo"* is D-069 and stays.
      — *Original note:* **Only dev and field builds can reach the debug screen** — P0-2. `DebugScreen`
      (with its hard-coded "Phase 1 debug view" and its recording buttons) and the *Detalhes
      técnicos* link must not exist in a store build. ⚠ **Not `__DEV__` alone**: that would also
      strip it from the field build (`-PproaFieldBuild`, `docs/dev-build.md`), which is how the
      P30 gets inspected. Gate it on a build flag, and add a test that finds any ungated route.
- [~] **T-190** ✅ **Code done 2026-09-23. Seen on the P30 (pt-PT) the same day:** the place card reads
      *MIRADOURO · Pico do Areeiro · Santana · A 13 km, em linha reta*; every passport label is
      Portuguese and each stamp is read once (P2-4). ⚠ **Not yet seen, because they need a stamp or
      a trip end:** the share image, the refusal alerts, the confirmation prompt, the reveal. The new gate reads every
      string literal in every `.ts`/`.tsx`, and a second test forbids any screen from rendering a
      diary `reason`. **It found more than the review did:** the stamp confirmation prompt
      (English, *and* it repeated its own last clause), the share sheet's title, every share or
      donate failure alert (it showed the English `reason`), the walk-report description, *"and N
      more"* on the share card, and **the reveal notification's title and body** — D-012's best
      moment, English on every phone. Distances now use a decimal comma in pt/de. ⚠ Single English
      words are the gate's own blind spot (documented in the test). 717 tests.
      — *Original task:* **Close the `{}` blind spot in `i18nCoverage.test.ts`, then fix every English
      leak** — P1-4, P1-5. The leaks: `placeCard.ts` `CATEGORY_LABELS` / `STRAIGHT_LINE_NOTE`,
      `PlaceCardView.tsx` *"· Collected"* / *"away,"*, and `shareCard.ts` *"places collected"*. Pure
      modules take a `Language` parameter. Do the gate first and watch it fail on these leaks.
      Done when a `pt-PT` dump of the place card, share card and passport has no English. That
      dump also confirms P2-4 (fixed in `e1d0b8c`).
- [x] **T-191** ✅ **Seen on the P30 2026-09-23:** *0 / 80 lugares visitados*, *Ver as 18 levadas*, *Ver os
      19 miradouros*, and the new footnote. ⚠ **The device found one more of the same kind:**
      *"Levada do Furado, ainda não visitado"*. `{name}` can be either gender, and so can the card's
      *"{category} · Visitado"*, which I had written that morning (*Aldeia · Visitado*). All five now
      say *já lá esteve* / *ainda por visitar*, which agree with nothing, and `i18n.test.ts` fails
      on an agreeing word after `{name}`/`{category}` (checked by planting the old phrase). One "see all" sentence per category,
      *Boas-vindas*, and the caption under the number is `passport.collected` at zero too (*0 / 80
      lugares visitados*). The quality footnote no longer tells users measuring needs a real phone;
      it says what the setting trades, still without a number (D-041). ⚠ German is still unreviewed
      (T-160a). **Portuguese copy** — P2-1, P2-2, P2-3, P1-6:
      - one "Ver todos…" string per category (*os 19 Aldeias* is a gender error; check German's
        genders too)
      - *Boas-vindas* instead of *Bem-vindo*
      - a "0 / 80" caption that names what the number counts
      - remove the Settings sentence saying the app has not been tested on a real phone
        (`strings.ts` ~519)
- [~] **T-192** ✅ **Code done 2026-09-23. Seen on the P30: Share is disabled at 0 / 80.** ⚠ The file name
      cannot be seen until there is a stamp to share. ⚠ view-shot's `fileName` option
      still appends digits (`File.createTempFile`), so the capture is *moved* to
      `<APP_NAME>-YYYY-MM-DD.png` in the cache; a failed move falls back to the old name, logged.
      Share is disabled at 0 stamps, with a screen-reader hint saying why.
      **Share: a proper file name, and nothing to share at zero** — P1-5.
      `captureRef`'s `fileName` option (view-shot 5.1.0 supports it) → `Proa-<date>.png`. Share
      is disabled until the first stamp.
- [x] **T-193** ✅ **Done 2026-09-23.** All five permission texts in `app.json` now say what the in-app
      copy says: *never sent to us, no account*. A new test reads every string in `app.json`
      against the banned list. ⚠ **Widening the list found one more, in the worst place:** Play's
      prominent disclosure (`onboarding.background.body2`) said *"never uploaded, never shared"*.
      *Never shared* is untrue as soon as a user shares their souvenir. It now says *never sent to
      us, never sold, never for advertising*. ⚠ Nothing on iOS is built, so the iOS texts are
      checked by test only. **No absolute privacy claims anywhere** — P0-7. Rewrite the iOS purpose strings
      in `app.json` (*"never uploaded"*, *"Nothing is uploaded"*) to the in-app wording, and
      extend `brand.test.ts` to reject the phrases D-073 forbids in `app.json` and `strings.ts`.
- [~] **T-194** ✅ **Done 2026-09-23; seen on the P30:** `dumpsys package` lists **12** requested
      permissions: location ×3, foreground service ×2, internet, network state, notifications,
      boot, wake lock, vibrate, and AndroidX's own receiver permission. Push, the install referrer
      and all **20** ShortcutBadger entries (the review counted 17) are gone. Only the
      *permissions* are stripped; the libraries stay, so nothing can fail on a missing class.
      `releasePermissions.test.ts` pins both directions: what must go, and what must never go.
      ⚠ A D-011 notification has not fired on this build yet. Local notifications do not use FCM, so
      none should be affected, but that is reasoning, not observation. **Trim the release manifest** ⇠ T-117c. Settle T-117c (FCM only for local
      notifications), then strip the 17 launcher-badge permissions if the badge is not used.
      Re-read `dumpsys package` on the P30 to confirm.

### Stage 2 — Correctness and stability

- [~] **T-195** ⚠ **A trip cannot end once recording resumes after a silence** — found 2026-09-23
      while checking the review. ✅ **Confirmed in the P30's own database** (`p30-2026-09-22d`): trip 30
      holds a **24.9-day gap** (28 Aug 13:21 → 22 Sep 10:19), and the launch check lost the race:
      `app_launch` and the first batch were logged in the same second, the batch first.
      ✅ **Fixed in code 2026-09-23:** `recordingAdmission.tripHasLapsed` (pure, same threshold and `>=`
      as `detectTripEnd`), called by `recordingSink.closeLapsedTrip` on **both** write paths before a
      trip is chosen. 6 tests; the guard was checked by removing the call. ⚠ **Not yet on the device.**
      ⚠ **Corrected the same day:** installing it will **not** end trip 30. The gap is already
      inside that trip and its latest fix is recent, so the rule has nothing to act on. It prevents
      the next gap, not the last one. Seeing it fire on a phone needs a real ≥3-day silence;
      moving the phone's clock is a system setting and not ours to change. Until then the proof is
      the tests built on trip 30's real shape.
      — *Original note:*
      - `recordingSink` appends to any open trip (`getOrCreateActiveTrip`).
      - `checkTripEnd` measures silence from the trip's latest fix.
      - When T-174 restarted the P30's recorder on 22 Sep, the first new fix cut a 25-day silence
        to zero, so `INACTIVITY_END_MS` could never fire. **This is why trip 30 is open**, and it
        is a bug, separate from T-185.
      - **First, a failing test** replaying trip 30's shape. Then close the stale trip at its last
        fix before the gap, and open a new one.
      - ⚠ Decide whether a trip closed this late still gets its reveal (D-011).
- [~] **T-177** (above, Phase 3) — **the plan for it:**
      1. Run a launch loop on the P30 of 50 or more force-stop / install / reboot starts, logging
         the signature. That gives a real rate.
      2. Read how `expo-maps` mounts its view.
      3. **Accept a fix only after 60 clean launches in a row** (upper bound under about 5%).
      4. If the cause is upstream, a remount watchdog is acceptable, but call it a workaround.
- [ ] **T-196** **The location task fires before React is up** — split out of T-177.
      — **Read from source 2026-09-23 (expo-task-manager 57.0.9, `TaskService.java`), not yet measured.**
      The event is **not dropped**: with no task manager yet it is queued
      (`mTasksAndEventsRepository`) and runs once the app loads. The logged warning comes from a
      different step, `maybeStartHeadlessTask`, which only keeps **JS timers** alive while the
      Activity is paused. ⚠ **So the risk is a stall, not a loss.** If that step fails, promises in
      the handler (every database write) can hang until the app comes to the front. The
      keep-alive is retried only on the *first* event of a new batch, which cannot arrive while
      the current batch hangs. **To measure:** a cold start with the screen off (reboot, or the
      recorder restarted by the OS). Read the diary's `batch` timestamps against logcat's
      `Handling job`/`TaskService` lines; a gap between delivery and write is the stall. The
      `HeadlessJsTaskContext: CatalystInstance not available` warning at cold start may mean the
      first fixes are lost. Measure it on the P30: compare fixes in the database with fixes the
      OS delivered.
      — **One observation, 2026-09-24 (the T-210 update test).** A background cold start with
      events queued: `Start proc … for broadcast` at 19:13:38.991, then `Handling job …
      madeira-location-updates` at 39.659, then `Finished task …` and `Finished headless task 1`.
      The queued batch **was processed, within a second, with no Activity**. That is one run, not
      a rate. The stall this task describes (a keep-alive failing mid-batch) was not seen. The
      measurement that settles it is still a DB-versus-delivered comparison on a field build.
- [ ] **T-197** **Memory doubles after sharing** — P2-9. 510 MB PSS against 275 MB at rest. Find
      out what holds the capture and release it. The recorder shares this process, so the
      memory pressure puts it at risk.
      📏 **Measured on the P30 2026-09-25 (review N9, beta release, `dumpsys meminfo`, PSS MB):**
      map at rest 300 (native 102, Java 46, graphics 44, code 57) · passport 282 · map 303 ·
      Settings 231 (native 75, graphics 17) · map 251. **No leak**: it follows the screen and does
      not creep. About 50 MB is the Google map view (gone on Settings), which WalkNYC pays too; the
      rest of the gap to WalkNYC's 208 is the React Native and Hermes baseline (native 75 MB with
      no map), structural rather than a bug. Bundled JSON is ~400 KB in all. The passport builds
      1,505 native views from 80 SVG stamps, without raising the total. ⚠ Still unmeasured: after
      sharing, which needs a stamp (the P30 has none).

### Stage 3 — Product clarity (after the decisions it depends on)

- [~] **T-198** **One recording model, used the same way on home, Settings and onboarding** ⇠
      T-183, D-087. ✅ **Pure half done 2026-09-23:** `recording/recorderControls.ts` (12 tests). It
      covers the button's three states, the one notice the home screen may show (`recorder-stopped`
      cannot be dismissed, per T-174), the pause (the sink drops what arrives, so nothing has to
      wake up to resume), a walk taking `precise`, and the summary. ⚠ **Still to do:** the wiring,
      the strings, the two notification channels, and the pause's lengths and where it lives
      (D-087 leaves those open).
      — ✅ **Wired 2026-09-23 (code).**
      - `recording/walkSession.ts` is the impure half: it reads the control state from evidence,
        and starts and ends outings.
      - A walk changes the recorder through `buildOptions` (`precise`, plus its own notification
        text), re-applied in place with `setSamplingProfile`, never restarted (D-010).
        `manualWalk` gained `retune`.
      - The sink drops fixes and crossings while paused.
      - The map shows the button's three states and the notice. The notice is polled on the
        existing 10 s timer, and `recorder-stopped` cannot be dismissed.
      - Settings is *Registo automático* and has the pause. Ending an outing shows its summary.
      - The trip messages have their own Android channel with sound.
      - Outing, pause and restart lines use a new diary kind, `outing`: logged as `start` they
        would have reset `recorderSilence`'s evidence.
      - Found along the way: erase-all deleted `app_state` under the tier cache (since T-146).
        `forgetCachedTrackingSettings` now runs after it.
      ✅ **Seen on the P30 2026-09-23** (field build `5af1ec6`, pt-PT), checked with `dumpsys`, not by eye:
      - The home screen reads *Começar passeio*, with no notice while recording works.
      - Outing on the *Equilibrado* tier, app in the background: **no GPS request → `FINE gps
        +10 s`**, and the notification changes to *Passeio em curso*. Ended: the request is gone
        and the notification is back. The summary read *Passeio terminado / < 1 min · distância
        não medida / Nenhum carimbo novo neste passeio*. That is honest: indoors, lying still,
        no fixes arrived.
      - Pause: Settings shows *Em pausa até às 17:52 · Retomar agora*; the map notice reads
        *Registo em pausa até às 17:52 · Retomar* (one screenshot: placed beside the settings
        control, readable). *Retomar* clears it.
      ⚠ **Not seen:** the sink actually dropping fixes during a pause. Indoors and stationary,
      nothing was delivered to drop (0 stored, 0 dropped). Tests only, until a pause happens
      outdoors while moving. Also unexercised: `needs-always`, `recorder-stopped`, and the trip
      channel.
      ⚠⚠ **The device found two bugs, both fixed after `5af1ec6`:**
      1. **Changing the tier in Settings did nothing until the next launch** (since T-146).
         *Preciso* → *Equilibrado* left the request at +10 s. `retuneRecorder` now applies it
         in place. The guard is a source scan whose first version passed with the call removed
         (it matched the word in a comment); it now matches the call.
      2. **An outing started during a pause recorded nothing.** Starting one now ends the
         pause.
      ✅ **Both fixes seen on the P30** (build from `13893fa`, installed 17:01). With the app in
      the background, *Preciso* gave `FINE gps +10 s`; switching to *Equilibrado* dropped the
      request **without a relaunch**, and switching back restored it. Pausing, then starting an
      outing, cleared the pause notice. The project lead's tier was left on *Máximo detalhe*. ⚠ Today the button does nothing when background recording is on (`manualWalk.ts` → `leave-alone`). The home control reads the recorder's real state, the same check `soak-check.sh`
      makes, not `isRecording()` (T-174).
- [~] **T-199** **The home map shows what there is to collect** ⇠ T-184. ✅ **Code done 2026-09-23,
      ⚠ the rings not yet judged by eye on the P30.** ⚠ **The chip is gone (2026-09-24):** seen on the
      P30 reading *"Mais perto por visitar: Praia dos Reis Magos"*, then removed on the project
      lead's word, to keep the map as quiet as WalkNYC's (D-085). ✅ Gone on the P30
      (`675ae50`): the home screen reads only *Começar passeio*. `map/placesToCollect.ts` (8 tests) draws every uncollected place
      as a hollow ring, with the nearest three (from the last known position) as a larger hollow
      ring in the collected disc's grey. **D-085's rule is kept by construction:** hollow against
      filled, a circle against Google's teardrops, grey against the blue location dot and green
      parks, and a test checks every ring on both maps. Shown from z8, so the island view on day
      one has them (`MIN_MARK_ZOOM` for collected stays 10). Tapping a ring opens its card, now
      asked whether it is collected. ⚠ Judged by eye on the device next; no paint is new.
      — **Seen on the P30 2026-09-23** (build from `c15c8a9`, one screenshot at street zoom):
      - ✅ The ring renders hollow and grey, and reads as neither a stamp, a Google teardrop nor
        the location dot. D-085's hard rule holds on the device.
      - ⚠⚠ **But it does not yet do the job P1-1 asked for.** The ring has **no label**, and it
        sits just below **Google's own pin for the same beach** (*Praia dos Reis Magos*). A new
        user sees an unexplained small circle beside a named green pin. With one place in view,
        the "nearest" call-out cannot be told from a plain ring. **Needs a design answer, not a
        tweak.** Candidates to put to the project lead: a label on the nearest ones (expo-maps
        markers need `expo-image`, see `collectedMarks.ts`), hiding Google's POI pin where one of
        ours sits, or a one-line *"3 lugares perto de si"* entry into the passport.
      - ⚠ **Not seen:** the island view with all 80 (adb cannot pinch), and the tap to open a
        ring's card (the phone had locked).
      — ~~Answer built 2026-09-23: `ui/NearestChip.tsx`~~ **Removed 2026-09-24** (see above). A ring
        is named by tapping it.
- [x] **T-200** ✅ **Done 2026-09-23, seen in the workbench:** *"Welcome to Proa / Madeira has 80
      places waiting for a stamp in your passport. Go to one, and its stamp appears by itself."*
      The name comes from `brand.ts` and the destination and count from the content pack.
      - `t()` and `n()` now fill `{app}` themselves, so no call site can forget it.
      - Every *"this app"* / *"esta aplicação"* / *"diese App"* became the name (14 strings), Play's
        background-location disclosure included.
      - Tests fail on *Madeira* anywhere in `strings.ts` (D-017), on *"this app"*, and on a welcome
        screen without passport, stamp, `{app}`, `{destination}` or `{count}`. The placeholder
        test caught a Portuguese line that had never named the app.
      ⚠ Not seen on the P30: that means wiping its data, and that phone holds the only field
      data. **Onboarding sells the passport** ⇠ T-183 — P1-3. ⚠ **Also found 2026-09-23:** `onboarding.welcome.body1`
      names *Madeira* in `strings.ts`, which breaks D-017; read the name from the content pack's
      `destination`, as the reveal does. It names the stamps, the 80
      places, and *Proa* (read from `brand.ts`, never typed out). ⚠ Onboarding has never been seen
      on a device: view it on the emulator, not on the P30, whose data must not be wiped.
- [~] **T-201** ✅ **Mechanism done 2026-09-24; ⚠ the content waits on the project lead's veto.**
      `pois.json` places take an optional `why: { en, pt, de }`. It is parsed so that a bad line
      is dropped and its place kept, never the other way. The card shows the line in its own
      language or not at all, never another language's. `validate-content.mjs` counts coverage
      (0 / 80 today) and warns on missing languages and on lines over 140 characters (measured:
      about 3–4 lines on the card). The passport now dims behind the card, and a tap on the
      dimmed page closes it. The map does not dim, because that would hide the ring the card is
      about. **Next: the veto of `docs/why-go-draft.md`** (80 English lines, 4 left blank, ⚠
      on the facts I am unsure of), then pt/de, then into `pois.json`. Practical information
      (length, time, difficulty) is **not** drafted: it comes from IFCN's official PR figures,
      not from memory.
      **The original task:** The place card gives a reason to go — P1-4. A "why go" line and practical
      information (length, difficulty, access) for all 80 places, stored in `content/` (D-017),
      drafted and vetoed as D-064 sets out; a dimmed backdrop behind the sheet. Photos only with
      clear rights. **The biggest single job in this plan.**
- [x] **T-202** ✅ **Seen on the P30 (pt-PT) 2026-09-24, release from `885965a`:** *Versão 0.1.0*,
      no *Contactar-nos* (no `CONTACT_EMAIL` yet), and licences opening with *"O Proa é feito com
      119 pacotes…"*, rows expanding. *English* changed the screen at once, and the recorder's
      notification with it (*Recording your trip*); *Automático (Português)* brought both back.
      The phone is left on Automático. ⚠ The first try crashed the app: see T-209.
      **Code done 2026-09-23 in three parts:**
      1. Copy about half the length. The button reads *Alterar acesso à localização*, and the
         footnote names *"Permitir sempre"*. About shows the version. *Contactar-nos* stays
         hidden until `CONTACT_EMAIL` exists (T-187).
      2. A language choice (*Automático (…)* / English / Português / Deutsch), applied before the
         first screen and in both background tasks.
      3. An open-source licences screen from `tools/build-licences.mjs` (119 npm packages).
         `licences.test.ts` fails if a direct dependency is missing. ⚠ Native Android libraries
         are named with Google's terms, not listed: that needs Google's oss-licenses plugin.
      ⚠ **Found along the way:** two more English strings on every phone, *"last changed"* (privacy
      screen) and *"Most recent:"* (passport). Both were JSX text beside `{}` expressions, which no
      check read. The i18n gate now does, and it found the second one itself.
      Restore purchase waits for T-156. **Settings for a store app** — P1-6. Half the copy, and explain the *Abrir
      definições do telemóvel* button. Add version, language choice, support contact and
      open-source licences; add restore purchase with T-156.
- [~] **T-203** **A design pass on the passport and the empty state** — P2-5, P2-6, P2-7, P2-8.
      The grey uncollected stamps that look alike, dark panels on a light page, the placeholder
      blob, and zero-width tap areas on stamps past the right edge.
      — **P2-7 needs no change (checked 2026-09-24).** Each category row is a horizontal
      `ScrollView` (`PassportView.tsx`). uiautomator reports a child scrolled off-screen with its
      bounds clipped to the screen edge, so *Bica da Cana* at `[1032,1184][1032,1472]` is the
      next stamp in a carousel, reached by swiping. It is not a broken tap area.
      — **P2-8 is the project lead's call, not a fix:** the grey *"Passport"* placeholder is
      D-083's own choice from three drawn options. The review reads it as a dark blob. That is a
      judgement by eye on the P30, so it is asked, not changed.
      — **P2-5 / P2-6: four options drawn and measured, for the project lead to pick (2026-09-24).**
        `node tools/preview-passport-options.mjs` → `tools/out/passport-options.html`, using real
        places and the shipped drawing. **A** today · **B** unvisited stamps keep their place's hue
        (at the grey's own lightness) · **C** the whole passport is the dark album · **D** B+C. All four
        measure an unvisited edge 3.36:1, a name 8.28:1, and an emblem ≥ 5.57:1. Two first tries failed
        and were fixed before showing: a tinted border (2.30:1) and tinted ink (1.27:1).
      — ✅ **The project lead chose D; built 2026-09-24.** `stampArt.uncollectedFor(colourway)` gives each
        unvisited stamp its place's hue at 35% saturation, at each grey's own lightness. The border,
        the name band and the emblem ink stay grey. The passport screen is one dark album
        (`theme.album`: page and panels `#1C1C1E` with a hairline, text `#F2F2F7`, muted `#AEAEB2`,
        link `#5AA9FF`, and a light-blue button with dark ink), with a light status bar.
        `contrast.test.ts` measures every colourway's unvisited palette and every album pairing,
        and fails if unvisited stamps collapse back to one colour. ⚠ The map's passport-button
        placeholder (D-083) takes the levada hue now, too. ✅ **Seen on the P30 (one screenshot):**
        one dark album with hairline panels and a light status bar. Unvisited viewpoints are warm
        browns and levadas teal and olive, still muted, with grey bands.
- [x] **T-204** **Trips that end without a flight home** ⇠ T-185, T-195. ✅ **Code 2026-09-24 (D-088):**
      *Terminar viagem* at the bottom of the passport, behind a confirmation.
      `recording/finishTrip.ts` switches automatic recording off **first** and then closes the
      trip (`endTripByUser`: award pass, `manual`, no reveal). A test guards that order. **Found
      and fixed with it:** after any end the passport and the map showed 0 / 80, because they
      read only the open trip; now `tripDao.getTripOnShow`. ✅ **Seen on the P30 2026-09-24** (beta
      build). The confirmation reads *"Terminar esta viagem? O seu passaporte fica como está. O registo
      automático desliga-se, e a próxima viagem começa quando voltar a registar."* Confirming closed
      the trip (the button went), stopped the location requests and removed the recording
      notification, and Settings' switch read off. Switching it back on restarted the recorder.
      ⚠ expo-location leaves its service *bound* (not foreground) after the stop; there is no
      notification and no location request, so it is effectively off.

### Stage 4 — Proof on a real phone

- [ ] **T-205** **One real trip, planned and evidenced** (OD-10) ⇠ T-195, T-177 — P0-4. First
      confirm the P30 is still available. Use a release build, a route through at least three of
      the 80 places, and a trip end. Evidence:
      - stamps in the database, pulled via the field build
      - the notification seen
      - the souvenir and the replay (OD-12) seen moving
      - one screenshot of each
      Take T-054 battery readings along the way.

### Stage 5 — Store and compliance

- **T-122 is reopened** (below): its answer, "no data collected", is contradicted by T-117c.
- [ ] **T-206** **Host the privacy policy and set `CONTACT_EMAIL`** ⇠ T-187. Unblocks T-123 and
      the Play listing. **The domain exists: `bruma.lol`** (2026-09-25). Still needed: hosting, and an
      address on it for `CONTACT_EMAIL`; test that mail from it reaches Gmail before relying on it.
- [ ] **T-207** **Internal testing track and pre-launch report** ⇠ T-117e, T-206, T-189 — D-077.
      Add Google's re-signing SHA-1 to the Maps key *before* reading anything, or every screenshot
      is a grey map. Read crashes, accessibility and screenshots per language.
- Then T-123 (background location), T-133 (listing), T-156 (billing ⇠ T-182), T-160a (German).

### Gates

- [ ] **T-208** **Re-run the review at each gate**, using the review's §2 method and weights, and
      record the score. No predicted scores.
- [x] **T-209** ⚠ **Found on the P30 2026-09-24: Settings crashed the app, and took the recorder
      with it.** Tapping *Licenças de código aberto* closed the app. Logcat: *"Rendered fewer
      hooks than expected"* in `SettingsScreen`. `donateWalk` (a `useCallback`) had sat below
      the early-return screens since D-069 (2026-08-16), so **Privacidade, Apagar tudo and
      Licenças each crashed every release build for five weeks**. It went unseen because a dev
      build shows a red box, no test renders a component, and there is no ESLint. ✅ Fixed:
      the hook is moved up, and `hooksOrder.test.ts` guards every component (its fixture test
      proves it flags the old file at the crash line). ✅ **Seen on the P30 (`885965a`):**
      Licenças, Privacidade and the erase confirmation (left with *Manter a minha viagem*) all
      open and close in one process, and the crash buffer stays empty.
- [x] **T-211** ⚠ **Android's Back button left the app from every screen** — found on the P30
      2026-09-24, while probing T-177: Back in Settings went to the launcher. There was no
      `BackHandler` anywhere, so Back from Settings, the passport, the replay, the licences,
      the privacy text or an open place card all exited. ✅ **Code 2026-09-24:**
      `navigation/backNavigation.ts` (pure: settings/passport/debug → map, replay → passport,
      map → the OS) and `ui/useBackHandler.ts`. Inner things (a card, licences, privacy, the
      erase confirmation) register only while open, so the newest, innermost handler runs first.
      ✅ **Seen on the P30 2026-09-24 (release `675ae50`):** Settings → Back → map; Licences →
      Back → Settings → Back → map. Back on the map sends the app to the background, and the recorder
      keeps running (checked at 60 s).
- [x] **T-210** ⚠ **An app update stopped the recorder, and nothing restarted it for 22 h** —
      found on the P30 2026-09-24. The release was installed over the field build at 20:23. The
      next morning the home map said *Nada registado há 22 h 14 min*, and the foreground service
      came back only when the app was opened. `expo-task-manager` declares a receiver for
      `MY_PACKAGE_REPLACED` and `BOOT_COMPLETED`, so either EMUI blocked the broadcast (its
      app-launch manager) or that receiver does not restart a location task. **Unknown which.**
      A Play auto-update mid-holiday would do the same, silently. **To measure:** `install -r`
      the same APK with the app closed and check `dumpsys activity services` a minute later,
      then repeat with EMUI's launch manager set to manual. Needs a Play Protect tap each time.
      ✅ **First half measured 2026-09-24:** with the recorder running and the app in the
      background, `install -r` at 15:25:49; at 15:27:11 there was no process, no service and no
      location request. Android sent `MY_PACKAGE_REPLACED` (it is in the log, and other apps'
      receivers ran), the receiver is in the release manifest (`aapt2`), and **the app's process
      was never started**. When that receiver does run, Expo restores the task (`TaskService`'s
      constructor calls `restoreTasks()`). So **EMUI withheld the broadcast.** Stock Android
      would probably not, but that is not measured. **Next:** the project lead sets *Iniciar
      aplicações → Proa* to manual (all three on) and I repeat the install. If it recovers,
      *Deixar o Proa continuar* has to point Huawei users at that screen, not only at the
      battery one.
      — ✅ **Second half measured 2026-09-24**, after the project lead set *Iniciar aplicações →
      Proa* to manual with all three switches on. Recorder running, app in the background,
      `install -r` at 19:13:37.
      - **The broadcast now arrives.** `Start proc … for broadcast {…TaskBroadcastReceiver}`,
        `TaskService: Handling intent with action 'android.intent.action.MY_PACKAGE_REPLACED'`,
        and a headless task ran our JavaScript.
      - **The recorder still did not come back.** At +15/30/60/90 s there was no foreground
        service and no location request. Opening the app restored it at once.
      - **So there are two blockers, not one.** EMUI's launch manager was the first, and the
        setting removes it. The second is starting the recorder from the background: T-173
        measured EMUI refusing a background foreground-service start on this phone. The exact
        failing step inside Expo is not in the log.
      - **What the app can do: ⚠ a decision for the project lead.** The headless run after an
        update can see *"should be recording, is not"* but cannot fix it from the background.
        Proposed: post one notification, *"Proa was updated — open it to keep recording"*, whose
        tap restarts the recorder. D-087 allows a notice when something is wrong, and this is
        the one case that is wrong silently.
      — ✅ **Accepted by the project lead (no dash in the copy); built 2026-09-24.** A native
        receiver, `UpdateNoticeReceiver`, is generated by `plugins/withUpdateNotice.js` and
        listens for `MY_PACKAGE_REPLACED`. After an update the app's JavaScript runs only if events
        are queued, so the receiver does not rely on it. It reads `files/update-notice.json`, which
        the app writes (`notify/updateNoticeFile.ts`) at launch, on the recording switch, on a
        language change and on *End trip*: whether automatic recording is on, and the text in the
        user's language. Recording off means no message. It uses the trip channel
        (`notify/tripChannel.ts`, now the channel's one home). ✅ **Seen on the P30 2026-09-24:**
        installing over a running recorder, `Start proc … for broadcast {…UpdateNoticeReceiver}`,
        then `update notice posted` within 0.2 s: *"Abra o Proa para continuar a registar / O Proa foi
        atualizado. Abra-o uma vez e a sua viagem continua a ser registada."* The app clears it when it
        comes to the front (`dismissUpdateNotice`; not yet on the phone).
- [x] **T-212** ⚠ **Opening the app did not restart a deferred recorder** — found on the P30
      2026-09-24, while testing T-210. App.tsx synced the recorder once, at mount, with the
      `AppState` of that moment. T-173's comment said a deferred start is *"retried on the next
      resume"*, but nothing did it. When an update (or EMUI) had started the process in the
      background, `AppState` read background at mount, the start deferred, and the recorder's
      foreground service stayed off through two relaunches, until the Settings switch was flipped.
      ✅ **Fixed and seen:** App.tsx re-syncs on every transition to `active`
      (`resumeSync.test.ts` guards the wiring). On the P30, off before opening, and at +10 s the
      foreground service and *A registar a sua viagem* were back. Each resume re-applies the options,
      which restarts location updates for a moment. That was accepted, because a recorder that
      stays off is the unrecoverable loss.
- **Gate R1 — MVP:** P0-1 to P0-5 closed (T-188, T-189, T-182 applied, T-177, T-205), and one
  real trip gave a stamp, a trip end and a souvenir.
- **Gate R2 — closed beta (T-129):** R1 met; T-193, T-194, T-122, T-206 and T-207 done; the
  pre-launch report is clean; T-208 re-run.
- **Gate R3 — public (T-137):** R2 met; T-135 shows no false or missed stamps; billing works
  end to end including restore, or T-182 chose otherwise; T-123 approved; T-198–T-202 done.

---

## Phase P — Planning and definition

- [x] **T-001** Define product concept, audience and core loop
- [x] **T-002** Critique the concept; identify the slow-fill / dark-map retention risk
- [x] **T-003** Survey prior art (Wandrer, CityStrides, Fog of World, Polarsteps, AllTrails,
      Wikiloc) and confirm technical feasibility
- [x] **T-004** Decide the canvas model — curated places over island-wide road coverage
      ⇠ T-002
- [x] **T-005** Decide the reward metaphor — passport stamps over stars ⇠ T-004
- [x] **T-006** Settle the battery strategy (batching, activity gating, geofences, burst
      matching)
- [x] **T-007** Settle the mobile-data strategy (bundle the island offline)
- [x] **T-008** Settle the privacy architecture (no backend, zero networked dependencies)
      ⇠ T-007
- [x] **T-009** Design the "ghost app" resilience model (OS-survival, day-1 health check, two
      notifications)
- [x] **T-010** Design the low-signal matching strategy (tunnels, levada corridors, barometer,
      pedometer, generosity rule) ⇠ T-006
- [x] **T-011** Decide the distribution strategy — organic sharing of the souvenir video
- [x] **T-012** Write project documentation (README, PROJECT_PLAN, ARCHITECTURE, TASKS,
      DECISIONS, CONTEXT) ⇠ T-001…T-011

### Still open in this phase

- [x] **T-013** Decide framework (OD-1) — **resolved 2026-08-06: React Native** with
      `@maplibre/maplibre-react-native` v11 and Expo tooling (D-023). **Phase 1 unblocked.**
      ⇠ T-013a
- [x] **T-013a** Research MapLibre and geolocation plugin maturity in RN vs Flutter —
      **done 2026-08-06.** Surfaced the `setFeatureState` finding (D-004 revision, D-022),
      which mattered more than the framework question itself.
- [x] **T-014** Decide whether Porto Santo is in scope (OD-2) — **resolved 2026-08-06:
      included structurally, deliberately deprioritised editorially** (D-021)
- [x] **T-015** Confirm the hero number (OD-3) — **resolved 2026-08-06: places/stamps**
      (D-002 Accepted)
- [x] **T-016** Decide raw-trace retention policy (OD-6) — **resolved 2026-08-06: retain**
      (D-010 Accepted)
- [x] **T-016b** Confirm whether Phase 0 fieldwork is locally available — **resolved
      2026-08-06: project lead lives in Madeira.** Sequencing unchanged; see CONTEXT.md §5a
- [x] **T-016a** Confirm D-022 (overlay rendering rather than feature state) — **confirmed by
      the project lead 2026-08-08. D-022 is Accepted.**
- [x] **T-016d** Settle the visual direction and primary-screen structure — **resolved
      2026-08-08:** two styles, light for use and dark for the souvenir (D-026); passport by
      category (D-027); three-control layout. Written up in `docs/design-brief.md`.
      **All three decisions are Provisional** until validated against real tiles (T-025).
- [x] **T-016c** Decide on the Transistor Soft licence — **resolved 2026-08-06: not purchased.**
      Start free on `expo-location`; buy only if T-051–T-054 fail (D-025)

---

## Phase 0 — Validation

Cheap answers to expensive questions. Nothing here requires the app to exist.

### Field GPS reality check

> **Track A procedure — logger, both runs, ground truth, the sampling-bias warning — is in
> [`docs/field-testing.md`](docs/field-testing.md).** The tasks below track it; that document
> says how to actually do it.

- [ ] **T-017** Obtain a raw sensor logger — **do not build one.** Use **Sensor Logger**
      (Kelvin Choi, iOS + Android): records GPS fix/accuracy/speed/heading/altitude, barometer
      and pedometer in one time-aligned session, exports CSV/JSON/SQLite. Paid tier is needed
      for combined CSV export and the barometric-altitude/pedometer channels. Tooling and
      sample parsing code at github.com/tszheichoi/awesome-sensor-logger.
- [ ] **T-017a** Capture ground truth alongside each run: take a **photo** at each key waypoint
      (trailhead, tunnel portals, exit). EXIF gives timestamp + location for free, which is what
      the recorded trace gets compared against.
- [ ] **T-018** Walk one full levada under Laurissilva canopy with the logger ⇠ T-017
- [ ] **T-019** Drive one tunnel-heavy VR1/VE1 route with the logger ⇠ T-017
- [ ] **T-020** Analyse and document blackout durations, error magnitudes, whether the
      barometer survives tunnels and canopy, whether altitude separates the VR1 from the
      coastal ER101, and whether the pedometer keeps counting through blackouts. Write to
      `docs/field-notes.md`. ⇠ T-018, T-019
- [ ] **T-021** Commit the traces to `tools/fixtures/` as the permanent matching regression
      suite ⇠ T-018, T-019
      — ✅ **The importer is built, 2026-08-17.** `tools/import-sensor-logger.mjs` reads an
      unzipped Sensor Logger export into `tools/fixtures/<name>.json` and prints the T-020
      numbers on the way past — blackout durations, fix interval, accuracy percentiles, and what
      share of fixes the 120 m cut would refuse. `tools/preview-trace.mjs --fixes <file>` then
      runs **the app's own `cleanTrace`** over them. `tools/fixtures/README.md` says what may
      live there; the walk itself is `docs/field-testing.md`.
      — ⚠ **The parser has never seen a real export.** Columns are matched from a list of
      plausible names and the error names the headers it actually saw, so a wrong guess costs a
      one-line edit to `COLUMNS` in `tools/lib/sensorLogger.mjs`. Verified against a synthetic
      Location.csv only — a deliberately injected 90 s dropout and 140 m fixes both came back.
      — ⚠ **`--fixes` prints no deviation figure**, because a real walk has no ground truth: the
      grey "truth" line and the mean/worst columns are only meaningful against a modelled route.
      Claiming them on field data would be exactly the measured-sounding number CLAUDE.md forbids.
- [ ] **T-021a** **Repeat at least one run on a mid-range Android device.** The project lead's
      iPhone 15 has better GNSS than much of what tourists actually carry, so iPhone-only
      fixtures are best-case. Tuning corridor widths and gap thresholds against them risks an
      app that under-credits on cheaper hardware. Sensor Logger is cross-platform, so the same
      procedure applies. ⇠ T-018, T-019

### Tile pipeline spike

- [x] **T-022** Obtain an OSM extract of Madeira **and Porto Santo** (D-021)
      — Notes: `docs/task-notes.md` (T-022)
- [x] **T-023** Build a reproducible tile generation script producing PMTiles or MBTiles ⇠ T-022
      — Notes: `docs/task-notes.md` (T-023)
- [ ] **T-024** Verify stable OSM way IDs survive into the rendered tiles. **Downgraded from
      "critical" by D-022** — useful as an internal join key, no longer architecturally
      load-bearing. ⇠ T-023
- [ ] **T-025** Prove overlay rendering: a MapLibre demo drawing a highlighted road segment
      from *local* geometry on top of the basemap, and confirm it aligns with the basemap's own
      road rendering (D-022) ⇠ T-023
- [ ] **T-025a** Evaluate suppressing basemap road rendering entirely and drawing all roads —
      visited and unvisited — from the local overlay, which makes alignment a non-issue by
      construction ⇠ T-025
      — ⚠ **Measured 2026-08-08 (T-028): this means rendering ~51,000 highway ways**, before any
      splitting at intersections — not the ~5,000 implied elsewhere. D-022 names this as the
      escape hatch for the alignment risk; it is not the cheap one it reads as. Measure before
      committing.
      — **But it need not be all-or-nothing.** T-026a found the basemap cannot distinguish a
      levada path from any other footpath (names are stripped from `transportation`). Drawing
      **only levada paths** from our own overlay is **~1,386 ways** — ~3% of the full cost, aimed
      at the one feature the product is about. Evaluate this scoped version first.
      — Cheaper still, worth eyeballing before building anything: the *named* `waterway` channel
      runs parallel to the path within a few metres, so rendering it may read as "the levada" at
      most zooms with no overlay at all.
- [~] **T-026** Record tile pack size and judge it acceptable for a hotel-WiFi download ⇠ T-023
      — Notes: `docs/task-notes.md` (T-026)
- [x] **T-026a** Verify the tile schema actually carries Madeira's defining features
      — Notes: `docs/task-notes.md` (T-026a)
- [ ] **T-027** ~~Decision gate on T-024~~ **Removed by D-022.** The fog-of-war fallback is no
      longer contingent on the tile pipeline preserving OSM IDs.

### Content feasibility

- [x] **T-028** Assess OSM levada coverage and quality; decide whether official PR-route data
      must be reconciled in, and confirm licensing (OD-7)
      — Notes: `docs/task-notes.md` (T-028)
- [ ] **T-028b** Install WalkMe and look at it — the direct competitor (`docs/competitors.md`).
      Its map is app-only, so cartography, trail rendering and the offline download flow could
      not be inspected from the web. One afternoon, on the island. ⇠ nothing
- [ ] **T-028a** Field-verify the OSM levada data. Counts prove the data exists, not that it is
      accurate. Walk one known levada and compare against OSM: corridor **connectivity** (a gap
      mid-corridor breaks trailhead-to-exit crediting), tunnel **portal-node precision**, and
      whether the PR relations are current. Fold into a Track A run — same afternoon, same
      device. ⇠ T-018

**Milestone M0** — assumptions validated ⇠ T-020, T-025, T-026, T-028

---

## Phase 1 — The recorder

**Blocked until T-013 (framework decision).**

### Foundations

- [~] **T-029** Scaffold an Expo + React Native project **in TypeScript** (CONTEXT.md §6.7);
      set up iOS and Android dev builds. Note background location requires a development build,
      not Expo Go. ⇠ T-013
      — Notes: `docs/task-notes.md` (T-029)
- [x] **T-029b** Stand up the portable Android emulator so the app can be *seen*
      — Notes: `docs/task-notes.md` (T-029b)
- [x] **T-030** Implement the SQLite schema (raw_fix, sensor_sample, geofence_event, trip)
      with WAL mode ⇠ T-029, T-016
      — Notes: `docs/task-notes.md` (T-030)
- [x] **T-030a** Define a `LocationProvider` interface so the recording backend can be swapped
      without touching matching, storage or presentation (D-025) ⇠ T-029
- [x] **T-031** Integrate **`expo-location`** (free) behind `LocationProvider` (D-025)
      ⇠ T-030a — code complete, never yet run on hardware.
- [ ] **T-031a** *Contingency only:* swap in the Transistor Soft SDK if any of T-051–T-054
      fail. Do not purchase before that evidence exists. ⇠ T-051, T-052, T-053, T-054
- [x] **T-032** Set iOS Data Protection class to `CompleteUntilFirstUserAuthentication` and
      configure Android app-private storage ⇠ T-030
- [~] **T-032a** Backup policy (ARCHITECTURE.md §4a): **include** the SQLite database,
      **exclude** the tile pack. iOS `isExcludedFromBackup`; Android manifest backup rules.
      Exceeding Android's auto-backup cap can silently fail the *whole* backup, losing the
      user's trip history. ⇠ T-032, T-057
      — Notes: `docs/task-notes.md` (T-032a)

### Capture

- [~] **T-033** Implement batched location delivery — iOS deferred updates, Android
      `setMaxWaitTime` ⇠ T-031
      — Notes: `docs/task-notes.md` (T-033)
- [x] **T-034** Implement **stationary-vs-moving** sampling gating (D-028) ⇠ T-031
      — Notes: `docs/task-notes.md` (T-034)
- [ ] **T-034a** *Deferred:* revisit walking-vs-driving gating once T-020 shows whether the
      distinction pays for itself. If it does, the Android answer is a dedicated step-counter or
      activity-recognition dependency — costing a new dependency (§6.4) **and** an
      `ACTIVITY_RECOGNITION` runtime permission. Do not spend either on a guess. ⇠ T-020, T-034
- [x] **T-035** Capture barometer / relative altitude alongside GPS ⇠ T-030
      — Notes: `docs/task-notes.md` (T-035)
- [~] **T-036** Capture pedometer step counts alongside GPS ⇠ T-030
      — Notes: `docs/task-notes.md` (T-036)
- [x] **T-037** Immediate incremental flush on every batch — never hold a day in memory
      ⇠ T-030, T-033
      — Notes: `docs/task-notes.md` (T-037)
- [ ] **T-038** Sampling policy tuned against Phase 0 field data ⇠ T-020, T-033, T-034

### Geofence backbone

- [x] **T-039** Implement the dynamic geofence manager — nearest ~18 registered plus one large
      "left this area" trigger that reshuffles the set (iOS 20-region cap) ⇠ T-031
      — Notes: `docs/task-notes.md` (T-039)
- [x] **T-040** Load geofence definitions from the content pack, not from code ⇠ T-039, T-014
      — Notes: `docs/task-notes.md` (T-040)
- [x] **T-041** Persist geofence enter/exit/dwell events ⇠ T-039, T-030
      — Notes: `docs/task-notes.md` (T-041)

### Permissions and survival

- [x] **T-042** Permission flow: While-Using first and **fully functional**, with explicit
      start/end recording mode ⇠ T-031
      — Notes: `docs/task-notes.md` (T-042)
- [x] **T-043** Deferred "Always" upgrade request, timed for ~day 2 ⇠ T-042
      — Notes: `docs/task-notes.md` (T-043)
- [x] **T-044** Detect iOS Always → While-Using downgrade and prompt gently for recovery
      ⇠ T-043
      — Notes: `docs/task-notes.md` (T-044)
- [ ] **T-045** Android foreground service with the `FOREGROUND_SERVICE_LOCATION` type
      ⇠ T-031
- [x] **T-046** Android battery-optimisation exemption request ⇠ T-045
      — Notes: `docs/task-notes.md` (T-046)
- [ ] **T-047** iOS region monitoring + significant-location-change as the
      termination-survival backbone (survives force-quit) ⇠ T-039
- [~] **T-048** Service health monitor and gap annotation ⇠ T-037
      — Notes: `docs/task-notes.md` (T-048)
- [x] **T-049** Day-1 self-check (12–24h after install) verifying recording actually happened
      ⇠ T-048
      — Notes: `docs/task-notes.md` (T-049)
- [x] **T-072a** Per-category progress computation (D-027) — the passport's primary axis
      ⇠ T-066, T-071
      — Notes: `docs/task-notes.md` (T-072a)
- [x] **T-073** Per-region progress computation ⇠ T-067, T-071
      — Notes: `docs/task-notes.md` (T-073)
- [x] **T-050** Debug screen: raw fix count, last fix time, gaps, permission state, service
      health ⇠ T-048
      — Notes: `docs/task-notes.md` (T-050)

### Verification

- [x] **T-052a** ✅ **RESOLVED 2026-08-12 — the recorder records. It was never broken (D-047).**
      — Notes: `docs/task-notes.md` (T-052a)
- [~] **T-052b** Detect a recorder that is running but receiving nothing ⇠ T-052a, T-049
      — Notes: `docs/task-notes.md` (T-052b)
- [x] **T-052c** ✅ **RESOLVED 2026-08-12 — and it was not what it looked like (D-048).**
      — Notes: `docs/task-notes.md` (T-052c)
- [x] **T-142** ✅ **FIXED 2026-08-14 — `Cannot use shared object that was already released`.**
      One retry, for one error signature, applied once at the handle rather than at thirty call
      sites. The rejection happens *before the statement executes*, which is the whole of the
      safety argument and is why the predicate matching it is deliberately narrow.
      — Notes: `docs/task-notes.md` (T-142)

- [x] **T-148** Housekeeping, 2026-08-15. 2.9 GB of regenerable Gradle output removed, screenshots
      pruned to the six that show current state, a stray `metro.log` untracked. **The checkout is
      ~12 GB and none of it is the app** — the breakdown, what is safe to delete and what only
      looks safe are in `docs/dev-build.md`. Two unused test seams deleted.

### Settings, polished — 2026-08-15

- [x] **T-147** **Google's own dark map, where the device can draw it.** The project lead asked to
      keep it OEM; the app was drawing an authored style on every device instead.
      — ⚠ **`colorScheme: DARK` needs the latest Maps renderer**, and nothing in `expo-maps` ever
      asks Play services for it — the log said `preferredRenderer: null`.
      `plugins/withLatestMapsRenderer.js` now asks in `Application.onCreate`, which is the
      documented way and has to happen before any map exists.
      — ⚠ **Asking is not getting.** This emulator asks for LATEST and is handed **LEGACY**: Play
      services there does not have the new renderer. So the app records what it actually got and
      chooses from that (`map/mapsRenderer.ts` → `map/darkMode.ts`) — Google's dark map where it
      works, the authored one where it cannot. Nobody gets a white map after choosing dark.
      — The renderer reaches JavaScript as **one word in a file**, written by the SDK's own
      callback. A native module for that would be a bridge, a registration and a package to keep
      alive across Expo upgrades, to carry a string that changes once per launch.
      — ⚠ Needed `play-services-maps` declared in the app module: `expo-maps` keeps it as an
      `implementation` dependency, so `MapsInitializer` is not on the consuming classpath.
      — Notes: `docs/task-notes.md` (T-147)



- [x] **T-146** Background tracking, its three tiers, *Start walk*, a drawn settings icon, and a
      dark map that is actually dark. The project lead's list of 2026-08-15.
      — **Tiers are named, not priced** (D-060). Asked for as *~3% / medium / ~15–20%*; they ship
      as Battery saver / Balanced / Best detail because no battery figure here has ever been
      measured and D-041 exists for that reason.
      — ⚠ **Dark mode needed two implementations.** `colorScheme: DARK` is a *latest-renderer*
      feature and Play services loads the **legacy** renderer on plenty of devices, this emulator
      included, where it is ignored in silence. An authored night style
      (`map/googleNightStyle.ts`) works on both.
      — ⚠ **And it took the settings button with it**: the chrome measured 1.13:1 on the night
      map against 15.36:1 on the light one. A hairline border on the dark map only, with the
      number pinned by a test.
      — **A third missing seam, same family as T-145**: nothing had ever started recording for a
      user who granted Always, and those users are shown no start button by design. Fixed in
      `syncRecordingWithPreferences`.
      — Notes: `docs/task-notes.md` (T-146). Decision: **D-060**.

### ⚠⚠ Found 2026-08-14 — no stamp could ever have been awarded

- [x] **T-145** ✅ **Nothing in the app ever started geofence monitoring.** `refreshGeofences`
      had exactly one caller: the debug screen. On a user's phone the sequence was install →
      grant permission → press record → walk to a miradouro → **collect nothing, for ever**,
      with a diary full of healthy-looking location batches and no error anywhere.
      — **Why nothing caught it.** Every part works and is tested: `geofenceManager`,
      `geofenceSelection`, the stamp rules, the content pack, and `index.ts` really does register
      the catalogue (T-040). The *seam* between "recording started" and "monitor these places"
      was never joined, and a seam is exactly what unit tests cannot see.
      — **Why the emulator never showed it either.** Every session that ever saw a geofence fire
      had started monitoring by hand from the debug screen — which registers the **synthetic
      fixture**, so the events carried `dev-near-*` ids. The dev tool was standing in for the
      missing wiring and hiding it at the same time.
      — **How it was found.** By trying to earn a stamp: a replayed route that arrives at Forte
      de São Tiago and stands there for four minutes awarded nothing, and the diary had no
      `geofence` line at all since the database was erased.
      — **The fix** is `recording/tripRecording.ts`: `startTrip`/`stopTrip` pair the two halves so
      they cannot be started separately again, and `ensureGeofencesIfRecording` re-registers on
      launch — ⚠ **Android drops every geofence when the phone reboots**, which would have been
      the same silent failure arriving a second way.
      — Notes: `docs/task-notes.md` (T-145)

### ⚠ Found 2026-08-14 — the trace was drawn across water it could not have crossed

- [x] **T-143** ✅ **The highlighted line was wrong, twice over, and the second one was ours.**
      The map joined two fixes 900 km apart into one straight stroke (now D-059), *and* the test
      route was 245 m out to sea. Both are fixed and both are pinned by tests.
      — Notes: `docs/task-notes.md` (T-143)

- [x] **T-144** ✅ **Passport categories swipe; "See all" expands one into the grid.**
      The project lead's instruction of 2026-08-14. Five wrapped grids of 80 places was one very
      long page; five strips is one and a half screens with the hero still on it.
      — Notes: `docs/task-notes.md` (T-144)

- [~] **T-051** 72-hour untouched-device soak test producing a continuous trace ⇠ T-047, T-048
      — **Set up 2026-09-22 on the Huawei P30; the clock has NOT started.** Two conditions are
      the project lead's to meet, and both are physical.
      — ⚠⚠ **The phone must be UNPLUGGED.** `dumpsys deviceidle` reports
      `mCharging=true mState=ACTIVE` for as long as the cable is in: **Doze never engages while
      charging**, and Doze is the single biggest threat to a background recorder. A soak on a
      charger tests almost nothing this task is about, and cannot answer T-054 at all.
      — ⚠ **It must be charged first** — it was at 30%, which will not survive 72 hours.
      — ⚠ **And untouched for three days**, which is the cost: it is a personal phone.
      — ✅ **adb over WiFi is enabled** (`adb tcpip 5555`, 192.168.1.136) so the soak can be read
      with the cable out. ⚠ It survives until the phone reboots, and it should be turned off
      afterwards.
      — ✅ **`tools/soak-check.sh`** is the read-only probe. It **never launches the app** —
      waking it resets the very OEM timers being measured — and it asks the **OS**, not the app,
      whether the recorder is alive, because T-174 is exactly the mistake of believing the app.
      — ⚠ **T-174 was blocking this and was invisible.** The recorder had been dead since
      28 August while the app reported it running; the soak would have produced 72 hours of
      nothing. Baseline now reads `recorder ALIVE`, verified against `dumpsys`.
      — ⚠ **T-048 is still `[~]`**, so gap annotation will not be automatic; the raw
      `raw_fix`/`recording_event` rows are the evidence either way.
- [ ] **T-052** iOS force-quit test — recording must resume ⇠ T-047
- [ ] **T-053** Aggressive-OEM Android test (Xiaomi / Samsung / Oppo) ⇠ T-045, T-046
- [ ] **T-054** Measure battery cost over a 12-hour day; target ≤5% ⇠ T-038
- [ ] **T-055** Verify zero network traffic attributable to recording ⇠ T-051
      — **Overlaps T-117b** (added 2026-08-11), which watches the *whole app* including FCM
      (D-043). Run them as one capture; this task is the recording-specific reading of it.

**Milestone M1 — "It remembers"** ⇠ T-051, T-052, T-053, T-054, T-055

---

## Phase 2 — Offline map rendering

> ### ⚠ Superseded as the shipping path, 2026-08-14 (D-057)
> The app draws **Google Maps on Android** now, and Apple Maps on iOS when there is an iOS build.
> Everything below was built, works, and is **kept rather than deleted** at the project lead's
> instruction — `app/src/map/MapLibreScreen.tsx` and the whole `tiles/` pipeline. It is the answer
> if offline, privacy or the dark souvenir style ever outranks looking native.
>
> **What this means for the tasks below:** T-056–T-062 and T-139/T-140 stay done. **T-063b is
> moot** (nothing fetches glyphs). **T-064** (recolour the real graph) and **T-065** (outdoor
> sunlight legibility) no longer gate v1 — they judge a renderer that is not shipping — but T-065's
> *question* survives in a new form: is **Google's** map legible in Funchal at midday?

- [x] **T-056** Integrate MapLibre GL Native ⇠ T-029, T-025
      — Notes: `docs/task-notes.md` (T-056)
- [x] **T-057** Bundle or WiFi-gated first-run download of the tile pack ⇠ T-026, T-056
      — Notes: `docs/task-notes.md` (T-057)
- [x] **T-058** Author the **light** base style — the everyday in-app map (D-026). Start from an
      existing permissively-licensed style (Protomaps basemap theme, or CARTO Positron over an
      OpenMapTiles-schema build) and **subtract**: strip labels, mute roads, quiet the water and
      landcover so the trace can dominate. **Do not author from a blank file.** Verify the
      starting style's licence. Minimal labels — city names and major cultural landmarks only.
      ⇠ T-056
      — Notes: `docs/task-notes.md` (T-058)
- [x] **T-058a** Add **shaded terrain** as the figure-ground element instead of building
      footprints (D-026). Madeira's relief is the island's defining feature and OSM building
      coverage is patchy outside Funchal. Record the tile-size cost against T-026. ⇠ T-058, T-023
      — Notes: `docs/task-notes.md` (T-058a)
- [x] **T-059** **v1: draw the recorded raw trace** as a line layer from `raw_fix` (D-032) —
      not matched segments. Simplify for rendering; keep the stored fixes untouched (D-010).
      ⇠ T-058, T-030
      — Notes: `docs/task-notes.md` (T-059)
- [x] **T-060** Accessibility styling pass **in both styles** (D-015, D-026) ⇠ T-059, T-139
      — Notes: `docs/task-notes.md` (T-060)
- [x] **T-061** Respect system font scaling for all map labels ⇠ T-058
      — Notes: `docs/task-notes.md` (T-061)
- [x] **T-062** Camera defaults and sensible pan/zoom bounds ⇠ T-056
      — Notes: `docs/task-notes.md` (T-062)
- [~] **T-063** Verify cold start renders fully in airplane mode ⇠ T-057
      — Notes: `docs/task-notes.md` (T-063)
- [~] **T-063a** Decide what to do about the four unbundled glyph ranges ⇠ T-063
      — Notes: `docs/task-notes.md` (T-063a)
- [ ] **T-063b** One glyph range is still requested, and the pack carries names in nine scripts
      ⇠ T-063a
      — **Still failing:** `65024-65279 for font stack Noto Sans Medium` (U+FE00–FEFF), twice per
      cold start. **No visible label is broken.** Proved data-dependent, not a renderer quirk: with
      `text-field` replaced by a literal string the request disappears entirely. Which name
      triggers it is *not* identified — a full MVT decode of every `places` string value found
      nothing in that range, so the two facts do not yet reconcile. **Do not guess; the literal
      test is the tool that works.**
      — **The better fix, which removes the cause instead of the symptom:** strip the non-Portuguese
      `name:*` and `pgf:name:*` properties in the tile build. The app is English-only (CONTEXT §1)
      and labels are Portuguese, so nine other scripts are bytes and glyph requests bought for
      nothing — against a 19.1 MB budget (D-035/D-036). That is a `tiles/pipeline` change and needs
      a pack rebuild, which is why it is not done here.
      — Re-check with: `adb logcat -d | grep "glyph range"`.
- [x] ~~**T-063a** original framing~~ — kept below because the reasoning is what stopped the
      expensive reflex:
      — Notes: `docs/task-notes.md` (T-063a)
- [ ] **T-064** Performance test: recolour **the real graph**, not a sample ⇠ T-059
      — **Target corrected 2026-08-08 (T-028).** The old "5,000+ segments" figure was an order of
      magnitude low: Madeira has **~51,000 highway ways** before splitting at intersections. Test
      against the actual island. If T-025a is adopted, all of them render every frame.
- [ ] **T-065** Outdoor sunlight legibility test — **in Funchal, at midday, held at arm's
      length.** This is the test that decides whether D-026's light-for-use choice was right.
      Run it against both styles. ⇠ T-060
- [x] **T-139** Author the **dark** style variant for the souvenir renderer (D-026) — the
      fog-of-war look: dark ground, unvisited legible mid-grey, visited bright and heavy. Shares
      the same tile pack as T-058. Also offered as a user preference (T-140). ⇠ T-058
      — Notes: `docs/task-notes.md` (T-139)
- [x] **T-140** Light/dark preference in settings (D-026). Defaults to light for in-app use;
      the souvenir always renders dark regardless of this setting. ⇠ T-139, T-141
      — Notes: `docs/task-notes.md` (T-140)

**Milestone M2 — "It looks like Madeira"** ⇠ T-063, T-064, T-065

---

## Phase 3 — Stamps, geofences and regions

### Content curation

- [~] **T-066** Curate **~80 POIs (target band 60–100, D-049)** on **Madeira only** — hand-verified. Porto Santo POI
      curation is explicitly deferred (D-021) — do not spend effort on it. ⇠ T-015, T-016d
      — ⚠ **A starter set of 80 exists as of 2026-08-14, and it is not this task.** The project
      lead asked for it twice; selection was by prominence and coverage, so the app can be used
      and looked at. **The hand-verification this task is actually about has not happened for a
      single place.** `content/README.md` says how to redo it and what the traps are.
      — What the starter set did prove: the passport at 80 is legible, the artwork survives real
      Portuguese names, and 12 of 80 names are too long for the sticker band (they end in an
      ellipsis; the card carries the full name).
      — **Every place must be assigned exactly one of the five categories** (D-027):
      **Viewpoints · Levadas · Villages · Beaches · Landmarks**. There is deliberately no
      "Other" — if a place fits nowhere, that is a signal about the place, not a missing row.
      — Each place also carries a `region_id`, used by the map screen rather than the passport.
      — Categories live in the content pack, never in `app/` (D-017).
      — **This is selection, not research** (T-028): OSM already offers 569 `tourism=viewpoint`
      nodes, 180 peaks and 79 settlements in the bbox — far more candidates than the 150–250
      target. The work is hand-verification and editorial judgement, which is the one thing a
      global competitor cannot buy (CONTEXT §5a).
      — **Unblocked 2026-08-10 (T-040).** The file to fill in is `content/pois.json`; the format,
      the levada two-geofence rule and the guidance on choosing radii are in
      `content/README.md`; `node tools/validate-content.mjs` checks the work and reports
      progress against the target. Nothing else is waiting on anything.
      — **Made cheaper 2026-08-12: `node tools/poi-candidates.mjs`.** The task always said this
      was *selection, not research* — but there was nothing to select *from*, so it was a blank
      file and a coordinate lookup per place. The tool reads the tile pack already in the repo
      (no download, no new dependency) and writes **~390 candidates** to
      `content/pois.candidates.json`: name, coordinates, suggested category, suggested radius,
      region. Ordered by OSM's `min_zoom` prominence so the ones most likely to matter are first.
      **The work is now deleting, which is a thing a person can finish.**
      — ⚠ **It does not curate and must not** — everything in it is a name, a coordinate and a
      lookup table. It leaves levadas alone (they need a start *and* an end, D-009 — the 33 named
      trailheads are listed separately) and departure points alone (worth getting right by hand).
      — Two mistakes it made on the way, both caught by measuring the output: ranking across
      categories on one scale produced **397 villages, three landmarks and no viewpoints**, and
      deduping on rounded coordinates left pairs "0 m apart" that the validator flagged. Ranking
      is now per-category and dedupe is by name plus 150 m.
- [x] **T-099a** Departure points defined in `content/pois.json` (D-012) — Madeira Airport,
      Porto Santo Airport, Funchal ferry terminal, coordinates from OSM. The validator had been
      warning that **no trip could ever end at an airport**, which is the primary trigger for the
      one moment D-012 calls the best in the product.
      — Notes: `docs/task-notes.md` (T-099)

- [x] **T-067** ✅ **Region boundaries, 2026-08-16 — and a third of the pack was in the wrong
      one.** `tools/build-regions.mjs` fetches Madeira's eleven municipalities from OSM
      (`admin_level=7`) into `content/regions.json`, and `--assign` derives each place's
      `regionId` from the polygon it stands in. Decision: **D-061**.
      — ⚠ **`.json`, not the `.geojson` this task asked for.** The contents are GeoJSON; the
      extension is what Metro and TypeScript resolve without a bundler config, which is the same
      reason `levadas.json` has it.
      — **46 of 80 places were misfiled, and nothing could see it**: 27 sat in a region called
      `madeira` — the island had ranked as a settlement in `poi-candidates.mjs`'s nearest-anchor
      heuristic — and 19 more were in a neighbouring municipality. `byRegion` has been computed
      since T-073 and displayed nowhere, so the numbers were never looked at.
      — The card names the municipality on a line under the place's name. That is the whole of
      the UI: a region strip over the map is a T-112 question, not this task's.
      — ⚠ **It went on the status line first, and the workbench said no.** "LEVADA WALK · CÂMARA
      DE LOBOS · COLLECTED" needs 347 px of the 324 the card has at 390 px wide, so the worst
      realistic case wrapped into two lines of tracked capitals above the name — invisible until
      a levada in the longest-named municipality is collected. Measured, not eyeballed (D-038).
      — ⚠ **Two stamps could never have been earned, and both are fixed.** The validator checks
      each place against the boundaries and found Cabo Girão **525 m out to sea** and the Rocha
      do Navio reserve **1.4 km** out. The project lead asked for the coordinates to be corrected
      (2026-08-16), so they were, from OSM: the Cabo Girão skywalk and the Rocha do Navio
      clifftop viewpoint. ⚠ The reserve's old coordinate was its **own centre** — a marine
      reserve has none on land — which leaves its *name* describing the reserve and its stamp
      describing the viewpoint. Curation question, deliberately not answered here.
      — **The generator was fixed too, so the defect cannot come back.**
      `poi-candidates.mjs` derived its region from the nearest settlement; it now asks the
      boundaries, and leaves the field **empty** rather than guessing when nothing contains the
      candidate. Re-run: exactly six of 200 come out empty, and **all six are marine protected
      areas** whose OSM point is the water — the class of feature both bad coordinates came from.
      The tool now prints them as a warning.
      — **`tools/check-names.mjs` (new) checks every curated name against OSM**, which HANDOFF
      lists as one of the two traps that cost a session. Result on the starter set: **63 exact,
      0 fragments** of the 65 non-levada places — the villages, beaches and landmarks turned out
      to be OSM's own names, so the fragment problem really was confined to the viewpoints that
      were rebuilt on 2026-08-14. Levadas are skipped for a reason written into the tool: a way's
      *centre* is kilometres from its trailhead, and `build-levadas.mjs` already checks their
      names exactly.
      — ⚠ **What it found instead was a duplicate: `Cabo Girão` and `Monumento Natural do Cabo
      Girão`, 745 m apart** — the cliff and its protected-area designation, curated as two
      landmarks, the second sitting at an administrative centroid with nothing named within
      400 m. The validator now warns on it (same category · one name inside the other · under
      1 km). **Resolved the same day: the project lead kept the skywalk and deleted the
      designation**, so the pack is 79 places — 21 viewpoints, 15 levadas, 16 villages, 11
      beaches, 16 landmarks.
      — **Verified on the emulator 2026-08-16**, not only in tests: the Android bundle resolves
      `content/regions.json` (1044 modules), carries every region name, and the card on the device
      reads **VIEWPOINT · Pico do Areeiro · Santana**. Which is also the assignment being right —
      the old guess said Estreito de Câmara de Lobos, and the peak is in Santana.
      — Notes: `docs/task-notes.md` (T-067)
- [x] **T-066a** ✅ **The curation draft, applied 2026-08-16 (D-064).** The project lead took it
      as drafted with one correction — *Praia da Prainha* is not a name anybody uses, so the place
      is **Prainha** — and said plainly of the rest: *"I don't have any idea to be fair."* Which is
      an answer: where there is no local knowledge to overrule the evidence, the evidence stands.
      — **79 → 60 places**: 16 viewpoints · 11 levadas · 16 villages · 7 beaches · 10 landmarks.
      Twenty-two cut, three renamed or corrected, and ten added — including **Pico Ruivo**, the
      island's highest point, which had never been in the pack.
      — ⚠ **Every check passes**: names verified against OSM (48 exact, 0 fragments), every place
      inside the region it claims, nothing offshore, no duplicates, 11 of 11 levadas with a drawn
      course.
      — ⚠ **The riskiest entries are the two kept on no evidence at all** — *Achada do Marques*
      and *Chão da Ribeira* — and one cut for the same reason, *Parque Ecológico do Funchal*,
      which I believe burned. Those three are where this pack is most likely to be wrong.
      — Notes: `docs/curation-draft.md` is the sheet as proposed. ⇠ T-066, D-064
- [x] **T-066b** ✅ **Seven more levadas, 2026-09-22 (D-078) — 11 → 18, 67 places.** Drafted on
      the official PR network and applied as drafted: *Risco* (PR 6.1), *Alecrim* (PR 6.2),
      *Moinho* (PR 7), *Fajã do Rodrigues* (PR 16), *Barreiro* (PR 4), *Tornos* and *Caniçal*.
      Sheet: `docs/curation-draft-levadas.md`.
      — **Courses come from the route relation, not the name** (`COURSE_FROM_ROUTE` in
      `build-levadas.mjs`): *Levada do Moinho* names two levadas 20 km apart, and Risco and
      Barreiro carry 1 km and 0.1 km of named path on 3 km and 5 km routes. The eleven older
      courses were left on name matching and rebuilt **byte-identical**.
      — **A levada may have more than one `start`** — `judgeLevada` has always taken a set. The
      project lead said PR 6.2's start is ambiguous, so Alecrim starts at the ER 105 car park *or*
      where the route meets the road down to Casa do Rabaçal, and Risco at the car park *or* Casa
      do Rabaçal (the shuttle stop). The validator's *"0 m apart"* warning on the shared car park
      is expected: two walks, one car park.
      — ⚠ **Found on the way:** I had PR 16's ends backwards; the region check caught it (the far
      end is across the ridge in Porto Moniz). **PR 23 Levada da Azenha is `access=no` in OSM** —
      closed, so not added. Fajã do Rodrigues is believed to close often for rockfall — check
      before a release.
- [x] **T-181** ✅ **The passport button is a stamp, 2026-09-22 (D-083).** Your latest *visible*
      stamp with a metal-and-hairline rank rim, no count. `passport/passportButton.ts` chooses
      the stamp through `visibleStamps`, so a locked stamp never reaches the map screen;
      `passport/stampRim.ts` draws the rim in both renderers. `StampMark.tsx` deleted — nothing
      in the app draws the seal any more.
      — **Seen in the workbench, not on a phone.** 84 dp box, the tilted stamp 81 dp inside it,
      rim strokes in the DOM in the right order. `react-native-svg` on Android is unverified for
      `strokeLinejoin` and a padded viewBox.
      — ✅ The grey placeholder's edge measured 2.63:1 on the night map; on the project lead's yes it
      now gets a thin light edge there (`mapChrome.dark.border`, 4.10:1), and a test holds it.
- [x] **T-066c** ✅ **Fourteen more places and one cut, 2026-09-22 (D-078) — 67 → 80.** Applied
      as drafted: Eira do Serrado, Boca da Encumeada, Véu da Noiva, Ilhéus da Ribeira da Janela ·
      Porto da Cruz, Jardim do Mar, Paul do Mar · Fajã dos Padres · Jardim Botânico, Sé do
      Funchal, Mercado dos Lavradores, Farol da Ponta do Pargo, Museu CR7, Teleférico das Achadas
      da Cruz. Sheet: `docs/curation-draft-others.md`.
      — **Why the list could grow at all:** August's candidates came from the tile pack's labels,
      which never held the Botanical Garden, the Sé or the market. This one queried OSM directly
      and dropped anything inside an existing stamp's circle.
      — **Encumeada Baixa cut** by the project lead. August kept it as *"the pass where the two
      coasts meet"* — that is Boca da Encumeada, 8.7 km away; the reason was mine and wrong.
      — **The two lifts are stamped at the bottom station** at 100 m, 330–470 m from the top, so
      standing in the car park does not earn them. The Sé, the market, CR7 and the Teatro are
      330–420 m apart, so all four are 120 m (the Teatro was 200).
      — ⚠ **Still open: Pico Guindaste** may be 470 m from the miradouro people visit — OSM has two
      *Guindaste* viewpoints east of it. Unanswered. `check-names` flags *Jardim Botânico da
      Madeira* as short for OSM's full name; kept, because it is what is signed.
- [ ] **T-067a** Porto Santo lock/unlock gate (D-024): hidden from map, region list and UI
      until an island-level geofence fires; unlock is permanent. **The stamp denominator must
      count unlocked regions only**, or the headline number breaks. ⇠ T-039, T-067, T-073
      — **The data half is done (T-067).** Every region in `content/regions.json` carries its
      `islandId`, and `regionPack.ts` parses it: Porto Santo is `porto-santo`, everything else is
      `ilha-da-madeira`. What is missing is the gate — the island-level geofence, the persisted
      unlock, and passing `lockedRegionIds` into `computeTripProgress`, which has taken that
      argument since T-073 and has never been given a non-empty set.
- [x] **T-068a** **Coverage crediting and the second detector, 2026-08-16 (D-065).** A levada is
      credited by how much of its drawn course was walked — **60% of it, or 3 km, whichever comes
      first** — and every other place gains a **second, independent detector** that reads the raw
      trace when the OS geofence never fired. `levadaCoverage.ts` and `arrivalFromTrace.ts`, both
      pure, 23 tests, wired into `runAwardPass` so all four of its callers get them.
      — **Why it matters more than it sounds:** the entire reward rested on the OS delivering a
      geofence callback — which battery saver, Doze, OEM killers and laurel canopy all interfere
      with, and which T-145 proved can be absent altogether without a single test noticing.
      — **What it fixes for the walker:** out-and-back walks (which is how most levadas are done,
      and which could never earn a stamp before), skipped sections, and a lost crossing.
      — ⚠ **Every threshold is a guess and marked NOT TUNED.** The corridor — 60 m, widened by
      whatever accuracy a fix admits to — is the one most likely to be wrong.
      — `tools/levada-ends.mjs` (new) proposes endpoints from signed guideposts, roads and bus
      stops near each path end.
      — ⚠ **AND THE ENDPOINT HUNT IS CLOSED, 2026-08-16.** The project lead answered the review
      sheet by rejecting its premise: *"where you park the car is not part of the levada… those
      parks are full and people leave in the middle of the road, illegally parked."* A mapped car
      park is evidence that somebody expected walkers, not evidence of where they begin — so the
      tool's strongest signal was its weakest, and it is re-weighted towards guideposts.
      **The endpoints stay as they are.** All eleven pairs span 31–56% of their course, so none is
      the dangerous shape — two points close together on a long walk, a stamp earned by parking
      and turning round. Coverage does the work now, which is what D-065 was for.
- [x] **T-151** ✅ **The accuracy filter and the break rule, 2026-08-16 (D-067).**
      — **The 120 m cut was a veto and is now a preference.** Under canopy every fix can be worse
      than 120 m, and the flat rule drew **nothing at all** for the stretch — a levada walk
      appearing as a hole in the trace, which is the opposite of what D-009 asks for. A poor fix is
      now dropped only when a better one covers the same two minutes; past 500 m nothing is drawn,
      because a fix that vague is not evidence of a position.
      — ⚠ **A break rule was written and then removed, and the removal is the finding.** Twenty
      quiet minutes covering 20 km are drawn as a straight stroke over mountains nobody crossed —
      but two existing tests state on purpose that such a bridge *should* be drawn, because both
      its ends are observed and only its shape is unknown. Overturning that is the project lead's
      call, not a threshold change. **The open option: draw long sparse bridges dashed** — honest
      about the shape without deleting the journey. Written into `traceGeoJson.ts` where the rule
      would have gone. ⇠ T-150, D-059
- [x] **T-150** ✅ **The drawn trace, cleaned — 2026-08-16 (D-066).** The project lead asked for
      the accuracy and reliability of *"the highlighted path of where you've been"*. Three things
      got through every existing filter and were what made it look wrong: **spikes** the accuracy
      gate cannot see (a fix 150 m off reporting ±12 m), **scribble** where somebody stood still,
      and **jitter** that made a straight walk measurably longer than it was.
      — **Measured on a modelled walk**: drawn length 4.49 km → 2.55 km for a 2.23 km route, worst
      excursion **151 m → 20 m**, mean 13.9 m → 6.3 m. Noise roughly doubles the apparent distance
      walked, and this gives most of it back.
      — **The rule: cleaning only ever removes.** Every surviving point is a position the device
      reported — no averaging, no snapping, no interpolation. A wobbly line is approximate and
      visibly so; a smoothed one is confidently wrong, which is worse.
      — ⚠ **Two bugs, both caught by tests, both written into the module**: bad fixes arrive in
      **bursts** and vouch for each other (the rule is now a median vote of the four fixes either
      side); and a fix's neighbourhood **must not cross a silence**, or the last fix before dinner
      is judged against fixes 15 km away.
      — **`tools/preview-trace.mjs` and `tools/lib/png.mjs` (new).** There was no way to look at
      geometry without a device — no image library, no displayed browser — so the project now
      writes its own PNG. Same argument as the stamps' second renderer.
      — ⚠ **Every threshold is a guess against modelled noise.** `tools/fixtures/` is empty until
      T-018. The simplification tolerance (16 m) is the first to revisit: the sweep says accuracy
      barely moves between 8 m and 40 m, and it **cannot see** the thing that would be lost — a
      real switchback, which this island's paths are made of. ⇠ T-059, D-059
- [x] **T-152** ✅ **Google's POI pins off the light map, 2026-08-17 (T-112, D-032).**
      The light map shipped with **no style at all**, so Google's whole POI layer drew — six
      saturated pins on one screen of Funchal. ⚠ **One of them was Forte de São Tiago, a place the
      user had collected**, drawn identically to five they had not: the app's achievement was
      indistinguishable from basemap clutter. `mapClutter.ts`, visibility rules only, and a test
      fails the build on any `color` styler — a recoloured basemap is the cartography obligation
      D-057 exists to avoid. Parks keep their geometry, road names stay, road icons go.
      — ⚠ **The night style had done this months earlier**, which is why nobody reviewing the dark
      map ever saw it.
- [x] **T-153** ✅ **The map now shows what you have earned, 2026-08-17 (T-112, D-058).**
      The hero said `1 / 60` and nothing on the map marked that one place. `collectedMarks.ts`
      draws **only collected** places, tappable into the same card the passport opens (D-052).
      — ⚠ **Not the layer D-052 deleted.** That was all ~80 places competing with the trace; this
      is 1–20 earned ones, and it is the reward rather than a directory.
      — The paint is `placeStyle.ts`'s existing measured `collected` state, written for MapLibre's
      point-sized circles and never wired to anything. The work was the unit bridge: `expo-maps`
      circles take **ground metres**, so the radius is recomputed from the live zoom via
      `onCameraMove`. Nothing below z10, where the dots read as speckle.
      — **Circles, not markers**: `icon` needs `SharedRefType<'image'>` and therefore `expo-image`,
      a dependency this app does not carry and would have to audit (D-043). Without an icon a
      marker is Google's default red pin — louder than the trace and somebody else's app.
- [x] **T-155** ✅ **The free tier, 2026-08-18.** ⇠ T-071, T-074 → T-156 owns the *unlock*
      — `entitlement/freeTier.ts` is the arithmetic (pure, 12 tests): first ten earned, plus the
      first levada whenever it arrives, at most eleven. ⚠ **D-089 (2026-09-25) moves the allowance to
      five**: at most six, still with the first levada. `entitlement/entitlementStore.ts` is the
      one flag it reads, and **nothing sets it yet** — T-156 puts Play Billing behind it. The
      passport applies the result in exactly one place, after the award pass has already run.
      — **"The user's own choice of which ten" resolved as: the first ten they earn.** The other
      reading — the app asks them to nominate ten out of their own holiday — is a worse screen
      than any paywall, and the app picking ten favoured *places* would be worse still.
      — ⚠ **The gate is a display and the build now enforces it.** `freeTier.test.ts` fails if
      `geofenceSelection`, `geofenceManager`, `stampAwards`, `stampRules` or `stampConfirmation`
      so much as imports `entitlement/`. That is the cheapest defence against the T-145 shape the
      task warned about: gating the award side would break D-072's "buy later, get everything"
      promise with no crash and no failing assertion.
      — **D-075 (Provisional) is the judgement call this raised**: a locked stamp keeps the muted
      drawing but carries a padlock and says *"collected — unlock to see this stamp"*, rather than
      rendering as never-visited. The hero and the row counts still count what was **earned**.
      One boolean overrules it; the arithmetic does not change either way.
      — ⚠ **Nobody has looked at the padlock.** Geometry and colours are measured; appearance is
      not. Workbench scenario **"23 stamps — free tier (T-155)"**.
      — **The rules, and they are exact.** Recording, the trace and the souvenir still are free
      forever. **Ten stamps free**, the user's own choice of which. **The first levada stamp is
      always awarded and shown in addition to the ten**, whenever it happens, even at 10/10 — so the
      free tier is at most **eleven visible stamps, one guaranteed to be a levada**. €4.99
      unlocks the rest.
      — **Why the levada is guaranteed:** 16 of the 60 places are viewpoints, many roadside, so a
      visitor could collect ten in one driving day and hit the paywall **having never walked a
      levada**. They would be paying on pressure rather than delight, judging a hiking app they
      never hiked with.
      — ⚠⚠ **DO NOT GATE THE GEOFENCE SET OR THE AWARD PASS. GATE ONLY THE DISPLAY.** D-072 promises
      that a user who buys later receives everything earned in the meantime, which is only true if
      the app keeps monitoring **all sixty** places and keeps **writing** awards while unpaid. The
      obvious optimisation — "why monitor 60 geofences for a user who can see 11?" — **breaks that
      promise silently**: no crash, no failing test, no error, and the user simply gets less than
      they paid for. **This is the T-145 shape.** Read T-145 before touching `geofenceSelection`,
      `stampAwards` or `runAwardPass` for performance.
      — **Pure/impure split as everywhere else:** the entitlement rule (how many are visible, and
      whether the levada exemption applies) is arithmetic and belongs in its own tested module. The
      billing wrapper sits beside it.
      — ⚠ **Numbers are guesses.** Ten and €4.99 are the same class as D-068's 45 minutes: set by
      argument, tunable against real trips (T-134), never to be defended as measured.
- [ ] **T-156** **Play Billing, and the privacy claim it costs** ⇠ T-155, T-117
      — **D-089 (2026-09-25):** one non-consumable at **€5.99**, *all of Madeira, forever*; Play's
      regional conversions. The purchase time on Google's record also decides the **founder stamp**
      (first 3 months after the public launch), so it must survive restore.
      — **D-091 (2026-09-25): `expo-iap`, pinned to one version; RevenueCat rejected.** Its tests must
      prove: `finishTransaction` after granting (or Google refunds in 3 days), *pending* never
      unlocks, offline says *unlock later* and a stored unlock holds, purchases queried at launch
      and resume, restore brings back the purchase time.
      — **The project lead's step:** a **payments profile** in Play Console (bank and tax details)
      before any purchase can be tested, and license testers for free test purchases.
      — A single non-consumable product. StoreKit 2 can validate on-device via JWS with no server of
      ours, but **Play's `queryPurchasesAsync` makes a network call when its cache expires**.
      — ⚠ **This is the first time the app talks to the network on its own account.** It does **not**
      break *"we collect nothing"* — no data of ours leaves the device — but it **does** break
      *"this app makes no network requests"*, which is the stronger claim and the one written into
      `docs/store-privacy-answers.md`, D-044 and the Data Safety form.
      — **Required before shipping it:** re-run D-043's network audit against the billing library,
      and reword the privacy copy to *"nothing leaves your phone except a purchase you started"*.
      **T-117b and T-127 must be restated**, not quietly failed.
      — Restore-purchases must work offline after first sync, because the user is in a levada valley.
- [ ] **T-157** **Say what is waiting, once** ⇠ T-155
      — A free user at the cap may have **earned more than they can see** — 18 collected, 11 shown.
      Saying nothing is honest but wastes the best unlock moment; saying it repeatedly is the nagging
      the project lead explicitly did not want.
      — **Leaning: state it once, quietly, on the passport.** Never a notification — **D-011's cap of
      two per trip is already spent** — and never a repeating banner, which is the failure design
      brief §3 watches for in the reference app. **Not settled.**
      — **⚠ Mostly answered by D-075 (2026-08-18), not by a sentence.** The locked stamps *are*
      the statement: eighteen collected shows as eleven drawings and seven padlocks, continuously,
      with no banner, no notification and no counter. What is left of this task is the small
      question — should a **line of prose** say it as well — and the answer is probably no, since
      the padlocks already say it and prose would be the nagging the project lead ruled out.
- [~] **T-158** **Make the stamps worth buying — the rank is in (D-078), the artwork is next.**
      — ✅ **`passport/stampTier.ts`** (pure, 13 tests): bronze/silver/gold/platinum by **how many**
      places you have, never by which ones. Thresholds 1 / 10 / 25 / all. **The passport button now
      wears the rank** — it was always drawn as a stamp, and now it is the stamp you earned.
      — ⚠ **The project lead replaced my design and theirs is better.** I proposed rarity *per
      place*, which **ranks places** — precisely what killed the "stars" proposal that stamps
      replaced. A rank by quantity ranks the journey and leaves every place worth the same.
      — ⚠ **I also cited a rule that does not exist**: the design brief says nothing against
      gamification, and the decision that rejected "badges" did so *because stamps are inherently
      collectible*. Corrected in D-078.
      — ⚠ **A failing test moved the metal from the mark to the button and improved the design.**
      Metals are pale; none survives on the action blue (silver 1.29:1, platinum 1.15:1). The
      button *is* the stamp, so the metal is the fill.
      — ⚠ **Nobody has looked at the metals.** `node tools/preview-stamps.mjs` draws all five ranks
      at real size. Does bronze read as bronze or as brown? Is platinum *colder* than silver?
      — ✅ **Motifs built (D-079), 2026-08-19.** `passport/stampMotif.ts` — eleven generic glyphs
      (`peak`, `cliff`, `waterfall`, `forest`, `tunnel`, `harbour`, `lighthouse`, `fort`,
      `terrace`, `cableCar`, `blackSand`), 11 tests. A place names one in `content/pois.json` and
      the stamp draws it instead of the category emblem.
      — ⚠⚠ **D-017 decided the architecture:** glyphs generic and in `app/`, the *assignment* in
      `content/`. **A test fails the build if an islandish word reaches a motif id** — including
      `levada`, which looks ordinary here and is a Madeiran word for a Madeiran thing.
      — ⚠ **The part to argue with:** a motif *replaces* the category emblem, so D-015's category
      signal moves to the passport's five fixed rows (D-027). That holds only while stickers live
      inside the passport; if one ever stands alone, the motif should become a second smaller mark.
      — ⚠ **Nobody has looked at the eleven glyphs.** `node tools/preview-stamps.mjs` draws them
      on a real sticker at one fixed place id. Does the cliff read as a cliff or as a wall?
      — ⚠⚠ **THE RANK MEDAL IS MID-DESIGN AND THE ARTWORK IS NOT SETTLED.** Four rounds so far,
      all in `tools/preview-rank.mjs` → `tools/out/rank.html`. **Nothing has been promoted into
      `app/` yet** — `TIER_METAL` there is still five flat fills and is the *old* answer.
      **1.** Five flat pills changing hue. Project lead: *"não passa um feeling de premium ou de
      raridade"*. Correct — I changed hue and nothing else, when what makes metal read as metal is
      how it handles light.
      **2.** Four directions drawn (medallion / wax seal / enamel pin / trophy plate) with real
      bevel, specular and an engraved number. **They chose the wax seal**, and were surprised to.
      **3.** The seal developed with more ornament. Project lead: *"os pontos na volta e as linhas
      do centro para fora fazem parecer uma poker coin."* ⚠ **Exactly right, and both devices were
      mine** — borrowed from `stampArt.ts`'s own perforation and sunburst on sound reasoning. **A
      good rule applied without looking produced a casino chip.**
      **4.** Five sparse vocabularies with the ornament stripped out. Project lead preferred the
      chip one — *"não por parecer uma ficha de poker mas por parecer mais exclusiva e detalhada"*.
      ⚠⚠ **THE KEY NOTE OF THE WHOLE THREAD: I had collapsed two things into one.** Density is what
      felt premium; only the *grammar* was the chip. **Keep the density, change the rhythm.**
      — ✅ **Where it stands now (2026-08-19):** the dense seal is back with the two chip devices
      replaced — rim dots became an **overlapping twisted cord**, full-face spokes became a
      **starburst confined to the well with alternating ray lengths**. Verified: **zero rim dots,
      648 cord links, no SVG filters**. Drawn at 132/64/44 px, on dark, light and **green** (most
      of this island is laurel forest), plus **greyscale** — if ranks separate only by hue, a
      colour-blind user has one rank and everybody else has five.
      **5.** *"Try to make them more 3D. Ensure the higher the rank, more premium looking and
      boogie looking."* Depth came from **stepped bevels** — 1 to 5 concentric rings, each catching
      light at its own angle, which is what reads as a *turned edge*; a single rim with a gradient
      is a disc however good the gradient. Plus **two shadows** (wide drop + tight contact, which is
      what makes an object rest on something rather than float) and a **bounce-light arc on the
      side away from the key light** — the biggest single 3D tell in the drawing.
      — ⚠ **The escalation is structural, not chromatic**, in a table (`ESCALATION`): bevel count,
      cord, starburst, laurel, raised dome, cut facets, halo, sparkles. **Measured monotonic: 13 →
      14 → 65 → 86 → 141 drawn elements.** Doing it with colour would be five hues again, which
      already failed once — structure is what survives greyscale, 44 dp and colour blindness.
      **5.** *"Make them more 3D, higher rank more premium and boogie."* Stepped bevels, a raised
      dome, a halo, sparkles, and a structural escalation table. ⚠ **Rejected: *"I didn't like, was
      a downgrade."*** Reverted to round 4.
      — ⚠⚠ **WHY IT FAILED, AND IT IS THE USEFUL PART.** That pass mixed two different things:
      better **lighting** (contact shadow, bounce arc, per-rank falloff) and more **ornament**
      (bevel steps, dome, halo, sparkles). **The ornament was the downgrade** — it read as loud
      rather than as expensive, a medal wearing everything it owns at once. **The lighting was
      never the problem**, and discarding it along with the ornament would have been the same
      mistake in the other direction.
      **6.** The chosen edition refined with **the lighting and the material only, and no new shape
      at all**: an occlusion ring where the well meets the face, a machined lip at the rim, a
      second tighter shadow for contact, a bounce arc on the unlit side, a deeper press for the
      mark, and a **per-rank falloff** — platinum's face turns over like a mirror, bronze's like
      something matte, **same hues**. Measured: **exactly +4 elements per rank** (13→17, 35→39,
      51→55, 69→73, 98→102), and zero of round 5's machinery.
      — ✅ **`rank.html` now opens with a side-by-side**: chosen edition on top, refined below, at
      study size and at the real 64 dp. ⚠ **Judging a change against a description is how round 5
      slipped through**; judging it against the thing it replaces is harder to fool.
      **7.** ✅ **Ring and centre studies, 2026-08-19.** *"Show other designs for the ring and
      square inside the stamps."* **Seven rings** — twisted cord (control), chain links, guilloché,
      laurel wreath, milled edge, two hairlines, and nothing at all — and **six centres** —
      pressed in (control), standing proud, cut through, on a cartouche, with a keyline, and the
      number alone with no mark.
      — ⚠⚠ **ONE VARIABLE AT A TIME, and that is the lesson from round 5 applied.** Body, lighting,
      material and shadows are frozen across every row; only the piece under study changes. Round 5
      moved five things at once and had to be discarded whole rather than partly, which threw away
      the lighting along with the ornament.
      — Each row shows **gold, bronze and the real 64 dp button**: gold carries ornament without
      platinum's facets competing, and a ring that only works on the showy rank is not a ring.
      — ⚠ **`milled` is in there deliberately as the closest thing to the rejected chip**, so the
      difference can be *seen* rather than argued: reeding sits on the outer edge, is far finer,
      and is cut across the rim rather than dotted on the face. If it still reads as a token, that
      settles the question for good.
      — ⚠ **`bare` and `number` exist to test the assumption, not to be chosen.** No ring at all is
      the only way to know how much the ring contributes; the count alone is the only way to know
      whether the mark is even the most interesting thing to put in the middle.
      **8.** ⚠ **The six centres were one drawing with six surface treatments** — pressed, proud,
      cut through, on a cartouche, keylined — all the app's mark with the light moved around. The
      project lead asked for *different* centres and was right that those were not. Eight now, and
      they are different **things**: compass rose, a prow, contour rings, a walked path, Roman
      numeral, one star per rank, the mark filling the well, and the mark as control.
      — ⚠⚠ **THE OBVIOUS ONE IS FORBIDDEN, AND IT IS WORTH RECORDING WHY.** The island's silhouette
      is what a Madeira app would put in the middle of its medal. **D-017 is absolute: no Madeira
      knowledge in `app/`**, and a coastline is island knowledge of the purest kind. It would have
      to be handed in from `content/` — which for a *rank* medal, shown before anything has been
      collected, makes no sense anyway. **Out by rule, not by taste.** Everything drawn would be as
      correct for the Azores.
      — **The prow is the one exception that costs nothing:** it is the app's own *name*
      (`brand.ts`), not its geography. A name is ours; a coastline is the island's.
      — ⚠ **`numeral` and `stars` change with the rank**, so the bronze column shows a different
      glyph on purpose. Stars are the most legible rank signal there is — you can *count* them —
      and the most gamey; drawn so the trade can be looked at rather than assumed.
      **9.** ⚠ *"All of those new are a bit weak. Try exploring Madeira typical houses silhouette."*
      **They were weak, and the diagnosis is reusable: the second pass was mostly line work** —
      contours, a trace, a compass, all thin strokes and open shapes. **A medal centre is read at
      64 dp on a moving map, and at that size a stroke is a smudge.** What survives is **mass**: a
      solid silhouette with weight and one clear outline. Seven new centres, all filled shapes —
      gabled cottages, one cottage filling the well, terraces, a peak above cloud, a boot sole, a
      laurel leaf, an anchor.
      — ⚠⚠ **THE HOUSES AND D-017.** A *Santana palheiro* is island knowledge and may not live in
      `app/`. **A steep-gabled cottage is a building typology, not a fact about an island** — which
      is precisely why `stampArt.ts` has always been able to draw *"a church tower and rooftops on
      a slope"* for the village category. What would break the rule is **naming** it Madeiran in
      `app/`, or shipping a coastline. Drawn on that basis, and the reasoning is recorded so nobody
      has to re-derive whether it was allowed.
      — ⚠ **BUT IT PROBABLY BELONGS SOMEWHERE ELSE.** D-079 built per-place motifs whose assignment
      lives in `content/`. **A gabled house is a far stronger village *motif* than it is a rank
      medal**: there the content decides which villages have earned it, the island knowledge stays
      where it belongs, and the rank medal stays about the rank. **Worth settling before anything
      is promoted.**
      **10.** *"I want the center to buy the typical Madeira / Portuguese cross."* Five versions of
      the **Cruz de Cristo** — the Order of Christ cross, painted on the sails of the caravels:
      two-tone with the plain cross inset, solid silhouette, cut through, **on a sail**, and ringed.
      — ⚠⚠ **IT BINDS THE PRODUCT TO PORTUGAL, AND THAT IS A REAL COST WORTH RECORDING.** It puts no
      Madeira *fact* into `app/`, so D-017 is not literally broken — it is national iconography, not
      island geography. **But D-017 exists so this app could ship for another island by swapping
      `content/`**, and a Portuguese cross on the rank medal would have to be removed to do that
      where a cottage or an anchor would not. **The project lead's call, taken knowingly**, and
      written here so that when somebody later asks *"why is there a cross in the chrome?"* the
      answer exists rather than being re-litigated.
      — ⚠ The symbol is centuries old and freely used. **There is no rights question, only a
      positioning one.**
      — ⚠ **The inner cross is the first thing to vanish when the medal gets small**, and two tones
      are the whole of what makes it *that* cross rather than any cross — which is why the solid
      version is drawn beside it and why the 64 dp column is the one that decides.
      — **`crossSail` is the most specific to this app of anything drawn in ten rounds:** a
      caravel's sail carrying the cross, for an app named after the prow of the same ship.
      **11.** *"Mais relevo e detalhe. Quero a cruz maior a utilizar o stamp todo e o número de
      23/60 em baixo, fora da medalha."* ⚠⚠ **Two structural changes, not a bigger glyph.**
      **(a) The well is gone** — a cross filling the seal cannot sit inside a pressed well, because
      the well's edge would cut across its arms. The face now runs to the cord and the cross is
      struck straight onto it. **(b) The count left the medal**, which frees the whole face and
      turns the button from *a pill containing an icon and text* into **an object with a caption**.
      — ⚠ **The relief is facets, not a gradient.** A raised cross is a set of **planes**: each arm
      is split along its spine and each half shaded by which way it faces the light. That is what a
      struck cross does, and no amount of soft shading on a flat silhouette imitates it. Plus a
      raised keyline beneath the arms and the inner cross **engraved into** them rather than laid
      on top — so it reads as one object instead of two stacked ones.
      — ⚠⚠ **THIS CHANGES THE MAP BUTTON AND THAT IS NOT SETTLED.** `PrimaryOverlay` draws a
      **horizontal pill** with the mark and the count side by side. A medal with the count beneath
      it is a **stacked** control of a different shape, and **D-015's 60 dp tap floor then applies
      to the medal alone** — a caption is not a tap target. The passport button is also the only
      place the map screen shows progress at all, so the caption is load-bearing, not decoration.
      **Settle the button's shape before promoting any of this.**
      — Drawn with and without the inner cross, at study size, 64 dp and **44 dp**, plus on green.
      ⚠ The inner cross is the first thing to die when the medal shrinks, which is why the solid
      version with a centre boss is drawn beside it every time.
      **12.** The project lead sent **the flag of Madeira** and said the cross was too big and the
      wrong shape. Both true.
      — ⚠⚠ **THE FLANKS ARE CONCAVE, AND THAT IS THE WHOLE SHAPE.** What had been drawn was a plain
      **cross pattée** — straight-sided arms flaring to wide tips. The *Cruz de Cristo* has arms
      whose flanks **curve inward**. **A straight flare is any medieval cross; a concave flare is
      that one**, and that single difference is most of why the drawn version looked generic. Now
      built with the flank control point pulled *inside* the waist-to-tip line.
      — ⚠ **And it covered the rim.** Filling the whole seal threw away the bevel, the beading and
      the bounce light — every part of the medal that took rounds to get right. It now leaves a
      clear band of metal between the tips and the cord, and the rim reads again. **"Fills the
      stamp" and "keeps the medal" turned out to be in direct conflict, and the medal wins.**
      — ✅ **Added a `crossShapeCheck` in flat flag colours — red on yellow, white inner cross, no
      metal at all.** Facets and gold make it impossible to judge an *outline*; this is the only
      fair way to ask **"is this that cross?"** before dressing it up. ⚠ Worth keeping as a habit:
      judge silhouette flat, judge material in metal, never both at once.
      — The inner cross is plain, constant width, and **stops short of the tips** exactly as the
      flag's does — stopping short is what keeps the red visible at the ends.
      **13.** *"Make the cross more like a + sign, with more straight lines."* ⚠ **Rather than guess
      how much straighter, the whole scale is drawn — A to E**, from a plain `+` to the flag's
      cross, flat in flag colours and then on gold at study and 64 dp. **Pointing at one is faster
      and more exact than describing one**, and it turns a matter of taste into a number.
      — **Two parameters do all of it.** `flare` — how much wider the tip is than the waist, where
      `1.0` is a true `+` with parallel sides. `curve` — how far the flank bows inward, where `0`
      is a straight line. ⚠ At `flare: 1.0` the shape has **no flanks at all**: a `+` is two
      overlapping bars, twelve right angles and nothing else. Every step after that is a departure
      from the sign towards the heraldic cross.
      — ⚠ **The waist widens as the flare shrinks, deliberately.** A `+` built with a heraldic
      cross's waist is a spindly thing; holding the *tip* width roughly constant is what makes the
      five comparable rather than just five different sizes.
      — **My reading: C** — straight lines throughout with real flare — is the most likely answer
      to *"more like a + with straight lines"* without giving up being a cross at all. But it is
      one click on the page, so the guess costs nothing either way.
      **14.** *"Sinceramente isto está a parecer uma cruz religiosa ou dos cavaleiros lendários."*
      ⚠⚠ **Correct, and the fault was a proportion rather than the outline.** On the flag the white
      cross is **thick** and runs **almost to the tips** of the red one. Mine was thin and stopped
      short, which leaves the red dominating — **and a big red flared cross with a thin white line
      through it *is* a Templar cross. The white `+` is the only thing stopping it being one.**
      — **Two numbers changed and neither is the shape:** the inner cross roughly **doubles in
      thickness** and reaches **90%** of the red instead of 80%.
      — ✅ **The flag is now drawn beside the medal**, and beside the old proportion too — same
      outline in both, only the white cross differs, and the difference is the entire reading.
      ⚠ **Describing a proportion in prose is what produced four wrong versions.** Putting the real
      thing next to the drawn thing makes the error obvious in a second. **Compare against the
      source; do not argue about it** — same habit as the flat shape check, and it should survive
      into whatever gets promoted.
      **15.** *"Straight lines and at the end triangle shape."* ⚠⚠ **That sentence is the geometry,
      and it is not what any previous round drew.** Every version flared **continuously from the
      centre** — a cross pattée. **That is a Templar cross by construction**, and no amount of
      adjusting flare or curve was ever going to stop it being one. **Four rounds spent tuning the
      wrong parameter.**
      — **The flag's cross is three parts:** a **parallel-sided bar** from the centre for most of
      the arm, then the sides **step out on straight diagonals** — the triangular shoulders — then
      a **flat tip**. ⚠ **The bar is the whole point.** An arm that is a rectangle for two thirds
      of its length reads as a `+`; an arm that widens from the very centre reads as heraldic. Same
      tip width, same reach, completely different object.
      — ✅ `crossFlag()` takes a **`shoulder`** parameter — where along the arm the flare begins.
      At `1.0` there are no shoulders and it is a plain `+`; at `0` it is the cross pattée that was
      wrong all along. Drawn at 0.7 / 0.6 / 0.5 so the dial can be set by eye.
      — ⚠ **The lesson, and it is the same one three rounds running:** I kept adjusting *numbers*
      inside a construction that was itself wrong. **The user's description named the construction
      in eight words.** When a shape is not converging, stop tuning it and ask what it is built
      from.
      — ⚠ **NEXT ACTION: the project lead looks at `tools/out/rank.html` and says what survives.**
      Then, and only then, promote the chosen seal into a pure module beside `stampTier.ts` with a
      second renderer, and replace `TIER_METAL`'s flat fills.
      — ⚠ **No SVG filters, ever, in whatever is promoted.** `feGaussianBlur` is unreliable in
      `react-native-svg` on Android. Shadow is an offset copy, deboss is three passes, sheen is a
      gradient — that constraint is why these sketches are drawable by the app at all.
      — **Still to build:** the **per-place assignment** for all sixty (draft and veto, D-064); the
      **date** on the stamp; ~~**more levadas** now D-002 is loosened, with **PR numbers** as the
      spine~~ (T-066b); and **3D** later (`TIER_METAL.sheen` exists unused for exactly that).
- [x] **T-158-orig** *(superseded by the above)* Deferred by the project lead ⇠ T-155
      — All the revenue now rests on the passport being desirable. Their words: *"we'll need then to
      make the stamps appealing enough to bring more revenue. But lets leave that for the future."*
      — ⚠ **This is in tension with D-071**, which recorded that the map is the product and the stamp
      system is not top priority. Monetising the passport promotes it whether or not the priority
      list says so. **Revisit D-071 when this starts.**
- [x] **T-159** ✅ **DECIDED 2026-08-17: the timelapse video is FREE** ⇠ T-105b-v2, D-072
      — ⚠ **Superseded 2026-09-25 by D-089 rule 8**, before any video shipped, so nothing is taken
      away: the exported video stays free, with a **medium mark in the lower third and a 2 second
      "Made with Bruma" end card** (the name from `brand.ts`, D-092); paid gets the small mark and no end card. The in-app replay is
      never marked. Arrives with T-105b-v2, not in v1.
      — The project lead: *"The timelapse video is free, but in the future I might impose some
      limitation on it to make people buy."*
      — **This keeps D-013 intact.** The souvenir is the distribution strategy; charging for it
      would have throttled the growth engine to sell fuel, which is why Part 1 of the monetisation
      research rejected it.
      — ⚠⚠ **IF A LIMITATION IS ADDED LATER IT MUST BE ADDITIVE, NEVER SUBTRACTIVE.** Taking away
      something people already had is the rug pull D-072 is built to avoid, and it earns the worst
      reviews there are. Acceptable shapes: the free video keeps everything it has today and the
      paid tier adds something new — longer, higher resolution, no watermark, more styles.
      **Unacceptable:** shortening, watermarking or degrading the video people were already given.
      — ⚠ And whichever way it goes, **existing users keep what they had**. Grandfathering is not a
      courtesy here, it is the difference between a new product and a broken promise.

- [x] **T-105e** ✅ **The replay — and it is the map, played back (D-076).** ⇠ T-105a, OD-12
      — ⚠⚠ **REBUILT THE SAME DAY, on the project lead's instruction.** The first version drew the
      trace as white lines on a black rectangle; they looked at it and said *"it is supposed to
      have a map behind it to know where you've been… as if someone was screen-recording while you
      were walking."* They were right: a line with no coastline under it is any walk anywhere, and
      Madeira is the whole subject. **D-076** holds the reasoning.
      — **What survived the rewrite: everything except the drawing.** `composition.ts` plans,
      `frame.ts` says what is on screen at time *t*, `playback.ts` says what *t* is. `ReplayView`
      (SVG) was **deleted**; `replayMap.ts` (pure, 10 tests) turns the same frame into a camera,
      polylines and circles for `GoogleMaps.View`. That is the payoff for having made `frame.ts`
      about the film rather than about the picture.
      — **It composes the map's own modules** — `cameraFit`, `traceStyle`, `collectedMarks`,
      `darkMode`, the style preference — so the replay's trace is the same blue at the same width
      as the everyday map's, and follows it if either changes. A test fails if it stops being.
      — ✅ **THE CAMERA THRESHOLD IS GONE, not tuned — the project lead asked for it solved.**
      The first version interpolated the camera every frame, found that reassigning a native map
      camera 30 times a second restarts its animation and stutters, and then throttled its own
      interpolation with a constant nobody could judge without hardware. **Interpolating was the
      mistake.** `expo-maps` exposes `setCameraPosition({ …, duration })` — the map eases itself —
      and `composition.ts` has emitted camera **keyframes** since T-105a, described in its own
      words as *"a camera target; the renderer eases from one to the next"*. So the renderer stops
      easing: `cameraPlan` hands each keyframe over with the gap to the next as its duration.
      **Seven instructions for a ten-second film instead of 309, and not one tunable number left.**
      — **Two bugs the rewrite exposed, neither visible to any test that existed:**
      **(1) A flinch on the last second.** The draw's final keyframe lands at the exact instant the
      finale starts, so the camera snapped to a close-up and then eased out to the whole trip.
      Same-instant instructions are now collapsed to the last one.
      **(2) ⚠⚠ THE CAMERA NEVER MOVED AT ALL.** Measured, not guessed: **zero metres** across every
      keyframe on both fixture routes. The window was counted in *fixes*, and the trace reaching
      `composition.ts` is the **cleaned** one (D-066) — a straight 2.2 km seafront walk arrives as
      **five vertices** with its full 2226 m intact, so *"15% of the fixes, at least 8"* covered the
      whole walk six times over and the film was a static shot. **A vertex count is a property of
      the drawing, not of the walk.** The window is now a fraction of **ground length**
      (`CAMERA_WINDOW_FRACTION`, `MIN_CAMERA_WINDOW_M`). Same route now: **3.2 km of camera
      travel**; the VR1 route 17.6 km; a 300-fix walk 41 km, with the zoom pulling wide for the
      establish and finale shots and pushing in to follow. A test asserts the camera travels more
      than 500 m on a five-vertex trace, because this failure was completely silent.
      — **Map gestures are all off during the replay.** For those ten seconds the film owns the
      camera; a stray thumb would leave the walk drawing itself off screen.
      — ⚠ **The 9:16 framing problem is gone with the black ground.** There is no empty frame to
      fill any more, so the three options that were waiting on a decision are moot.
      — ⚠⚠ **NOBODY HAS SEEN IT MOVE, AND NOW NOBODY CAN WITHOUT A DEVICE.** The workbench has no
      Google map, so the replay stage was deleted rather than left showing a picture the app does
      not draw. `tools/preview-film.mjs` remains as a **geometry** check and now says so in words,
      on a slate ground rather than black.
      — Reached from the passport, **under the hero**, where the app already puts its one
      invitation — mutually exclusive with it by construction, verified both ways.
      — ⚠ **Never called "video" in any string.** The video does not exist; a button promising one
      is the store-copy mismatch `docs/marketing-plan.md` §2 says produces an uninstall.
- [x] **T-165** ✅ **The visual reference, 2026-08-18 — `tools/preview-tour.mjs`.**
      — **The project lead, and it was the most useful thing said all day:** *"It's hard to imagine
      it without a visual reference of what is becoming."* Everything in this repository that can be
      *seen* was scattered across three preview tools, a workbench needing a dev server, and 33
      emulator screenshots with no index. `node tools/preview-tour.mjs` → `tools/out/tour.html`.
      — **Every artefact is the real output, never a mock-up:** stamps through `stampArt.ts`, the
      souvenir through `renderShareCardSvg`, the film through `composeSouvenir` → `frameAt` →
      `projector`, and the screenshots unretouched. **Each exhibit is labelled built / built but
      unverified / not built**, and the last section is *What is not built* — a tour of the good
      half would be exactly what this project's honesty rules exist to prevent.
      — ⚠ **It wears the app's own palette** (`ui/theme.ts`), not a scheme invented for the page.
      — **Refactor it forced, and the codebase is better for it:** `preview-stamps.mjs` and
      `preview-film.mjs` each held their own SVG drawing, and the tour needed both. Copying would
      have made a **third** renderer free to disagree with the two already approved by eye — the
      exact failure the one-renderer rule exists to prevent. Both now share
      `tools/lib/svg-render.mjs`. Output verified unchanged.
      — ⚠ **The screenshots are honestly captioned as stale where they are**: the passport shot
      predates the 60-place curation and the share shot still carries the old app name.
- [x] **T-166** ✅ **The screen reader learns Portuguese and German, 2026-08-18.** ⇠ T-160
      — ⚠⚠ **T-160 LOOKED FINISHED AND WAS NOT.** The app was translated, every screen checked, the
      work written up as done. A sweep found **ten accessibility labels still in hardcoded
      English** — so the screens spoke three languages and the *screen reader* spoke one, and a
      blind Portuguese user got an English app. That is the one class of user who cannot work
      around it.
      — **And three visible strings were never switched over**: the passport's own heading, its
      back control, its hero label and invitation, the place card's *Show on map* and *Close*, the
      privacy policy's title, and both map failure messages. ⚠ **`SettingsView` wrote *"Use the
      light map"* out longhand next to `settings.a11y.useLightMap`, `useDarkMap` and `backToMap` —
      three keys that had existed since T-160 and were simply never called.** Same shape as the
      five hardcoded copies of the app's name: **a catalogue most callers ignore is not a
      catalogue, it is a suggestion.**
      — **`i18nCoverage.test.ts` is the rule the build now enforces**, as `brand.test.ts` is for
      the name. It fails on any `accessibilityLabel` string or template carrying prose, and on any
      `<Text>` with literal words in it. **Verified by reintroducing a defect and watching it
      fail** — a guard nobody has seen fail is a guard nobody should trust.
      — One exemption, `DebugScreen.tsx`, with its reason recorded and a test that fails if the
      file it names ever stops existing.
      — ⚠ **Its blind spot is stated rather than hidden**: text inside a `{}` expression is not
      parsed. That is how the hero label — *"places collected"*, the biggest words on the passport
      — hid in plain sight; it was found by reading, not by the test, and now uses
      `n('passport.collected')` with **zero as its own string**, because before you have been
      anywhere the number is a target and afterwards it is a record.
      — ⚠ **The German is still unreviewed (T-160a).** There is now more of it.
- [ ] **T-164** **Import walks the app did not record** ⇠ T-021, T-104, D-040 ⚠ **requested 2026-08-18**
      — **The project lead:** *"One thing we should add is the ability to import data from Health,
      Strava, Google Timeline, GPX, etc..."* — after reading that the reference app's real feature
      is import, not export. It is a good fit for Madeira specifically: a visitor who walked three
      levadas before installing has a passport that says 0.
      — ⚠⚠ **THESE ARE NOT ONE FEATURE. THEY ARE FOUR, AND THREE OF THEM COST THE PRIVACY CLAIM.**
      **GPX is a file the user picks.** No account, no network, no permission, nothing new to
      declare — and Strava, Garmin, Komoot and Google Timeline all *export* GPX or JSON, so the
      file path covers most of the want at a fraction of the cost. **Strava is OAuth and an API**:
      accounts, tokens, a network call on our own account, and a third party who then knows the
      user walks in Madeira. **Apple Health is iOS**, and there is no iOS build (D-032). **Google
      Timeline** is an export file today, so it lands in the GPX/JSON bucket.
      — ⭐ **Recommended v1 subset: import a file the user hands us. Nothing else.** Everything
      above the file is a different decision and should be raised as one.
      — ⚠⚠ **THE REAL TRAP IS NOT THE PARSING. IT IS WHETHER AN IMPORT CAN EARN A STAMP.**
      An imported track is a file anyone can write. If it feeds `runAwardPass`, **the passport
      stops being a record of where you went and becomes a record of what you uploaded** — and the
      app has spent four decisions insisting it never claims a visit it cannot stand behind (D-002,
      D-009, T-149's "the app is politely calling you a liar", D-065's confidence values). A
      stamp earned from a stranger's GPX is the same failure as a false geofence award, except
      deliberate. **Decide this before writing a parser**, not after.
      — Three shapes, none chosen: **(a) drawn but never credited** — the trace appears on the map
      and in the souvenir, no stamps, which keeps the passport honest and is the smallest thing
      that answers the request; **(b) credited with a visibly lower confidence**, which D-065's
      column already supports and T-149's UI already knows how to talk about; **(c) credited
      normally**, which is the one to argue *for* explicitly rather than fall into.
      — **What already exists:** `tools/import-sensor-logger.mjs` parses a third-party export into
      the app's own fixture shape, so the reader/normalise half has a working precedent. ⚠ It has
      **never seen a real export** either.
      — ⚠ **`exportTrace.ts` and D-040 are the other end of this.** The masking rule exists so a
      trace cannot publish where the user sleeps; an *imported* trace has never been masked by us
      and must go through the same door before it reaches a souvenir.
- [x] **T-167** ✅ **The map draws the cleaned trace — found and fixed 2026-09-22.** ⇠ T-150
      — **The project lead, looking at the running app:** *"sometimes the app makes lines in random
      places which looks a bit odd."* They are looking at a real bug, not at D-032.
      — **`NativeMapScreen.tsx:326` calls `splitIntoSegments` — raw.** The cleaned entry point is
      `drawableSegments`. `traceCleanup.ts` is called by the souvenir card and by every preview
      tool, and **not by the map**.
      — **How it got that way:** `10fa42a` (Aug 14) wrote the Google screen against
      `splitIntoSegments`; `98796d8` (Aug 16) added the cleanup and wired it into `buildTrace` —
      whose only caller was the MapLibre screen, now in `app/attic/`, where it still is today.
      — ⚠ **This is the T-145 shape.** Nothing tests `NativeMapScreen`, so 619 passing tests cannot
      see it. **Ship the guard test with the fix**, in the shape of `freeTier.test.ts`.
      — **What it costs today**, on `funchal-seafront` (⚠ modelled noise, not measured): the phone
      draws **4.49 km for a 2.23 km walk, worst error 151 m, 211 vertices**; cleaned it is 2.55 km,
      20 m and 35 vertices. Identical signatures — one import and one call site.
      — ✅ **Fixed:** `drawableSegments` at `NativeMapScreen.tsx:337`, and
      **`map/traceDrawn.test.ts`** is the guard — six tests, in `freeTier.test.ts`'s shape.
      — ⚠ **The guard was checked by breaking it**, per CLAUDE.md's rule about probes that do not
      move: putting `splitIntoSegments` back fails **one** test with the sentence that names the
      cause, and the other five keep passing. A source check that cannot fail is decoration.
      — ⚠ **`splitIntoSegments` is deliberately NOT forbidden generally.**
      `souvenir/composition.ts` needs it — it paces the film by the fixes' own timestamps, and
      cleaning first once moved a stamp cue to the start of the draw. The test asserts that
      exception too, so a later tidy-up cannot quietly "fix" it.
      — **644 tests, `tsc` strict clean.** ⚠ Causes B, C and D from
      `docs/trace-fidelity.md` are untouched: T-168, T-169, T-170.
- [ ] **T-168** **Settle what the renderer will actually draw — one emulator session** ⇠ T-167
      — ⚠ **`expo-maps@57.0.1` passes only `points`, `color`, `geodesic`, `width` to the polyline**
      (`GoogleMapsView.kt:158`). No `pattern`, no `jointType`, no caps, no `zIndex`. **So the
      dashed bridge recorded in `traceGeoJson.ts:112` is not buildable**, and joints take the Maps
      Compose default, which is **miter**.
      — **Why miter matters:** spike length is `width / (2·sin(θ/2))`. On the raw trace **27 corners
      are under 30° and the sharpest is 1.3°**, which mitres to ~480 px on an 11 px line — from a
      vertex a few metres off the path. Cleaned, that is 2 corners and 9.7°. ⚠ **Hypothesis, not a
      measurement** — whether Google applies a miter limit is undocumented. **Test: one screenshot
      of a deliberately zigzagged fixture.**
      — ⚠ **Re-test the two-polyline binding bug** recorded at `NativeMapScreen.tsx:156` (casing
      rendered wrong; suspected binding **by array position rather than by `id`**). That note is
      from 14 August. **If it is fixed, the casing, a translucent band and faint bridges all open
      up at once** — highest value-per-minute test in this area.
      — ✅ **Alpha is available**: `CircleRecord`'s default colour is `0x7F0000FF`, so translucent
      strokes need no new capability.
- [ ] **T-169** **Judge the trace's weight — band or hairline** ⇠ T-168, D-082 ⚠ **the project lead's eye**
      — **The argument:** a 4 pt hairline is a *claim of precision*. GPS gives ±5–20 m open-sky and
      worse under canopy, so every metre of ordinary error is drawn as a visible mistake. A wider,
      softer, translucent band says *you were along here* and the same error falls inside the mark
      — without faking anything, which is `traceCleanup.ts`'s own instinct.
      — ⚠ **Pulls against `traceStyle.ts`** (*"the one saturated, heavy thing on the map"*) and
      design-brief §2.3. Those are about **weight and contrast, not sharpness**, and a 12 pt band at
      40% alpha can be heavier than a 4 pt hairline — but this is judged by eye, so it goes to the
      workbench, not into `app/`.
- [ ] **T-170** ⚠ **Snap the trace to the levada courses we already ship** ⇠ T-018, T-021, D-082
      — ⭐ **The Proa-shaped answer to *"only highlight the real roads"*.** D-002 curated the canvas;
      this curates the **graph**. `content/levadas.json` already holds eleven real OSM courses on
      the device — so **no import, no R-tree, no new storage**, against T-082's ~51,000 ways.
      — **The ambiguity that makes general matching hard is absent**: a levada runs a contour on
      steep ground with no parallel candidate, where T-084's hard case is two roads stacked. And it
      fixes the worst-looking case — canopy, where GPS is poorest and the signature walks are.
      — ⚠ **It breaks `traceCleanup.ts`'s one rule** (never move a point). **Own module, draw time
      only, raw rows untouched (D-010).** The defence — that a polyline already interpolates between
      fixes — is an argument, not a licence.
      — ⚠⚠ **DO NOT BUILD THIS WITHOUT A FIXTURE.** `tools/fixtures/` is empty; a corridor width
      chosen today is the class of guess this project has already paid for. **One Sensor Logger
      walk on one levada unblocks it** — the same fixture T-018/T-019/T-020/T-021 all wait on.
      — **Costing and rejected alternatives:** `docs/trace-fidelity.md`, D-082.
- [x] ✅ **T-171** **Leaving the archipelago put the recorder in a trip-creation loop — fixed 2026-09-22.**
      ⇠ T-100 ⚠ **measured on real hardware 2026-09-22** — `docs/field-notes.md`
      — **30 trips in six days, 18 under 60 s, several 0 s.** `tripEnd.ts:186` ends a trip on the
      first fix outside the archipelago — correct — but **nothing stops a new trip opening while
      still outside**, so the next fix kills that one too, forever.
      — ⚠⚠ **The user-visible cost is a notification storm.** D-011's cap is **per trip**, so
      each new trip gets a fresh allowance: the log shows `reveal: 1 of 2` **25 times**, then
      `reveal already sent` 41 times. **26 "your trip has ended" notifications.** The cap worked
      exactly as specified and the churn underneath defeated it.
      — **Who this hits:** a visitor flying home with the app still installed — i.e. **every
      user, at the end of every trip.** It is the last thing the app does before they decide
      whether to keep it.
      — **The fix is not in `detectTripEnd`**, which is right. It is that the recorder must not
      open a trip outside the bounds — and the cap probably wants to be per *departure*, not per
      trip row.
      — ✅ **`recording/recordingAdmission.ts`** is the new pure module: **an out-of-bounds fix may
      EXTEND a trip and may not OPEN one.** It is still stored whenever a trip is open, because it
      is the evidence `tripEnd` needs — refusing to store it would trade a loop for a holiday that
      never ends. `recordingSink` calls `getActiveTrip` instead of `getOrCreateActiveTrip` when
      nothing in the batch qualifies.
      — ✅ **The notification re-arm is guarded** in `tripDao`: `NOTIFICATION_REARM_AFTER_MS`
      (12 h, ⚠ not tuned — churn is *under a second*, a repeat visit is *months*, so it sits in
      an empty middle). A wild fix cannot suppress a trip either: anything worse than 200 m
      abstains, mirroring the rule `tripEndDetection` already applies in the other direction.
      — ✅ **The archipelago bounds moved to `content/archipelagoBounds.ts`** so the rule that
      ENDS a trip and the rule that STARTS one cannot drift apart. That drift is the bug.
      — ⚠⚠ **VERIFIED BY REPLAYING THE PHONE'S OWN 831 FIXES** through the new rules:
      **226 trip creations → 1, and 226 notification re-arms → 1.**
- [x] ✅ **T-172** **Geofence registration fired an EXIT for every region at once — fixed 2026-09-22.** ⇠ T-145
      — **2,699 geofence events on the P30, every one an `exit`, none an `enter`**, arriving in
      simultaneous bursts: **83 sharing one timestamp**, then 81, then 74.
      — `backgroundTasks.ts:135` maps the transition correctly, so this is the **initial trigger**
      at registration, not the handler. ⚠ Not a correctness bug for stamps — an enter is what
      awards — but it is ~2,700 junk rows a week and a burst of work on every rebuild.
      — ✅ **The rule is memory, not a ban on exits.** Refusing exits outright would break dwell,
      which `reconstructVisits` and `stampRules` both need. **You cannot leave somewhere you were
      never recorded entering**, so an exit with no matching enter in the same trip is dropped —
      `geofenceEventDao.hasEnterInTrip`, an `EXISTS` probe because this runs on the OS's delivery
      path where a cold start brings 99 crossings in 100 ms.
      — ⚠⚠ **Replayed over the phone's real events: 2,706 → 0.** Every single one was an
      unpaired exit, which settles the diagnosis — not one was a real crossing.
- [x] ✅ **T-173** **Two runtime errors seen on real hardware — both fixed 2026-09-22.**
      — `ExpoLocation.startLocationUpdatesAsync` **rejected** at recording launch sync. If this is
      reproducible it means **the recorder did not start**, which is the one failure the project
      cannot tolerate (CONTEXT §2.4).
      — `NativeStatement.finalizeAsync` **rejected** inside `onLocations` — a batch of fixes lost.
      — Both from `recording_event` on 2026-08-28. Neither has ever appeared on the emulator.
      — ✅ **Foreground service:** `syncRecordingWithPreferences` now takes the app's visibility
      and refuses to start unless it is `active`. ⚠ `inactive` is refused *with* `background` —
      it is the app switcher, a call, a permission dialog, and Android does not care that it looks
      transient. `App.tsx` passes `AppState.currentState` rather than assuming.
      — ✅ **FOREIGN KEY failure — root cause found.** `deleteAllUserData` deletes every `trip`
      row and ran **outside the sink's serial queue**: a batch holding a trip id inserted against
      it the moment the delete committed. A transaction stops a half-delete; it does not stop
      that. The queue is now shared — `storage/recordingQueue.ts` — and erase-all takes it.
      ⚠ **Anything that deletes or rewrites `trip` and its children belongs in that queue.**
- [x] ⚠⚠ **T-174** ✅ **The recorder was DEAD and the app said it was recording — found and fixed
      2026-09-22.** ⇠ T-173 ⚠ **found while setting up the T-051 soak, which it was blocking**
      — **The state on the phone, all four at once:** the settings switch **on**; the screen
      saying *"A registar a sua viagem"*; `dumpsys activity services` with **no foreground
      service**; `dumpsys location` with **no request** from the package; and the database
      **unwritten for minutes** while backgrounded. Last real fix: **2026-08-28** — the same day
      as T-173's foreground-service refusal.
      — **Mechanism.** `isRecording()` is `Location.hasStartedLocationUpdatesAsync`, which reports
      that the **task is registered**, not that anything is running. That flag outlives the
      service. `syncRecordingWithPreferences` asked it first and returned early, so once the
      service died — an OEM kill, or T-173 firing *after* the task was registered — **the
      recorder was never restarted for the life of the install.**
      — ⚠⚠ **The app reported itself healthy while recording nothing**, which is worse than
      failing loudly. Only a manual off-and-on in Settings recovered it, which no user would think
      to do. **Proved on the device:** before the toggle, no service; after it,
      `LocationTaskService isForeground=true` and a live `ACCURACY_FINE gps requested=+10s0ms`
      request from `com.proa.madeira`.
      — ✅ **The fix is to stop asking.** `recordingAction()` never takes `taskRegistered` as a
      reason not to act — it decides from the preference, the permission and T-173's visibility
      gate, and `startLocationUpdatesAsync` replaces options in place without dropping fixes
      (`setSamplingProfile` already documented that). `taskRegistered` now only picks the wording
      of the log line.
      — ⚠ **`defer` still re-registers geofences**, which the first version of the fix got
      wrong: geofencing needs no foreground service, and skipping it would stop a rebooted phone
      collecting stamps. `assert` does **not**, because `startTrip` already does it.
      — ⚠ **And it re-asserts the profile the GATE chose, not `'walking'`.** Caught by looking
      at what the change did: once the start stopped being conditional, hardcoding a profile meant
      **every launch discarded the sampling gate's downshift**. Now `getCurrentSamplingProfile()`.
- [ ] ⚠⚠ **T-175** **The sampling downshift is driven by the thing it exists to reduce**
      ⇠ T-034, T-054 ⚠ **found 2026-09-22 while auditing efficiency**
      — **`applySamplingGate` runs in exactly one place**: inside the location task
      (`backgroundTasks.ts:94`), i.e. **only when the OS delivers fixes.** It reads a ten-minute
      window of them and downshifts to the `stationary` profile when nothing has moved.
      — ⚠⚠ **So the cheapest state is the one the app cannot notice it is in.** A phone indoors
      on a table, GPS trying and failing, delivers **nothing** — so the gate never runs, and the
      profile stays wherever it was last set. On the `precise` tier that is
      `pauseWhenStationary: false`, i.e. the OS is never allowed to stop the chip either. **The
      worse the situation, the less likely the mechanism that fixes it is to fire.**
      — **Measured on the P30**, stationary indoors: the OS request was
      `ACCURACY_FINE gps requested=+10s0ms` from `com.proa.madeira`, which is `walking × precise`
      uniquely (30 s ÷ 3 = 10 s, accuracy `high`). It had been that way for as long as it had been
      running. ⚠ `precise` is **not** the default — `DEFAULT_TRACKING_QUALITY` is `balanced` and
      its reasoning is sound — but any user who picks *Máximo detalhe* gets this.
      — **Candidate fixes, none chosen:** *(a)* give the gate a second trigger that does not
      depend on fixes arriving — ⚠ which costs a periodic wake-up, the very thing being saved;
      *(b)* let the OS decide, by never setting `pauseWhenStationary: false`, which makes the
      `precise` tier cheaper and slightly less precise; *(c)* treat **absence** of fixes as
      evidence of stillness and downshift from the health check, which already runs. **(c) looks
      cheapest and reuses a wake-up the app already pays for.**
      — ⚠ **This wants T-054's real numbers before it is tuned**, and those want a healthy
      battery. What is measurable here regardless is **GPS-on time and wake-up count**, which a
      degraded battery does not distort.
- [x] **T-176** **The privacy copy stopped contradicting the backup, and a field build exists**
      ⇠ `docs/reference-app-teardown.md` §1 and §12 — 2026-09-22
      — **Copy.** Six UI strings × three languages said nothing leaves the phone / there is no
      backup — false, because `withAndroidBackupRules.js` puts the database in the phone's own
      backup, and banned by D-073 anyway. Worst was `erase.confirm.body2`, telling the user this
      was the only copy **while they decide to erase it**. Two policy sentences contradicted the
      policy's own backup section. `i18n.test.ts` now fails on the phrases (checked against the
      old strings). ⚠ The Portuguese policy wording still wants the project lead's eye (T-160b).
      — **Field build.** `-PproaFieldBuild=true` makes a release APK whose **manifest** is
      debuggable, so `run-as` can still pull the database after a real walk — `adb backup` gives
      an empty file on the P30. Not `debuggable true` on the build type: that flips
      `BuildConfig.DEBUG` and the app looks for Metro. `docs/dev-build.md` has the recipe and why
      smoothness must never be measured on it.
- [~] ⚠⚠ **T-177** **On real hardware the map sometimes never appears — blank light-grey screen,
      no Google wordmark** ⇠ found 2026-09-22 on the P30, release builds, seen by the project lead
      — **Signature**, from `dumpsys activity top`: `GoogleMapsView` → `ComposeView` →
      `AndroidViewsHandler` with **no child** — maps-compose never attached its `MapView`. A good
      launch has a `ViewFactoryHolder` there, and uiautomator shows *"Mapa do Google Maps"*. The
      Maps SDK itself starts cleanly both times (key accepted, renderer LATEST, a GL surface made);
      no error or exception is logged. The buttons over the map render normally.
      — **Tally: 2 blank of 9 launches**, one on each build (field and plain release), both the
      first launch after an install or force-stop. Fine: 3/3 cold starts after force-stop, 3/3
      reopen after Back, 1/1 launch after an install whose process the recorder had already
      started. **Not reproducible on demand.** The only error near a failure was
      `HeadlessJsTaskContext: Cannot start headless task, CatalystInstance not available` —
      the location task firing before React was up — ⚠ which is also a possible recording gap
      at cold start and deserves its own look.
      — ⚠ **First hypothesis was wrong and is recorded so nobody repeats it:** the debuggable
      manifest flag (T-176) was blamed on one A/B pair; the plain build then failed too.
      — **Workaround for a user today:** swipe the app away from recents and reopen. The
      recorder is unaffected — `soak-check.sh` read ALIVE through every blank map.
      — **Next step:** a launch loop on the P30 (force-stop / install / reboot × N) logging the
      signature, to find the start path that fails; then read how `expo-maps` mounts its
      composable. Nothing tests a screen (T-145/T-167 shape), so only a device sees this.
      — **The acceptance bar and the plan are in *Release readiness* at the top of this file
      (2026-09-23):** 60 clean launches in a row before a fix counts. The cold-start warning is
      split out as T-196.
      — ✅ **MEASURED 2026-09-23 on the P30:** 30 force-stopped cold starts, field build `2ea386f`.
      Each launch was polled every 1 s with `dumpsys activity top`, **restricted to Proa's own
      task**:
      - **24** normal: map in 2–6 s, median 3 s.
      - **3** late: `AndroidViewsHandler` with no `MapView` for 13–34 s, then the map (17/22/38 s).
      - **3** failed: still empty at 45 s.

      So **20% go wrong and 10% show no map within 45 s** (95% interval ≈2–27%). The old *"2 of
      9"* was about right. Some "blank maps" are ~20-second delays, not permanent; nothing waited
      longer than 45 s, so whether the rest ever recover is unknown.
      — ⚠ **Three probes were wrong before this one, all recorded so nobody repeats them:**
      1. A fixed 8 s check counted a late map as blank.
      2. `uiautomator dump` crashed *itself* when polled (*"UiAutomationService already
         registered"*), inflating times and producing false "other" results.
      3. `dumpsys activity top` lists every task, and a "holder present" check matched
         **WalkNYC's** map.
      — **Not the cause, checked:** the Maps SDK's `ClientParamsBlocking` stack appears in two
      failures and in none of three later slow launches, so it does not tell good from bad.
      — **Lead, untested:** every launch fires a burst of `madeira-geofencing` jobs on the main
      thread (0–33 per launch) as the region set is re-registered. **Next experiment:** the same
      loop with the launch-time geofence refresh suppressed, A/B. ⚠ Launches were slower after 30
      back-to-back cold starts; run A and B interleaved, not one after the other.
      — **Mitigation available whatever the cause:** remount the map when no `MapView` exists after
      N s (a key change on the expo-maps view). A workaround, not a fix, and it must be called
      one.
      — ✅ **2026-09-24: a mechanism, read from source (commit `1dfb549`).**
      - **Why the map is blank.** `ExpoComposeView` (expo-modules-core 57.0.10, the same on Expo's
        `main`) pins the map's composition to `appContext.currentActivity` **when the view is
        built**. With no current Activity it falls back to disposing the composition on the first
        re-attach after a detach. That listener runs after `onAttachedToWindow` has made a fresh
        composition, so the fresh one dies and nothing replaces it. That is the measured
        signature.
      - **What the log shows.** Stuck launch 24: maps-compose's initializer at 28.796, a `MapView`
        created at 28.804, the map ready at 29.033, and at 10 s no `MapView` in the tree.
      - **When the Activity is missing.** React sets it in `onHostResume`, the same moment
        `AppState` turns `active`. It can be null while views mount when JavaScript was already
        running (T-196). 2 of the 4 captured blanks were warm starts into a process that already
        existed.
      - **Fix:** `map/mapMountGate.ts`. The map waits for the first `active` and then latches. A
        test fails if `GoogleMaps.View` renders outside the gate.
      - **Also read, not the cause here.** maps-compose's `GoogleMapsInitializer` catches
        `Exception`, and coroutine cancellation is one. A map disposed mid-init therefore leaves
        the state `FAILURE` for the life of the process.
      — **Baseline on the plain release before the fix:** **1 blank in 97 force-stopped cold
      starts** (probe 5: 1/25; probe 6: 0/72), against 6/30 on the field build on 2026-09-23. On
      cold starts, "60 clean in a row" cannot tell a fix from luck. **The proof targets warm
      starts** (`warmloop.sh`: Back, wait 2–12 s, relaunch, with the recorder keeping the process
      alive).
      — **Warm starts on the old build: 0 blank in 30** (all 30 in the same process, map in
      0–1 s). ⚠ So Back-then-relaunch does **not** reproduce it. The stuck launches were into a
      process that existed with **no Activity ever having run in it**, which Back does not make.
      The trigger is not reproduced on demand; the gate removes a code path that produces the exact
      signature, and that is all it can claim. ⚠ **A probe mistake, recorded:** the first old-build
      run was corrupted by a second loop still driving the phone. `TaskStop` does not kill the
      child bash script here, so the loops now take a pid lock.
      — ✅✅ **THE CAUSE, 2026-09-24: a maps-compose 6.10.0 bug, googlemaps/android-maps-compose#776.**
      - **The bug.** expo-maps pins 6.10.0. There, `GoogleMapsInitializer` sets `SUCCESS` inside
        `withContext(IO)`. A recomposition before `withContext` returns cancels the
        `LaunchedEffect`, and `catch (_: Exception)` turns the cancellation into `FAILURE`, which
        is never retried. Fixed upstream in **6.12.0** (#778).
      - **The trigger, measured.** 22/22 blank launches ran in an app process that already
        existed before the launch (no class loader, no Firebase provider, no `onCreate` lines).
        37/37 good ones created theirs during the launch.
      - **Remounting does not help.** 3/3 blank maps stayed blank, because the state was
        `FAILURE`.
      - **The gate from `1dfb549` was wrong and is reverted.** Its marker never fired in 60
        launches, 17 of which went blank.
      - **Fix (`675ae50`):** `plugins/withMapsComposeFix.js` forces 6.12.1 in `allprojects`.
        expo-maps is a **precompiled AAR**, so compatibility was checked, not assumed: 17/17
        classes and 34/34 methods and fields it references exist in 6.12.1, and the checker flags
        planted fakes. `src/mapsComposeFix.test.ts` fails once expo-maps pins ≥ 6.12.0.
      - ⚠ **The probes harmed the phone.** After hundreds of force-stops, EMUI's iAware
        force-stopped Proa 2 ms after launch (`iAwareF[CrashClean]`). A normal launch worked
        again minutes later. Keep device loops short and spaced.
      - **Release loop on 6.12.1:** 29/29 clean, but **all 29 were fresh processes** (the reinstall
        reset EMUI's prelaunch). That says nothing about the fix. **The proof is an A/B on the
        failing path:** field builds with 6.10.0 and 6.12.1, `bgstart.sh`. It kills the process,
        Android restarts it in the background, then the app is opened.
      - ⚠ **That A/B cannot be run on this phone (tried 2026-09-24).** After a kill, EMUI never
        restarted the process in the background within 90 s (T-210 again). `run-as kill` is
        denied by SELinux on the release-signed process. No pending job existed to force. The
        pre-started processes came from EMUI's own prelaunch, which cannot be triggered. **What
        stands:** the upstream report names exactly 6.10.0 and exactly this symptom, and the device
        behaves as that bug predicts (map created then torn down; no recovery on remount; only in
        pre-started processes). The fix is Google's own. **Open:** a blank-prone launch seen
        coming up on 6.12.1. It will happen with ordinary use once EMUI prelaunches Proa again.
        Check with `adb logcat` for a launch that has no `createClassLoader … com.proa` line.
- [x] ✅ **T-178** **The WAL was 27 MB — over the auto-backup cap — fixed 2026-09-22, and verified
      on the P30** (field build, first launch: WAL 27,027,232 → 78,312 bytes, `integrity_check` ok,
      no row lost). ⇠ T-142, T-174 — `docs/field-notes.md` (evening entry) has the measurements.
      — **Two causes, two fixes.** The file keeps its high-water size because nothing truncates
      it → `journal_size_limit` + `TRUNCATE` at open, trip end and erase-all (`storage/walPolicy.ts`,
      `truncateWal` in `database.ts`). And a leaked statement pinned the WAL for six days in
      August → **not fixable from here**; a refused checkpoint now writes a `wal_checkpoint`
      diary line.
      — ⚠ The open-time checkpoint runs **directly, not through `recordingQueue`**: a batch
      already queued and waiting on `getDatabase()` would deadlock against it.
      — ⚠ **Erase-all left the deleted history in the WAL's dead frames.** Fixed by the same
      truncate.
- [x] ✅ **T-179** **The statement that pinned the WAL — found, and every statement now held until
      finalized, 2026-09-22.** ⇠ T-142, T-178 ⚠ **the fix is from source and upstream; the race
      did not reproduce on the P30**
      — **Cause: expo/expo#49799** (open, triage-verified; fix PR #49807 closed unmerged). An Expo
      `AsyncFunction` converts its arguments on the modules queue after the JS call returns, and
      nothing keeps a shared object's JS peer alive in between. expo-sqlite's `getFirstAsync` ends
      `await statement.finalizeAsync()` and never reads the statement again.
      — **Why a pin and not just a failed call** (expo-sqlite 57.0.1 source): the release runs
      `resetNative()` with **no `sqlite3_finalize`**, and a `SELECT` has stepped one row by then —
      so it stays active, holds the read transaction, and blocks every checkpoint.
      — **Fix:** `storage/keepAlive.ts` + `withStatement` in `database.ts`; everything goes through
      it, and a scan test fails if anything else calls `prepareAsync`.
      — ⚠ **Found along the way: T-142's retry could write twice.** A release at `finalizeAsync`
      comes after the statement ran. `releasedObject.ts` said the opposite; corrected.
      — ⚠ **Not reproduced on the device.** `statementStress.ts` (debug screen) ran #48995's loop,
      library vs held, at concurrency 8/64/256 with 70 SIGUSR1-forced ART GCs: **0 releases in
      ~45,000 bare statements.** The probe is inert here, not proof the bug is absent — August had
      two in six days. A `db_retry` or `wal_checkpoint` diary line is now the field signal.
      — ✅ **Decided 2026-09-22: the WAL stays in the backup** (project lead, on the assistant's
      recommendation). Excluding it bounds a pinned week, but costs everything not yet
      checkpointed — the P30 wrote ~950 frames a day, so up to about **a day of the trip**, which
      is what *"my phone died on day 5"* needs. With the leak fixed and the WAL truncated at open
      and trip end, a normal WAL is ~4 MB beside a <1 MB database.
- [x] ✅ **T-180** **A content-only change shipped the old places — the JS bundle was stale, fixed
      2026-09-22.** ⚠ found because the P30 showed **0 / 67** with `content/pois.json` at 80
      — The APK carried a bundle from before T-066c (*Encumeada Baixa* still in, none of its
      fourteen places). Gradle: `:app:createBundleReleaseJsAndAssets UP-TO-DATE`. The RN Gradle
      plugin's bundle inputs are the files under `app/`; the JS imports `../content/*.json`, which
      is **outside `app/`**, so a content-only edit never re-bundled — and the build still passed.
      — Fixed with `plugins/withContentBundleInputs.js`: declares `content/` as an input of every
      `createBundle*JsAndAssets` task. Verified: reran with the input added; `UP-TO-DATE` when
      nothing changed; reran when a file appeared in `content/` and again when it went. On the
      P30: **0 / 80**.
      — ⚠ **The main checkout's `android/` has the block applied by the plugin's own function**,
      not by `prebuild --clean`, which would change the Maps SHA-1 (`docs/dev-build.md`). Any
      other `android/` needs `npx expo prebuild` or the same one-liner.
- [ ] **T-154** **Confirm the native dark map is still dark with the clutter rules applied**
      ⇠ a physical Android
      — ✅ **Applied 2026-08-17**, on the project lead's instruction that *"light and dark mode are
      the same"* — previously the light map hid Google's POIs while the native dark map drew them,
      so one setting changed which product you were looking at. All three paths now compose
      `mapClutter.ts` and `darkMode.test.ts` fails the build if what they hide diverges, with one
      named exception (`road/geometry.stroke`, a casing that only matters on a dark ground).
      — ⚠ **What remains is verification, and only a device can do it.** "Google's own dark map
      *plus* a style JSON" is unreachable on an emulator that only loads LEGACY (T-147). The rules
      change no colour so `colorScheme: DARK` should still decide the palette. **If a real phone
      shows a light map after the user chose dark, that line is the suspect** and
      `HIDE_GOOGLE_POIS` turns it off in one line.
      — ⚠ **And the decision itself is open**: the project lead is *"still considering"* whether
      hiding Google's POIs costs too much of the OEM feel (D-070 amended). One boolean either way.
- [x] **T-149** ✅ **The app asks, 2026-08-16.** A levada it nearly credited raises one question
      on the passport, under the hero and above the rows: *"Did you walk the Long Canal Trail?
      Walked 2.1 km of 5.0 km (42%) — enough to ask, not enough for the app to be sure."*
      `stampConfirmation.ts` (pure, 7 tests) decides what to ask; `PassportView` renders it;
      `PassportScreen` awards or remembers the refusal.
      — **The four rules it is built on**: a confirmation and never a claim — there is no
      unconditional "mark as collected" anywhere in the app, and the question can only be raised
      by evidence the recorder gathered; **ask once**, because being asked twice about a walk you
      did not do is the app politely calling you a liar; **the evidence is in the question**, so
      the answer is a memory check rather than a guess at what the app wants; and **never more
      than one at a time**, because three stacked questions is a form and this screen is a reward.
      — **The evidence travels with the id** from `runAwardPass`, so the screen never recomputes
      D-065's arithmetic — a second implementation would be free to disagree with the first.
      — A confirmed stamp stores `confidence 0.9` and keeps the machine's own words in its
      reason. **Not 1.0**: the app cannot tell a careful memory from a generous one, and a stored
      1.0 would later read as *measured*. Every confirmed row is also a data point for T-131
      saying the bar was too high here.
      — Measured in the workbench: both controls 320 × 60, no overlap, nothing clipped. ⇠ D-065
- [~] **T-068** Define levada corridors with entry/exit nodes ⇠ T-028, T-028a
      — **Half done 2026-08-13 (D-055).** `tools/build-levadas.mjs` extracts the named ways of each
      curated levada from Overpass into `content/levadas.json`, applying the rule below —
      `highway=*` preferred, `waterway=*` as the fallback. Simplified for drawing: Levada do Furado
      is 39 ways, 654 → 181 points, **4 kB**. The app draws it when you ask to see the walk.
      — ⚠ **What is done is the *drawing*, not the corridor.** No entry/exit nodes and no
      connectivity check, so trailhead-to-exit crediting (D-009, T-089) still has nothing to stand
      on. That is the half this task is really about, and it is v2 work after D-032.
      — ⚠ **The name is the weak point, and a mismatch is a curation signal.** The tool matches OSM
      exactly first, then by prefix (for `(PR10)` suffixes), and prints each course's span in km —
      a course "60 km across" is two levadas sharing a word, which is what a loose regex produced
      on the first run. `Levada dos Balcões` matched nothing at all; until T-066 resolves the
      spelling, that card shows a marker and no course.
      — **Select by name (`Levada*`) plus hiking-relation membership, never by a single tag**
      (D-029). A levada is two parallel ways sharing one name: the channel (usually
      `waterway=drain`, 2,357 ways) and the footpath beside it (usually `highway=path`, 922).
      Use the `highway=*` ways for matching — the user walks the path, not the channel — and fall
      back to `waterway=*` geometry where a channel is mapped but no path is.
      — **Verify corridor connectivity.** A gap mid-corridor silently breaks trailhead-to-exit
      crediting, which is the mechanic levadas depend on (D-009).
- [ ] **T-069** Extract tunnel portal pairs from OSM into `content/tunnels.geojson` ⇠ T-022
      — **Must cover walkable tunnels, not just road tunnels.** 108 of the 604 tunnel ways are
      levada tunnels (T-028) — zero GPS, on foot, which is exactly the T-089/T-090 case.
- [x] **T-070** Commission or produce stamp artwork ⇠ T-066
      — Notes: `docs/task-notes.md` (T-070)

### Mechanics

- [x] **T-071** Stamp award rules: dwell time **and** plausible speed gates (D-009) ⇠ T-041,
      T-066
      — Notes: `docs/task-notes.md` (T-071)
- [x] **T-072** Store a confidence value on every stamp award ⇠ T-071
      — Notes: `docs/task-notes.md` (T-072)

      — **Consumed by the map screen, not the passport** (D-027). It does the "where should I go
      next" job that D-002 needs it for. Denominator counts **unlocked regions only** (D-024).
- [x] **T-074** Passport (stamp collection) screen ⇠ T-070, T-071, T-072a
      — Notes: `docs/task-notes.md` (T-074)
      — **Extended 2026-08-14 (D-058):** it lists **every** curated place, not only the collected
      ones. Uncollected are drawn muted, are tappable, and *Show on map* works for them — so the
      passport is now the discovery surface as well as the reward surface. This is what closes the
      hole D-052 left when the map's place markers were deleted.
- [x] **T-075** Primary screen: map, plus **three controls only** ⇠ T-015, T-073, T-074
      — Notes: `docs/task-notes.md` (T-075)

### Verification

- [ ] **T-076** Verify the geofence set reshuffles correctly while crossing the island
      ⇠ T-039, T-066
      — **Does not need T-066 to start.** The debug screen's *Start geofence field test*
      button generates a synthetic catalogue around wherever you are standing, sized so the
      platform's region cap binds and the anchor lands at roughly 850 m — a five-minute walk.
      Walk that far and the diary should show a `geofence` rebuild with a different set.
      — This is what sets the three guessed constants in **D-033**. Note the delivery *lateness*
      of the anchor exit at driving speed, not just that it arrived.
- [~] **T-077** Verify a stamp fires reliably on arrival at a miradouro ⇠ T-071
      — **The emulator half is done 2026-08-14, and it was worth doing**: it is what uncovered
      T-145. First stamp ever awarded — Forte de São Tiago — via a route that arrives and stands
      still (`tools/routes/forte-sao-tiago-dwell.txt`).
      — ⚠ **Confidence 0.60, through the `no speed data` branch, not the two-gate pass.** The
      emulator serves nothing once you stop moving (D-047), so the arrival case cannot be
      verified properly here. **The field half is untouched.**
      — Notes: `docs/task-notes.md` (T-077)
- [ ] **T-078** Verify driving past a levada trailhead does **not** award it ⇠ T-071
- [ ] **T-079** Verify stamps still award with GPS accuracy degraded to 100m ⇠ T-071
- [ ] **T-080** Verify geofencing battery cost is not measurable above baseline ⇠ T-076
- [x] **T-081** Verify the passport screen is legible with 3 stamps and with 200 ⇠ T-074
      — Notes: `docs/task-notes.md` (T-081)

**Milestone M3 — "It rewards you"** ⇠ T-077, T-078, T-079, T-080, T-081

---

## Phase 4 — Map matching and road highlighting

> ## ⛔ DEFERRED TO v2 — D-032 (2026-08-08)
>
> **Do not build any of this for v1.** v1 draws the **raw GPS trace** instead of matching it to
> road segments. This is the single largest body of work in the project, in service of something
> D-002 already calls *decoration* — while the actual reward (stamps) comes from geofences, which
> need almost no accuracy.
>
> **Deferring costs nothing permanent.** D-010 retains raw traces immutably, so matching can be
> added in v2 and run **retroactively over every trip already recorded**. That is precisely the
> property D-010 was written to buy.
>
> Everything from T-082 to T-098 below is v2. Left in place, unrenumbered, with dependencies
> intact.

### Graph and core matching

- [ ] **T-082** Import the road/path graph into SQLite with an R-tree spatial index ⇠ T-022,
      T-030
      — Scale, measured 2026-08-08 (T-028): **~51,000 highway ways** before splitting at
      intersections.
      — **Open question to settle here, not in an implementer's head: do footways belong in the
      graph?** There are **16,066**, overwhelmingly Funchal pavements. Including them makes the
      city a mass of pavement fragments, inflates any denominator they touch, and adds matching
      ambiguity exactly where GPS is already multipathed by buildings. Excluding them is probably
      right. Decide explicitly and record it.
- [ ] **T-083** Snap-to-segment matching using heading, speed and **altitude** ⇠ T-082, T-035
- [ ] **T-084** Hysteresis to prevent flicker between vertically stacked roads (VR1 vs ER101)
      ⇠ T-083
- [ ] **T-085** Wide match corridor for paths — 50–75m vs 15–25m for roads ⇠ T-083
- [ ] **T-086** Movement-bout segmentation using activity type and speed ⇠ T-034, T-083

### Generous crediting (D-009)

- [ ] **T-087** Tunnel portal inference — portal A then portal B credits the whole tunnel
      ⇠ T-069, T-083
- [ ] **T-088** Shortest-path gap bridging with plausibility checks (starting thresholds:
      <~30 min, <~15 km). Must **not** attempt to credit a road route across the Porto Santo
      ferry crossing (D-021). ⇠ T-082, T-083
- [ ] **T-089** Levada corridor crediting — trailhead + exit credits the whole walk ⇠ T-068
- [ ] **T-090** Sensor-only fallback — trailhead + step count + elevation profile ⇠ T-036,
      T-035, T-089
- [ ] **T-091** Store `confidence` and `credit_method` on every visited_segment ⇠ T-083

### Execution and verification

- [ ] **T-092** Burst matching scheduler — runs on idle or charge, never per-fix ⇠ T-086
- [ ] **T-093** Re-runnable matching over stored raw traces ⇠ T-092, T-016
- [ ] **T-094** Matching regression harness running against the Phase 0 fixtures ⇠ T-021,
      T-083
- [ ] **T-095** Verify a tunnel drive is credited with zero fixes inside it ⇠ T-087, T-094
- [ ] **T-096** Verify a canopy-blackout levada is credited end to end ⇠ T-089, T-090, T-094
- [ ] **T-097** Verify the VR1 and the coastal road are never confused ⇠ T-084, T-094
- [ ] **T-098** Verify burst matching over a full day has no noticeable battery cost ⇠ T-092

**Milestone M4 — "The map fills in"** ⇠ T-095, T-096, T-097, T-098 — **v2 milestone (D-032)**

---

## Phase 5 — The souvenir

- [x] **T-099** Trip-end detection via airport geofence, plus Porto Santo airport and the
      Funchal cruise terminal ⇠ T-039, T-014
      — Notes: `docs/task-notes.md` (T-099)
- [x] **T-100** Fallback trip-end detection — left island bounding box, or 24h+ no data.
      **Must treat Madeira and Porto Santo as a single region (D-021)**, otherwise a day trip
      to Porto Santo falsely ends the trip. ⇠ T-099
      — Notes: `docs/task-notes.md` (T-100)
- [x] **T-101** Finalisation pass — run any pending matching before the reveal ⇠ T-092, T-099
      — Notes: `docs/task-notes.md` (T-101)
- [x] **T-102** Reveal notification at the departure-lounge moment ⇠ T-099
      — Notes: `docs/task-notes.md` (T-102)
- [x] **T-103** Accommodation detection — identify the most frequent overnight location
      ⇠ T-030
      — Notes: `docs/task-notes.md` (T-103)
- [x] **T-104** Accommodation masking applied by default to all exports (D-016) ⇠ T-103
      — Notes: `docs/task-notes.md` (T-104)
- [ ] **T-105** On-device 9:16 vertical video renderer — animated trace draw-on, stamps
      popping in collection order, camera flyover ⇠ T-059, T-074
      — **Split 2026-08-11 into T-105a and T-105b (D-042).** The composition is arithmetic and
      testable today; the encoder is not verifiable without a device. Same split as
      `stampRules`/`stampAwards`. T-105 stays open as the parent until T-105b closes.
- [x] **T-105a** The **composition** — what appears when, in what order, and where the camera
      is pointing ⇠ T-059, T-104
      — Notes: `docs/task-notes.md` (T-105a)
- [~] **T-105b** ~~MOVED TO v2 2026-08-12 (D-051)~~ **BACK IN v1 SCOPE 2026-08-16 (D-063).**
      Encode the storyboard to an MP4 ⇠ T-105a, T-105c
      — ⚠ **Not a commitment yet — a spike.** The deliverable that turns this into a promise is
      **one five-second MP4 written on the project lead's own Android**, not a plan. Until that
      exists, treat the video as unproven.
      — ✅ **The sampler landed 2026-08-18: `souvenir/frame.ts`** (pure, 15 tests). `frameAt(film,
      t)` turns the storyboard into what is on screen — eased camera, the trace drawn so far, the
      stamps landed and how long ago, the finale's numbers — plus `frameTimes` for the encoder's
      schedule and `projector` for lat/lon → pixels. **The remaining half of T-105b is the encoder
      itself**, which needs Kotlin and a device (`docs/video-encoder-research.md`).
      — ⚠ **It is deliberately not a bet on the video.** The same `frameAt` drives an in-app
      **replay** from a wall clock — see **OD-12**, which the project lead opened the same day.
      — ✅ **`tools/preview-film.mjs` draws a contact sheet**, because nobody had ever seen a frame.
      — ⚠⚠ **THE TARGET CHANGED 2026-08-18 (D-076): the film is the map now**, so encoding it means
      encoding **Google's map**, not frames this app draws. That makes the encoder half *less*
      certain than `docs/video-encoder-research.md` assumed — a native map renders on its own
      surface, `captureRef` over it is not reliable, and the Maps SDK's `snapshot()` is slow and
      may not be exposed by `expo-maps`. **Treat the exported video as an open spike again.**
      — ⚠⚠ **AND THERE IS NOW A LICENCE TO OBEY.** Google's Geo Guidelines permit Maps imagery in
      online video for *"educational, instructional, recreational, or entertainment purposes"*
      without asking — a user posting their own holiday is squarely that. But **the attribution
      must survive**: *"Don't remove, obscure, or crop out the attribution information"*, and it
      must stay beside the imagery. **The encoder may not crop the Google wordmark and no overlay
      of ours may cover it.** ⚠ The replay's hero number is centred low and the wordmark sits
      bottom-left; **nobody has checked whether they collide** — that check belongs to this task.
      ⚠ **Our own marketing video is a different case and needs Google's approval** (T-133/T-161).
      — ⚠ **The old framing worry below is obsolete.** With a map under the trace there is no empty
      frame to fill, and the three options are moot (D-076).
      — ⚠⚠ **What it found before the rewrite, kept because it is why the rewrite happened:**
      Measured on all three routes: the trace fills **108 px of 108 across** and **10–35 px of 192
      down**. An east–west walk in a portrait frame is a thin horizontal line floating in a tall
      black rectangle — and most of Madeira's coastal and levada routes run east–west. The
      arithmetic is right and the picture is poor, which is exactly the failure the second-renderer
      rule exists to catch (the stamp mark that passed every geometry test and rendered as a
      crosshair).
      — **Three ways out, none chosen — this wants the project lead's eye:** (a) **rotate the
      camera** to the route's principal axis so the walk runs down the frame, which is what Relive
      does and is the only option that actually fills it; (b) **use the empty space** — the walk is
      a band and the rest is the card's words, stamps and hero, which is closest to the still
      souvenir already approved (T-105d); (c) **accept it**. ⚠ Option (a) is a real change to
      `composition.ts` and would need its own tests.
      — Notes: `docs/task-notes.md` (T-105b)
- [x] **T-105c** ✅ **Answered 2026-08-18 — `docs/video-encoder-research.md`.** ⇠ D-051, D-063
      — **Recommendation: a small Expo local module over Android's own `MediaCodec` + `MediaMuxer`,
      adding no third party.** The D-043 network audit it owes is the shortest this project will
      write: system APIs only, no package added, **nothing to audit and T-117's verdict unchanged**.
      — **`ffmpeg-kit` is confirmed dead**, as suspected: retired January 2025, **binaries removed
      from Maven Central, CocoaPods and npm on 1 April 2025**, repository archived. Forks exist
      (`FFmpegKitNext` and others) and none is a successor — rejected as the largest dependency the
      app would carry, with a network-capable protocol layer compiled in, and no owner to make the
      audit ever end.
      — ⚠ **The blocker is not the encoder, it is the frames.** `composition.ts` says what the film
      is; nothing turns time *t* into a bitmap. Three options are costed in the doc. Recommended:
      sample in JS and photograph the existing view with `captureRef` — one renderer, reuses
      T-105d — **gated on measuring capture time on the first real device**, because 150 readbacks
      of a 1080 × 1920 view against T-109's ~30 s budget is unmeasured and could fail on its own.
      — ⚠ **Three pitfalls recorded before the device finds them:** the configured frame rate is
      ignored (`presentationTimeUs` is the real clock); the output must be drained or the encoder
      hangs rather than errors; **1080 × 1920 is not guaranteed** — `VideoCapabilities` must be
      asked, and a cheap Android is exactly where T-105b will be tested.
      — ⚠ **The premise was checked and does not hold: WalkNYC has no video** — see
      `docs/competitors.md`. It replays a walk in-app and shares a *link*. The video is a bet this
      project is making and the reference app is not.
- [~] **T-105d** ✅ **STARTED 2026-08-16 — the card is composed and can be looked at.**
      `app/src/souvenir/shareCard.ts`: a 9:16 layout — destination, dates, the hero `23 / 60`, the
      trace, the places named, the app's mark — plus an SVG renderer, which is what
      `react-native-svg` (already a dependency) draws. 12 tests.
      `tools/preview-souvenir.mjs` writes the same card to `tools/out/souvenir-card.svg`, from a
      real route cleaned by the app's own `traceCleanup`, so the souvenir cannot flatter the map.
      — ⚠ **The preview earned its keep immediately**: the names were set on one line and shrunk to
      fit, which took the most personal line on the card down to 20 px on a 1080 px image. They
      wrap now, at a size chosen to be read.
      — ✅ **And it can now leave the app, 2026-08-16.** The project lead chose the capture
      library. `react-native-view-shot` photographs the drawn card; `expo-sharing` hands the PNG to
      the OS share sheet; both are audited in `docs/dependency-audit.md` and **neither makes a
      network request** — what changed is that the user can hand a file to another app *on purpose*,
      which is what D-001 always allowed.
      — ⚠ **The card is drawn from data, never screenshotted from the UI**, so the trace goes
      through `getExportableTrace()` and the accommodation masking D-016 requires. A capture of the
      map screen would have bypassed the only door D-040 permits.
      — **Share lives on the passport**, opposite the back control where iOS puts it. The card is
      mounted off-screen to be photographed and unmounted after: `captureRef` photographs a view,
      not a description.
      — ✅ **VERIFIED ON THE EMULATOR 2026-08-16.** Rebuilt with the new native modules, tapped
      Share, and the Android share sheet opened with the real card in its preview: *Madeira*, the
      dates, `1 / 60`, the drawn trace, *Forte de São Tiago*, the app's mark. The SVG → PNG →
      share-sheet path works end to end.
      — ⚠ **And it settled a question the tests could not**: Hermes has no
      `Intl.DateTimeFormat.formatRange`, so the card takes the spelled-out fallback — *"August 14,
      2026 – August 16, 2026"*. The feature detection is the live path, not a precaution.
      — ⚠ **Two bugs found while building it, both by tests.** `formatDateRange` printed
      *"12–August 19, 2026"* on a month-first locale, because the same-month shortcut assumed the
      day comes first; it uses `Intl.DateTimeFormat.formatRange` now, feature-detected because
      Hermes ships a partial `Intl`. And the pure/impure split earned itself again: the formatter
      could not be tested while it sat in the module that imports `expo-sharing`.
      — ~~DROPPED 2026-08-12~~ **REVIVED 2026-08-16 (D-063), and it goes first.** Make
      the trip worth sharing as a **still image** — the trace, the number, the stamps earned —
      plus the share sheet. ⇠ T-074, T-107, T-108
      — **Why first: it is the only part with no unknowns.** No native code, no new dependency,
      both platforms, and it can be judged in the workbench before it reaches a phone. It is most
      of the distribution value at a small fraction of the risk, and it does not compete with the
      soak tests for the phone's time.
      — Notes: `docs/task-notes.md` (T-105d)
- [ ] **T-105b-v2** Encode the storyboard to an MP4 on the device ⇠ T-105a, T-105c *(v2)*
      — Needs native video encoding, which is the part that cannot be verified without a
      device. It consumes `Composition` and needs no judgement of its own.
      — Also where the *look* is decided: whether the finale shows a denominator (D-042 carries
      both numbers deliberately), and whether the guessed durations survive being watched.
- [ ] **T-106** Watermark ⇠ T-105b
      — **Specified by D-089 rule 8 (2026-09-25).** Free: a medium mark in the lower third (5.2% of
      the frame in `preview-film.mjs --watermarks`) plus a 2 second *Made with Bruma* end card (the name from `brand.ts`, never a literal).
      Paid: the small mark (0.9%, bottom right), no end card. Google's attribution clear of both.
      Exported file only; the in-app replay is never marked.
- [x] **T-107** Still-image export ⇠ T-105b
      — Done 2026-08-16 as part of T-105d, and **verified on the emulator**: the card is drawn
      by `react-native-svg` and photographed by `react-native-view-shot` into a PNG. Checkbox
      corrected 2026-08-17; the work shipped in `53a67e1`.
- [x] **T-108** Share sheet integration ⇠ T-105b, T-107
      — Done 2026-08-16 as part of T-105d. `expo-sharing` hands the PNG to the OS share sheet;
      the Android sheet opened with the real card in its preview. Checkbox corrected 2026-08-17.
- [ ] **T-109** Verify render completes on-device in under ~30 seconds ⇠ T-105b
- [ ] **T-110** Verify the accommodation is not identifiable in a default export ⇠ T-104
- [ ] **T-111** Verify the reveal works when the app has not been opened since install day
      ⇠ T-102

**Milestone M5 — "It hands you a souvenir"** ⇠ T-109, T-110, T-111

---

## Phase 6 — Simplicity, accessibility and compliance

### UX reduction

- [~] **T-112** Ruthless UI reduction pass — one primary screen, one hero number ⇠ T-075
      — ⚠ **D-062 (2026-08-16) is this task winning an argument, and it is worth reading as
      precedent**: region progress had a decision behind it (D-027) and a computed number ready
      to render, and it still does not go on the map screen, because the screen is allowed three
      things. The fourth control has to be asked for by the product, not by the data.
      — **Started 2026-08-13, from screenshots rather than from reading the code.** Three things
      the running app was doing that no test could see: a LogBox toast for the known T-063b glyph
      error sat **on top of the passport button** (a tap opened a red error page instead of the
      passport); the passport's stamps were 62 dp postage stamps in mostly-empty cards; and empty
      category rows were full-height grey slabs. Now: the known error is silenced by its exact
      text, stamps are 96 dp, and an empty row is a slim outline.
      — **Measured again 2026-08-16, this time from a checked-in script**
      (`tools/ui-audit.js`, run in the workbench). Every screen, every control:
      **13 screens, no overlaps, no clipped text, nothing off the edge**, and the primary screen
      is at **2 controls (Always) / 3 (While-Using)** — which is design brief §3's target met,
      and no sign of the banner accumulation the reference app suffers.
      — ⚠ **One failure, and it was invisible to the last measurement pass.** The passport's
      *See all* (added by T-144) is a 41 × 19 dp word carrying `hitSlop={spacing.sm}` — a
      **57 × 35** target against the 60 dp floor D-015 chose over the platform's 44. Now
      `SEE_ALL_HIT_SLOP`, four measured sides, 65 × 60, with ~8 dp of clearance to the sticker
      below it.
      — ⚠ **Why T-113's pass could not have seen it: react-native-web does not render `hitSlop`.**
      The DOM shows the *word*, not the target, whatever the prop says. So the measurement is
      necessary and not sufficient, and `accessibility.test.ts` now refuses a `hitSlop` written
      as one number — the shape that cannot be checked against anything. Probed: the rule fails
      on the old line and passes on the new.
      — **What is left is judgement, not measurement**: whether anything on these screens should
      be *removed*. That wants the project lead's eye and T-065 (outdoors, at arm's length).
      — Target is already set by `docs/design-brief.md` §3: map plus three controls. Watch
      specifically for banner/promo cards accumulating over the map; the reference app loses the
      top third of its map to two stacked dismissible banners.
- [x] **T-113** Tap targets 60dp minimum, high contrast, large type throughout ⇠ T-112
      — Notes: `docs/task-notes.md` (T-113)
- [x] **T-114** Minimal plain-English onboarding, no jargon ⇠ T-042
      — Notes: `docs/task-notes.md` (T-114)
- [x] **T-115** Landmark tap → minimal card (name, photo, distance, one Directions button
      handing off to Apple/Google Maps). No in-app navigation. (D-018) ⇠ T-066
      — Notes: `docs/task-notes.md` (T-115). Decision: **D-052**.
      — ⚠ **No photo, and no distance in the common case.** The content pack has no photo field;
      the distance is withheld unless the recorder has a fix under 30 minutes old.
      — ⚠ **Revised the same day by the project lead:** the map no longer draws every place. The
      route to a place is **passport → tap a stamp → card → Show on map** (D-052 revised).
      — **Emulator-checked, with screenshots**, against a temporary fixture pack: the stamp opens
      its card, *Show on map* flies the camera to the trailhead and marks it, and Directions
      launched Google Maps. The `geo:` fallback and iOS are still unverified.
- [x] **T-116** Cap notifications at two per trip (D-011) ⇠ T-049, T-102
      — Notes: `docs/task-notes.md` (T-116)
- [x] **T-116a** Move the island's name out of the reveal notification (D-017) ⇠ T-102
      — Notes: `docs/task-notes.md` (T-116a)

### Privacy and compliance

- [x] **T-117** **Dependency network audit** — confirm zero SDKs transmit anything. This is
      where these apps actually leak. ⇠ T-029
      — Notes: `docs/task-notes.md` (T-117)
- [ ] **T-117b** **Confirm zero outbound connections on a real device** — packet capture during
      the T-051 soak, where it costs nothing extra to watch. Specifically: no FCM registration
      (D-043), no `exp.host`, no asset CDN, no tile requests. ⇠ T-117, T-051
- [x] **T-117a** ✅ **ANSWERED 2026-08-18 by building the first release APK this project has ever
      produced — and it was half good news.** ⇠ T-029
      — ✅ **The scaffolding's code is gone.** No `expo-dev-launcher`, no dev menu, and **no ML Kit
      barcode library** — the 5.9 MB `libbarhopper_v3.so` measured in the debug APK is absent.
      — ⚠⚠ **THREE OF ITS PERMISSIONS WERE NOT, and they were ours.** `SYSTEM_ALERT_WINDOW`,
      `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` sat in the app's **own**
      `AndroidManifest.xml` (lines 12, 10, 15), not in a library's — which is why every static
      check missed them and why they were trivially removable once seen.
      **`SYSTEM_ALERT_WINDOW` is the one that matters**: it is what screen-overlay malware needs,
      Play treats it as sensitive, and a user reading the permissions of a privacy-first walking
      app would have found *"display over other apps"* next to *"background location"*. The whole
      positioning is that this app asks for what it needs and nothing else (D-044, CONTEXT §4.8).
      — **Fixed by `plugins/withoutDevPermissions.js`**, which writes a release-only manifest with
      `tools:node="remove"`. Debug keeps the dev menu; release ships without them. ⚠ A config
      plugin rather than a hand edit, because `android/` is generated and `npx expo prebuild` would
      silently put the permission back. **Verified by rebuilding and dumping the APK: all three
      gone.**
- [~] **T-117e** **Release signing — the wiring is done, the key is the project lead's to make.**
      — ⚠⚠ **The template signed release with the PUBLIC Android debug key**, its own *"Caution!"*
      comment still attached. **That key is not weak, it is public**: `CN=Android Debug`, alias
      `androiddebugkey`, password `android`, issued 2013, identical on every machine with an
      Android SDK. A release signed with it means **anybody can sign an update Android accepts as
      ours**.
      — ⚠ **CORRECTION to what was written this morning:** `debug.keystore` is **not** committed —
      `android/` is gitignored. Nothing was exposed. The danger was never the file, it is what it
      signs, and that is worse rather than better.
      — ✅ **`plugins/withUploadSigning.js`**: release uses an upload keystore when one is
      configured, falls back to debug when not, and **prints which key signed it on every release
      build**. ⚠ The fallback is deliberate — Firebase Test Lab (D-077) installs debug-signed
      release APKs happily, and making the build fail would cost the only route to real hardware
      for no gain, because Play rejects the debug key outright anyway.
      — ⚠ **What is left is not code.** The project lead generates the key, chooses the password,
      and puts four properties in `~/.gradle/gradle.properties` — **their home directory, never
      this repository**. The `keytool` command and the exact property names are in the plugin's
      header. ⚠⚠ **Losing that password means never being able to update the app.**
      — ⚠⚠ **AND THEN THE MAPS KEY.** Google re-signs uploads, so the SHA-1 a released build
      presents is **Google's**, not ours. It has to be added as a second entry on the Maps API key
      restriction or **the map is grey for every real user** while working perfectly in our builds.
      Play Console shows it under *Setup → App integrity → App signing key certificate*.
      — ✅ **Verified by regenerating `android/` from scratch** (`expo prebuild --clean`): both this
      plugin and `withoutDevPermissions` reapplied, the build succeeded, the warning fired, and the
      APK still measures 35.9 MB with no MapLibre and no dev permissions.
- [ ] **T-117c** ⚠⚠ **The release APK carries FCM and the Play install referrer, and neither is
      ours** — found the same day, and this is the sharper half of what T-117a went looking for.
      — `com.google.android.c2dm.permission.RECEIVE` comes from
      **`com.google.firebase:firebase-messaging:25.0.1`**, pulled in by **`expo-notifications`** —
      which this app uses for **local notifications only** (D-011, two per trip).
      `BIND_GET_INSTALL_REFERRER_SERVICE` comes from `com.android.installreferrer:2.2`.
      — ⚠ **A permission is not a network call**, and `docs/dependency-audit.md` still stands: no
      code path in this app registers for push. But the audit was **static and never looked at a
      release manifest**, because none existed until today. **What ships now requests the right to
      receive push messages**, and that is what a reviewer and a careful user actually see.
      — **What to decide:** whether local notifications are worth carrying FCM for, or whether they
      should move to a smaller library. ⚠ Feeds T-117b, T-127, and the Data Safety answers.
- [x] **T-117d** ✅ **The release APK is 36 MB. Was 128.**
      — ⚠ **CORRECTION, same day.** The first note here called *"128 MB"* the problem. **It is not,
      or not mostly.** That was a **universal** APK carrying four ABIs, two of them (`x86`,
      `x86_64`) emulator-only. Play never ships a universal APK — an AAB sends each device only
      its own. **Rebuilt with `-PreactNativeArchitectures=arm64-v8a`: 48 MB.** So a real user was
      always going to download ~48 MB, and the 128 MB matters only for artefacts installed
      directly, like the one going to Test Lab.
      — **Measured:** native libraries are **108 MB of the 128** — arm64 28.6, x86 30.0, x86_64
      29.4, armeabi-v7a 20.2.
      — ✅ **Done: the Test Lab artefact is the arm64 build**, `proa-arm64-release.apk`. Real
      phones are arm64; the emulator slices are dead weight in a file being uploaded.
      — ⚠⚠ **WHAT IS LEFT IS REAL AND NEEDS THE PROJECT LEAD.** `libmaplibre.so` is **10 MB of the
      48 MB a real user downloads — 21% of the app — for a map the app never opens.** D-057
      replaced MapLibre with the platform's map, and `MapLibreScreen.tsx` is imported by nothing:
      `App.tsx` mentions it only in a comment.
      — ✅ **RESOLVED 2026-08-18 — the project lead took option (a).** `MapLibreScreen.tsx` moved to
      **`app/attic/`**, tracked in git and excluded from `tsconfig`; `@maplibre/maplibre-react-native`
      removed from `package.json` **and from `app.json`'s plugin list**. ⚠ **Nothing was deleted**,
      which was the whole of the original instruction.
      — **48 MB → 35.9 MB.** Better than the 10 MB predicted, because dropping the package also
      took its Java classes out of the dex, not just `libmaplibre.so`.
      — ⚠ **`tiles/` did not move and should not.** It is build tooling — 11 tracked files, the
      generated output is gitignored — and it has never been inside the APK. Neither did
      `assets/map/light.json`, which the **Google** path still reads for the clutter rules and the
      dark fallback, nor anything in `src/map/`, which is shared with the shipping map and the
      souvenir film. **The cartography was never MapLibre's to take with it.**
      — ⚠ **The attic is not type-checked and will rot**, accepted knowingly: the file has no
      tests, is never rendered, and *"still compiles"* was always a weak guarantee that it still
      works. `app/attic/README.md` says what would be needed to revive it.
      — ✅ **The AAB builds too, first time: 74.6 MB**, carrying all four ABIs — which is correct,
      because an AAB is a *container* Play generates per-device APKs from. **An arm64 user
      downloads the arm64 slice, ~48 MB or less** once density and language splits are applied. So
      the store number was never 128 MB.
      — ⚠⚠ **BUT IT CANNOT BE UPLOADED.** `build.gradle`'s release block still signs with the
      **debug keystore** — the template default, with its *"Caution! In production, you need to
      generate your own keystore"* comment intact, and `debug.keystore` is **committed to this
      repository**. A real upload key has to be generated and kept out of the repo before anything
      reaches Play. ⚠ And when it is: **Google re-signs uploads**, so a second SHA-1 must be added
      to the Maps API key or the map is grey for every real user while working perfectly here.
- [ ] **T-117a** **Confirm the development scaffolding is inert in a release build.** Distinct
      from T-117, which is about network behaviour and would not look at this. Two things to
      check: the `expo-dev-client` permissions (`SYSTEM_ALERT_WINDOW`,
      `READ/WRITE_EXTERNAL_STORAGE`, `NSAllowsArbitraryLoads`) are absent, and the synthetic POI
      fixture cannot run — `app/index.ts` only wraps the catalogue in
      `withDevFixtureFallback` when `__DEV__`, and shipping a ring of invented geofences around
      the user would be absurd. ⇠ T-029
      — **A third thing to check, measured in the debug APK 2026-08-12:** `expo-dev-launcher`
      contributes **ML Kit barcode scanning** — `lib/*/libbarhopper_v3.so` at 5.9 MB plus
      `assets/mlkit_barcode_models/*.tflite` at 0.78 MB. It is there for the dev server's QR
      scanner. Expected to vanish in release along with the rest of the dev client, but it is a
      *camera-adjacent, model-carrying* dependency on an app whose entire pitch is that nothing
      leaves the device, so confirm its absence explicitly rather than by assumption — this is
      exactly the class T-117 was written to catch (CONTEXT §4.8).
- [x] **T-118** iOS `PrivacyInfo.xcprivacy` manifest, including third-party SDK declarations
      ⇠ T-117
      — Notes: `docs/task-notes.md` (T-118)
- [ ] **T-119** iOS purpose strings for While-Using and Always ⇠ T-042, T-043
- [x] **T-120** iOS Privacy Nutrition Label ⇠ T-117
      — Notes: `docs/task-notes.md` (T-120)
- [x] **T-121** Android prominent-disclosure screen before requesting background location
      ⇠ T-043
      — Notes: `docs/task-notes.md` (T-121)
- [~] **T-122** Android Data Safety form — no data collected, no data shared ⇠ T-117
      — Notes: `docs/task-notes.md` (T-122)
      — ⚠ **Reopened 2026-09-23.** The release APK carries the Maps SDK, FCM and the install
        referrer (T-117c), and Play counts what third-party SDKs collect. Redo the answers
        against Google's own data disclosures for each SDK in the APK ⇠ T-194.
      — ✅ **Drafted 2026-09-24** in `docs/store-privacy-answers.md`, each row sourced. The
        Maps SDK makes the answer **Yes, collected**: crash logs, diagnostics, a pseudonymous
        device ID, app interactions. Location is **not** declared, because IP is not used to locate.
        Firebase and the install referrer send nothing: Firebase never initializes (seen on the P30),
        and the referrer's permission was removed. ⚠ **Two calls are the project lead's:** *shared
        or not* (the service-provider exception) and *deletion: No* (Google holds the SDK's data).
        Also one sentence to add to the in-app policy in three languages (D-044). Billing (T-156)
        adds purchase history.
- [ ] **T-123** Google Play background-location review submission with demonstration video and
      written justification ⇠ T-121, T-122
- [x] **T-124** Privacy policy (short, because there is genuinely nothing to disclose) ⇠ T-117
      — Notes: `docs/task-notes.md` (T-124)
- [x] **T-125** "Delete all my data" control ⇠ T-030, T-141
      — Notes: `docs/task-notes.md` (T-125)
- [x] **T-141** Settings screen (`docs/design-brief.md` §5) ⇠ T-042
      — Notes: `docs/task-notes.md` (T-141)

### Verification

- [ ] **T-126** Untrained older tester completes install → first stamp with no help ⇠ T-114,
      T-113
- [ ] **T-127** Network monitor shows zero outbound requests over a full simulated trip
      ⇠ T-117
- [ ] **T-128** Both store privacy declarations verified truthful ⇠ T-120, T-122

**Milestone M6 — "It is honest and easy"** ⇠ T-123, T-126, T-127, T-128

---

## Phase 7 — Beta and launch

- [ ] **T-129** Recruit closed beta testers taking real Madeira trips ⇠ M6
- [x] **T-130** Voluntary trace export mechanism — explicit user action only, never automatic
      upload ⇠ T-125
      — Done 2026-08-16 as **D-069**, Settings → *Send a walk*: the masked trace, every stamp
      decision with the numbers that drove it, and the thresholds in force, handed to the same
      share sheet the souvenir uses. **No endpoint, no account, no identifier** — a test asserts
      the payload's exact key list, so a helpful new field fails the suite rather than a promise.
      Checkbox corrected 2026-08-17; the work shipped in `3257592`.
      — ⚠ It answers this task and OD-11, but it is **not** the beta-tuning input T-131 assumes:
      that wants traces from testers who do not yet exist, and the walks arrive unlinkable, so
      ten walks from one walker cannot be told from ten walkers.
- [ ] **T-131** Tune matching thresholds and geofence radii against real trip data ⇠ T-130,
      T-094
- [ ] **T-132** Collect and act on beta feedback ⇠ T-129
- [ ] **T-133** Store listing — screenshots, copy, preview video ⇠ M6
- [ ] **T-134** Verify ≥10 real week-long trips recorded end to end with no tracking failure
      ⇠ T-129
- [ ] **T-135** Verify no beta tester reports a missing levada or a false stamp ⇠ T-132
- [ ] **T-136** Verify at least half of beta testers share their souvenir unprompted (this is
      the distribution hypothesis under test — D-013) ⇠ T-132
- [ ] **T-137** Submit to both stores ⇠ T-133, T-134
- [ ] **T-138** Launch ⇠ T-137

**Milestone M7 — Launched** ⇠ T-138

---

## Critical path

The longest dependency chain, and therefore the schedule driver:

```
T-013 (framework) ✅ RESOLVED — React Native
  → T-029 (scaffold) → T-031 (expo-location) → T-039 (geofence manager)
  → T-071 (stamp rules) → T-075 (primary screen) → T-112 (UI reduction)
  → T-123 (Play background-location review)  ← slow, external, budget generously
  → T-129 (beta) → T-137 (submit) → T-138 (launch)
```

Two items sit on the critical path and are **outside our control**: the Google Play
background-location review (T-123) and the real-world beta (T-129), which requires people to
actually go to Madeira for a week. Start both as early as possible.

**No longer a gate:** `T-024` (stable OSM way IDs in tiles) was previously the project's
critical decision gate. **D-022 retired it** — visited segments are drawn from our own local
geometry, so nothing depends on addressing tile features at runtime.

# Monetisation execution plan (D-089, D-091)

**Written 2026-09-25**, at the project lead's request, after D-089 (the free tier) and D-091
(billing through `expo-iap`) were Accepted the same day. This is the plan for **building** what was
decided. It is not a place to reopen the decisions: if something here seems to contradict D-089 or
D-091, the decision wins and this file is wrong. Say so and fix the file.

**Who it is for:** a fresh chat session starting the work cold, and the project lead reviewing it.
Read §0 first.

---

## 0. How to use this document

### Starting a new session on this work

Paste something like this into the new chat:

> Read `HANDOFF.md`, then `docs/monetization-execution-plan.md` in full. We are starting Phase N.
> Before writing code, restate the phase's tasks, the files you expect to touch, and the tests
> that must fail if the change is reverted.

Then, in order:

1. **Read this file in full.** It is written to be read whole; the big reference documents are not
   (CLAUDE.md, "Keep sessions cheap").
2. **Look up, do not read:** `grep -A60 "^## D-089" docs/decisions-full.md` and
   `grep -A50 "^## D-091" docs/decisions-full.md` for the decisions in full.
3. **Read §3 (the project lead's decisions).** All nine were answered on 2026-09-25 by accepting
   the recommendation, so §3's recommendation column is the decision.
4. **Work one task at a time,** in the order of §5, and finish it by the definition of done (§1.3)
   before starting the next.

### What "done" means for the whole plan

Gate R3 in `TASKS.md` ("billing works end to end including restore") is met, every row of the
verification matrix in §6 has recorded evidence, and every document in §8 is updated. Nothing less
counts as done, and a partial state is reported as partial.

---

## 1. Ground rules for this work

This project is small, but it is run like a professional codebase with a paying customer on the
other side. These rules are not optional and each has cost something to learn.

### 1.1 Engineering standards

| Rule | What it means here |
|---|---|
| **Pure logic in its own module, an impure wrapper beside it** | Every decision (who is unlocked, which stamps show, whether a medal is complete, whether a purchase is a founder purchase, where the sheen sits) lives in a pure module with no Expo, no database, no clock and no i18n. The impure half (database, store, sensors) only gathers inputs and applies outputs. Only the pure half can be tested without a phone, which is why the split exists. |
| **One file talks to the store** | `entitlement/storeBilling.ts` is the **only** file allowed to import `expo-iap`. A test enforces it, the way `freeTier.test.ts` already forbids the geofence modules from importing `freeTier.ts`. If the library is ever swapped (D-091's exits: `react-native-iap`, RevenueCat), one file changes. |
| **Tested modules import with an explicit `.ts` extension** | Node's resolver needs it; Metro does not mind. Everything else stays extensionless. |
| **Pure modules never import `i18n/index.ts`** | It reaches `expo-localization` and breaks every Node test. Pass a `Language` or a pre-translated string, the way `nowMs` is passed. |
| **User-facing text lives in `app/src/i18n/strings.ts`, in English, Portuguese and German** | Never a literal in a component. `i18n.test.ts` and `i18nCoverage.test.ts` enforce it. |
| **No dash (— or –) in any text a user reads**, in any language | Enforced by `i18n.test.ts` and `privacyPolicy.test.ts`. Use a comma, a colon or a full stop. |
| **No Madeira knowledge in `app/`** (D-017, absolute) | The **product ID**, the **founder window** and the **medal sets** live in `content/`, not in `app/`. See §4.2. |
| **No hardcoded price anywhere in the app** | The price shown is the one Google returns for the user's country and currency. `€5.99` is a Play Console setting, not a string. |
| **Exact dependency versions for billing** | `expo-iap` is pinned to one exact version (no `^` or `~`), because it releases often and its API has changed between versions (D-091). Upgrades are their own commit with their own verification. |
| **Typed outcomes, not thrown strings** | The store adapter returns a small closed set of outcomes (§4.3). Every outcome has a defined screen state. No `catch {}` that swallows an error silently: an unexpected error is at least recorded where the Debug screen can show it in a field build. |
| **Never log a purchase token or order ID** | Not to the console, not to a file, not in a test snapshot. They identify a purchase. The app stores only what it needs (§4.4). |
| **`tsc` strict stays clean, and the whole suite stays green** | `npm --prefix app run typecheck` and `npm --prefix app test` before every commit. Record the test count in the commit body when it changes. |

### 1.2 Transparency standards

| Rule | What it means here |
|---|---|
| **Say which half you mean** | "Tested" means unit tested in Node. "Seen" means on the P30 or the workbench, and say which. "Verified" for billing means a real test purchase on an internal testing build (§6). Never blur them. |
| **Never state a measured-sounding number that was not measured** | Frame times for the tilt, battery cost of the sensor, conversion: measured or labelled as a guess. |
| **Check that a measurement actually ran** | If a result does not move when the input changes, suspect the probe (CLAUDE.md). |
| **Report partial work as partial** | A purchase flow that works except restore is "works except restore", in the commit subject too. |
| **Commit messages** | Subject: task IDs, then what it does in plain words. Body: the why, the rejected alternative, and anything found or broken along the way. Written to a file and committed with `git commit -F`. Ends with the co-author line in CLAUDE.md. |
| **Docs in the same commit** (CONTEXT §9) | Each task lists the documents it touches (§8). A task whose docs are stale is not done. |

### 1.3 Definition of done, per task (from `TASKS.md`)

A task is done when it has all four:

- **(a) the change**,
- **(b) a test that fails if the change is reverted** (write it first and watch it fail),
- **(c) evidence on the P30** (`adb shell uiautomator dump`, `dumpsys` or a `sqlite3` query) for
  anything a user can see, and for billing, the verification row in §6,
- **(d) the documents updated in the same commit.**

Screenshots only where the question is visual (artwork, the sheen, layout), and then one, not five.

---

## 2. Scope

### 2.1 In v1 (this plan)

| # | Item | Decision |
|---|---|---|
| 1 | Free allowance **5 stamps + the first levada** (was 10 + first levada) | D-089 rules 2, 3 |
| 2 | **One non-consumable purchase**, €5.99 set in Play Console, "all of Madeira, forever" | D-089 rule 5 |
| 3 | **Billing through `expo-iap`**, straight to Google Play, no server, no account | D-091 |
| 4 | **Unlock screen** and its entry points, with **restore** in Settings | D-089, T-157 |
| 5 | **Founder stamp** for purchases in the first 3 months after the public launch | D-089 rule 6 |
| 6 | **Set medals** (a municipality; all levadas), paid only, progress visible free | D-089 rule 6 |
| 7 | **Tilt and shine** on stamps, free and paid alike | D-089 rule 7 |
| 8 | **Privacy and store paperwork** for the first network calls of the app's own | study Q9 |

### 2.2 Not in v1

- **The exported video and its watermark** (T-105b-v2, T-106). v1.1, with the rules in D-089 rule 8.
  Nothing in this plan touches the video.
- **Real 3D inspect.** The long-term goal. Nothing here should make it harder: keep the tilt math
  in a pure module that a 3D renderer could reuse.
- **Rare stamp variants, a printable poster, hotel codes.** Later ideas (D-089 FINAL, rejected
  for now).
- **iOS.** No Mac.

### 2.3 Ruled out for now

**Not "never".** The project lead, 2026-09-25: these are a firm no today, but the future may
change them. Each can be reopened, **by a new decision that records why**, not by drifting into
the code: a subscription, ads, user accounts, a server of ours, a third party between the phone and
Google (D-091), any limit on the map.

**The one that is a commitment rather than a preference:** nothing given free after the public
release is taken away from the people who already had it (D-089 rule 9). A future change of model
can add a paid thing or change what *new* users get, but it cannot remove something from existing
users without breaking a promise they relied on. That is why the free allowance may go up and not
down.

### 2.4 A parking rule this plan overrides, stated so nobody trips on it

`TASKS.md` parks "T-158 artwork" and "new content" until Gate R1. The project lead put tilt and
shine and set medals **in v1** on 2026-09-25 (D-089). The medal artwork and `content/medals.json`
are therefore unparked **for this plan only**. Other parked items stay parked.

---

## 3. Decisions for the project lead, each with a recommendation

✅ **All nine answered 2026-09-25: the project lead accepted every recommendation below.** The
"Recommendation" column is therefore the decision, and D-089's text records it. The column
"Needed by" stays to show which phase each one shapes.

| ID | Question | Recommendation | Needed by |
|---|---|---|---|
| **OQ-1** | **The rank thresholds.** `passport/stampTier.ts` sets silver at 10 and says why: *"it is exactly where the free tier ends"*. That reason is now false. | **Keep 1 / 10 / 25 / all**, and rewrite the reason: the rank counts what you **collected** (locked stamps included, D-075), not what you paid for, so it needs no link to the allowance. Moving silver to 5 would only make silver arrive at the same moment as the lock. | Phase 1 |
| **OQ-2** | **Do medals and the founder stamp count** towards the rank and the "3 de 80 lugares" line (D-090)? | **No.** Both count *places*. A medal is not a place and the founder stamp is not a visit. They get their own section in the passport. | Phase 3, 4 |
| **OQ-3** | **Which sets earn a medal?** Places per municipality today: Porto Moniz 15, Funchal 14, Santana 12, Machico 11, Calheta 9, São Vicente 6, Câmara de Lobos 4, Ribeira Brava 4, Santa Cruz 4, **Ponta do Sol 1**, Porto Santo 0. | **One seal per municipality with at least 3 places** (9 seals; Ponta do Sol's single place would be a medal for one stop), **plus one "all levadas" medal** (18). Other category medals (all 19 viewpoints, and so on) are easy to add later as content, and adding is never a rug pull. The minimum of 3 is a content rule the validator enforces. | Phase 4 |
| **OQ-4** | **Where does the tilt and shine appear?** | **On the place card's stamp** (T-218, where one stamp is shown large) and on the **unlock screen's hero stamp.** The passport grid gets a **static** sheen (no sensor): 80 stamps moving at once is noise, and a sensor running while you scroll a grid costs battery for nothing. | Phase 5 |
| **OQ-5** | **Promo codes, testers and the founder stamp.** A redeemed Play promo code is a purchase with a purchase time, and so is a license tester's purchase before launch. | **Both count**, including purchases made before the launch date: they go to testers and friends, the people who were there first. So the rule is simply *bought before the window closes*. | Phase 3 |
| **OQ-6** | **The price in the store listing text.** `docs/marketing-plan.md` §4 says "EUR 5.99", but D-089 accepts Play's regional prices, so a British visitor sees pounds. | **Say "one payment" without a number** in every listing language, and let Play show the price. The number stays in the euro listings only if the project lead prefers it there. | Phase 6 |
| **OQ-7** | **"Erase all" and the purchase.** `Apagar tudo` (T-125) erases the app's data. Should it erase the local copy of the unlock? | **Yes, erase it.** The purchase lives in the Google account and comes back at the next launch with a network. The cost: after erasing, while offline, the passport shows locked until the phone next sees a network. Say so in the confirmation text. | Phase 2 |
| **OQ-8** | **The wording of the lock, the offer and the pending state** (T-157). The storyboard review with 3 people was dropped. | **The project lead reads the Portuguese aloud** before the commit that ships it. English and German follow the Portuguese. | Phase 2 (T-156d) |
| **OQ-9** | **Medal and founder artwork.** Both need a design, and this project judges artwork by eye (CLAUDE.md). | Drawn **in-house from the stamp art system** (D-086), shown to the project lead through the preview renderer (`tools/preview-stamps.mjs`), approved or vetoed before the UI commit. | Phase 3, 4 |

---

## 4. Architecture

### 4.1 Module map

Read this table before touching anything. "Pure" means testable in Node with no phone.

| Module | Kind | New or changed | Responsibility |
|---|---|---|---|
| `app/src/entitlement/freeTier.ts` | Pure | Changed | Which earned stamps show. Allowance 10 → 5. Comments updated (€4.99, "ten", "eleven"). |
| `app/src/entitlement/purchaseRules.ts` | Pure | **New** | From the store's list of purchases, decide: unlocked or not, which purchases still need acknowledging, whether one is pending, and the purchase time to keep. |
| `app/src/entitlement/founder.ts` | Pure | **New** | Whether a purchase time falls inside the founder window. |
| `app/src/entitlement/storeBilling.ts` | Impure | **New** | **The only importer of `expo-iap`.** Connect, fetch the product, start a purchase, listen for results, acknowledge, query owned purchases, disconnect. Returns typed outcomes (§4.3). |
| `app/src/entitlement/storeBilling.web.ts` | Stub | **New** | The workbench has no Play Store. Returns scripted outcomes so every unlock state can be seen in the browser (the `backgroundTasks.web.ts` pattern). |
| `app/src/entitlement/billingSync.ts` | Impure | **New** | The lifecycle: at launch and on resume, query purchases, feed them to `purchaseRules`, write the result through `entitlementStore`, acknowledge what needs it. Also the purchase listener. |
| `app/src/entitlement/entitlementStore.ts` | Impure | Changed | Still the one place that decides "unlocked". Gains the stored purchase time (§4.4). Keeps its rule: **once true, never set back to false by a failed or empty lookup.** |
| `app/src/entitlement/betaBuild.ts` | Pure | Unchanged | A beta build is unlocked and shows no purchase screen (§4.6). |
| `app/src/progress/medals.ts` | Pure | **New** | From the medal definitions, the places and the awards: each medal's progress, whether it is complete, and when it was completed. |
| `app/src/content/contentPack.ts` | Pure | Changed | Reads the product ID, founder window and medal definitions from `content/` (§4.2). |
| `app/src/passport/medalArt.ts` | Pure | **New** | The medal and founder designs, as an element list, like `stampArt.ts`. |
| `app/src/passport/stampSheen.ts` | Pure | **New** | Tilt and shine math: sensor reading in, smoothed tilt angles and sheen position out; clamping; the reduced-motion and static cases. |
| `app/src/passport/tiltSensor.ts` | Impure | **New** | Subscribes to `expo-sensors` (already a dependency) only while a tilting stamp is on screen and the app is in the foreground. |
| `app/src/ui/UnlockSheet.tsx` | UI | **New** | The offer: what paying adds, the price from Google, Buy, Restore, Not now; every outcome state (§4.3). |
| `app/src/ui/StampArt.tsx` | UI | Changed | Accepts a sheen overlay, clipped to the stamp's own shape. |
| `app/src/ui/MedalArt.tsx` | UI | **New** | Draws `medalArt.ts`'s elements. |
| `app/src/ui/PassportView.tsx`, `PassportScreen.tsx` | UI | Changed | The medals section, the founder stamp, the entry point to the unlock sheet, T-157's one-time line. |
| `app/src/ui/PlaceCardView.tsx` | UI | Changed | The tilting stamp (OQ-4). |
| `app/src/ui/SettingsView.tsx` | UI | Changed | "Unlock the passport" or "Restore purchase" row; hidden in a beta build. |
| `app/src/storage/deleteAllUserData.ts` (and its test) | Impure | Changed | OQ-7. |
| `app/App.web.tsx` | Workbench | Changed | New scenarios (§4.7). |
| `tools/preview-stamps.mjs` | Tool | Changed | Second renderer for medals, the founder stamp and the static sheen. |
| `tools/validate-content.mjs` | Tool | Changed | Validates the product ID, the founder window and the medal sets. |
| `app/app.json`, `app/plugins/withoutUnusedPermissions.js`, `app/src/releasePermissions.test.ts` | Config | Changed | The billing permission (§4.5). |

### 4.2 What goes in `content/` (D-017)

The app must not know it is on Madeira. Three things added by this plan are about *this*
destination, so they live in content:

1. **The product ID.** In the pack's `destination` block (for example `"productId":
   "passport_madeira"`). ⚠ **A Play product ID is permanent**: it cannot be renamed, and a deleted
   ID cannot be reused. Choose it once, with the project lead, before creating it in Play Console.
   It names the region because a second region would be a second product (D-089 rule 5).
2. **The founder window.** Also in `destination`: `"founderWindow": { "start": null, "months": 3 }`.
   `start` stays **null until the public release** and is set, as an ISO date, in the release
   commit itself. While it is null nobody is a founder. `tools/smoke-release.mjs` must **fail a
   release build whose `start` is null**, so it cannot be forgotten.
   A purchase is a founder purchase when Google's purchase time is **before `start` plus 3
   calendar months** (UTC). Purchases before `start` count too (testers, early promo codes; OQ-5).
   Write the boundary cases as tests (the last millisecond inside, the first one outside).
3. **The medal sets.** A new `content/medals.json`, hand-written and validated:
   ```json
   { "formatVersion": 1,
     "medals": [
       { "id": "region-santana", "rule": { "region": "santana" } },
       { "id": "category-levada", "rule": { "category": "levada" } }
     ] }
   ```
   The medal's displayed name is **built** from data the app already has: the region's name from
   `regions.json`, the category's name from `strings.ts` (`passport.category.*`). No new place
   names in `app/`. `validate-content.mjs` checks that every rule matches at least 3 places
   (OQ-3), that IDs are unique, and that every region and category exists.

Run `node tools/validate-content.mjs`, then `build-regions.mjs --assign` and `build-levadas.mjs`
after any content edit (CLAUDE.md).

### 4.3 The purchase flow and its outcomes

**The outcomes `storeBilling.ts` returns.** A closed set; the UI has one state per outcome.

| Outcome | When | What the user sees | Unlocks? |
|---|---|---|---|
| `purchased` | Google confirms payment | The passport opens with every stamp revealed | **Yes** |
| `pending` | Cash at a shop, a slow card | "Payment pending. Your passport unlocks as soon as Google confirms it." | **No**, not until `purchased` arrives |
| `cancelled` | The user closed Google's sheet | Nothing; the sheet closes quietly | No |
| `alreadyOwned` | Google says the account already owns it | Run a restore, then unlock | Yes, after the restore |
| `offline` | No network | "You can unlock this later, when you have a connection." Never an error tone. | No |
| `unavailable` | No Play Store or Play Services on the phone (some Huawei models) | "Purchases need Google Play, which this phone does not have." | No |
| `failed` | Anything else | A short, honest message and a Retry | No |

**The order of operations for a successful purchase.** This order is the point:

1. Google reports a purchase in state *purchased*.
2. `purchaseRules` confirms it is our product and not pending.
3. **Save the unlock and the purchase time on the phone first** (`entitlementStore`).
4. **Then acknowledge it to Google** (`finishTransaction`, as a **non-consumable**).
5. Show the result.

Why save first: if the app is killed between 3 and 4, the next launch finds an owned but
unacknowledged purchase and acknowledges it. If it were the other way round and the app died
between them, the user would have paid and not been unlocked until the next query. Both recover,
but saving first never leaves a paying user locked.

⚠ **The two mistakes that silently cost every sale**, each with its own test:
- **Never acknowledging.** Google refunds an unacknowledged purchase after 3 days. Test: a purchase
  that `purchaseRules` marks as unacknowledged is always passed to the acknowledge call.
- **Consuming instead of acknowledging.** Consuming a one-time product lets it be bought again and
  **drops the ownership**, so restore would find nothing. Test: the adapter always calls
  `finishTransaction` with the non-consumable flag, and a test fails if that argument changes.

**When the app checks with Google:** at launch, and every time the app returns to the foreground
(Google asks for both, to catch a purchase completed while the app was closed, for example a
pending one that cleared). Plus the live purchase listener while the app is open.

**Refunds (D-091's accepted risk).** An empty answer from Google **never re-locks** a passport that
was unlocked. `entitlementStore.ts` already says so: only an explicit refund may take it away, and
`expo-iap` cannot see one without a server. Write the test that pins this.

⚠ **The API names above are indicative.** `expo-iap` has renamed functions between versions (for
example product fetching). Use the documentation **for the exact pinned version** and note the
real names in `storeBilling.ts`'s header comment.

### 4.4 What is stored on the phone

In the existing `app_state` key-value table (`storage/dao/appStateDao.ts`, which already has
`getFlag` / `getJson`). **No schema migration is needed.**

| Key | Type | Holds | Why |
|---|---|---|---|
| `stamps_unlocked` (exists) | flag | Unlocked or not | The passport renders offline, from the last known answer |
| `purchase_record` (new) | JSON | `{ "purchaseTimeMs": number }` | The founder stamp, offline. Nothing else. |

**Not stored:** the purchase token, the order ID, the account, the price paid. The app does not
need them, so it does not keep them.

**Medals are not stored at all.** They are derived every time from the awards already in the
database, so there is nothing to migrate, nothing to get out of step, and erase-all needs no
change for them.

### 4.5 The billing permission, and the test that will fail

`expo-iap` adds `com.android.vending.BILLING` to the Android manifest. Two guards in this repo
exist precisely to catch a new permission:

- `app/plugins/withoutUnusedPermissions.js` strips permissions the app does not need. Check it does
  **not** strip BILLING.
- `app/src/releasePermissions.test.ts` holds the list of permissions the release build is allowed
  (`NEEDED`). **It will fail when BILLING appears. That is correct.** Add BILLING to the list with
  a one-line reason (D-091), in the same commit that adds the library.

### 4.6 The beta build

D-084: a closed-beta build (`EXPO_PUBLIC_PROA_BETA=1`) is unlocked. In a beta build:
- no unlock sheet, no Buy or Restore row, no T-157 line;
- **no founder stamp** (it needs a real purchase);
- the store adapter is still compiled in, but `billingSync` does not start.

Testing real purchases therefore needs a **store build** (no beta flag) uploaded to the internal
testing track. ⚠ The Gradle trap in `docs/dev-build.md`: changing only the environment variable
does not re-bundle. Delete the bundle outputs between flavours and check the Settings version row.

### 4.7 The workbench (`npm --prefix app run web`)

The browser cannot buy anything, so `storeBilling.web.ts` scripts the outcomes. Add workbench
scenarios for:
- 5 free + first levada, with locked stamps beyond;
- each unlock outcome of §4.3 (pending, offline, unavailable, failed, purchased);
- medals: none started, in progress, complete but locked (free), complete (paid);
- founder: bought inside the window, outside it, window not set;
- the static sheen in the passport grid.

The existing scenario "23 stamps, free tier (T-155)" is updated to the new allowance.

---

## 5. Phases and tasks

New task IDs start at **T-232**. T-156 is split into lettered parts, as the project does elsewhere
(T-105b, T-105e). Add each to `TASKS.md` when it starts, with its notes inline; move the
post-mortem to `docs/task-notes.md` when it finishes.

**Recommended order and why:** billing first, because it is the release gate (R3) and depends on
outside steps that take days to come back (§5.0). While those are pending, the pure halves of
everything else can be built and tested.

```
Phase 0  Project lead: Play Console setup ─────────────────────────────┐
Phase 1  T-232 allowance 10 → 5 (OQ-1)                                 │
Phase 2  T-156a rules → T-156b adapter → T-156c sync → T-156d sheet ──┼─► Phase 7 verification
         → T-156e restore row                                          │   (needs Phase 0)
Phase 3  T-233 founder stamp (needs T-156a, OQ-2, OQ-5, OQ-9) ─────────┤
Phase 4  T-234 medals logic + content → T-235 medals UI (OQ-2/3/9) ────┤
Phase 5  T-236 sheen logic + preview → T-237 tilt on device (OQ-4) ────┤
Phase 6  T-238 privacy and store paperwork (OQ-6) ─────────────────────┘
```

### Phase 0: the project lead's steps (start on day one; they take the longest)

Not code. The assistant can guide each step, but only the project lead can do them: they are the
account owner, and several involve bank and tax details that the assistant must never type.

| Step | What | Notes |
|---|---|---|
| 0.0 | **The name, cleared** (T-187: the TMview and INPI search on "Proa", D-074) | ⚠ **Must be done before step 0.3.** The first upload to Play Console makes the package name `com.proa.madeira` permanent, forever. The display name on the listing can change later, the package cannot. Nothing else in this plan depends on the name: it lives in `app/src/brand.ts`, and the product ID (§4.2) deliberately does not contain it. |
| 0.1 | **Upload key** (already T-187 / T-117e) | Blocks every real purchase test. |
| 0.2 | **Payments profile** in Play Console | Bank account and tax details for payouts. Required before any product can be sold or tested. |
| 0.3 | **Upload a store build to the internal testing track** | ⚠ Play Console only lets you create in-app products once a build containing the billing library has been uploaded. So this follows T-156b. Check Google's current wording when you get there. |
| 0.4 | **Create the product** | One-time product, the ID agreed in §4.2 (permanent), price €5.99, Play's regional conversions (D-089). Title and description in EN, PT, DE, no dashes. |
| 0.5 | **License testers** | Add the project lead's Gmail (and any tester's) under License testing. Test purchases then cost nothing and offer Google's **test cards**: always approves, always declines, and slow cards that approve or decline after a few minutes (the pending case). |
| 0.6 | **Promo codes** (optional, later) | For friends and hotel partners. |

### Phase 1: the allowance

#### T-232 Free allowance 10 → 5 (D-089 rules 2, 3) ⇠ OQ-1

- **Change:** `FREE_STAMP_ALLOWANCE = 5` in `entitlement/freeTier.ts`. The levada guarantee is
  unchanged: at most 6 visible.
- **Comments to correct in the same commit** (they state numbers and prices that are now false):
  `freeTier.ts` header ("Ten stamps are free", "eleven", "€4.99"), `passport/passportButton.ts`
  ("The eleventh stamp onwards", "€4.99"), `passport/stampTier.ts` (the silver reason, per OQ-1),
  and the `StampVisibility.locked` comment ("the ones €4.99 reveals").
- **Tests:** `freeTier.test.ts` gains the boundary cases at 5: the fifth shows, the sixth locks; a
  levada earned sixth shows; a levada earned third means the sixth is locked (the guarantee only
  adds); ties in `awardedTs` keep a stable order. Watch them fail against 10 first.
- **Workbench:** update the "23 stamps, free tier" scenario; check the passport shows 6 at most
  (5 viewpoints plus a levada, when the fixture has one).
- **P30 evidence:** a store build (no beta flag), `sqlite3` count of awards against a
  `uiautomator dump` count of unlocked stamps in the passport.
- **Docs:** TASKS (T-232), HANDOFF's line "The app still has D-072's 10" removed.

### Phase 2: billing

#### T-156a Purchase rules (pure) ⇠ D-091

- **New:** `entitlement/purchaseRules.ts` and its test.
- **Input:** a plain list the adapter builds from Google's answer:
  `{ productId, state: 'purchased' | 'pending' | 'unknown', purchaseTimeMs, acknowledged }[]`,
  plus our product ID (from content).
- **Output:** `{ unlocked, pending, toAcknowledge: [...], purchaseTimeMs | null }`.
- **Rules, each a test:** only our product ID counts; `pending` never unlocks; `purchased` and
  unacknowledged goes to `toAcknowledge`; the earliest purchase time wins if there are several;
  an empty list returns `unlocked: false` **but** `entitlementStore` never applies a false over a
  stored true (tested in T-156c).
- **No expo-iap, React Native or storage import here.** A test fails if one appears.

#### T-156b The store adapter ⇠ T-156a, T-187 (for device tests only)

- **Install** `expo-iap` at an **exact** version; record which and why in the commit body. Add its
  config plugin to `app.json` if the pinned version needs one.
- **New:** `entitlement/storeBilling.ts` (the only `expo-iap` importer) and
  `entitlement/storeBilling.web.ts` (scripted outcomes).
- Maps every library result and error code to the closed outcome set of §4.3. Unknown codes map
  to `failed` and are recorded for the Debug screen (field builds only; T-189 keeps the Debug
  route out of release builds).
- **Tests:** a test that **fails if any other file imports `expo-iap`** (scan `app/src`); a test
  that the acknowledge call is always non-consumable (§4.3).
- **Permissions:** §4.5, in this commit.
- **Licences:** re-run `tools/build-licences.mjs` so `legal/licences.json` lists `expo-iap` and
  Google's billing library (T-221: licences come from what ships). `licences.test.ts` must pass.
- **Dependency audit:** add `expo-iap` to `docs/dependency-audit.md` (D-043): what it contacts
  (Google Play only), whether it bundles analytics (it must not), its native dependencies.

#### T-156c Billing sync and the lifecycle ⇠ T-156b

- **New:** `entitlement/billingSync.ts`. At launch and on every return to the foreground: query
  owned purchases, run `purchaseRules`, save through `entitlementStore` (save first, §4.3), then
  acknowledge what needs it. Registers the purchase listener once; removes it on unmount. Does
  nothing in a beta build.
- **Changed:** `entitlementStore.ts` gains `purchase_record` (§4.4). The existing rule, "once true,
  never set back to false by a failed lookup", gets a test.
- **Where it starts:** the app's root, once, next to the existing launch work. Not inside a screen.
- **Offline:** a failed query changes nothing and is retried at the next resume.
- **Erase all (OQ-7):** `deleteAllUserData` clears both keys; its test is updated.

#### T-156d The unlock sheet and its entry points (with T-157) ⇠ T-156c, OQ-8

- **New:** `ui/UnlockSheet.tsx`. Content, top to bottom: the hero stamp (tilting, after Phase 5),
  one line on what you have earned ("You have collected 14 places. 8 are waiting to be seen."),
  what paying adds (every stamp, the medals, the founder stamp **only while the window is open**),
  the price **as Google returns it**, **Buy**, **Restore purchase**, **Not now**. Every outcome
  state from §4.3.
- **Entry points, and only these** (the study's rule against nagging, T-157): tapping a locked
  stamp; the passport's one-time line when the first stamp locks (T-157: said once, quietly,
  never a notification, never a repeating banner); the Settings row (T-156e).
- **Price unavailable** (offline before Google ever answered): show "Unlock" without a price and
  the offline line. Never a cached or hardcoded number.
- **Strings:** all in `strings.ts`, EN, PT, DE. The tone rule already in `strings.ts` stands: a
  locked stamp is one the user earned and has not seen yet, never one they failed to get.
- **Tests:** a pure view model for the sheet (which lines and buttons show for each outcome and
  for the beta build), tested in Node. `accessibility.test.ts` and `contrast.test.ts` must cover
  the new screen.

#### T-156e Restore in Settings ⇠ T-156c

- The Settings row reads **"Unlock the passport"** when locked and **"Restore purchase"** always
  offers a manual re-query. Hidden in a beta build. `TASKS.md` line ~535 already reserves the
  place ("Restore purchase waits for T-156").
- **Tests:** the row's label and visibility as a pure function of (unlocked, beta).

### Phase 3: the founder stamp

#### T-233 Founder stamp ⇠ T-156a, T-156c, OQ-2, OQ-5, OQ-9

- **New:** `entitlement/founder.ts`: `isFounder(purchaseTimeMs, window)`, with `window.start`
  possibly null. Tests: null start means nobody; the last millisecond inside the window; the
  first millisecond after it; a purchase before the start counts (OQ-5). **Pin each with a test.**
- **Content:** `founderWindow` in `destination` (§4.2), validated.
- **Release guard:** `tools/smoke-release.mjs` fails a release build with a null start.
- **Art:** `passport/medalArt.ts` (shared with medals), approved by eye through the preview
  renderer before the UI commit (OQ-9).
- **UI:** shown in the passport's medals section (OQ-2), not in the place grid, not in the count.
- **P30 evidence:** after a test purchase, `sqlite3` shows `purchase_record`; the passport shows
  the stamp; after uninstall and reinstall, a restore brings it back.

### Phase 4: set medals

#### T-234 Medals: content and logic ⇠ OQ-3

- **Content:** `content/medals.json` (§4.2); `validate-content.mjs` extended with its checks
  and a failing fixture for each check.
- **New:** `progress/medals.ts`, pure. Input: medal definitions, the places, the awards (all of
  them, locked included, D-075). Output per medal: members, collected, complete, `completedTs`
  (the award time of the stamp that completed it). Plus, given `unlocked`, whether each complete
  medal is **shown** or **locked** (free users see progress, the medal itself is paid).
- **Tests:** progress counting; completion time; a place removed from the pack (dropped, as the
  passport drops it); a medal complete but locked; Porto Santo's hiding (D-024) leaves medals
  unaffected unless a set includes it.
- **Loader:** `content/contentPack.ts` reads the file; `contentPack.test.ts` covers a malformed
  file.

#### T-235 Medals: art and UI ⇠ T-234, OQ-2, OQ-9

- **New:** `passport/medalArt.ts` (pure design) and `ui/MedalArt.tsx` (draws it). Extend
  `tools/preview-stamps.mjs` to draw every medal, so the project lead approves the design by eye
  before it ships (CLAUDE.md: a mark that passed every geometry test still rendered as a
  crosshair).
- **Passport:** a medals section. Each medal: its art (locked or shown), its name built from
  content and strings (§4.2), "3 of 12". Tapping a locked, complete medal opens the unlock sheet.
- **Not counted** in the rank or the progress line (OQ-2). A test pins that the progress line's
  numbers do not change when a medal completes.
- **Accessibility:** each medal has a screen reader label in three languages.

### Phase 5: tilt and shine

#### T-236 Sheen logic and the static sheen ⇠ OQ-4

- **New:** `passport/stampSheen.ts`, pure. Input: a gravity vector from the sensor (or none).
  Output: tilt angles (clamped to a few degrees), the sheen band's position and strength.
  A low-pass filter so the stamp moves smoothly, not jitters. A **static** output for the passport
  grid and for **reduced motion** (the phone's accessibility setting).
- **Changed:** `ui/StampArt.tsx` draws the sheen as an SVG gradient **clipped to the stamp's own
  shape** (the stamps have cut edges; a sheen spilling onto the card behind reads as a bug).
- **Preview:** `preview-stamps.mjs` draws the static sheen on every colourway, for the project
  lead's eye. The passport's album page is dark (D-080); check the sheen on both.
- **Tests:** clamping, smoothing converges, reduced motion gives the static result, the same input
  gives the same output.

#### T-237 Tilt on the device ⇠ T-236

- **Start with a spike, and report its number honestly:** on the P30, redraw one stamp at 30 and
  at 60 updates a second and measure the frame time (`dumpsys gfxinfo`). Redrawing an SVG that
  often may be too heavy; the fallback is to move only a transform on a view layer and redraw the
  sheen less often. Choose from the measurement, not a guess, and write the number in the task.
- **New:** `passport/tiltSensor.ts`. Subscribes only while a tilting stamp is on screen **and**
  the app is in the foreground; unsubscribes on blur, on background and on unmount. A test on
  the pure half proves that a hidden stamp requests no sensor.
- **Where:** OQ-4. The place card's stamp and the unlock sheet's hero stamp.
- **Battery:** the sensor runs only while one of those two is open. State that in the task; do
  not claim a battery figure (D-041's rule).
- **P30 evidence:** `dumpsys sensorservice` shows the listener while the place card is open and
  none after it closes. One screenshot or a short screen recording, because this is visual.

### Phase 6: privacy and store paperwork

#### T-238 Privacy, Data Safety and listing ⇠ T-156b, OQ-6

Billing is the app's first network call on its own account (D-084). Everything that describes the
app's network behaviour is restated, **not quietly failed**:

- **In-app privacy policy** (`legal/privacyPolicy.ts`, the Portuguese file, and German if present):
  a purchase goes between the phone and Google Play; Google processes payment; the app keeps only
  the purchase time, on the phone; no third party (D-091). Regenerate `docs/privacy-policy.md`
  with `tools/generate-privacy-policy.mjs`. `privacyPolicy.test.ts` must pass, and gets a test for
  the new paragraph. Never write "nothing leaves your phone" (D-073).
- **Data Safety form** (T-122, `docs/store-privacy-answers.md`): the purchase history row. Check
  Google's current guidance on whether Play Billing's own handling must be declared, and record
  the answer and its source in the document.
- **T-117b and T-127** (zero outbound connections): restate them as "no outbound connections
  except Google's map and Google Play Billing", and say what a packet capture should see.
- **Store listing** (`docs/marketing-plan.md` §4): the free and paid lines per OQ-6; the founder
  line during the window only, removed the day it closes (write the removal date into TASKS).
- **Permissions shown on the listing** now include billing: expected, nothing to explain.

### Phase 7: verification

#### T-239 End-to-end purchase verification (Gate R3) ⇠ all of the above, Phase 0

Run the matrix in §6 on the P30 with a store build from the internal testing track and a license
tester account. Record each row's evidence in the task. A row that cannot be run is written down as
not run, with the reason.

---

## 6. The verification matrix

| # | Case | How | Expected | Evidence |
|---|---|---|---|---|
| V1 | Fresh install, free | Store build, replayed route or real walk | 5 + first levada shown, the rest locked, medals show progress | `sqlite3` awards vs `uiautomator dump` |
| V2 | Buy, approved | Test card "always approves" | Unlocked at once; every stamp shown; founder stamp if the window is set | Dump; `app_state` rows |
| V3 | Acknowledged | After V2, wait past Google's test acknowledgement window (much shorter than 3 days for test purchases; check the current docs) | Order still active, not refunded | Play Console order page (one screenshot) |
| V4 | Declined | Test card "always declines" | `failed` state, still locked, no crash | Dump |
| V5 | Pending | Slow test card that approves | Pending message; unlock arrives by itself (listener or next resume) | Dump before and after |
| V6 | Pending then declined | Slow test card that declines | Pending, then locked with the failed message | Dump |
| V7 | Cancelled | Close Google's sheet | Sheet closes quietly, still locked | Dump |
| V8 | Offline purchase attempt | Airplane mode, tap Buy | "Unlock later" message, no error tone | Dump |
| V9 | Offline after unlock | Unlock, airplane mode, force-close, reopen | Still unlocked | Dump |
| V10 | Reinstall | Uninstall, install, open online | Restored: unlocked, founder stamp back | Dump; `app_state` |
| V11 | Erase all | Settings, erase, reopen online | Restored after the query (OQ-7) | Dump |
| V12 | Killed mid-purchase | Kill the app right after paying | Next launch unlocks and acknowledges | Dump; Play Console order |
| V13 | Refund | Refund the test order in Play Console | Record what `getAvailablePurchases` returns. The app **does not re-lock** (D-091) | Written note in D-091 |
| V14 | Promo code | Redeem a code | Unlocked; founder per OQ-5 | Dump |
| V15 | Beta build | Build with the beta flag | Everything unlocked, no Buy, no Restore, no founder | Dump |
| V16 | Languages | Switch EN, PT, DE | Every new string present, no dash, the price in local format | Dump per language |
| V17 | Tilt | Open a place card, close it | Sensor listener only while open | `dumpsys sensorservice` |
| V18 | Network | Packet capture over V2 and V10 | Only Google hosts; no third party | Capture summary in T-117b |

⚠ **The P30 traps** in HANDOFF apply: never run force-stop loops (EMUI's iAware starts killing the
app); `run-as` only works on the field build, so `app_state` on a store build is read another way
(note which in the task).

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A bug skips the acknowledgement and every sale is refunded after 3 days | Low with tests | Severe, and silent | T-156a/b tests; V3 on a real order |
| Consuming instead of acknowledging drops ownership | Low with tests | Severe | The non-consumable test (§4.3) |
| `expo-iap` changes its API or is abandoned | Medium | Medium | Exact pin; one importer file; D-091's exits |
| Google raises the minimum billing library version | Certain, yearly | Low | A dated reminder in TASKS when Google announces it; upgrade is one file |
| A paying user sees stamps locked after a Play hiccup | Low | Severe for trust | Never re-lock on a failed or empty answer (tested) |
| The founder window is forgotten at release | Medium | Low | `smoke-release.mjs` fails on a null start |
| The sheen redraw is too slow on the P30 | Medium | Low | The T-237 spike decides the method from a measurement |
| The listing states a price the buyer does not see | Medium | Low, but a compliance surface | OQ-6 |
| Store and beta flavours get mixed up in a build | Medium | Medium | `docs/dev-build.md` trap; check the Settings version row every time |
| A new permission slips in unnoticed | Low | Medium | `releasePermissions.test.ts` fails by design |

---

## 8. Documents to update, by task

| Task | Documents |
|---|---|
| Every task | `TASKS.md` (open with notes, close with a line; post-mortem to `docs/task-notes.md`), HANDOFF only if the state paragraph changes |
| T-232 | D-089 text if OQ-1's answer changes a reason; HANDOFF (remove "still has D-072's 10") |
| T-156a to e | `ARCHITECTURE.md` §5 (billing row exists; add the module names), `docs/dependency-audit.md`, `docs/dev-build.md` (store build for billing tests) |
| T-233 | D-089 (OQ-2, OQ-5 answers), `content/README.md` (the founder window field) |
| T-234, T-235 | D-089 (OQ-3), `content/README.md` (medals.json), `docs/design-brief.md` (medals in the passport) |
| T-236, T-237 | `docs/design-brief.md` (the sheen), D-089 (OQ-4) |
| T-238 | `docs/privacy-policy.md` (generated), `docs/store-privacy-answers.md`, `docs/marketing-plan.md`, TASKS T-117b, T-122, T-127 |
| T-239 | D-091 (the refund observation, V13), TASKS Gate R3, HANDOFF |

When the plan is complete, add one line at the top of this file: **Completed on (date)**, with the
commit that closed T-239.

---

## 9. Glossary

Plain meanings for the terms used above.

| Term | Meaning |
|---|---|
| **Non-consumable** | A purchase you buy once and keep forever (our unlock). The opposite, a consumable, is used up, like game coins. |
| **Acknowledge** | Telling Google "the app received this purchase". Without it, Google refunds the buyer after 3 days. |
| **Consume** | Telling Google a consumable was used up. Never done here: it would end the ownership. |
| **Pending** | Paid by a method that confirms later. Not yet paid; never unlocks. |
| **Restore** | Asking Google what the account already owns, after a reinstall or on a new phone. |
| **Purchase time** | When Google recorded the purchase. The founder stamp reads it; the phone's clock is never used. |
| **License tester** | A Google account allowed to make test purchases for free with Google's test cards. |
| **Internal testing track** | A private release channel in Play Console. Needed for real purchase tests. |
| **Store build / beta build** | The same app built two ways: the store build sells the unlock; the beta build (D-084) is unlocked and sells nothing. |
| **Pure / impure module** | Pure: only arithmetic and rules, testable in Node. Impure: talks to the phone (database, store, sensors). |
| **Workbench** | The app running in a browser (`npm --prefix app run web`), with scripted scenarios. |
| **Second renderer** | A tool that draws the same design outside the app, so artwork can be judged by eye before it ships. |

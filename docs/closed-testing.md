# Closed testing, step by step (T-129)

Written 2026-10-21 for the project lead's Play Console. The console is theirs; this is the order to
click in, and what to paste. Google's rule as read on 2026-10-09: **production stays locked until a
closed test has had 12 or more testers opted in for the last 14 days in a row**, then Google asks a
few questions about the test before it grants production access.

## Where it stands

- **Build for the closed track: version 11**, `Madeira-fieldwork/apks/bruma-0.1.0-vc11.aab`, built
  2026-10-21 from the current code (upload key, `debuggable` false). It replaces 10: it adds the
  passport's 55 to 60 MB memory cut, the medals row, the drawn chevrons and the blank-map probe fix.
- **On the closed track since 12 Oct: version 7.** It must not reach a tester (it records nothing
  at home with the screen off). Version 11 replaces it in the same track.
- **Version 4** is on internal testing. Leave it; internal testing does not count toward the 14 days.

## 1. App content: every row must be done, or the release cannot go to review

*Policy and programs → App content.* Each row shows a tick when done.

| Row | Answer | Source |
|---|---|---|
| Privacy policy | `https://bruma.lol/privacy` | `docs/store-privacy-answers.md` |
| App access | All functionality is available without special access (no login; the unlock is a purchase, which reviewers can make as a test) | D-084 |
| Ads | No ads | |
| Content rating | Questionnaire, category *Reference, News, or Educational* or *Travel*: no violence, no user content, no chat. Shares location: **No** to other users (nothing leaves the phone). Digital purchases: **Yes** | D-089, D-100 |
| Target audience | 18 and over (keeps it outside the Families policy) | |
| Data safety | Paste from `docs/store-privacy-answers.md` §Google Play | T-268 |
| Government, financial, health apps | No, none, none | |
| **Location permissions** (background) | Paste the description in `docs/play-background-location.md`, plus the video link | **T-123, the blocker** |
| **Foreground service permissions** | Type *Location*, text below, the same video link | new |

⚠ **The background location form is what stops the closed test today.** Internal testing skips
review, so it never asked; a closed release with `ACCESS_BACKGROUND_LOCATION` is reviewed and is
rejected without it. The video still lacks shot 3 (the P30 after an outing with the app closed).
Shots 1 and 2 exist. Upload the cut to YouTube as **Unlisted** and paste the link in both forms.

### Foreground service declaration (paste)

> **Task:** Bruma records the roads and paths the user walks or drives, to light them up on a map
> of the island. While an outing is being recorded, a location foreground service with a visible
> notification keeps GPS fixes arriving with the screen off.
> **Impact if deferred or interrupted:** the part of the walk or drive recorded while the service
> was stopped is lost for good; the roads stay dark on the user's map. The work cannot be
> postponed, because the location belongs to the moment it is taken.
> **User initiated:** the user starts an outing, or allows automatic recording in first run, and can
> stop it from the notification or in Settings.

## 2. The testers

1. *Test and release → Testing → Closed testing.* Open the existing track (the one holding version
   7). Do not create a second track; it would start its own count.
2. **Testers** tab → *Create email list*, name it `Bruma testers`, paste the 12 addresses, one per
   line. ⚠ Each must be the **Google account the tester's Android phone signs in with** (usually a
   Gmail). A work address that is not a Google account cannot opt in.
3. **Feedback URL or email:** the lead's address. Testers see it on the opt-in page.
4. Save, then copy the **opt-in link** (*Join on the web*). Testers need it; Play does not email them.
5. **Free purchases for testers:** *Settings (the gear, all apps) → License testing*, paste the same
   12 addresses. Without this a tester who unlocks the passport is charged €5.99 for real.

⚠ **Twelve is the minimum, and it counts testers opted in on every one of the 14 days.** One tester
who opts out, or never opts in, resets nothing but leaves the count at 11, and the clock does not
finish. Recruit two or three spare if at all possible.

## 3. The release

1. Same closed track → *Create new release* → upload `bruma-0.1.0-vc11.aab`.
2. Release name `0.1.0 (11)`. Release notes, Portuguese and English:
   > pt-PT: Primeira versão de teste. Usa o Bruma num dia normal e diz-nos o que achaste em Definições, Enviar opinião.
   > en-US: First test build. Use Bruma on an ordinary day and tell us what you think in Settings, Send feedback.
3. *Countries / regions*: all, or at least the testers' countries. A tester in a country not listed
   cannot install.
4. *Review release* → *Start rollout to Closed testing*. Then *Publishing overview* → **Send for
   review**, if the console shows that button (managed publishing).
5. Google's review of a first closed release usually takes a few days. Version 7's state on that
   page (in review, approved, rejected) is worth reading first: a rejection says what to fix.

## 4. When it is approved

1. Send the 12 testers the opt-in link with three steps: open it on the phone's Google account,
   tap *Become a tester*, then *Download it on Google Play*.
2. Ask each to keep the app installed and to open it now and then for 14 days. Google asks, at the
   end, how testers engaged and what changed from their feedback, so their notes matter.
3. Check the count on the closed track's page around day 2; anyone missing has not opted in.
4. **Day 15 or after:** *Dashboard → Apply for production*. The answers come from T-132 (the
   feedback) and the field log.

## Before production itself (not now)

The founder window must be set (`smoke-release.mjs` refuses a public build without it, T-233), the
listing copy approved, the screenshots made (desk F), the pre-launch report read (T-207) and the
purchase matrix run (T-239). Nothing here blocks the closed test.

# Bruma: In-Depth Evaluation, 2026-10-30

An independent pass with a **new KPI rubric** (16 KPIs, each out of 20), not the eight-area rubric
of the 23 and 27 Oct reviews, so the numbers do not compare one to one. Asked for by the lead:
"have high standards, no sugarcoating".

## At a glance

- **Score: 11.9 / 20** weighted (the 27 Oct review: 13.3 on its own rubric).
- **Strong:** driving accuracy, privacy, the first run, code quality.
- **Weak:** walking and levadas (no canopy walk ever), the GPS on/off logic (new bug on almost
  every outing, and its glue code has no tests), device coverage (one Huawei on Android 10),
  monetisation, and a map that shows a new user no places at all.
- **Most valuable next thing:** a levada walk under canopy with the iPhone alongside.

## Method

**Date:** 2026-10-30, 20:30 to 21:05.
**P30:** `com.proa.madeira` 0.1.0, version code 11, field build (debuggable), installed 30 Oct
19:34 (T-294). Android 10, EMUI 12, `pt-PT`, on USB at 100%, airplane mode on. The lead's data:
trip 31 open since 24 Sep, 46,898 fixes, 26 stamps (last on 18 Oct).
**Emulator:** Android 16, x86_64, an x86_64 release built for the purpose
(`-PreactNativeArchitectures=x86_64`), 1080 × 1920 at 480 dpi (360 × 640 dp), English. Uninstalled
after, density reset.

| Check | Where | Result |
|---|---|---|
| Unit tests, `tsc`, content | desk | 1,217 pass in 6.2 s; `tsc` clean; 81 + 9 places valid, why-go 90 of 90, 7 warnings |
| Matching, synthetic and real | `eval-matching.mjs` on a database copy | below |
| Cold start ×3 | P30, `am start -W` after force-stop | 1,143, 1,085, 1,002 ms (reported WARM: the process is back before the activity) |
| Pan | `measure-map-frames.sh` | 59.2 fps, p99 33 ms, no stall over 50 ms |
| Zoom ×2 | `measure-map-zoom.sh` | 45.9 and 47.0 fps; worst 182 ms both runs (27 Oct: 132 ms) |
| Smoke test | `smoke-release.mjs --internal` | every screen opened, nothing crashed |
| Memory | `meminfo` | 326 MB at rest, 397 MB after the smoke test |
| GPS requests | `dumpsys location` | fine GPS every 5 s **only while on screen** (the map's blue dot); none in the background |
| Recorder log, 23 to 30 Oct | database copy | below |
| First run, all refused | emulator | clean, no crash, below |
| A new user's map | emulator | no Bruma place pins at any zoom |
| Manifest, network, deps | merged release manifest, `grep`, `npm audit --omit=dev` | below |
| Site | `curl` | bruma.lol and /privacy answer 200 |

Three screenshots on the P30 (map, paywall, passport), three on the emulator.

## KPIs

Weights favour what a paying tourist feels: recording and stability heaviest.

| KPI | Weight | /20 | Evidence |
|---|---:|---:|---|
| Recording accuracy, driving | 10 | **16** | 90 to 97% of the route within 10 m on eleven field days; synthetic drives 95 to 99% recall, tunnels 98.9% |
| Recording on foot and levadas | 10 | **9** | Real walks 52 to 71% (mostly indoors, so partly unfair); synthetic walk on automatic 82.5% recall, 93.1% precision; no canopy walk ever (T-018); 0 of 18 levadas stamped |
| GPS on/off logic | 10 | **10** | Since 23 Oct: 23.5 h on *driving*, 18.3 h of it the stuck evening of 26 Oct (N15, fixed). T-286, T-288, T-294 open. `samplingGate`, `tripRecording`, `backgroundTasks`, `walkSession`, `recorderHealth` have no test file and no test imports them |
| Battery | 8 | **12** | About 1 to 2%/h on two carried days, one phone; Huawei's warning three times; the official figure stays `null` (D-041) |
| Crash-free stability | 8 | **13** | Smoke test clean; refusal path clean (N23 fixed); diary errors only two failed price lookups. Against: N23 lived 28 Aug to 27 Oct through four reviews; testers may still have version 11; Android vitals is the only crash signal (D-100) |
| Performance | 5 | **15** | Start about 1.0 to 1.1 s; pan 59 fps; zoom regressed (182 ms worst); memory heavy for a 3 GB phone |
| First run | 6 | **16** | Honest, a replica of each Android dialog first, background step skipped after a refusal. With location refused, the map's banner still says *Tap to choose "Allow all the time"*. The welcome leads with stamps, not the lit roads |
| Home and map | 7 | **10** | On the P30 the island opens in the bottom quarter, west end cut, 60% empty sea. **No place pins for a new user, even zoomed to Monte** (only Google's pin). The gold badge is 31 × 26 dp on top of the passport button; a tap meant for the passport opened the paywall. Settings button 44 dp |
| Visual consistency | 5 | **12** | Light map, dark passport, purple paywall. Visited-but-locked stamps are the same grey as unvisited ones |
| Content | 7 | **12** | 90 curated places, one line each. No length, difficulty, photo or closure state; for levadas, closures are a safety matter |
| Monetisation | 6 | **9** | 5 free stamps (the lead has 21 of 26 locked). The buy button reads *Ver os meus carimbos*. No price shown offline. Android only. No purchase matrix on a Play install |
| Privacy and security | 4 | **17** | No `fetch` or socket in app code; no account, no analytics; cleartext off; nothing exported; backups of `SQLite/` disclosed in the live policy. `npm audit`: 19 (1 critical, 10 high), all build tooling (`@expo/cli`, `shell-quote`, `node-forge`…), nothing in the shipped bundle |
| Accessibility and languages | 3 | **13** | Three languages; screen-reader labels thorough in every dump. The badge and Settings above; no TalkBack pass |
| Code quality | 3 | **16** | 1,217 tests; strict `tsc`; no TODOs; 6 type escapes; no linter; screens up to 1,408 lines (`NativeMapScreen.tsx`) |
| Device coverage | 5 | **4** | One Huawei on Android 10. Testers mostly run 13 to 15, where background location and foreground services behave differently. No Samsung, Xiaomi or iPhone |
| Store readiness | 3 | **10** | Closed testing running; site live; `founderWindow.start` null; testers' version unknown; listing and Data safety unverified |
| **Weighted** | 100 | **11.9** | |

## Findings new this round

- **E1, no place pins on the map.** A first-time user cannot see where any of the 81 stamps are;
  places reach the map only through the passport's *Ver no mapa*. No decision found that makes
  this deliberate. For a collecting game, the largest UX gap.
- **E2, zoom regressed:** worst gap 182 ms in both runs, 132 ms on 27 Oct.
- **E3, the recorder's untested glue.** Every field bug since 26 Oct (T-286, N15, T-294) sat in
  the code that applies the profile rules, not in the tested pure rules.
- **E4, the only real phone runs Android 10.** Not covered by "one phone": the OS behaviour that
  matters most for background location is newer.
- **E5, the refused-location banner** asks for *Allow all the time* when nothing was allowed.
- **E6, the paywall button** is a purchase labelled as viewing, and shows no price offline.

**Withdrawn on check:**
- GPS every 5 s at home after a relaunch: the map's blue dot while on screen; none in the background.
- "Bruma keeps stopping" on the emulator: the arm64-only field APK under ARM translation. The
  store bundle (`vc11.aab`) carries all four ABIs.

## What would move the score most

1. **A levada walk under canopy, iPhone alongside** (T-018). Walking KPI +4 to 6.
2. **Tests for the profile-switching glue,** with the batches from 26, 27 and 30 Oct replayed as
   regression cases. GPS on/off logic +3.
3. **A second phone on Android 13 or newer for one ordinary day,** a Samsung if possible, even
   borrowed. Device coverage +5, and it tests battery and stability too.
4. **Place pins on the map,** the opening framing, and an honest paywall button. Home +4,
   monetisation +2.

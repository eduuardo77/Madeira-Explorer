# Field test log

Every test of Bruma on real hardware or out on the island, newest first. One entry per test: what
was done, on what, with which settings, and what it showed. The detail lives in
`docs/field-notes.md` (linked by date); this file is the list.

Raw data (phone databases, iPhone tracks) is in `Desktop/Madeira-fieldwork/`, **never in the
repo**: it is unmasked real movement (D-016, D-040). Place names here stop at the area visited,
never where the lead lives.

**Before the next ride, read [Checklist](#checklist-before-a-ride) at the bottom.**

## Summary

| Date | Test | Device | Tier | Result |
|---|---|---|---|---|
| 2026-10-10 | Car and on foot as an outing, 3h21, iPhone alongside, tunnels | P30 | Equilibrado (outing: Preciso) | ✅ 95.6% of the route lit within 10 m, tunnels drawn; 2 stamps; battery 100 to 92% |
| 2026-10-09 to 10 | Second still night on battery, 9h53 | P30 | Equilibrado | ✅ deep idle 88%; ⚠ level stuck at 100% again |
| 2026-10-09 | Motorbike ride as an outing, 74 min, iPhone alongside | P30 | Equilibrado (outing: Preciso) | ✅ 99.5% of the route lit within 10 m; a stamp; battery 100 to 96% |
| 2026-10-08 | Motorbike ride as an outing, 59 min, iPhone alongside | P30 | Equilibrado (outing: Preciso) | ✅ 93.7% lit within 10 m; ⚠ first 790 m lost (fixed) |
| 2026-10-07 to 08 | Overnight on battery, phone still | P30 | Equilibrado | ✅ deep sleep 93%; ⚠ no battery percentage (level stuck at 100%) |
| 2026-10-06 | Car to the gym and back, 2.3 km each way, iPhone there | P30 | Equilibrado | ⚠ there: 97% of the route drawn; back: nothing |
| 2026-10-06 | Motorbike ride, 83 min, 32.7 km, iPhone alongside | P30 | Poupança | ❌ 29 points; a 33 min hole while riding |
| 2026-10-05 | First real purchase, then refunded | P30 (Play install) | n/a | ✅ bought, unlocked, acknowledged |
| 2026-10-04 | Outing by car and on foot, 3h13, 24 km, iPhone alongside | P30 | Preciso | ✅ 1,088 points; 2 stamps; backup and restore proven |
| 2026-09-27 | Speed as a rest/movement test, matching on the phone | P30 | Preciso | ✅ led to D-093 |
| 2026-09-26 | Lines drawn where nobody went | P30 (on a desk) | Preciso | ⚠ indoor GPS drawn as roads (T-244) |
| 2026-09-24 | Does an update stop the recorder? | P30 | Preciso | ❌ yes, until the app is opened (T-210) |
| 2026-09-22 to 25 | Is it capturing? Four days on a desk | P30 | Preciso | ✅ continuous; ⚠ "random blue lines" (T-229) |
| 2026-09-22 | Setting up a 72 h soak | P30 | n/a | ❌ recorder dead since 28 Aug, app said recording (T-174) |
| 2026-08-22 to 28 | The August loan, first real data | P30 | default | ⚠ 831 points, 3 bugs found (T-171 to T-173) |
| 2026-08-19 | Firebase Test Lab robot | Pixel 5 | n/a | ✅ no crashes, the map renders |
| 2026-08-16 | PR18 Levada do Rei, on foot | none | n/a | observations only, no app |

## Entries

### 2026-10-10: car and on foot, through tunnels

- **Setup:** P30 unplugged at 100% at 15:07 local; *Começar passeio* at 15:10, ended 18:31; the app
  opened about four times, briefly (screen on 3 min in all). iPhone 15 with Sensor Logger from
  15:11 to 18:31. Driving with several tunnels, and a walk at the Parque Temático.
- **Result:** 697 points. 95.6% of the iPhone's route within 10 m of a lit road, 99.5% within 30 m;
  97.9% of the lit road within 10 m of the route. Every tunnel was drawn along the road. Stamps:
  Santana (geofence, 199 s inside) and Parque Temático (from the trace, 7 min on foot).
- **Gaps:** points stopped for 90 to 100 s in each tunnel, at 60 to 90 km/h, as expected with no
  sky. The longer gaps (11, 13 and 17 min) were all while the iPhone moved under 130 m: parked or
  strolling, where the distance filter holds fixes back.
- **Battery:** 100 to 92% in 3h26. The level read 100% for the first 1h22, then fell a point every
  12 to 20 minutes. The app's estimated share is mostly GPS.
- **Found:** `compare-sensorlogger.mjs` drew a straight line through each tunnel from the iPhone's
  last fix to its next, and reported 81.8%; it now splits the reference at silences over 30 s and
  judges only the lit road beside a reference. The 9 Oct ride reads the same either way (100% and
  99.6%).

### 2026-10-09 to 10: a second still night

- **Setup:** P30 unplugged at 100% at 23:30 local, back on the cable at 09:24, untouched. Bruma
  left on top of the screen when the phone went to sleep.
- **Result:** 9h53 on battery, screen on 56 s, deep idle 88% of the time, light idle 11%. The
  level never left 100%, as on 7 to 8 Oct, so a still night still gives no battery figure: the P30
  holds a full charge at 100% and its mAh counter is broken. The day run started near 80% is the
  only way to a number.
- **The map probe (T-259):** waking the phone with Bruma on top left no "drawn" line, correctly: the
  process and its map lived all night, and the probe counts openings, not returns.

### 2026-10-09: motorbike ride as an outing, the start fixed

- **Setup:** P30, field build with `effectiveProfile` (an outing never samples as stationary).
  *Começar passeio* pressed standing still at 11:56 local; iPhone 15 with Sensor Logger from 11:56
  to 13:10. Unplugged at 100% at 11:30 local, when the battery record began.
- **Result:** points every 5 to 15 s from the press; rode off at 12:00:39 and the first metres were
  kept. Against the iPhone: **100.0% of what was lit within 10 m of the track**, **99.5% of the
  track lit within 10 m** (100% within 30 m), no stretch missed. Same-second error median 6.7 m.
- **Stamp:** Praia dos Reis Magos (268 s, confidence 0.30), notified and shown.
- **Battery:** **100 to 96% in 2 h 03 min**, GPS on 1 h 03 min, screen on 22 min. Bruma second by
  Android's estimate, after an app streaming over wifi. A morning, not the 12-hour day T-054 asks.
- **Found:** the map-drawn probe (T-259) counted time in the background; fixed the same day.
- Data: scratch copies only (`compare-sensorlogger.mjs` output outside the repo).

### 2026-10-08: motorbike ride as an outing, the start lost

- **Setup:** P30, *Começar passeio* pressed at the gym, standing still, at 17:31 local; rode from
  about 17:35 to 18:30; iPhone 15 with Sensor Logger from 17:32. Unplugged at 100% at 16:19.
- **Result:** 263 points; **99.6% of what was lit within 10 m of the track**, **93.7% of the track lit
  within 10 m**. **One miss: the first 790 m.** The profile was still *stationary* (100 m between
  points, the OS free to hold them 15 min) and 1 min 41 s passed unsampled. Fixed that evening:
  an outing never samples as stationary (`30c273f`), confirmed on 2026-10-09.
- **Battery:** the level read 100% until the plug, then 99%: one step, no figure.
- **Also read:** the VR1 tunnels from the 4 Oct drives sit on the right carriageway each way; they
  looked wrong drawn pale and are dashed since `679447e`.

### 2026-10-07 to 08: overnight on battery, still

- **Setup:** battery record reset at 100% at 16:57, then unplugged; used normally (rain, no ride), then still overnight;
  read at 09:32 next morning, 16 h 22 min on battery.
- **Result:** the recorder's foreground service held all night while the phone sat in deep sleep
  92.6% of the time; GPS once, 1 min at the start; 30 s of CPU. **No percentage:** the level never
  left 100% and the P30's charge counter is broken.


### 2026-10-06 (evening): car to the gym and back, Equilibrado

- **Setup:** P30, build installed 17:03 by cable over the top (includes T-252; data and the Huawei
  setting kept). Huawei launch setting **manual**, set an hour before. Tier **Equilibrado**, set at
  17:16 with the app open, just before leaving. iPhone with Sensor Logger on the way there only
  (`Madeira-fieldwork/iphone-2026-10-06-gym/`).
- **There (17:19 to 17:26, 2.3 km by road):** recorded. A point every 13 to 27 s at ±3 to 5 m. Against
  the iPhone, the line the map draws covers **97% of the route** (misses of 10 m and 50 m) and
  **all of it lies on the route** (within 25 m). The app had been opened a minute before leaving.
- **At the gym (17:25 to 18:18):** a few points, as it should be when still. They sat in the
  recorder's memory for 80 minutes (the 1 km deferral is never reached standing still) and were
  saved only when the app was opened at 18:44.
- **Back:** **nothing.** No point between 18:18:21 at the gym and 18:44:38 at home. The phone's
  log from 18:33 shows almost no activity and no location work at all until the screen came on at
  18:44:37. The silence notice was showing, and *Reiniciar* was tapped.
- **So:** the launch setting alone did not fix it. Recording works just after the app has been
  open and stops once the phone has slept for a while. On 4 October (Preciso, **phone in a pocket**,
  the lead confirmed) it kept a point every 10 s for over an hour twice with no restart, so the next
  test is Preciso, in a pocket, screen off, app not opened.
- Data: read-only pull at 18:50, scratch only.

### 2026-10-06: motorbike ride, the recorder barely recorded

- **Setup:** P30, cable build vc3 (installed 2026-10-05 after an uninstall). *Registo automático*
  on, tier **Poupança** (set at 14:28 just before leaving). iPhone 15 with Sensor Logger alongside,
  ~1 point a second, ±3 m.
- **Ride:** 14:29 to 15:52, 32.7 km, through Camacha, several stops.
- **What the P30 kept:** 29 points. **Nothing from 14:38 to 15:11** while riding at 30 to 60 km/h.
  Points arrived almost only when the app was open. Lit roads went 44.8 to 46.1 km.
- **What it felt like:** slow to open and unclear whether it was recording. The app restarted from
  cold four times (14:28, 14:36, 15:12, 15:18), so Huawei was closing it between looks.
- **Stamps:** Camacha, correct. But its dwell reads 1,554 s because the exit was only processed when
  the app was next opened.
- **Not recorded:** the lead switched to *Equilibrado* mid-ride; the database shows no change.
- **Likely causes, not yet separated:** (1) Poupança asks for no GPS and holds background points in
  memory until 9 min and 3 km have both passed; (2) Huawei's *Iniciar aplicações* setting, which
  **was on *Gestão automática*** (checked that evening; reset by the uninstall on 2026-10-05).
- **Detail:** field-notes, 2026-10-06. Data: `Madeira-fieldwork/iphone-2026-10-06-ride/`,
  `p30-2026-10-06-t235b/`.

### 2026-10-05: the first real purchase

- Play install on the P30, licence-tester card. Bought, unlocked, acknowledged (order still
  *Processado* ten minutes later). Refunded with *Remover titularidade*, so the phone is a new user
  again.
- **Learned:** a cable build cannot buy (`item-unavailable`); only the copy Google signs can. A Play
  install is not debuggable, so its data cannot be pulled. Details in HANDOFF, 2026-10-05.

### 2026-10-04: an outing by car and on foot, with the iPhone alongside

- **Setup:** P30, tier **Preciso**, Huawei launch setting manual (set 2026-09-24, before any
  uninstall). iPhone 15 with Sensor Logger.
- **Result:** over the iPhone's 3h13 and 24 km, the P30 kept **1,088 points**; its longest gap was
  14 min. Driving up to 120 km/h was recorded. Stamps: Praia Formosa (on foot, 16 min) and Câmara de
  Lobos.
- Also proven that day: *Guardar uma cópia* and *Restaurar* on the real trip (17,075 points).
- **Not yet done:** a point by point comparison against the iPhone track, the way the 2026-10-06
  ride was compared. Data: `Madeira-fieldwork/p30-2026-10-04/` (iPhone zip inside).

### 2026-09-27: the phone's own speed tells rest from movement

- Real desk data plus probe databases on the P30. The speed the GPS reports separates desk drift
  (median 0.14 m/s) from walking, even when positions jump 20 to 40 m. This is what the map's road
  matching stands on (D-093). Field-notes, 2026-09-27.

### 2026-09-26: lines where nobody went

- The map drew 0.8 km of lines around a phone lying on a desk. Cause and fix: field-notes,
  2026-09-26 (T-244).

### 2026-09-24: an update stops the recorder

- Installing an update over the running app left it off for 22 h, until opened. Two blockers:
  Huawei withholding the update broadcast (fixed by *Iniciar aplicações → manual*, all three on) and
  Huawei refusing to start the recorder from the background. TASKS, T-210.
- ⚠ That Huawei setting is **per installed copy**: every uninstall resets it.

### 2026-09-22 to 25: is it capturing?

- Four days still on a desk, tier Preciso: capture continuous, 95% of points within 20 m, longest
  silence 27 min. The "random blue lines" were indoor GPS drawn as movement (T-229).
  Field-notes, 2026-09-25.

### 2026-09-22: the recorder was dead and said it was recording

- Found while setting up a 72 h soak. No service, no location request, no write since 28 August,
  while Settings said *A registar a sua viagem*. Fixed (T-174). **Lesson:** check
  `dumpsys activity services` before believing any recording state the app reports.

### 2026-08-22 to 28: the August loan

- The first real data: 831 points, 30 trips. Found three bugs: flying home put the recorder in a
  trip-creation loop (26 "trip ended" notifications), registering geofences wrote an exit for every
  region, and the recorder was started from the background and never ran. All fixed 2026-09-22.
  Field-notes, 2026-09-22.

### 2026-08-19: Firebase Test Lab

- Robot test on a Pixel 5, Android 11: no crashes, the map renders with Google's terrain. English
  only; nobody walked anywhere.

### 2026-08-16: PR18 Levada do Rei

- On foot, no app. Observations about how levadas are walked, which changed D-068. Field-notes,
  2026-08-16.

## Never tested

- **Battery over a day.** Only a morning has moved the level (100 to 96% over 2 h with a ride);
  the 12-hour day of T-054 is unmeasured. Start the next run near 80%.
- **A full day or overnight in the pocket**, recording in the background.
- **GPS under forest canopy** (T-076 to T-080).
- **Any Android but the P30.** Huawei is among the harshest at closing background apps, so it is a
  hard test, but it is one phone.
- **iPhone.** The app has never run on iOS.
- **A trip recorded by the app with no one opening it.**
- **Automatic recording while moving, no outing** (review F1): every ride since 6 Oct was an outing.

## Checklist before a ride

1. **After any uninstall, set Huawei's launch setting again:** *Definições → Bateria → Iniciar
   aplicações → Bruma* → manual, all three switches on.
2. **Choose the tier at home, before leaving, and check it stuck** (reopen Settings).
3. **Start Sensor Logger on the iPhone** at the same moment. Share the zip afterwards.
4. **Write down roughly when you stop and when you open the app.** Opening it changes what it
   records, so the times matter.
5. **Leave the phone plugged in afterwards.** The database is pulled by cable, read only.

## Next test

**F1: automatic recording, moving, untouched.** A ride or drive of 20 minutes or more with
*registo automático* on and **no outing**: phone in a pocket with the screen off, the app not opened
from leaving until the phone is back on the cable, iPhone alongside. Pass: 90% of the route lit
within 10 m. If it fails, the recorder's sleep on EMUI is the work. Best started near 80% battery,
which makes it the battery run too.

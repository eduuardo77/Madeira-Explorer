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
  memory until 9 min and 3 km have both passed; (2) Huawei's *Iniciar aplicações* setting was most
  likely reset by the uninstall on 2026-10-05.
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

- **Battery.** No figure has been measured (D-041).
- **A full day or overnight in the pocket**, recording in the background.
- **GPS under forest canopy** (T-076 to T-080).
- **Any Android but the P30.** Huawei is among the harshest at closing background apps, so it is a
  hard test, but it is one phone.
- **iPhone.** The app has never run on iOS.
- **A trip recorded by the app with no one opening it.**

## Checklist before a ride

1. **After any uninstall, set Huawei's launch setting again:** *Definições → Bateria → Iniciar
   aplicações → Bruma* → manual, all three switches on.
2. **Choose the tier at home, before leaving, and check it stuck** (reopen Settings).
3. **Start Sensor Logger on the iPhone** at the same moment. Share the zip afterwards.
4. **Write down roughly when you stop and when you open the app.** Opening it changes what it
   records, so the times matter.
5. **Leave the phone plugged in afterwards.** The database is pulled by cable, read only.

## Next test

The same kind of ride, at least 20 minutes, on **Equilibrado**, with step 1 done and the iPhone
alongside. If it still leaves holes, Huawei is closing the recorder. If it does not, Poupança needs
fixing.
